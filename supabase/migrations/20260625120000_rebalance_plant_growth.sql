-- Rééquilibrage de l'économie des plantes (2026-06-25).
--
-- Problème : avec les anciens base_growth_seconds, le profit/seconde n'était
-- PAS monotone par tier — la patate de DÉPART (niveau 1) mettait 360s à pousser
-- (profit/sec ≈ 0.26, expérience nouveau joueur rebutante), et la salade (niv.5)
-- écrasait tout. La meilleure stratégie était de spammer une seule plante.
--
-- Fix : ré-étaler les temps de pousse (~×1.45/tier, < la croissance du coût ×1.55)
-- pour que CHAQUE tier supérieur soit un vrai upgrade en profit/seconde. Starter
-- rendu réactif (15s). Vérifié monotone à PL5/20/100 par scripts/sim-plant-economy.mjs.
-- Marges et coûts inchangés. Mirroré dans src/economy/config.ts (PLANT_SCHEDULE).

UPDATE public.plant_types SET base_growth_seconds = 15  WHERE name = 'potato';
UPDATE public.plant_types SET base_growth_seconds = 22  WHERE name = 'carrot';
UPDATE public.plant_types SET base_growth_seconds = 33  WHERE name = 'tomato';
UPDATE public.plant_types SET base_growth_seconds = 50  WHERE name = 'cucumber';
UPDATE public.plant_types SET base_growth_seconds = 75  WHERE name = 'lettuce';
UPDATE public.plant_types SET base_growth_seconds = 110 WHERE name = 'broccoli';
UPDATE public.plant_types SET base_growth_seconds = 165 WHERE name = 'banana';
UPDATE public.plant_types SET base_growth_seconds = 250 WHERE name = 'apple';
UPDATE public.plant_types SET base_growth_seconds = 370 WHERE name = 'pear';
UPDATE public.plant_types SET base_growth_seconds = 540 WHERE name = 'strawberry';
