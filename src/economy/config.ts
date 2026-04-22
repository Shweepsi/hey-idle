/**
 * Hey Idle — Economy Configuration v2.0 (Production Launch)
 *
 * SINGLE SOURCE OF TRUTH for all game-economy numbers. The server mirrors
 * these values in SQL (see migrations/2026*_economy_v2_*.sql). If you change
 * anything in this file you MUST also ship a migration that updates the
 * matching SQL constants, or the client and server will disagree and the
 * server (authoritative) will win.
 *
 * Versioning: ECONOMY_VERSION is written into player_gardens on each RPC so
 * we can reason about which curve a row was last updated under.
 */

export const ECONOMY_VERSION = 2;

// -----------------------------------------------------------------------------
// Hard caps (overflow protection)
// -----------------------------------------------------------------------------
/** 1 quintillion; fits in NUMERIC, overflows bigint (9.2e18) with headroom. */
export const COIN_HARD_CAP = 1_000_000_000_000_000_000;
/** Gems stay INT32-safe; anything past this is a bug. */
export const GEM_HARD_CAP = 1_000_000;
/** Essence: meta currency, NUMERIC, practical cap. */
export const ESSENCE_HARD_CAP = 1_000_000_000_000;

// -----------------------------------------------------------------------------
// Starting state (pre-essence-upgrades)
// -----------------------------------------------------------------------------
export const INITIAL_COINS = 100;
export const INITIAL_LEVEL = 1;
export const INITIAL_EXPERIENCE = 0;
export const INITIAL_PLOTS_UNLOCKED = 2; // Plots 1 & 2 are free
export const MAX_PLOTS = 12; // Up from 10

// -----------------------------------------------------------------------------
// Plant economy
// -----------------------------------------------------------------------------
/**
 * Base plant cost: `BASE * COST_GROWTH ^ (level - 1)`
 * 1.55 (was 1.35) = steeper curve so late-tier plants are cost-worthy.
 */
export const PLANT_COST_BASE = 50;
export const PLANT_COST_GROWTH = 1.55;

/**
 * Profit margin over cost. Tiered so higher-level plants are meaningfully
 * more profitable per-second (fixes the "Wheat is best" bug).
 */
export function plantProfitMargin(plantLevel: number): number {
  if (plantLevel <= 3) return 2.2;
  if (plantLevel <= 6) return 2.5;
  if (plantLevel <= 9) return 2.9;
  return 3.5; // tier 4: lvl 10+
}

/** Bonus per 10 minutes of (base) growth time. */
export const TIME_BONUS_PER_10MIN = 0.1;
/** Additive per-player-level bonus. 0.015 (was 0.02) since profit margin rose. */
export const LEVEL_BONUS_PER_LEVEL = 0.015;

/**
 * Canonical plant schedule. IDs match the `plant_types.name` column in SQL.
 * base_growth_seconds here is the NEW rebalanced value (server ships a
 * migration to match).
 */
