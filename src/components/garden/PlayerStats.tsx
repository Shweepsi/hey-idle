import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PlayerGarden } from '@/types/game';
import { Trophy, Star, Coins, TrendingUp, Clock, Target } from 'lucide-react';
import { PremiumBadge } from '@/components/premium/PremiumBadge';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
interface PlayerStatsProps {
  garden: PlayerGarden | null;
  totalPlants: number;
  activePlants: number;
}
export const PlayerStats = ({
  garden,
  totalPlants,
  activePlants,
}: PlayerStatsProps) => {
  const { isPremium } = usePremiumStatus();
  if (!garden) return null;

  // Calculer l'XP nécessaire pour le prochain niveau
  const getXpForLevel = (level: number) => {
    return Math.pow(level, 2) * 100;
  };
  const currentLevel = garden.level;
  const currentXp = garden.experience;
  const xpForCurrentLevel = getXpForLevel(currentLevel - 1);
  const xpForNextLevel = getXpForLevel(currentLevel);
  const xpProgress = currentXp - xpForCurrentLevel;
  const xpNeeded = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = Math.min((xpProgress / xpNeeded) * 100, 100);
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };
  return (
    <div className="space-y-6">
      {/* Niveau et Expérience avec Badge Premium */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-lg">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-blue-500" />
              Niveau {currentLevel}
              {isPremium && <PremiumBadge variant="compact" />}
            </div>
            <span className="text-sm font-normal text-muted-foreground">
              {Math.round(progressPercentage)}%
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {xpProgress.toLocaleString()} / {xpNeeded.toLocaleString()} XP
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Badge Premium si applicable */}
      {isPremium && (
        <Card className="border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-orange-500/5">
          <CardContent className="p-4 text-center">
            <PremiumBadge />
            <p className="text-xs text-muted-foreground mt-2">
              Merci pour votre soutien ! Profitez de vos avantages premium.
            </p>
          </CardContent>
        </Card>
      )}
      {/* Statistiques de jeu */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Trophy className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-yellow-600">
              {garden.total_harvests}
            </p>
            <p className="text-xs text-gray-600">Récoltes totales</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <Coins className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-yellow-600">{garden.coins}</p>
            <p className="text-xs text-gray-600">Pièces</p>
          </CardContent>
        </Card>
      </div>

      {/* Informations du compte */}
    </div>
  );
};
