import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AdminService } from '@/admin/services/AdminService';

export const useAdminPlayerSearch = (query: string, limit = 25, offset = 0) => {
  return useQuery({
    queryKey: ['adminPlayerSearch', query, limit, offset],
    queryFn: () => AdminService.searchPlayers(query, limit, offset),
    staleTime: 10_000,
  });
};

export const useAdminPlayerDetail = (userId: string | null) => {
  return useQuery({
    queryKey: ['adminPlayerDetail', userId],
    queryFn: () => AdminService.getPlayerDetail(userId!),
    enabled: !!userId,
  });
};

export const useAdminGrantCurrency = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      coins: number;
      gems: number;
      essence: number;
      reason: string;
    }) =>
      AdminService.grantCurrency(input.userId, input.coins, input.gems, input.essence, input.reason),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['adminPlayerDetail', variables.userId] });
      qc.invalidateQueries({ queryKey: ['adminPlayerSearch'] });
      qc.invalidateQueries({ queryKey: ['adminAudit'] });
      toast.success('Monnaie accordée');
    },
    onError: (error: Error) => {
      toast.error('Attribution échouée', { description: error.message });
    },
  });
};

export const useAdminResetPlayer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; reason: string }) =>
      AdminService.resetPlayer(input.userId, input.reason),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['adminPlayerDetail', variables.userId] });
      qc.invalidateQueries({ queryKey: ['adminPlayerSearch'] });
      qc.invalidateQueries({ queryKey: ['adminAudit'] });
      toast.success('Joueur réinitialisé');
    },
    onError: (error: Error) => {
      toast.error('Réinitialisation échouée', { description: error.message });
    },
  });
};
