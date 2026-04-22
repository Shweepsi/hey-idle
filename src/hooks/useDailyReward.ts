import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { DailyRewardService } from '@/services/DailyRewardService';
import { useGameData } from '@/hooks/useGameData';

export const useDailyReward = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: gameData } = useGameData();

  const todayUtc = new Date().toISOString().slice(0, 10);
  // Cast: auto-generated Supabase types are stale re: economy-v2 columns.
  const gardenV2 = gameData?.garden as
    | (typeof gameData extends { garden: infer G } ? G : never)
    | null
    | undefined;
  const lastClaim =
    (gardenV2 as { last_daily_claim_date?: string | null } | null | undefined)
      ?.last_daily_claim_date ?? null;
  const dailyStreak =
    (gardenV2 as { daily_streak?: number } | null | undefined)?.daily_streak ?? 0;
  const canClaim = !lastClaim || lastClaim < todayUtc;

  const claimMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Non authentifié');
      return DailyRewardService.claim(user.id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['gameData', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['activeBoosts', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['economySnapshot', user?.id] });

      const parts: string[] = [];
      if (result.reward_coins > 0) parts.push(`+${result.reward_coins.toLocaleString()} pièces`);
      if (result.reward_gems > 0)  parts.push(`+${result.reward_gems} gemmes`);
      if (result.boost_type)       parts.push(`${result.boost_type} ×${result.boost_value} (${result.boost_minutes}min)`);

      toast.success(`Récompense du jour ${result.streak_day} récupérée !`, {
        description: `Série : ${result.streak} jour(s). ${parts.join(' • ')}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Réclamation impossible', { description: error.message });
    },
  });

  return {
    canClaim,
    streak: dailyStreak,
    lastClaimDate: lastClaim,
    claim: claimMutation.mutate,
    isClaiming: claimMutation.isPending,
    cycle: DailyRewardService.getCycle(),
  };
};
