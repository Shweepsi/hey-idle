-- =============================================================================
-- Economy v2.0 — Schema & Balance Data
--
-- Purpose: Production-launch economy refactor. Adds essence meta-currency,
-- daily-reward streaks, economy telemetry, widens coin columns to NUMERIC,
-- and rebalances the existing plant / upgrade catalogs.
--
-- Safe to re-run: all statements use IF [NOT] EXISTS or ON CONFLICT.
-- Values mirror src/economy/config.ts (ECONOMY_VERSION = 2). If you change
-- one side you MUST change the other, or the server wins and the client UI
-- will show stale previews.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- player_gardens: new columns for v2
-- -----------------------------------------------------------------------------
ALTER TABLE public.player_gardens
  ADD COLUMN IF NOT EXISTS essence numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_coins_earned numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_earned_this_run numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS highest_prestige integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_claim_date date,
  ADD COLUMN IF NOT EXISTS economy_version integer NOT NULL DEFAULT 1;

-- Widen the bigint coin field to NUMERIC so we can't hit 9.2e18 in production.
-- Only cast if still bigint (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_gardens'
      AND column_name = 'coins'
      AND data_type = 'bigint'
  ) THEN
    ALTER TABLE public.player_gardens ALTER COLUMN coins TYPE numeric USING coins::numeric;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'player_gardens'
      AND column_name = 'robot_accumulated_coins'
      AND data_type IN ('integer', 'bigint')
  ) THEN
    ALTER TABLE public.player_gardens ALTER COLUMN robot_accumulated_coins
      TYPE numeric USING robot_accumulated_coins::numeric;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- essence_upgrades: definitions (seeded below)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.essence_upgrades (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  description text NOT NULL,
  emoji text NOT NULL,
  max_level integer NOT NULL,
  cost_base numeric NOT NULL,
  cost_per_level numeric NOT NULL,
  effect_per_level numeric NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.essence_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read essence upgrades" ON public.essence_upgrades;
CREATE POLICY "Anyone can read essence upgrades"
  ON public.essence_upgrades FOR SELECT
  USING (true);

-- -----------------------------------------------------------------------------
-- player_essence_upgrades: player-owned levels
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_essence_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upgrade_id text NOT NULL REFERENCES public.essence_upgrades(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 0,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, upgrade_id)
);

CREATE INDEX IF NOT EXISTS idx_player_essence_upgrades_user
  ON public.player_essence_upgrades (user_id);
CREATE INDEX IF NOT EXISTS idx_player_essence_upgrades_upgrade
  ON public.player_essence_upgrades (upgrade_id);

ALTER TABLE public.player_essence_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own essence upgrades" ON public.player_essence_upgrades;
CREATE POLICY "Users can view own essence upgrades"
  ON public.player_essence_upgrades FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
-- INSERT/UPDATE only via SECURITY DEFINER RPCs — no direct client writes.

-- -----------------------------------------------------------------------------
-- daily_reward_claims: streak tracking (one row per user per claim day)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date date NOT NULL,
  streak_day integer NOT NULL,
  reward_coins numeric NOT NULL DEFAULT 0,
  reward_gems integer NOT NULL DEFAULT 0,
  reward_boost_type text,
  reward_boost_value numeric,
  reward_boost_minutes integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, claim_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_reward_claims_user
  ON public.daily_reward_claims (user_id);

ALTER TABLE public.daily_reward_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own daily claims" ON public.daily_reward_claims;
CREATE POLICY "Users can view own daily claims"
  ON public.daily_reward_claims FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- economy_events: lightweight telemetry for balance tuning in production
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.economy_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL, -- 'harvest','plant','prestige','essence_spend','daily_reward', etc.
  coins_delta numeric NOT NULL DEFAULT 0,
  gems_delta integer NOT NULL DEFAULT 0,
  essence_delta numeric NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_economy_events_user_time
  ON public.economy_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_economy_events_type_time
  ON public.economy_events (event_type, created_at DESC);

ALTER TABLE public.economy_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own economy events" ON public.economy_events;
CREATE POLICY "Users can view own economy events"
  ON public.economy_events FOR SELECT
  USING ((SELECT auth.uid()) = user_id);
-- Writes are server-side only.

-- =============================================================================
-- Seed / upsert essence_upgrades catalog
-- =============================================================================
INSERT INTO public.essence_upgrades
  (id,             display_name,            description,                                                          emoji, max_level, cost_base, cost_per_level, effect_per_level, sort_order)
