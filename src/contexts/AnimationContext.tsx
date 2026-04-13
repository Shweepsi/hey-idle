import React, { createContext, useContext, useState, useCallback } from 'react';

export interface FloatingAnimation {
  id: string;
  amount: number;
  type: 'coins' | 'gems';
  timestamp: number;
  row: number; // 0-2
  col: number; // 0-2
  jitterX: number; // petit décalage aléatoire px
  jitterY: number;
}

interface AnimationContextType {
  animations: FloatingAnimation[];
  triggerCoinAnimation: (amount: number) => void;
  triggerGemAnimation: (amount: number) => void;
  removeAnimation: (id: string) => void;
}

const AnimationContext = createContext<AnimationContextType | undefined>(
  undefined
);

export const useAnimations = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error('useAnimations must be used within an AnimationProvider');
  }
  return context;
};

export const AnimationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [animations, setAnimations] = useState<FloatingAnimation[]>([]);
  // Chaque récolte déclenche sa propre animation. Aucune accumulation temporelle.

  // Facteur commun pour générer un FloatingAnimation
  const createAnimation = (
    type: FloatingAnimation['type'],
    amount: number,
    current: FloatingAnimation[]
  ): FloatingAnimation => {
    const id = `${type}-${Date.now()}-${Math.random()}`;

    // Filtrer les animations du même type pour éviter les chevauchements
    const sameTypeAnimations = current.filter((a) => a.type === type);
    const occupied = sameTypeAnimations.map((a) => a.row * 3 + a.col);

    // Trouver la première position libre dans la grille 3x3
    let cellIndex = 0;
    for (; cellIndex < 9; cellIndex++) {
      if (!occupied.includes(cellIndex)) break;
    }

    // Si toutes les cellules sont occupées, utiliser un décalage temporel
    if (cellIndex === 9) {
      // Remplacer l'animation la plus ancienne du même type
      const oldestAnimation = sameTypeAnimations.reduce((oldest, current) =>
        current.timestamp < oldest.timestamp ? current : oldest
      );
      cellIndex = oldestAnimation.row * 3 + oldestAnimation.col;
    }

    const col = cellIndex % 3; // 0,1,2
    const row = Math.floor(cellIndex / 3); // 0,1,2

    // Jitter réduit et plus cohérent pour un espacement prévisible
    const JITTER_RANGE = 20; // ±10px au lieu de ±30px
    const jitter = () => Math.floor((Math.random() - 0.5) * JITTER_RANGE);

    // Ajout d'un offset basé sur le type pour éviter les superpositions
    const typeOffset = {
      coins: { x: 0, y: 0 },
      gems: { x: -5, y: -5 },
    };

    return {
      id,
      amount,
      type,
      timestamp: Date.now(),
      row,
      col,
      jitterX: jitter() + typeOffset[type].x,
      jitterY: jitter() + typeOffset[type].y,
    };
  };

  // Générateur de fonctions déclencheurs pour chaque type
  const makeTrigger = (type: FloatingAnimation['type']) => (amount: number) => {
    setAnimations((prev) => [...prev, createAnimation(type, amount, prev)]);
  };

  const triggerCoinAnimation = useCallback(makeTrigger('coins'), []);
  const triggerGemAnimation = useCallback(makeTrigger('gems'), []);

  const removeAnimation = useCallback((id: string) => {
    setAnimations((current) => current.filter((anim) => anim.id !== id));
  }, []);

  return (
    <AnimationContext.Provider
      value={{
        animations,
        triggerCoinAnimation,
        triggerGemAnimation,
        removeAnimation,
      }}
    >
      {children}
    </AnimationContext.Provider>
  );
};
