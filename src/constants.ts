/**
 * Constantes globales de l'application GrowGardenVerse
 */

// Configuration du jardin
export const MAX_PLOTS = 9;
export const INITIAL_COINS = 100;
export const MINIMUM_COINS_RESERVE = 100;

// Configuration des niveaux
export const INITIAL_LEVEL = 1;
export const XP_PER_LEVEL_MULTIPLIER = 75; // Reduced for smoother progression

// Configuration du robot
export const ROBOT_UPDATE_INTERVAL = 1000; // 1 seconde

// Configuration de l'affichage
export const UPDATE_INTERVALS = {
  FAST: 5000, // 5s pour croissance < 5min
  MEDIUM: 15000, // 15s pour croissance < 30min
  SLOW: 30000, // 30s pour croissance >= 30min
};

// Seuils d'affichage des nombres
export const NUMBER_FORMAT_THRESHOLDS = {
  THOUSAND: 1000,
  MILLION: 1000000,
};

// Configuration du prestige
export const PRESTIGE_RESET_COINS = 100;
export const PRESTIGE_RESET_LEVEL = 1;
export const PRESTIGE_RESET_XP = 0;

// Configuration du robot passif
export const ROBOT_MAX_ACCUMULATION_HOURS = 6; // Temps maximum d'accumulation du robot
export const ROBOT_BASE_INCOME = 25; // Revenu de base par minute (augmenté pour meilleure progression)
export const ROBOT_LEVEL_EXPONENT = 1.25; // Exposant de progression par niveau
export const ROBOT_MAX_PERMANENT_MULTIPLIER = 10; // Soft cap du multiplicateur prestige (au-delà: 50% du surplus)
