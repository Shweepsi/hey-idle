import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export function NetworkStatusIndicator() {
  const { isOnline, isSlowConnection } = useNetworkStatus();

  if (isOnline && !isSlowConnection) {
    return null; // Pas d'indicateur si tout va bien
  }

  if (!isOnline) {
    return (
      <Badge variant="destructive" className="fixed top-4 right-4 z-50">
        <WifiOff className="w-3 h-3 mr-1" />
        Hors ligne
      </Badge>
    );
  }

  if (isSlowConnection) {
    return (
      <Badge variant="secondary" className="fixed top-4 right-4 z-50">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Connexion lente
      </Badge>
    );
  }

  return null;
}
