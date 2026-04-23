import { db, unwrapRpc } from '@/integrations/supabase/untyped';
import type {
  AdminEventType,
  AdminRole,
  AdminRow,
  AuditLogRow,
  EconomyHealth,
  FeatureFlag,
  GlobalOverrides,
  PlayerDetail,
  PlayerSearchRow,
  ScheduledEvent,
} from '@/admin/types';

/**
 * Facade over every admin RPC. Every method throws on non-success so
 * react-query / toast handlers can treat failures uniformly.
 */
export const AdminService = {
  // Uses SECURITY DEFINER RPCs instead of SELECTing admin_users directly —
  // removes the "row exists but RLS hides it" failure mode.
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

  async loadGlobalOverrides(): Promise<GlobalOverrides> {
    const { data, error } = await db
      .from('economy_configs')
      .select('value')
      .eq('key', 'global_overrides')
      .single();
    if (error) throw error;
    return data.value as GlobalOverrides;
  },

  async updateGlobalOverrides(patch: Partial<GlobalOverrides>): Promise<GlobalOverrides> {
    const { data, error } = await db.rpc('admin_update_economy_config', {
      p_key: 'global_overrides',
      p_patch: patch,
    });
    return unwrapRpc<{ value: GlobalOverrides }>(data, error, 'Update failed').value;
  },

  async resetOverrides(): Promise<GlobalOverrides> {
    const { data, error } = await db.rpc('admin_reset_economy_overrides');
    return unwrapRpc<{ value: GlobalOverrides }>(data, error, 'Reset failed').value;
  },

  async searchPlayers(query: string, limit = 25, offset = 0): Promise<PlayerSearchRow[]> {
    const { data, error } = await db.rpc('admin_search_players', {
      p_query: query,
      p_limit: limit,
      p_offset: offset,
    });
    return unwrapRpc<{ rows: PlayerSearchRow[] }>(data, error, 'Search failed').rows;
  },

  async getPlayerDetail(targetUserId: string): Promise<PlayerDetail> {
    const { data, error } = await db.rpc('admin_get_player_detail', {
      p_target_user_id: targetUserId,
    });
    return unwrapRpc<PlayerDetail>(data, error, 'Detail fetch failed');
  },

  async grantCurrency(
    targetUserId: string,
    coins: number,
    gems: number,
    essence: number,
    reason: string,
  ) {
    const { data, error } = await db.rpc('admin_grant_currency', {
      p_target_user_id: targetUserId,
      p_coins: coins,
      p_gems: gems,
      p_essence: essence,
      p_reason: reason,
    });
    return unwrapRpc<{ new_coins: number; new_gems: number; new_essence: number }>(
      data,
      error,
      'Grant failed',
    );
  },

  async resetPlayer(targetUserId: string, reason: string) {
    const { data, error } = await db.rpc('admin_reset_player', {
      p_target_user_id: targetUserId,
      p_reason: reason,
    });
    return unwrapRpc<{ success: true }>(data, error, 'Reset failed');
  },

  async getHealth(): Promise<EconomyHealth> {
    const { data, error } = await db.rpc('admin_get_economy_health');
    return unwrapRpc<EconomyHealth>(data, error, 'Health fetch failed');
  },

  async getAuditLog(
    limit = 50,
    offset = 0,
    actionFilter: string | null = null,
  ): Promise<AuditLogRow[]> {
    const { data, error } = await db.rpc('admin_get_audit_log', {
      p_limit: limit,
      p_offset: offset,
      p_action_filter: actionFilter,
    });
    return unwrapRpc<{ rows: AuditLogRow[] }>(data, error, 'Audit fetch failed').rows;
  },

  async listFlags(): Promise<FeatureFlag[]> {
    const { data, error } = await db.from('feature_flags').select('*').order('key');
    if (error) throw error;
    return (data ?? []) as FeatureFlag[];
  },

  async toggleFlag(
    key: string,
    enabled: boolean,
    rolloutPercent?: number,
  ): Promise<FeatureFlag> {
    const { data, error } = await db.rpc('admin_toggle_feature_flag', {
      p_key: key,
      p_enabled: enabled,
      p_rollout_percent: rolloutPercent ?? null,
    });
    return unwrapRpc<{ flag: FeatureFlag }>(data, error, 'Flag update failed').flag;
  },

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
    event_type: AdminEventType;
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
    return unwrapRpc<{ id: string }>(data, error, 'Create failed').id;
  },

  async deleteEvent(id: string) {
    const { data, error } = await db.rpc('admin_delete_event', { p_id: id });
    return unwrapRpc<{ success: true }>(data, error, 'Delete failed');
  },

  async listAdmins(): Promise<AdminRow[]> {
    const { data, error } = await db.rpc('admin_list_admins');
    return unwrapRpc<{ rows: AdminRow[] }>(data, error, 'List admins failed').rows;
  },

  async addAdmin(targetUserId: string, role: AdminRole, notes?: string) {
    const { data, error } = await db.rpc('admin_add_admin', {
      p_target_user_id: targetUserId,
      p_role: role,
      p_notes: notes ?? null,
    });
    return unwrapRpc<{ success: true }>(data, error, 'Add admin failed');
  },

  async removeAdmin(targetUserId: string) {
    const { data, error } = await db.rpc('admin_remove_admin', {
      p_target_user_id: targetUserId,
    });
    return unwrapRpc<{ success: true }>(data, error, 'Remove admin failed');
  },
};
