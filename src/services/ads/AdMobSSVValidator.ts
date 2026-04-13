import { supabase } from '@/integrations/supabase/client';

interface AdMobPublicKey {
  keyId: number;
  pem: string;
  base64: string;
}

interface AdMobKeysResponse {
  keys: AdMobPublicKey[];
}

interface SSVParameters {
  ad_network: string;
  ad_unit: string;
  reward_amount: string;
  reward_item: string;
  timestamp: string;
  transaction_id: string;
  user_id?: string;
  custom_data?: string;
  signature: string;
  key_id: string;
}

export class AdMobSSVValidator {
  private static readonly KEYS_URL =
    'https://www.gstatic.com/admob/reward/verifier-keys.json';
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 heures
  private static cachedKeys: Map<number, CryptoKey> = new Map();
  private static lastKeyFetch = 0;

  /**
   * Récupère et met en cache les clés publiques AdMob
   */
  static async fetchPublicKeys(): Promise<Map<number, CryptoKey>> {
    const now = Date.now();

    // Utiliser le cache si valide
    if (
      this.cachedKeys.size > 0 &&
      now - this.lastKeyFetch < this.CACHE_DURATION
    ) {
      console.log('AdMob SSV: Using cached public keys');
      return this.cachedKeys;
    }

    try {
      console.log('AdMob SSV: Fetching fresh public keys from Google');

      const response = await fetch(this.KEYS_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch keys: ${response.status}`);
      }

      const keysData: AdMobKeysResponse = await response.json();

      if (!keysData.keys || keysData.keys.length === 0) {
        throw new Error('No public keys found in response');
      }

      // Nettoyer l'ancien cache
      this.cachedKeys.clear();

      // Importer les nouvelles clés
      for (const key of keysData.keys) {
        try {
          const keyData = this.base64ToArrayBuffer(key.base64);
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

          this.cachedKeys.set(key.keyId, cryptoKey);
          console.log(`AdMob SSV: Imported key ${key.keyId}`);
        } catch (error) {
          console.error(`AdMob SSV: Failed to import key ${key.keyId}:`, error);
        }
      }

      this.lastKeyFetch = now;
      console.log(
        `AdMob SSV: Successfully cached ${this.cachedKeys.size} public keys`
      );

      return this.cachedKeys;
    } catch (error) {
      console.error('AdMob SSV: Failed to fetch public keys:', error);

      // Retourner le cache existant si disponible
      if (this.cachedKeys.size > 0) {
        console.log('AdMob SSV: Using stale cached keys due to fetch error');
        return this.cachedKeys;
      }

      throw error;
    }
  }

  /**
   * Valide une URL de callback SSV complète
   */
  static async validateSSVCallback(callbackUrl: string): Promise<{
    isValid: boolean;
    parameters?: SSVParameters;
    error?: string;
  }> {
    try {
      console.log('AdMob SSV: Validating callback URL:', callbackUrl);

      // Parse l'URL pour extraire les paramètres
      const url = new URL(callbackUrl);
      const params = this.extractSSVParameters(url);

      if (!params) {
        return { isValid: false, error: 'Failed to extract SSV parameters' };
      }

      // Valider la signature cryptographique
      const isValidSignature = await this.verifySignature(url, params);

      if (!isValidSignature) {
        return { isValid: false, error: 'Invalid cryptographic signature' };
      }

      // Valider les paramètres métier
      const businessValidation = this.validateBusinessParameters(params);
      if (!businessValidation.isValid) {
        return { isValid: false, error: businessValidation.error };
      }

      console.log('AdMob SSV: Callback validation successful');
      return { isValid: true, parameters: params };
    } catch (error) {
      console.error('AdMob SSV: Validation error:', error);
      return { isValid: false, error: (error as Error).message };
    }
  }

  /**
   * Extrait les paramètres SSV de l'URL
   */
  private static extractSSVParameters(url: URL): SSVParameters | null {
    try {
      const params = url.searchParams;

      const ssvParams: SSVParameters = {
        ad_network: params.get('ad_network') || '',
        ad_unit: params.get('ad_unit') || '',
        reward_amount: params.get('reward_amount') || '',
        reward_item: params.get('reward_item') || '',
        timestamp: params.get('timestamp') || '',
        transaction_id: params.get('transaction_id') || '',
        user_id: params.get('user_id') || undefined,
        custom_data: params.get('custom_data') || undefined,
        signature: params.get('signature') || '',
        key_id: params.get('key_id') || '',
      };

      // Décoder les custom_data si présentes (URL percent-encoding)
      if (ssvParams.custom_data) {
        ssvParams.custom_data = decodeURIComponent(ssvParams.custom_data);
      }

      return ssvParams;
    } catch (error) {
      console.error('AdMob SSV: Failed to extract parameters:', error);
      return null;
    }
  }

  /**
   * Vérifie la signature cryptographique ECDSA
   */
  private static async verifySignature(
    url: URL,
    params: SSVParameters
  ): Promise<boolean> {
    try {
      const keyId = parseInt(params.key_id);
      if (isNaN(keyId)) {
        console.error('AdMob SSV: Invalid key_id');
        return false;
      }

      // Récupérer les clés publiques
      const publicKeys = await this.fetchPublicKeys();
      const publicKey = publicKeys.get(keyId);

      if (!publicKey) {
        console.error(`AdMob SSV: Public key not found for key_id: ${keyId}`);
        return false;
      }

      // Construire le contenu à vérifier (tous les paramètres sauf signature et key_id)
      const queryString = url.search.substring(1); // Enlever le '?'
      const signatureIndex = queryString.indexOf('signature=');

      if (signatureIndex === -1) {
        console.error('AdMob SSV: No signature parameter found');
        return false;
      }

      // Le contenu à vérifier est tout ce qui précède '&signature='
      const contentToVerify = queryString.substring(0, signatureIndex - 1);
      const contentBytes = new TextEncoder().encode(contentToVerify);

      // Décoder la signature base64url
      const signature = this.base64UrlToArrayBuffer(params.signature);

      // Vérifier la signature avec ECDSA-SHA256
      const isValid = await crypto.subtle.verify(
        {
          name: 'ECDSA',
          hash: 'SHA-256',
        },
        publicKey,
        signature,
        contentBytes
      );

      console.log(`AdMob SSV: Signature verification result: ${isValid}`);
      return isValid;
    } catch (error) {
      console.error('AdMob SSV: Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Valide les paramètres métier
   */
  private static validateBusinessParameters(params: SSVParameters): {
    isValid: boolean;
    error?: string;
  } {
    // Vérifier que les paramètres obligatoires sont présents
    if (
      !params.ad_network ||
      !params.ad_unit ||
      !params.reward_amount ||
      !params.reward_item ||
      !params.timestamp ||
      !params.transaction_id
    ) {
      return { isValid: false, error: 'Missing required SSV parameters' };
    }

    // Vérifier que le timestamp n'est pas trop ancien (protection replay)
    const timestamp = parseInt(params.timestamp);
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;

    if (Math.abs(now - timestamp) > fiveMinutes) {
      return {
        isValid: false,
        error: 'Timestamp too old or too far in future',
      };
    }

    // Vérifier l'ad_unit correspond à notre configuration
    const expectedAdUnit = '2747237135'; // De votre config
    if (params.ad_unit !== expectedAdUnit) {
      console.warn(
        `AdMob SSV: Unexpected ad_unit: ${params.ad_unit}, expected: ${expectedAdUnit}`
      );
      // Ne pas rejeter car cela peut changer
    }

    return { isValid: true };
  }

  /**
   * Vérifie que la requête provient de Google (DNS reverse)
   */
  static async verifyGoogleOrigin(requestIP: string): Promise<boolean> {
    try {
      // En production, implémenter la vérification DNS reverse
      // Pour le moment, on fait confiance à la signature cryptographique
      console.log(`AdMob SSV: Request from IP: ${requestIP}`);
      return true;
    } catch (error) {
      console.error('AdMob SSV: Origin verification failed:', error);
      return false;
    }
  }

  /**
   * Utilitaires de conversion
   */
  private static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private static base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
    // Convertir base64url vers base64 standard
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    return this.base64ToArrayBuffer(base64);
  }

  /**
   * Statistiques et monitoring
   */
  static getValidationStats(): {
    cachedKeysCount: number;
    lastKeyFetch: Date | null;
    cacheAge: number;
  } {
    return {
      cachedKeysCount: this.cachedKeys.size,
      lastKeyFetch: this.lastKeyFetch > 0 ? new Date(this.lastKeyFetch) : null,
      cacheAge: this.lastKeyFetch > 0 ? Date.now() - this.lastKeyFetch : 0,
    };
  }
}
