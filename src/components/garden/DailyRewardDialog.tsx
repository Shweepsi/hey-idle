import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Gift, Check, Clock, Zap } from 'lucide-react';
import { useDailyReward } from '@/hooks/useDailyReward';
import { DailyRewardService } from '@/services/DailyRewardService';
import type { DailyReward } from '@/economy/config';

/**
 * 7-day login streak dialog. Streak resets if a day is missed; reward set
 * loops every 7 days so long streaks stay meaningful without inflating rewards.
 */
export const DailyRewardDialog = () => {
  const { canClaim, streak, claim, isClaiming, cycle } = useDailyReward();
  const nextDay = DailyRewardService.nextStreakDay(streak);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant={canClaim ? 'default' : 'outline'}
          size="sm"
          className="gap-2"
        >
          <Gift className="h-4 w-4" />
          {canClaim ? 'Bonus du jour' : `Série : ${streak}j`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-emerald-600" />
            Récompense quotidienne
          </DialogTitle>
          <DialogDescription>
            Série actuelle : <strong>{streak} jour(s)</strong>. Un cycle dure 7
            jours puis recommence.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-7 gap-1.5 py-3">
          {cycle.map((reward) => {
            const isCurrent = reward.day === nextDay && canClaim;
            const isPast = reward.day < nextDay || (!canClaim && reward.day === nextDay);
            return (
              <div
                key={reward.day}
                className={`flex flex-col items-center rounded-md border p-1.5 text-center text-xs ${
                  isCurrent
                    ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300'
                    : isPast
                      ? 'border-muted-foreground/30 bg-muted/40 opacity-70'
                      : 'border-muted'
                }`}
              >
                <span className="font-semibold">J{reward.day}</span>
                <div className="h-6 flex items-center">
                  {reward.coins ? <span>🪙</span> : null}
                  {reward.gems ? <span>💎</span> : null}
                  {reward.boost ? <Zap className="h-3 w-3 text-amber-600" /> : null}
                </div>
                <span className="text-[10px] text-muted-foreground truncate w-full">
                  {reward.coins ? `${reward.coins.toLocaleString()}` : ''}
                  {reward.gems ? ` +${reward.gems}` : ''}
                  {reward.boost ? `×${reward.boost.value}` : ''}
                </span>
                {isPast && <Check className="h-3 w-3 text-emerald-600 mt-0.5" />}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={() => claim()}
            disabled={!canClaim || isClaiming}
            size="lg"
            className="w-full"
          >
            {canClaim ? (
              <>
                <Gift className="h-4 w-4 mr-2" />
                Récupérer (jour {nextDay})
              </>
            ) : (
              <>
                <Clock className="h-4 w-4 mr-2" />
                Revenez demain
              </>
            )}
          </Button>
          {!canClaim && (
            <Badge variant="secondary" className="mx-auto">
              Prochaine récompense : J{nextDay} ({describeReward(cycle[nextDay - 1])})
            </Badge>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function describeReward(reward: DailyReward | undefined): string {
  if (!reward) return '—';
  const parts: string[] = [];
  if (reward.coins) parts.push(`${reward.coins.toLocaleString()} pièces`);
  if (reward.gems) parts.push(`${reward.gems} gemmes`);
  if (reward.boost) parts.push(`boost ×${reward.boost.value}`);
  return parts.join(' + ') || '—';
}
