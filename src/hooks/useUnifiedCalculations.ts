import { useGameMultipliers } from './useGameMultipliers';
import { UnifiedCalculationService } from '@/services/UnifiedCalculationService';
import { useMemo } from 'react';

/**
 * Unified hook that provides all game calculations using the single source of truth
 * This replaces the fragmented approach across multiple services
 */
export const useUnifiedCalculations = () => {
  const { getCompleteMultipliers, getCombinedBoostMultiplier } =
    useGameMultipliers();

  // Memoized multipliers to avoid recalculation
  const multipliers = useMemo(() => {
    try {
      return getCompleteMultipliers();
    } catch (error) {
      console.warn('⚠️ Error getting multipliers, using defaults:', error);
      return {
        harvest: 1,
        growth: 1,
        exp: 1,
        plantCostReduction: 1,
        gemChance: 0,
        coins: 1,
        gems: 1,
      };
    }
  }, [getCompleteMultipliers]);

  // Growth speed multiplier specifically
  const growthMultiplier = useMemo(() => {
    return getCombinedBoostMultiplier('growth_speed');
  }, [getCombinedBoostMultiplier]);

  return {
    // Core calculation methods (delegated to UnifiedCalculationService)
    isPlantReady: (plantedAt: string, plot: any) =>
      UnifiedCalculationService.isPlantReady(plantedAt, plot, growthMultiplier),

    getTimeRemaining: (plantedAt: string, plot: any) =>
      UnifiedCalculationService.getTimeRemaining(
        plantedAt,
        plot,
        growthMultiplier
      ),

    getGrowthProgress: (plantedAt: string, plot: any) =>
      UnifiedCalculationService.getGrowthProgress(
        plantedAt,
        plot,
        growthMultiplier
      ),

    calculateHarvestReward: (
      plantLevel: number,
      plot: any,
      playerLevel: number = 1,
      permanentMultiplier: number = 1
    ) =>
      UnifiedCalculationService.calculateHarvestReward(
        plantLevel,
        plot,
        playerLevel,
        multipliers.harvest,
        multipliers.plantCostReduction,
        permanentMultiplier
      ),

    calculateExpReward: (plantLevel: number, rarity: string) =>
      UnifiedCalculationService.calculateExpReward(
        plantLevel,
        rarity,
        multipliers.exp
      ),

    calculateGemReward: (useRandomness: boolean = true) =>
      UnifiedCalculationService.calculateGemReward(
        multipliers.gemChance,
        useRandomness
      ),

    canHarvestPlant: (plot: any) =>
      UnifiedCalculationService.canHarvestPlant(plot, growthMultiplier),

    createBackendParams: (plot: any, plantType: any, garden: any) =>
      UnifiedCalculationService.createBackendParams(
        plot,
        plantType,
        garden,
        multipliers
      ),

    // Direct cost calculations
    getPlantDirectCost: UnifiedCalculationService.getPlantDirectCost,
    getRobotPassiveIncome: (
      robotLevel: number,
      permanentMultiplier: number = 1
    ) =>
      UnifiedCalculationService.getRobotPassiveIncome(
        robotLevel,
        multipliers.harvest,
        permanentMultiplier
      ),

    // Utility
    clearCache: UnifiedCalculationService.clearCache,

    // Expose current multipliers for reference
    multipliers,
    growthMultiplier,
  };
};
