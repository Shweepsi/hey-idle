import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';

// Update frequency for the shared garden clock (ms). Optimized for performance.
const DEFAULT_CLOCK_INTERVAL = 1000;

/**
 * Context storing the last timestamp emitted by the shared garden clock.
 * All components that need a periodic tick (progress bars, timers…) can subscribe
 * to this context instead of starting their own setInterval, which drastically
 * reduces the number of timers running in parallel.
 */
const GardenClockContext = createContext<number>(Date.now());

interface GardenClockProviderProps {
  children: ReactNode;
  /** Interval in milliseconds between ticks. Defaults to 500 ms. */
  interval?: number;
}

export const GardenClockProvider = ({
  children,
  interval = DEFAULT_CLOCK_INTERVAL,
}: GardenClockProviderProps) => {
  const [time, setTime] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setTime(Date.now());
    }, interval);
    return () => clearInterval(id);
  }, [interval]);

  return (
    <GardenClockContext.Provider value={time}>
      {children}
    </GardenClockContext.Provider>
  );
};

/**
 * Hook to access the current tick value. The returned number changes every
 * `interval` milliseconds and causes subscribed components to re-render.
 */
export const useGardenClock = () => useContext(GardenClockContext);
