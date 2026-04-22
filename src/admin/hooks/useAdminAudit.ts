import { useQuery } from '@tanstack/react-query';
import { AdminService } from '@/admin/services/AdminService';

export const useAdminAuditLog = (limit = 50, offset = 0, actionFilter: string | null = null) => {
  return useQuery({
    queryKey: ['adminAudit', limit, offset, actionFilter],
    queryFn: () => AdminService.getAuditLog(limit, offset, actionFilter),
    staleTime: 5_000,
  });
};
