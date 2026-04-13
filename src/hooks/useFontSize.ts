import { useState, useEffect } from 'react';

export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';

const FONT_SIZE_KEY = 'idle-grow-font-size';

export function useFontSize() {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window === 'undefined') return 'medium';
    return (localStorage.getItem(FONT_SIZE_KEY) as FontSize) || 'medium';
  });

  useEffect(() => {
    const root = document.documentElement;

    // Appliquer la classe de taille de police au root
    root.classList.remove(
      'font-size-small',
      'font-size-medium',
      'font-size-large',
      'font-size-extra-large'
    );
    root.classList.add(`font-size-${fontSize}`);

    // Sauvegarder dans localStorage
    localStorage.setItem(FONT_SIZE_KEY, fontSize);
  }, [fontSize]);

  const increaseFontSize = () => {
    const sizes: FontSize[] = ['small', 'medium', 'large', 'extra-large'];
    const currentIndex = sizes.indexOf(fontSize);
    if (currentIndex < sizes.length - 1) {
      setFontSize(sizes[currentIndex + 1]);
    }
  };

  const decreaseFontSize = () => {
    const sizes: FontSize[] = ['small', 'medium', 'large', 'extra-large'];
    const currentIndex = sizes.indexOf(fontSize);
    if (currentIndex > 0) {
      setFontSize(sizes[currentIndex - 1]);
    }
  };

  const resetFontSize = () => {
    setFontSize('medium');
  };

  return {
    fontSize,
    setFontSize,
    increaseFontSize,
    decreaseFontSize,
    resetFontSize,
    canIncrease: fontSize !== 'extra-large',
    canDecrease: fontSize !== 'small',
  };
}
