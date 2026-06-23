import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Compact number formatter for display (coins, essence, stats). Keeps one
 * decimal above 1k, collapses to a short suffix. < 1000 renders with the
 * user's locale grouping.
 */
export function formatCompact(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n.toLocaleString();
}

/**
 * Human-readable duration. `Hh Mm` above an hour, `Mm Ss` (or `Mm`) below,
 * `Ss` (or `<1m`) under a minute. `showSeconds: false` drops the seconds part.
 */
export function formatDuration(
  seconds: number,
  { showSeconds = true }: { showSeconds?: boolean } = {}
): string {
  if (seconds <= 0) return showSeconds ? '0s' : '<1m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return showSeconds ? `${minutes}m ${secs}s` : `${minutes}m`;
  return showSeconds ? `${secs}s` : '<1m';
}
