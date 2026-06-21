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
