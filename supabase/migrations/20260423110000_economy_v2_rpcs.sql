-- =============================================================================
-- Economy v2.0 — Server-Authoritative RPCs
--
-- Rewrites: harvest_plant_transaction, plant_direct_atomic, execute_prestige,
--           collect_robot_income_atomic, unlock_plot_atomic.
-- Adds:     purchase_essence_upgrade, claim_daily_reward,
--           get_economy_snapshot.
--
-- Design invariants:
--   1. Client passes identifiers only; all costs/rewards are computed here.
--   2. All coin math uses NUMERIC (coin hard cap 1e18).
--   3. Every mutating RPC writes an economy_events row (telemetry).
--   4. Essence upgrades compound into harvest/robot/growth here (not in DB
--      triggers) — keeps the effect graph visible in one place.
--
-- Constants mirrored from src/economy/config.ts:
--   COIN_HARD_CAP                 = 1e18
--   GEM_HARD_CAP                  = 1_000_000
--   PLANT_COST_BASE / GROWTH      = 50 / 1.55
--   ROBOT_BASE_INCOME / EXPONENT  = 40 / 1.35
--   ROBOT_BASE_OFFLINE_HOURS      = 8    (per-level offline_cap essence +1h)
--   XP_DIVISOR                    = 80
--   ESSENCE_COEF / DENOM          = 10 / 1e6
--   GEM_DROP_BASE_CHANCE          = 0.03
--   LEVEL_MILESTONE_GEMS          = [{5,1},{25,5},{100,25}]
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal helpers
-- -----------------------------------------------------------------------------

