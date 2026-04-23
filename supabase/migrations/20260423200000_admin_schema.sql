-- =============================================================================
-- Admin dashboard — Schema
--
-- Design:
--   admin_users           : roles table. Only listed users can call admin RPCs.
--   economy_configs       : key/value live-tunable config (jsonb values).
--   global_overrides      : a special config row with multiplier overrides that
--                           harvest/robot/prestige RPCs multiply in as a final
--                           step. Lets admins tune the live game without
--                           rewriting per-curve RPCs.
--   admin_audit_log       : every admin action (config change, grant, reset,
--                           flag toggle, event create). Immutable append-only.
--   feature_flags         : simple bool flags keyed by name.
--   scheduled_events      : time-windowed modifiers (e.g. "Double XP weekend").
--
-- Safe to re-run: IF NOT EXISTS / ON CONFLICT everywhere.
-- No user is seeded as admin — you must manually insert the first row (superadmin
-- bootstrap) with a direct SQL via the Supabase SQL editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- admin_users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text
);

CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users (role);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- No direct client writes. Reads go through public.is_admin() — a SECURITY
-- DEFINER helper — so the policy doesn't recurse on its own table.
--
-- Forward reference to is_admin(): we define is_admin below, then create the
-- policy at the bottom of this migration (after the function exists).

-- -----------------------------------------------------------------------------
-- is_admin / is_superadmin helpers  (SECURITY DEFINER, used by RLS + RPCs)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = p_user_id AND role = 'superadmin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated;

-- Create the admin_users SELECT policy now that is_admin() exists. The helper
-- is SECURITY DEFINER so it bypasses RLS and doesn't recurse.
DROP POLICY IF EXISTS "Admins can view admin users" ON public.admin_users;
CREATE POLICY "Admins can view admin users"
  ON public.admin_users FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));

-- -----------------------------------------------------------------------------
-- economy_configs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.economy_configs (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.economy_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone authenticated can read economy configs" ON public.economy_configs;
CREATE POLICY "Anyone authenticated can read economy configs"
  ON public.economy_configs FOR SELECT
  TO authenticated
  USING (true);
-- No direct UPDATE policy — admin_update_economy_config RPC only.

-- Seed `global_overrides` — the one config row the economy RPCs read every call.
-- Any number not present here defaults to 1.0 (multiplier) or 0.0 (additive).
INSERT INTO public.economy_configs (key, value, description)
VALUES
  ('global_overrides',
   jsonb_build_object(
     'harvest_mult',         1.0,   -- final multiplier on harvest reward
     'robot_mult',           1.0,   -- final multiplier on robot coins/min
     'xp_mult',              1.0,   -- final multiplier on xp_reward
     'growth_mult',          1.0,   -- final multiplier on growth_speed (>1 = faster)
     'gem_chance_bonus',     0.0,   -- additive to gem drop chance
     'essence_mult',         1.0,   -- final multiplier on essence_earned
     'plant_cost_mult',      1.0,   -- final multiplier on planting cost
     'prestige_cost_mult',   1.0,   -- final multiplier on prestige coin cost
     'event_name',           NULL,  -- optional banner to show clients (unused server-side)
     'event_banner',         NULL,
     'maintenance_mode',     false,
     'maintenance_message',  NULL
   ),
   'Live multipliers applied at the end of every economy RPC. Tune these to run events or hotfix balance without a code deploy.'
  )
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- admin_audit_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id bigserial PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_key text,
  before_value jsonb,
  after_value jsonb,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin_time
  ON public.admin_audit_log (admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_time
  ON public.admin_audit_log (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action_time
  ON public.admin_audit_log (action, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_admin((SELECT auth.uid())));
-- No direct INSERT policy — only admin RPCs write.

-- -----------------------------------------------------------------------------
-- feature_flags
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  rollout_percent integer NOT NULL DEFAULT 100 CHECK (rollout_percent BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone authenticated can read feature flags" ON public.feature_flags;
CREATE POLICY "Anyone authenticated can read feature flags"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);

-- Seed some default flags the app can read right away.
INSERT INTO public.feature_flags (key, enabled, description, rollout_percent)
VALUES
  ('daily_rewards_enabled',    true,  'Turn on the daily login streak cycle.',            100),
  ('essence_tree_enabled',     true,  'Show the essence upgrade panel in the store.',     100),
  ('ladder_enabled',           true,  'Show the social ladder / leaderboard.',            100),
  ('premium_store_enabled',    true,  'Allow IAP & premium purchases.',                   100),
  ('maintenance_banner',       false, 'Show a maintenance warning above the header.',     100),
  ('double_xp_event',          false, 'Client-side UI hint for a server-driven XP event.',100)
ON CONFLICT (key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- scheduled_events
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scheduled_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_type text NOT NULL CHECK (event_type IN (
    'double_xp', 'double_coins', 'double_gems', 'essence_boost', 'growth_speed', 'custom'
  )),
  multiplier numeric NOT NULL DEFAULT 2.0,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  banner_message text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_scheduled_events_active_window
  ON public.scheduled_events (active, starts_at, ends_at);

ALTER TABLE public.scheduled_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone authenticated can read events" ON public.scheduled_events;
CREATE POLICY "Anyone authenticated can read events"
  ON public.scheduled_events FOR SELECT
  TO authenticated
  USING (true);

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
GRANT SELECT ON public.admin_users TO authenticated;
GRANT SELECT ON public.economy_configs TO authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT SELECT ON public.scheduled_events TO authenticated;
