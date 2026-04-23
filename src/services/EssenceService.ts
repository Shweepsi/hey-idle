import { db, unwrapRpc } from '@/integrations/supabase/untyped';
import type { PlayerEssenceUpgradeRow } from '@/types/game';
import {
  ESSENCE_UPGRADES,
  essenceUpgradeCost,
  type EssenceUpgradeDef,
} from '@/economy/config';

export interface EssenceCatalogEntry {
  def: EssenceUpgradeDef;
  currentLevel: number;
  nextCost: number;
}

export class EssenceService {
  /**
   * Catalog = ESSENCE_UPGRADES (client constant) joined with the player's
   * owned levels. The essence_upgrades table is server-side truth for the
   * RPCs; the client doesn't read it because the shipping catalog is
   * identical and static.
   */
  static async loadCatalog(userId: string): Promise<EssenceCatalogEntry[]> {
    const { data, error } = await db
      .from('player_essence_upgrades')
      .select('*')
      .eq('user_id', userId);
    if (error) throw error;
    const owned: Record<string, PlayerEssenceUpgradeRow> = {};
    for (const row of (data ?? []) as PlayerEssenceUpgradeRow[]) {
      owned[row.upgrade_id] = row;
    }
    return ESSENCE_UPGRADES.map((def) => {
      const currentLevel = owned[def.id]?.level ?? 0;
      return { def, currentLevel, nextCost: essenceUpgradeCost(def, currentLevel) };
    });
  }

  static async purchase(
    userId: string,
    upgradeId: string,
  ): Promise<{
    upgrade_id: string;
    new_level: number;
    cost: number;
    remaining_essence: number;
  }> {
    const { data, error } = await db.rpc('purchase_essence_upgrade', {
      p_user_id: userId,
      p_upgrade_id: upgradeId,
    });
    return unwrapRpc(data, error, 'Essence purchase failed');
  }
}
