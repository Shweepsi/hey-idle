import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminService } from '@/admin/services/AdminService';
import type { GlobalOverrides } from '@/admin/types';

export const useAdminGlobalOverrides = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['adminGlobalOverrides'],
    queryFn: () => AdminService.loadGlobalOverrides(),
  });

  const updateMutation = useMutation({
    mutationFn: (patch: Partial<GlobalOverrides>) => AdminService.updateGlobalOverrides(patch),
    onSuccess: (next) => {
      qc.setQueryData(['adminGlobalOverrides'], next);
      qc.invalidateQueries({ queryKey: ['adminAudit'] });
      toast.success('Configuration mise à jour');
    },
    onError: (error: Error) => {
      toast.error('Mise à jour échouée', { description: error.message });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => AdminService.resetOverrides(),
    onSuccess: (next) => {
      qc.setQueryData(['adminGlobalOverrides'], next);
      qc.invalidateQueries({ queryKey: ['adminAudit'] });
      toast.success('Configuration réinitialisée');
    },
    onError: (error: Error) => {
      toast.error('Réinitialisation échouée', { description: error.message });
    },
  });

  return {
    overrides: query.data,
    isLoading: query.isLoading,
    update: updateMutation.mutate,
    reset: resetMutation.mutate,
    isUpdating: updateMutation.isPending || resetMutation.isPending,
  };
};

export const useAdminHealth = (refreshInterval = 30_000) => {
  return useQuery({
    queryKey: ['adminHealth'],
    queryFn: () => AdminService.getHealth(),
    refetchInterval: refreshInterval,
  });
};
