-- Puits de gemmes "doux" (2026-06-25) : dépenser des gemmes pour un boost
-- temporaire (au lieu de regarder une pub). Donne enfin une raison RÉCURRENTE
-- de gagner/dépenser des gemmes (la monétisation reposait sur des achats
-- one-time → ~864 gemmes à vie, aucune raison de payer ensuite).
--
-- Soft : prix accessibles (un joueur F2P à ~10 gemmes/jour peut s'en payer 1-2),
-- ça concurrence la pub gratuite sans la remplacer. Server-authoritative.
--
-- Appliqué via `db query --linked` (db push cassé par désync historique).

-- Prix en gemmes, sur la table de config (source de vérité serveur).
ALTER TABLE public.ad_reward_configs ADD COLUMN IF NOT EXISTS gem_cost integer;

UPDATE public.ad_reward_configs SET gem_cost = 4 WHERE reward_type = 'coin_boost';
UPDATE public.ad_reward_configs SET gem_cost = 3 WHERE reward_type = 'gem_boost';
UPDATE public.ad_reward_configs SET gem_cost = 3 WHERE reward_type = 'growth_speed';
-- 'gems' (pub→gemmes) n'est pas achetable en gemmes : gem_cost reste NULL.

-- RPC : débit atomique des gemmes + grant/stack du boost (cap 6h), telemetry.
-- Modèle : claim_daily_reward (gemmes + active_effects) + purchase_upgrade_atomic.
CREATE OR REPLACE FUNCTION public.spend_gems_for_boost(
  p_user_id uuid,
  p_reward_type text
) RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_garden   public.player_gardens%ROWTYPE;
  v_cfg      public.ad_reward_configs%ROWTYPE;
  v_existing public.active_effects%ROWTYPE;
  v_cost     integer;
  v_expires  timestamptz;
  v_cap      timestamptz := now() + interval '360 minutes';
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_reward_type NOT IN ('coin_boost','gem_boost','growth_speed','growth_boost') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid boost type');
  END IF;

  SELECT * INTO v_cfg FROM public.ad_reward_configs
    WHERE reward_type = p_reward_type AND active = true;
  IF NOT FOUND OR COALESCE(v_cfg.duration_minutes, 0) <= 0
     OR COALESCE(v_cfg.gem_cost, 0) <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Boost not purchasable');
  END IF;
  v_cost := v_cfg.gem_cost;

  SELECT * INTO v_garden FROM public.player_gardens
    WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Garden not found');
  END IF;

  IF COALESCE(v_garden.gems, 0) < v_cost THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient gems',
      'required_gems', v_cost, 'current_gems', COALESCE(v_garden.gems, 0));
  END IF;

  UPDATE public.player_gardens
    SET gems = GREATEST(0, COALESCE(gems, 0) - v_cost), last_played = now()
    WHERE user_id = p_user_id;

  -- Stack avec un boost existant du même type (cap 6h), sinon nouveau.
  SELECT * INTO v_existing FROM public.active_effects
    WHERE user_id = p_user_id AND effect_type = p_reward_type AND expires_at >= now()
    ORDER BY expires_at DESC LIMIT 1 FOR UPDATE;

  IF FOUND THEN
    v_expires := LEAST(v_existing.expires_at + (v_cfg.duration_minutes || ' minutes')::interval, v_cap);
    UPDATE public.active_effects
      SET expires_at = v_expires, effect_value = GREATEST(v_cfg.base_amount, v_existing.effect_value)
      WHERE id = v_existing.id;
  ELSE
    v_expires := LEAST(now() + (v_cfg.duration_minutes || ' minutes')::interval, v_cap);
    INSERT INTO public.active_effects (user_id, effect_type, effect_value, expires_at, source)
      VALUES (p_user_id, p_reward_type, v_cfg.base_amount, v_expires, 'gem_purchase');
  END IF;

  INSERT INTO public.economy_events (user_id, event_type, gems_delta, meta)
    VALUES (p_user_id, 'gem_boost_purchase', -v_cost,
            jsonb_build_object('reward_type', p_reward_type, 'minutes', v_cfg.duration_minutes));

  RETURN json_build_object('success', true, 'effect_type', p_reward_type,
    'gem_cost', v_cost, 'expires_at', v_expires,
    'new_gem_balance', GREATEST(0, COALESCE(v_garden.gems, 0) - v_cost));
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_gems_for_boost(uuid, text) TO authenticated;
