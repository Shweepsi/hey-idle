import { PlantType } from '@/types/game';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Coins, TrendingUp, Clock, Percent, Timer, Award } from 'lucide-react';
import { useUnifiedCalculations } from '@/hooks/useUnifiedCalculations';
import { useGameData } from '@/hooks/useGameData';
import { useGameMultipliers } from '@/hooks/useGameMultipliers';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
interface PlantSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  plotNumber: number;
  plantTypes: PlantType[];
  coins: number;
  onPlantDirect: (
    plotNumber: number,
    plantTypeId: string,
    cost: number
  ) => void;
}
export const PlantSelector = ({
  isOpen,
  onClose,
  plotNumber,
  plantTypes,
  coins,
  onPlantDirect,
}: PlantSelectorProps) => {
  const calculations = useUnifiedCalculations();
  const { data: gameData } = useGameData();
  const { getCompleteMultipliers } = useGameMultipliers();
  const playerLevel = gameData?.garden?.level || 1;
  const permanentMultiplier = gameData?.garden?.permanent_multiplier || 1;

  useAndroidBackButton(isOpen, onClose);

  // Obtenir les multiplicateurs complets (permanent + boosts)
  const multipliers = getCompleteMultipliers();
  const getPlantCost = (plantType: PlantType): number => {
    const baseCost = calculations.getPlantDirectCost(
      plantType.level_required || 1
    );
    return Math.floor(baseCost * multipliers.plantCostReduction);
  };
  const getPlantBaseCost = (plantType: PlantType): number => {
    return calculations.getPlantDirectCost(plantType.level_required || 1);
  };
  const getPlantReward = (plantType: PlantType): number => {
    const mockPlot = {
      growth_time_seconds: plantType.base_growth_seconds || 60,
    } as any;
    return calculations.calculateHarvestReward(
      plantType.level_required || 1,
      mockPlot,
      playerLevel,
      permanentMultiplier
    );
  };
  const getAdjustedGrowthTime = (baseGrowthSeconds: number): number => {
    return Math.floor(baseGrowthSeconds / multipliers.growth);
  };
  const formatGrowthTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}min`;
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  };
  const handlePlantClick = (plantTypeId: string, cost: number) => {
    // Fermer immédiatement pour une meilleure réactivité
    onClose();
    // Lancer la plantation après fermeture
    onPlantDirect(plotNumber, plantTypeId, cost);
  };

  // Filtrer les plantes selon le niveau du joueur
  const availablePlants = plantTypes
    .filter((plant) => playerLevel >= (plant.level_required || 1))
    .sort((a, b) => (a.level_required || 1) - (b.level_required || 1));
  const lockedPlants = plantTypes
    .filter((plant) => playerLevel < (plant.level_required || 1))
    .sort((a, b) => (a.level_required || 1) - (b.level_required || 1));
  // Bouton retour
  useAndroidBackButton(isOpen, onClose);
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[90vh] h-[90dvh] overflow-hidden bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 p-0 [&>button]:hidden">
        {/* Contenu scrollable */}
        <ScrollArea className="flex-1 px-4 pb-4 pt-4">
          <div className="space-y-4">
            {/* Plantes disponibles */}
            {availablePlants.length > 0 && (
              <div>
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {availablePlants.map((plantType) => {
                    const baseCost = getPlantBaseCost(plantType);
                    const adjustedCost = getPlantCost(plantType);
                    const reward = getPlantReward(plantType);
                    const profit = reward - adjustedCost;
                    const adjustedGrowthTime = getAdjustedGrowthTime(
                      plantType.base_growth_seconds
                    );
                    const canAfford = coins >= adjustedCost;
                    const hasCostReduction = multipliers.plantCostReduction < 1;
                    // Un multiplicateur de croissance > 1 signifie une croissance plus rapide (temps réduit),
                    // donc on considère qu'il y a un bonus si la valeur est STRICTEMENT supérieure à 1.
                    const hasGrowthBonus = multipliers.growth > 1;
                    return (
                      <Card
                        key={plantType.id}
                        className={`cursor-pointer transition-all duration-300 border-2 ${canAfford ? 'bg-gradient-to-br from-white to-green-50 hover:from-green-50 hover:to-green-100 border-green-300 hover:border-green-400 hover:shadow-lg hover:scale-105' : 'bg-gradient-to-br from-gray-50 to-gray-100 opacity-60 border-gray-200'}`}
                        onClick={() =>
                          canAfford
                            ? handlePlantClick(plantType.id, adjustedCost)
                            : null
                        }
                      >
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            {/* Header avec emoji et nom */}
                            <div className="text-center">
                              <div className="text-2xl mb-1 transform hover:scale-110 transition-transform">
                                {plantType.emoji}
                              </div>
                              <h4 className="font-bold text-xs text-gray-800 leading-tight">
                                {plantType.display_name}
                              </h4>
                            </div>

                            {/* Temps de croissance */}
                            <div className="bg-blue-50 rounded p-1.5 border border-blue-200">
                              <div className="flex items-center justify-center gap-1 text-blue-700">
                                <Clock className="h-2.5 w-2.5" />
                                <div className="text-xs font-medium">
                                  <span className="text-xs font-bold">
                                    {formatGrowthTime(adjustedGrowthTime)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Économie */}
                            <div className="space-y-1.5">
                              {/* Coût */}
                              <div className="bg-red-50 rounded p-1.5 border border-red-200">
                                <div className="flex items-center justify-center gap-1 text-red-700">
                                  <Coins className="h-2.5 w-2.5" />
                                  <div className="text-xs font-bold">
                                    {hasCostReduction ? (
                                      <div className="flex items-center gap-1">
                                        <span className="line-through text-gray-400 text-xs">
                                          -{baseCost.toLocaleString()}
                                        </span>
                                        <span className="text-red-700 text-xs">
                                          -{adjustedCost.toLocaleString()}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs">
                                        -{adjustedCost.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Gain */}
                              <div className="bg-green-50 rounded p-1.5 border border-green-200">
                                <div className="flex items-center justify-center gap-1 text-green-700">
                                  <TrendingUp className="h-2.5 w-2.5" />
                                  <div className="text-xs font-bold">
                                    +{reward.toLocaleString()}
                                  </div>
                                </div>
                              </div>

                              {/* Profit net */}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Plantes verrouillées */}
            {lockedPlants.length > 0 && (
              <div>
                <h3 className="text-base font-bold mb-3 text-gray-600 flex items-center gap-2">
                  <div className="w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center"></div>
                  Plantes verrouillées
                  <span className="text-sm font-normal text-gray-500">
                    ({lockedPlants.length})
                  </span>
                </h3>

                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                  {lockedPlants.map((plantType) => {
                    return (
                      <Card
                        key={plantType.id}
                        className="opacity-50 border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100"
                      >
                        <CardContent className="p-2">
                          <div className="text-center space-y-1">
                            <div className="text-xl grayscale">
                              {plantType.emoji}
                            </div>
                            <h4 className="font-medium text-xs text-gray-500 leading-tight">
                              {plantType.display_name}
                            </h4>
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-xs text-red-500 font-bold">
                                Niv.{plantType.level_required}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message si aucune plante */}
            {availablePlants.length === 0 && lockedPlants.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3"></div>
                <p className="text-base font-medium">
                  Aucune plante disponible
                </p>
                <p className="text-sm text-gray-400">
                  Débloquez de nouvelles plantes en montant de niveau
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
