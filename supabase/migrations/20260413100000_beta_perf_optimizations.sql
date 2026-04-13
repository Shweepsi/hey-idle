-- =============================================================================
-- Beta perf optimizations
-- 1. Wrap auth.uid() / auth.role() in (select …) to prevent per-row re-eval
-- 2. Add missing FK indexes
-- 3. Scope service_role policies with TO service_role so they don't create
--    duplicate permissive SELECT policies for authenticated/anon roles
-- =============================================================================

-- ---- active_effects ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own active effects" ON public.active_effects;
CREATE POLICY "Users can view their own active effects"
  ON public.active_effects FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- ad_cooldowns -----------------------------------------------------------
DROP POLICY IF EXISTS "Users can create their own ad cooldowns" ON public.ad_cooldowns;
DROP POLICY IF EXISTS "Users can update their own ad cooldowns" ON public.ad_cooldowns;
DROP POLICY IF EXISTS "Users can view their own ad cooldowns"   ON public.ad_cooldowns;
CREATE POLICY "Users can create their own ad cooldowns"
  ON public.ad_cooldowns FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own ad cooldowns"
  ON public.ad_cooldowns FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can view their own ad cooldowns"
  ON public.ad_cooldowns FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- ad_sessions ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create their own ad sessions" ON public.ad_sessions;
DROP POLICY IF EXISTS "Users can update their own ad sessions" ON public.ad_sessions;
DROP POLICY IF EXISTS "Users can view their own ad sessions"   ON public.ad_sessions;
CREATE POLICY "Users can create their own ad sessions"
  ON public.ad_sessions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update their own ad sessions"
  ON public.ad_sessions FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can view their own ad sessions"
  ON public.ad_sessions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- coin_transactions ------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.coin_transactions;
CREATE POLICY "Users can view their own transactions"
  ON public.coin_transactions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- garden_plots -----------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own plots" ON public.garden_plots;
CREATE POLICY "Users can view their own plots"
  ON public.garden_plots FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- pending_ad_rewards -----------------------------------------------------
-- Scope service_role policy with TO service_role to avoid duplicate permissive
-- SELECT policies for anon/authenticated/etc. Service role already bypasses RLS,
-- but being explicit is clean and silences multiple_permissive_policies.
DROP POLICY IF EXISTS "Service role can manage all pending rewards" ON public.pending_ad_rewards;
DROP POLICY IF EXISTS "Users can view their own pending rewards"    ON public.pending_ad_rewards;
CREATE POLICY "Service role can manage all pending rewards"
  ON public.pending_ad_rewards FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Users can view their own pending rewards"
  ON public.pending_ad_rewards FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- plant_discoveries ------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own discoveries" ON public.plant_discoveries;
CREATE POLICY "Users can view their own discoveries"
  ON public.plant_discoveries FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- player_achievements ----------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own achievements" ON public.player_achievements;
CREATE POLICY "Users can view their own achievements"
  ON public.player_achievements FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- player_gardens ---------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own garden" ON public.player_gardens;
CREATE POLICY "Users can view their own garden"
  ON public.player_gardens FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- player_upgrades --------------------------------------------------------
DROP POLICY IF EXISTS "player_upgrades_select" ON public.player_upgrades;
CREATE POLICY "player_upgrades_select"
  ON public.player_upgrades FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- ---- profiles ---------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile"   ON public.profiles;
CREATE POLICY "Users can create their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id);
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING ((SELECT auth.uid()) = id);

-- ---- purchases --------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can update purchases"   ON public.purchases;
DROP POLICY IF EXISTS "Users can create their own purchases" ON public.purchases;
DROP POLICY IF EXISTS "Users can view their own purchases"   ON public.purchases;
CREATE POLICY "Service role can update purchases"
  ON public.purchases FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Users can create their own purchases"
  ON public.purchases FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can view their own purchases"
  ON public.purchases FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- Missing FK indexes
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id
  ON public.coin_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_garden_plots_plant_type
  ON public.garden_plots (plant_type);
CREATE INDEX IF NOT EXISTS idx_player_gardens_robot_plant_type
  ON public.player_gardens (robot_plant_type);
CREATE INDEX IF NOT EXISTS idx_player_upgrades_upgrade_id
  ON public.player_upgrades (upgrade_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user_id
  ON public.purchases (user_id);
