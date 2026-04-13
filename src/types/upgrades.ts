export interface LevelUpgrade {
  id: string;
  name: string;
  display_name: string;
  description: string;
  level_required: number;
  cost_coins: number;
  cost_gems: number;
  effect_type: string;
  effect_value: number;
  emoji: string;
  created_at: string;
}

export interface PlayerUpgrade {
  id: string;
  user_id: string;
  upgrade_id: string;
  purchased_at: string;
  active: boolean;
  level_upgrades?: LevelUpgrade;
}
