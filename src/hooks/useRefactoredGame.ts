import { useOptimisticGameData } from './useOptimisticGameData';
import { usePlantActions } from './usePlantActions';
import { useGameEconomy } from './useGameEconomy';

export const useRefactoredGame = () => {
  const { gameData, isLoading } = useOptimisticGameData();
  const plantActions = usePlantActions();
  const economy = useGameEconomy();

  return {
    gameState: {
      garden: gameData?.garden || null,
      plots: gameData?.plots || [],
      plantTypes: gameData?.plantTypes || [],
    },
    loading: isLoading,
    ...plantActions,
    ...economy,
  };
};
