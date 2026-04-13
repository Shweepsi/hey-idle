import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// AdMob SSV Cryptographic Validation
interface AdMobPublicKey {
  keyId: number;
  pem: string;
  base64: string;
}

interface AdMobKeysResponse {
  keys: AdMobPublicKey[];
}

// Cache des clés publiques (24h selon recommandations Google)
const cachedKeys: Map<number, CryptoKey> = new Map();
let lastKeyFetch = 0;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures

/**
 * Récupère et met en cache les clés publiques AdMob
 */
async function fetchAdMobPublicKeys(): Promise<Map<number, CryptoKey>> {
  const now = Date.now();

  // Utiliser le cache si valide
  if (cachedKeys.size > 0 && now - lastKeyFetch < CACHE_DURATION) {
    console.log('AdMob SSV: Using cached public keys');
    return cachedKeys;
  }

  try {
    console.log('AdMob SSV: Fetching fresh public keys from Google');

    const response = await fetch(
      'https://www.gstatic.com/admob/reward/verifier-keys.json'
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch keys: ${response.status}`);
    }

    const keysData: AdMobKeysResponse = await response.json();

    if (!keysData.keys || keysData.keys.length === 0) {
      throw new Error('No public keys found in response');
    }

    // Nettoyer l'ancien cache
    cachedKeys.clear();

    // Importer les nouvelles clés
    for (const key of keysData.keys) {
      try {
        const keyData = base64ToArrayBuffer(key.base64);
        const cryptoKey = await crypto.subtle.importKey(
          'spki',
          keyData,
          {
            name: 'ECDSA',
            namedCurve: 'P-256',
          },
          false,
          ['verify']
        );

        cachedKeys.set(key.keyId, cryptoKey);
        console.log(`AdMob SSV: Imported key ${key.keyId}`);
      } catch (error) {
        console.error(`AdMob SSV: Failed to import key ${key.keyId}:`, error);
      }
    }

    lastKeyFetch = now;
    console.log(
      `AdMob SSV: Successfully cached ${cachedKeys.size} public keys`
    );

    return cachedKeys;
  } catch (error) {
    console.error('AdMob SSV: Failed to fetch public keys:', error);

    // Retourner le cache existant si disponible
    if (cachedKeys.size > 0) {
      console.log('AdMob SSV: Using stale cached keys due to fetch error');
      return cachedKeys;
    }

    throw error;
  }
}

/**
 * Valide la signature cryptographique d'un callback AdMob SSV
 * Selon les spécifications Google AdMob
 */
async function validateSSVSignature(url: URL): Promise<boolean> {
  try {
    // CORRECTION CRITIQUE: Reconstruire l'URL avec HTTPS
    // AdMob signe avec https:// mais Supabase peut recevoir en http://
    const httpsUrl = new URL(url.toString().replace(/^http:/, 'https:'));

    const params = httpsUrl.searchParams;
    const signature = params.get('signature');
    const keyIdStr = params.get('key_id');

    console.log('AdMob SSV: Original URL received:', url.toString());
    console.log('AdMob SSV: HTTPS URL for validation:', httpsUrl.toString());
    console.log(
      'AdMob SSV: Query parameters:',
      Object.fromEntries(params.entries())
    );

    if (!signature || !keyIdStr) {
      console.error('AdMob SSV: Missing signature or key_id');
      return false;
    }

    const keyId = parseInt(keyIdStr);
    if (isNaN(keyId)) {
      console.error('AdMob SSV: Invalid key_id');
      return false;
    }

    // Récupérer les clés publiques
    const publicKeys = await fetchAdMobPublicKeys();
    const publicKey = publicKeys.get(keyId);

    if (!publicKey) {
      console.error(`AdMob SSV: Public key not found for key_id: ${keyId}`);
      return false;
    }

    // CORRECTION: Construire correctement le contenu à vérifier
    // Google signe l'URL complète SANS les paramètres signature et key_id
    const queryString = httpsUrl.search.substring(1); // Enlever le '?'
    console.log('AdMob SSV: HTTPS query string:', queryString);

    // Reconstruire l'URL sans signature et key_id
    const paramsToSign = new URLSearchParams();
    for (const [key, value] of params.entries()) {
      if (key !== 'signature' && key !== 'key_id') {
        paramsToSign.append(key, value);
      }
    }

    // IMPORTANT: Google utilise l'ordre alphabétique des paramètres pour la signature
    paramsToSign.sort();
    const contentToVerify = paramsToSign.toString();

    console.log(
      'AdMob SSV: Content to verify (without signature/key_id):',
      contentToVerify
    );
    console.log('AdMob SSV: Signature to verify:', signature);
    console.log('AdMob SSV: Key ID used:', keyId);

    const contentBytes = new TextEncoder().encode(contentToVerify);

    // Décoder la signature base64url
    const signatureBytes = base64UrlToArrayBuffer(signature);
    console.log(
      'AdMob SSV: Signature bytes length:',
      signatureBytes.byteLength
    );

    // Vérifier la signature avec ECDSA-SHA256
    const isValid = await crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      publicKey,
      signatureBytes,
      contentBytes
    );

    console.log(
      `AdMob SSV: Cryptographic signature validation result: ${isValid}`
    );

    if (!isValid) {
      console.error('AdMob SSV: Signature validation failed. Details:', {
        keyId,
        contentToVerify,
        signatureLength: signature.length,
        originalQuery: queryString,
      });
    }

    return isValid;
  } catch (error) {
    console.error('AdMob SSV: Signature validation failed:', error);
    return false;
  }
}

/**
 * Utilitaires de conversion
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
  // Convertir base64url vers base64 standard
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToArrayBuffer(base64);
}

interface AdMobRewardPayload {
  user_id: string;
  reward_type: string;
  reward_amount: number;
  ad_duration: number;
  signature?: string;
  source?: string; // 'client_immediate', 'ssv', etc.
  transaction_id?: string;
}

interface PendingReward {
  id: string;
  user_id: string;
  transaction_id: string;
  reward_type: string;
  initial_amount: number;
  applied_amount: number;
  source: string;
  status: 'pending' | 'confirmed' | 'revoked';
  created_at: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Test endpoint for validating configuration
  if (req.method === 'GET' && new URL(req.url).pathname.endsWith('/test')) {
    console.log('Edge Function: Test endpoint accessed');
    return new Response(
      JSON.stringify({
        success: true,
        message: 'AdMob SSV endpoint is working',
        timestamp: new Date().toISOString(),
        environment: {
          supabase_url: Deno.env.get('SUPABASE_URL') ? 'configured' : 'missing',
          service_role: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
            ? 'configured'
            : 'missing',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Handle GET requests from AdMob server-side verification
  if (req.method === 'GET') {
    const startTime = Date.now();
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    console.log('AdMob SSV: Processing callback - URL:', req.url);
    console.log(
      'AdMob SSV: Headers:',
      Object.fromEntries(req.headers.entries())
    );

    // AMÉLIORATION: Validation cryptographique robuste avec monitoring
    let signatureValid = false;
    let signatureError = null;

    try {
      signatureValid = await validateSSVSignature(url);
      console.log(`AdMob SSV: Signature validation result: ${signatureValid}`);

      if (!signatureValid) {
        console.error(
          'AdMob SSV: Cryptographic signature validation failed - processing as invalid but acknowledging'
        );
        signatureError = 'Invalid cryptographic signature';

        // AMÉLIORATION: Toujours retourner 200 OK mais logging détaillé pour analyse
        return new Response(
          JSON.stringify({
            success: true, // Pour éviter les retries Google
            processed: false,
            reason: 'invalid_signature',
            message:
              'AdMob SSV callback acknowledged but not processed due to signature validation failure',
            timestamp: new Date().toISOString(),
            processing_time: Date.now() - startTime,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      console.log('AdMob SSV: Cryptographic signature validation passed');
    } catch (error) {
      console.error('AdMob SSV: Signature validation error:', error);
      signatureError = (error as Error).message;

      // Continuer le traitement même en cas d'erreur de validation pour éviter les retries
      console.log(
        'AdMob SSV: Continuing processing despite signature validation error'
      );
    }

    // Extract AdMob SSV parameters avec décodage percent-encoding
    const adNetwork = searchParams.get('ad_network');
    const adUnit = searchParams.get('ad_unit');
    const rewardAmount = searchParams.get('reward_amount');
    const rewardItem = searchParams.get('reward_item');
    const timestamp = searchParams.get('timestamp');
    const transactionId = searchParams.get('transaction_id');
    const signature = searchParams.get('signature');
    const keyId = searchParams.get('key_id');
    let userId = searchParams.get('user_id');
    let customData = searchParams.get('custom_data');

    // AMÉLIORATION: Décodage percent-encoding complet pour custom_data
    if (customData) {
      try {
        // Double décodage pour gérer l'encodage multiple
        customData = decodeURIComponent(decodeURIComponent(customData));
        console.log('AdMob SSV: Decoded custom_data:', customData);
      } catch (error) {
        console.warn(
          'AdMob SSV: Failed to decode custom_data, trying single decode:',
          error
        );
        try {
          customData = decodeURIComponent(customData);
        } catch (fallbackError) {
          console.warn('AdMob SSV: Single decode also failed:', fallbackError);
        }
      }
    }

    console.log('Edge Function: AdMob SSV Request - Processed params:', {
      adNetwork,
      adUnit,
      rewardAmount,
      rewardItem,
      timestamp,
      transactionId,
      signature,
      keyId,
      userId,
      customData,
    });

    // Check for unreplaced placeholders and handle them
    if (userId === '{USER_ID}' || userId === 'USER_ID' || !userId) {
      console.log(
        'Edge Function: userId is placeholder or empty, checking custom_data for real values'
      );

      // Try to extract from custom_data if it contains JSON
      if (
        customData &&
        customData !== '{CUSTOM_DATA}' &&
        customData !== 'CUSTOM_DATA'
      ) {
        try {
          const parsedCustomData = JSON.parse(customData);
          if (parsedCustomData.user_id) {
            userId = parsedCustomData.user_id;
            console.log(
              'AdMob SSV: Extracted userId from custom_data:',
              userId
            );
          }
        } catch (e) {
          console.log(
            'AdMob SSV: Could not parse custom_data as JSON:',
            customData
          );
        }
      }
    }

    // If still no valid userId, return acknowledgment but don't process reward
    if (!userId || userId === '{USER_ID}' || userId === 'USER_ID') {
      console.log(
        'AdMob SSV: No valid user_id found, returning acknowledgment'
      );
      return new Response(
        JSON.stringify({
          message:
            'AdMob SSV endpoint acknowledged - no valid user_id provided',
          warning: 'Reward not processed due to missing user_id',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // AMÉLIORATION: Traitement optimisé du reward standard AdMob
    try {
      // Mapping intelligent du reward standard vers les rewards du jeu
      let rewardType = 'gems'; // Par défaut gems pour meilleure UX
      let playerLevel = 1;
      let sessionId = null;
      const validationMetadata = {};

      console.log(
        'AdMob SSV: Processing reward mapping - Standard reward_item:',
        rewardItem,
        'Amount:',
        rewardAmount
      );

      // PRIORITÉ: Extraire les détails des custom_data si disponibles
      if (
        customData &&
        customData !== '{CUSTOM_DATA}' &&
        customData !== 'CUSTOM_DATA'
      ) {
        try {
          const parsedCustomData = JSON.parse(customData);
          console.log(
            'AdMob SSV: Enhanced custom_data parsed:',
            parsedCustomData
          );

          // Extraire les métadonnées enrichies
          if (parsedCustomData.reward_type)
            rewardType = parsedCustomData.reward_type;
          if (parsedCustomData.player_level)
            playerLevel = parsedCustomData.player_level;
          if (parsedCustomData.session_id)
            sessionId = parsedCustomData.session_id;
          if (parsedCustomData.platform)
            validationMetadata.platform = parsedCustomData.platform;
          if (parsedCustomData.app_version)
            validationMetadata.app_version = parsedCustomData.app_version;
          if (parsedCustomData.validation_mode)
            validationMetadata.validation_mode =
              parsedCustomData.validation_mode;

          console.log('AdMob SSV: Extracted reward mapping:', {
            rewardType,
            playerLevel,
            sessionId,
            validationMetadata,
          });
        } catch (e) {
          console.log(
            'AdMob SSV: Custom_data parsing failed, using intelligent defaults:',
            e
          );
          // Fallback intelligent basé sur l'heure pour variety
          const hour = new Date().getHours();
          rewardType =
            hour % 3 === 0 ? 'coins' : hour % 3 === 1 ? 'gems' : 'coin_boost';
        }
      } else {
        console.log(
          'AdMob SSV: No custom_data available, using intelligent reward rotation'
        );
        // Rotation intelligente des rewards quand pas de custom_data
        const rewardRotation = ['gems', 'coins', 'coin_boost'];
        rewardType = rewardRotation[Math.floor(Date.now() / 3600000) % 3];
      }

      // Get player level if not in custom data
      if (playerLevel === 1) {
        const { data: garden } = await supabase
          .from('player_gardens')
          .select('level')
          .eq('user_id', userId)
          .single();

        if (garden?.level) {
          playerLevel = garden.level;
        }
      }

      // Calculate reward based on database configuration
      const { data: rewardConfig, error: rewardError } = await supabase
        .rpc('calculate_ad_reward', {
          reward_type_param: rewardType,
          player_level_param: playerLevel,
        })
        .single();

      if (rewardError || !rewardConfig) {
        console.error('AdMob SSV: Failed to calculate reward:', rewardError);
        return new Response(
          JSON.stringify({ error: 'Failed to calculate reward' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const adjustedAmount = rewardConfig.calculated_amount;

      console.log(
        'AdMob SSV: Processing reward for user:',
        userId,
        'Type:',
        rewardType,
        'Amount:',
        adjustedAmount,
        'Transaction:',
        transactionId
      );

      // NOUVELLE LOGIQUE: Vérifier si c'est une confirmation/révocation d'une récompense immédiate
      const { data: pendingReward } = await supabase
        .from('pending_ad_rewards')
        .select('*')
        .eq('transaction_id', transactionId)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (pendingReward) {
        console.log(
          'AdMob SSV: Found pending reward to confirm/revoke:',
          pendingReward.id
        );

        if (signatureValid) {
          // Confirmer la récompense immédiate
          const { error: confirmError } = await supabase
            .from('pending_ad_rewards')
            .update({
              status: 'confirmed',
              ssv_validation_attempt_count:
                (pendingReward.ssv_validation_attempt_count || 0) + 1,
              last_ssv_attempt: new Date().toISOString(),
              metadata: {
                ...pendingReward.metadata,
                confirmed_by_ssv: true,
                signature_validation: 'passed',
              },
            })
            .eq('id', pendingReward.id);

          if (confirmError) {
            console.error('Failed to confirm pending reward:', confirmError);
          } else {
            console.log(
              `AdMob SSV: CONFIRMED immediate reward - Transaction: ${transactionId}`
            );
          }

          await logAdReward(
            userId,
            rewardType,
            adjustedAmount,
            30,
            transactionId,
            'ssv_confirmation'
          );
        } else {
          // Révoquer la récompense immédiate
          console.log(
            `AdMob SSV: REVOKING immediate reward due to invalid signature - Transaction: ${transactionId}`
          );

          // Retirer la récompense qui avait été appliquée
          const revokeResult = await revokeReward(
            userId,
            pendingReward.reward_type,
            pendingReward.applied_amount
          );

          const { error: revokeError } = await supabase
            .from('pending_ad_rewards')
            .update({
              status: 'revoked',
              ssv_validation_attempt_count:
                (pendingReward.ssv_validation_attempt_count || 0) + 1,
              last_ssv_attempt: new Date().toISOString(),
              metadata: {
                ...pendingReward.metadata,
                revoked_reason: 'invalid_ssv_signature',
                revoke_success: revokeResult.success,
                revoke_error: revokeResult.error,
              },
            })
            .eq('id', pendingReward.id);

          if (revokeError) {
            console.error('Failed to mark reward as revoked:', revokeError);
          }

          await logAdReward(
            userId,
            rewardType,
            adjustedAmount,
            30,
            transactionId,
            'ssv_revocation'
          );
        }
      } else {
        // Nouveau reward SSV (mode déféré) - appliquer seulement si signature valide
        if (!signatureValid) {
          console.log(
            'AdMob SSV: Rejecting new SSV reward due to invalid signature'
          );

          return new Response(
            JSON.stringify({
              success: true,
              processed: false,
              reason: 'invalid_signature_deferred_reward',
              message: 'SSV reward rejected due to invalid signature',
              timestamp: new Date().toISOString(),
            }),
            {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        console.log(
          'AdMob SSV: Processing DEFERRED reward - Only incrementing ad count'
        );

        // CORRECTION: Ne faire QUE l'incrémentation du compteur ici
        // L'attribution des récompenses se fera via ad-rewards
        const cooldownResult = await updateAdCooldown(userId);

        if (cooldownResult.success) {
          await logAdReward(
            userId,
            rewardType,
            0,
            0,
            transactionId,
            'ssv_count_only'
          ); // Amount 0 car pas de reward ici
          console.log(
            `AdMob SSV: Successfully incremented ad count - Transaction: ${transactionId}`
          );
        } else {
          console.error(
            `AdMob SSV: Failed to increment ad count: ${cooldownResult.error}`
          );
        }
      }

      const processingTime = Date.now() - startTime;

      console.log(
        `AdMob SSV: Successfully processed ad count increment for user: ${userId} - Transaction ID: ${transactionId}, Processing time: ${processingTime}ms`
      );

      // AMÉLIORATION: Réponse enrichie avec métadonnées complètes
      return new Response(
        JSON.stringify({
          success: true,
          processed: true,
          message: 'Ad count incremented successfully',
          reward_details: {
            type: 'ad_count_increment',
            note: 'Actual reward will be distributed by client claim system',
          },
          user_id: userId,
          session_id: sessionId,
          validation: {
            method: 'server_side_verification',
            signature_valid: signatureValid,
            custom_data_used: !!customData,
          },
          performance: {
            processing_time_ms: processingTime,
          },
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(
        `AdMob SSV: Error processing callback: ${(error as Error).message} - Processing time: ${processingTime}ms`
      );

      // AMÉLIORATION: Toujours retourner 200 OK même en cas d'erreur système avec monitoring complet
      return new Response(
        JSON.stringify({
          success: true, // Pour Google, éviter les retries
          processed: false,
          reason: 'system_error',
          error: 'Internal processing error',
          details: (error as Error).message,
          performance: {
            processing_time_ms: processingTime,
          },
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Handle POST requests - New logic with deferred/immediate reward handling
  try {
    const contentLength = req.headers.get('content-length');
    if (!contentLength || contentLength === '0') {
      return new Response(
        JSON.stringify({ error: 'No request body provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const payload: AdMobRewardPayload = await req.json();
    console.log('AdMob reward validation request (POST):', payload);

    // Validate required fields
    if (!payload.user_id || !payload.reward_type || !payload.reward_amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check that user exists
    const { data: user, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', payload.user_id)
      .single();

    if (userError || !user) {
      console.error('User not found:', userError);
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate reward amount
    const { data: garden } = await supabase
      .from('player_gardens')
      .select('level')
      .eq('user_id', payload.user_id)
      .single();

    const playerLevel = garden?.level || 1;

    // NORMALISATION: l'alias historique « growth_boost » a été renommé en « growth_speed » dans la BDD.
    // Si nous recevons encore l'ancien identifiant, on le convertit vers le nouveau pour la recherche.
    const rewardTypeForConfig =
      payload.reward_type === 'growth_boost'
        ? 'growth_speed'
        : payload.reward_type;

    const { data: rewardConfig, error: rewardError } = await supabase
      .rpc('calculate_ad_reward', {
        reward_type_param: rewardTypeForConfig,
        player_level_param: playerLevel,
      })
      .single();

    if (rewardError || !rewardConfig) {
      console.error('Failed to calculate reward:', rewardError);
      return new Response(
        JSON.stringify({ error: 'Failed to calculate reward' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let calculatedAmount = rewardConfig.calculated_amount;

    // NORMALISATION: pour les boosts de croissance, garantir un multiplicateur >= 1
    // Certains anciens enregistrements stockaient des valeurs <1 (ex: 0.5) pour signifier « 50% plus rapide ».
    // Le moteur utilise désormais un multiplicateur >1 (ex: 2). Si nécessaire, inverser la valeur.
    if (
      payload.reward_type === 'growth_speed' &&
      calculatedAmount < 1 &&
      calculatedAmount > 0
    ) {
      calculatedAmount = 1 / calculatedAmount;
    }

    const durationMinutes = rewardConfig.duration_minutes || 30;

    // NOUVELLE LOGIQUE: Différentiation entre récompenses immédiates et différées
    const isClientImmediate = payload.source === 'client_immediate';
    const transactionId =
      payload.transaction_id ||
      `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (isClientImmediate) {
      console.log('AdMob: Processing CLIENT_IMMEDIATE reward (revocable)');

      // Apply reward immediately but mark as pending confirmation
      const result = await applyReward(
        payload.user_id,
        payload.reward_type,
        calculatedAmount,
        durationMinutes
      );

      if (!result.success) {
        console.error('Failed to apply immediate reward:', result.error);
        return new Response(JSON.stringify({ error: result.error }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Store as pending reward for possible revocation
      const { error: pendingError } = await supabase
        .from('pending_ad_rewards')
        .insert({
          user_id: payload.user_id,
          transaction_id: transactionId,
          reward_type: payload.reward_type,
          initial_amount: payload.reward_amount,
          applied_amount: calculatedAmount,
          source: 'client_immediate',
          status: 'pending',
          metadata: {
            player_level: playerLevel,
            ad_duration: payload.ad_duration,
            applied_at: new Date().toISOString(),
          },
        });

      if (pendingError) {
        console.error('Failed to store pending reward:', pendingError);
        // Continue anyway - reward was applied
      }

      await updateAdCooldown(payload.user_id);
      await logAdReward(
        payload.user_id,
        payload.reward_type,
        calculatedAmount,
        durationMinutes,
        transactionId,
        'client_immediate'
      );

      console.log(
        `Successfully applied IMMEDIATE reward (${payload.reward_type}: ${calculatedAmount}) to user ${payload.user_id} - Transaction: ${transactionId}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          applied_amount: calculatedAmount,
          reward_type: payload.reward_type,
          transaction_id: transactionId,
          status: 'applied_pending_confirmation',
          note: 'Reward applied immediately but subject to SSV confirmation',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.log('AdMob: Processing DEFERRED reward (awaiting SSV)');

      // For deferred rewards, don't apply immediately - wait for SSV
      const { error: pendingError } = await supabase
        .from('pending_ad_rewards')
        .insert({
          user_id: payload.user_id,
          transaction_id: transactionId,
          reward_type: payload.reward_type,
          initial_amount: payload.reward_amount,
          applied_amount: calculatedAmount,
          source: payload.source || 'deferred',
          status: 'pending',
          metadata: {
            player_level: playerLevel,
            ad_duration: payload.ad_duration,
            deferred_at: new Date().toISOString(),
          },
        });

      if (pendingError) {
        console.error('Failed to store deferred reward:', pendingError);
        return new Response(
          JSON.stringify({ error: 'Failed to store deferred reward' }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      console.log(
        `Successfully stored DEFERRED reward (${payload.reward_type}: ${calculatedAmount}) for user ${payload.user_id} - Transaction: ${transactionId}`
      );

      return new Response(
        JSON.stringify({
          success: true,
          calculated_amount: calculatedAmount,
          reward_type: payload.reward_type,
          transaction_id: transactionId,
          status: 'pending_ssv_confirmation',
          note: 'Reward will be applied after SSV confirmation',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in validate-ad-reward:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function calculateAdjustedReward(
  baseAmount: number,
  adDuration: number
): number {
  // Paliers de récompenses basés sur la durée
  if (adDuration >= 60) return Math.floor(baseAmount * 2.0); // 60s+ = x2
  if (adDuration >= 30) return Math.floor(baseAmount * 1.5); // 30s+ = x1.5
  if (adDuration >= 15) return baseAmount; // 15s+ = normal
  return Math.floor(baseAmount * 0.5); // <15s = réduit
}

async function applyReward(
  userId: string,
  rewardType: string,
  amount: number,
  durationMinutes?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (rewardType) {
      case 'coins':
        return await applyCoinsReward(userId, Math.floor(amount));
      case 'gems':
        return await applyGemsReward(userId, Math.floor(amount));
      case 'coin_boost':
      case 'gem_boost':
      case 'growth_speed':
        return await applyBoostReward(
          userId,
          rewardType,
          amount,
          durationMinutes || 30
        );
      default:
        return { success: false, error: 'Unknown reward type' };
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function applyCoinsReward(
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const { data: garden, error: fetchError } = await supabase
    .from('player_gardens')
    .select('coins')
    .eq('user_id', userId)
    .single();

  if (fetchError) return { success: false, error: 'Failed to fetch garden' };

  const { error: updateError } = await supabase
    .from('player_gardens')
    .update({ coins: (garden.coins || 0) + amount })
    .eq('user_id', userId);

  if (updateError) return { success: false, error: 'Failed to update coins' };

  // Logger la transaction
  await supabase.from('coin_transactions').insert({
    user_id: userId,
    amount: amount,
    transaction_type: 'ad_reward',
    description: `Récompense pub: ${amount} pièces`,
  });

  return { success: true };
}

async function applyGemsReward(
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const { data: garden, error: fetchError } = await supabase
    .from('player_gardens')
    .select('gems')
    .eq('user_id', userId)
    .single();

  if (fetchError) return { success: false, error: 'Failed to fetch garden' };

  const { error: updateError } = await supabase
    .from('player_gardens')
    .update({ gems: (garden.gems || 0) + amount })
    .eq('user_id', userId);

  if (updateError) return { success: false, error: 'Failed to update gems' };

  return { success: true };
}

async function applyBoostReward(
  userId: string,
  effectType: string,
  effectValue: number,
  durationMinutes: number
): Promise<{ success: boolean; error?: string }> {
  // Vérifier si un boost du même type existe déjà
  const { data: existingBoost, error: checkError } = await supabase
    .from('active_effects')
    .select('*')
    .eq('user_id', userId)
    .eq('effect_type', effectType)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (checkError && checkError.code !== 'PGRST116') {
    return { success: false, error: 'Failed to check existing boost' };
  }

  if (existingBoost) {
    // Étendre la durée du boost existant (ajout additif)
    const currentExpires = new Date(existingBoost.expires_at).getTime();
    const newExpires = new Date(
      currentExpires + durationMinutes * 60 * 1000
    ).toISOString();

    const { error: updateError } = await supabase
      .from('active_effects')
      .update({ expires_at: newExpires })
      .eq('id', existingBoost.id);

    if (updateError)
      return { success: false, error: 'Failed to extend boost duration' };

    console.log(`Boost ${effectType} extended to ${newExpires}`);
  } else {
    // Créer un nouveau boost
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const { error } = await supabase.from('active_effects').insert({
      user_id: userId,
      effect_type: effectType,
      effect_value: effectValue,
      expires_at: expiresAt.toISOString(),
      source: 'ad_reward',
    });

    if (error)
      return { success: false, error: 'Failed to create boost effect' };
  }

  return { success: true };
}

/**
 * Révoque une récompense qui avait été appliquée immédiatement
 * Utilisé quand Google rejette la signature SSV
 */
async function revokeReward(
  userId: string,
  rewardType: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(
      `Revoking ${rewardType} reward of ${amount} for user ${userId}`
    );

    switch (rewardType) {
      case 'coins':
        return await revokeCoinsReward(userId, Math.floor(amount));
      case 'gems':
        return await revokeGemsReward(userId, Math.floor(amount));
      case 'coin_boost':
      case 'gem_boost':
      case 'growth_speed':
        return await revokeBoostReward(userId, rewardType);
      default:
        return { success: false, error: 'Unknown reward type for revocation' };
    }
  } catch (error) {
    console.error('Error revoking reward:', error);
    return { success: false, error: (error as Error).message };
  }
}

async function revokeCoinsReward(
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const { data: garden, error: fetchError } = await supabase
    .from('player_gardens')
    .select('coins')
    .eq('user_id', userId)
    .single();

  if (fetchError)
    return { success: false, error: 'Failed to fetch garden for revocation' };

  // S'assurer qu'on ne va pas en négatif
  const newCoins = Math.max(0, (garden.coins || 0) - amount);

  const { error: updateError } = await supabase
    .from('player_gardens')
    .update({ coins: newCoins })
    .eq('user_id', userId);

  if (updateError) return { success: false, error: 'Failed to revoke coins' };

  // Logger la révocation
  await supabase.from('coin_transactions').insert({
    user_id: userId,
    amount: -amount,
    transaction_type: 'ad_revocation',
    description: `Révocation pub: -${amount} pièces (signature invalide)`,
  });

  return { success: true };
}

async function revokeGemsReward(
  userId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  const { data: garden, error: fetchError } = await supabase
    .from('player_gardens')
    .select('gems')
    .eq('user_id', userId)
    .single();

  if (fetchError)
    return {
      success: false,
      error: 'Failed to fetch garden for gem revocation',
    };

  // S'assurer qu'on ne va pas en négatif
  const newGems = Math.max(0, (garden.gems || 0) - amount);

  const { error: updateError } = await supabase
    .from('player_gardens')
    .update({ gems: newGems })
    .eq('user_id', userId);

  if (updateError) return { success: false, error: 'Failed to revoke gems' };

  return { success: true };
}

async function revokeBoostReward(
  userId: string,
  effectType: string
): Promise<{ success: boolean; error?: string }> {
  // Pour les boosts, on marque les effets actifs comme expirés
  const { error } = await supabase
    .from('active_effects')
    .update({
      expires_at: new Date().toISOString(), // Expire immédiatement
      source: 'ad_revocation',
    })
    .eq('user_id', userId)
    .eq('effect_type', effectType)
    .eq('source', 'ad_reward')
    .gt('expires_at', new Date().toISOString()); // Seulement les effets encore actifs

  if (error) return { success: false, error: 'Failed to revoke boost effect' };

  return { success: true };
}

async function updateAdCooldown(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  console.log('Edge Function: Updating ad cooldown for user:', userId);

  // Get current cooldown to increment daily count correctly
  const { data: currentCooldown } = await supabase
    .from('ad_cooldowns')
    .select('daily_count, daily_reset_date')
    .eq('user_id', userId)
    .maybeSingle();

  let newDailyCount = 1;

  if (currentCooldown) {
    // If same day, increment counter
    if (currentCooldown.daily_reset_date === today) {
      newDailyCount = (currentCooldown.daily_count || 0) + 1;
    }
    // Otherwise it's a new day, start at 1
  }

  const { error } = await supabase.from('ad_cooldowns').upsert(
    {
      user_id: userId,
      daily_count: newDailyCount,
      daily_reset_date: today,
      last_ad_watched: now.toISOString(),
      updated_at: now.toISOString(),
    },
    {
      onConflict: 'user_id',
      ignoreDuplicates: false,
    }
  );

  if (error) {
    console.error('Edge Function: Failed to update ad cooldown:', error);
    return { success: false, error: error.message };
  }

  console.log(
    `Edge Function: Ad watched ${newDailyCount}/5 today for user ${userId}`
  );
  return { success: true };
}

async function logAdReward(
  userId: string,
  rewardType: string,
  amount: number,
  adDuration: number,
  transactionId?: string,
  source?: string
): Promise<void> {
  await supabase.from('ad_sessions').insert({
    user_id: userId,
    reward_type: rewardType,
    reward_amount: amount,
    reward_data: {
      ad_duration: adDuration,
      applied_at: new Date().toISOString(),
      source: source || 'server_validation',
      transaction_id: transactionId,
      validation_method: 'cryptographic_ssv',
    },
  });
}
