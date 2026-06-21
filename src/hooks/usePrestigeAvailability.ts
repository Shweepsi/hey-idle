import { useGameData } from '@/hooks/useGameData';
import { prestigeCostCoins, prestigeCostGems } from '@/economy/config';

export const usePrestigeAvailability = () => {
  const { data: gameData } = useGameData();

  if (!gameData?.garden) {
    return { isPrestigeAvailable: false };
  }

  const garden = gameData.garden;
  const prestigeLevel = garden.prestige_level || 0;
  const nextPrestige = prestigeLevel + 1;

  // Aligné sur la RPC serveur `execute_prestige` (économie v2, prestige infini).
  // L'ancien code plafonnait à 3 avec des coûts hardcodés — désormais obsolète.
  const costCoins = prestigeCostCoins(nextPrestige);
  const costGems = prestigeCostGems(nextPrestige);

  const isPrestigeAvailable =
    garden.coins >= costCoins && (garden.gems || 0) >= costGems;

  return { isPrestigeAvailable };
};
