-- =============================================================================
-- Phase 2b: Tighten RLS. All write operations on game-state tables must now
-- flow through SECURITY DEFINER RPCs — authenticated users no longer have
-- direct INSERT/UPDATE/DELETE rights on tables that drive game progression.
--
-- SELECT policies stay (clients still read their own rows).
-- INSERT on player_gardens/garden_plots is handled by the handle_new_user()
-- trigger on auth.users (SECURITY DEFINER), so the public INSERT policies
-- can be dropped without breaking signup.
-- ad_sessions / ad_cooldowns stay client-writable for now — the ad flow is
-- out of scope for this phase and is gated by the ad-rewards edge function.
-- =============================================================================

-- player_gardens ---------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create their own garden"   ON public.player_gardens;
DROP POLICY IF EXISTS "Users can update their own garden"   ON public.player_gardens;
DROP POLICY IF EXISTS "Users can only view their own garden" ON public.player_gardens;
-- Keep "Users can view their own garden" as the single SELECT policy.

-- garden_plots -----------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create their own plots" ON public.garden_plots;
DROP POLICY IF EXISTS "Users can update their own plots" ON public.garden_plots;
DROP POLICY IF EXISTS "Users can delete their own plots" ON public.garden_plots;

-- player_upgrades --------------------------------------------------------------
DROP POLICY IF EXISTS "player_upgrades_insert"            ON public.player_upgrades;
DROP POLICY IF EXISTS "Users can update their own upgrades" ON public.player_upgrades;

-- active_effects ---------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own active effects" ON public.active_effects;
DROP POLICY IF EXISTS "Users can update their own active effects" ON public.active_effects;
DROP POLICY IF EXISTS "Users can delete their own active effects" ON public.active_effects;

-- player_achievements ----------------------------------------------------------
DROP POLICY IF EXISTS "Users can create their own achievements" ON public.player_achievements;
DROP POLICY IF EXISTS "Users can update their own achievements" ON public.player_achievements;

-- coin_transactions ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create their own transactions" ON public.coin_transactions;

-- plant_discoveries ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own discoveries" ON public.plant_discoveries;
