import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { AnimationProvider } from '@/contexts/AnimationContext';
import { AudioProvider } from '@/contexts/AudioContext';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { DeepLinkListener } from '@/components/navigation/DeepLinkListener';
import App from './App.tsx';
import './index.css';

import.meta.env.PROD &&
  (() => {
    const noop = () => {};
    console.log = noop;
    console.debug = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
  })();

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AnimationProvider>
            <AudioProvider>
              <TooltipProvider>
                <App />
                {/* Deep link listener for native return from Stripe */}
                <DeepLinkListener />
                <Toaster />
                <Sonner />
              </TooltipProvider>
            </AudioProvider>
          </AnimationProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </ErrorBoundary>
);
