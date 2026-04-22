import { Navigate } from 'react-router-dom';
import { useIsAdmin } from '@/admin/hooks/useIsAdmin';
import { useAuth } from '@/hooks/useAuth';

interface AdminRouteProps {
  children: React.ReactNode;
  requireSuperadmin?: boolean;
}

/**
 * Gate for /admin/** routes. Redirects to /garden with no flash of admin UI
 * for non-admin users. Shows a lightweight loading state while the check runs.
 */
export const AdminRoute = ({ children, requireSuperadmin }: AdminRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const { admin, superadmin, isLoading } = useIsAdmin();

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground">
        Vérification des droits…
      </div>
    );
  }

  if (!user) return <Navigate to="/garden" replace />;
  if (!admin) return <Navigate to="/garden" replace />;
  if (requireSuperadmin && !superadmin) return <Navigate to="/admin" replace />;

  return <>{children}</>;
};
