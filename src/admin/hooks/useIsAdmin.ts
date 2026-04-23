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
      // Surface errors to console so we can see RPC/network failures during
      // onboarding instead of silently denying access.
      try {
        return await AdminService.amIAdmin(user.id);
      } catch (error) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.error('[useIsAdmin] amIAdmin failed', error);
        }
        return { admin: false, superadmin: false };
      }
    },
    enabled: !!user?.id,
    // Shorter stale time so admin status reflects within a minute of change.
    staleTime: 60_000,
    retry: 1,
  });

  return {
    admin: data?.admin ?? false,
    superadmin: data?.superadmin ?? false,
    isLoading,
  };
};
