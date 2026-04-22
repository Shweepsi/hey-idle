import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { EconomySnapshotService } from '@/services/EconomySnapshotService';

export const useEconomySnapshot = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['economySnapshot', user?.id],
    queryFn: () => {
      if (!user?.id) return null;
      return EconomySnapshotService.load(user.id);
    },
    enabled: !!user?.id,
    // Snapshot is a derived read — refresh on focus + every 30s while screen
    // is open. Mutations invalidate this key explicitly.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
};
