import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface LeaderboardPlayer {
  user_id?: string;
  id?: string;
  username: string;
  total_harvests: number;
  coins: number;
  level: number;
  prestige_level: number;
  experience?: number;
  is_bot?: boolean;
  premium_status?: boolean;
}

export const useLadder = () => {
  const { user } = useAuth();

  // Classement par récoltes totales - utilise la fonction RPC sécurisée
  const { data: harvestLeaders = [], isLoading: harvestLoading } = useQuery({
    queryKey: ['leaderboard', 'harvests'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard_harvests', {
        p_limit: 100,
      });

      if (error) throw error;

      return (data || []).map(
        (g: {
          user_id: string;
          username: string;
          total_harvests: number;
          premium_status: boolean;
        }) => ({
          user_id: g.user_id,
          id: g.user_id,
          username: g.username || 'Jardinier Anonyme',
          total_harvests: g.total_harvests,
          coins: 0,
          level: 0,
          prestige_level: 0,
          premium_status: g.premium_status || false,
          is_bot: false,
        })
      );
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Classement par pièces - utilise la fonction RPC sécurisée
  const { data: coinsLeaders = [], isLoading: coinsLoading } = useQuery({
    queryKey: ['leaderboard', 'coins'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard_coins', {
        p_limit: 100,
      });

      if (error) throw error;

      return (data || []).map(
        (g: {
          user_id: string;
          username: string;
          coins: number;
          premium_status: boolean;
        }) => ({
          user_id: g.user_id,
          id: g.user_id,
          username: g.username || 'Jardinier Anonyme',
          total_harvests: 0,
          coins: g.coins,
          level: 0,
          prestige_level: 0,
          premium_status: g.premium_status || false,
          is_bot: false,
        })
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  // Classement par niveau - utilise la fonction RPC sécurisée
  const { data: levelLeaders = [], isLoading: levelLoading } = useQuery({
    queryKey: ['leaderboard', 'level'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leaderboard_level', {
        p_limit: 100,
      });

      if (error) throw error;

      return (data || []).map(
        (g: {
          user_id: string;
          username: string;
          level: number;
          experience: number;
          premium_status: boolean;
        }) => ({
          user_id: g.user_id,
          id: g.user_id,
          username: g.username || 'Jardinier Anonyme',
          total_harvests: 0,
          coins: 0,
          level: g.level || 1,
          experience: g.experience || 0,
          prestige_level: 0,
          premium_status: g.premium_status || false,
          is_bot: false,
        })
      );
    },
    staleTime: 5 * 60 * 1000,
  });

  // Position du joueur actuel dans chaque classement
  const { data: currentUserRanks = {} } = useQuery({
    queryKey: ['userRanks', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};

      const [harvestRank, coinsRank, levelRank, userGarden] = await Promise.all(
        [
          // Rang par récoltes
          supabase.rpc('get_user_harvest_rank', { target_user_id: user.id }),
          // Rang par pièces
          supabase.rpc('get_user_coins_rank', { target_user_id: user.id }),
          // Rang par niveau
          supabase.rpc('get_user_level_rank', { target_user_id: user.id }),
          // Statut premium du joueur (accès à ses propres données via RLS)
          supabase
            .from('player_gardens')
            .select('premium_status')
            .eq('user_id', user.id)
            .single(),
        ]
      );

      const premiumStatus = userGarden.data?.premium_status || false;

      return {
        harvests: harvestRank.data
          ? { rank: harvestRank.data, premium_status: premiumStatus }
          : null,
        coins: coinsRank.data
          ? { rank: coinsRank.data, premium_status: premiumStatus }
          : null,
        level: levelRank.data
          ? { rank: levelRank.data, premium_status: premiumStatus }
          : null,
      };
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return {
    harvestLeaders,
    coinsLeaders,
    levelLeaders,
    currentUserRanks,
    loading: harvestLoading || coinsLoading || levelLoading,
  };
};
