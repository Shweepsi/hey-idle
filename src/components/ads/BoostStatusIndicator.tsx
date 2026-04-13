import React from 'react';
import { useActiveBoosts } from '@/hooks/useActiveBoosts';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Zap, TrendingUp, Sparkles } from 'lucide-react';

interface BoostStatusIndicatorProps {
  showInline?: boolean;
  className?: string;
}

export function BoostStatusIndicator({
  showInline = false,
  className = '',
}: BoostStatusIndicatorProps) {
  const { boosts, getTimeRemaining, formatTimeRemaining } = useActiveBoosts();

  if (!boosts || boosts.length === 0) return null;

  const getBoostIcon = (effectType: string) => {
    switch (effectType) {
      case 'coin_boost':
        return '🪙';
      case 'gem_boost':
        return '💎';
      case 'growth_speed':
      case 'growth_boost':
        return '⚡';
      default:
        return '🎁';
    }
  };

  const getBoostLabel = (effectType: string, effectValue: number) => {
    switch (effectType) {
      case 'coin_boost':
        return `Pièces ×${effectValue}`;
      case 'gem_boost':
        return `Gemmes ×${effectValue}`;
      case 'growth_speed':
      case 'growth_boost':
        return `Croissance -${Math.round((1 - 1 / effectValue) * 100)}%`;
      default:
        return 'Boost actif';
    }
  };

  const getBoostColor = (effectType: string) => {
    switch (effectType) {
      case 'coin_boost':
        return 'from-orange-100 to-amber-100 border-orange-300 text-orange-700';
      case 'gem_boost':
        return 'from-purple-100 to-indigo-100 border-purple-300 text-purple-700';
      case 'growth_speed':
      case 'growth_boost':
        return 'from-green-100 to-emerald-100 border-green-300 text-green-700';
      default:
        return 'from-gray-100 to-slate-100 border-gray-300 text-gray-700';
    }
  };

  if (showInline) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-orange-500" />
          <span className="text-xs font-medium text-orange-700">
            Boosts actifs:
          </span>
        </div>
        <div className="flex gap-1">
          {boosts.slice(0, 3).map((boost) => (
            <TooltipProvider key={boost.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2 py-0.5 bg-gradient-to-r ${getBoostColor(boost.effect_type)} hover:shadow-sm transition-all cursor-help`}
                  >
                    <span className="mr-1">
                      {getBoostIcon(boost.effect_type)}
                    </span>
                    <span className="font-semibold">×{boost.effect_value}</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <p className="font-semibold">
                      {getBoostLabel(boost.effect_type, boost.effect_value)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeRemaining(getTimeRemaining(boost.expires_at))}{' '}
                      restant
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
          {boosts.length > 3 && (
            <Badge
              variant="outline"
              className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700"
            >
              +{boosts.length - 3}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center gap-2 text-orange-700">
          <Zap className="h-4 w-4" />
          <span className="text-sm font-semibold">
            Boosts actifs ({boosts.length})
          </span>
        </div>
        <div className="grid gap-2">
          {boosts.map((boost) => (
            <Tooltip key={boost.id}>
              <TooltipTrigger asChild>
                <div
                  className={`bg-gradient-to-r ${getBoostColor(boost.effect_type)} border rounded-lg px-3 py-2 cursor-help hover:shadow-sm transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {getBoostIcon(boost.effect_type)}
                      </span>
                      <span className="font-semibold text-sm">
                        {getBoostLabel(boost.effect_type, boost.effect_value)}
                      </span>
                    </div>
                    <span className="text-xs font-medium">
                      {formatTimeRemaining(getTimeRemaining(boost.expires_at))}
                    </span>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <p className="font-semibold">
                    {getBoostLabel(boost.effect_type, boost.effect_value)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expire dans{' '}
                    {formatTimeRemaining(getTimeRemaining(boost.expires_at))}
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
