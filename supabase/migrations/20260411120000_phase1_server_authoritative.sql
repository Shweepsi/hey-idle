-- =============================================================================
-- Phase 1: Make game state server-authoritative.
-- Removes client-supplied reward/cost parameters. All rewards, costs, and
-- multipliers are computed from DB state inside SECURITY DEFINER RPCs.
-- Callers pass only identifiers (user_id, plot_number, plant_type_id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- harvest_plant_transaction: drop client reward params, compute server-side.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.harvest_plant_transaction(uuid, integer, bigint, integer, integer, integer, jsonb);
DROP FUNCTION IF EXISTS public.harvest_plant_transaction(uuid, integer, integer, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS public.harvest_plant_transaction(uuid, integer);

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

  -- Aggregate active upgrade effects (compound multipliers)
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

  -- Aggregate active temporary effects (take max per type)
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

  -- Growth readiness (plot.growth_time_seconds is source of truth; set at plant time)
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

  -- Harvest reward formula (must match UnifiedCalculationService.calculateHarvestReward)
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

  -- Gem drop (server-side RNG)
  v_final_gem_chance := LEAST(1.0, GREATEST(0::numeric, v_gem_chance_upgr * v_gem_boost));
  IF v_final_gem_chance > 0 AND random() < v_final_gem_chance THEN
    v_gem_reward := 1;
  END IF;

  -- Commit new totals
  v_new_coins    := LEAST(2000000000::bigint, GREATEST(0::bigint, COALESCE(v_garden.coins, 0) + v_harvest_reward));
  v_new_gems     := GREATEST(0, COALESCE(v_garden.gems, 0) + v_gem_reward);
  v_new_exp      := GREATEST(0, COALESCE(v_garden.experience, 0) + v_exp_reward);
  v_new_level    := GREATEST(1, FLOOR(SQRT(v_new_exp / 100.0)) + 1)::integer;
  v_new_harvests := COALESCE(v_garden.total_harvests, 0) + 1;

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
    'plant_name', v_plant.display_name,
    'old_coins', COALESCE(v_garden.coins, 0),
    'old_gems', COALESCE(v_garden.gems, 0),
    'old_experience', COALESCE(v_garden.experience, 0),
    'old_level', COALESCE(v_garden.level, 1),
    'unified_calculation', true
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- plant_direct_atomic: drop client cost / growth-time params.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.plant_direct_atomic(uuid, integer, uuid, bigint, integer);
DROP FUNCTION IF EXISTS public.plant_direct_atomic(uuid, integer, uuid);

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
  v_base_cost bigint;
  v_growth_seconds integer;
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

  -- Compound plant_cost_reduction from active upgrades
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

  v_base_cost := GREATEST(0::bigint, FLOOR(
    100 * POWER(1.35::numeric, GREATEST(1, COALESCE(v_plant.level_required, 1)) - 1) * v_plant_cost_red
  )::bigint);

  IF COALESCE(v_garden.coins, 0) < v_base_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient coins');
  END IF;

  v_growth_seconds := COALESCE(v_plant.base_growth_seconds, 60);

  UPDATE public.player_gardens
  SET coins = coins - v_base_cost, last_played = v_now
  WHERE user_id = p_user_id;

  UPDATE public.garden_plots
  SET plant_type = p_plant_type_id,
      planted_at = v_now,
      growth_time_seconds = v_growth_seconds,
      updated_at = v_now
  WHERE user_id = p_user_id AND plot_number = p_plot_number;

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, -v_base_cost, 'plant',
          'Planting: ' || COALESCE(v_plant.display_name, v_plant.name, 'plant'));

  RETURN json_build_object(
    'success', true,
    'planted_at', v_now,
    'growth_time_seconds', v_growth_seconds,
    'new_coin_balance', COALESCE(v_garden.coins, 0) - v_base_cost,
    'cost', v_base_cost,
    'plant_name', v_plant.display_name
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- execute_prestige: new RPC, atomic cost check + server-computed multiplier.
-- Replaces the direct client UPDATE in PrestigeSystem.tsx.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.execute_prestige(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_next_prestige integer;
  v_cost_coins bigint;
  v_cost_gems integer;
  v_gem_bonus integer;
  v_next_mult numeric;
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

  v_next_prestige := COALESCE(v_garden.prestige_level, 0) + 1;
  IF v_next_prestige > 3 THEN
    RETURN json_build_object('success', false, 'error', 'Prestige max atteint');
  END IF;

  v_cost_coins := (ARRAY[150000, 375000, 750000]::bigint[])[v_next_prestige];
  v_cost_gems  := (ARRAY[10, 25, 50]::integer[])[v_next_prestige];
  v_gem_bonus  := (ARRAY[5, 10, 20]::integer[])[v_next_prestige];
  v_next_mult  := (ARRAY[2.5, 6, 15]::numeric[])[v_next_prestige];

  IF COALESCE(v_garden.coins, 0) < v_cost_coins
     OR COALESCE(v_garden.gems, 0) < v_cost_gems THEN
    RETURN json_build_object('success', false, 'error', 'Fonds insuffisants');
  END IF;

  UPDATE public.player_gardens
  SET coins = 100,
      gems = GREATEST(0, COALESCE(gems, 0) - v_cost_gems + v_gem_bonus),
      experience = 0,
      level = 1,
      prestige_level = v_next_prestige,
      permanent_multiplier = v_next_mult,
      prestige_points = COALESCE(prestige_points, 0) + 1,
      last_played = now()
  WHERE user_id = p_user_id;

  UPDATE public.player_upgrades
  SET active = false
  WHERE user_id = p_user_id;

  UPDATE public.garden_plots
  SET plant_type = NULL,
      planted_at = NULL,
      growth_time_seconds = NULL,
      unlocked = (plot_number <= 2),
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'prestige_level', v_next_prestige,
    'permanent_multiplier', v_next_mult,
    'gem_bonus', v_gem_bonus,
    'new_coins', 100
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- unlock_plot_atomic: new RPC so plot-unlock flow never touches the client.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unlock_plot_atomic(
  p_user_id uuid,
  p_plot_number integer
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_auth_uid uuid;
  v_garden public.player_gardens%ROWTYPE;
  v_plot public.garden_plots%ROWTYPE;
  v_cost bigint;
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
  IF v_plot.unlocked THEN
    RETURN json_build_object('success', false, 'error', 'Plot already unlocked');
  END IF;

  v_cost := public.get_plot_unlock_cost(p_plot_number);
  IF COALESCE(v_garden.coins, 0) < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient coins');
  END IF;

  UPDATE public.player_gardens
  SET coins = coins - v_cost, last_played = now()
  WHERE user_id = p_user_id;

  UPDATE public.garden_plots
  SET unlocked = true, updated_at = now()
  WHERE user_id = p_user_id AND plot_number = p_plot_number;

  INSERT INTO public.coin_transactions (user_id, amount, transaction_type, description)
  VALUES (p_user_id, -v_cost, 'plot_unlock', 'Unlock plot #' || p_plot_number);

  RETURN json_build_object(
    'success', true,
    'plot_number', p_plot_number,
    'cost', v_cost,
    'new_coin_balance', COALESCE(v_garden.coins, 0) - v_cost
  );
END;
$$;

-- Grants: authenticated users need EXECUTE on these RPCs.
GRANT EXECUTE ON FUNCTION public.harvest_plant_transaction(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.plant_direct_atomic(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_prestige(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_plot_atomic(uuid, integer) TO authenticated;
