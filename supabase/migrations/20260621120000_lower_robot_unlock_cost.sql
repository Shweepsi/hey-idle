-- Baisse le coût en pièces du déblocage du robot (revenu passif) de 400k à 150k,
-- pour rendre le passif accessible plus tôt (le jeu devient "idle" plus vite).
-- Coût en gemmes inchangé (50) — décision produit du 2026-06-21.
-- Appliqué en live via l'API Management le 2026-06-21 ; cette migration garde
-- la base reproductible.
UPDATE public.level_upgrades SET cost_coins = 150000 WHERE name = 'auto_harvest';
