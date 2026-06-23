import { useState, useCallback } from 'react';
import { AdReward } from '@/types/ads';

/**
 * Minimal state for the ad reward modal: the currently selected reward.
 * (The old useReducer also tracked availableRewards/loadingRewards, but the
 * modal sources those from useUnifiedRewards — those branches were dead.)
 */
export function useAdModalState() {
  const [selectedReward, setSelected] = useState<AdReward | null>(null);

  const setSelectedReward = useCallback((reward: AdReward | null) => {
    // No-op si identique, pour éviter un re-render inutile.
    setSelected((prev) => (prev === reward ? prev : reward));
  }, []);

  const reset = useCallback(() => setSelected(null), []);

  return { selectedReward, setSelectedReward, reset };
}
