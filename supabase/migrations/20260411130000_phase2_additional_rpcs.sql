-- =============================================================================
-- Phase 2a: Add remaining server-authoritative RPCs for the flows that still
-- do direct UPDATE/INSERT from the client: upgrade purchase, robot collection,
-- and achievement claim. Also patches harvest_plant_transaction to record
-- plant discoveries and award level-milestone gem bonuses server-side.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- purchase_upgrade_atomic: server reads cost from level_upgrades, deducts
-- from player_gardens, inserts/reactivates player_upgrades row atomically.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purchase_upgrade_atomic(
  p_user_id uuid,
  p_upgrade_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_upgrade public.level_upgrades%ROWTYPE;
  v_existing_id uuid;
  v_existing_active boolean;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR v_auth_uid <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_garden FROM public.player_gardens
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Garden not found');
  END IF;

  SELECT * INTO v_upgrade FROM public.level_upgrades WHERE id = p_upgrade_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Upgrade not found');
  END IF;

  IF COALESCE(v_garden.level, 1) < COALESCE(v_upgrade.level_required, 1) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient level');
  END IF;

  IF COALESCE(v_garden.coins, 0) < COALESCE(v_upgrade.cost_coins, 0) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient coins');
  END IF;
  IF COALESCE(v_garden.gems, 0) < COALESCE(v_upgrade.cost_gems, 0) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient gems');
  END IF;

  SELECT id, active INTO v_existing_id, v_existing_active
  FROM public.player_upgrades
  WHERE user_id = p_user_id AND upgrade_id = p_upgrade_id
  FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    IF v_existing_active THEN
      RETURN json_build_object('success', false, 'error', 'Upgrade already owned');
    END IF;
    UPDATE public.player_upgrades
    SET active = true, purchased_at = now()
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.player_upgrades (user_id, upgrade_id, active)
    VALUES (p_user_id, p_upgrade_id, true);
  END IF;

  UPDATE public.player_gardens
  SET coins = coins - COALESCE(v_upgrade.cost_coins, 0),
      gems  = GREATEST(0, COALESCE(gems, 0) - COALESCE(v_upgrade.cost_gems, 0)),
      last_played = now()
  WHERE user_id = p_user_id;

  IF COALESCE(v_upgrade.cost_coins, 0) > 0 THEN
    INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, -v_upgrade.cost_coins, 'upgrade',
            'Upgrade: ' || COALESCE(v_upgrade.display_name, v_upgrade.name, ''));
  END IF;

  RETURN json_build_object(
    'success', true,
    'upgrade_id', p_upgrade_id,
    'effect_type', v_upgrade.effect_type,
    'cost_coins', COALESCE(v_upgrade.cost_coins, 0),
    'cost_gems', COALESCE(v_upgrade.cost_gems, 0),
    'new_coin_balance', COALESCE(v_garden.coins, 0) - COALESCE(v_upgrade.cost_coins, 0),
    'new_gem_balance',  GREATEST(0, COALESCE(v_garden.gems, 0) - COALESCE(v_upgrade.cost_gems, 0))
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- collect_robot_income_atomic: server computes accumulated income using
-- stored state + elapsed time + upgrade-driven formula. Handles first
-- activation (robot_last_collected IS NULL) and offline accumulation.
-- Replaces the three direct UPDATE paths in usePassiveIncomeRobot.ts.
--
-- Constants (keep in sync with src/constants.ts):
--   ROBOT_BASE_INCOME            = 25
--   ROBOT_LEVEL_EXPONENT         = 1.25
--   ROBOT_MAX_PERMANENT_MULTIPLIER = 10   (soft cap)
--   ROBOT_MAX_ACCUMULATION_HOURS = 6
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
  v_effective_mult numeric;
  v_soft_cap numeric := 10;
  v_excess numeric;
  v_coins_per_minute bigint;
  v_max_minutes integer := 6 * 60;
  v_elapsed_minutes integer;
  v_fresh_income bigint;
  v_max_accumulation bigint;
  v_total bigint;
  v_exp_reward integer;
  v_new_exp integer;
  v_new_level integer;
  v_new_coins bigint;
  v_now timestamp with time zone := now();
  v_upg record;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR v_auth_uid <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_garden FROM public.player_gardens
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Garden not found');
  END IF;

  -- Compute robot level + harvest multiplier from active upgrades.
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

  -- First activation: stamp the timestamp and exit without granting anything.
  IF v_garden.robot_last_collected IS NULL THEN
    UPDATE public.player_gardens
    SET robot_last_collected = v_now,
        robot_accumulated_coins = 0,
        robot_level = v_robot_level,
        last_played = v_now
    WHERE user_id = p_user_id;
    RETURN json_build_object(
      'success', true,
      'first_activation', true,
      'collected', 0,
      'exp_reward', 0,
      'robot_level', v_robot_level
    );
  END IF;

  v_plant_level := GREATEST(1, LEAST(v_robot_level, 10));
  v_level_multiplier := POWER(v_plant_level::numeric, 1.25);

  v_permanent_mult := GREATEST(1, COALESCE(v_garden.permanent_multiplier, 1));
  IF v_permanent_mult > v_soft_cap THEN
    v_excess := v_permanent_mult - v_soft_cap;
    v_effective_mult := v_soft_cap + (v_excess * 0.5);
  ELSE
    v_effective_mult := v_permanent_mult;
  END IF;

  v_coins_per_minute := LEAST(
    2000000000::bigint,
    GREATEST(0::bigint,
      FLOOR(25 * v_level_multiplier * v_harvest_mult * v_effective_mult)::bigint
    )
  );

  v_elapsed_minutes := GREATEST(0, LEAST(
    v_max_minutes,
    FLOOR(EXTRACT(EPOCH FROM (v_now - v_garden.robot_last_collected)) / 60.0)::integer
  ));
  v_fresh_income := v_coins_per_minute * v_elapsed_minutes;
  v_max_accumulation := v_coins_per_minute * v_max_minutes;
  v_total := LEAST(
    v_max_accumulation,
    COALESCE(v_garden.robot_accumulated_coins, 0) + v_fresh_income
  );

  IF v_total <= 0 THEN
    UPDATE public.player_gardens
    SET robot_last_collected = v_now,
        robot_level = v_robot_level,
        last_played = v_now
    WHERE user_id = p_user_id;
    RETURN json_build_object(
      'success', true,
      'collected', 0,
      'exp_reward', 0,
      'robot_level', v_robot_level,
      'coins_per_minute', v_coins_per_minute
    );
  END IF;

  v_exp_reward := GREATEST(1, FLOOR(v_total / 100.0)::integer + v_robot_level * 2);
  v_new_exp := GREATEST(0, COALESCE(v_garden.experience, 0) + v_exp_reward);
  v_new_level := GREATEST(1, FLOOR(SQRT(v_new_exp / 100.0)) + 1)::integer;
  v_new_coins := LEAST(2000000000::bigint,
                        GREATEST(0::bigint, COALESCE(v_garden.coins, 0) + v_total));

  UPDATE public.player_gardens
  SET coins = v_new_coins,
      experience = v_new_exp,
      level = v_new_level,
      robot_accumulated_coins = 0,
      robot_last_collected = v_now,
      robot_level = v_robot_level,
      last_played = v_now
  WHERE user_id = p_user_id;

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, v_total, 'robot_collection',
          'Robot income (lvl ' || v_robot_level || ') +' || v_exp_reward || ' XP');

  RETURN json_build_object(
    'success', true,
    'collected', v_total,
    'exp_reward', v_exp_reward,
    'new_coins', v_new_coins,
    'new_experience', v_new_exp,
    'new_level', v_new_level,
    'robot_level', v_robot_level,
    'coins_per_minute', v_coins_per_minute
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- claim_achievement_atomic: hardcoded achievement table (matching the
-- baseAchievements list in useAchievements.ts). Server validates garden
-- state meets target, upserts player_achievements row, grants reward once.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_achievement_atomic(
  p_user_id uuid,
  p_achievement_name text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_category text;
  v_target integer;
  v_reward_coins integer;
  v_reward_gems integer;
  v_progress integer;
  v_already_completed boolean;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR v_auth_uid <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  CASE p_achievement_name
    WHEN 'Premier Pas' THEN
      v_category := 'planting'; v_target := 1;
      v_reward_coins := 50; v_reward_gems := 1;
    WHEN 'Jardinier Débutant' THEN
      v_category := 'harvest'; v_target := 10;
      v_reward_coins := 200; v_reward_gems := 2;
    WHEN 'Maître du Jardin' THEN
      v_category := 'harvest'; v_target := 100;
      v_reward_coins := 1000; v_reward_gems := 5;
    WHEN 'Collectionneur de Pièces' THEN
      v_category := 'wealth'; v_target := 10000;
      v_reward_coins := 500; v_reward_gems := 3;
    WHEN 'Millionaire' THEN
      v_category := 'wealth'; v_target := 100000;
      v_reward_coins := 5000; v_reward_gems := 10;
    WHEN 'Premier Prestige' THEN
      v_category := 'prestige'; v_target := 1;
      v_reward_coins := 1000; v_reward_gems := 15;
    WHEN 'Maître du Prestige' THEN
      v_category := 'prestige'; v_target := 3;
      v_reward_coins := 10000; v_reward_gems := 50;
    ELSE
      RETURN json_build_object('success', false, 'error', 'Unknown achievement');
  END CASE;

  SELECT * INTO v_garden FROM public.player_gardens
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Garden not found');
  END IF;

  v_progress := CASE v_category
    WHEN 'harvest'  THEN COALESCE(v_garden.total_harvests, 0)
    WHEN 'wealth'   THEN LEAST(COALESCE(v_garden.coins, 0), 2147483647)::integer
    WHEN 'prestige' THEN COALESCE(v_garden.prestige_level, 0)
    WHEN 'planting' THEN CASE WHEN COALESCE(v_garden.total_harvests, 0) > 0 THEN 1 ELSE 0 END
    ELSE 0
  END;

  -- Look up / lock existing row.
  SELECT completed INTO v_already_completed
  FROM public.player_achievements
  WHERE user_id = p_user_id AND achievement_name = p_achievement_name
  FOR UPDATE;

  IF v_already_completed IS TRUE THEN
    RETURN json_build_object(
      'success', true,
      'already_completed', true,
      'progress', v_progress,
      'target', v_target
    );
  END IF;

  IF v_progress < v_target THEN
    -- Update progress only, no reward.
    INSERT INTO public.player_achievements
      (user_id, achievement_name, achievement_category, progress, target, completed)
    VALUES
      (p_user_id, p_achievement_name, v_category, v_progress, v_target, false)
    ON CONFLICT (user_id, achievement_name) DO UPDATE
      SET progress = EXCLUDED.progress,
          updated_at = now();
    RETURN json_build_object(
      'success', true,
      'completed', false,
      'progress', v_progress,
      'target', v_target
    );
  END IF;

  -- Target reached: upsert as completed and grant reward.
  INSERT INTO public.player_achievements
    (user_id, achievement_name, achievement_category, progress, target, completed, completed_at)
  VALUES
    (p_user_id, p_achievement_name, v_category, v_progress, v_target, true, now())
  ON CONFLICT (user_id, achievement_name) DO UPDATE
    SET progress = EXCLUDED.progress,
        completed = true,
        completed_at = now(),
        updated_at = now();

  UPDATE public.player_gardens
  SET coins = LEAST(2000000000::bigint,
                    GREATEST(0::bigint, COALESCE(coins, 0) + v_reward_coins)),
      gems  = GREATEST(0, COALESCE(gems, 0) + v_reward_gems),
      last_played = now()
  WHERE user_id = p_user_id;

  IF v_reward_coins > 0 THEN
    INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
    VALUES (p_user_id, v_reward_coins, 'achievement',
            'Achievement: ' || p_achievement_name);
  END IF;

  RETURN json_build_object(
    'success', true,
    'completed', true,
    'progress', v_progress,
    'target', v_target,
    'reward_coins', v_reward_coins,
    'reward_gems', v_reward_gems
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- Patch harvest_plant_transaction: add plant_discoveries insert and
-- level-milestone gem bonus (1 gem per level-5 boundary crossed). Replaces
-- the client-side inserts in usePlantActions.ts and useGemSources.ts.
-- -----------------------------------------------------------------------------
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
  v_plot public.garden_plots%ROWTYPE;
  v_plant public.plant_types%ROWTYPE;

  v_harvest_mult numeric := 1;
  v_growth_mult numeric := 1;
  v_exp_mult numeric := 1;
  v_plant_cost_red numeric := 1;
  v_gem_chance_upgr numeric := 0;

  v_coin_boost numeric := 1;
  v_gem_boost numeric := 1;
  v_growth_boost numeric := 1;

  v_plant_level integer;
  v_player_level integer;
  v_permanent_mult numeric;
  v_base_cost numeric;
  v_base_profit numeric;
  v_time_bonus numeric;
  v_level_bonus numeric;
  v_harvest_reward bigint;
  v_exp_reward integer;

  v_adjusted_growth_seconds integer;
  v_elapsed_seconds bigint;
  v_remaining integer;

  v_new_coins bigint;
  v_new_gems integer;
  v_new_exp integer;
  v_new_level integer;
  v_new_harvests integer;
  v_level_gem_bonus integer := 0;

  v_final_gem_chance numeric;
  v_gem_reward integer := 0;

  v_upg record;
  v_fx record;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR v_auth_uid <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
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
  v_permanent_mult := GREATEST(1, COALESCE(v_garden.permanent_multiplier, 1));

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
    ELSIF v_fx.effect_type = 'growth_boost' AND v_fx.val > 0 THEN
      v_growth_boost := v_fx.val;
    END IF;
  END LOOP;

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

  v_base_cost   := FLOOR(100 * POWER(1.35::numeric, v_plant_level - 1) * v_plant_cost_red);
  v_base_profit := v_base_cost * 1.85;
  v_time_bonus  := GREATEST(1, FLOOR(
    COALESCE(v_plot.growth_time_seconds, v_plant.base_growth_seconds, 60) / 600.0
  )) * 0.1;
  v_level_bonus := 1 + v_player_level * 0.02;

  v_harvest_reward := LEAST(
    2000000000::bigint,
    GREATEST(0::bigint, FLOOR(
      v_base_profit * (1 + v_time_bonus) * v_level_bonus
      * v_harvest_mult * v_permanent_mult * v_coin_boost
    )::bigint)
  );
  v_exp_reward := GREATEST(0, FLOOR((15 + v_plant_level * 5) * v_exp_mult)::integer);

  v_final_gem_chance := LEAST(1.0, GREATEST(0::numeric, v_gem_chance_upgr * v_gem_boost));
  IF v_final_gem_chance > 0 AND random() < v_final_gem_chance THEN
    v_gem_reward := 1;
  END IF;

  v_new_coins    := LEAST(2000000000::bigint, GREATEST(0::bigint, COALESCE(v_garden.coins, 0) + v_harvest_reward));
  v_new_exp      := GREATEST(0, COALESCE(v_garden.experience, 0) + v_exp_reward);
  v_new_level    := GREATEST(1, FLOOR(SQRT(v_new_exp / 100.0)) + 1)::integer;
  v_new_harvests := COALESCE(v_garden.total_harvests, 0) + 1;

  -- Level-milestone gem bonus: 1 gem every level-5 boundary crossed.
  v_level_gem_bonus := GREATEST(0,
    (v_new_level / 5) - (GREATEST(1, COALESCE(v_garden.level, 1)) / 5)
  );
  v_new_gems := GREATEST(0,
    COALESCE(v_garden.gems, 0) + v_gem_reward + v_level_gem_bonus
  );

  UPDATE public.player_gardens
  SET coins = v_new_coins,
      gems = v_new_gems,
      experience = v_new_exp,
      level = v_new_level,
      total_harvests = v_new_harvests,
      last_played = now()
  WHERE user_id = p_user_id;

  UPDATE public.garden_plots
  SET plant_type = NULL,
      planted_at = NULL,
      growth_time_seconds = NULL,
      updated_at = now()
  WHERE user_id = p_user_id AND plot_number = p_plot_number;

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, v_harvest_reward, 'harvest',
          'Harvest: ' || COALESCE(v_plant.display_name, v_plant.name, 'plant'));

  -- Record discovery (idempotent per user+plant via app logic — no unique key, so use NOT EXISTS).
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
    'old_level', COALESCE(v_garden.level, 1),
    'unified_calculation', true
  );
END;
$function$;

-- Grants: authenticated users need EXECUTE on the new RPCs.
GRANT EXECUTE ON FUNCTION public.purchase_upgrade_atomic(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collect_robot_income_atomic(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_achievement_atomic(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.harvest_plant_transaction(uuid, integer) TO authenticated;
