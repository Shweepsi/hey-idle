/**
 * Shared TypeScript types for the admin dashboard. Shapes mirror the SQL RPC
 * return values in supabase/migrations/2026042321*_admin_rpcs.sql.
 */

export type AdminRole = 'admin' | 'superadmin';

export interface GlobalOverrides {
  harvest_mult: number;
  robot_mult: number;
  xp_mult: number;
  growth_mult: number;
  gem_chance_bonus: number;
  essence_mult: number;
  plant_cost_mult: number;
  prestige_cost_mult: number;
  event_name: string | null;
  event_banner: string | null;
  maintenance_mode: boolean;
  maintenance_message: string | null;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  rollout_percent: number;
  updated_at: string;
  updated_by: string | null;
}

export interface ScheduledEvent {
  id: string;
  name: string;
  event_type: string;
  multiplier: number;
  starts_at: string;
  ends_at: string;
  banner_message: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface PlayerSearchRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  coins: number;
  gems: number;
  essence: number;
  level: number;
  prestige_level: number;
  total_harvests: number;
  last_played: string | null;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  admin_user_id: string;
  admin_email: string | null;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  target_key: string | null;
  before_value: unknown;
  after_value: unknown;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface EconomyHealthBucket {
  prestige_level?: number;
  level?: string;
  event_type?: string;
  n: number;
}

export interface EconomyHealth {
  generated_at: string;
  totals: {
    players: number;
    dau_24h: number;
    dau_7d: number;
    coins_earned_24h: number;
    gems_earned_24h: number;
    essence_earned_24h: number;
    harvests_24h: number;
    prestiges_24h: number;
    active_boosts: number;
  };
  prestige_distribution: EconomyHealthBucket[];
  level_distribution: EconomyHealthBucket[];
  event_counts_24h: EconomyHealthBucket[];
}

export interface PlayerDetail {
  garden: Record<string, unknown>;
  profile: Record<string, unknown> | null;
  upgrades: Array<{
    name: string;
    display_name: string;
    effect_type: string;
    effect_value: number;
    active: boolean;
    purchased_at: string;
  }>;
  essence_upgrades: Array<{
    upgrade_id: string;
    level: number;
    updated_at: string;
  }>;
  recent_events: Array<{
    event_type: string;
    coins_delta: number;
    gems_delta: number;
    essence_delta: number;
    meta: Record<string, unknown>;
    created_at: string;
  }>;
  active_effects: Array<{
    effect_type: string;
    effect_value: number;
    expires_at: string;
    source: string;
  }>;
}
