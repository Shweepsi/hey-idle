import { useUpgrades } from '@/hooks/useUpgrades';
import { useGameData } from '@/hooks/useGameData';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
import { useGameMultipliers } from '@/hooks/useGameMultipliers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, Gem, Lock, CheckCircle, Loader2, TrendingUp, Zap, Star } from 'lucide-react';
import { LevelUpgrade } from '@/types/upgrades';
import { MINIMUM_COINS_RESERVE } from '@/constants';
import { useNavigate } from 'react-router-dom';
export const UpgradesPage = () => {
  const navigate = useNavigate();
  const {
    data: gameData
  } = useGameData();
  const {
    upgradesLoading,
    purchaseUpgrade,
    isUpgradePurchased,
    getSequentialUpgrades,
    getCategoryProgress,
    getCategoryDisplayName,
    getCategoryTiers,
    isPurchasing,
    playerUpgrades
  } = useUpgrades();
  const { getCompleteMultipliers } = useGameMultipliers();
  const multipliers = getCompleteMultipliers();
  
  const playerLevel = gameData?.garden?.level || 1;
  const coins = gameData?.garden?.coins || 0;
  const gems = gameData?.garden?.gems || 0;

  // Gestion du bouton retour Android
  useAndroidBackButton(true, () => {
    navigate('/garden');
  });

  // Obtenir les améliorations par catégorie et les infos de progression
  const sequentialUpgrades = getSequentialUpgrades();
  const categoryProgress = getCategoryProgress();

  // Fonction pour mapper les effect_types vers des catégories communes
  const getCategoryKey = (effectType: string) => {
    switch (effectType) {
      case 'auto_harvest':
      case 'robot_level':
        return 'automatisation';
      default:
        return effectType;
    }
  };

  // Grouper les améliorations par catégorie commune
  const upgradesByCategory = sequentialUpgrades.reduce((acc, upgrade) => {
    const categoryKey = getCategoryKey(upgrade.effect_type);
    if (!acc[categoryKey]) {
      acc[categoryKey] = [];
    }
    acc[categoryKey].push(upgrade);
    return acc;
  }, {} as Record<string, LevelUpgrade[]>);

  // Fonction pour obtenir le niveau actuel d'une catégorie (prochaine amélioration à acheter)
  const getCurrentUpgrade = (upgrades: LevelUpgrade[]) => {
    const sortedUpgrades = upgrades.sort((a, b) => a.level_required - b.level_required);
    // Trouver la première amélioration non achetée
    const nextUpgrade = sortedUpgrades.find(upgrade => !isUpgradePurchased(upgrade.id));
    return nextUpgrade || sortedUpgrades[sortedUpgrades.length - 1]; // Si tout est acheté, retourner la dernière
  };

  // Fonction pour obtenir le niveau actuel selon la catégorie
  const getCurrentLevel = (upgrades: LevelUpgrade[]) => {
    const categoryKey = getCategoryKey(upgrades[0].effect_type);
    
    if (categoryKey === 'automatisation') {
      // Pour l'automatisation, utiliser la même logique que EconomyService.getRobotLevel
      const hasAutoHarvest = playerUpgrades.some(upgrade => 
        upgrade.level_upgrades?.effect_type === 'auto_harvest'
      );
      
      if (!hasAutoHarvest) {
        return 0; // Pas de robot si auto harvest pas débloqué
      }
      
      let maxLevel = 1; // Niveau de base : autoharvest = niveau 1
      
      // Compter les améliorations robot_level achetées
      const robotUpgrades = playerUpgrades.filter(upgrade => 
        upgrade.level_upgrades?.effect_type === 'robot_level'
      );
      
      robotUpgrades.forEach(upgrade => {
        if (upgrade.level_upgrades?.effect_value && upgrade.level_upgrades.effect_value > maxLevel) {
          maxLevel = upgrade.level_upgrades.effect_value;
        }
      });
      
      return maxLevel;
    } else {
      // Pour les autres catégories, retourner le nombre d'améliorations achetées (commence à 0)
      const purchasedCount = upgrades.filter(upgrade => isUpgradePurchased(upgrade.id)).length;
      return purchasedCount;
    }
  };

  // Fonction pour vérifier si toutes les améliorations d'une catégorie sont achetées
  const isMaxLevel = (upgrades: LevelUpgrade[]) => {
    return upgrades.every(upgrade => isUpgradePurchased(upgrade.id));
  };
  const canPurchase = (upgrade: LevelUpgrade) => {
    const hasLevel = playerLevel >= upgrade.level_required;
    const hasCoins = coins >= upgrade.cost_coins + MINIMUM_COINS_RESERVE;
    const hasGems = gems >= upgrade.cost_gems;
    const notPurchased = !isUpgradePurchased(upgrade.id);
    return hasLevel && hasCoins && hasGems && notPurchased;
  };
  const getButtonState = (upgrade: LevelUpgrade) => {
    if (isUpgradePurchased(upgrade.id)) return {
      text: 'Acheté ✓',
      style: 'bg-green-600'
    };
    if (playerLevel < upgrade.level_required) return {
      text: 'Verrouillé',
      style: 'bg-gray-400'
    };
    if (coins < upgrade.cost_coins + MINIMUM_COINS_RESERVE) return {
      text: 'Pas assez de pièces',
      style: 'bg-red-400'
    };
    if (gems < upgrade.cost_gems) return {
      text: 'Pas assez de gemmes',
      style: 'bg-red-400'
    };
    if (isPurchasing) return {
      text: 'Achat...',
      style: 'bg-blue-400'
    };
    return {
      text: 'Acheter',
      style: 'bg-blue-600 hover:bg-blue-700'
    };
  };
  if (upgradesLoading) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="glassmorphism rounded-xl p-6">
          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* Content with proper bottom padding for navigation */}
      <div className="px-3 pb-8 space-y-3">
        {/* Bonus actifs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Card className="glassmorphism bg-gradient-to-br from-green-50/80 to-emerald-50/80">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">Récolte</span>
              </div>
              <div className="text-lg font-bold text-green-800">
                +{Math.round((multipliers.harvest - 1) * 100)}%
              </div>
            </CardContent>
          </Card>
          
          <Card className="glassmorphism bg-gradient-to-br from-blue-50/80 to-cyan-50/80">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Zap className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Vitesse</span>
              </div>
              <div className="text-lg font-bold text-blue-800">
                +{Math.round((multipliers.growth - 1) * 100)}%
              </div>
            </CardContent>
          </Card>
          
          <Card className="glassmorphism bg-gradient-to-br from-purple-50/80 to-pink-50/80">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Star className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-700">XP</span>
              </div>
              <div className="text-lg font-bold text-purple-800">
                +{Math.round((multipliers.exp - 1) * 100)}%
              </div>
            </CardContent>
          </Card>
          
          <Card className="glassmorphism bg-gradient-to-br from-violet-50/80 to-fuchsia-50/80">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Gem className="h-4 w-4 text-violet-600" />
                <span className="text-xs font-medium text-violet-700">Gemmes</span>
              </div>
              <div className="text-lg font-bold text-violet-800">
                {Math.round(multipliers.gemChance * 100)}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cartes évolutives par catégorie - plus compactes */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(upgradesByCategory).map(([categoryKey, upgrades]) => {
          const currentUpgrade = getCurrentUpgrade(upgrades);
          const currentLevel = getCurrentLevel(upgrades);
          const maxLevel = isMaxLevel(upgrades);
          const totalLevels = upgrades.length;
          const isPurchased = isUpgradePurchased(currentUpgrade.id);
          const isLocked = playerLevel < currentUpgrade.level_required;
          const canBuy = canPurchase(currentUpgrade);
          const buttonState = getButtonState(currentUpgrade);
          
          // Utiliser le display name basé sur l'effect_type du premier upgrade
          const displayName = getCategoryDisplayName(upgrades[0].effect_type);
          
          return <Card key={categoryKey} className={`glassmorphism relative overflow-hidden transition-all duration-500 hover:scale-105 ${maxLevel ? 'bg-gradient-to-br from-green-50/80 to-emerald-50/80 border-green-200 shadow-green-100' : canBuy ? 'bg-gradient-to-br from-blue-50/80 to-cyan-50/80 border-blue-200 shadow-blue-100 hover:shadow-blue-200' : isLocked ? 'bg-gradient-to-br from-gray-50/80 to-slate-50/80 border-gray-200 opacity-75' : 'bg-gradient-to-br from-orange-50/80 to-red-50/80 border-orange-200'}`}>
                {/* Indicateur de niveau en arrière-plan */}
                <div className="absolute top-2 right-2 z-0">
                  <div className={`text-6xl font-bold opacity-10 ${maxLevel ? 'text-green-600' : 'text-blue-600'}`}>
                    {maxLevel ? 'MAX' : currentLevel}
                  </div>
                </div>

                <CardHeader className="relative z-10 pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl drop-shadow-lg">{currentUpgrade.emoji}</span>
                      <div>
                        <CardTitle className="text-base text-green-800 font-bold">
                          {displayName}
                        </CardTitle>
                      </div>
                    </div>
                  </div>

                  {/* Barre de progression des niveaux */}
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 bg-white/50 rounded-full h-2 overflow-hidden">
                      <div className={`h-full transition-all duration-700 ${maxLevel ? 'bg-gradient-to-r from-green-400 to-emerald-500' : 'bg-gradient-to-r from-blue-400 to-cyan-500'}`} style={{
                    width: `${currentLevel / totalLevels * 100}%`
                  }} />
                    </div>
                    <Badge variant="outline" className={`text-xs font-bold ${maxLevel ? 'bg-green-100 text-green-700 border-green-300' : 'bg-blue-100 text-blue-700 border-blue-300'}`}>
                      {maxLevel ? 'MAX' : `${currentLevel}/${totalLevels}`}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="relative z-10 pt-0 pb-3">
                  {!maxLevel ? <>
                      {/* Titre du niveau actuel */}
                      <div className="text-center mb-3">
                        <h3 className="font-semibold text-gray-800 mb-1 text-sm">
                          {currentUpgrade.display_name}
                        </h3>
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                          Requis: Niveau {currentUpgrade.level_required}
                        </Badge>
                      </div>

                      {/* Coûts */}
                      <div className="flex justify-center gap-3 mb-3">
                        {currentUpgrade.cost_coins > 0 && <div className="flex items-center gap-1">
                            <Coins className="h-4 w-4 text-yellow-600" />
                            <span className={`font-bold text-sm ${coins >= currentUpgrade.cost_coins + MINIMUM_COINS_RESERVE ? 'text-green-600' : 'text-red-500'}`}>
                              {currentUpgrade.cost_coins.toLocaleString()}
                            </span>
                          </div>}
                        {currentUpgrade.cost_gems > 0 && <div className="flex items-center gap-1">
                            <Gem className="h-4 w-4 text-purple-600" />
                            <span className={`font-bold text-sm ${gems >= currentUpgrade.cost_gems ? 'text-green-600' : 'text-red-500'}`}>
                              {currentUpgrade.cost_gems.toLocaleString()}
                            </span>
                          </div>}
                      </div>

                      {/* Bouton d'achat compact */}
                      <Button size="sm" disabled={!canBuy || isPurchased || isPurchasing} onClick={() => purchaseUpgrade(currentUpgrade.id)} className={`w-full font-semibold text-xs py-1.5 transition-all duration-300 ${buttonState.style} ${canBuy ? 'hover:scale-105 hover:shadow-lg' : ''}`}>
                        {isPurchasing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : isLocked ? <Lock className="h-4 w-4 mr-2" /> : null}
                        {buttonState.text}
                      </Button>

                      {/* Message d'aide pour réserve */}
                      {!isPurchased && coins < currentUpgrade.cost_coins + MINIMUM_COINS_RESERVE && coins >= currentUpgrade.cost_coins && <p className="text-xs text-orange-600 mt-2 text-center animate-pulse">
                          💡 Gardez {MINIMUM_COINS_RESERVE} pièces de réserve
                        </p>}
                    </> : (/* Carte niveau maximum - plus compacte */
              <div className="text-center py-3">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-1 animate-[pulse_2s_ease-in-out_infinite]" />
                      <h3 className="font-bold text-green-800 text-sm mb-1">
                        Niveau Maximum Atteint!
                      </h3>
                      <p className="text-green-600 text-xs">
                        Vous avez débloqué toutes les améliorations de cette catégorie.
                      </p>
                    </div>)}
                </CardContent>

                {/* Effet de brillance pour les cartes disponibles */}
                {canBuy && !maxLevel && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 animate-pulse" />}
              </Card>;
        })}
        </div>

        {sequentialUpgrades.length === 0 && <div className="glassmorphism rounded-2xl p-8 text-center">
            <p className="text-green-700 text-lg">
              🎉 Toutes les améliorations disponibles ont été débloquées !
            </p>
            <p className="text-green-600 text-sm mt-2">
              Continuez à progresser pour débloquer de nouvelles améliorations.
            </p>
          </div>}
      </div>
    </div>
  );
};