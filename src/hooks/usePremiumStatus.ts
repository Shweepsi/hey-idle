import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const usePremiumStatus = () => {
  const { user } = useAuth();

  const {
    data: premiumStatus,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['premiumStatus', user?.id],
    queryFn: async () => {
      if (!user?.id) return { isPremium: false, purchasedAt: null };

      const { data, error } = await supabase
        .from('player_gardens')
        .select('premium_status, premium_purchased_at')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching premium status:', error);
        return { isPremium: false, purchasedAt: null };
      }

      return {
        isPremium: data.premium_status || false,
        purchasedAt: data.premium_purchased_at,
      };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  return {
    isPremium: premiumStatus?.isPremium || false,
    purchasedAt: premiumStatus?.purchasedAt,
    isLoading,
    refetch,
  };
};
