import { useState, useEffect } from 'react';

interface ScreenInfo {
  width: number;
  height: number;
  isXs: boolean; // 360px+
  isSm: boolean; // 414px+
  isMd: boolean; // 768px+
  isLg: boolean; // 1024px+
  isTouch: boolean;
  isLandscape: boolean;
  devicePixelRatio: number;
  safeAreaInsets: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export function useResponsiveLayout() {
  const [screenInfo, setScreenInfo] = useState<ScreenInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 360,
        height: 640,
        isXs: true,
        isSm: false,
        isMd: false,
        isLg: false,
        isTouch: false,
        isLandscape: false,
        devicePixelRatio: 1,
        safeAreaInsets: { top: 0, bottom: 0, left: 0, right: 0 },
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      width,
      height,
      isXs: width >= 360,
      isSm: width >= 414,
      isMd: width >= 768,
      isLg: width >= 1024,
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isLandscape: width > height,
      devicePixelRatio: window.devicePixelRatio || 1,
      safeAreaInsets: getSafeAreaInsets(),
    };
  });

  function getSafeAreaInsets() {
    if (typeof window === 'undefined')
      return { top: 0, bottom: 0, left: 0, right: 0 };

    const style = getComputedStyle(document.documentElement);
    return {
      top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
      bottom: parseInt(
        style.getPropertyValue('--safe-area-inset-bottom') || '0'
      ),
      left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0'),
      right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
    };
  }

  useEffect(() => {
    const updateScreenInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setScreenInfo({
        width,
        height,
        isXs: width >= 360,
        isSm: width >= 414,
        isMd: width >= 768,
        isLg: width >= 1024,
        isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        isLandscape: width > height,
        devicePixelRatio: window.devicePixelRatio || 1,
        safeAreaInsets: getSafeAreaInsets(),
      });
    };

    const mediaQuery = window.matchMedia('(orientation: landscape)');
    const handleOrientationChange = () => {
      // Délai pour laisser le temps au navigateur de s'adapter
      setTimeout(updateScreenInfo, 100);
    };

    window.addEventListener('resize', updateScreenInfo);
    mediaQuery.addEventListener('change', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', updateScreenInfo);
      mediaQuery.removeEventListener('change', handleOrientationChange);
    };
  }, []);

  return screenInfo;
}
