import {
  AdMob,
  RewardAdOptions,
  AdmobConsentStatus,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { AdMonitoringService } from './AdMonitoringService';

interface SimpleAdState {
  isInitialized: boolean;
  isAdLoaded: boolean;
  isAdLoading: boolean;
  lastError: string | null;
  lastErrorCode: string | null;
  isTestMode: boolean;
  retryCount: number;
  lastRetryAt: number | null;
  errorCount: number;
  unknownErrorCount: number;
  lastUnknownErrorAt: number | null;
  autoFallbackEnabled: boolean;
  fallbackTriggered: boolean;
}

interface AdResult {
  success: boolean;
  rewarded: boolean;
  error?: string;
  errorCode?: string;
}

/**
 * Service AdMob simplifié et optimisé
 * Se concentre uniquement sur l'affichage des publicités
 * La gestion des récompenses est déléguée à l'edge function
 */
export class AdMobSimpleService {
  private static readonly AD_UNIT_ID = 'ca-app-pub-4824355487707598/1680280074';
  private static readonly TEST_AD_UNIT_ID =
    'ca-app-pub-3940256099942544/5224354917'; // Google test ID
  private static readonly MAX_RETRY_COUNT = 3;
  private static readonly RETRY_DELAYS = [2000, 5000, 10000]; // 2s, 5s, 10s
  private static readonly MAX_UNKNOWN_ERRORS = 3; // Threshold for auto-fallback
  private static readonly UNKNOWN_ERROR_WINDOW = 10 * 60 * 1000; // 10 minutes

  private static state: SimpleAdState = {
    isInitialized: false,
    isAdLoaded: false,
    isAdLoading: false,
    lastError: null,
    lastErrorCode: null,
    isTestMode: false,
    retryCount: 0,
    lastRetryAt: null,
    errorCount: 0,
    unknownErrorCount: 0,
    lastUnknownErrorAt: null,
    autoFallbackEnabled: true,
    fallbackTriggered: false,
  };

  static async initialize(testMode: boolean = false): Promise<boolean> {
    try {
      if (!(await Capacitor.isNativePlatform())) {
        console.log('[AdMobSimple] ❌ Pas sur plateforme native');
        this.state.lastError =
          'AdMob nécessite une plateforme native (iOS/Android)';
        return false;
      }

      if (this.state.isInitialized && this.state.isTestMode === testMode) {
        return true;
      }

      this.state.isTestMode = testMode;

      // UMP / GDPR consent — must run before AdMob.initialize() so the SDK
      // respects user choice. required by Google for EU users.
      try {
        const consentInfo = await AdMob.requestConsentInfo();
        if (
          consentInfo.isConsentFormAvailable &&
          consentInfo.status === AdmobConsentStatus.REQUIRED
        ) {
          await AdMob.showConsentForm();
        }
      } catch (consentError) {
        console.warn(
          '[AdMobSimple] ⚠️ UMP consent flow failed, continuing:',
          consentError
        );
      }

      const initConfig = {
        testingDevices: testMode ? ['DEVICE_ID_EMULATOR'] : [],
        initializeForTesting: testMode,
      };

      console.log(
        `[AdMobSimple] 🔧 Configuration d'initialisation:`,
        initConfig
      );
      await AdMob.initialize(initConfig);

      this.state.isInitialized = true;
      this.state.lastError = null;
      this.state.lastErrorCode = null;

      console.log(
        `[AdMobSimple] ✅ Initialisé (${testMode ? 'TEST' : 'PROD'})`
      );
      return true;
    } catch (error) {
      console.error('[AdMobSimple] ❌ Erreur initialisation:', error);
      const { message, code } = this.parseError(error as Error);
      this.state.lastError = message;
      this.state.lastErrorCode = code;
      return false;
    }
  }

  static async loadAd(retryCount: number = 0): Promise<boolean> {
    try {
      if (!(await this.initialize(this.state.isTestMode))) {
        return false;
      }

      if (this.state.isAdLoaded || this.state.isAdLoading) {
        return this.state.isAdLoaded;
      }

      this.state.isAdLoading = true;
      this.state.lastError = null;
      this.state.lastErrorCode = null;

      const adUnitId = this.state.isTestMode
        ? this.TEST_AD_UNIT_ID
        : this.AD_UNIT_ID;
      const options: RewardAdOptions = {
        adId: adUnitId,
        isTesting: this.state.isTestMode,
      };

      console.log(`[AdMobSimple] 📡 Configuration de chargement:`, {
        adUnitId,
        isTestMode: this.state.isTestMode,
        platform: Capacitor.getPlatform(),
        isNative: await Capacitor.isNativePlatform(),
      });

      console.log(
        `[AdMobSimple] 🔄 Chargement pub (${this.state.isTestMode ? 'TEST' : 'PROD'}): ${adUnitId}`
      );
      AdMonitoringService.startAdLoad();
      await AdMob.prepareRewardVideoAd(options);

      this.state.isAdLoaded = true;
      this.state.isAdLoading = false;
      this.state.retryCount = 0;

      AdMonitoringService.recordAdSuccess();
      console.log('[AdMobSimple] ✅ Publicité chargée');
      return true;
    } catch (error) {
      console.error('[AdMobSimple] ❌ Erreur chargement:', error);
      this.state.isAdLoading = false;

      const { message, code } = this.parseError(error as Error);
      this.state.lastError = message;
      this.state.lastErrorCode = code;

      AdMonitoringService.recordAdFailure(code, message);

      // Retry logic pour erreurs récupérables
      if (this.shouldRetry(error as Error, retryCount)) {
        const delay = this.RETRY_DELAYS[retryCount] || 10000;
        console.log(
          `[AdMobSimple] 🔄 Retry ${retryCount + 1}/${this.MAX_RETRY_COUNT} dans ${delay}ms`
        );

        this.state.retryCount = retryCount + 1;
        this.state.lastRetryAt = Date.now();

        return new Promise((resolve) => {
          setTimeout(async () => {
            const result = await this.loadAd(retryCount + 1);
            resolve(result);
          }, delay);
        });
      }

      return false;
    }
  }

  static async showAd(): Promise<AdResult> {
    try {
      // Chargement si nécessaire
      if (!this.state.isAdLoaded) {
        const loaded = await this.loadAd();
        if (!loaded) {
          return {
            success: false,
            rewarded: false,
            error: this.state.lastError || 'Impossible de charger la publicité',
            errorCode: this.state.lastErrorCode || undefined,
          };
        }
      }

      console.log(
        `[AdMobSimple] 🎬 Affichage publicité (${this.state.isTestMode ? 'TEST' : 'PROD'})`
      );
      const result = await AdMob.showRewardVideoAd();

      // Vérification si l'utilisateur a été récompensé
      const wasRewarded = !!(
        result &&
        typeof result === 'object' &&
        'type' in result &&
        'amount' in result
      );

      console.log(
        `[AdMobSimple] 🎯 Résultat: récompensé=${wasRewarded}`,
        result
      );

      // Nettoyage
      this.cleanup();

      // Préchargement pour la prochaine fois
      this.preloadNext();

      return {
        success: true,
        rewarded: wasRewarded,
      };
    } catch (error) {
      console.error('[AdMobSimple] ❌ Erreur affichage:', error);
      const { message, code } = this.parseError(error as Error);
      this.state.lastError = message;
      this.state.lastErrorCode = code;
      this.cleanup();

      return {
        success: false,
        rewarded: false,
        error: message,
        errorCode: code,
      };
    }
  }

  private static cleanup(): void {
    this.state.isAdLoaded = false;
    this.state.isAdLoading = false;
  }

  private static preloadNext(): void {
    // Déléguer le préchargement au service dédié
    // Le service AdPreloadService gérera la logique de préchargement
    console.log('[AdMobSimple] 📲 Préchargement délégué au service');
  }

  private static shouldRetry(error: Error, currentRetryCount: number): boolean {
    if (currentRetryCount >= this.MAX_RETRY_COUNT) {
      return false;
    }

    const message = error.message.toLowerCase();

    // Retry pour NO_FILL et erreurs réseau
    return (
      message.includes('no_fill') ||
      message.includes('no ad') ||
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection')
    );
  }

  private static parseError(error: Error): { message: string; code: string } {
    const errorStr = error.toString().toLowerCase();
    const fullError = error.toString();
    let code = 'UNKNOWN';
    let message = 'Erreur lors du chargement de la publicité';

    // Log detailed error information for UNKNOWN errors
    console.error('[AdMobSimple] 🔍 Detailed error analysis:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      fullString: fullError,
      lowerString: errorStr,
      timestamp: new Date().toISOString(),
    });

    // Codes d'erreur AdMob courants
    if (errorStr.includes('no_fill') || errorStr.includes('no ad available')) {
      code = 'NO_FILL';
      message =
        '❌ Aucune publicité disponible actuellement\n💡 Ceci est normal pour les nouvelles applications';
    } else if (
      errorStr.includes('network') ||
      errorStr.includes('connection')
    ) {
      code = 'NETWORK_ERROR';
      message = '🌐 Problème de connexion internet';
    } else if (errorStr.includes('timeout')) {
      code = 'TIMEOUT';
      message = '⏱️ Timeout lors du chargement';
    } else if (errorStr.includes('internal_error')) {
      code = 'INTERNAL_ERROR';
      message = '⚙️ Erreur interne AdMob';
    } else if (errorStr.includes('invalid_request')) {
      code = 'INVALID_REQUEST';
      message = '❓ Configuration publicitaire invalide';
    } else if (errorStr.includes('app_not_approved')) {
      code = 'APP_NOT_APPROVED';
      message = "📱 Application en attente d'approbation AdMob";
    } else if (
      errorStr.includes('ad_not_ready') ||
      errorStr.includes('not_loaded')
    ) {
      code = 'AD_NOT_READY';
      message = '⏳ Publicité pas encore prête - Veuillez patienter';
    } else if (errorStr.includes('quota') || errorStr.includes('limit')) {
      code = 'QUOTA_EXCEEDED';
      message = '📊 Limite quotidienne AdMob atteinte';
    } else if (
      errorStr.includes('configuration') ||
      errorStr.includes('setup')
    ) {
      code = 'CONFIG_ERROR';
      message = '⚙️ Erreur de configuration AdMob - Vérifiez la console';
    } else {
      // Enhanced UNKNOWN error handling
      console.warn('[AdMobSimple] ⚠️ UNKNOWN ERROR detected:', {
        originalError: fullError,
        errorType: typeof error,
        hasMessage: !!error.message,
        hasStack: !!error.stack,
        isAdMobError:
          fullError.includes('AdMob') || fullError.includes('admob'),
        timestamp: new Date().toISOString(),
      });

      this.handleUnknownError();
      message = '❓ Erreur inconnue AdMob - Vérifiez la console AdMob';
    }

    // Track error counts
    this.state.errorCount++;

    return { message, code };
  }

  private static handleUnknownError(): void {
    const now = Date.now();
    this.state.unknownErrorCount++;
    this.state.lastUnknownErrorAt = now;

    // Check if we should trigger auto-fallback to test mode
    if (
      this.state.autoFallbackEnabled &&
      !this.state.fallbackTriggered &&
      !this.state.isTestMode &&
      this.state.unknownErrorCount >= this.MAX_UNKNOWN_ERRORS
    ) {
      console.warn(
        `[AdMobSimple] 🚨 ${this.state.unknownErrorCount} erreurs UNKNOWN détectées - Activation du mode test automatique`
      );
      this.state.fallbackTriggered = true;
      this.state.isTestMode = true;
      this.state.isInitialized = false; // Force reinit
      this.cleanup();
    }
  }

  private static getErrorMessage(error: Error): string {
    return this.parseError(error).message;
  }

  static getState(): SimpleAdState {
    return { ...this.state };
  }

  static getDiagnostics() {
    return {
      adUnitId: this.state.isTestMode ? this.TEST_AD_UNIT_ID : this.AD_UNIT_ID,
      testAdUnitId: this.TEST_AD_UNIT_ID,
      prodAdUnitId: this.AD_UNIT_ID,
      state: this.state,
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      retryInfo: {
        maxRetries: this.MAX_RETRY_COUNT,
        currentRetries: this.state.retryCount,
        lastRetryAt: this.state.lastRetryAt,
        retryDelays: this.RETRY_DELAYS,
      },
      errorTracking: {
        totalErrors: this.state.errorCount,
        unknownErrors: this.state.unknownErrorCount,
        lastUnknownErrorAt: this.state.lastUnknownErrorAt,
        autoFallbackEnabled: this.state.autoFallbackEnabled,
        fallbackTriggered: this.state.fallbackTriggered,
        maxUnknownErrorsThreshold: this.MAX_UNKNOWN_ERRORS,
        unknownErrorWindow: this.UNKNOWN_ERROR_WINDOW,
      },
      monitoring: AdMonitoringService.exportDiagnostics(),
    };
  }

  static resetErrorTracking(): void {
    this.state.errorCount = 0;
    this.state.unknownErrorCount = 0;
    this.state.lastUnknownErrorAt = null;
    this.state.fallbackTriggered = false;
    console.log("[AdMobSimple] 🔄 Compteurs d'erreur réinitialisés");
  }

  static setAutoFallback(enabled: boolean): void {
    this.state.autoFallbackEnabled = enabled;
    console.log(
      `[AdMobSimple] 🔧 Auto-fallback ${enabled ? 'activé' : 'désactivé'}`
    );
  }

  static setTestMode(enabled: boolean): void {
    if (this.state.isTestMode !== enabled) {
      this.state.isTestMode = enabled;
      this.state.isInitialized = false; // Force réinitialisation
      this.cleanup();
      console.log(
        `[AdMobSimple] 🔧 Mode test ${enabled ? 'activé' : 'désactivé'}`
      );
    }
  }

  static isTestMode(): boolean {
    return this.state.isTestMode;
  }
}