export interface PlantDef {
  name: string;
  display_name: string;
  emoji: string;
  level_required: number;
  base_growth_seconds: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export const PLANT_SCHEDULE: PlantDef[] = [
  { name: 'wheat',      display_name: 'Blé',        emoji: '🌾', level_required: 1,  base_growth_seconds: 20,   rarity: 'common' },
  { name: 'carrot',     display_name: 'Carotte',    emoji: '🥕', level_required: 2,  base_growth_seconds: 40,   rarity: 'common' },
  { name: 'lettuce',    display_name: 'Laitue',     emoji: '🥬', level_required: 3,  base_growth_seconds: 75,   rarity: 'common' },
  { name: 'tomato',     display_name: 'Tomate',     emoji: '🍅', level_required: 4,  base_growth_seconds: 90,   rarity: 'uncommon' },
  { name: 'corn',       display_name: 'Maïs',       emoji: '🌽', level_required: 5,  base_growth_seconds: 180,  rarity: 'uncommon' },
  { name: 'potato',     display_name: 'Patate',     emoji: '🥔', level_required: 6,  base_growth_seconds: 360,  rarity: 'rare' },
  { name: 'pumpkin',    display_name: 'Citrouille', emoji: '🎃', level_required: 7,  base_growth_seconds: 600,  rarity: 'rare' },
  { name: 'watermelon', display_name: 'Pastèque',   emoji: '🍉', level_required: 8,  base_growth_seconds: 1200, rarity: 'epic' },
  { name: 'apple',      display_name: 'Pomme',      emoji: '🍎', level_required: 9,  base_growth_seconds: 1800, rarity: 'epic' },
  { name: 'grape',      display_name: 'Raisin',     emoji: '🍇', level_required: 10, base_growth_seconds: 2700, rarity: 'legendary' },
];

// -----------------------------------------------------------------------------
// Robot (passive income)
// -----------------------------------------------------------------------------
/** Coins per minute at robot level 1 (up from 25). */
export const ROBOT_BASE_INCOME = 40;
/** Exponent on robot level (up from 1.25 — late game less punishing). */
export const ROBOT_LEVEL_EXPONENT = 1.35;
/** Max robot level via upgrades. */
export const ROBOT_MAX_LEVEL = 10;
/** Default offline accumulation cap (hours). Extended via essence upgrade. */
export const ROBOT_BASE_OFFLINE_HOURS = 8;
/** Hard cap on offline cap, even with full essence investment. */
export const ROBOT_MAX_OFFLINE_HOURS = 24;
/** XP per coin collected by robot. (Previous 1/100 was over-generous.) */
export const ROBOT_XP_PER_COIN = 1 / 500;

// -----------------------------------------------------------------------------
// Level curve
// -----------------------------------------------------------------------------
/** level = floor(sqrt(xp / XP_DIVISOR)) + 1 */
export const XP_DIVISOR = 80; // was 100; ever-so-slightly smoother early game

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return (level - 1) ** 2 * XP_DIVISOR;
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / XP_DIVISOR)) + 1);
}

/** Gem bonus when crossing these level boundaries (additive). */
export const LEVEL_MILESTONE_GEMS = [
  { every: 5,   gems: 1 },
  { every: 25,  gems: 5 },
  { every: 100, gems: 25 },
];

/**
 * Gem delta when player goes old_level → new_level.
 * Rules stack: L100 crosses 5-, 25-, and 100-boundaries → 1 + 5 + 25 = 31.
 */
export function levelMilestoneGems(oldLevel: number, newLevel: number): number {
  let total = 0;
  for (const rule of LEVEL_MILESTONE_GEMS) {
    const crossings =
      Math.floor(newLevel / rule.every) - Math.floor(Math.max(0, oldLevel) / rule.every);
    if (crossings > 0) total += crossings * rule.gems;
  }
  return total;
}

// -----------------------------------------------------------------------------
// Prestige (infinite scaling)
// -----------------------------------------------------------------------------
/** Cost scales: base * growth^level. No hard level cap. */
export const PRESTIGE_BASE_COST_COINS = 150_000;
export const PRESTIGE_COST_GROWTH = 2.2;
/** Gem cost scales linearly-ish: base + level*5. */
export const PRESTIGE_BASE_COST_GEMS = 10;
export const PRESTIGE_COST_GEMS_PER_LEVEL = 5;

/**
 * Permanent multiplier as a smooth quadratic of prestige level:
 *   mult = 1 + A*p + B*p^2
 * Picked so p=1→1.53, p=3→2.77, p=10→9.0, p=20→23.0.
 */
export const PRESTIGE_MULT_LINEAR = 0.5;
export const PRESTIGE_MULT_QUADRATIC = 0.03;

export function prestigeCostCoins(nextPrestige: number): number {
  if (nextPrestige < 1) return 0;
  return Math.floor(PRESTIGE_BASE_COST_COINS * PRESTIGE_COST_GROWTH ** (nextPrestige - 1));
}

