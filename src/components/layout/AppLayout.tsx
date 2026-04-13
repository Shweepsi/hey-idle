import { BottomNavigation } from './BottomNavigation';
import { ProtectedRoute } from './ProtectedRoute';
import { NetworkStatusIndicator } from '@/components/network/NetworkStatusIndicator';
import { GameHeader } from '@/components/garden/GameHeader';
import { useRefactoredGame } from '@/hooks/useRefactoredGame';
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { gameState, loading } = useRefactoredGame();

  return (
    <ProtectedRoute>
      <div className="min-h-dvh flex flex-col garden-background relative">
        <NetworkStatusIndicator />

        {/* Floating particles for ambiance */}
        <div className="floating-particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>

        {/* Persistent Game Header */}
        <div className="sticky top-0 z-40 bg-gradient-to-b from-white/80 to-transparent backdrop-blur-sm">
          {loading ? (
            <div className="mx-3 mt-3 mb-2">
              <div className="glassmorphism rounded-xl p-3 shadow-xl">
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                </div>
              </div>
            </div>
          ) : (
            <GameHeader garden={gameState.garden} />
          )}
        </div>

        {/* Main content with padding for sticky navigation */}
        <div className="flex-1 relative z-10 pb-[calc(5rem+env(safe-area-inset-bottom))] px-px">
          {children}
        </div>

        {/* Sticky bottom navigation */}
        <BottomNavigation />
      </div>
    </ProtectedRoute>
  );
};
