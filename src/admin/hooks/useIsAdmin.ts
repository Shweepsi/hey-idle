import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { AdminService } from '@/admin/services/AdminService';

/**
 * Is the current user an admin? Used by AdminRoute + conditional UI.
 * Returns {admin, superadmin, isLoading} — `admin=true` implies the user can
 * see the dashboard; `superadmin=true` unlocks role-management pages.
 */
export const useIsAdmin = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['isAdmin', user?.id],
    queryFn: async () => {
      if (!user?.id) return { admin: false, superadmin: false };
      try {
        return await AdminService.amIAdmin(user.id);
      } catch {
        return { admin: false, superadmin: false };
      }
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000, // admin status rarely flips mid-session
  });

  return {
    admin: data?.admin ?? false,
    superadmin: data?.superadmin ?? false,
    isLoading,
  };
};