export function prestigeCostGems(nextPrestige: number): number {
  if (nextPrestige < 1) return 0;
  return PRESTIGE_BASE_COST_GEMS + (nextPrestige - 1) * PRESTIGE_COST_GEMS_PER_LEVEL;
}

export function prestigeMultiplier(prestigeLevel: number): number {
  if (prestigeLevel <= 0) return 1;
  return 1 + PRESTIGE_MULT_LINEAR * prestigeLevel + PRESTIGE_MULT_QUADRATIC * prestigeLevel ** 2;
}

/**
 * Essence earned on prestige, based on coins banked THIS RUN.
 *   essence = floor(ESSENCE_COEF * sqrt(coins_this_run / ESSENCE_DENOM))
 * With coef=10 and denom=1e6:
 *   1M banked → 10, 100M → 100, 10B → 1000, 1T → 10000.
 */
export const ESSENCE_COEF = 10;
export const ESSENCE_DENOM = 1_000_000;

export function essenceEarned(coinsThisRun: number, essenceBoostMultiplier = 1): number {
  if (coinsThisRun <= 0) return 0;
  const raw = ESSENCE_COEF * Math.sqrt(coinsThisRun / ESSENCE_DENOM);
  return Math.max(0, Math.floor(raw * essenceBoostMultiplier));
}

// Plots that survive a prestige (at minimum). Essence upgrade extends this.
export const PRESTIGE_KEEP_PLOTS_BASE = 4;

// -----------------------------------------------------------------------------
// Essence meta-upgrades — permanent across prestiges
// -----------------------------------------------------------------------------
export type EssenceEffectType =
  | 'start_coins'
  | 'harvest_boost'
  | 'robot_boost'
  | 'offline_cap'
  | 'gem_chance'
  | 'start_plots'
  | 'essence_boost'
  | 'growth_speed';

export interface EssenceUpgradeDef {
  id: EssenceEffectType;
  display_name: string;
  description: string;
  emoji: string;
  max_level: number;
  /** cost(level) = base + lvl * per_level */
  cost_base: number;
  cost_per_level: number;
  /** Applied as ADDITIVE per owned level; caller multiplies by level. */
  effect_per_level: number;
}

export const ESSENCE_UPGRADES: EssenceUpgradeDef[] = [
  {
    id: 'start_coins',
    display_name: 'Bourse garnie',
    description: '+50 pièces de départ par niveau (après prestige).',
    emoji: '💰',
    max_level: 20,
    cost_base: 5,
    cost_per_level: 2,
    effect_per_level: 50,
  },
  {
    id: 'harvest_boost',
    display_name: 'Récolte éternelle',
    description: '+2% aux récompenses de récolte par niveau, permanent.',
    emoji: '🌾',
    max_level: 50,
    cost_base: 10,
    cost_per_level: 5,
    effect_per_level: 0.02,
  },
  {
    id: 'robot_boost',
    display_name: 'Robot éternel',
    description: '+2% au revenu du robot par niveau, permanent.',
    emoji: '🤖',
    max_level: 50,
    cost_base: 10,
    cost_per_level: 5,
    effect_per_level: 0.02,
  },
  {
    id: 'offline_cap',
    display_name: 'Jardin veilleur',
    description: '+1h de plafond hors-ligne (max +16h).',
    emoji: '⏰',
    max_level: 16,
    cost_base: 15,
    cost_per_level: 10,
    effect_per_level: 1,
  },
  {
    id: 'gem_chance',
    display_name: 'Chance gemmée',
    description: '+0,5% de chance de gemme par niveau (max +10%).',
    emoji: '💎',
    max_level: 20,
    cost_base: 20,
    cost_per_level: 10,
    effect_per_level: 0.005,
  },
  {
    id: 'start_plots',
    display_name: 'Parcelles héritées',
    description: '+1 parcelle de départ, conservée au prestige (max +6).',
    emoji: '🌻',
    max_level: 6,
    cost_base: 25,
    cost_per_level: 25,
    effect_per_level: 1,
  },
  {
    id: 'essence_boost',
    display_name: 'Échos du passé',
    description: '+5% d\'essence gagnée au prochain prestige par niveau.',
    emoji: '✨',
    max_level: 25,
    cost_base: 30,
    cost_per_level: 20,
    effect_per_level: 0.05,
  },
  {
    id: 'growth_speed',
    display_name: 'Jardinier éternel',
    description: '+1% de vitesse de croissance par niveau.',
    emoji: '⚡',
    max_level: 25,
    cost_base: 15,
    cost_per_level: 10,
    effect_per_level: 0.01,
  },
];

