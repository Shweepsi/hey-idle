import { Crown, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PremiumBadgeProps {
  variant?: 'default' | 'compact' | 'leaderboard';
  className?: string;
}

export const PremiumBadge = ({
  variant = 'default',
  className = '',
}: PremiumBadgeProps) => {
  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <Crown className="h-3 w-3 text-yellow-500 animate-pulse" />
      </div>
    );
  }

  if (variant === 'leaderboard') {
    return (
      <div className={`inline-flex items-center gap-1 ${className}`}>
        <Crown className="h-4 w-4 text-yellow-500" />
      </div>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={`bg-gradient-to-r from-yellow-500/10 to-orange-500/10 text-yellow-600 border-yellow-500/20 animate-pulse ${className}`}
    >
      <Crown className="h-4 w-4 mr-1" />
      <Sparkles className="h-3 w-3 mr-1" />
      Premium
    </Badge>
  );
};
