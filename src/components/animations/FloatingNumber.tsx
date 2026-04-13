import React, { useEffect, useMemo } from 'react';
import { Coins, Star } from 'lucide-react';
import { FloatingAnimation, useAnimations } from '@/contexts/AnimationContext';

interface FloatingNumberProps {
  animation: FloatingAnimation;
}

export const FloatingNumber: React.FC<FloatingNumberProps> = ({
  animation,
}) => {
  const { removeAnimation } = useAnimations();

  // Durée totale de l'animation (doit rester cohérente avec celle définie dans le CSS)
  const DURATION_MS = 2000;

  // Calcule le temps écoulé depuis la création de l'animation
  const elapsed = useMemo(
    () => Date.now() - animation.timestamp,
    [animation.timestamp]
  );

  useEffect(() => {
    const remaining = DURATION_MS - elapsed;

    // Si l'animation a déjà expiré (par exemple pendant un long changement de page),
    // on la retire immédiatement.
    if (remaining <= 0) {
      removeAnimation(animation.id);
      return;
    }

    const timer = setTimeout(() => {
      removeAnimation(animation.id);
    }, remaining);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animation.id, elapsed]);

  const isPositive = animation.amount > 0;

  // Formatage lisible pour les grands montants (> 100 000)
  const formatAmount = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) {
      return `${(abs / 1_000_000).toFixed(1)}M`;
    }
    if (abs >= 100_000) {
      return `${(abs / 1_000).toFixed(1)}K`;
    }
    return abs.toLocaleString();
  };

  const renderIcon = () => {
    switch (animation.type) {
      case 'coins':
        return <Coins className="w-3 h-3" />;
      case 'gems':
        return <span className="text-xs">💎</span>;
      default:
        return <Coins className="w-3 h-3" />;
    }
  };

  return (
    <div
      className={`floating-number ${animation.type} ${isPositive ? 'positive' : 'negative'}`}
      key={animation.id}
      style={{
        gridRowStart: animation.row + 1,
        gridColumnStart: animation.col + 1,
        transform: `translate(${animation.jitterX}px, ${animation.jitterY}px)`,
        // Décale le début de l'animation pour reprendre là où elle en était
        animationDelay: `${-Math.min(elapsed, DURATION_MS)}ms`,
      }}
    >
      <div className="flex items-center space-x-1 font-semibold text-sm">
        {renderIcon()}
        <span className="mobile-text-sm">
          {isPositive ? '+' : ''}
          {formatAmount(animation.amount)}
        </span>
      </div>
    </div>
  );
};
