import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAchievements } from '@/hooks/useAchievements';
import { UnifiedCalculationService } from '@/services/UnifiedCalculationService';
import { logger } from '@/utils/logger';
import type { PlayerGarden, PlantType } from '@/types/game';

export const useGameData = () => {
  const { user } = useAuth();
  const { checkAchievementProgress } = useAchievements();

  return useQuery({
    queryKey: ['gameData', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      logger.debug('Fetching fresh game data for user', user.id);

      const [gardenResult, plotsResult, plantTypesResult] = await Promise.all([
        supabase
          .from('player_gardens')
          .select('*')
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('garden_plots')
          .select('*')
          .eq('user_id', user.id)
          .order('plot_number'),
        supabase.from('plant_types').select('*'),
      ]);

      // Cast garden row to our hand-written PlayerGarden type. The auto-gen
      // Supabase types are stale re: economy-v2 columns (essence, daily_streak
      // etc.), so we narrow once here instead of spraying casts across
      // consumers.
      const result = {
        garden: (gardenResult.data ?? null) as unknown as PlayerGarden | null,
        plots: plotsResult.data || [],
        // Normalise les colonnes nullables vers le type PlantType non-null,
        // avec les mêmes défauts que PlantTypesCache.
        plantTypes: (plantTypesResult.data || []).map(
          (p): PlantType => ({
            ...p,
            emoji: p.emoji ?? '🌱',
            rarity: p.rarity ?? 'common',
            level_required: p.level_required ?? 1,
          })
        ),
      };

      // LOG détaillé de l'état des parcelles pour debug
      logger.debug(
        'Game data fetched - Plots status',
        result.plots.map((p) => ({
          plot: p.plot_number,
          unlocked: p.unlocked,
          plant_type: p.plant_type,
          planted_at: p.planted_at,
          isEmpty: p.plant_type === null && p.planted_at === null,
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

      // Check if there are growing plants. Cadence-only: we mirror the
      // canonical UnifiedCalculationService (the server-authoritative harvest
      // decides the real reward). boost mult=1 keeps polling responsive — a
      // boosted plant becomes ready earlier, so erring on "still growing" only
      // means we keep the fast poll a bit longer, never the reverse.
      const growingPlants = data.plots.filter(
        (plot) =>
          !!plot.planted_at &&
          !!plot.plant_type &&
          !UnifiedCalculationService.isPlantReady(plot.planted_at, plot, 1)
      );

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
