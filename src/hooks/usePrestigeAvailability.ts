import { useGameData } from '@/hooks/useGameData';

export const usePrestigeAvailability = () => {
  const { data: gameData } = useGameData();

  if (!gameData?.garden) {
    return { isPrestigeAvailable: false };
  }

  const garden = gameData.garden;
  const prestigeLevel = garden.prestige_level || 0;
  const prestigeCostsCoins = [150_000, 375_000, 750_000]; // Reduced by 25%
  const prestigeCostsGems = [10, 25, 50];
  const costCoins = prestigeCostsCoins[prestigeLevel] || Infinity;
  const costGems = prestigeCostsGems[prestigeLevel] || Infinity;

  const isPrestigeAvailable =
    garden.coins >= costCoins &&
    (garden.gems || 0) >= costGems &&
    prestigeLevel < 3;

  return { isPrestigeAvailable };
};
