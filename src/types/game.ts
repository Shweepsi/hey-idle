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

export interface GameState {
  garden: PlayerGarden | null;
  plots: GardenPlot[];
  plantTypes: PlantType[];
}
