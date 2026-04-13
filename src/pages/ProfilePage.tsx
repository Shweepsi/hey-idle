import { PrestigeSystem } from '@/components/garden/PrestigeSystem';
import { LadderModal } from '@/components/garden/LadderModal';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { useRefactoredGame } from '@/hooks/useRefactoredGame';
import { useAuth } from '@/hooks/useAuth';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
import { Button } from '@/components/ui/button';
import { Loader2, LogOut, Settings, Trophy } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
export const ProfilePage = () => {
  const navigate = useNavigate();
  const { gameState } = useRefactoredGame();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const [showLadder, setShowLadder] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Gestion du bouton retour Android
  useAndroidBackButton(true, () => {
    if (showLadder) {
      setShowLadder(false);
    } else if (showSettingsModal) {
      setShowSettingsModal(false);
    } else {
      navigate('/garden');
    }
  });
  const handlePrestige = () => {
    // Invalider les queries pour rafraîchir les données
    queryClient.invalidateQueries({
      queryKey: ['gameData'],
    });
  };

  // Calculer les statistiques
  const activePlants = gameState.plots.filter(
    (plot) => plot.plant_type && plot.planted_at
  ).length;
  const totalPlants = gameState.plantTypes.length;

  return (
    <div className="min-h-full">
      {/* Content with padding */}
      <div className="px-3 pb-6 space-y-4">
        {/* Carte des classements */}
        <div className="glassmorphism rounded-xl p-4 shadow-lg">
          <div className="space-y-3">
            <div>
              <h3 className="mobile-text-base font-semibold text-gray-800 mb-1">
                Classements
              </h3>
            </div>
            <Button
              onClick={() => setShowLadder(true)}
              variant="outline"
              size="lg"
              className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95 touch-target border-0"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Voir le Classement
            </Button>
          </div>
        </div>
        {/* Système de Prestige */}
        {gameState.garden && (
          <PrestigeSystem
            garden={gameState.garden}
            onPrestige={handlePrestige}
          />
        )}

        {/* Section Paramètres & Compte */}
        <div className="space-y-4">
          <div className="glassmorphism rounded-xl p-4 shadow-lg">
            <div className="space-y-3">
              <div>
                <h3 className="mobile-text-base font-semibold text-gray-800 mb-1">
                  Paramètres
                </h3>
              </div>
              <Button
                onClick={() => setShowSettingsModal(true)}
                variant="outline"
                size="lg"
                className="w-full bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95 touch-target border-0"
              >
                <Settings className="h-4 w-4 mr-2" />
                Ouvrir les Paramètres
              </Button>
            </div>
          </div>

          {/* Carte de déconnexion */}
          <div className="glassmorphism rounded-xl p-4 shadow-lg">
            <div className="space-y-3">
              <div>
                <h3 className="mobile-text-base font-semibold text-gray-800 mb-1">
                  Compte
                </h3>
              </div>

              <Button
                onClick={signOut}
                variant="destructive"
                size="lg"
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold shadow-lg transform transition-all duration-200 hover:scale-105 active:scale-95 touch-target"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Se déconnecter
              </Button>
            </div>
          </div>

          {/* Informations légales - Section discrète */}
          <div className="mt-8 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="flex justify-center items-center gap-2 text-xs text-gray-400">
                <button
                  onClick={() => navigate('/privacy')}
                  className="hover:text-gray-600 transition-colors"
                >
                  Confidentialité
                </button>
                <span>|</span>
                <button
                  onClick={() => navigate('/terms')}
                  className="hover:text-gray-600 transition-colors"
                >
                  Conditions
                </button>
                <span>|</span>
                <button
                  onClick={() => navigate('/about')}
                  className="hover:text-gray-600 transition-colors"
                >
                  À propos
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modale des classements */}
      <LadderModal isOpen={showLadder} onClose={() => setShowLadder(false)} />
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
};
