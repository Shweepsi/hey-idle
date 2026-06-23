#!/usr/bin/env node
/**
 * Garde-fou anti-dérive économie.
 *
 * src/economy/config.ts est la source de vérité, mais les RPC SQL
 * (economy_v2_rpcs.sql) re-codent les mêmes nombres à la main. Si on change
 * une constante dans config.ts sans répercuter dans le SQL, client et serveur
 * divergent (et le serveur, autoritaire, gagne → preview faux côté joueur).
 *
 * Ce script lit la valeur ACTUELLE de chaque constante surveillée dans
 * config.ts et vérifie qu'elle apparaît littéralement dans le SQL. Présence
 * uniquement (volontairement simple) — mais suffit à attraper le cas courant :
 * bump d'une constante oublié côté SQL.
 *
 * Usage : node scripts/check-economy-drift.mjs   (exit 1 si dérive)
 */
import { readFileSync } from 'node:fs';

const CONFIG = 'src/economy/config.ts';
const SQL = 'supabase/migrations/20260423110000_economy_v2_rpcs.sql';

// Constantes distinctives dont la valeur, si présente dans le SQL, est un vrai
// signal (on évite 0.1 / 1 / 100 trop communs pour ne pas faux-passer).
const WATCHED = [
  'PLANT_COST_BASE',
  'PLANT_COST_GROWTH',
  'LEVEL_BONUS_PER_LEVEL',
  'ROBOT_BASE_INCOME',
  'ROBOT_LEVEL_EXPONENT',
  'XP_DIVISOR',
  'PRESTIGE_BASE_COST_COINS',
  'PRESTIGE_COST_GROWTH',
];

const config = readFileSync(CONFIG, 'utf8');
const sql = readFileSync(SQL, 'utf8');

const problems = [];
for (const name of WATCHED) {
  const m = config.match(new RegExp(`export const ${name}\\s*=\\s*([0-9_.]+)`));
  if (!m) {
    problems.push(`${name} : introuvable dans ${CONFIG} (renommé ? mettre à jour ce garde-fou)`);
    continue;
  }
  const value = m[1].replace(/_/g, '');
  if (!sql.includes(value)) {
    problems.push(`${name} = ${value} : absent de ${SQL} → dérive config↔SQL`);
  }
}

if (problems.length) {
  console.error('❌ Dérive économie détectée :');
  for (const p of problems) console.error('   - ' + p);
  console.error('\n→ Répercute la valeur dans le RPC SQL (ou ajuste ce garde-fou si volontaire).');
  process.exit(1);
}

console.log(`✅ Économie config ↔ SQL cohérente (${WATCHED.length} constantes vérifiées).`);
