-- Robinet "regarde une pub → gagne des gemmes".
-- Donne au joueur F2P une vraie source de gemmes (paie en attention, pas en argent)
-- et génère du revenu pub. La récompense est créditée directement en gemmes par
-- l'edge function `ad-rewards` (branche reward_type='gems'), pas en boost temporaire.
-- Compte dans la limite quotidienne de pubs (anti-abus).
insert into public.ad_reward_configs
  (reward_type, display_name, description, emoji, base_amount, level_coefficient, max_amount, min_player_level, active, duration_minutes)
values
  ('gems', 'Gemmes gratuites', 'Regarde une pub, gagne des gemmes', '💎', 2, 0, 2, 1, true, 0)
on conflict do nothing;
