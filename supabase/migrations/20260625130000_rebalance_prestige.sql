-- Rééquilibrage du prestige (2026-06-25).
--
-- Problème : 1er prestige rapportait ~4 essence (≈ un demi-niveau d'upgrade
-- après avoir tout reset → ressenti punitif), et la récompense √(coins) ne
-- suivait pas le coût ×2.2/niveau → la boucle stalle après quelques prestiges.
--
-- Fix (2 leviers, marges/reset inchangés) :
--   • essence : 10·√(coins/1e6) → 25·√(coins/250k)  (1er prestige 4 → ~23)
--   • coût    : ×2.2/niveau → ×1.9/niveau           (reste atteignable)
-- Vérifié par sim : essence/cycle suit mieux le coût, boucle gratifiante dès P1.
--
-- Méthode chirurgicale : on récupère le corps LIVE exact de chaque fonction
-- (pg_get_functiondef), on remplace UNIQUEMENT les 2 constantes, on re-crée.
-- Garde-fou : EXCEPTION si un remplacement ne matche pas (jamais de demi-applique).
-- (db push cassé par la désync d'historique → appliqué via `db query --linked`.)

DO $mig$
DECLARE def text;
BEGIN
  -- execute_prestige (la mutation réelle)
  def := pg_get_functiondef('public.execute_prestige(uuid)'::regprocedure);
  def := replace(def, 'POWER(2.2::numeric', 'POWER(1.9::numeric');
  def := replace(def, '10 * SQRT(v_coins_this_run / 1000000.0)', '25 * SQRT(v_coins_this_run / 250000.0)');
  IF def NOT LIKE '%POWER(1.9::numeric%' OR def NOT LIKE '%25 * SQRT(v_coins_this_run / 250000.0)%' THEN
    RAISE EXCEPTION 'execute_prestige: remplacement non appliqué (format live inattendu)';
  END IF;
  EXECUTE def;

  -- get_economy_snapshot (le PREVIEW client — doit refléter les mêmes formules)
  def := pg_get_functiondef('public.get_economy_snapshot(uuid)'::regprocedure);
  def := replace(def, 'POWER(2.2::numeric', 'POWER(1.9::numeric');
  def := replace(def,
    '10 * SQRT(GREATEST(0::numeric, COALESCE(v_garden.coins_earned_this_run, 0)) / 1000000.0)',
    '25 * SQRT(GREATEST(0::numeric, COALESCE(v_garden.coins_earned_this_run, 0)) / 250000.0)');
  IF def NOT LIKE '%POWER(1.9::numeric%' OR def NOT LIKE '%/ 250000.0)%' THEN
    RAISE EXCEPTION 'get_economy_snapshot: remplacement non appliqué (format live inattendu)';
  END IF;
  EXECUTE def;
END $mig$;
