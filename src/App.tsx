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
        <Route
          path="/garden"
          element={
            <AppLayout>
              <GardenPage />
            </AppLayout>
          }
        />
        <Route
          path="/upgrades"
          element={
            <AppLayout>
              <UpgradesPage />
            </AppLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <AppLayout>
              <ProfilePage />
            </AppLayout>
          }
        />
        <Route
          path="/store"
          element={
            <AppLayout>
              <StorePage />
            </AppLayout>
          }
        />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

export default App;
