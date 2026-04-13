import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface ActiveBoost {
  id: string;
  effect_type: string;
  effect_value: number;
  expires_at: string;
  created_at: string;
  source: string;
}

export const useActiveBoosts = () => {
  const { user } = useAuth();

  const queryClient = useQueryClient();

  const fetchActiveBoosts = useCallback(async () => {
    if (!user?.id) return [];

    // Nettoyer les boosts expirés côté DB (fonction RPC côté Supabase)
    await supabase.rpc('cleanup_expired_effects');

    const { data, error } = await supabase
      .from('active_effects')
      .select('*')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active boosts:', error);
      return [];
    }

    return data || [];
  }, [user?.id]);

  const { data: boosts = [], isFetching: loading } = useQuery({
    queryKey: ['active_boosts', user?.id],
    queryFn: fetchActiveBoosts,
    enabled: !!user?.id,
    staleTime: 30000, // Considérer frais pendant 30s
    refetchInterval: 30000, // Rafraîchir toutes les 30s
    refetchOnWindowFocus: false,
    placeholderData: [], // Conserve les données précédentes pendant le refetch → plus de clignotement
  });

  // Fonction pour forcer un rafraîchissement manuel (ex: après avoir reçu un événement custom)
  const refreshBoosts = () =>
    queryClient.invalidateQueries({ queryKey: ['active_boosts', user?.id] });

  const getBoostMultiplier = (effectType: string): number => {
    // Support des alias : traiter 'growth_speed' et 'growth_boost' comme identiques
    const equivalentTypes =
      effectType === 'growth_speed'
        ? ['growth_speed', 'growth_boost']
        : effectType === 'growth_boost'
          ? ['growth_boost', 'growth_speed']
          : [effectType];

    const boost = (boosts as ActiveBoost[]).find((b) =>
      equivalentTypes.includes(b.effect_type)
    );
    return boost ? boost.effect_value : 1;
  };

  const hasActiveBoost = (effectType: string): boolean => {
    const equivalentTypes =
      effectType === 'growth_speed'
        ? ['growth_speed', 'growth_boost']
        : effectType === 'growth_boost'
          ? ['growth_boost', 'growth_speed']
          : [effectType];

    return (boosts as ActiveBoost[]).some((b) =>
      equivalentTypes.includes(b.effect_type)
    );
  };

  const getTimeRemaining = (expiresAt: string): number => {
    return Math.max(
      0,
      Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    );
  };

  const formatTimeRemaining = (
    seconds: number,
    showSeconds: boolean = true
  ): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return showSeconds ? `${minutes}m ${secs}s` : `${minutes}m`;
    } else {
      return showSeconds ? `${secs}s` : '<1m';
    }
  };

  // Écouter les changements globaux pour rafraîchir après les récompenses
  // On se contente d'invalider le cache, react-query fera l'appel si nécessaire
  useEffect(() => {
    const handleBoostUpdate = () => {
      refreshBoosts();
    };

    window.addEventListener('boostUpdated', handleBoostUpdate);
    return () => window.removeEventListener('boostUpdated', handleBoostUpdate);
  }, [user?.id, refreshBoosts]);

  return {
    boosts: boosts as ActiveBoost[],
    loading,
    refreshBoosts,
    getBoostMultiplier,
    hasActiveBoost,
    getTimeRemaining,
    formatTimeRemaining,
  };
};
