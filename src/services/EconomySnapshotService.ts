import { supabase } from '@/integrations/supabase/client';
import type { EconomySnapshot } from '@/types/game';

// Auto-generated Supabase types don't include economy-v2 RPCs yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export class EconomySnapshotService {
  static async load(userId: string): Promise<EconomySnapshot> {
    const { data, error } = await db.rpc('get_economy_snapshot', {
      p_user_id: userId,
    });
    if (error) throw error;
    const result = data as EconomySnapshot & { success: boolean; error?: string };
    if (!result?.success) {
      throw new Error((result as any)?.error || 'Snapshot failed');
    }
    return result;
  }
}
