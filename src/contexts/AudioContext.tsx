import React, { createContext, useContext, useState, useEffect } from 'react';

interface AudioContextType {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  soundVolume: number;
  setSoundVolume: (volume: number) => void;
  playSound: (soundType: SoundType) => void;
}

export type SoundType =
  | 'plant'
  | 'harvest'
  | 'coin'
  | 'gems'
  | 'purchase'
  | 'upgrade'
  | 'achievement'
  | 'error'
  | 'robot';

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const AudioProvider = ({ children }: { children: React.ReactNode }) => {
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const [soundVolume, setSoundVolume] = useState(() => {
    const saved = localStorage.getItem('soundVolume');
    return saved !== null ? JSON.parse(saved) : 70;
  });

  const [audioElements] = useState<Map<SoundType, HTMLAudioElement>>(new Map());

  // Charger les sons - mapper les 4 sons disponibles
  useEffect(() => {
    const sounds: Record<SoundType, string> = {
      plant: '/sounds/purchase.mp3', // Son d'achat pour planter
      harvest: '/sounds/coin.mp3', // Son de pièce pour récolter
      coin: '/sounds/coin.mp3', // Son de pièce
      gems: '/sounds/coin.mp3', // Son de pièce pour les gemmes
      purchase: '/sounds/purchase.mp3', // Son d'achat
      upgrade: '/sounds/upgrade.mp3', // Son d'amélioration
      achievement: '/sounds/upgrade.mp3', // Son d'amélioration pour succès
      error: '/sounds/error.mp3', // Son d'erreur
      robot: '/sounds/coin.mp3', // Son de pièce pour robot
    };

    Object.entries(sounds).forEach(([type, src]) => {
      const audio = new Audio(src);
      audio.volume = soundVolume / 100;
      audio.preload = 'auto';
      audioElements.set(type as SoundType, audio);
    });

    return () => {
      audioElements.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
    };
  }, []);

  // Gérer le volume des sons
  useEffect(() => {
    audioElements.forEach((audio) => {
      audio.volume = soundVolume / 100;
    });
  }, [soundVolume, audioElements]);

  // Persister les préférences
  useEffect(() => {
    localStorage.setItem('soundEnabled', JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem('soundVolume', JSON.stringify(soundVolume));
  }, [soundVolume]);

  const playSound = (soundType: SoundType) => {
    if (!soundEnabled) return;

    const audio = audioElements.get(soundType);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(() => {
        console.log(`Son ${soundType} bloqué`);
      });
    }
  };

  return (
    <AudioContext.Provider
      value={{
        soundEnabled,
        setSoundEnabled,
        soundVolume,
        setSoundVolume,
        playSound,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
};

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};
