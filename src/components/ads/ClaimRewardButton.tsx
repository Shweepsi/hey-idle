import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Gift, Crown, Loader2, AlertCircle } from 'lucide-react';
import { useUnifiedRewards } from '@/hooks/useUnifiedRewards';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { UnifiedRewardModal } from './UnifiedRewardModal';

interface ClaimRewardButtonProps {
  variant?: 'default' | 'floating' | 'compact';
  className?: string;
}

export function ClaimRewardButton({
  variant = 'default',
  className = '',
}: ClaimRewardButtonProps) {
  const { isPremium } = usePremiumStatus();
  const { rewardState, loading, getStatusMessage, formatTimeUntilNext } =
    useUnifiedRewards();

  const [modalOpen, setModalOpen] = useState(false);

  const dailyLimitReached =
    (rewardState?.dailyCount || 0) >= (rewardState?.maxDaily || 5);
  const isDisabled = loading || dailyLimitReached || !rewardState?.available;

  const getButtonContent = () => {
    if (loading) {
      return (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
        </>
      );
    }

    if (dailyLimitReached) {
      return (
        <>
          <AlertCircle className="w-4 h-4" />
        </>
      );
    }

    if (!rewardState?.available && (rewardState?.timeUntilNext || 0) > 0) {
      const timeFormatted = formatTimeUntilNext(
        rewardState?.timeUntilNext || 0
      );
      return (
        <>
          <AlertCircle className="w-4 h-4 mr-2" />
          {variant === 'compact'
            ? timeFormatted
            : `Prochaine dans ${timeFormatted}`}
        </>
      );
    }

    if (isPremium) {
      return (
        <>
          <Crown className="w-4 h-4" />
        </>
      );
    }

    return (
      <>
        <Gift className="w-4 h-4" />
      </>
    );
  };

  const getButtonClassName = () => {
    const baseClasses =
      'transition-all duration-300 font-semibold shadow-lg transform-gpu';

    if (variant === 'floating') {
      const sizeClasses =
        'fixed bottom-20 right-4 z-50 rounded-full p-4 shadow-2xl';
      if (isDisabled) {
        return `${baseClasses} ${sizeClasses} bg-gray-400 text-white`;
      }
      return `${baseClasses} ${sizeClasses} ${
        isPremium
          ? 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white shadow-yellow-500/40 hover:shadow-yellow-500/60'
          : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-orange-500/40 hover:shadow-orange-500/60'
      }`;
    }

    if (variant === 'compact') {
      if (isDisabled) {
        return `${baseClasses} bg-gradient-to-r from-gray-400 to-gray-500 text-white`;
      }
      return `${baseClasses} ${
        isPremium
          ? 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white shadow-yellow-500/40'
          : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-orange-500/40'
      }`;
    }

    // Default variant
    if (isDisabled) {
      return `${baseClasses} bg-gradient-to-r from-gray-400 to-gray-500 text-white`;
    }

    return `${baseClasses} ${
      isPremium
        ? 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white shadow-yellow-500/40 hover:shadow-yellow-500/50'
        : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-orange-500/40 hover:shadow-orange-500/50'
    }`;
  };

  return (
    <>
      <Button
        onClick={() => setModalOpen(true)}
        disabled={isDisabled}
        className={`${getButtonClassName()} ${className}`}
        title={getStatusMessage()}
      >
        {getButtonContent()}
      </Button>

      <UnifiedRewardModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
