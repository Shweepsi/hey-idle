import { useGameData } from './useGameData';

// L'ancien système d'overlay optimiste reposait sur gameDataEmitter, qui n'était
// jamais déclenché : l'overlay calculait toujours +0. Le flux réel passe par
// l'invalidation React Query. On garde ce hook comme simple passe-plat pour ses
// deux consommateurs (GameHeader, useRefactoredGame) qui ne lisent que gameData/isLoading.
export const useOptimisticGameData = () => {
  const { data: gameData, isLoading } = useGameData();
  return { gameData, isLoading };
};
