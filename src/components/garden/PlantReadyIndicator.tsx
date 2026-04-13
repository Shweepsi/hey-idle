import { memo } from 'react';
import { Gift, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PlantReadyIndicatorProps {
  isReady: boolean;
  onHarvest: () => void;
  onWatchAd?: () => void;
  canWatchAd?: boolean;
  className?: string;
}

export const PlantReadyIndicator = memo(
  ({
    isReady,
    onHarvest,
    onWatchAd,
    canWatchAd = false,
    className = '',
  }: PlantReadyIndicatorProps) => {
    if (!isReady) return null;

    return (
      <div className={`space-y-2 ${className}`}>
        {/* Indicateur principal de récolte - plus statique */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-400 text-white px-3 py-1.5 rounded-full mobile-text-xs font-medium shadow-lg">
          ✨ Prête à récolter !
        </div>

        {/* Boutons d'action */}
        <div className="flex gap-2 justify-center">
          {/* Bouton récolte normale */}
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation(); // Empêche la propagation pour éviter un double déclenchement
              onHarvest();
            }}
            className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white mobile-text-xs px-3 py-1 h-auto rounded-full shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <Gift className="h-3 w-3 mr-1" />
            Récolter
          </Button>

          {/* Bouton publicité si disponible */}
          {canWatchAd && onWatchAd && (
            <Button
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onWatchAd();
              }}
              className="bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600 text-white mobile-text-xs px-3 py-1 h-auto rounded-full shadow-lg transform hover:scale-105 active:scale-95 transition-all duration-200"
            >
              <Play className="h-3 w-3 mr-1" />
              Pub x2
            </Button>
          )}
        </div>
      </div>
    );
  }
);

PlantReadyIndicator.displayName = 'PlantReadyIndicator';
