#!/usr/bin/env node
/**
 * Simulateur d'économie des plantes — outil d'équilibrage.
 * Reproduit UnifiedCalculationService.calculateHarvestReward pour comparer
 * profit/seconde par tier et vérifier la monotonie (chaque tier ≥ le précédent).
 * Données = lineup RÉEL de la table plant_types (source de vérité = la DB).
 *
 *   node scripts/sim-plant-economy.mjs
 */

const PLANT_COST_BASE = 50;
const PLANT_COST_GROWTH = 1.55;
const TIME_BONUS_PER_10MIN = 0.1; // floor(growth/600)*0.1
const LEVEL_BONUS_PER_LEVEL = 0.015;

function margin(lvl) {
  if (lvl <= 3) return 2.2;
  if (lvl <= 6) return 2.5;
  if (lvl <= 9) return 2.9;
  return 3.5;
}
const cost = (lvl) => Math.floor(PLANT_COST_BASE * Math.pow(PLANT_COST_GROWTH, lvl - 1));

function profitPerSec(lvl, growth, playerLevel) {
  const c = cost(lvl);
  const tb = Math.floor(growth / 600) * TIME_BONUS_PER_10MIN;
  const reward = c * margin(lvl) * (1 + tb) * (1 + playerLevel * LEVEL_BONUS_PER_LEVEL);
  return (reward - c) / growth;
}

// [name, level_required] — lineup réel prod
const PLANTS = [
  ['potato', 1], ['carrot', 2], ['tomato', 3], ['cucumber', 4], ['lettuce', 5],
  ['broccoli', 6], ['banana', 7], ['apple', 8], ['pear', 9], ['strawberry', 10],
];

const OLD = [360, 40, 90, 120, 75, 600, 900, 1800, 1500, 1800]; // avant 2026-06-25
const NEW = [15, 22, 33, 50, 75, 110, 165, 250, 370, 540];       // rééquilibré (appliqué)

function report(label, growths, pl) {
  console.log(`\n=== ${label} (player level ${pl}) ===`);
  let prev = null, monotone = true;
  for (let i = 0; i < PLANTS.length; i++) {
    const [name, lvl] = PLANTS[i];
    const ps = profitPerSec(lvl, growths[i], pl);
    if (prev && ps < prev - 1e-9) monotone = false;
    console.log(`L${lvl} ${name.padEnd(11)} ${String(growths[i]).padStart(4)}s  p/sec=${ps.toFixed(2)}${prev ? (ps >= prev ? ' ↑' : ' ↓') : ''}`);
    prev = ps;
  }
  console.log(`Monotone : ${monotone ? '✅' : '❌'}`);
}

report('AVANT (cassé)', OLD, 20);
report('APRÈS (appliqué)', NEW, 20);
report('APRÈS', NEW, 100);
