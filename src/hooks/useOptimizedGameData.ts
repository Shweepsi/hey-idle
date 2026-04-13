import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useCallback, useMemo } from 'react';

/**
 * Hook optimisé pour la gestion granulaire des données de jeu
 * Permet des mises à jour sélectives sans invalidation complète
 */
export const useOptimizedGameData = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Mise à jour optimisée d'une parcelle spécifique
  const updatePlotOptimistically = useCallback(
    (
      plotNumber: number,
      updates: {
        plant_type?: string | null;
        planted_at?: string | null;
        growth_time_seconds?: number | null;
      }
    ) => {
      queryClient.setQueryData(['gameData', user?.id], (old: any) => {
        if (!old) return old;

        return {
          ...old,
          plots: old.plots.map((plot: any) =>
            plot.plot_number === plotNumber
              ? { ...plot, ...updates, updated_at: new Date().toISOString() }
              : plot
          ),
        };
      });
    },
    [queryClient, user?.id]
  );

  // Mise à jour optimisée du jardin
  const updateGardenOptimistically = useCallback(
    (updates: {
      coins?: number;
      gems?: number;
      experience?: number;
      level?: number;
      total_harvests?: number;
    }) => {
      queryClient.setQueryData(['gameData', user?.id], (old: any) => {
        if (!old) return old;

        return {
          ...old,
          garden: {
            ...old.garden,
            ...updates,
            last_played: new Date().toISOString(),
          },
        };
      });
    },
    [queryClient, user?.id]
  );

  // Invalidation sélective pour des parties spécifiques
  const invalidateSelectively = useCallback(
    (
      target: 'plots' | 'garden' | 'boosts' | 'all' = 'all',
      refetchImmediate = false
    ) => {
      const baseOptions = { queryKey: ['gameData', user?.id] };
      const options = refetchImmediate
        ? baseOptions
        : { ...baseOptions, refetchType: 'none' as const };

      switch (target) {
        case 'plots':
        case 'garden':
        case 'boosts':
          // Pour l'instant, on invalide tout mais on peut étendre plus tard
          queryClient.invalidateQueries(options);
          break;
        case 'all':
        default:
          queryClient.invalidateQueries(options);
          break;
      }
    },
    [queryClient, user?.id]
  );

  // Récupération optimisée des données depuis le cache
  const getCachedGameData = useCallback(() => {
    return queryClient.getQueryData(['gameData', user?.id]) as any;
  }, [queryClient, user?.id]);

  // Récupération optimisée d'une parcelle spécifique
  const getCachedPlot = useCallback(
    (plotNumber: number) => {
      const gameData = getCachedGameData();
      return gameData?.plots?.find((p: any) => p.plot_number === plotNumber);
    },
    [getCachedGameData]
  );

  // Vérification si les données sont en cache et fraîches
  const isCacheValid = useMemo(() => {
    const queryState = queryClient.getQueryState(['gameData', user?.id]);
    return !!(queryState?.data && queryState.dataUpdatedAt > Date.now() - 5000); // 5s de fraîcheur
  }, [queryClient, user?.id]);

  return {
    updatePlotOptimistically,
    updateGardenOptimistically,
    invalidateSelectively,
    getCachedGameData,
    getCachedPlot,
    isCacheValid,
  };
};
