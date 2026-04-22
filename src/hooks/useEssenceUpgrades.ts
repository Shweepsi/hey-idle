import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { EssenceService } from '@/services/EssenceService';

export const useEssenceUpgrades = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const catalog = useQuery({
    queryKey: ['essenceCatalog', user?.id],
    queryFn: () => {
      if (!user?.id) return Promise.resolve([]);
      return EssenceService.loadCatalog(user.id);
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (upgradeId: string) => {
      if (!user?.id) throw new Error('Non authentifié');
      return EssenceService.purchase(user.id, upgradeId);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['essenceCatalog', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['gameData', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['economySnapshot', user?.id] });
      toast.success('Amélioration d\'essence achetée !', {
        description: `Niveau ${result.new_level} • Essence restante : ${result.remaining_essence.toLocaleString()}`,
      });
    },
    onError: (error: Error) => {
      toast.error('Achat impossible', { description: error.message });
    },
  });

  return {
    catalog: catalog.data ?? [],
    isLoading: catalog.isLoading,
    purchase: purchaseMutation.mutate,
    isPurchasing: purchaseMutation.isPending,
  };
};