export function essenceUpgradeCost(
  def: EssenceUpgradeDef,
  currentLevel: number,
): number {
  if (currentLevel >= def.max_level) return Infinity;
  return def.cost_base + currentLevel * def.cost_per_level;
}

// -----------------------------------------------------------------------------
// Daily reward cycle (7-day streak, auto-loops)
// -----------------------------------------------------------------------------
export interface DailyReward {
  day: number; // 1..7
  coins?: number;
  gems?: number;
  /** Boost granted (type, mult, duration-minutes). */
  boost?: { type: 'coin_boost' | 'gem_boost' | 'growth_speed'; value: number; minutes: number };
}

export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, coins: 500 },
  { day: 2, gems: 1 },
  { day: 3, coins: 2_500, gems: 1 },
  { day: 4, boost: { type: 'coin_boost', value: 2, minutes: 120 } },
  { day: 5, gems: 3 },
  { day: 6, coins: 10_000, gems: 2 },
  { day: 7, gems: 5, boost: { type: 'coin_boost', value: 3, minutes: 240 } },
];

// -----------------------------------------------------------------------------
// Plot unlock cost
// -----------------------------------------------------------------------------
export const PLOT_UNLOCK_BASE = 300;
export const PLOT_UNLOCK_GROWTH = 2.8;
/** Plots past this index cost gems in addition to coins. */
export const PLOT_GEM_GATED_FROM = 11;
export const PLOT_GEM_GATE_COST = 50;

export function plotUnlockCostCoins(plotNumber: number): number {
  if (plotNumber <= 1) return 0;
  return Math.floor(PLOT_UNLOCK_BASE * PLOT_UNLOCK_GROWTH ** (plotNumber - 2));
}

export function plotUnlockCostGems(plotNumber: number): number {
  return plotNumber >= PLOT_GEM_GATED_FROM ? PLOT_GEM_GATE_COST : 0;
}

// -----------------------------------------------------------------------------
// Gem drop chance
// -----------------------------------------------------------------------------
/** Base drop chance even with no gem_chance upgrades. */
export const GEM_DROP_BASE_CHANCE = 0.03;
/** Hard cap on drop chance (prevents guaranteed gems). */
export const GEM_DROP_MAX_CHANCE = 0.9;

// -----------------------------------------------------------------------------
// Ad rewards
// -----------------------------------------------------------------------------
export const MAX_DAILY_ADS = 10; // up from 5
/** Max total active-boost duration (minutes) per type — stacking cap. */
export const MAX_ACTIVE_BOOST_MINUTES = 360; // 6 hours

// -----------------------------------------------------------------------------
// Display / polling (carried over from legacy)
// -----------------------------------------------------------------------------
export const ROBOT_UPDATE_INTERVAL = 1000;
export const UPDATE_INTERVALS = {
  FAST: 5000,
  MEDIUM: 15000,
  SLOW: 30000,
};
export const NUMBER_FORMAT_THRESHOLDS = {
  THOUSAND: 1_000,
  MILLION: 1_000_000,
  BILLION: 1_000_000_000,
  TRILLION: 1_000_000_000_000,
};