-- Computes total essence-upgrade effects for a user. Returns a composite record
-- the mutating RPCs can destructure. Stable across a single transaction.
CREATE OR REPLACE FUNCTION public._essence_effects(p_user_id uuid)
RETURNS TABLE (
  harvest_bonus numeric,      -- additive, e.g. 0.40 => +40% to harvest
  robot_bonus numeric,        -- additive
  growth_bonus numeric,       -- additive (speed)
  gem_chance_bonus numeric,   -- additive to drop chance
  offline_extra_hours integer,
  start_coins_bonus numeric,
  start_plots_bonus integer,
  essence_earn_bonus numeric  -- additive, e.g. 0.25 => x1.25 essence
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row record;
BEGIN
  harvest_bonus       := 0;
  robot_bonus         := 0;
  growth_bonus        := 0;
  gem_chance_bonus    := 0;
  offline_extra_hours := 0;
  start_coins_bonus   := 0;
  start_plots_bonus   := 0;
  essence_earn_bonus  := 0;

  FOR v_row IN
    SELECT eu.id, eu.effect_per_level, peu.level
    FROM public.player_essence_upgrades peu
    JOIN public.essence_upgrades eu ON eu.id = peu.upgrade_id
    WHERE peu.user_id = p_user_id AND peu.level > 0
  LOOP
    IF v_row.id = 'harvest_boost' THEN
      harvest_bonus := harvest_bonus + v_row.effect_per_level * v_row.level;
    ELSIF v_row.id = 'robot_boost' THEN
      robot_bonus := robot_bonus + v_row.effect_per_level * v_row.level;
    ELSIF v_row.id = 'growth_speed' THEN
      growth_bonus := growth_bonus + v_row.effect_per_level * v_row.level;
    ELSIF v_row.id = 'gem_chance' THEN
      gem_chance_bonus := gem_chance_bonus + v_row.effect_per_level * v_row.level;
    ELSIF v_row.id = 'offline_cap' THEN
      offline_extra_hours := offline_extra_hours + FLOOR(v_row.effect_per_level * v_row.level)::integer;
    ELSIF v_row.id = 'start_coins' THEN
      start_coins_bonus := start_coins_bonus + v_row.effect_per_level * v_row.level;
    ELSIF v_row.id = 'start_plots' THEN
      start_plots_bonus := start_plots_bonus + FLOOR(v_row.effect_per_level * v_row.level)::integer;
    ELSIF v_row.id = 'essence_boost' THEN
      essence_earn_bonus := essence_earn_bonus + v_row.effect_per_level * v_row.level;
    END IF;
  END LOOP;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public._essence_effects(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- helper: rules-based level-milestone gem bonus (1 per 5, +5 per 25, +25 per 100)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._level_milestone_gems(p_old integer, p_new integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_old integer := GREATEST(0, p_old);
  v_new integer := GREATEST(0, p_new);
  v_total integer := 0;
BEGIN
  v_total := v_total + (FLOOR(v_new / 5)   - FLOOR(v_old / 5))   * 1;
  v_total := v_total + (FLOOR(v_new / 25)  - FLOOR(v_old / 25))  * 5;
  v_total := v_total + (FLOOR(v_new / 100) - FLOOR(v_old / 100)) * 25;
  RETURN GREATEST(0, v_total);
END;
$$;

-- =============================================================================
-- harvest_plant_transaction  (v2)
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

  -- Upgrade-driven multipliers
  v_harvest_mult numeric := 1;
  v_growth_mult numeric := 1;
  v_exp_mult numeric := 1;
  v_plant_cost_red numeric := 1;
  v_gem_chance_upgr numeric := 0;

  -- Temporary boosts
  v_coin_boost numeric := 1;
  v_gem_boost numeric := 1;
  v_growth_boost numeric := 1;

  -- Essence effects
  v_ess record;

  v_plant_level integer;
  v_player_level integer;
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
  v_old_level integer;
  v_new_harvests integer;
  v_level_gem_bonus integer := 0;

  v_final_gem_chance numeric;
  v_gem_reward integer := 0;

  v_upg record;
  v_fx record;
  v_coin_cap constant numeric := 1000000000000000000; -- 1e18
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
  v_old_level      := v_player_level;
  v_permanent_mult := GREATEST(1, COALESCE(v_garden.permanent_multiplier, 1));

  -- Essence effects (permanent, across prestiges)
  SELECT * INTO v_ess FROM public._essence_effects(p_user_id);

  -- Active upgrade multipliers
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

  -- Temporary boosts (max per type)
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

  -- Apply essence bonuses (additive buckets)
  v_harvest_mult := v_harvest_mult * (1 + v_ess.harvest_bonus);
  v_growth_mult  := v_growth_mult  * (1 + v_ess.growth_bonus);

  -- Growth readiness
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

  -- -- HARVEST FORMULA v2 -------------------------------------------------------
  -- base_cost   = PLANT_COST_BASE * PLANT_COST_GROWTH ^ (level - 1) * cost_red
  -- margin      = tiered (2.2 / 2.5 / 2.9 / 3.5)
  -- time_bonus  = floor(growth / 600) * 0.1
  -- level_bonus = 1 + player_level * 0.015
  -- reward      = base_cost * margin * (1 + time_bonus) * level_bonus
  --               * harvest_mult * permanent_mult * coin_boost
  -- --------------------------------------------------------------------------
  v_base_cost := 50 * POWER(1.55::numeric, v_plant_level - 1) * v_plant_cost_red;
  v_profit_margin := CASE
    WHEN v_plant_level <= 3  THEN 2.2
    WHEN v_plant_level <= 6  THEN 2.5
    WHEN v_plant_level <= 9  THEN 2.9
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
  v_exp_reward := GREATEST(0, FLOOR((15 + v_plant_level * 5) * v_exp_mult)::integer);

  -- Gem drop: 3% base + upgrades + essence, scaled by gem_boost, capped at 90%.
  v_final_gem_chance := LEAST(
    0.9,
    GREATEST(0::numeric, (0.03 + v_gem_chance_upgr + v_ess.gem_chance_bonus) * v_gem_boost)
  );
  IF v_final_gem_chance > 0 AND random() < v_final_gem_chance THEN
    v_gem_reward := 1;
  END IF;

  -- Totals
  v_new_coins := LEAST(v_coin_cap, GREATEST(0::numeric, COALESCE(v_garden.coins, 0) + v_harvest_reward));
  v_new_exp   := GREATEST(0, COALESCE(v_garden.experience, 0) + v_exp_reward);
  v_new_level := GREATEST(1, FLOOR(SQRT(v_new_exp / 80.0)) + 1)::integer;
  v_new_harvests := COALESCE(v_garden.total_harvests, 0) + 1;

  v_level_gem_bonus := public._level_milestone_gems(v_old_level, v_new_level);
  v_new_gems := LEAST(1000000,
    GREATEST(0, COALESCE(v_garden.gems, 0) + v_gem_reward + v_level_gem_bonus)
  );

  -- Commit
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
  SET plant_type = NULL,
      planted_at = NULL,
      growth_time_seconds = NULL,
      updated_at = now()
  WHERE user_id = p_user_id AND plot_number = p_plot_number;

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id,
          LEAST(v_harvest_reward, 2147483647)::integer,
          'harvest',
          'Harvest: ' || COALESCE(v_plant.display_name, v_plant.name, 'plant'));

  INSERT INTO public.economy_events (user_id, event_type, coins_delta, gems_delta, meta)
  VALUES (p_user_id, 'harvest', v_harvest_reward,
          v_gem_reward + v_level_gem_bonus,
          jsonb_build_object(
            'plant', v_plant.name,
            'plant_level', v_plant_level,
            'player_level_before', v_old_level,
            'player_level_after', v_new_level,
            'harvest_mult', v_harvest_mult,
            'permanent_mult', v_permanent_mult,
            'coin_boost', v_coin_boost,
            'essence_harvest_bonus', v_ess.harvest_bonus
          ));

  -- Discovery (idempotent)
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

-- =============================================================================
-- plant_direct_atomic  (v2)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.plant_direct_atomic(
  p_user_id uuid,
  p_plot_number integer,
  p_plant_type_id uuid
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_plot public.garden_plots%ROWTYPE;
  v_plant public.plant_types%ROWTYPE;
  v_plant_cost_red numeric := 1;
  v_base_cost numeric;
  v_growth_seconds integer;
  v_now timestamptz := now();
  v_upg record;
  v_coin_cap constant numeric := 1000000000000000000;
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

  SELECT * INTO v_plant FROM public.plant_types WHERE id = p_plant_type_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Plant type not found');
  END IF;

  IF NOT v_plot.unlocked THEN
    RETURN json_build_object('success', false, 'error', 'Plot not unlocked');
  END IF;
  IF v_plot.plant_type IS NOT NULL OR v_plot.planted_at IS NOT NULL THEN
    RETURN json_build_object('success', false, 'error', 'Plot already occupied');
  END IF;
  IF COALESCE(v_garden.level, 1) < COALESCE(v_plant.level_required, 1) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient level');
  END IF;

  FOR v_upg IN
    SELECT lu.effect_value
    FROM public.player_upgrades pu
    JOIN public.level_upgrades lu ON lu.id = pu.upgrade_id
    WHERE pu.user_id = p_user_id AND pu.active = true
      AND lu.effect_type = 'plant_cost_reduction'
      AND lu.effect_value > 0
  LOOP
    v_plant_cost_red := v_plant_cost_red * v_upg.effect_value;
  END LOOP;

  -- New cost curve: 50 * 1.55 ^ (level-1)
  v_base_cost := GREATEST(0::numeric, FLOOR(
    50 * POWER(1.55::numeric, GREATEST(1, COALESCE(v_plant.level_required, 1)) - 1) * v_plant_cost_red
  ));

  IF COALESCE(v_garden.coins, 0) < v_base_cost THEN
    RETURN json_build_object(
      'success', false, 'error', 'Insufficient coins',
      'required', v_base_cost, 'have', COALESCE(v_garden.coins, 0)
    );
  END IF;

  v_growth_seconds := COALESCE(v_plant.base_growth_seconds, 60);

  UPDATE public.player_gardens
  SET coins = LEAST(v_coin_cap, GREATEST(0::numeric, coins - v_base_cost)),
      economy_version = 2,
      last_played = v_now
  WHERE user_id = p_user_id;

  UPDATE public.garden_plots
  SET plant_type = p_plant_type_id,
      planted_at = v_now,
      growth_time_seconds = v_growth_seconds,
      updated_at = v_now
  WHERE user_id = p_user_id AND plot_number = p_plot_number;

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, -LEAST(v_base_cost, 2147483647)::integer, 'plant',
          'Planting: ' || COALESCE(v_plant.display_name, v_plant.name, 'plant'));

  INSERT INTO public.economy_events (user_id, event_type, coins_delta, meta)
  VALUES (p_user_id, 'plant', -v_base_cost,
          jsonb_build_object('plant', v_plant.name, 'plot', p_plot_number));

  RETURN json_build_object(
    'success', true,
    'planted_at', v_now,
    'growth_time_seconds', v_growth_seconds,
    'new_coin_balance', COALESCE(v_garden.coins, 0) - v_base_cost,
    'cost', v_base_cost,
    'plant_name', v_plant.display_name,
    'economy_version', 2
  );
END;
$$;

-- =============================================================================
-- collect_robot_income_atomic  (v2)
-- =============================================================================
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
  v_coin_cap constant numeric := 1000000000000000000;
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

  -- Upgrades
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

  -- First activation
  IF v_garden.robot_last_collected IS NULL THEN
    UPDATE public.player_gardens
    SET robot_last_collected = v_now,
        robot_accumulated_coins = 0,
        robot_level = v_robot_level,
        economy_version = 2,
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
  v_level_multiplier := POWER(v_plant_level::numeric, 1.35); -- was 1.25

  -- No more soft cap — full permanent multiplier applies.
  v_permanent_mult := GREATEST(1, COALESCE(v_garden.permanent_multiplier, 1));

  -- Apply robot essence bonus (additive bucket).
  v_harvest_mult := v_harvest_mult * (1 + v_ess.robot_bonus);

  -- Base income = 40 (was 25)
  v_coins_per_minute := LEAST(
    v_coin_cap,
    GREATEST(0::numeric,
      FLOOR(40 * v_level_multiplier * v_harvest_mult * v_permanent_mult)
    )
  );

  -- Offline cap = 8h + essence hours, capped at 24h.
  v_offline_hours := LEAST(24, 8 + COALESCE(v_ess.offline_extra_hours, 0));
  v_max_minutes := v_offline_hours * 60;

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
        economy_version = 2,
        last_played = v_now
    WHERE user_id = p_user_id;
    RETURN json_build_object(
      'success', true,
      'collected', 0,
      'exp_reward', 0,
      'robot_level', v_robot_level,
      'coins_per_minute', v_coins_per_minute,
      'offline_cap_hours', v_offline_hours
    );
  END IF;

  v_old_level := GREATEST(1, COALESCE(v_garden.level, 1));

  -- XP: nerfed 5x vs v1 (was total/100, now total/500) to favor active play
  v_exp_reward := GREATEST(1, FLOOR(v_total / 500.0)::integer + v_robot_level);
  v_new_exp := GREATEST(0, COALESCE(v_garden.experience, 0) + v_exp_reward);
  v_new_level := GREATEST(1, FLOOR(SQRT(v_new_exp / 80.0)) + 1)::integer;
  v_new_coins := LEAST(v_coin_cap,
                        GREATEST(0::numeric, COALESCE(v_garden.coins, 0) + v_total));

  v_level_gem_bonus := public._level_milestone_gems(v_old_level, v_new_level);
  v_new_gems := LEAST(1000000,
    GREATEST(0, COALESCE(v_garden.gems, 0) + v_level_gem_bonus)
  );

  UPDATE public.player_gardens
  SET coins = v_new_coins,
      gems = v_new_gems,
      experience = v_new_exp,
      level = v_new_level,
      robot_accumulated_coins = 0,
      robot_last_collected = v_now,
      robot_level = v_robot_level,
      total_coins_earned = LEAST(v_coin_cap,
        GREATEST(0::numeric, COALESCE(total_coins_earned, 0) + v_total)),
      coins_earned_this_run = LEAST(v_coin_cap,
        GREATEST(0::numeric, COALESCE(coins_earned_this_run, 0) + v_total)),
      economy_version = 2,
      last_played = v_now
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
            'offline_cap_hours', v_offline_hours
          ));

  RETURN json_build_object(
    'success', true,
    'collected', v_total,
    'exp_reward', v_exp_reward,
    'new_coins', v_new_coins,
    'new_experience', v_new_exp,
    'new_level', v_new_level,
    'level_gem_bonus', v_level_gem_bonus,
    'robot_level', v_robot_level,
    'coins_per_minute', v_coins_per_minute,
    'offline_cap_hours', v_offline_hours,
    'economy_version', 2
  );
