import { AdReward } from '@/types/ads';
import { AdRewardValidator } from './AdRewardValidator';

export interface PollingOptions {
  maxAttempts?: number;
  intervalMs?: number;
  onProgress?: (attempt: number, maxAttempts: number) => void;
}

export class AdPollingService {
  private static readonly DEFAULT_MAX_ATTEMPTS = 40;
  private static readonly DEFAULT_INTERVAL_MS = 500;

  static async pollForReward(
    selectedReward: AdReward,
    currentCoins: number,
    currentGems: number,
    refetchGameData: () => Promise<any>,
    options: PollingOptions = {}
  ): Promise<{ success: boolean; gainedAmount?: number }> {
    const {
      maxAttempts = this.DEFAULT_MAX_ATTEMPTS,
      intervalMs = this.DEFAULT_INTERVAL_MS,
      onProgress,
    } = options;

    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      onProgress?.(attempts, maxAttempts);

      const updatedData = await refetchGameData();

      if (!updatedData.data?.garden) {
        await this.delay(intervalMs);
        continue;
      }

      const newCoins = updatedData.data.garden.coins || 0;
      const newGems = updatedData.data.garden.gems || 0;

      const isRewardReceived = AdRewardValidator.validateReward(
        selectedReward,
        currentCoins,
        newCoins,
        currentGems,
        newGems
      );

      if (isRewardReceived) {
        const gainedAmount = AdRewardValidator.calculateGainedAmount(
          selectedReward,
          currentCoins,
          newCoins,
          currentGems,
          newGems
        );

        return { success: true, gainedAmount };
      }

      await this.delay(intervalMs);
    }

    return { success: false };
  }

  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
