import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlayerGarden } from '@/types/game';
import { Crown, Star, Zap, Sparkles, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import {
  prestigeCostCoins,
  prestigeCostGems,
  prestigeMultiplier,
  essenceEarned,
  MAX_PLOTS,
} from '@/economy/config';
import { useEconomySnapshot } from '@/hooks/useEconomySnapshot';

interface PrestigeSystemProps {
  garden: PlayerGarden;
  onPrestige: () => void;
}

export const PrestigeSystem = ({ garden, onPrestige }: PrestigeSystemProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { data: snapshot } = useEconomySnapshot();

  const prestigeLevel = garden.prestige_level || 0;
  const nextPrestige = prestigeLevel + 1;

  // Pull costs/rewards from the server snapshot when available; fall back to
  // client formulas so the UI never goes blank during fetch.
  const costCoins = snapshot?.prestige_preview.cost_coins ?? prestigeCostCoins(nextPrestige);
  const costGems = snapshot?.prestige_preview.cost_gems ?? prestigeCostGems(nextPrestige);
  const nextMultiplier =
    snapshot?.prestige_preview.next_multiplier ?? prestigeMultiplier(nextPrestige);
  const essenceReward =
    snapshot?.prestige_preview.essence_earned_if_prestige_now ??
    essenceEarned(
      garden.coins_earned_this_run ?? 0,
      1 + (snapshot?.essence_effects.essence_earn_bonus ?? 0),
    );
  const plotsKept = 4 + (snapshot?.essence_effects.start_plots_bonus ?? 0);
  const startingCoins = 100 + (snapshot?.essence_effects.start_coins_bonus ?? 0);

  const canPrestige =
    garden.coins >= costCoins && (garden.gems || 0) >= costGems;

  const handlePrestige = async () => {
    if (!canPrestige || isProcessing) return;
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.rpc('execute_prestige', {
        p_user_id: garden.user_id,
      });
      if (error) throw new Error(error.message);
      const result = data as {
        success: boolean;
        error?: string;
        prestige_level?: number;
        permanent_multiplier?: number;
        essence_earned?: number;
        starting_coins?: number;
        plots_kept?: number;
      };
      if (!result?.success) throw new Error(result?.error || 'Prestige échoué');

      toast.success(
        `🎉 Prestige ${result.prestige_level} ! Multiplicateur ×${result.permanent_multiplier?.toFixed(2)}`,
        {
          description: `+${(result.essence_earned ?? 0).toLocaleString()} essence • ${result.plots_kept ?? 4} parcelles conservées • ${result.starting_coins ?? 100} pièces de départ`,
        }
      );
      onPrestige();
    } catch (error: any) {
      toast.error('Erreur lors du prestige', { description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-2 border-purple-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-700">
          <Crown className="h-6 w-6" />
          Système de Prestige
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            <span className="text-lg font-bold">Prestige {prestigeLevel}</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-purple-600">
            <Zap className="h-4 w-4" />
            <span className="font-semibold">
              Multiplicateur actuel : ×{(garden.permanent_multiplier || 1).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 text-pink-600">
            <Sparkles className="h-4 w-4" />
            <span className="font-semibold">
              Essence : {(garden.essence || 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-center">
            <h3 className="font-semibold text-purple-700 mb-2">
              Coût du Prestige {nextPrestige}
            </h3>
            <div className="flex justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-1">
                <span className="text-yellow-600">🪙</span>
                <span
                  className={`font-medium ${garden.coins >= costCoins ? 'text-green-600' : 'text-red-500'}`}
                >
                  {costCoins.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-purple-600">💎</span>
                <span
                  className={`font-medium ${(garden.gems || 0) >= costGems ? 'text-green-600' : 'text-red-500'}`}
                >
                  {costGems.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 space-y-1 text-sm">
            <div className="flex items-center justify-between text-purple-700">
              <span>Prochain multiplicateur</span>
              <strong>×{nextMultiplier.toFixed(2)}</strong>
            </div>
            <div className="flex items-center justify-between text-pink-700">
              <span>Essence gagnée</span>
              <strong>+{essenceReward.toLocaleString()} ✨</strong>
            </div>
            <div className="flex items-center justify-between text-emerald-700">
              <span>Pièces au retour</span>
              <strong>{startingCoins.toLocaleString()} 🪙</strong>
            </div>
            <div className="flex items-center justify-between text-emerald-700">
              <span>Parcelles conservées</span>
              <strong>{plotsKept} / {MAX_PLOTS}</strong>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-yellow-800">
              <div className="font-semibold mb-1">Attention !</div>
              <div>Le prestige remet une partie de votre progression à zéro :</div>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Niveau → 1, expérience → 0</li>
                <li>Pièces → {startingCoins}</li>
                <li>Améliorations → désactivées</li>
                <li>
                  Parcelles → seules les {plotsKept} premières restent débloquées
                </li>
              </ul>
              <div className="font-semibold mt-2 text-green-700">
                ✓ Vous gardez : multiplicateur permanent, essence (+{essenceReward}),
                et améliorations d'essence.
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handlePrestige}
          disabled={!canPrestige || isProcessing}
          variant={canPrestige ? 'default' : 'secondary'}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            'Prestige en cours...'
          ) : canPrestige ? (
            <>
              <Crown className="h-4 w-4 mr-2" />
              Effectuer le Prestige {nextPrestige}
            </>
          ) : (
            'Fonds insuffisants'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
