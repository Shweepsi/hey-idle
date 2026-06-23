-- Nettoyage backend (Vague 3 — lot sûr).
-- Supprime des objets MORTS, vérifiés sans aucun appelant côté app
-- (src/) ni trigger vivant. Signatures extraites des migrations sources.
--
-- LIVE, NON touchés (vérifiés) : plant_discoveries (écrite par le RPC de
-- récolte economy_v2), get_robot_plant_for_level + sync_robot_plant_type
-- (trigger sur player_gardens).
--
-- ⚠️ APRÈS application : régénérer src/integrations/supabase/types.ts
--    (npm run gen:types) — il référence encore certains de ces objets.

-- RPC morts (arg types exacts pour que le DROP matche bien) -----------------
DROP FUNCTION IF EXISTS public.calculate_ad_reward(text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_active_effects(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_leaderboard_data(text, integer) CASCADE;
DROP FUNCTION IF EXISTS public.generate_daily_objectives(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.validate_robot_plant_level(integer, uuid) CASCADE;

-- Trigger function morte (aussi CASCADE-droppée via la table ci-dessous) ----
DROP FUNCTION IF EXISTS public.update_pending_ad_rewards_updated_at() CASCADE;

-- Tables mortes (CASCADE retire index, policies RLS, triggers liés) ---------
-- pending_ad_rewards : n'était écrite que par l'edge function validate-ad-reward
--   (supprimée), remplacée par le flux server-authoritative ad-rewards.
DROP TABLE IF EXISTS public.pending_ad_rewards CASCADE;
-- daily_challenges / player_collections : features abandonnées (juin 2025),
--   jamais lues par l'app.
DROP TABLE IF EXISTS public.daily_challenges CASCADE;
DROP TABLE IF EXISTS public.player_collections CASCADE;
