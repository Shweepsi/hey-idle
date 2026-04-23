-- =============================================================================
-- Admin RPCs
--
-- Every mutating RPC:
--   1. Verifies the caller is in admin_users.
--   2. Performs the action inside a single transaction.
--   3. Writes an admin_audit_log row with before/after values + meta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- helper: read a single jsonb number out of global_overrides, defaulting.
-- Used by the economy RPCs (patched below).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._override_num(p_key text, p_default numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(
    (SELECT (value ->> p_key)::numeric
       FROM public.economy_configs
       WHERE key = 'global_overrides'),
    p_default
  );
$$;

CREATE OR REPLACE FUNCTION public._override_bool(p_key text, p_default boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(
    (SELECT (value ->> p_key)::boolean
       FROM public.economy_configs
       WHERE key = 'global_overrides'),
    p_default
  );
$$;

GRANT EXECUTE ON FUNCTION public._override_num(text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public._override_bool(text, boolean) TO authenticated;

-- =============================================================================
-- Patch: apply global_overrides.harvest_mult + growth_mult + gem_chance_bonus
--        to harvest_plant_transaction.
--
-- We only re-apply three small changes vs the v2 RPC:
--   - v_harvest_mult *= _override_num('harvest_mult', 1)
--   - v_growth_mult  *= _override_num('growth_mult',  1)
--   - v_final_gem_chance += _override_num('gem_chance_bonus', 0)  (before the gem_boost step)
--   - v_exp_reward *= _override_num('xp_mult', 1)
--   - v_base_cost *= _override_num('plant_cost_mult', 1) -- for consistency, though planting cost is in plant_direct_atomic
-- =============================================================================
CREATE OR REPLACE FUNCTION public.harvest_plant_transaction(
  p_user_id uuid,
  p_plot_number integer
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_plot   public.garden_plots%ROWTYPE;
  v_plant  public.plant_types%ROWTYPE;

  v_harvest_mult numeric := 1;
  v_growth_mult numeric := 1;
  v_exp_mult numeric := 1;
  v_plant_cost_red numeric := 1;
  v_gem_chance_upgr numeric := 0;

  v_coin_boost numeric := 1;
  v_gem_boost numeric := 1;
  v_growth_boost numeric := 1;

  v_ess record;

  -- Global admin overrides
  v_ov_harvest numeric;
  v_ov_growth numeric;
  v_ov_xp numeric;
  v_ov_gem numeric;

  v_plant_level integer;
  v_player_level integer;
  v_old_level integer;
  v_permanent_mult numeric;
  v_base_cost numeric;
  v_profit_margin numeric;
  v_base_profit numeric;
  v_time_bonus numeric;
  v_level_bonus numeric;
  v_harvest_reward numeric;
  v_exp_reward integer;

  v_adjusted_growth_seconds integer;
  v_elapsed_seconds bigint;
  v_remaining integer;

  v_new_coins numeric;
  v_new_gems integer;
  v_new_exp integer;
  v_new_level integer;
  v_new_harvests integer;
  v_level_gem_bonus integer := 0;

  v_final_gem_chance numeric;
  v_gem_reward integer := 0;

  v_upg record;
  v_fx record;
  v_coin_cap constant numeric := 1000000000000000000;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR v_auth_uid <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Refuse to run when maintenance_mode is toggled on (clients show a banner).
  IF public._override_bool('maintenance_mode', false) THEN
    RETURN json_build_object('success', false, 'error', 'Maintenance en cours');
  END IF;

  SELECT * INTO v_garden FROM public.player_gardens
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Garden not found');
  END IF;

  SELECT * INTO v_plot FROM public.garden_plots
    WHERE user_id = p_user_id AND plot_number = p_plot_number FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Plot not found');
  END IF;
  IF v_plot.plant_type IS NULL OR v_plot.planted_at IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No plant to harvest');
  END IF;

  SELECT * INTO v_plant FROM public.plant_types WHERE id = v_plot.plant_type;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Plant type not found');
  END IF;

  v_plant_level    := GREATEST(1, COALESCE(v_plant.level_required, 1));
  v_player_level   := GREATEST(1, COALESCE(v_garden.level, 1));
  v_old_level      := v_player_level;
  v_permanent_mult := GREATEST(1, COALESCE(v_garden.permanent_multiplier, 1));

  SELECT * INTO v_ess FROM public._essence_effects(p_user_id);

  FOR v_upg IN
    SELECT lu.effect_type, lu.effect_value
    FROM public.player_upgrades pu
    JOIN public.level_upgrades lu ON lu.id = pu.upgrade_id
    WHERE pu.user_id = p_user_id AND pu.active = true
  LOOP
    IF v_upg.effect_type = 'harvest_multiplier' AND v_upg.effect_value > 0 THEN
      v_harvest_mult := v_harvest_mult * v_upg.effect_value;
    ELSIF v_upg.effect_type = 'growth_speed' AND v_upg.effect_value > 0 THEN
      v_growth_mult := v_growth_mult * v_upg.effect_value;
    ELSIF v_upg.effect_type = 'exp_multiplier' AND v_upg.effect_value > 0 THEN
      v_exp_mult := v_exp_mult * v_upg.effect_value;
    ELSIF v_upg.effect_type = 'plant_cost_reduction' AND v_upg.effect_value > 0 THEN
      v_plant_cost_red := v_plant_cost_red * v_upg.effect_value;
    ELSIF v_upg.effect_type = 'gem_chance' THEN
      v_gem_chance_upgr := v_gem_chance_upgr + v_upg.effect_value;
    END IF;
  END LOOP;

  FOR v_fx IN
    SELECT effect_type, MAX(effect_value) AS val
    FROM public.active_effects
    WHERE user_id = p_user_id AND expires_at > now()
    GROUP BY effect_type
  LOOP
    IF v_fx.effect_type = 'coin_boost' AND v_fx.val > 0 THEN
      v_coin_boost := v_fx.val;
    ELSIF v_fx.effect_type = 'gem_boost' AND v_fx.val > 0 THEN
      v_gem_boost := v_fx.val;
    ELSIF v_fx.effect_type IN ('growth_boost','growth_speed') AND v_fx.val > 0 THEN
      v_growth_boost := v_fx.val;
    END IF;
  END LOOP;

  v_harvest_mult := v_harvest_mult * (1 + v_ess.harvest_bonus);
  v_growth_mult  := v_growth_mult  * (1 + v_ess.growth_bonus);

  -- Global overrides
  v_ov_harvest := public._override_num('harvest_mult', 1);
  v_ov_growth  := public._override_num('growth_mult', 1);
  v_ov_xp      := public._override_num('xp_mult', 1);
  v_ov_gem     := public._override_num('gem_chance_bonus', 0);

  v_harvest_mult := v_harvest_mult * v_ov_harvest;
  v_growth_mult  := v_growth_mult  * v_ov_growth;

  v_adjusted_growth_seconds := GREATEST(1, FLOOR(
    COALESCE(v_plot.growth_time_seconds, v_plant.base_growth_seconds, 60)::numeric
    / GREATEST(v_growth_mult * v_growth_boost, 0.001)
  )::integer);
  v_elapsed_seconds := FLOOR(EXTRACT(EPOCH FROM (now() - v_plot.planted_at)))::bigint;
  IF v_elapsed_seconds < v_adjusted_growth_seconds THEN
    v_remaining := v_adjusted_growth_seconds - v_elapsed_seconds::integer;
    RETURN json_build_object(
      'success', false,
      'error', 'Plant not ready yet',
      'time_remaining', v_remaining
    );
  END IF;

  v_base_cost := 50 * POWER(1.55::numeric, v_plant_level - 1) * v_plant_cost_red;
  v_profit_margin := CASE
    WHEN v_plant_level <= 3 THEN 2.2
    WHEN v_plant_level <= 6 THEN 2.5
    WHEN v_plant_level <= 9 THEN 2.9
    ELSE 3.5
  END;
  v_base_profit := v_base_cost * v_profit_margin;
  v_time_bonus  := FLOOR(COALESCE(v_plot.growth_time_seconds, v_plant.base_growth_seconds, 60) / 600.0) * 0.1;
  v_level_bonus := 1 + v_player_level * 0.015;

  v_harvest_reward := LEAST(
    v_coin_cap,
    GREATEST(0::numeric, FLOOR(
      v_base_profit * (1 + v_time_bonus) * v_level_bonus
      * v_harvest_mult * v_permanent_mult * v_coin_boost
    ))
  );
  v_exp_reward := GREATEST(0, FLOOR((15 + v_plant_level * 5) * v_exp_mult * v_ov_xp)::integer);

  v_final_gem_chance := LEAST(
    0.9,
    GREATEST(0::numeric,
      (0.03 + v_gem_chance_upgr + v_ess.gem_chance_bonus + v_ov_gem) * v_gem_boost
    )
  );
  IF v_final_gem_chance > 0 AND random() < v_final_gem_chance THEN
    v_gem_reward := 1;
  END IF;

  v_new_coins := LEAST(v_coin_cap, GREATEST(0::numeric, COALESCE(v_garden.coins, 0) + v_harvest_reward));
  v_new_exp   := GREATEST(0, COALESCE(v_garden.experience, 0) + v_exp_reward);
  v_new_level := GREATEST(1, FLOOR(SQRT(v_new_exp / 80.0)) + 1)::integer;
  v_new_harvests := COALESCE(v_garden.total_harvests, 0) + 1;

  v_level_gem_bonus := public._level_milestone_gems(v_old_level, v_new_level);
  v_new_gems := LEAST(1000000,
    GREATEST(0, COALESCE(v_garden.gems, 0) + v_gem_reward + v_level_gem_bonus)
  );

  UPDATE public.player_gardens
  SET coins = v_new_coins,
      gems = v_new_gems,
      experience = v_new_exp,
      level = v_new_level,
      total_harvests = v_new_harvests,
      total_coins_earned = LEAST(v_coin_cap,
        GREATEST(0::numeric, COALESCE(total_coins_earned, 0) + v_harvest_reward)),
      coins_earned_this_run = LEAST(v_coin_cap,
        GREATEST(0::numeric, COALESCE(coins_earned_this_run, 0) + v_harvest_reward)),
      economy_version = 2,
      last_played = now()
  WHERE user_id = p_user_id;

  UPDATE public.garden_plots
  SET plant_type = NULL, planted_at = NULL, growth_time_seconds = NULL, updated_at = now()
  WHERE user_id = p_user_id AND plot_number = p_plot_number;

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, LEAST(v_harvest_reward, 2147483647)::integer, 'harvest',
          'Harvest: ' || COALESCE(v_plant.display_name, v_plant.name, 'plant'));

  INSERT INTO public.economy_events (user_id, event_type, coins_delta, gems_delta, meta)
  VALUES (p_user_id, 'harvest', v_harvest_reward,
          v_gem_reward + v_level_gem_bonus,
          jsonb_build_object(
            'plant', v_plant.name,
            'plant_level', v_plant_level,
            'player_level_before', v_old_level,
            'player_level_after', v_new_level,
            'override_harvest', v_ov_harvest,
            'override_growth', v_ov_growth,
            'override_xp', v_ov_xp
          ));

  INSERT INTO public.plant_discoveries (user_id, plant_type_id, discovery_method)
  SELECT p_user_id, v_plant.id, 'harvest'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.plant_discoveries
    WHERE user_id = p_user_id AND plant_type_id = v_plant.id
  );

  RETURN json_build_object(
    'success', true,
    'final_coins', v_new_coins,
    'final_gems', v_new_gems,
    'final_experience', v_new_exp,
    'final_level', v_new_level,
    'final_harvests', v_new_harvests,
    'harvest_reward', v_harvest_reward,
    'exp_reward', v_exp_reward,
    'gem_reward', v_gem_reward,
    'level_gem_bonus', v_level_gem_bonus,
    'plant_name', v_plant.display_name,
    'old_coins', COALESCE(v_garden.coins, 0),
    'old_gems', COALESCE(v_garden.gems, 0),
    'old_experience', COALESCE(v_garden.experience, 0),
    'old_level', v_old_level,
    'economy_version', 2,
    'unified_calculation', true
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- Patch: apply robot_mult override inside collect_robot_income_atomic.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.collect_robot_income_atomic(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_has_auto_harvest boolean := false;
  v_harvest_mult numeric := 1;
  v_robot_level integer := 0;
  v_plant_level integer;
  v_level_multiplier numeric;
  v_permanent_mult numeric;
  v_coins_per_minute numeric;
  v_offline_hours integer;
  v_max_minutes integer;
  v_elapsed_minutes integer;
  v_fresh_income numeric;
  v_max_accumulation numeric;
  v_total numeric;
  v_exp_reward integer;
  v_new_exp integer;
  v_new_level integer;
  v_old_level integer;
  v_level_gem_bonus integer;
  v_new_gems integer;
  v_new_coins numeric;
  v_now timestamptz := now();
  v_upg record;
  v_ess record;
  v_ov_robot numeric;
  v_ov_xp numeric;
  v_coin_cap constant numeric := 1000000000000000000;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR v_auth_uid <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF public._override_bool('maintenance_mode', false) THEN
    RETURN json_build_object('success', false, 'error', 'Maintenance en cours');
  END IF;

  SELECT * INTO v_garden FROM public.player_gardens
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Garden not found');
  END IF;

  FOR v_upg IN
    SELECT lu.effect_type, lu.effect_value
    FROM public.player_upgrades pu
    JOIN public.level_upgrades lu ON lu.id = pu.upgrade_id
    WHERE pu.user_id = p_user_id AND pu.active = true
  LOOP
    IF v_upg.effect_type = 'auto_harvest' THEN
      v_has_auto_harvest := true;
      IF v_robot_level < 1 THEN v_robot_level := 1; END IF;
    ELSIF v_upg.effect_type = 'robot_level' THEN
      v_robot_level := GREATEST(v_robot_level, FLOOR(v_upg.effect_value)::integer);
    ELSIF v_upg.effect_type = 'harvest_multiplier' AND v_upg.effect_value > 0 THEN
      v_harvest_mult := v_harvest_mult * v_upg.effect_value;
    END IF;
  END LOOP;

  IF NOT v_has_auto_harvest THEN
    RETURN json_build_object('success', false, 'error', 'Robot not unlocked');
  END IF;

  SELECT * INTO v_ess FROM public._essence_effects(p_user_id);

  IF v_garden.robot_last_collected IS NULL THEN
    UPDATE public.player_gardens
    SET robot_last_collected = v_now, robot_accumulated_coins = 0,
        robot_level = v_robot_level, economy_version = 2, last_played = v_now
    WHERE user_id = p_user_id;
    RETURN json_build_object(
      'success', true, 'first_activation', true, 'collected', 0,
      'exp_reward', 0, 'robot_level', v_robot_level
    );
  END IF;

  v_plant_level := GREATEST(1, LEAST(v_robot_level, 10));
  v_level_multiplier := POWER(v_plant_level::numeric, 1.35);
  v_permanent_mult := GREATEST(1, COALESCE(v_garden.permanent_multiplier, 1));
  v_harvest_mult := v_harvest_mult * (1 + v_ess.robot_bonus);

  v_ov_robot := public._override_num('robot_mult', 1);
  v_ov_xp    := public._override_num('xp_mult', 1);

  v_coins_per_minute := LEAST(
    v_coin_cap,
    GREATEST(0::numeric, FLOOR(40 * v_level_multiplier * v_harvest_mult * v_permanent_mult * v_ov_robot))
  );

  v_offline_hours := LEAST(24, 8 + COALESCE(v_ess.offline_extra_hours, 0));
  v_max_minutes := v_offline_hours * 60;
  v_elapsed_minutes := GREATEST(0, LEAST(
    v_max_minutes,
    FLOOR(EXTRACT(EPOCH FROM (v_now - v_garden.robot_last_collected)) / 60.0)::integer
  ));
  v_fresh_income := v_coins_per_minute * v_elapsed_minutes;
  v_max_accumulation := v_coins_per_minute * v_max_minutes;
  v_total := LEAST(v_max_accumulation,
                    COALESCE(v_garden.robot_accumulated_coins, 0) + v_fresh_income);

  IF v_total <= 0 THEN
    UPDATE public.player_gardens
    SET robot_last_collected = v_now, robot_level = v_robot_level,
        economy_version = 2, last_played = v_now
    WHERE user_id = p_user_id;
    RETURN json_build_object(
      'success', true, 'collected', 0, 'exp_reward', 0,
      'robot_level', v_robot_level,
      'coins_per_minute', v_coins_per_minute,
      'offline_cap_hours', v_offline_hours
    );
  END IF;

  v_old_level := GREATEST(1, COALESCE(v_garden.level, 1));
  v_exp_reward := GREATEST(1, FLOOR(v_total / 500.0 * v_ov_xp)::integer + v_robot_level);
  v_new_exp := GREATEST(0, COALESCE(v_garden.experience, 0) + v_exp_reward);
  v_new_level := GREATEST(1, FLOOR(SQRT(v_new_exp / 80.0)) + 1)::integer;
  v_new_coins := LEAST(v_coin_cap,
                        GREATEST(0::numeric, COALESCE(v_garden.coins, 0) + v_total));

  v_level_gem_bonus := public._level_milestone_gems(v_old_level, v_new_level);
  v_new_gems := LEAST(1000000, GREATEST(0, COALESCE(v_garden.gems, 0) + v_level_gem_bonus));

  UPDATE public.player_gardens
  SET coins = v_new_coins, gems = v_new_gems, experience = v_new_exp, level = v_new_level,
      robot_accumulated_coins = 0, robot_last_collected = v_now, robot_level = v_robot_level,
      total_coins_earned = LEAST(v_coin_cap,
        GREATEST(0::numeric, COALESCE(total_coins_earned, 0) + v_total)),
      coins_earned_this_run = LEAST(v_coin_cap,
        GREATEST(0::numeric, COALESCE(coins_earned_this_run, 0) + v_total)),
      economy_version = 2, last_played = v_now
  WHERE user_id = p_user_id;

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, LEAST(v_total, 2147483647)::integer, 'robot_collection',
          'Robot income (lvl ' || v_robot_level || ') +' || v_exp_reward || ' XP');

  INSERT INTO public.economy_events (user_id, event_type, coins_delta, gems_delta, meta)
  VALUES (p_user_id, 'robot_collection', v_total, v_level_gem_bonus,
          jsonb_build_object(
            'robot_level', v_robot_level,
            'minutes', v_elapsed_minutes,
            'coins_per_minute', v_coins_per_minute,
            'offline_cap_hours', v_offline_hours,
            'override_robot', v_ov_robot
          ));

  RETURN json_build_object(
    'success', true, 'collected', v_total, 'exp_reward', v_exp_reward,
    'new_coins', v_new_coins, 'new_experience', v_new_exp, 'new_level', v_new_level,
    'level_gem_bonus', v_level_gem_bonus, 'robot_level', v_robot_level,
    'coins_per_minute', v_coins_per_minute, 'offline_cap_hours', v_offline_hours,
    'economy_version', 2
  );
END;
$$;

-- =============================================================================
-- ADMIN RPCs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- admin_require: raises if caller is not admin. Used at top of every admin RPC.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._admin_require()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_admin(v_uid) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_update_economy_config — merge a jsonb patch into the config row.
-- The patch is deep-merged into the existing `value` column; missing keys are
-- preserved so callers can PATCH one key at a time.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_economy_config(
  p_key text,
  p_patch jsonb
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  v_admin_uid := public._admin_require();
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RETURN json_build_object('success', false, 'error', 'Patch must be a JSON object');
  END IF;

  SELECT value INTO v_before FROM public.economy_configs WHERE key = p_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.economy_configs (key, value, description, updated_by)
    VALUES (p_key, p_patch, NULL, v_admin_uid)
    RETURNING value INTO v_after;
  ELSE
    v_after := v_before || p_patch;  -- shallow merge — admins can nest if they want
    UPDATE public.economy_configs
    SET value = v_after, updated_at = now(), updated_by = v_admin_uid
    WHERE key = p_key;
  END IF;

  INSERT INTO public.admin_audit_log
    (admin_user_id, action, target_key, before_value, after_value, meta)
  VALUES
    (v_admin_uid, 'economy_config_update', p_key, v_before, v_after,
     jsonb_build_object('patch_keys', (SELECT jsonb_agg(k) FROM jsonb_object_keys(p_patch) k)));

  RETURN json_build_object('success', true, 'key', p_key, 'value', v_after);
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_reset_economy_overrides — restore global_overrides to shipping defaults.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_economy_overrides()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_before jsonb;
  v_defaults jsonb;
BEGIN
  v_admin_uid := public._admin_require();
  v_defaults := jsonb_build_object(
    'harvest_mult',        1.0,
    'robot_mult',          1.0,
    'xp_mult',             1.0,
    'growth_mult',         1.0,
    'gem_chance_bonus',    0.0,
    'essence_mult',        1.0,
    'plant_cost_mult',     1.0,
    'prestige_cost_mult',  1.0,
    'event_name',          NULL,
    'event_banner',        NULL,
    'maintenance_mode',    false,
    'maintenance_message', NULL
  );
  SELECT value INTO v_before FROM public.economy_configs WHERE key = 'global_overrides' FOR UPDATE;
  UPDATE public.economy_configs
  SET value = v_defaults, updated_at = now(), updated_by = v_admin_uid
  WHERE key = 'global_overrides';

  INSERT INTO public.admin_audit_log
    (admin_user_id, action, target_key, before_value, after_value)
  VALUES (v_admin_uid, 'economy_config_reset', 'global_overrides', v_before, v_defaults);

  RETURN json_build_object('success', true, 'value', v_defaults);
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_grant_currency — add coins/gems/essence to a player.
-- Negative values are allowed; server clamps to 0 so you can't go negative.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_currency(
  p_target_user_id uuid,
  p_coins numeric,
  p_gems integer,
  p_essence numeric,
  p_reason text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_coin_cap constant numeric := 1000000000000000000;
  v_new_coins numeric;
  v_new_gems integer;
  v_new_essence numeric;
BEGIN
  v_admin_uid := public._admin_require();

  SELECT * INTO v_garden FROM public.player_gardens
    WHERE user_id = p_target_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Target garden not found');
  END IF;

  v_new_coins   := LEAST(v_coin_cap, GREATEST(0::numeric, COALESCE(v_garden.coins, 0) + COALESCE(p_coins, 0)));
  v_new_gems    := LEAST(1000000, GREATEST(0, COALESCE(v_garden.gems, 0) + COALESCE(p_gems, 0)));
  v_new_essence := LEAST(1000000000000::numeric,
                          GREATEST(0::numeric, COALESCE(v_garden.essence, 0) + COALESCE(p_essence, 0)));

  UPDATE public.player_gardens
  SET coins = v_new_coins, gems = v_new_gems, essence = v_new_essence, last_played = now()
  WHERE user_id = p_target_user_id;

  INSERT INTO public.admin_audit_log
    (admin_user_id, action, target_user_id, before_value, after_value, meta)
  VALUES (v_admin_uid, 'grant_currency', p_target_user_id,
          jsonb_build_object('coins', v_garden.coins, 'gems', v_garden.gems, 'essence', v_garden.essence),
          jsonb_build_object('coins', v_new_coins, 'gems', v_new_gems, 'essence', v_new_essence),
          jsonb_build_object('reason', p_reason,
                             'delta_coins', p_coins, 'delta_gems', p_gems, 'delta_essence', p_essence));

  RETURN json_build_object(
    'success', true,
    'new_coins', v_new_coins, 'new_gems', v_new_gems, 'new_essence', v_new_essence
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_reset_player — wipe a player back to first-time state. Destructive.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reset_player(
  p_target_user_id uuid,
  p_reason text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_before jsonb;
BEGIN
  v_admin_uid := public._admin_require();

  SELECT jsonb_build_object(
    'coins', coins, 'gems', gems, 'essence', essence, 'level', level,
    'experience', experience, 'prestige_level', prestige_level,
    'permanent_multiplier', permanent_multiplier
  ) INTO v_before
  FROM public.player_gardens WHERE user_id = p_target_user_id FOR UPDATE;

  IF v_before IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Target garden not found');
  END IF;

  UPDATE public.player_gardens
  SET coins = 100, gems = 0, essence = 0, level = 1, experience = 0,
      prestige_level = 0, prestige_points = 0, permanent_multiplier = 1,
      total_harvests = 0, total_coins_earned = 0, coins_earned_this_run = 0,
      daily_streak = 0, last_daily_claim_date = NULL,
      robot_level = 0, robot_last_collected = NULL, robot_accumulated_coins = 0,
      robot_plant_type = NULL, economy_version = 2, last_played = now()
  WHERE user_id = p_target_user_id;

  UPDATE public.player_upgrades SET active = false WHERE user_id = p_target_user_id;
  DELETE FROM public.player_essence_upgrades WHERE user_id = p_target_user_id;
  DELETE FROM public.active_effects WHERE user_id = p_target_user_id;
  UPDATE public.garden_plots
    SET plant_type = NULL, planted_at = NULL, growth_time_seconds = NULL,
        unlocked = (plot_number <= 2), updated_at = now()
    WHERE user_id = p_target_user_id;

  INSERT INTO public.admin_audit_log
    (admin_user_id, action, target_user_id, before_value, meta)
  VALUES (v_admin_uid, 'reset_player', p_target_user_id, v_before,
          jsonb_build_object('reason', p_reason));

  RETURN json_build_object('success', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_search_players — text search over profiles + garden stats, paginated.
-- Returns small list for UI table. Searches display_name (profiles) or email
-- (auth.users) case-insensitively.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_search_players(
  p_query text,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
) RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_rows json;
BEGIN
  v_admin_uid := public._admin_require();
  p_limit  := GREATEST(1, LEAST(100, COALESCE(p_limit, 25)));
  p_offset := GREATEST(0, COALESCE(p_offset, 0));

  SELECT json_agg(row_to_json(r)) INTO v_rows FROM (
    SELECT
      pg.user_id,
      u.email,
      p.display_name,
      pg.coins,
      pg.gems,
      pg.essence,
      pg.level,
      pg.prestige_level,
      pg.total_harvests,
      pg.last_played,
      pg.created_at
    FROM public.player_gardens pg
    LEFT JOIN auth.users u ON u.id = pg.user_id
    LEFT JOIN public.profiles p ON p.id = pg.user_id
    WHERE
      p_query IS NULL OR p_query = ''
      OR u.email ILIKE '%' || p_query || '%'
      OR COALESCE(p.display_name, '') ILIKE '%' || p_query || '%'
      OR pg.user_id::text = p_query
    ORDER BY pg.last_played DESC NULLS LAST
    LIMIT p_limit OFFSET p_offset
  ) r;

  RETURN json_build_object(
    'success', true,
    'rows', COALESCE(v_rows, '[]'::json),
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_get_player_detail — full picture of one player.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_player_detail(p_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_garden json;
  v_upgrades json;
  v_essence json;
  v_recent_events json;
  v_effects json;
  v_profile json;
BEGIN
  v_admin_uid := public._admin_require();

  SELECT row_to_json(pg) INTO v_garden
  FROM public.player_gardens pg WHERE user_id = p_target_user_id;
  IF v_garden IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not found');
  END IF;

  SELECT json_agg(row_to_json(x)) INTO v_upgrades FROM (
    SELECT lu.name, lu.display_name, lu.effect_type, lu.effect_value, pu.active, pu.purchased_at
    FROM public.player_upgrades pu
    JOIN public.level_upgrades lu ON lu.id = pu.upgrade_id
    WHERE pu.user_id = p_target_user_id
    ORDER BY lu.level_required
  ) x;

  SELECT json_agg(row_to_json(x)) INTO v_essence FROM (
    SELECT upgrade_id, level, updated_at
    FROM public.player_essence_upgrades
    WHERE user_id = p_target_user_id
    ORDER BY upgrade_id
  ) x;

  SELECT json_agg(row_to_json(x)) INTO v_recent_events FROM (
    SELECT event_type, coins_delta, gems_delta, essence_delta, meta, created_at
    FROM public.economy_events
    WHERE user_id = p_target_user_id
    ORDER BY created_at DESC LIMIT 50
  ) x;

  SELECT json_agg(row_to_json(x)) INTO v_effects FROM (
    SELECT effect_type, effect_value, expires_at, source
    FROM public.active_effects
    WHERE user_id = p_target_user_id AND expires_at > now()
  ) x;

  SELECT row_to_json(p) INTO v_profile
  FROM public.profiles p WHERE p.id = p_target_user_id;

  RETURN json_build_object(
    'success', true,
    'garden', v_garden,
    'profile', v_profile,
    'upgrades', COALESCE(v_upgrades, '[]'::json),
    'essence_upgrades', COALESCE(v_essence, '[]'::json),
    'recent_events', COALESCE(v_recent_events, '[]'::json),
    'active_effects', COALESCE(v_effects, '[]'::json)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_get_economy_health — dashboard metrics.
-- Returns a single row with: DAU, total players, coin velocity (last 24h),
-- prestige distribution, top events, etc.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_economy_health()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_total_players integer;
  v_dau_24h integer;
  v_dau_7d integer;
  v_coins_earned_24h numeric;
  v_gems_earned_24h numeric;
  v_essence_earned_24h numeric;
  v_harvests_24h integer;
  v_prestiges_24h integer;
  v_prestige_dist json;
  v_top_levels json;
  v_event_counts json;
  v_active_boosts integer;
BEGIN
  v_admin_uid := public._admin_require();

  SELECT COUNT(*) INTO v_total_players FROM public.player_gardens;
  SELECT COUNT(*) INTO v_dau_24h FROM public.player_gardens
    WHERE last_played > now() - INTERVAL '24 hours';
  SELECT COUNT(*) INTO v_dau_7d FROM public.player_gardens
    WHERE last_played > now() - INTERVAL '7 days';

  SELECT
    COALESCE(SUM(CASE WHEN coins_delta > 0 THEN coins_delta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN gems_delta > 0 THEN gems_delta ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN essence_delta > 0 THEN essence_delta ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE event_type = 'harvest'),
    COUNT(*) FILTER (WHERE event_type = 'prestige')
  INTO v_coins_earned_24h, v_gems_earned_24h, v_essence_earned_24h,
       v_harvests_24h, v_prestiges_24h
  FROM public.economy_events
  WHERE created_at > now() - INTERVAL '24 hours';

  SELECT json_agg(row_to_json(x) ORDER BY prestige_level)
  INTO v_prestige_dist
  FROM (
    SELECT prestige_level, COUNT(*) AS n
    FROM public.player_gardens
    GROUP BY prestige_level
    ORDER BY prestige_level
  ) x;

  SELECT json_agg(row_to_json(x) ORDER BY level) INTO v_top_levels
  FROM (
    SELECT
      CASE
        WHEN level < 10 THEN '1-9'
        WHEN level < 25 THEN '10-24'
        WHEN level < 50 THEN '25-49'
        WHEN level < 100 THEN '50-99'
        ELSE '100+'
      END AS level,
      COUNT(*) AS n
    FROM public.player_gardens
    GROUP BY 1
    ORDER BY MIN(level)
  ) x;

  SELECT json_agg(row_to_json(x) ORDER BY n DESC)
  INTO v_event_counts
  FROM (
    SELECT event_type, COUNT(*) AS n
    FROM public.economy_events
    WHERE created_at > now() - INTERVAL '24 hours'
    GROUP BY event_type
  ) x;

  SELECT COUNT(*) INTO v_active_boosts
  FROM public.active_effects WHERE expires_at > now();

  RETURN json_build_object(
    'success', true,
    'generated_at', now(),
    'totals', json_build_object(
      'players', v_total_players,
      'dau_24h', v_dau_24h,
      'dau_7d',  v_dau_7d,
      'coins_earned_24h', v_coins_earned_24h,
      'gems_earned_24h',  v_gems_earned_24h,
      'essence_earned_24h', v_essence_earned_24h,
      'harvests_24h', v_harvests_24h,
      'prestiges_24h', v_prestiges_24h,
      'active_boosts', v_active_boosts
    ),
    'prestige_distribution', COALESCE(v_prestige_dist, '[]'::json),
    'level_distribution', COALESCE(v_top_levels, '[]'::json),
    'event_counts_24h', COALESCE(v_event_counts, '[]'::json)
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_get_audit_log — paginated feed.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_audit_log(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_action_filter text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_rows json;
BEGIN
  v_admin_uid := public._admin_require();
  p_limit  := GREATEST(1, LEAST(200, COALESCE(p_limit, 50)));
  p_offset := GREATEST(0, COALESCE(p_offset, 0));

  SELECT json_agg(row_to_json(r)) INTO v_rows FROM (
    SELECT
      al.id, al.admin_user_id, au.email AS admin_email,
      al.action, al.target_user_id, tu.email AS target_email,
      al.target_key, al.before_value, al.after_value, al.meta, al.created_at
    FROM public.admin_audit_log al
    LEFT JOIN auth.users au ON au.id = al.admin_user_id
    LEFT JOIN auth.users tu ON tu.id = al.target_user_id
    WHERE p_action_filter IS NULL OR al.action = p_action_filter
    ORDER BY al.created_at DESC
    LIMIT p_limit OFFSET p_offset
  ) r;

  RETURN json_build_object(
    'success', true,
    'rows', COALESCE(v_rows, '[]'::json),
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_toggle_feature_flag
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_toggle_feature_flag(
  p_key text,
  p_enabled boolean,
  p_rollout_percent integer DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  v_admin_uid := public._admin_require();
  IF p_rollout_percent IS NOT NULL AND (p_rollout_percent < 0 OR p_rollout_percent > 100) THEN
    RETURN json_build_object('success', false, 'error', 'rollout_percent must be 0-100');
  END IF;

  SELECT to_jsonb(ff) INTO v_before FROM public.feature_flags ff WHERE key = p_key FOR UPDATE;
  IF v_before IS NULL THEN
    INSERT INTO public.feature_flags (key, enabled, rollout_percent, updated_by)
    VALUES (p_key, p_enabled, COALESCE(p_rollout_percent, 100), v_admin_uid);
  ELSE
    UPDATE public.feature_flags
    SET enabled = p_enabled,
        rollout_percent = COALESCE(p_rollout_percent, rollout_percent),
        updated_at = now(), updated_by = v_admin_uid
    WHERE key = p_key;
  END IF;
  SELECT to_jsonb(ff) INTO v_after FROM public.feature_flags ff WHERE key = p_key;

  INSERT INTO public.admin_audit_log
    (admin_user_id, action, target_key, before_value, after_value)
  VALUES (v_admin_uid, 'feature_flag_update', p_key, v_before, v_after);

  RETURN json_build_object('success', true, 'flag', v_after);
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_create_event
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_event(
  p_name text,
  p_event_type text,
  p_multiplier numeric,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_banner_message text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_id uuid;
BEGIN
  v_admin_uid := public._admin_require();
  IF p_ends_at <= p_starts_at THEN
    RETURN json_build_object('success', false, 'error', 'ends_at must be after starts_at');
  END IF;

  INSERT INTO public.scheduled_events (name, event_type, multiplier, starts_at, ends_at, banner_message, created_by)
  VALUES (p_name, p_event_type, p_multiplier, p_starts_at, p_ends_at, p_banner_message, v_admin_uid)
  RETURNING id INTO v_id;

  INSERT INTO public.admin_audit_log
    (admin_user_id, action, meta)
  VALUES (v_admin_uid, 'event_create',
          jsonb_build_object(
            'id', v_id, 'name', p_name, 'event_type', p_event_type,
            'multiplier', p_multiplier,
            'starts_at', p_starts_at, 'ends_at', p_ends_at,
            'banner_message', p_banner_message));

  RETURN json_build_object('success', true, 'id', v_id);
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_delete_event — soft delete (active=false).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_event(p_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
BEGIN
  v_admin_uid := public._admin_require();

  UPDATE public.scheduled_events SET active = false WHERE id = p_id;

  INSERT INTO public.admin_audit_log
    (admin_user_id, action, meta)
  VALUES (v_admin_uid, 'event_delete', jsonb_build_object('id', p_id));

  RETURN json_build_object('success', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_add / remove admin (superadmin only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_add_admin(
  p_target_user_id uuid,
  p_role text DEFAULT 'admin',
  p_notes text DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
BEGIN
  v_admin_uid := auth.uid();
  IF NOT public.is_superadmin(v_admin_uid) THEN
    RAISE EXCEPTION 'Forbidden: superadmin only' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('admin', 'superadmin') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid role');
  END IF;

  INSERT INTO public.admin_users (user_id, role, created_by, notes)
  VALUES (p_target_user_id, p_role, v_admin_uid, p_notes)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role, notes = COALESCE(EXCLUDED.notes, public.admin_users.notes);

  INSERT INTO public.admin_audit_log
    (admin_user_id, action, target_user_id, meta)
  VALUES (v_admin_uid, 'admin_add', p_target_user_id,
          jsonb_build_object('role', p_role, 'notes', p_notes));

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_admin(p_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
BEGIN
  v_admin_uid := auth.uid();
  IF NOT public.is_superadmin(v_admin_uid) THEN
    RAISE EXCEPTION 'Forbidden: superadmin only' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.admin_users WHERE user_id = p_target_user_id;
  INSERT INTO public.admin_audit_log
    (admin_user_id, action, target_user_id)
  VALUES (v_admin_uid, 'admin_remove', p_target_user_id);

  RETURN json_build_object('success', true);
END;
$$;

-- -----------------------------------------------------------------------------
-- admin_list_admins — returns all admin rows joined with auth.users email and
-- profiles.display_name so the admin management page can show identifiers,
-- not bare UUIDs.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_admin_uid uuid;
  v_rows json;
BEGIN
  v_admin_uid := public._admin_require();
  SELECT json_agg(row_to_json(r) ORDER BY r.created_at) INTO v_rows FROM (
    SELECT au.user_id, au.role, au.notes, au.created_at, u.email, p.display_name
    FROM public.admin_users au
    LEFT JOIN auth.users u ON u.id = au.user_id
    LEFT JOIN public.profiles p ON p.id = au.user_id
  ) r;
  RETURN json_build_object('success', true, 'rows', COALESCE(v_rows, '[]'::json));
END;
$$;

-- =============================================================================
-- Grants
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_economy_config(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_economy_overrides()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_currency(uuid, numeric, integer, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_player(uuid, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_players(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_player_detail(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_economy_health()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_log(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_toggle_feature_flag(text, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_event(text, text, numeric, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_event(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_admin(uuid, text, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_admin(uuid)                 TO authenticated;
