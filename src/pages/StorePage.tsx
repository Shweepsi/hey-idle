import { PremiumStore } from '@/components/store/PremiumStore';
import { EssenceTreePanel } from '@/components/store/EssenceTreePanel';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
import { useNavigate } from 'react-router-dom';
import { useGameData } from '@/hooks/useGameData';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';

export const StorePage = () => {
  const navigate = useNavigate();
  const { data: gameData } = useGameData();
  const premiumEnabled = useFeatureFlag('premium_store_enabled', true);
  const essenceEnabled = useFeatureFlag('essence_tree_enabled', true);

  useAndroidBackButton(true, () => {
    navigate('/garden');
  });

  // Only surface the essence tree once the player has unlocked prestige (or
  // already earned essence). Keeps the store tidy for brand-new players.
  const garden = gameData?.garden;
  const showEssenceTree =
    essenceEnabled &&
    ((garden?.essence ?? 0) > 0 || (garden?.prestige_level ?? 0) > 0);

  return (
    <div className="min-h-full">
      <div className="px-3 pb-6 space-y-4">
        {premiumEnabled && <PremiumStore />}
        {showEssenceTree && <EssenceTreePanel />}
      </div>
    </div>
  );
};