END;
$$;

-- =============================================================================
-- execute_prestige  (v2) — infinite scaling + essence
-- =============================================================================
DROP FUNCTION IF EXISTS public.execute_prestige(uuid);
CREATE OR REPLACE FUNCTION public.execute_prestige(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_ess record;
  v_next_prestige integer;
  v_cost_coins numeric;
  v_cost_gems integer;
  v_next_mult numeric;
  v_coins_this_run numeric;
  v_essence_earned numeric;
  v_starting_coins numeric;
  v_plots_to_keep integer;
  v_coin_cap constant numeric := 1000000000000000000;
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

  SELECT * INTO v_ess FROM public._essence_effects(p_user_id);

  v_next_prestige := COALESCE(v_garden.prestige_level, 0) + 1;

  -- Cost curve: 150k * 2.2 ^ (p-1); gem cost 10 + (p-1)*5
  v_cost_coins := FLOOR(150000 * POWER(2.2::numeric, v_next_prestige - 1));
  v_cost_gems  := 10 + (v_next_prestige - 1) * 5;

  -- Permanent multiplier: 1 + 0.5p + 0.03p^2
  v_next_mult := 1 + 0.5 * v_next_prestige + 0.03 * POWER(v_next_prestige, 2);

  IF COALESCE(v_garden.coins, 0) < v_cost_coins
     OR COALESCE(v_garden.gems, 0) < v_cost_gems THEN
    RETURN json_build_object(
      'success', false, 'error', 'Fonds insuffisants',
      'required_coins', v_cost_coins,
      'required_gems', v_cost_gems
    );
  END IF;

  -- Essence award: floor(10 * sqrt(coins_this_run / 1e6)) * (1 + essence_bonus)
  v_coins_this_run := GREATEST(0::numeric, COALESCE(v_garden.coins_earned_this_run, 0));
  IF v_coins_this_run > 0 THEN
    v_essence_earned := FLOOR(
      10 * SQRT(v_coins_this_run / 1000000.0) * (1 + COALESCE(v_ess.essence_earn_bonus, 0))
    );
  ELSE
    v_essence_earned := 0;
  END IF;

  -- Starting coins after prestige: 100 + start_coins essence bonus
  v_starting_coins := 100 + COALESCE(v_ess.start_coins_bonus, 0);

  -- Plots kept: 4 base + start_plots essence bonus (uncapped; game has MAX_PLOTS)
  v_plots_to_keep := 4 + COALESCE(v_ess.start_plots_bonus, 0);

  UPDATE public.player_gardens
  SET coins = LEAST(v_coin_cap, GREATEST(0::numeric, v_starting_coins)),
      gems = GREATEST(0, LEAST(1000000, COALESCE(gems, 0) - v_cost_gems)),
      essence = LEAST(1000000000000::numeric,
                      GREATEST(0::numeric, COALESCE(essence, 0) + v_essence_earned)),
      experience = 0,
      level = 1,
      prestige_level = v_next_prestige,
      highest_prestige = GREATEST(COALESCE(highest_prestige, 0), v_next_prestige),
      permanent_multiplier = v_next_mult,
      prestige_points = COALESCE(prestige_points, 0) + 1,
      coins_earned_this_run = 0,
      economy_version = 2,
      robot_accumulated_coins = 0,
      robot_last_collected = NULL,
      last_played = now()
  WHERE user_id = p_user_id;

  UPDATE public.player_upgrades
  SET active = false
  WHERE user_id = p_user_id;

  UPDATE public.garden_plots
  SET plant_type = NULL,
      planted_at = NULL,
      growth_time_seconds = NULL,
      unlocked = (plot_number <= v_plots_to_keep),
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.economy_events (user_id, event_type, coins_delta, gems_delta, essence_delta, meta)
  VALUES (p_user_id, 'prestige',
          -v_coins_this_run,
          -v_cost_gems,
          v_essence_earned,
          jsonb_build_object(
            'prestige_level', v_next_prestige,
            'permanent_multiplier', v_next_mult,
            'coins_this_run', v_coins_this_run,
            'plots_kept', v_plots_to_keep,
            'starting_coins', v_starting_coins
          ));

  RETURN json_build_object(
    'success', true,
    'prestige_level', v_next_prestige,
    'permanent_multiplier', v_next_mult,
    'essence_earned', v_essence_earned,
    'starting_coins', v_starting_coins,
    'plots_kept', v_plots_to_keep,
    'coins_this_run', v_coins_this_run,
    'economy_version', 2
  );
END;
$$;

-- =============================================================================
-- purchase_essence_upgrade  (new)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.purchase_essence_upgrade(
  p_user_id uuid,
  p_upgrade_id text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_def public.essence_upgrades%ROWTYPE;
  v_current_level integer := 0;
  v_cost numeric;
  v_new_level integer;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR v_auth_uid <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_def FROM public.essence_upgrades WHERE id = p_upgrade_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Upgrade not found');
  END IF;

  SELECT * INTO v_garden FROM public.player_gardens
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Garden not found');
  END IF;

  SELECT COALESCE(level, 0) INTO v_current_level
  FROM public.player_essence_upgrades
  WHERE user_id = p_user_id AND upgrade_id = p_upgrade_id
  FOR UPDATE;

  IF v_current_level >= v_def.max_level THEN
    RETURN json_build_object('success', false, 'error', 'Max level reached');
  END IF;

  v_cost := v_def.cost_base + v_current_level * v_def.cost_per_level;

  IF COALESCE(v_garden.essence, 0) < v_cost THEN
    RETURN json_build_object(
      'success', false, 'error', 'Insufficient essence',
      'required', v_cost, 'have', COALESCE(v_garden.essence, 0)
    );
  END IF;

  v_new_level := v_current_level + 1;

  INSERT INTO public.player_essence_upgrades (user_id, upgrade_id, level, updated_at)
  VALUES (p_user_id, p_upgrade_id, v_new_level, now())
  ON CONFLICT (user_id, upgrade_id) DO UPDATE
    SET level = v_new_level, updated_at = now();

  UPDATE public.player_gardens
  SET essence = GREATEST(0::numeric, COALESCE(essence, 0) - v_cost),
      economy_version = 2,
      last_played = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.economy_events (user_id, event_type, essence_delta, meta)
  VALUES (p_user_id, 'essence_spend', -v_cost,
          jsonb_build_object(
            'upgrade_id', p_upgrade_id,
            'new_level', v_new_level,
            'cost', v_cost
          ));

  RETURN json_build_object(
    'success', true,
    'upgrade_id', p_upgrade_id,
    'new_level', v_new_level,
    'cost', v_cost,
    'remaining_essence', COALESCE(v_garden.essence, 0) - v_cost
  );
END;
$$;

-- =============================================================================
-- claim_daily_reward  (new)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.claim_daily_reward(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_today date;
  v_yesterday date;
  v_streak integer;
  v_streak_day integer;
  v_reward_coins numeric := 0;
  v_reward_gems integer := 0;
  v_boost_type text;
  v_boost_value numeric;
  v_boost_minutes integer;
  v_coin_cap constant numeric := 1000000000000000000;
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

  v_today := (now() AT TIME ZONE 'UTC')::date;
  v_yesterday := v_today - INTERVAL '1 day';

  IF v_garden.last_daily_claim_date = v_today THEN
    RETURN json_build_object(
      'success', false, 'error', 'Already claimed today',
      'streak', COALESCE(v_garden.daily_streak, 0),
      'next_claim_date', v_today + INTERVAL '1 day'
    );
  END IF;

  -- Continue streak if last claim was yesterday; else reset to 1.
  IF v_garden.last_daily_claim_date = v_yesterday THEN
    v_streak := COALESCE(v_garden.daily_streak, 0) + 1;
  ELSE
    v_streak := 1;
  END IF;
  v_streak_day := ((v_streak - 1) % 7) + 1;  -- 1..7 cycle

  -- Reward table mirrors DAILY_REWARDS in src/economy/config.ts.
  CASE v_streak_day
    WHEN 1 THEN v_reward_coins := 500;
    WHEN 2 THEN v_reward_gems  := 1;
    WHEN 3 THEN v_reward_coins := 2500;  v_reward_gems := 1;
    WHEN 4 THEN v_boost_type := 'coin_boost'; v_boost_value := 2;  v_boost_minutes := 120;
    WHEN 5 THEN v_reward_gems  := 3;
    WHEN 6 THEN v_reward_coins := 10000; v_reward_gems := 2;
    WHEN 7 THEN v_reward_gems  := 5; v_boost_type := 'coin_boost'; v_boost_value := 3; v_boost_minutes := 240;
    ELSE NULL;
  END CASE;

  UPDATE public.player_gardens
  SET coins = LEAST(v_coin_cap, GREATEST(0::numeric, COALESCE(coins, 0) + v_reward_coins)),
      gems  = LEAST(1000000, GREATEST(0, COALESCE(gems, 0) + v_reward_gems)),
      daily_streak = v_streak,
      last_daily_claim_date = v_today,
      economy_version = 2,
      last_played = now()
  WHERE user_id = p_user_id;

  IF v_boost_type IS NOT NULL THEN
    INSERT INTO public.active_effects (user_id, effect_type, effect_value, expires_at, source)
    VALUES (p_user_id, v_boost_type, v_boost_value,
            now() + (v_boost_minutes || ' minutes')::interval,
            'daily_reward');
  END IF;

  INSERT INTO public.daily_reward_claims
    (user_id, claim_date, streak_day, reward_coins, reward_gems,
     reward_boost_type, reward_boost_value, reward_boost_minutes)
  VALUES (p_user_id, v_today, v_streak_day, v_reward_coins, v_reward_gems,
          v_boost_type, v_boost_value, v_boost_minutes)
  ON CONFLICT (user_id, claim_date) DO NOTHING;

  INSERT INTO public.economy_events (user_id, event_type, coins_delta, gems_delta, meta)
  VALUES (p_user_id, 'daily_reward', v_reward_coins, v_reward_gems,
          jsonb_build_object(
            'streak', v_streak,
            'streak_day', v_streak_day,
            'boost_type', v_boost_type
          ));

  RETURN json_build_object(
    'success', true,
    'streak', v_streak,
    'streak_day', v_streak_day,
    'reward_coins', v_reward_coins,
    'reward_gems', v_reward_gems,
    'boost_type', v_boost_type,
    'boost_value', v_boost_value,
    'boost_minutes', v_boost_minutes
  );
END;
$$;

-- =============================================================================
-- get_economy_snapshot  (new; client-safe read)
--
-- Returns a projected view of the player's current economy: coins-per-minute,
-- next-harvest preview for each plant, prestige cost/reward preview, essence
-- effects roll-up, and daily-reward eligibility. Pure read; no writes.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_economy_snapshot(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_ess record;
  v_next_prestige integer;
  v_next_cost_coins numeric;
  v_next_cost_gems integer;
  v_next_mult numeric;
  v_essence_preview numeric;
  v_today date;
  v_can_claim boolean;
BEGIN
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL OR v_auth_uid <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_garden FROM public.player_gardens WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Garden not found');
  END IF;

  SELECT * INTO v_ess FROM public._essence_effects(p_user_id);

  v_next_prestige := COALESCE(v_garden.prestige_level, 0) + 1;
  v_next_cost_coins := FLOOR(150000 * POWER(2.2::numeric, v_next_prestige - 1));
  v_next_cost_gems  := 10 + (v_next_prestige - 1) * 5;
  v_next_mult := 1 + 0.5 * v_next_prestige + 0.03 * POWER(v_next_prestige, 2);

  v_essence_preview := FLOOR(
    10 * SQRT(GREATEST(0::numeric, COALESCE(v_garden.coins_earned_this_run, 0)) / 1000000.0)
    * (1 + COALESCE(v_ess.essence_earn_bonus, 0))
  );

  v_today := (now() AT TIME ZONE 'UTC')::date;
  v_can_claim := v_garden.last_daily_claim_date IS NULL
    OR v_garden.last_daily_claim_date < v_today;

  RETURN json_build_object(
    'success', true,
    'economy_version', 2,
    'garden', json_build_object(
      'coins', v_garden.coins,
      'gems', v_garden.gems,
      'essence', v_garden.essence,
      'level', v_garden.level,
      'experience', v_garden.experience,
      'prestige_level', v_garden.prestige_level,
      'permanent_multiplier', v_garden.permanent_multiplier,
      'coins_earned_this_run', v_garden.coins_earned_this_run,
      'total_coins_earned', v_garden.total_coins_earned,
      'daily_streak', v_garden.daily_streak
    ),
    'essence_effects', json_build_object(
      'harvest_bonus', v_ess.harvest_bonus,
      'robot_bonus', v_ess.robot_bonus,
      'growth_bonus', v_ess.growth_bonus,
      'gem_chance_bonus', v_ess.gem_chance_bonus,
      'offline_extra_hours', v_ess.offline_extra_hours,
      'start_coins_bonus', v_ess.start_coins_bonus,
      'start_plots_bonus', v_ess.start_plots_bonus,
      'essence_earn_bonus', v_ess.essence_earn_bonus
    ),
    'prestige_preview', json_build_object(
      'next_prestige', v_next_prestige,
      'cost_coins', v_next_cost_coins,
      'cost_gems', v_next_cost_gems,
      'next_multiplier', v_next_mult,
      'essence_earned_if_prestige_now', v_essence_preview
    ),
    'daily_reward', json_build_object(
      'can_claim', v_can_claim,
      'streak', v_garden.daily_streak,
      'last_claim_date', v_garden.last_daily_claim_date
    )
  );
END;
$$;

-- =============================================================================
-- Grants
-- =============================================================================
GRANT EXECUTE ON FUNCTION public.harvest_plant_transaction(uuid, integer)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.plant_direct_atomic(uuid, integer, uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.collect_robot_income_atomic(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_prestige(uuid)                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_essence_upgrade(uuid, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward(uuid)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_economy_snapshot(uuid)                   TO authenticated;
