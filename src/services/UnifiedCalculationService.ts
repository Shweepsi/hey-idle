import { PlantType, GardenPlot, PlayerGarden } from '@/types/game';
import { ValidationCacheService } from './ValidationCacheService';
import {
  ROBOT_BASE_INCOME,
  ROBOT_LEVEL_EXPONENT,
  ROBOT_MAX_PERMANENT_MULTIPLIER,
} from '@/constants';

/**
 * Unified calculation service - Single source of truth for all game calculations
 * Eliminates divergences between frontend and backend by using consistent logic
 */
export class UnifiedCalculationService {
  // Cache for optimized performance (DISABLED pour debugging)
  private static readonly calculationCache = new Map<string, any>();
  private static readonly CACHE_TTL = 5000; // 5 seconds
  private static readonly CACHE_DISABLED = true; // Cache désactivé

  /**
   * CORE CALCULATION: Plant readiness check
   * This is the single source of truth used by both frontend and backend
   */
  static isPlantReady(
    plantedAt: string,
    plot: GardenPlot,
    boostMultiplier: number = 1
  ): boolean {
    if (!plantedAt || !plot.growth_time_seconds) return false;

    const plantedTime = new Date(plantedAt).getTime();
    const now = Date.now();
    const adjustedGrowthTime = this.calculateAdjustedGrowthTime(
      plot.growth_time_seconds,
      boostMultiplier
    );
    const requiredTime = adjustedGrowthTime * 1000;

    return now - plantedTime >= requiredTime;
  }

  /**
   * CORE CALCULATION: Adjusted growth time with boosts
   * Growth multiplier REDUCES time (faster growth)
   */
  static calculateAdjustedGrowthTime(
    baseGrowthTimeSeconds: number,
    growthMultiplier: number = 1
  ): number {
    if (!baseGrowthTimeSeconds || baseGrowthTimeSeconds < 1) return 60;
    if (!growthMultiplier || growthMultiplier <= 0) growthMultiplier = 1;

    // Growth multiplier reduces time: 1.5x speed = time / 1.5
    const adjustedTime = Math.floor(baseGrowthTimeSeconds / growthMultiplier);
    return Math.max(1, adjustedTime);
  }

  /**
   * CORE CALCULATION: Time remaining until harvest
   */
  static getTimeRemaining(
    plantedAt: string,
    plot: GardenPlot,
    boostMultiplier: number = 1
  ): number {
    if (!plantedAt || !plot.growth_time_seconds) return 0;

    const cacheKey = `time_${plantedAt}_${plot.growth_time_seconds}_${boostMultiplier}`;
    const cached = this.getCachedValue(cacheKey);
    if (cached !== null) return cached;

    const plantedTime = new Date(plantedAt).getTime();
    const now = Date.now();
    const adjustedGrowthTime = this.calculateAdjustedGrowthTime(
      plot.growth_time_seconds,
      boostMultiplier
    );
    const requiredTime = adjustedGrowthTime * 1000;
    const elapsed = now - plantedTime;

    const remaining = Math.max(0, Math.ceil((requiredTime - elapsed) / 1000));
    this.setCachedValue(cacheKey, remaining);

    return remaining;
  }

  /**
   * CORE CALCULATION: Growth progress percentage
   */
  static getGrowthProgress(
    plantedAt: string,
    plot: GardenPlot,
    boostMultiplier: number = 1
  ): number {
    if (!plantedAt || !plot.growth_time_seconds) return 0;

    const plantedTime = new Date(plantedAt).getTime();
    const now = Date.now();
    const adjustedGrowthTime = this.calculateAdjustedGrowthTime(
      plot.growth_time_seconds,
      boostMultiplier
    );
    const requiredTime = adjustedGrowthTime * 1000;
    const elapsed = now - plantedTime;

    return Math.min(100, Math.max(0, (elapsed / requiredTime) * 100));
  }

