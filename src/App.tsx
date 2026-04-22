import { useEffect } from 'react';
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
import { AdminDashboardPage } from '@/admin/pages/AdminDashboardPage';
import { AdminEconomyPage } from '@/admin/pages/AdminEconomyPage';
import { AdminPlayersPage } from '@/admin/pages/AdminPlayersPage';
import { AdminAuditPage } from '@/admin/pages/AdminAuditPage';
import { AdminFlagsPage } from '@/admin/pages/AdminFlagsPage';
import { AdminEventsPage } from '@/admin/pages/AdminEventsPage';
import { AdminAdminsPage } from '@/admin/pages/AdminAdminsPage';

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

        {/* Admin dashboard — gated by is_admin check + auth */}
        <Route path="/admin"            element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
        <Route path="/admin/economy"    element={<AdminRoute><AdminEconomyPage /></AdminRoute>} />
        <Route path="/admin/players"    element={<AdminRoute><AdminPlayersPage /></AdminRoute>} />
        <Route path="/admin/audit"      element={<AdminRoute><AdminAuditPage /></AdminRoute>} />
        <Route path="/admin/flags"      element={<AdminRoute><AdminFlagsPage /></AdminRoute>} />
        <Route path="/admin/events"     element={<AdminRoute><AdminEventsPage /></AdminRoute>} />
        <Route path="/admin/admins"     element={<AdminRoute requireSuperadmin><AdminAdminsPage /></AdminRoute>} />

        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms"   element={<TermsOfServicePage />} />
        <Route path="/about"   element={<AboutPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;
