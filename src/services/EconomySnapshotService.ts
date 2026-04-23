import { db, unwrapRpc } from '@/integrations/supabase/untyped';
import type { EconomySnapshot } from '@/types/game';

export class EconomySnapshotService {
  static async load(userId: string): Promise<EconomySnapshot> {
    const { data, error } = await db.rpc('get_economy_snapshot', {
      p_user_id: userId,
    });
    return unwrapRpc(data, error, 'Snapshot failed');
  }
}
