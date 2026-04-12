
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useAnimations } from '@/contexts/AnimationContext';

export const useGameEconomy = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { triggerCoinAnimation } = useAnimations();

  const unlockPlotMutation = useMutation({
    mutationFn: async (plotNumber: number) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase.rpc('unlock_plot_atomic', {
        p_user_id: user.id,
        p_plot_number: plotNumber
      });

      if (error) throw new Error(error.message);

      const result = data as { success: boolean; error?: string; cost?: number };
      if (!result?.success) {
        throw new Error(result?.error || 'Erreur lors du déblocage');
      }

      return { cost: result.cost || 0 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gameData'] });
      triggerCoinAnimation(-data.cost);
      toast.success('Parcelle débloquée !');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors du déblocage');
    }
  });

  return {
    unlockPlot: (plotNumber: number) => unlockPlotMutation.mutate(plotNumber),
    isUnlocking: unlockPlotMutation.isPending
  };
};
