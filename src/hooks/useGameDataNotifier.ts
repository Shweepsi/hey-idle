import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

// PHASE 1: Enhanced event emitter with payload support
class GameDataEventEmitter {
  private listeners: { [key: string]: Array<(payload?: any) => void> } = {};

  emit(event: string, payload?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((listener) => listener(payload));
    }
  }

  on(event: string, listener: (payload?: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(listener);
  }

  off(event: string, listener: (payload?: any) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(
        (l) => l !== listener
      );
    }
  }
}

export const gameDataEmitter = new GameDataEventEmitter();

export const useGameDataNotifier = () => {
  const queryClient = useQueryClient();
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  const notifyRewardClaimed = useCallback(
    (rewardType: 'coins' | 'gems' | 'boost', amount?: number) => {
      // Clear any existing timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      // PHASE 1: Immediately emit events with payload for optimistic updates
      gameDataEmitter.emit('reward-claimed', { type: rewardType, amount });
      gameDataEmitter.emit(`${rewardType}-claimed`, { amount });

      // PHASE 1: Direct cache update for instant display
      if (amount && rewardType !== 'boost') {
        queryClient.setQueryData(['gameData'], (oldData: any) => {
          if (!oldData?.garden) return oldData;

          const updatedGarden = { ...oldData.garden };
          if (rewardType === 'coins') {
            updatedGarden.coins = (updatedGarden.coins || 0) + amount;
          } else if (rewardType === 'gems') {
            updatedGarden.gems = (updatedGarden.gems || 0) + amount;
          }

          return {
            ...oldData,
            garden: updatedGarden,
          };
        });
      }

      // PHASE 1: Single aggressive refresh with 0 stale time
      queryClient.invalidateQueries({ queryKey: ['gameData'] });
      queryClient.refetchQueries({
        queryKey: ['gameData'],
        type: 'active',
      });
    },
    [queryClient]
  );

  const notifyDataChange = useCallback(
    (dataType: string) => {
      gameDataEmitter.emit(`${dataType}-changed`);
      queryClient.invalidateQueries({ queryKey: ['gameData'] });
    },
    [queryClient]
  );

  return {
    notifyRewardClaimed,
    notifyDataChange,
    gameDataEmitter,
  };
};
