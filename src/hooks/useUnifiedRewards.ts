import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { UnifiedRewardService } from '@/services/UnifiedRewardService';
import { usePremiumStatus } from './usePremiumStatus';
import { useGameData } from './useGameData';
import { formatDuration } from '@/lib/utils';
import { toast } from 'sonner';
import { AdMobSimpleService } from '@/services/ads/AdMobSimpleService';
import { AdRetryService } from '@/services/ads/AdRetryService';
import { AdPreloadService } from '@/services/ads/AdPreloadService';
import { AdEffectsService } from '@/services/ads/AdEffectsService';
import type { AdReward, AdState } from '@/types/ads';

const DEFAULT_MAX_DAILY = 5;

export const useUnifiedRewards = () => {
  const { user } = useAuth();
  const { isPremium } = usePremiumStatus();
  const { data: gameData } = useGameData();
  const [availableRewards, setAvailableRewards] = useState<AdReward[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [adLoading, setAdLoading] = useState(false); // État de chargement spécifique pour les pubs

  // Query pour récupérer l'état des récompenses via la nouvelle edge function
  const {
    data: rewardState,
    isLoading,
    refetch: refetchRewardState,
  } = useQuery({
    queryKey: ['unifiedRewardState', user?.id],
    queryFn: () => UnifiedRewardService.getRewardState(user?.id || ''),
    enabled: !!user,
    staleTime: 5 * 1000, // 5 secondes pour des données plus fraîches
    gcTime: 2 * 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  // Limite quotidienne de pubs — source unique pour tous les consommateurs.
  const maxDaily = rewardState?.maxDaily ?? DEFAULT_MAX_DAILY;
  const dailyCount = rewardState?.dailyCount ?? 0;
  const dailyLimitReached = !!rewardState && dailyCount >= maxDaily;

  // Charger les récompenses disponibles basées sur le niveau du joueur
  useEffect(() => {
    const loadAvailableRewards = async () => {
      if (!gameData?.garden?.level) return;

      setLoadingRewards(true);
      try {
        const rewards = await UnifiedRewardService.getAvailableRewards(
          gameData.garden.level
        );
        setAvailableRewards(rewards);
      } catch (error) {
        console.error('Error loading available rewards:', error);
        setAvailableRewards([]);
      } finally {
        setLoadingRewards(false);
      }
    };

    loadAvailableRewards();
  }, [gameData?.garden?.level]);

  // Initialisation d'AdMob et préchargement pour les utilisateurs non-premium
  useEffect(() => {
    if (!isPremium && user) {
      AdMobSimpleService.initialize();
      // Démarrer le préchargement automatique
      AdPreloadService.startBackgroundPreloading();
    }
  }, [isPremium, user]);

  const refreshState = useCallback(async () => {
    await refetchRewardState();
    // Forcer un reload des récompenses aussi
    if (gameData?.garden?.level) {
      const rewards = await UnifiedRewardService.forceReloadRewards(
        gameData.garden.level
      );
      setAvailableRewards(rewards);
    }
  }, [refetchRewardState, gameData?.garden?.level]);

  const formatTimeUntilNext = useCallback(
    (seconds: number): string => formatDuration(seconds),
    []
  );

  const getStatusMessage = useCallback((): string => {
    if (!user) return 'Connexion requise';
    if (!rewardState) return 'Chargement...';

    if (dailyLimitReached) {
      return `Limite quotidienne atteinte (${dailyCount}/${maxDaily})`;
    }
    if (isPremium) {
      return `Récompenses Premium disponibles (${dailyCount}/${maxDaily})`;
    }
    return `Publicités disponibles (${dailyCount}/${maxDaily})`;
  }, [user, rewardState, isPremium, dailyLimitReached, dailyCount, maxDaily]);

  const claimReward = async (
    rewardType: string,
    rewardAmount: number
  ): Promise<{ success: boolean; error?: string; message?: string }> => {
    if (!user) {
      return { success: false, error: 'Utilisateur non connecté' };
    }

    const reward: AdReward = {
      type: rewardType as AdReward['type'],
      amount: rewardAmount,
      description: `${rewardType} boost x${rewardAmount}min`,
      emoji:
        rewardType === 'coin_boost'
          ? '🚀'
          : rewardType === 'gem_boost'
            ? '💎'
            : '⚡',
    };

    try {
      if (isPremium) {
        // Utilisateur premium : réclamation directe via edge function
        // Don't skip increment for premium users (no ad callback)
        const result = await UnifiedRewardService.claimReward(
          reward,
          true,
          false
        );

        if (result.success) {
          // Get the reward config from database for accurate notification
          const rewardConfig = availableRewards.find(
            (r) => r.type === reward.type
          );
          toast.success(
            `${rewardConfig?.emoji || reward.emoji} ${rewardConfig?.description || reward.description} activé pour ${rewardConfig?.duration || 60} minutes`
          );
          await refreshState();
          return { success: true, message: 'Boost premium activé avec succès' };
        } else {
          toast.error('Erreur', {
            description: result.error || 'Erreur lors de la réclamation',
          });
          return { success: false, error: result.error };
        }
      } else {
        // Vérifier d'abord les limites quotidiennes
        if (!rewardState?.available || dailyLimitReached) {
          toast.error('Limite atteinte', {
            description: `Limite quotidienne atteinte (${dailyCount}/${maxDaily})`,
          });
          return { success: false, error: 'Limite quotidienne atteinte' };
        }

        // Utilisateur normal : regarder une publicité avec retry intelligent
        try {
          setAdLoading(true);

          const adResult = await AdRetryService.executeWithRetry(() =>
            AdMobSimpleService.showAd()
          );

          if (adResult.success && adResult.rewarded) {
            // Effet visuel immédiat
            AdEffectsService.triggerBoostActivation(reward);

            // Toast de progression
            toast('🎯 Publicité terminée ! Attribution de votre récompense...', {
              duration: 10000,
            });

            // Réclamer la récompense via l'edge function
            const result = await UnifiedRewardService.claimReward(
              reward,
              false,
              false
            );

            if (result.success) {
              const rewardConfig = availableRewards.find(
                (r) => r.type === reward.type
              );

              // Planifier le prochain préchargement
              AdPreloadService.scheduleNextPreload();

              // Toast de confirmation avec délai
              setTimeout(() => {
                toast.success(
                  `${rewardConfig?.emoji || reward.emoji} ${rewardConfig?.description || reward.description} activé pour ${rewardConfig?.duration || 60} minutes`
                );
              }, 2000);

              await refreshState();
              return {
                success: true,
                message: 'Publicité regardée et boost activé',
              };
            } else {
              console.error('Échec réclamation après publicité:', result.error);
              toast.error('Erreur de distribution', {
                description:
                  result.error ||
                  'Erreur lors de la distribution de la récompense',
              });
              return { success: false, error: result.error };
            }
          } else {
            toast.error('Publicité non complétée', {
              description:
                'Veuillez regarder la publicité entièrement pour recevoir la récompense',
            });
            return { success: false, error: 'Publicité non complétée' };
          }
        } catch (adError) {
          console.error('Erreur publicité:', adError);

          // Messages d'erreur explicites et actionables
          const errorInfo = AdRetryService.getActionableErrorMessage(
            adError as Error
          );
          toast.error(errorInfo.title, {
            description: `${errorInfo.message}${errorInfo.action ? `\n\n${errorInfo.action}` : ''}`,
          });
          return { success: false, error: errorInfo.message };
        }
      }
    } catch (error) {
      console.error('Error in claimReward:', error);
      toast.error('Erreur inattendue', {
        description: "Une erreur inattendue s'est produite",
      });
      return { success: false, error: 'Erreur inattendue' };
    } finally {
      setAdLoading(false); // DÉSACTIVER le spinner dans tous les cas
    }
  };

  return {
    // État unifié
    rewardState,
    availableRewards,
    loading: isLoading || loadingRewards || adLoading,
    dailyLimitReached,
    dailyCount,
    maxDaily,

    // Actions
    claimReward,
    refreshState,

    // Utilitaires
    formatTimeUntilNext,
    getStatusMessage,

    // Compatibilité legacy
    adState: rewardState,
    watchAd: claimReward,
  };
};
