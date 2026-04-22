import { PlantType, GardenPlot, PlayerGarden } from '@/types/game';
import {
  ROBOT_BASE_INCOME,
  ROBOT_LEVEL_EXPONENT,
  ROBOT_MAX_LEVEL,
  PLANT_COST_BASE,
  PLANT_COST_GROWTH,
  plantProfitMargin,
  TIME_BONUS_PER_10MIN,
  LEVEL_BONUS_PER_LEVEL,
  COIN_HARD_CAP,
  levelForXp,
} from '@/economy/config';

/**
 * Unified calculation service — economy v2. Mirrors the SQL RPCs exactly so
 * the frontend preview (e.g. "harvest this plant for X coins") matches what
 * the server will actually grant. If the server disagrees, it wins.
 *
 * Additive essence effects (harvest_bonus, robot_bonus, growth_bonus) are
 * applied by callers via the useGameMultipliers hook and passed into these
 * helpers as pre-combined scalars.
 */
export class UnifiedCalculationService {
  /** True if the plot's plant is ready to harvest, accounting for boosts. */
  static isPlantReady(
    plantedAt: string,
    plot: GardenPlot,
    boostMultiplier: number = 1
  ): boolean {
    if (!plantedAt || !plot.growth_time_seconds) return false;
    const plantedTime = new Date(plantedAt).getTime();
    const now = Date.now();
    const adjusted = this.calculateAdjustedGrowthTime(
      plot.growth_time_seconds,
      boostMultiplier
    );
    return now - plantedTime >= adjusted * 1000;
  }

  /** Growth multiplier > 1 reduces time. */
  static calculateAdjustedGrowthTime(
    baseGrowthTimeSeconds: number,
    growthMultiplier: number = 1
  ): number {
    if (!baseGrowthTimeSeconds || baseGrowthTimeSeconds < 1) return 60;
    if (!growthMultiplier || growthMultiplier <= 0) growthMultiplier = 1;
    return Math.max(1, Math.floor(baseGrowthTimeSeconds / growthMultiplier));
  }

  static getTimeRemaining(
    plantedAt: string,
    plot: GardenPlot,
    boostMultiplier: number = 1
  ): number {
    if (!plantedAt || !plot.growth_time_seconds) return 0;
    const plantedTime = new Date(plantedAt).getTime();
    const adjustedMs =
      this.calculateAdjustedGrowthTime(plot.growth_time_seconds, boostMultiplier) * 1000;
    return Math.max(0, Math.ceil((adjustedMs - (Date.now() - plantedTime)) / 1000));
  }

  static getGrowthProgress(
    plantedAt: string,
    plot: GardenPlot,
    boostMultiplier: number = 1
  ): number {
    if (!plantedAt || !plot.growth_time_seconds) return 0;
    const plantedTime = new Date(plantedAt).getTime();
    const adjustedMs =
      this.calculateAdjustedGrowthTime(plot.growth_time_seconds, boostMultiplier) * 1000;
    const elapsed = Date.now() - plantedTime;
    return Math.min(100, Math.max(0, (elapsed / adjustedMs) * 100));
  }

  /**
   * Harvest reward v2. Matches SQL harvest_plant_transaction exactly.
   *   base_cost   = PLANT_COST_BASE * PLANT_COST_GROWTH^(plantLevel-1) * costRed
   *   margin      = tiered (2.2 / 2.5 / 2.9 / 3.5)
   *   time_bonus  = floor(growth_seconds / 600) * 0.1
   *   level_bonus = 1 + player_level * 0.015
   *   reward      = base_cost * margin * (1+time_bonus) * level_bonus
   *                 * harvestMultiplier * permanentMultiplier
   *
   * Note: harvestMultiplier is the *final* multiplier (permanent upgrades +
   * temporary ad boost + essence harvest_bonus). Callers combine them via
   * useGameMultipliers.getCompleteMultipliers().
   */
  static calculateHarvestReward(
    plantLevel: number,
    plot: GardenPlot,
    playerLevel: number = 1,
    harvestMultiplier: number = 1,
    plantCostReduction: number = 1,
    permanentMultiplier: number = 1
  ): number {
    if (!plantLevel || plantLevel < 1) plantLevel = 1;
    if (!plot.growth_time_seconds || plot.growth_time_seconds < 1) return 0;
    if (!playerLevel || playerLevel < 1) playerLevel = 1;
    if (!harvestMultiplier || harvestMultiplier < 0.1) harvestMultiplier = 1;

    const baseCost = this.getPlantDirectCost(plantLevel) * plantCostReduction;
    const margin = plantProfitMargin(plantLevel);
    const baseProfit = baseCost * margin;
    const timeBonus =
      Math.floor(plot.growth_time_seconds / 600) * TIME_BONUS_PER_10MIN;
    const levelBonus = 1 + playerLevel * LEVEL_BONUS_PER_LEVEL;

    const reward =
      baseProfit *
      (1 + timeBonus) *
      levelBonus *
      harvestMultiplier *
      permanentMultiplier;

    return Math.min(Math.floor(reward), COIN_HARD_CAP);
  }

  /** XP reward: 15 + 5 * plantLevel, scaled by expMultiplier. */
  static calculateExpReward(
    plantLevel: number,
    _rarity: string,
    expMultiplier: number = 1
  ): number {
    if (!plantLevel || plantLevel < 1) plantLevel = 1;
    if (!expMultiplier || expMultiplier < 0.1) expMultiplier = 1;
    return Math.floor((15 + plantLevel * 5) * expMultiplier);
  }

