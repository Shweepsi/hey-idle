import { supabase } from '@/integrations/supabase/client';
import { DAILY_REWARDS, type DailyReward } from '@/economy/config';

// Auto-generated Supabase types don't include economy-v2 RPCs yet. Cast
// narrowly; shapes are verified against the migration SQL.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface DailyClaimResult {
  streak: number;
  streak_day: number;
  reward_coins: number;
  reward_gems: number;
  boost_type: string | null;
  boost_value: number | null;
  boost_minutes: number | null;
}

export class DailyRewardService {
  static getCycle(): DailyReward[] {
    return DAILY_REWARDS;
  }

  static nextStreakDay(currentStreak: number): number {
    return (currentStreak % 7) + 1;
  }

  static async claim(userId: string): Promise<DailyClaimResult> {
    const { data, error } = await db.rpc('claim_daily_reward', {
      p_user_id: userId,
    });
    if (error) throw error;
    const result = data as { success: boolean; error?: string } & DailyClaimResult;
    if (!result?.success) {
      throw new Error(result?.error || 'Daily reward claim failed');
    }
    return {
      streak: result.streak,
      streak_day: result.streak_day,
      reward_coins: result.reward_coins,
      reward_gems: result.reward_gems,
      boost_type: result.boost_type,
      boost_value: result.boost_value,
      boost_minutes: result.boost_minutes,
    };
  }
}
