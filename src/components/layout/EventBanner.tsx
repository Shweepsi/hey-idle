import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Sparkles } from 'lucide-react';

// Auto-generated types don't include economy_configs yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

interface GlobalOverrides {
  event_name: string | null;
  event_banner: string | null;
  maintenance_mode: boolean;
  maintenance_message: string | null;
}

/**
 * Read-only banner driven by economy_configs.global_overrides. Shows either
 * the maintenance warning (priority) or an event banner set from /admin.
 */
export const EventBanner = () => {
  const { data } = useQuery<GlobalOverrides | null>({
    queryKey: ['globalOverrides'],
    queryFn: async () => {
      const { data, error } = await db
        .from('economy_configs')
        .select('value')
        .eq('key', 'global_overrides')
        .maybeSingle();
      if (error) return null;
      return (data?.value ?? null) as GlobalOverrides | null;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  if (!data) return null;

  if (data.maintenance_mode) {
    return (
      <div className="bg-red-600 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-2 shadow-sm">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {data.maintenance_message || 'Maintenance en cours — certaines actions sont temporairement désactivées.'}
        </span>
      </div>
    );
  }

  if (data.event_banner) {
    return (
      <div className="bg-gradient-to-r from-pink-600 to-amber-500 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-2 shadow-sm">
        <Sparkles className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {data.event_name ? <strong>{data.event_name}</strong> : null}
          {data.event_name ? ' · ' : ''}
          {data.event_banner}
        </span>
      </div>
    );
  }

  return null;
};
