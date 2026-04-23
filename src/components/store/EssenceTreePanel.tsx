import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check } from 'lucide-react';
import { useEssenceUpgrades } from '@/hooks/useEssenceUpgrades';
import { useGameData } from '@/hooks/useGameData';

/**
 * Essence meta-upgrade tree. Purchases are permanent; they survive prestige.
 * Costs escalate per-level (base + level * perLevel). Server enforces caps.
 */
export const EssenceTreePanel = () => {
  const { catalog, isLoading, purchase, isPurchasing } = useEssenceUpgrades();
  const { data: gameData } = useGameData();
  const essence = gameData?.garden?.essence ?? 0;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Chargement…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-pink-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-pink-700">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            Échos Éternels
          </div>
          <Badge
            variant="secondary"
            className="text-base bg-pink-100 text-pink-900"
          >
            ✨ {essence.toLocaleString()}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Améliorations permanentes payées avec l'essence. Elles survivent au
          prestige.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {catalog.map(({ def, currentLevel, nextCost }) => {
          const isMax = currentLevel >= def.max_level;
          const canAfford = essence >= nextCost;
          const effectPreview = describeEffect(def.id, def.effect_per_level, currentLevel);
          return (
            <div
              key={def.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-pink-100 bg-pink-50/50 p-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">{def.emoji}</span>
                  <span className="font-semibold">{def.display_name}</span>
                  <Badge variant="outline" className="text-xs">
                    Niv. {currentLevel} / {def.max_level}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {def.description}
                </p>
                {effectPreview && (
                  <p className="mt-1 text-xs text-emerald-700">
                    Actuel : {effectPreview}
                  </p>
                )}
              </div>
              <div className="text-right space-y-1 shrink-0">
                {isMax ? (
                  <Badge className="bg-emerald-100 text-emerald-900 flex items-center gap-1">
                    <Check className="h-3 w-3" /> Max
                  </Badge>
                ) : (
                  <>
                    <div className="text-xs text-pink-700 font-medium whitespace-nowrap">
                      ✨ {nextCost.toLocaleString()}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => purchase(def.id)}
                      disabled={!canAfford || isPurchasing}
                      variant={canAfford ? 'default' : 'secondary'}
                    >
                      {canAfford ? 'Acheter' : 'Insuffisant'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

function describeEffect(id: string, perLevel: number, level: number): string | null {
  if (level <= 0) return null;
  const total = perLevel * level;
  switch (id) {
    case 'start_coins':    return `+${Math.round(total).toLocaleString()} pièces de départ`;
    case 'harvest_boost':  return `+${(total * 100).toFixed(0)}% aux récoltes`;
    case 'robot_boost':    return `+${(total * 100).toFixed(0)}% au robot`;
    case 'growth_speed':   return `+${(total * 100).toFixed(0)}% vitesse de croissance`;
    case 'gem_chance':     return `+${(total * 100).toFixed(1)}% de chance de gemme`;
    case 'offline_cap':    return `+${Math.round(total)}h de plafond hors-ligne`;
    case 'start_plots':    return `+${Math.round(total)} parcelles conservées`;
    case 'essence_boost':  return `+${(total * 100).toFixed(0)}% d'essence au prestige`;
    default: return null;
  }
}
