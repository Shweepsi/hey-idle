/**
 * Temporary escape hatch used until `supabase gen types` is re-run to pick
 * up the economy-v2 and admin tables/RPCs. Consumers import `db` instead of
 * casting the typed client inline. When types catch up, delete this file and
 * switch imports back to `supabase`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { supabase } from './client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

/**
 * Narrow the Supabase RPC envelope and our own `{success, error}` payload
 * convention into a single throw-on-failure unwrap. Used by every v2 service.
 */
export function unwrapRpc<T>(
  data: unknown,
  error: unknown,
  fallbackMessage: string,
): T {
  if (error) throw error;
  if (!data) throw new Error(fallbackMessage);
  const envelope = data as { success?: boolean; error?: string };
  if (envelope.success === false) {
    throw new Error(envelope.error || fallbackMessage);
  }
  return data as T;
}
