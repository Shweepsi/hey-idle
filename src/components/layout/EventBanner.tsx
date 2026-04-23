import { useQuery } from '@tanstack/react-query';
import { db } from '@/integrations/supabase/untyped';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, Sparkles, CalendarClock } from 'lucide-react';
import type { GlobalOverrides, ScheduledEvent } from '@/admin/types';

/**
 * Read-only banner driven by economy_configs.global_overrides with a fallback
 * to the first currently-active scheduled_events row. Priority: maintenance
 * > admin-set event_banner > scheduled event.
 */
export const EventBanner = () => {
  const { user } = useAuth();

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
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const { data: activeEvents } = useQuery<ScheduledEvent[]>({
    queryKey: ['activeScheduledEvents'],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await db
        .from('scheduled_events')
        .select('*')
        .eq('active', true)
        .lte('starts_at', nowIso)
        .gte('ends_at', nowIso)
        .order('starts_at', { ascending: false });
      if (error) return [];
      return (data ?? []) as ScheduledEvent[];
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
  });

  if (data?.maintenance_mode) {
    return (
      <div className="bg-red-600 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-2 shadow-sm">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {data.maintenance_message ||
            'Maintenance en cours — certaines actions sont temporairement désactivées.'}
        </span>
      </div>
    );
  }

  if (data?.event_banner) {
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

  const evt = activeEvents?.[0];
  if (evt) {
    return (
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs px-3 py-1.5 flex items-center justify-center gap-2 shadow-sm">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          <strong>{evt.name}</strong>
          {evt.banner_message ? ` · ${evt.banner_message}` : ''} · ×{evt.multiplier}
        </span>
      </div>
    );
  }

  return null;
};
