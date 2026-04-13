import { useEffect } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/utils/logger';

export const DeepLinkListener = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const setup = async () => {
      const listener = await CapacitorApp.addListener(
        'appUrlOpen',
        (event: any) => {
          try {
            const url = event?.url as string | undefined;
            if (!url) return;
            const parsed = new URL(url);
            // Expecting: idlegrow://payment/success?session_id=cs_...
            if (
              parsed.protocol === 'idlegrow:' &&
              parsed.hostname === 'payment'
            ) {
              const path = parsed.pathname.replace(/^\//, '');
              const sessionId = parsed.searchParams.get('session_id') || '';
              if (path === 'success' && sessionId) {
                navigate(
                  `/store?payment=success&session_id=${encodeURIComponent(sessionId)}`,
                  { replace: true }
                );
              } else if (
                path === 'cancelled' ||
                path === 'canceled' ||
                path === 'cancel'
              ) {
                navigate('/store?payment=cancelled', { replace: true });
              } else {
                navigate('/store', { replace: true });
              }
            }
          } catch (e) {
            logger.error('Deep link parse error', e);
          }
        }
      );
      return () => listener?.remove?.();
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => (cleanup = fn));
    return () => cleanup?.();
  }, [navigate]);

  return null;
};
