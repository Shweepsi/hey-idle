import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Achat d'un boost temporaire en gemmes (sink "doux" — alternative à la pub).
 * Server-authoritative : le RPC spend_gems_for_boost relit le prix et débite
 * atomiquement (cf. migration 20260625140000).
 */
export function useGemBoost() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isPurchasing, setIsPurchasing] = useState(false);

  const buyBoost = async (rewardType: string): Promise<boolean> => {
    if (!user?.id) return false;
    setIsPurchasing(true);
    try {
      const { data, error } = await supabase.rpc('spend_gems_for_boost', {
        p_user_id: user.id,
        p_reward_type: rewardType,
      });
      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        toast.error(
          result.error === 'Insufficient gems'
            ? 'Gemmes insuffisantes'
            : 'Achat impossible'
        );
        return false;
      }

      toast.success('Boost activé !');
      // Rafraîchissement immédiat des boosts + du solde de gemmes.
      window.dispatchEvent(new Event('boostUpdated'));
      queryClient.invalidateQueries({ queryKey: ['active_boosts'] });
      queryClient.invalidateQueries({ queryKey: ['gameData'] });
      return true;
    } catch (e) {
      console.error('Error buying gem boost:', e);
      toast.error("Erreur lors de l'achat");
      return false;
    } finally {
      setIsPurchasing(false);
    }
  };

  return { buyBoost, isPurchasing };
}
