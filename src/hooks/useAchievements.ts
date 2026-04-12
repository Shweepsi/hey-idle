import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  target: number;
  reward_coins: number;
  reward_gems: number;
  emoji: string;
  progress?: number;
  completed?: boolean;
  unlocked_at?: string;
}

/**
 * Hook to manage achievement system with persistent storage
 */
export const useAchievements = () => {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Define base achievements
  const baseAchievements: Omit<Achievement, 'id' | 'progress' | 'completed' | 'unlocked_at'>[] = [
    {
      name: "Premier Pas",
      description: "Plantez votre première graine",
      category: "planting",
      target: 1,
      reward_coins: 50,
      reward_gems: 1,
      emoji: "🌱"
    },
    {
      name: "Jardinier Débutant",
      description: "Récoltez 10 plantes",
      category: "harvest",
      target: 10,
      reward_coins: 200,
      reward_gems: 2,
      emoji: "🌿"
    },
    {
      name: "Maître du Jardin",
      description: "Récoltez 100 plantes",
      category: "harvest",
      target: 100,
      reward_coins: 1000,
      reward_gems: 5,
      emoji: "🌳"
    },
    {
      name: "Collectionneur de Pièces",
      description: "Accumulez 10,000 pièces",
      category: "wealth",
      target: 10000,
      reward_coins: 500,
      reward_gems: 3,
      emoji: "🪙"
    },
    {
      name: "Millionaire",
      description: "Accumulez 100,000 pièces",
      category: "wealth",
      target: 100000,
      reward_coins: 5000,
      reward_gems: 10,
      emoji: "💰"
    },
    {
      name: "Premier Prestige",
      description: "Effectuez votre premier prestige",
      category: "prestige",
      target: 1,
      reward_coins: 1000,
      reward_gems: 15,
      emoji: "👑"
    },
    {
      name: "Maître du Prestige",
      description: "Atteignez le prestige niveau 3",
      category: "prestige",
      target: 3,
      reward_coins: 10000,
      reward_gems: 50,
      emoji: "🏆"
    }
  ];

  // Load achievements from database
  useEffect(() => {
    if (!user) return;
    
    const loadAchievements = async () => {
      try {
        setIsLoading(true);
        
        // Get saved achievements from database
        const { data: savedAchievements } = await supabase
          .from('player_achievements')
          .select('*')
          .eq('user_id', user.id);

        // Merge with base achievements
        const mergedAchievements: Achievement[] = baseAchievements.map(baseAchievement => {
          const saved = savedAchievements?.find(s => s.achievement_name === baseAchievement.name);
          
          return {
            id: saved?.id || `temp-${baseAchievement.name}`,
            name: baseAchievement.name,
            description: baseAchievement.description,
            category: baseAchievement.category,
            target: baseAchievement.target,
            reward_coins: baseAchievement.reward_coins,
            reward_gems: baseAchievement.reward_gems,
            emoji: baseAchievement.emoji,
            progress: saved?.progress || 0,
            completed: saved?.completed || false,
            unlocked_at: saved?.completed_at || undefined
          };
        });

        setAchievements(mergedAchievements);
      } catch (error) {
        console.error('Error loading achievements:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAchievements();
  }, [user]);

  // Check achievement progress via server RPC. The RPC validates garden
  // state against the target, grants rewards once, and handles the progress
  // record. Client no longer writes to player_achievements or player_gardens.
  const checkAchievementProgress = async (_garden: any) => {
    if (!user) return;

    for (const baseAchievement of baseAchievements) {
      const { data, error } = await supabase.rpc('claim_achievement_atomic', {
        p_user_id: user.id,
        p_achievement_name: baseAchievement.name
      });

      if (error) {
        console.error(`Achievement RPC error (${baseAchievement.name}):`, error);
        continue;
      }

      const result = data as {
        success: boolean;
        completed?: boolean;
        already_completed?: boolean;
        progress?: number;
      };
      if (!result?.success) continue;

      if (result.completed && !result.already_completed) {
        toast.success(`🏆 Achievement débloqué : ${baseAchievement.emoji} ${baseAchievement.name}`, {
          description: `+${baseAchievement.reward_coins} pièces, +${baseAchievement.reward_gems} gemmes`
        });
        setAchievements(prev => prev.map(a =>
          a.name === baseAchievement.name
            ? { ...a, completed: true, progress: result.progress ?? a.progress, unlocked_at: new Date().toISOString() }
            : a
        ));
      } else if (typeof result.progress === 'number') {
        setAchievements(prev => prev.map(a =>
          a.name === baseAchievement.name
            ? { ...a, progress: result.progress }
            : a
        ));
      }
    }
  };

  return {
    achievements,
    isLoading,
    checkAchievementProgress
  };
};