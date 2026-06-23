import { supabase as db } from '@/integrations/supabase/client';
import { unwrapRpc } from '@/integrations/supabase/rpc';
import type { EconomySnapshot } from '@/types/game';

export class EconomySnapshotService {
  static async load(userId: string): Promise<EconomySnapshot> {
    const { data, error } = await db.rpc('get_economy_snapshot', {
      p_user_id: userId,
    });
    return unwrapRpc(data, error, 'Snapshot failed');
  }
}
