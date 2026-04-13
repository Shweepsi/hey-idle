import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGameMultipliers } from '@/hooks/useGameMultipliers';
import { useAnimations } from '@/contexts/AnimationContext';
import { useGameData } from '@/hooks/useGameData';
import { UnifiedCalculationService } from '@/services/UnifiedCalculationService';
import { toast } from 'sonner';
import { useEffect, useCallback } from 'react';
import { logger } from '@/utils/logger';
import { ROBOT_MAX_ACCUMULATION_HOURS } from '@/constants';

export const usePassiveIncomeRobot = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { getPermanentMultipliersOnly } = useGameMultipliers();
  const { data: gameData } = useGameData();
  const { triggerCoinAnimation } = useAnimations();
  /**
   * Affiche une erreur liée au robot.
   * – En développement : toast visuel + stack complète pour faciliter le debug.
   * – En production   : simple warning dans la console afin d'éviter de
   *                     polluer l'expérience utilisateur (une nouvelle
   *                     collecte règle généralement le problème).
   */
  const showRobotError = (message: string) => {
    if (import.meta.env.DEV) {
      toast.error(message);
    } else {
      // Log minimal pour monitoring sans alerter l'utilisateur final.
      logger.debug(`[Robot] ${message}`);
    }
  };

  // Récupérer les améliorations du joueur
  const { data: playerUpgrades = [] } = useQuery({
    queryKey: ['playerUpgrades', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from('player_upgrades')
        .select(
          `
          *,
          level_upgrades(*)
        `
        )
        .eq('user_id', user.id)
        .eq('active', true);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Vérifier si l'amélioration robot passif est débloquée
  const hasPassiveRobot = playerUpgrades.some(
    (upgrade) => upgrade.level_upgrades?.effect_type === 'auto_harvest'
  );

  // Calculer le niveau du robot et la plante correspondante
  const robotLevel = UnifiedCalculationService.getRobotLevel(playerUpgrades);
  const robotPlantLevel = Math.max(1, Math.min(robotLevel, 10));

  // Récupérer la plante correspondant au niveau du robot
  const { data: robotPlantType } = useQuery({
    queryKey: ['robotPlantType', robotPlantLevel],
    queryFn: async () => {
      const { data: plantType } = await supabase
        .from('plant_types')
        .select('*')
        .eq('level_required', robotPlantLevel)
        .maybeSingle();

      return plantType;
    },
    enabled: hasPassiveRobot && robotPlantLevel > 0,
  });

  // Récupérer l'état du robot passif
  const { data: robotState } = useQuery({
    queryKey: ['passiveRobotState', user?.id],
    queryFn: async () => {
      if (!user?.id || !hasPassiveRobot) return null;

      const { data: garden } = await supabase
        .from('player_gardens')
        .select('robot_last_collected, robot_accumulated_coins')
        .eq('user_id', user.id)
        .single();

      return {
        lastCollected: garden?.robot_last_collected || new Date().toISOString(),
        accumulatedCoins: garden?.robot_accumulated_coins || 0,
        robotLevel,
      };
    },
    enabled: !!user?.id && hasPassiveRobot,
  });

  // Calcul du revenu passif en temps réel
  const getCoinsPerMinute = () => {
    if (!hasPassiveRobot || !robotPlantType) return 0;

    // Utiliser UNIQUEMENT les multiplicateurs permanents (pas les boosts publicitaires)
    const permanentMultipliers = getPermanentMultipliersOnly();
    const permanentMultiplier = gameData?.garden?.permanent_multiplier || 1;

    // Appeler directement le service avec les multiplicateurs permanents
    return UnifiedCalculationService.getRobotPassiveIncome(
      robotLevel,
      permanentMultipliers.harvest, // Multiplicateur de récolte permanent uniquement
      permanentMultiplier
    );
  };

  // Synchroniser le robot avec son niveau quand il change
  useEffect(() => {
    if (!gameData?.garden) return;

    const currentRobotLevel =
      UnifiedCalculationService.getRobotLevel(playerUpgrades);

    // Vérifier si le robot_level dans la DB correspond au niveau calculé
    if (gameData.garden.robot_level !== currentRobotLevel) {
      logger.debug(
        `Robot level sync: ${gameData.garden.robot_level} -> ${currentRobotLevel}`
      );
      // La synchronisation sera automatique grâce au trigger
    }
  }, [gameData?.garden, playerUpgrades]);

  // First activation logic: handled server-side by collect_robot_income_atomic
  // (stamps robot_last_collected when NULL). Trigger it once on first unlock.
  useEffect(() => {
    if (!user?.id || !gameData?.garden || !hasPassiveRobot) return;
    if (gameData.garden.robot_last_collected !== null) return;

    logger.debug('First robot activation detected - calling RPC');
    supabase
      .rpc('collect_robot_income_atomic', { p_user_id: user.id })
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['gameData'] });
        queryClient.invalidateQueries({ queryKey: ['passiveRobotState'] });
      })
      .catch((error) => logger.error('Error on first robot activation', error));
  }, [user?.id, gameData?.garden, hasPassiveRobot, queryClient]);

  // Calcul de l'accumulation totale disponible (simplifié pour éviter le double calcul)
  const calculateCurrentAccumulation = useCallback(() => {
    // Return 0 if robot is not unlocked or has never been activated (robot_last_collected is null)
    if (
      !hasPassiveRobot ||
      !robotState ||
      !robotPlantType ||
      !robotState.lastCollected
    )
      return 0;

    const coinsPerMinute = getCoinsPerMinute();
    const now = new Date();
    const lastCollected = new Date(robotState.lastCollected);
    const minutesElapsed = Math.floor(
      (now.getTime() - lastCollected.getTime()) / (1000 * 60)
    );

    // Vérification de sécurité : limite configurable d'accumulation
    const maxMinutes = ROBOT_MAX_ACCUMULATION_HOURS * 60;
    const safeMinutesElapsed = Math.min(minutesElapsed, maxMinutes);

    // Garde-fou : si l'écart est anormalement grand, utiliser seulement l'accumulation stockée
    if (safeMinutesElapsed > maxMinutes || minutesElapsed < 0) {
      logger.warn(
        `Abnormal time gap detected: ${minutesElapsed}min, using stored accumulation only`
      );
      return robotState.accumulatedCoins;
    }

    // Calcul UNIQUEMENT des nouveaux revenus depuis la dernière collecte
    const freshAccumulation = safeMinutesElapsed * coinsPerMinute;
    const storedCoins = robotState.accumulatedCoins;
    const totalAccumulation = storedCoins + freshAccumulation;
    const maxAccumulation = coinsPerMinute * maxMinutes;

    return Math.min(totalAccumulation, maxAccumulation);
  }, [hasPassiveRobot, robotState, robotPlantType, getCoinsPerMinute]);

  // Calculer les récompenses hors-ligne basées sur l'accumulation
  const calculateOfflineRewards = async () => {
    if (!user?.id || !hasPassiveRobot || !robotPlantType) return null;

    const { data: garden } = await supabase
      .from('player_gardens')
      .select('last_played, robot_last_collected')
      .eq('user_id', user.id)
      .single();

    if (!garden) return null;

    const lastPlayed = new Date(garden.last_played).getTime();
    const lastCollected = new Date(garden.robot_last_collected).getTime();
    const now = Date.now();

    // Prendre le plus récent entre last_played et robot_last_collected
    const startTime = Math.max(lastPlayed, lastCollected);
    const timeOffline = now - startTime;

    if (timeOffline <= 0) return null;

    const coinsPerMinute = getCoinsPerMinute();
    const minutesOffline = Math.floor(timeOffline / (1000 * 60));
    const maxMinutes = ROBOT_MAX_ACCUMULATION_HOURS * 60;
    const safeMinutesOffline = Math.min(minutesOffline, maxMinutes);

    const offlineCoins = safeMinutesOffline * coinsPerMinute;

    if (offlineCoins <= 0) return null;

    logger.debug(
      `Offline rewards: ${safeMinutesOffline}min × ${coinsPerMinute} = ${offlineCoins} coins`
    );

    return {
      offlineCoins,
      minutesOffline: safeMinutesOffline,
      plantName: robotPlantType.display_name,
      coinsPerMinute,
    };
  };

  // Mutation pour collecter les revenus accumulés (via server RPC)
  const collectAccumulatedCoinsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc(
        'collect_robot_income_atomic',
        {
          p_user_id: user.id,
        }
      );

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        collected?: number;
        exp_reward?: number;
        robot_level?: number;
        first_activation?: boolean;
      };

      if (!result.success) throw new Error(result.error || 'Collecte échouée');
      if (result.first_activation || (result.collected ?? 0) <= 0) return null;

      logger.debug(
        `Robot collection successful: ${result.collected} coins + ${result.exp_reward} EXP (level ${result.robot_level})`
      );
      return {
        totalAccumulated: result.collected!,
        expReward: result.exp_reward!,
      };
    },
    onSuccess: (result) => {
      if (result) {
        triggerCoinAnimation(result.totalAccumulated);
      }
      queryClient.invalidateQueries({ queryKey: ['gameData'] });
      queryClient.invalidateQueries({ queryKey: ['passiveRobotState'] });
      queryClient.invalidateQueries({ queryKey: ['playerUpgrades'] });
    },
    onError: (error: any) => {
      showRobotError(error.message || 'Erreur lors de la collecte');
    },
  });

  // Mutation pour réclamer les récompenses hors-ligne (via same server RPC)
  const claimOfflineRewardsMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase.rpc(
        'collect_robot_income_atomic',
        {
          p_user_id: user.id,
        }
      );

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        collected?: number;
        coins_per_minute?: number;
      };

      if (!result.success)
        throw new Error(result.error || 'Réclamation échouée');
      if ((result.collected ?? 0) <= 0) return null;

      return {
        offlineCoins: result.collected!,
        coinsPerMinute: result.coins_per_minute ?? 0,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passiveRobotState'] });
      queryClient.invalidateQueries({ queryKey: ['gameData'] });
    },
    onError: (error: any) => {
      showRobotError(error.message || 'Erreur lors de la réclamation');
    },
  });

  // Synchronisation du timestamp robot via RPC (collecte + reset)
  const syncRobotTimestamp = async () => {
    if (!user?.id || !hasPassiveRobot) return;
    logger.debug('Robot timestamp sync via RPC');
    try {
      await supabase.rpc('collect_robot_income_atomic', { p_user_id: user.id });
      queryClient.invalidateQueries({ queryKey: ['passiveRobotState'] });
    } catch (error) {
      logger.error('Error syncing robot timestamp', error);
    }
  };

  // Calculer si le maximum d'accumulation est atteint
  const maxAccumulationReached = (() => {
    const coinsPerMin = getCoinsPerMinute();
    const maxAcc = coinsPerMin * ROBOT_MAX_ACCUMULATION_HOURS * 60;
    return calculateCurrentAccumulation() >= maxAcc;
  })();

  return {
    hasPassiveRobot,
    robotState,
    robotPlantType,
    coinsPerMinute: getCoinsPerMinute(),
    currentAccumulation: calculateCurrentAccumulation(),
    robotLevel,
    maxAccumulationReached,
    collectAccumulatedCoins: () => collectAccumulatedCoinsMutation.mutate(),
    collectAccumulatedCoinsAsync: () =>
      collectAccumulatedCoinsMutation.mutateAsync(),
    claimOfflineRewards: () => claimOfflineRewardsMutation.mutate(),
    calculateOfflineRewards,
    syncRobotTimestamp,
    isCollecting: collectAccumulatedCoinsMutation.isPending,
    isClaimingRewards: claimOfflineRewardsMutation.isPending,
  };
};
