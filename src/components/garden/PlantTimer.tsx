import { useMemo } from 'react';
import { useUnifiedCalculations } from '@/hooks/useUnifiedCalculations';
import { Clock } from 'lucide-react';
import { useGardenClock } from '@/contexts/GardenClockContext';

interface PlantTimerProps {
  plantedAt: string | null;
  growthTimeSeconds: number;
  plotNumber: number; // Added to get the actual plot data
  className?: string;
}

export const PlantTimer = ({
  plantedAt,
  growthTimeSeconds,
  plotNumber,
  className = '',
}: PlantTimerProps) => {
  const calculations = useUnifiedCalculations();
  const now = useGardenClock();

  const { timeRemaining, isReady } = useMemo(() => {
    if (!plantedAt) return { timeRemaining: 0, isReady: false };

    // UNIFIED CALCULATION: Use the same logic as backend
    const mockPlot = {
      growth_time_seconds: growthTimeSeconds,
      planted_at: plantedAt,
      plant_type: 'mock',
      id: 'mock',
      user_id: 'mock',
      plot_number: plotNumber,
      unlocked: true,
      plant_metadata: null,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as any;

    // Use shared clock to force recompute without local intervals
    void now;
    return {
      timeRemaining: calculations.getTimeRemaining(plantedAt, mockPlot),
      isReady: calculations.isPlantReady(plantedAt, mockPlot),
    };
  }, [plantedAt, growthTimeSeconds, plotNumber, calculations, now]);

  if (!plantedAt || isReady) return null;

  // Classes pour indiquer l'urgence du timer
  const urgencyClass =
    timeRemaining < 30
      ? 'text-warning-foreground font-semibold'
      : timeRemaining < 60
        ? 'text-warning'
        : 'text-muted-foreground';

  return (
    <div
      className={`flex items-center gap-1 text-xs transition-colors duration-300 ${urgencyClass} ${className}`}
    >
      <Clock className="h-3 w-3" />
      <span className="font-medium">
        {timeRemaining > 0
          ? timeRemaining < 60
            ? `${timeRemaining}s`
            : `${Math.floor(timeRemaining / 60)}m`
          : 'Prêt !'}
      </span>
    </div>
  );
};
