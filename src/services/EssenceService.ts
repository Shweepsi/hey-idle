import { supabase } from '@/integrations/supabase/client';
import type {
  EssenceUpgradeRow,
  PlayerEssenceUpgradeRow,
} from '@/types/game';
import {
  ESSENCE_UPGRADES,
  essenceUpgradeCost,
  type EssenceUpgradeDef,
} from '@/economy/config';

// The auto-generated Supabase types don't yet include economy-v2 tables
// because `supabase gen types` hasn't been re-run. We cast narrowly so the
// compile stays clean; shapes are verified against the migration SQL.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export class EssenceService {
  /** Ordered catalog, joined with player's owned levels. */
  static async loadCatalog(
    userId: string
  ): Promise<
    Array<{
      def: EssenceUpgradeDef;
      row: EssenceUpgradeRow | null;
      currentLevel: number;
      nextCost: number;
    }>
  > {
    const [defsRes, ownedRes] = await Promise.all([
      db.from('essence_upgrades').select('*').order('sort_order'),
      db.from('player_essence_upgrades').select('*').eq('user_id', userId),
    ]);

    if (defsRes.error) throw defsRes.error;
    if (ownedRes.error) throw ownedRes.error;

    const rows: EssenceUpgradeRow[] = (defsRes.data ?? []) as EssenceUpgradeRow[];
    const owned: Record<string, PlayerEssenceUpgradeRow> = {};
    for (const r of (ownedRes.data ?? []) as PlayerEssenceUpgradeRow[]) {
      owned[r.upgrade_id] = r;
    }

    return ESSENCE_UPGRADES.map((def) => {
      const row = rows.find((r) => r.id === def.id) ?? null;
      const currentLevel = owned[def.id]?.level ?? 0;
      return {
        def,
        row,
        currentLevel,
        nextCost: essenceUpgradeCost(def, currentLevel),
      };
    });
  }

  /** Purchase next level. Throws on RPC error or non-success payload. */
  static async purchase(
    userId: string,
    upgradeId: string
  ): Promise<{
    success: true;
    upgrade_id: string;
    new_level: number;
    cost: number;
    remaining_essence: number;
  }> {
    const { data, error } = await db.rpc('purchase_essence_upgrade', {
      p_user_id: userId,
      p_upgrade_id: upgradeId,
    });
    if (error) throw error;
    const result = data as {
      success: boolean;
      error?: string;
      upgrade_id?: string;
      new_level?: number;
      cost?: number;
      remaining_essence?: number;
    };
    if (!result?.success) {
      throw new Error(result?.error || 'Essence purchase failed');
    }
    return {
      success: true,
      upgrade_id: result.upgrade_id!,
      new_level: result.new_level!,
      cost: result.cost!,
      remaining_essence: result.remaining_essence!,
    };
  }
}
