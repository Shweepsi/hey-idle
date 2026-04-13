import { supabase } from '@/integrations/supabase/client';
import { AdCacheService } from '@/services/ads/AdCacheService';
import type { AdReward, AdState } from '@/types/ads';

/**
 * Service unifié simplifié pour gérer toutes les récompenses
 * Utilise la nouvelle edge function ad-rewards comme source unique de vérité
 */
export class UnifiedRewardService {
  private static rewardsCache = new Map<number, AdReward[]>();

  /**
   * Trie les récompenses par ordre de priorité
   */
  private static sortRewards(rewards: AdReward[]): AdReward[] {
    // Ordre de priorité : seulement les boosts maintenant
    const order = ['coin_boost', 'gem_boost', 'growth_speed', 'growth_boost'];

    return rewards.sort((a, b) => {
      const aIndex = order.indexOf(a.type);
      const bIndex = order.indexOf(b.type);

      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }

      return (b.amount || 0) - (a.amount || 0);
    });
  }

  /**
   * Récupère les récompenses disponibles pour un niveau de joueur donné
   * Utilise le cache intelligent AdCacheService
   */
  static async getAvailableRewards(playerLevel: number): Promise<AdReward[]> {
    try {
      // Vérifier le cache intelligent d'abord
      const cached = AdCacheService.getCachedRewards(playerLevel);
      if (cached) {
        console.log(
          `[UnifiedRewardService] 📋 Récompenses depuis cache pour niveau ${playerLevel}`
        );
        return cached;
      }

      const { data: configs, error } = await supabase
        .from('ad_reward_configs')
        .select('*')
        .eq('active', true)
        .lte('min_player_level', playerLevel)
        .order('reward_type');

      if (error || !configs?.length) {
        console.error('Error fetching reward configs:', error);
        return this.getFallbackRewards();
      }

      const rewards: AdReward[] = configs.map((config) => {
        const calculatedAmount =
          config.base_amount + config.level_coefficient * (playerLevel - 1);
        const finalAmount = config.max_amount
          ? Math.min(calculatedAmount, config.max_amount)
          : calculatedAmount;

        return {
          type: config.reward_type as AdReward['type'],
          amount: Math.floor(finalAmount),
          duration: config.duration_minutes,
          description: config.description,
          emoji: config.emoji,
        };
      });

      const sortedRewards = this.sortRewards(rewards);

      // Utiliser le cache intelligent avec TTL
      AdCacheService.cacheRewards(playerLevel, sortedRewards);
      console.log(
        `[UnifiedRewardService] 💾 Récompenses mises en cache pour niveau ${playerLevel}`
      );

      return sortedRewards;
    } catch (error) {
      console.error('Error in getAvailableRewards:', error);
      return this.getFallbackRewards();
    }
  }

  /**
   * Récompenses de secours en cas d'erreur - seulement les boosts
   */
  private static getFallbackRewards(): AdReward[] {
    return [
      {
        type: 'coin_boost',
        amount: 30,
        duration: 30,
        description: 'Boost de pièces (30min)',
        emoji: '🚀',
      },
      {
        type: 'growth_speed',
        amount: 30,
        duration: 30,
        description: 'Boost de croissance (30min)',
        emoji: '⚡',
      },
    ];
  }

  /**
   * Récupère l'état actuel des récompenses via la nouvelle edge function
   */
  static async getRewardState(userId: string): Promise<AdState> {
    try {
      const { data, error } = await supabase.functions.invoke('ad-rewards', {
        method: 'GET',
      });

      if (error) {
        console.error('Error fetching reward state:', error);
        return this.getDefaultState();
      }

      return {
        available: data.available,
        cooldownEnds: null,
        dailyCount: data.dailyCount,
        maxDaily: data.maxDaily,
        currentReward: null,
        timeUntilNext: data.timeUntilNext,
      };
    } catch (error) {
      console.error('Error getting reward state:', error);
      return this.getDefaultState();
    }
  }

  private static getDefaultState(): AdState {
    return {
      available: false,
      cooldownEnds: null,
      dailyCount: 0,
      maxDaily: 5,
      currentReward: null,
      timeUntilNext: 0,
    };
  }

  /**
   * Réclame une récompense via la nouvelle edge function unifiée
   * Même logique pour premium et normal : limite 5/jour identique
   */
  static async claimReward(
    reward: AdReward,
    isPremium: boolean = false,
    skipIncrement: boolean = false
  ): Promise<{
    success: boolean;
    sessionId?: string;
    error?: string;
    dailyCount?: number;
  }> {
    try {
      const { data, error } = await supabase.functions.invoke('ad-rewards', {
        method: 'POST',
        body: {
          reward_type: reward.type,
          reward_amount: reward.amount,
          is_premium: isPremium,
          skip_increment: skipIncrement,
        },
      });

      if (error || !data?.success) {
        return {
          success: false,
          error: data?.error || error?.message || 'Claim failed',
          dailyCount: data?.dailyCount,
        };
      }

      return {
        success: true,
        sessionId: data.sessionId,
        dailyCount: data.dailyCount,
      };
    } catch (error) {
      console.error('Error claiming reward:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Force le rechargement des récompenses pour un niveau donné
   */
  static async forceReloadRewards(playerLevel: number): Promise<AdReward[]> {
    AdCacheService.clearRewardsCache(playerLevel);
    console.log(
      `[UnifiedRewardService] 🔄 Cache forcé pour niveau ${playerLevel}`
    );
    return this.getAvailableRewards(playerLevel);
  }

  /**
   * Nettoie tout le cache des récompenses
   */
  static clearAllRewardsCache(): void {
    AdCacheService.clearAllRewardsCache();
    console.log('[UnifiedRewardService] 🗑️ Cache complet nettoyé');
  }
}
