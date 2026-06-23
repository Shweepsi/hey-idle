/**
 * Legacy constants.ts — kept as a thin compat shim for the few consumers below.
 * All NEW code should import from '@/economy/config' which is the single
 * source of truth (matches the server migrations ship-for-ship).
 *
 * Only the symbols actually consumed are kept:
 *   MAX_PLOTS                    → usePlantActions, useDirectPlanting
 *   ROBOT_MAX_ACCUMULATION_HOURS → usePassiveIncomeRobot, PassiveIncomeRobot
 *   MINIMUM_COINS_RESERVE        → UpgradesPage, BottomNavigation
 */

export {
  MAX_PLOTS,
  ROBOT_BASE_OFFLINE_HOURS as ROBOT_MAX_ACCUMULATION_HOURS,
} from '@/economy/config';

export const MINIMUM_COINS_RESERVE = 100;
