export interface AdReward {
  type:
    | 'coins'
    | 'gems'
    | 'coin_boost'
    | 'gem_boost'
    | 'growth_speed'
    | 'growth_boost'
    | 'exp_boost'
    | 'harvest_boost';
  amount: number;
  duration?: number; // Pour les boosts temporaires en minutes
  multiplier?: number;
  description: string;
  emoji: string;
}

export interface AdSession {
  id: string;
  user_id: string;
  reward_type: string;
  reward_amount: number;
  reward_data: any; // Compatible avec Json de Supabase
  watched_at: string;
  expires_at?: string;
  created_at: string;
}

export interface AdCooldown {
  id: string;
  user_id: string;
  last_ad_watched?: string;
  daily_count: number;
  daily_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface AdState {
  available: boolean;
  cooldownEnds: Date | null;
  dailyCount: number;
  maxDaily: number;
  currentReward: AdReward | null;
  timeUntilNext: number; // en secondes
}

export type AdRewardType = AdReward['type'];
