import { db, unwrapRpc } from '@/integrations/supabase/untyped';
import { DAILY_REWARDS, type DailyReward } from '@/economy/config';

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
    return unwrapRpc(data, error, 'Daily reward claim failed');
  }
}