VALUES
  ('start_coins',   'Bourse garnie',         '+50 pièces de départ par niveau (après prestige).',                  '💰',  20,        5,         2,              50,               10),
  ('harvest_boost', 'Récolte éternelle',     '+2% aux récompenses de récolte par niveau, permanent.',              '🌾',  50,        10,        5,              0.02,             20),
  ('robot_boost',   'Robot éternel',         '+2% au revenu du robot par niveau, permanent.',                      '🤖',  50,        10,        5,              0.02,             30),
  ('offline_cap',   'Jardin veilleur',       '+1h de plafond hors-ligne (max +16h).',                              '⏰',  16,        15,        10,             1,                40),
  ('gem_chance',    'Chance gemmée',         '+0,5% de chance de gemme par niveau (max +10%).',                    '💎',  20,        20,        10,             0.005,            50),
  ('start_plots',   'Parcelles héritées',    '+1 parcelle conservée au prestige (max +6).',                        '🌻',  6,         25,        25,             1,                60),
  ('essence_boost', 'Échos du passé',        '+5% d''essence gagnée au prochain prestige par niveau.',             '✨',  25,        30,        20,             0.05,             70),
  ('growth_speed',  'Jardinier éternel',     '+1% de vitesse de croissance par niveau.',                           '⚡',  25,        15,        10,             0.01,             80)
ON CONFLICT (id) DO UPDATE SET
  display_name     = EXCLUDED.display_name,
  description      = EXCLUDED.description,
  emoji            = EXCLUDED.emoji,
  max_level        = EXCLUDED.max_level,
  cost_base        = EXCLUDED.cost_base,
  cost_per_level   = EXCLUDED.cost_per_level,
  effect_per_level = EXCLUDED.effect_per_level,
  sort_order       = EXCLUDED.sort_order;

-- =============================================================================
-- Rebalance: plant_types.base_growth_seconds
--
-- Why: old curve made tier 4+ plants worse coins/sec than wheat. New timings
-- combined with the 1.55 cost growth + tiered profit margin fix that.
-- =============================================================================
UPDATE public.plant_types SET base_growth_seconds = 20   WHERE name = 'wheat';
UPDATE public.plant_types SET base_growth_seconds = 40   WHERE name = 'carrot';
UPDATE public.plant_types SET base_growth_seconds = 75   WHERE name = 'lettuce';
UPDATE public.plant_types SET base_growth_seconds = 90   WHERE name = 'tomato';
UPDATE public.plant_types SET base_growth_seconds = 180  WHERE name = 'corn';
UPDATE public.plant_types SET base_growth_seconds = 360  WHERE name = 'potato';
UPDATE public.plant_types SET base_growth_seconds = 600  WHERE name = 'pumpkin';
UPDATE public.plant_types SET base_growth_seconds = 1200 WHERE name = 'watermelon';
UPDATE public.plant_types SET base_growth_seconds = 1800 WHERE name = 'apple';
UPDATE public.plant_types SET base_growth_seconds = 2700 WHERE name = 'grape';

-- =============================================================================
-- Rebalance: level_upgrades cost curve
--
-- All coin costs scaled down ~15-30% to keep pace with the new harvest curve.
-- Robot levels stay the same (they gate plant unlocks, pricing unchanged).
-- =============================================================================
UPDATE public.level_upgrades SET cost_coins = 800      WHERE name = 'harvest_boost_1';
UPDATE public.level_upgrades SET cost_coins = 2000     WHERE name = 'growth_speed_1';
UPDATE public.level_upgrades SET cost_coins = 4000     WHERE name = 'rare_unlock';
UPDATE public.level_upgrades SET cost_coins = 8000     WHERE name = 'harvest_boost_2';
UPDATE public.level_upgrades SET cost_coins = 20000    WHERE name = 'epic_unlock';
UPDATE public.level_upgrades SET cost_coins = 40000    WHERE name = 'growth_speed_2';
UPDATE public.level_upgrades SET cost_coins = 80000    WHERE name = 'legendary_unlock';
UPDATE public.level_upgrades SET cost_coins = 160000   WHERE name = 'harvest_boost_3';
UPDATE public.level_upgrades SET cost_coins = 400000   WHERE name = 'auto_harvest';
UPDATE public.level_upgrades SET cost_coins = 800000   WHERE name = 'mythic_unlock';
UPDATE public.level_upgrades SET cost_coins = 4000000  WHERE name = 'prestige_unlock';

-- Plot-cost function refactored to the new formula (src/economy/config.ts).
-- Still returns integer for bigint/numeric compat; plot 11-12 are gem-gated
-- inside unlock_plot_atomic_v2 (separate RPC in the v2 migration pair).
CREATE OR REPLACE FUNCTION public.get_plot_unlock_cost(plot_number integer)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF plot_number <= 1 THEN RETURN 0; END IF;
  -- 300 * 2.8 ^ (plot_number - 2), floor'd to bigint.
  RETURN FLOOR(300 * POWER(2.8::numeric, plot_number - 2))::bigint;
END;
$function$;

-- =============================================================================
-- Helper: one-shot "reclassify" so existing players are on the v2 curve after
-- rollout. Bumps economy_version; idempotent; safe to re-run.
-- =============================================================================
UPDATE public.player_gardens
SET economy_version = 2
WHERE economy_version < 2;

-- =============================================================================
-- GRANTs (SELECT on catalogs)
-- =============================================================================
GRANT SELECT ON public.essence_upgrades TO authenticated, anon;
GRANT SELECT ON public.player_essence_upgrades TO authenticated;
GRANT SELECT ON public.daily_reward_claims TO authenticated;
GRANT SELECT ON public.economy_events TO authenticated;