  /**
   * CORE CALCULATION: Harvest rewards
   * Uses plot.growth_time_seconds as source of truth
   */
  static calculateHarvestReward(
    plantLevel: number,
    plot: GardenPlot,
    playerLevel: number = 1,
    harvestMultiplier: number = 1,
    plantCostReduction: number = 1,
    permanentMultiplier: number = 1
  ): number {
    // Validation
    if (!plantLevel || plantLevel < 1) plantLevel = 1;
    if (!plot.growth_time_seconds || plot.growth_time_seconds < 1) return 0;
    if (!playerLevel || playerLevel < 1) playerLevel = 1;
    if (!harvestMultiplier || harvestMultiplier < 0.1) harvestMultiplier = 1;

    // Use unified cost calculation
    const baseCost = this.getPlantDirectCost(plantLevel) * plantCostReduction;

    // Unified reward formula
    const baseProfit = baseCost * 1.85; // Increased profit margin for better progression
    const timeBonus =
      Math.max(1, Math.floor(plot.growth_time_seconds / 600)) * 0.1; // 10% per 10min
    const levelBonus = 1 + playerLevel * 0.02; // 2% per player level

    const finalReward = baseProfit * (1 + timeBonus) * levelBonus;
    const result = Math.floor(
      finalReward * harvestMultiplier * permanentMultiplier
    );

    return Math.min(result, 2000000000); // Overflow protection
  }

  /**
   * CORE CALCULATION: Experience rewards
   */
  static calculateExpReward(
    plantLevel: number,
    rarity: string,
    expMultiplier: number = 1
  ): number {
    if (!plantLevel || plantLevel < 1) plantLevel = 1;
    if (!expMultiplier || expMultiplier < 0.1) expMultiplier = 1;

    // Base exp: 15 + 5 per level
    const baseExp = 15 + plantLevel * 5;

    // Future: rarity bonus could be added here
    return Math.floor(baseExp * expMultiplier);
  }

  /**
   * CORE CALCULATION: Gem rewards (with improved base chance)
   */
  static calculateGemReward(
    gemChance: number,
    useRandomness: boolean = true
  ): number {
    // Add 5% base gem chance for better progression
    const baseChance = 0.05;
    const totalChance = Math.min(1.0, Math.max(0, baseChance + gemChance));

    if (totalChance <= 0) return 0;

    if (!useRandomness) {
      // Deterministic calculation for backend consistency
      return totalChance >= 0.5 ? 1 : 0;
    }

    // Random calculation for frontend predictions
    return Math.random() < totalChance ? 1 : 0;
  }

  /**
   * CORE CALCULATION: Plant direct cost
   */
  static getPlantDirectCost(plantLevel: number): number {
    if (!plantLevel || plantLevel < 1) return 100;
    return Math.floor(100 * Math.pow(1.35, plantLevel - 1)); // Reduced exponential growth for better balance
  }

  /**
   * CORE CALCULATION: Robot passive income
   * Uses soft cap with progressive scaling for high prestige levels
   * - Prestige 1-10: Full multiplier applied
   * - Prestige 11+: Soft cap + 50% of excess
   */
  static getRobotPassiveIncome(
    robotLevel: number,
    harvestMultiplier: number = 1,
    permanentMultiplier: number = 1
  ): number {
    const plantLevel = Math.max(1, Math.min(robotLevel, 10));
    const levelMultiplier = Math.pow(plantLevel, ROBOT_LEVEL_EXPONENT);

    // Progressive soft cap for permanent multiplier
    // Full effect up to soft cap, then 50% of excess beyond
    const softCap = ROBOT_MAX_PERMANENT_MULTIPLIER;
    let effectiveMultiplier = permanentMultiplier;

    if (permanentMultiplier > softCap) {
      const excess = permanentMultiplier - softCap;
      effectiveMultiplier = softCap + excess * 0.5;
    }

    const result = Math.floor(
      ROBOT_BASE_INCOME *
        levelMultiplier *
        harvestMultiplier *
        effectiveMultiplier
    );
    return Math.min(result, 2000000000);
  }

