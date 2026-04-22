/**
 * Legacy constants.ts — kept for backwards compatibility.
 * All NEW code should import from '@/economy/config' which is the single
 * source of truth (matches the server migrations ship-for-ship).
 */

export {
  MAX_PLOTS,
  INITIAL_COINS,
  INITIAL_LEVEL,
  INITIAL_EXPERIENCE,
  ROBOT_BASE_INCOME,
  ROBOT_LEVEL_EXPONENT,
  ROBOT_BASE_OFFLINE_HOURS as ROBOT_MAX_ACCUMULATION_HOURS,
  ROBOT_UPDATE_INTERVAL,
  UPDATE_INTERVALS,
  NUMBER_FORMAT_THRESHOLDS,
  ECONOMY_VERSION,
} from '@/economy/config';

// Legacy names mapped to the v2 config.
export const MINIMUM_COINS_RESERVE = 100;
export const XP_PER_LEVEL_MULTIPLIER = 80;
export const PRESTIGE_RESET_COINS = 100;
export const PRESTIGE_RESET_LEVEL = 1;
export const PRESTIGE_RESET_XP = 0;
/**
 * Kept for legacy components that read a soft-cap number. v2 has NO soft cap;
 * we export Infinity so any "apply cap" code becomes a no-op.
 */
export const ROBOT_MAX_PERMANENT_MULTIPLIER = Number.POSITIVE_INFINITY;
