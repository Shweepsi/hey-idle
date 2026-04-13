import { PremiumStore } from '@/components/store/PremiumStore';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
import { useNavigate } from 'react-router-dom';
export const StorePage = () => {
  const navigate = useNavigate();

  // Gestion du bouton retour Android : retour au jardin
  useAndroidBackButton(true, () => {
    navigate('/garden');
  });

  return (
    <div className="min-h-full">
      {/* Contenu principal */}
      <div className="px-3 pb-6 space-y-4">
        <PremiumStore />
      </div>
    </div>
  );
};
