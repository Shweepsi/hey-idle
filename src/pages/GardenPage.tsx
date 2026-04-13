import { useEffect } from 'react';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
import { useNavigate } from 'react-router-dom';
import { PlotGrid } from '@/components/garden/PlotGrid';
import { useRefactoredGame } from '@/hooks/useRefactoredGame';
import { GardenClockProvider } from '@/contexts/GardenClockContext';

export const GardenPage = () => {
  const navigate = useNavigate();
  const { gameState, harvestPlant, unlockPlot } = useRefactoredGame();

  // Gestion du bouton retour Android : rester sur le jardin
  useAndroidBackButton(true, () => {
    navigate('/garden');
  });

  useEffect(() => {
    // Réinitialiser le scroll en haut de la page
    window.scrollTo(0, 0);

    // Bloquer le scroll sur cette page
    document.body.style.overflow = 'hidden';

    // Nettoyer en quittant la page
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <GardenClockProvider>
      <div className="h-full overflow-hidden">
        {/* Content without header */}
        <div className="px-3 pb-6 space-y-3 h-full overflow-y-auto">
          <PlotGrid
            plots={gameState.plots}
            plantTypes={gameState.plantTypes}
            coins={gameState.garden?.coins || 0}
            onHarvestPlant={harvestPlant}
            onUnlockPlot={unlockPlot}
          />
        </div>
      </div>
    </GardenClockProvider>
  );
};
