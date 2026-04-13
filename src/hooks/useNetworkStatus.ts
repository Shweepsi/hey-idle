import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  lastOnlineAt: Date | null;
}

export function useNetworkStatus() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    lastOnlineAt: navigator.onLine ? new Date() : null,
  });
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setNetworkStatus((prev) => ({
        ...prev,
        isOnline: true,
        lastOnlineAt: new Date(),
      }));

      toast({
        title: 'Connexion rétablie',
        description:
          'Vous êtes de nouveau en ligne. Votre jardin se synchronise...',
      });
    };

    const handleOffline = () => {
      setNetworkStatus((prev) => ({
        ...prev,
        isOnline: false,
      }));

      toast({
        variant: 'destructive',
        title: 'Connexion perdue',
        description:
          'Mode hors ligne activé. Certaines fonctionnalités sont limitées.',
      });
    };

    // Détection de connexion lente (plus de 4 secondes pour une requête)
    const detectSlowConnection = async () => {
      if (!navigator.onLine) return;

      const startTime = Date.now();
      try {
        await fetch('/ping', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: AbortSignal.timeout(4000),
        });

        const duration = Date.now() - startTime;
        const isSlowConnection = duration > 2000;

        setNetworkStatus((prev) => ({
          ...prev,
          isSlowConnection,
        }));

        if (isSlowConnection && !networkStatus.isSlowConnection) {
          toast({
            title: 'Connexion lente détectée',
            description: 'Les temps de chargement peuvent être plus longs.',
          });
        }
      } catch (error) {
        // Connexion probablement lente ou indisponible
        setNetworkStatus((prev) => ({
          ...prev,
          isSlowConnection: true,
        }));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Vérifier la vitesse de connexion toutes les 30 secondes
    const intervalId = setInterval(detectSlowConnection, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [toast, networkStatus.isSlowConnection]);

  return networkStatus;
}