  /**
   * Gem reward preview.
   *   chance = base (3%) + upgrade_gem_chance + essence_gem_chance, * gem_boost,
   *   clamped to [0, 0.9].
   */
  static calculateGemReward(
    gemChance: number,
    useRandomness: boolean = true
  ): number {
    const base = 0.03;
    const total = Math.min(0.9, Math.max(0, base + gemChance));
    if (total <= 0) return 0;
    if (!useRandomness) return total >= 0.5 ? 1 : 0;
    return Math.random() < total ? 1 : 0;
  }

  /** Plant planting cost — v2 curve: 50 * 1.55^(level-1). */
  static getPlantDirectCost(plantLevel: number): number {
    if (!plantLevel || plantLevel < 1) return PLANT_COST_BASE;
    return Math.floor(PLANT_COST_BASE * Math.pow(PLANT_COST_GROWTH, plantLevel - 1));
  }

  /**
   * Robot passive income per minute — v2.
   *   base          = ROBOT_BASE_INCOME (40)
   *   levelMult     = clamp(robotLevel, 1, 10) ^ ROBOT_LEVEL_EXPONENT (1.35)
   *   income        = base * levelMult * harvestMultiplier * permanentMultiplier
   *
   * NOTE: The v1 soft cap at 10x permanent_multiplier is REMOVED. Full
   * permanent_multiplier always applies. Callers should fold the essence
   * robot_bonus into harvestMultiplier before calling.
   */
  static getRobotPassiveIncome(
    robotLevel: number,
    harvestMultiplier: number = 1,
    permanentMultiplier: number = 1
  ): number {
    const plantLevel = Math.max(1, Math.min(robotLevel, ROBOT_MAX_LEVEL));
    const levelMultiplier = Math.pow(plantLevel, ROBOT_LEVEL_EXPONENT);
    const income =
      ROBOT_BASE_INCOME *
      levelMultiplier *
      harvestMultiplier *
      permanentMultiplier;
    return Math.min(Math.floor(income), COIN_HARD_CAP);
  }

  static canHarvestPlant(
    plot: GardenPlot,
    boostMultiplier: number = 1
  ): { canHarvest: boolean; reason?: string; timeRemaining?: number } {
    if (!plot.plant_type) return { canHarvest: false, reason: 'No plant to harvest' };
    if (!plot.planted_at) return { canHarvest: false, reason: 'Plant not properly planted' };
    if (!plot.growth_time_seconds) return { canHarvest: false, reason: 'Growth time not set' };

    if (!this.isPlantReady(plot.planted_at, plot, boostMultiplier)) {
      return {
        canHarvest: false,
        reason: 'Plant not ready yet',
        timeRemaining: this.getTimeRemaining(plot.planted_at, plot, boostMultiplier),
      };
    }
    return { canHarvest: true };
  }

  /** Robot level from player upgrades (1 if auto_harvest, up to robot_level_N). */
  static getRobotLevel(playerUpgrades: any[]): number {
    const hasAutoHarvest = playerUpgrades.some(
      (u) => u.level_upgrades?.effect_type === 'auto_harvest'
    );
    if (!hasAutoHarvest) return 0;
    let maxLevel = 1;
    playerUpgrades.forEach((u) => {
      if (u.level_upgrades?.effect_type === 'robot_level') {
        maxLevel = Math.max(maxLevel, Math.floor(u.level_upgrades.effect_value));
      }
    });
    return maxLevel;
  }

  /** Compound all active upgrade effects into a multipliers roll-up. */
  static calculateActiveMultipliers(playerUpgrades: any[]) {
    const m = {
      harvest: 1,
      growth: 1,
      exp: 1,
      plantCostReduction: 1,
      gemChance: 0,
    };
    playerUpgrades.forEach((u) => {
      const def = u.level_upgrades;
      if (!def) return;
      switch (def.effect_type) {
        case 'harvest_multiplier':    m.harvest *= def.effect_value; break;
        case 'growth_speed':          m.growth  *= def.effect_value; break;
        case 'exp_multiplier':        m.exp     *= def.effect_value; break;
        case 'plant_cost_reduction':  m.plantCostReduction *= def.effect_value; break;
        case 'gem_chance':            m.gemChance += def.effect_value; break;
      }
    });
    return m;
  }

  /** Level from XP — matches SQL (floor(sqrt(xp/80)) + 1). */
  static levelFromExperience(xp: number): number {
    return levelForXp(xp);
  }

  static clearCache(): void {
    // Disabled — no-op.
  }

  /** Used by the upstream preview UIs before a harvest. */
  static createBackendParams(
    plot: GardenPlot,
    plantType: PlantType,
    garden: PlayerGarden,
    multipliers: any
  ) {
    const plantLevel = Math.max(1, plantType.level_required || 1);
    const playerLevel = Math.max(1, garden.level || 1);
    return {
      actualGrowthTime:
        plot.growth_time_seconds || plantType.base_growth_seconds || 60,
      harvestReward: this.calculateHarvestReward(
        plantLevel,
        plot,
        playerLevel,
        multipliers.harvest || 1,
        multipliers.plantCostReduction || 1,
        garden.permanent_multiplier || 1
      ),
      expReward: this.calculateExpReward(
        plantLevel,
        plantType.rarity || 'common',
        multipliers.exp || 1
      ),
      gemReward: this.calculateGemReward(
        (multipliers.gemChance || 0) * (multipliers.gems || 1),
        false
      ),
      multipliers,
    };
  }
}