  /**
   * Validation helper: Check if plant can be harvested
   */
  static canHarvestPlant(
    plot: GardenPlot,
    boostMultiplier: number = 1
  ): { canHarvest: boolean; reason?: string; timeRemaining?: number } {
    if (!plot.plant_type) {
      return { canHarvest: false, reason: 'No plant to harvest' };
    }

    if (!plot.planted_at) {
      return { canHarvest: false, reason: 'Plant not properly planted' };
    }

    if (!plot.growth_time_seconds) {
      return { canHarvest: false, reason: 'Growth time not set' };
    }

    const isReady = this.isPlantReady(plot.planted_at, plot, boostMultiplier);
    if (!isReady) {
      const timeRemaining = this.getTimeRemaining(
        plot.planted_at,
        plot,
        boostMultiplier
      );
      return {
        canHarvest: false,
        reason: 'Plant not ready yet',
        timeRemaining,
      };
    }

    return { canHarvest: true };
  }

  /**
   * Cache management
   */
  private static getCachedValue(key: string): any {
    // Respect cache disable flag (useful for real-time UI like timers)
    if (this.CACHE_DISABLED) return null;

    const cached = this.calculationCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.calculationCache.delete(key);
      return null;
    }

    return cached.value;
  }

  private static setCachedValue(key: string, value: any): void {
    // Respect cache disable flag (avoid caching highly dynamic values like remaining seconds)
    if (this.CACHE_DISABLED) return;

    this.calculationCache.set(key, {
      value,
      timestamp: Date.now(),
    });

    // Cleanup old entries
    if (this.calculationCache.size > 100) {
      const oldestKey = Array.from(this.calculationCache.keys())[0];
      this.calculationCache.delete(oldestKey);
    }
  }

  /**
   * Calculate robot level from player upgrades
   */
  static getRobotLevel(playerUpgrades: any[]): number {
    let maxLevel = 1; // Base level: autoharvest = level 1

    // Check if auto harvest is unlocked first
    const hasAutoHarvest = playerUpgrades.some(
      (upgrade) => upgrade.level_upgrades?.effect_type === 'auto_harvest'
    );

    if (!hasAutoHarvest) {
      return 0; // No robot if auto harvest not unlocked
    }

    playerUpgrades.forEach((upgrade) => {
      const levelUpgrade = upgrade.level_upgrades;
      if (levelUpgrade?.effect_type === 'robot_level') {
        maxLevel = Math.max(maxLevel, Math.floor(levelUpgrade.effect_value));
      }
    });

    return maxLevel;
  }

  /**
   * Calculate active multipliers from player upgrades
   */
  static calculateActiveMultipliers(playerUpgrades: any[]) {
    const multipliers = {
      harvest: 1,
      growth: 1,
      exp: 1,
      plantCostReduction: 1,
      gemChance: 0,
    };

    playerUpgrades.forEach((upgrade) => {
      const levelUpgrade = upgrade.level_upgrades;
      if (!levelUpgrade) return;

      switch (levelUpgrade.effect_type) {
        case 'harvest_multiplier':
          multipliers.harvest *= levelUpgrade.effect_value;
          break;
        case 'growth_speed':
          multipliers.growth *= levelUpgrade.effect_value;
          break;
        case 'exp_multiplier':
          multipliers.exp *= levelUpgrade.effect_value;
          break;
        case 'plant_cost_reduction':
          multipliers.plantCostReduction *= levelUpgrade.effect_value;
          break;
        case 'gem_chance':
          multipliers.gemChance += levelUpgrade.effect_value;
          break;
      }
    });

    return multipliers;
  }

  /**
   * Clear all caches (DISABLED - cache désactivé pour debugging)
   */
  static clearCache(): void {
    // Cache désactivé pour debugging
    // this.calculationCache.clear();
    // ValidationCacheService.clearAll();
  }

  /**
   * Create parameters object for backend synchronization
   */
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
        (multipliers.gemChance || 0) * (multipliers.gems || 1), // Apply gem boost to chance
        false
      ), // Deterministic for backend
      multipliers,
    };
  }
}
