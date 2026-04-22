import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminService } from '@/admin/services/AdminService';

export const useAdminEvents = () => {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['adminEvents'],
    queryFn: () => AdminService.listEvents(),
  });

  const createMutation = useMutation({
    mutationFn: AdminService.createEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminEvents'] });
      qc.invalidateQueries({ queryKey: ['adminAudit'] });
      toast.success('Événement créé');
    },
    onError: (error: Error) => {
      toast.error('Création échouée', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: AdminService.deleteEvent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['adminEvents'] });
      qc.invalidateQueries({ queryKey: ['adminAudit'] });
      toast.success('Événement supprimé');
    },
    onError: (error: Error) => {
      toast.error('Suppression échouée', { description: error.message });
    },
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    create: createMutation.mutate,
    remove: deleteMutation.mutate,
    isMutating: createMutation.isPending || deleteMutation.isPending,
  };
};
