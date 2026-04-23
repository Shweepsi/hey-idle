import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { GardenPage } from '@/pages/GardenPage';
import { UpgradesPage } from '@/pages/UpgradesPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { StorePage } from '@/pages/StorePage';
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage';
import { TermsOfServicePage } from '@/pages/legal/TermsOfServicePage';
import { AboutPage } from '@/pages/legal/AboutPage';
import NotFound from './pages/NotFound';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { Capacitor } from '@capacitor/core';
import { logger } from '@/utils/logger';
import { AdminRoute } from '@/admin/components/AdminRoute';

// Lazy-load admin surface so non-admin sessions don't ship the dashboard
// bundle (~40 KB of TSX + date-fns locale + dialog primitives).
const AdminDashboardPage = lazy(() =>
  import('@/admin/pages/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminEconomyPage = lazy(() =>
  import('@/admin/pages/AdminEconomyPage').then((m) => ({ default: m.AdminEconomyPage })),
);
const AdminPlayersPage = lazy(() =>
  import('@/admin/pages/AdminPlayersPage').then((m) => ({ default: m.AdminPlayersPage })),
);
const AdminAuditPage = lazy(() =>
  import('@/admin/pages/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })),
);
const AdminFlagsPage = lazy(() =>
  import('@/admin/pages/AdminFlagsPage').then((m) => ({ default: m.AdminFlagsPage })),
);
const AdminEventsPage = lazy(() =>
  import('@/admin/pages/AdminEventsPage').then((m) => ({ default: m.AdminEventsPage })),
);
const AdminAdminsPage = lazy(() =>
  import('@/admin/pages/AdminAdminsPage').then((m) => ({ default: m.AdminAdminsPage })),
);

const AdminFallback = () => (
  <div className="flex h-screen items-center justify-center text-muted-foreground">
    Chargement du dashboard…
  </div>
);

const App = () => {
  useEffect(() => {
    const lockOrientation = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          await ScreenOrientation.lock({ orientation: 'portrait' });
        } catch (error) {
          logger.warn('Failed to lock screen orientation', error);
        }
      }
    };
    lockOrientation();
  }, []);

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Navigate to="/garden" replace />} />
        <Route path="/garden"   element={<AppLayout><GardenPage /></AppLayout>} />
        <Route path="/upgrades" element={<AppLayout><UpgradesPage /></AppLayout>} />
        <Route path="/profile"  element={<AppLayout><ProfilePage /></AppLayout>} />
        <Route path="/store"    element={<AppLayout><StorePage /></AppLayout>} />

        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <Suspense fallback={<AdminFallback />}>
                <Routes>
                  <Route index element={<AdminDashboardPage />} />
                  <Route path="economy" element={<AdminEconomyPage />} />
                  <Route path="players" element={<AdminPlayersPage />} />
                  <Route path="audit" element={<AdminAuditPage />} />
                  <Route path="flags" element={<AdminFlagsPage />} />
                  <Route path="events" element={<AdminEventsPage />} />
                  <Route
                    path="admins"
                    element={
                      <AdminRoute requireSuperadmin>
                        <AdminAdminsPage />
                      </AdminRoute>
                    }
                  />
                </Routes>
              </Suspense>
            </AdminRoute>
          }
        />

        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms"   element={<TermsOfServicePage />} />
        <Route path="/about"   element={<AboutPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;
