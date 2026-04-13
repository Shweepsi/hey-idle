import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Coins, Sparkles, Zap } from 'lucide-react';
import { useGameData } from '@/hooks/useGameData';
import { usePassiveIncomeRobot } from '@/hooks/usePassiveIncomeRobot';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
import { ROBOT_MAX_ACCUMULATION_HOURS } from '@/constants';
interface PassiveIncomeRobotProps {
  isOpen: boolean;
  onClose: () => void;
}
export const PassiveIncomeRobot = ({
  isOpen,
  onClose,
}: PassiveIncomeRobotProps) => {
  // Bouton retour Android : fermer la modale
  useAndroidBackButton(isOpen, onClose);
  const { data: gameData } = useGameData();
  const {
    coinsPerMinute,
    currentAccumulation,
    collectAccumulatedCoins,
    collectAccumulatedCoinsAsync,
    isCollecting,
    robotLevel,
    robotPlantType,
    maxAccumulationReached,
  } = usePassiveIncomeRobot();
  const [realTimeAccumulation, setRealTimeAccumulation] = useState(0);

  // Mettre à jour l'accumulation en temps réel avec limite
  useEffect(() => {
    const maxAcc = coinsPerMinute * ROBOT_MAX_ACCUMULATION_HOURS * 60;
    setRealTimeAccumulation(currentAccumulation);

    if (coinsPerMinute > 0 && currentAccumulation < maxAcc) {
      const interval = setInterval(() => {
        setRealTimeAccumulation((prev) => {
          const newValue = prev + Math.round(coinsPerMinute / 60);
          return Math.min(newValue, maxAcc);
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [currentAccumulation, coinsPerMinute]);

  const handleCollectCoins = async () => {
    try {
      const result = await collectAccumulatedCoinsAsync();
      if (result) {
        setRealTimeAccumulation(0);
        onClose();
      }
    } catch (_) {
      // Erreur déjà gérée dans le hook, ne pas fermer la modale
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 max-h-[90vh] max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-green-800 flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              🤖
            </div>
            Robot de Revenus Passifs
          </DialogTitle>
          <div className="flex items-center justify-between">
            <p className="text-green-600 text-sm">
              Génère des pièces automatiquement en continu
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-green-100 text-green-700">
                Niveau {robotLevel}/10
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] max-h-[60dvh]">
          <div className="space-y-4 pr-4">
            {/* État actuel du robot */}
            {robotPlantType && (
              <div className="bg-green-100 border border-green-300 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="text-3xl">{robotPlantType.emoji}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-green-800 text-lg">
                      Robot actif: {robotPlantType.display_name}
                    </h3>
                    <p className="text-green-600 text-sm">
                      Génère {coinsPerMinute.toLocaleString()} 🪙/min
                    </p>
                  </div>
                </div>

                {/* Affichage des revenus accumulés */}
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Revenus accumulés</p>
                      <p className="text-2xl font-bold text-green-600 flex items-center gap-1">
                        <Coins className="h-5 w-5" />
                        {realTimeAccumulation.toLocaleString()}
                      </p>
                    </div>
                    <Button
                      onClick={handleCollectCoins}
                      disabled={realTimeAccumulation === 0 || isCollecting}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Collecter
                    </Button>
                  </div>
                  {realTimeAccumulation > 0 && (
                    <div className="mt-2 bg-green-50 rounded p-2">
                      <p className="text-xs text-green-600">
                        Maximum:{' '}
                        {(
                          coinsPerMinute *
                          ROBOT_MAX_ACCUMULATION_HOURS *
                          60
                        ).toLocaleString()}{' '}
                        🪙 ({ROBOT_MAX_ACCUMULATION_HOURS}h)
                        {maxAccumulationReached && (
                          <span className="text-orange-600 font-medium">
                            {' '}
                            - PLEIN!
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Action */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
