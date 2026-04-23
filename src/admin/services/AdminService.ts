import { supabase } from '@/integrations/supabase/client';
import type {
  AuditLogRow,
  EconomyHealth,
  FeatureFlag,
  GlobalOverrides,
  PlayerDetail,
  PlayerSearchRow,
  ScheduledEvent,
} from '@/admin/types';

// Auto-generated Supabase types don't include admin tables/RPCs yet. We cast
// once here and let services stay typed via our own interfaces.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function unwrap<T>(data: any, fallback?: T): T {
  if (!data) throw new Error('Empty RPC response');
  if (data.success === false) throw new Error(data.error || 'Unknown admin error');
  return (data as T) ?? (fallback as T);
}

/**
 * Single facade for all admin RPCs. Every method throws on non-success so
 * react-query / toast handlers can treat failures uniformly.
 */
export const AdminService = {
  // -------------------------------------------------------------------------
  // Authorization
  //
  // We use the is_admin() / is_superadmin() RPCs instead of SELECTing
  // admin_users directly. Both are SECURITY DEFINER and bypass RLS, so the
  // client never needs a SELECT policy on the table — removing the class of
  // "admin row exists but RLS hides it" bugs.
  // -------------------------------------------------------------------------
  async amIAdmin(userId: string): Promise<{ admin: boolean; superadmin: boolean }> {
    const [adminRes, superRes] = await Promise.all([
      db.rpc('is_admin', { p_user_id: userId }),
      db.rpc('is_superadmin', { p_user_id: userId }),
    ]);
    if (adminRes.error) throw adminRes.error;
    if (superRes.error) throw superRes.error;
    return {
      admin: adminRes.data === true,
      superadmin: superRes.data === true,
    };
  },

  // -------------------------------------------------------------------------
  // Economy config (global_overrides row is the hot one)
  // -------------------------------------------------------------------------
  async loadGlobalOverrides(): Promise<GlobalOverrides> {
    const { data, error } = await db
      .from('economy_configs')
      .select('value')
      .eq('key', 'global_overrides')
      .single();
    if (error) throw error;
    return data.value as GlobalOverrides;
  },

  async updateGlobalOverrides(
    patch: Partial<GlobalOverrides>
  ): Promise<GlobalOverrides> {
    const { data, error } = await db.rpc('admin_update_economy_config', {
      p_key: 'global_overrides',
      p_patch: patch,
    });
    if (error) throw error;
    return unwrap<{ key: string; value: GlobalOverrides }>(data).value;
  },

  async resetOverrides(): Promise<GlobalOverrides> {
    const { data, error } = await db.rpc('admin_reset_economy_overrides');
    if (error) throw error;
    return unwrap<{ value: GlobalOverrides }>(data).value;
  },

  // -------------------------------------------------------------------------
  // Players
  // -------------------------------------------------------------------------
  async searchPlayers(
    query: string,
    limit = 25,
    offset = 0
  ): Promise<PlayerSearchRow[]> {
    const { data, error } = await db.rpc('admin_search_players', {
      p_query: query,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    return unwrap<{ rows: PlayerSearchRow[] }>(data).rows;
  },

  async getPlayerDetail(targetUserId: string): Promise<PlayerDetail> {
    const { data, error } = await db.rpc('admin_get_player_detail', {
      p_target_user_id: targetUserId,
    });
    if (error) throw error;
    return unwrap<PlayerDetail>(data);
  },

  async grantCurrency(
    targetUserId: string,
    coins: number,
    gems: number,
    essence: number,
    reason: string
  ) {
    const { data, error } = await db.rpc('admin_grant_currency', {
      p_target_user_id: targetUserId,
      p_coins: coins,
      p_gems: gems,
      p_essence: essence,
      p_reason: reason,
    });
    if (error) throw error;
    return unwrap<{ new_coins: number; new_gems: number; new_essence: number }>(data);
  },

  async resetPlayer(targetUserId: string, reason: string) {
    const { data, error } = await db.rpc('admin_reset_player', {
      p_target_user_id: targetUserId,
      p_reason: reason,
    });
    if (error) throw error;
    return unwrap<{ success: true }>(data);
  },

  // -------------------------------------------------------------------------
  // Health & audit
  // -------------------------------------------------------------------------
  async getHealth(): Promise<EconomyHealth> {
    const { data, error } = await db.rpc('admin_get_economy_health');
    if (error) throw error;
    return unwrap<EconomyHealth>(data);
  },

  async getAuditLog(
    limit = 50,
    offset = 0,
    actionFilter: string | null = null
  ): Promise<AuditLogRow[]> {
    const { data, error } = await db.rpc('admin_get_audit_log', {
      p_limit: limit,
      p_offset: offset,
      p_action_filter: actionFilter,
    });
    if (error) throw error;
    return unwrap<{ rows: AuditLogRow[] }>(data).rows;
  },

  // -------------------------------------------------------------------------
  // Feature flags
  // -------------------------------------------------------------------------
  async listFlags(): Promise<FeatureFlag[]> {
    const { data, error } = await db
      .from('feature_flags')
      .select('*')
      .order('key');
    if (error) throw error;
    return (data ?? []) as FeatureFlag[];
  },

  async toggleFlag(
    key: string,
    enabled: boolean,
    rolloutPercent?: number
  ): Promise<FeatureFlag> {
    const { data, error } = await db.rpc('admin_toggle_feature_flag', {
      p_key: key,
      p_enabled: enabled,
      p_rollout_percent: rolloutPercent ?? null,
    });
    if (error) throw error;
    return unwrap<{ flag: FeatureFlag }>(data).flag;
  },

  // -------------------------------------------------------------------------
  // Scheduled events
  // -------------------------------------------------------------------------
  async listEvents(): Promise<ScheduledEvent[]> {
    const { data, error } = await db
      .from('scheduled_events')
      .select('*')
      .eq('active', true)
      .order('starts_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ScheduledEvent[];
  },

  async createEvent(input: {
    name: string;
    event_type: string;
    multiplier: number;
    starts_at: string;
    ends_at: string;
    banner_message: string | null;
  }): Promise<string> {
    const { data, error } = await db.rpc('admin_create_event', {
      p_name: input.name,
      p_event_type: input.event_type,
      p_multiplier: input.multiplier,
      p_starts_at: input.starts_at,
      p_ends_at: input.ends_at,
      p_banner_message: input.banner_message,
    });
    if (error) throw error;
    return unwrap<{ id: string }>(data).id;
  },

  async deleteEvent(id: string) {
    const { data, error } = await db.rpc('admin_delete_event', { p_id: id });
    if (error) throw error;
    return unwrap<{ success: true }>(data);
  },

  // -------------------------------------------------------------------------
  // Role management (superadmin only)
  // -------------------------------------------------------------------------
  async addAdmin(targetUserId: string, role: 'admin' | 'superadmin', notes?: string) {
    const { data, error } = await db.rpc('admin_add_admin', {
      p_target_user_id: targetUserId,
      p_role: role,
      p_notes: notes ?? null,
    });
    if (error) throw error;
    return unwrap<{ success: true }>(data);
  },

  async removeAdmin(targetUserId: string) {
    const { data, error } = await db.rpc('admin_remove_admin', {
      p_target_user_id: targetUserId,
    });
    if (error) throw error;
    return unwrap<{ success: true }>(data);
  },
};
