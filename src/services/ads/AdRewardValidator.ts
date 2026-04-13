import { AdReward } from '@/types/ads';

export class AdRewardValidator {
  static validateReward(
    selectedReward: AdReward,
    currentCoins: number,
    newCoins: number,
    currentGems: number,
    newGems: number
  ): boolean {
    // Vérifier si la récompense a été accordée
    if (selectedReward.type === 'coins' && newCoins > currentCoins) {
      return true;
    }

    if (selectedReward.type === 'gems' && newGems > currentGems) {
      return true;
    }

    // Pour les boosts, on considère que c'est accordé (pas de validation visuelle simple)
    if (
      ['coin_boost', 'gem_boost', 'growth_speed', 'growth_boost'].includes(
        selectedReward.type
      )
    ) {
      return true;
    }

    return false;
  }

  static calculateGainedAmount(
    selectedReward: AdReward,
    currentCoins: number,
    newCoins: number,
    currentGems: number,
    newGems: number
  ): number {
    if (selectedReward.type === 'coins') {
      return newCoins - currentCoins;
    }

    if (selectedReward.type === 'gems') {
      return newGems - currentGems;
    }

    return selectedReward.amount;
  }
}
