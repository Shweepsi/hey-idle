import { useQuery } from '@tanstack/react-query';
import { db } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';

interface FeatureFlagRow {
  key: string;
  enabled: boolean;
  rollout_percent: number;
}

/**
 * Deterministic per-user bucket in [0, 99] so percentage rollouts are stable
 * — a user either sees the flag or they don't, never flickers between renders.
 */
function userBucket(userId: string | null | undefined): number {
  if (!userId) return 0;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

const useFlagSet = () => {
  const { user } = useAuth();
  return useQuery<Record<string, FeatureFlagRow>>({
    queryKey: ['featureFlags'],
    queryFn: async () => {
      const { data, error } = await db.from('feature_flags').select('*');
      if (error) throw error;
      const map: Record<string, FeatureFlagRow> = {};
      for (const row of (data ?? []) as FeatureFlagRow[]) map[row.key] = row;
      return map;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
};

/**
 * Read a feature flag for the current user. Returns true only when the flag
 * is enabled AND the user's deterministic bucket falls below the rollout %.
 * Returns `defaultValue` while the flag map is still loading.
 */
export const useFeatureFlag = (key: string, defaultValue = false): boolean => {
  const { user } = useAuth();
  const { data } = useFlagSet();
  if (!data) return defaultValue;
  const row = data[key];
  if (!row) return defaultValue;
  if (!row.enabled) return false;
  if (row.rollout_percent >= 100) return true;
  return userBucket(user?.id) < row.rollout_percent;
};
