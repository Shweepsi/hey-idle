export interface PlantType {
  id: string;
  name: string;
  display_name: string;
  emoji: string;
  base_growth_seconds: number;
  rarity: string;
  level_required: number;
  created_at: string;
}

export interface GardenPlot {
  id: string;
  user_id: string;
  plot_number: number;
  unlocked: boolean;
  plant_type: string | null;
  plant_metadata: any;
  planted_at: string | null;
  growth_time_seconds: number | null;
  updated_at: string;
  created_at: string;
}

export interface PlayerGarden {
  id: string;
  user_id: string;
  coins: number;
  gems: number;
  level: number;
  experience: number;
  prestige_points: number;
  active_plot: number;
  total_harvests: number;
  last_played: string;
  created_at: string;
  prestige_level: number;
  permanent_multiplier: number;

  // Economy v2 additions
  essence: number;
  total_coins_earned: number;
  coins_earned_this_run: number;
  highest_prestige: number;
  daily_streak: number;
  last_daily_claim_date: string | null;
  economy_version: number;

  // Robot-state (existing)
  robot_level?: number;
  robot_last_collected?: string | null;
  robot_accumulated_coins?: number;
  robot_plant_type?: string | null;
}

export interface PlayerAchievement {
  id: string;
  user_id: string;
  achievement_type: string;
  achievement_name: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  reward_coins: number;
  reward_gems: number;
  unlocked_at: string | null;
  created_at: string;
}

// -----------------------------------------------------------------------------
// Economy v2 types
// -----------------------------------------------------------------------------
export interface EssenceUpgradeRow {
  id: string;
  display_name: string;
  description: string;
  emoji: string;
  max_level: number;
  cost_base: number;
  cost_per_level: number;
  effect_per_level: number;
  sort_order: number;
  created_at: string;
}

export interface PlayerEssenceUpgradeRow {
  id: string;
  user_id: string;
  upgrade_id: string;
  level: number;
  purchased_at: string;
  updated_at: string;
}

export interface DailyRewardClaimRow {
  id: string;
  user_id: string;
  claim_date: string;
  streak_day: number;
  reward_coins: number;
  reward_gems: number;
  reward_boost_type: string | null;
  reward_boost_value: number | null;
  reward_boost_minutes: number | null;
  created_at: string;
}

export interface EconomySnapshot {
  economy_version: number;
  garden: {
    coins: number;
    gems: number;
    essence: number;
    level: number;
    experience: number;
    prestige_level: number;
    permanent_multiplier: number;
    coins_earned_this_run: number;
    total_coins_earned: number;
    daily_streak: number;
  };
  essence_effects: {
    harvest_bonus: number;
    robot_bonus: number;
    growth_bonus: number;
    gem_chance_bonus: number;
    offline_extra_hours: number;
    start_coins_bonus: number;
    start_plots_bonus: number;
    essence_earn_bonus: number;
  };
  prestige_preview: {
    next_prestige: number;
    cost_coins: number;
    cost_gems: number;
    next_multiplier: number;
    essence_earned_if_prestige_now: number;
  };
  daily_reward: {
    can_claim: boolean;
    streak: number;
    last_claim_date: string | null;
  };
}

export interface GameState {
  garden: PlayerGarden | null;
  plots: GardenPlot[];
  plantTypes: PlantType[];
}
