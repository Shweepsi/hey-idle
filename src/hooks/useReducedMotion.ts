import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'reduced-motion-preference';

export const useReducedMotion = () => {
  const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
      // Respect system preference by default
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(reducedMotion));

    // Apply to document root for CSS-based animations
    if (reducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }, [reducedMotion]);

  const setReducedMotion = useCallback((value: boolean) => {
    setReducedMotionState(value);
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setReducedMotionState((prev) => !prev);
  }, []);

  return { reducedMotion, setReducedMotion, toggleReducedMotion };
};
