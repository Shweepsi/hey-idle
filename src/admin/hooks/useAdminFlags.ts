import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminService } from '@/admin/services/AdminService';

export const useAdminFlags = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['adminFlags'],
    queryFn: () => AdminService.listFlags(),
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { key: string; enabled: boolean; rolloutPercent?: number }) =>
      AdminService.toggleFlag(input.key, input.enabled, input.rolloutPercent),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminFlags'] });
      qc.invalidateQueries({ queryKey: ['adminAudit'] });
      toast.success('Flag mis à jour');
    },
    onError: (error: Error) => {
      toast.error('Mise à jour échouée', { description: error.message });
    },
  });

  return {
    flags: query.data ?? [],
    isLoading: query.isLoading,
    toggle: toggleMutation.mutate,
    isUpdating: toggleMutation.isPending,
  };
};
