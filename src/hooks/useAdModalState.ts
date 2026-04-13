import { useReducer, useCallback, useMemo } from 'react';
import { AdReward } from '@/types/ads';

interface AdModalState {
  selectedReward: AdReward | null;
  availableRewards: AdReward[];
  loadingRewards: boolean;
}

type AdModalAction =
  | { type: 'SET_SELECTED_REWARD'; payload: AdReward | null }
  | { type: 'SET_AVAILABLE_REWARDS'; payload: AdReward[] }
  | { type: 'SET_LOADING_REWARDS'; payload: boolean }
  | { type: 'RESET' };

const initialState: AdModalState = {
  selectedReward: null,
  availableRewards: [],
  loadingRewards: false,
};

function adModalReducer(
  state: AdModalState,
  action: AdModalAction
): AdModalState {
  switch (action.type) {
    case 'SET_SELECTED_REWARD':
      // Prevent unnecessary re-renders if the reward is the same
      if (state.selectedReward === action.payload) return state;
      return { ...state, selectedReward: action.payload };
    case 'SET_AVAILABLE_REWARDS':
      // Prevent unnecessary re-renders if the rewards array is the same
      if (
        state.availableRewards === action.payload ||
        (state.availableRewards.length === action.payload.length &&
          state.availableRewards.every(
            (reward, index) => reward === action.payload[index]
          ))
      ) {
        return state;
      }
      return { ...state, availableRewards: action.payload };
    case 'SET_LOADING_REWARDS':
      if (state.loadingRewards === action.payload) return state;
      return { ...state, loadingRewards: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

export function useAdModalState() {
  const [state, dispatch] = useReducer(adModalReducer, initialState);

  // Memoize callbacks to prevent unnecessary re-renders
  const actions = useMemo(
    () => ({
      setSelectedReward: (reward: AdReward | null) => {
        dispatch({ type: 'SET_SELECTED_REWARD', payload: reward });
      },
      setAvailableRewards: (rewards: AdReward[]) => {
        dispatch({ type: 'SET_AVAILABLE_REWARDS', payload: rewards });
      },
      setLoadingRewards: (loading: boolean) => {
        dispatch({ type: 'SET_LOADING_REWARDS', payload: loading });
      },
      reset: () => {
        dispatch({ type: 'RESET' });
      },
    }),
    []
  );

  return {
    ...state,
    ...actions,
  };
}
