import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useGameData } from '@/hooks/useGameData';
import { useUnifiedCalculations } from '@/hooks/useUnifiedCalculations';
import { ValidationCacheService } from '@/services/ValidationCacheService';
import { toast } from 'sonner';
import { MAX_PLOTS } from '@/constants';
import { useState, useEffect } from 'react';
import { useAnimations } from '@/contexts/AnimationContext';
import { logger } from '@/utils/logger';

export const useDirectPlanting = () => {
  const { user } = useAuth();
  const calculations = useUnifiedCalculations();
  const queryClient = useQueryClient();
  const { data: gameData } = useGameData();
  const [plantingPlotNumber, setPlantingPlotNumber] = useState<number | null>(null);
  const { triggerCoinAnimation } = useAnimations();

  // Cache plant types when gameData is available
  useEffect(() => {
    if (gameData?.plantTypes) {
      ValidationCacheService.cachePlantTypes(gameData.plantTypes);
    }
    if (gameData?.garden && gameData?.plots) {
      ValidationCacheService.cachePlayerData({
        garden: gameData.garden,
        plots: gameData.plots
      });
    }
  }, [gameData]);

  const plantDirectMutation = useMutation({
    mutationFn: async ({ plotNumber, plantTypeId, expectedCost }: {
      plotNumber: number;
      plantTypeId: string;
      expectedCost: number;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');

      setPlantingPlotNumber(plotNumber);

      // Basic validation
      if (!plotNumber || plotNumber < 1 || plotNumber > MAX_PLOTS) {
        throw new Error('Numéro de parcelle invalide');
      }

      logger.debug(`Optimized direct planting on plot ${plotNumber}`);

      // Smart validation using cache
      const cachedPlayerData = ValidationCacheService.getCachedPlayerData();
      const cachedPlantType = ValidationCacheService.getCachedPlantType(plantTypeId);

      let garden = cachedPlayerData?.garden;
      let plot = cachedPlayerData?.plots?.find((p: any) => p.plot_number === plotNumber);
      let plantType = cachedPlantType;

      // Only fetch from DB if cache miss or critical validation
      if (!garden || !plot || !plantType) {
        logger.debug('Cache miss, fetching from DB');
        const [plotResult, gardenResult, plantTypeResult] = await Promise.all([
          !plot ? supabase
            .from('garden_plots')
            .select('*')
            .eq('user_id', user.id)
            .eq('plot_number', plotNumber)
            .single() : { data: plot, error: null },
          !garden ? supabase
            .from('player_gardens')
            .select('*')
            .eq('user_id', user.id)
            .single() : { data: garden, error: null },
          !plantType ? supabase
            .from('plant_types')
            .select('*')
            .eq('id', plantTypeId)
            .single() : { data: plantType, error: null }
        ]);

        if (plotResult.error) throw new Error(`Plot error: ${plotResult.error.message}`);
        if (gardenResult.error) throw new Error(`Garden error: ${gardenResult.error.message}`);
        if (plantTypeResult.error) throw new Error('Plant type not found');

        plot = plotResult.data;
        garden = gardenResult.data;
        plantType = plantTypeResult.data;
      }

      // Quick client-side pre-validation for UX only; server is authoritative.
      if (!plot?.unlocked) throw new Error('Plot not unlocked');
      if (plot.plant_type || plot.planted_at) throw new Error('Plot already occupied');

      const playerLevel = garden.level || 1;
      const requiredLevel = plantType.level_required || 1;
      if (playerLevel < requiredLevel) throw new Error(`Level ${requiredLevel} required`);

      if (garden.coins < expectedCost) {
        throw new Error('Insufficient coins');
      }

      logger.debug(`Using atomic DB function for plot ${plotNumber}`);

      // Server computes cost + growth time from plant_types + upgrades.
      const { data: result, error } = await supabase.rpc('plant_direct_atomic', {
        p_user_id: user.id,
        p_plot_number: plotNumber,
        p_plant_type_id: plantTypeId
      });

      if (error) {
        logger.error('Atomic function error', error);
        throw new Error(`Planting failed: ${error.message}`);
      }

      // Type the result properly
      const typedResult = result as {
        success: boolean;
        error?: string;
        planted_at?: string;
        new_coin_balance?: number;
        plant_name?: string;
        cost?: number;
        growth_time_seconds?: number;
      };

      if (!typedResult.success) {
        throw new Error(typedResult.error || 'Planting failed');
      }

      logger.debug('Atomic planting successful', typedResult);

      ValidationCacheService.clearPlayerData();

      const serverCost = typedResult.cost ?? expectedCost;
      triggerCoinAnimation(-serverCost);

      return {
        plotNumber,
        plantTypeId,
        actualCost: serverCost,
        adjustedGrowthTime: typedResult.growth_time_seconds ?? (plantType.base_growth_seconds || 60),
        plantedAt: typedResult.planted_at || new Date().toISOString(),
        newCoinBalance: typedResult.new_coin_balance ?? ((garden.coins || 0) - serverCost)
      };
    },
    onMutate: async ({ plotNumber, plantTypeId, expectedCost }) => {
      logger.debug('Optimistic update enabled');
      
      // Cancel outgoing refetches so they don't override optimistic update
      await queryClient.cancelQueries({ queryKey: ['gameData', user?.id] });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(['gameData', user?.id]);
      
      // Optimistically update to new value
      if (previousData) {
        queryClient.setQueryData(['gameData', user?.id], (old: any) => {
          if (!old?.garden || !old?.plots) return old;
          
          const updatedPlots = old.plots.map((plot: any) => {
            if (plot.plot_number === plotNumber) {
              return {
                ...plot,
                plant_type: plantTypeId,
                planted_at: new Date().toISOString(),
                growth_time_seconds: old.plantTypes?.find((pt: any) => pt.id === plantTypeId)?.base_growth_seconds || 60,
                updated_at: new Date().toISOString()
              };
            }
            return plot;
          });
          
          return {
            ...old,
            garden: {
              ...old.garden,
              coins: old.garden.coins - expectedCost
            },
            plots: updatedPlots
          };
        });
      }
      
      return { previousData };
    },
    onSuccess: (data) => {
      // Confirmation serveur - forcer un refresh complet
      logger.debug('Plantation confirmed by server');
      
      // Invalider et refetch pour synchroniser avec la DB
      queryClient.invalidateQueries({ queryKey: ['gameData', user?.id] });
      
      // Réinitialiser l'état de plantation
      setPlantingPlotNumber(null);
    },
    onError: (error: any, variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousData) {
        queryClient.setQueryData(['gameData', user?.id], context.previousData);
      }
      
      logger.error('Error during direct planting', error);
      toast.error(error.message || 'Erreur lors de la plantation');
      
      // Réinitialiser l'état de plantation en cas d'erreur
      setPlantingPlotNumber(null);
    }
  });


  return {
    plantDirect: (plotNumber: number, plantTypeId: string, expectedCost: number) => 
      plantDirectMutation.mutate({ plotNumber, plantTypeId, expectedCost }),
    isPlanting: plantDirectMutation.isPending,
    isPlantingPlot: (plotNumber: number) => plantingPlotNumber === plotNumber,
    getActiveMultipliers: () => calculations.multipliers
  };
};