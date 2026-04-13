import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('💳 [Payment] Starting payment creation process');

    // Verify environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error('❌ [Payment] Missing Supabase credentials');
      throw new Error('Configuration du serveur incomplète');
    }

    if (!stripeSecretKey) {
      console.error('❌ [Payment] Missing Stripe secret key');
      throw new Error("Stripe n'est pas configuré");
    }

    // Create Supabase client for authentication
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ [Payment] No authorization header');
      throw new Error('Autorisation requise');
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);

    if (authError) {
      console.error('❌ [Payment] Auth error:', authError.message);
      throw new Error('Utilisateur non authentifié');
    }

    if (!user?.email) {
      console.error('❌ [Payment] No user email');
      throw new Error('Email utilisateur manquant');
    }

    console.log('✅ [Payment] User authenticated:', user.id);

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    console.log('✅ [Payment] Stripe initialized');

    // Check if Stripe customer exists
    let customerId;
    try {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log('✅ [Payment] Existing customer found:', customerId);
      } else {
        console.log('ℹ️ [Payment] No existing customer, will create one');
      }
    } catch (stripeError: any) {
      console.error(
        '❌ [Payment] Stripe customer lookup error:',
        stripeError.message
      );
      throw new Error('Erreur de connexion avec Stripe');
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const platform = body?.platform ?? 'web';
    const origin =
      req.headers.get('origin') || 'https://osfexuqvlpxrfaukfobn.supabase.co';

    console.log('ℹ️ [Payment] Platform:', platform);
    console.log('ℹ️ [Payment] Origin:', origin);

    // Determine return URLs based on platform
    const successUrl =
      platform === 'android'
        ? 'idlegrow://payment/success?session_id={CHECKOUT_SESSION_ID}'
        : `${origin}/store?payment=success&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      platform === 'android'
        ? 'idlegrow://payment/cancelled'
        : `${origin}/store?payment=cancelled`;

    console.log('ℹ️ [Payment] Success URL:', successUrl);

    // Create Stripe checkout session
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: '🚀 Early Access Pack',
                description:
                  '100 Gemmes Premium pour débloquer des fonctionnalités exclusives',
              },
              unit_amount: 999, // 9,99€ en centimes
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: user.id,
          product_type: 'gems',
          reward_gems: '100',
        },
      });

      console.log('✅ [Payment] Stripe session created:', session.id);
    } catch (stripeError: any) {
      console.error(
        '❌ [Payment] Stripe session creation error:',
        stripeError.message
      );
      throw new Error('Impossible de créer la session de paiement');
    }

    // Save purchase to database
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    try {
      const { error: insertError } = await supabaseService
        .from('purchases')
        .insert({
          user_id: user.id,
          stripe_session_id: session.id,
          amount: 999,
          currency: 'eur',
          status: 'pending',
          product_type: 'gems',
          reward_data: { gems: 100 },
        });

      if (insertError) {
        console.error(
          '❌ [Payment] Database insert error:',
          insertError.message
        );
        throw new Error("Erreur lors de l'enregistrement de l'achat");
      }

      console.log('✅ [Payment] Purchase saved to database');
    } catch (dbError: any) {
      console.error('❌ [Payment] Database error:', dbError.message);
      // Don't throw - session is created, we can still proceed
      console.warn('⚠️ [Payment] Continuing despite database error');
    }

    console.log('✅ [Payment] Payment creation successful');

    return new Response(
      JSON.stringify({
        url: session.url,
        sessionId: session.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ [Payment] Fatal error:', error.message);
    console.error('❌ [Payment] Stack:', error.stack);

    return new Response(
      JSON.stringify({
        error: error.message || 'Erreur lors de la création du paiement',
        details:
          Deno.env.get('ENV') === 'development' ? error.stack : undefined,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
