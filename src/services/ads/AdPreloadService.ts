import { AdMobSimpleService } from './AdMobSimpleService';
import { AdRetryService } from './AdRetryService';

interface PreloadState {
  isPreloading: boolean;
  lastPreloadTime: number;
  preloadSuccess: boolean;
  preloadQueue: number;
  backgroundLoadEnabled: boolean;
}

export class AdPreloadService {
  private static readonly PRELOAD_COOLDOWN = 30000; // 30 secondes entre les préchargements
  private static readonly MAX_PRELOAD_QUEUE = 3; // Maximum de tentatives en queue

  private static state: PreloadState = {
    isPreloading: false,
    lastPreloadTime: 0,
    preloadSuccess: false,
    preloadQueue: 0,
    backgroundLoadEnabled: true,
  };

  /**
   * Démarre le préchargement automatique
   */
  static startBackgroundPreloading(): void {
    if (!this.state.backgroundLoadEnabled) return;

    console.log('[AdPreloadService] 🚀 Démarrage préchargement automatique');

    // Préchargement initial après 5 secondes
    setTimeout(() => {
      this.preloadIfNeeded();
    }, 5000);

    // Préchargement périodique toutes les 2 minutes
    setInterval(() => {
      this.preloadIfNeeded();
    }, 120000);
  }

  /**
   * Précharge une publicité si nécessaire
   */
  static async preloadIfNeeded(): Promise<boolean> {
    const now = Date.now();

    // Vérifications avant préchargement
    if (this.state.isPreloading) {
      console.log('[AdPreloadService] ⏳ Préchargement déjà en cours');
      return false;
    }

    if (now - this.state.lastPreloadTime < this.PRELOAD_COOLDOWN) {
      console.log('[AdPreloadService] ⏱️ Cooldown préchargement actif');
      return false;
    }

    if (this.state.preloadQueue >= this.MAX_PRELOAD_QUEUE) {
      console.log('[AdPreloadService] 📈 Queue préchargement pleine');
      return false;
    }

    // Vérifier si une pub est déjà chargée
    const adState = AdMobSimpleService.getState();
    if (adState.isAdLoaded) {
      console.log('[AdPreloadService] ✅ Publicité déjà chargée');
      return true;
    }

    return this.executePreload();
  }

  /**
   * Force le préchargement
   */
  static async forcePreload(): Promise<boolean> {
    console.log('[AdPreloadService] 🔄 Préchargement forcé');
    return this.executePreload();
  }

  /**
   * Exécute le préchargement
   */
  private static async executePreload(): Promise<boolean> {
    this.state.isPreloading = true;
    this.state.preloadQueue++;
    this.state.lastPreloadTime = Date.now();

    try {
      console.log('[AdPreloadService] 📥 Début préchargement...');

      const success = await AdRetryService.preloadAd(() =>
        AdMobSimpleService.loadAd()
      );

      this.state.preloadSuccess = success;

      if (success) {
        console.log('[AdPreloadService] ✅ Préchargement réussi');
      } else {
        console.warn('[AdPreloadService] ❌ Préchargement échoué');
      }

      return success;
    } catch (error) {
      console.error('[AdPreloadService] 💥 Erreur préchargement:', error);
      this.state.preloadSuccess = false;
      return false;
    } finally {
      this.state.isPreloading = false;
      this.state.preloadQueue = Math.max(0, this.state.preloadQueue - 1);
    }
  }

  /**
   * Planifie un préchargement après affichage d'une pub
   */
  static scheduleNextPreload(delayMs: number = 5000): void {
    if (!this.state.backgroundLoadEnabled) return;

    console.log(
      `[AdPreloadService] 📅 Préchargement planifié dans ${delayMs}ms`
    );

    setTimeout(() => {
      this.preloadIfNeeded();
    }, delayMs);
  }

  /**
   * Active/désactive le préchargement automatique
   */
  static setBackgroundLoadEnabled(enabled: boolean): void {
    this.state.backgroundLoadEnabled = enabled;
    console.log(
      `[AdPreloadService] 🔧 Préchargement automatique ${enabled ? 'activé' : 'désactivé'}`
    );
  }

  /**
   * Optimise les paramètres de préchargement selon la performance
   */
  static optimizeBasedOnPerformance(successRate: number): void {
    if (successRate < 0.3) {
      // Performance faible - réduire la fréquence
      this.setBackgroundLoadEnabled(false);
      console.log(
        '[AdPreloadService] ⚠️ Performance faible - préchargement désactivé'
      );
    } else if (successRate > 0.8) {
      // Bonne performance - préchargement plus agressif
      this.setBackgroundLoadEnabled(true);
      console.log(
        '[AdPreloadService] 🚀 Bonne performance - préchargement optimisé'
      );
    }
  }

  /**
   * Statistiques du préchargement
   */
  static getStats() {
    return {
      isPreloading: this.state.isPreloading,
      lastPreloadTime: this.state.lastPreloadTime,
      preloadSuccess: this.state.preloadSuccess,
      preloadQueue: this.state.preloadQueue,
      backgroundLoadEnabled: this.state.backgroundLoadEnabled,
      timeSinceLastPreload: this.state.lastPreloadTime
        ? Date.now() - this.state.lastPreloadTime
        : null,
    };
  }

  /**
   * Reset des statistiques
   */
  static resetStats(): void {
    this.state.preloadQueue = 0;
    this.state.preloadSuccess = false;
    this.state.lastPreloadTime = 0;
  }
}
