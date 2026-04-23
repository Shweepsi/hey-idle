import { Home, TrendingUp, User, Crown, Shield } from 'lucide-react';
import { ShoppingCart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useUpgrades } from '@/hooks/useUpgrades';
import { useGameData } from '@/hooks/useGameData';
import { usePrestigeAvailability } from '@/hooks/usePrestigeAvailability';
import { useIsAdmin } from '@/admin/hooks/useIsAdmin';
import { useMemo } from 'react';
import { MINIMUM_COINS_RESERVE } from '@/constants';

export const BottomNavigation = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { data: gameData } = useGameData();
  const { getSequentialUpgrades, isUpgradePurchased } = useUpgrades();
  const { isPrestigeAvailable } = usePrestigeAvailability();
  const { admin } = useIsAdmin();

  // Calculate available upgrades count
  const availableUpgradesCount = useMemo(() => {
    const playerLevel = gameData?.garden?.level || 1;
    const coins = gameData?.garden?.coins || 0;
    const gems = gameData?.garden?.gems || 0;
    const sequentialUpgrades = getSequentialUpgrades();

    return sequentialUpgrades.filter((upgrade) => {
      const hasLevel = playerLevel >= upgrade.level_required;
      const hasCoins = coins >= upgrade.cost_coins + MINIMUM_COINS_RESERVE;
      const hasGems = gems >= upgrade.cost_gems;
      const notPurchased = !isUpgradePurchased(upgrade.id);
      return hasLevel && hasCoins && hasGems && notPurchased;
    }).length;
  }, [
    gameData?.garden?.level,
    gameData?.garden?.coins,
    gameData?.garden?.gems,
    getSequentialUpgrades,
    isUpgradePurchased,
  ]);

  const navigationItems = [
    { path: '/garden', icon: Home, label: 'Jardin' },
    { path: '/upgrades', icon: TrendingUp, label: 'Améliorations' },
    { path: '/store', icon: ShoppingCart, label: 'Boutique' },
    { path: '/profile', icon: User, label: 'Profil' },
    ...(admin ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  return (
    <nav className="sticky bottom-0 left-0 right-0 z-50 safe-area-bottom">
      <div className="mx-2 mb-2">
        <div className="glassmorphism rounded-xl p-1.5">
          <div className="flex justify-around">
            {navigationItems.map(({ path, icon: Icon, label }) => {
              const isActive = location.pathname === path;

              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-300 group relative touch-target flex-1 ${
                    isActive
                      ? 'bg-gradient-to-t from-green-500 to-green-400 text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-green-600 hover:bg-white/40'
                  }`}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-t from-green-500 to-green-400 rounded-lg opacity-20 animate-pulse"></div>
                  )}

                  <div className="relative">
                    <Icon
                      className={`h-5 w-5 mb-0.5 transition-all duration-300 ${
                        isActive
                          ? 'transform scale-110'
                          : 'group-hover:scale-110'
                      }`}
                    />
                  </div>

                  {/* Counter badge for upgrades */}
                  {path === '/upgrades' && availableUpgradesCount > 0 && (
                    <div className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                      {availableUpgradesCount > 9
                        ? '9+'
                        : availableUpgradesCount}
                    </div>
                  )}

                  {/* Prestige badge for profile */}
                  {path === '/profile' && isPrestigeAvailable && (
                    <div className="absolute top-1 right-1 bg-gradient-to-r from-yellow-500 to-purple-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                      <Crown className="h-3 w-3" />
                    </div>
                  )}

                  <span
                    className={`text-[0.6rem] xs:mobile-text-xs font-medium transition-all duration-300 text-center leading-tight truncate max-w-full ${
                      isActive ? 'font-bold' : ''
                    }`}
                  >
                    {label}
                  </span>

                  {isActive && (
                    <div className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-white rounded-full animate-ping"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
};
