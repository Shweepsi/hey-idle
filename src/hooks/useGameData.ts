
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { useAchievements } from '@/hooks/useAchievements';
import { logger } from '@/utils/logger';

export const useGameData = () => {
  const { user } = useAuth();
  const { checkAchievementProgress } = useAchievements();

  // OPTIMISATION: Réduire les invalidations automatiques pour éviter les conflits avec les mises à jour optimistes
  // Les real-time subscriptions sont désactivées car nous gérons manuellement les mises à jour via optimistic updates

  // Periodic cache cleanup to prevent memory leaks (DISABLED)
  useEffect(() => {
    // Cache cleanup désactivé pour debugging
    // const cleanupInterval = setInterval(() => {
    //   UnifiedCalculationService.clearCache();
    // }, 300000); // Clean up every 5 minutes

    // return () => {
    //   clearInterval(cleanupInterval);
    // };
  }, []);

  return useQuery({
    queryKey: ['gameData', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      logger.debug('Fetching fresh game data for user', user.id);

      const [gardenResult, plotsResult, plantTypesResult] = await Promise.all([
        supabase.from('player_gardens').select('*').eq('user_id', user.id).single(),
        supabase.from('garden_plots').select('*').eq('user_id', user.id).order('plot_number'),
        supabase.from('plant_types').select('*')
      ]);

      const result = {
        garden: gardenResult.data,
        plots: plotsResult.data || [],
        plantTypes: plantTypesResult.data || [],
      };

      // LOG détaillé de l'état des parcelles pour debug
      logger.debug('Game data fetched - Plots status', 
        result.plots.map(p => ({
          plot: p.plot_number,
          unlocked: p.unlocked,
          plant_type: p.plant_type,
          planted_at: p.planted_at,
          isEmpty: p.plant_type === null && p.planted_at === null
        }))
      );

      // Check for achievements when data changes. Level-milestone gem
      // rewards are now awarded server-side inside harvest_plant_transaction.
      if (result.garden) {
        checkAchievementProgress(result.garden);
      }

      return result;
    },
    enabled: !!user?.id,
    // SIMPLIFIED: Remove complex calculations to avoid circular dependencies
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.plots) return 10000; // 10 seconds default
      
      // Check if there are growing plants (simplified without hooks)
      const growingPlants = data.plots.filter(plot => {
        if (!plot.planted_at || !plot.plant_type) return false;
        
        const plantType = data.plantTypes?.find(pt => pt.id === plot.plant_type);
        if (!plantType) return false;
        
        // Simple ready check without multipliers to avoid circular dependency
        const plantedAt = new Date(plot.planted_at).getTime();
        const now = Date.now();
        const baseGrowthTime = (plantType.base_growth_seconds || 60) * 1000;
        const timePassed = now - plantedAt;
        
        return timePassed < baseGrowthTime; // Still growing
      });
      
      // Reduce polling when no activity
      if (growingPlants.length === 0) {
        return 60000; // 1 minute if no plants growing
      }
      
      return 5000; // 5 seconds when plants are growing
    },
    // PHASE 1: Ultra-reactive for rewards with dynamic stale time
    structuralSharing: true,
    staleTime: 0, // 0ms pour une réactivité instantanée après récompenses
    // Garder les données en cache plus longtemps
    gcTime: 300000, // 5 minutes
  });
};
