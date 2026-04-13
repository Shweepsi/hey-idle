import { AdReward } from '@/types/ads';

interface VisualEffect {
  id: string;
  type: 'boost_activation' | 'coin_rain' | 'gem_sparkle' | 'growth_pulse';
  duration: number;
  element?: HTMLElement;
  cleanup?: () => void;
}

export class AdEffectsService {
  private static activeEffects = new Map<string, VisualEffect>();
  private static effectCounter = 0;

  /**
   * Déclenche un effet visuel lors de l'activation d'un boost
   */
  static triggerBoostActivation(
    reward: AdReward,
    targetElement?: HTMLElement
  ): string {
    const effectId = `boost_${++this.effectCounter}`;

    console.log(
      `[AdEffectsService] ✨ Déclenchement effet boost: ${reward.type}`
    );

    let effect: VisualEffect;

    switch (reward.type) {
      case 'coin_boost':
        effect = this.createCoinRainEffect(effectId, targetElement);
        break;
      case 'gem_boost':
        effect = this.createGemSparkleEffect(effectId, targetElement);
        break;
      case 'growth_speed':
      case 'growth_boost':
        effect = this.createGrowthPulseEffect(effectId, targetElement);
        break;
      default:
        effect = this.createGenericBoostEffect(effectId, targetElement);
    }

    this.activeEffects.set(effectId, effect);

    // Auto-cleanup après la durée de l'effet
    setTimeout(() => {
      this.stopEffect(effectId);
    }, effect.duration);

    // Déclenchement du feedback haptique si disponible
    this.triggerHapticFeedback('medium');

    return effectId;
  }

  /**
   * Effet pluie de pièces
   */
  private static createCoinRainEffect(
    id: string,
    targetElement?: HTMLElement
  ): VisualEffect {
    const container = targetElement || document.body;
    const duration = 3000;

    // Créer le conteneur d'effet
    const effectContainer = document.createElement('div');
    effectContainer.id = `effect-${id}`;
    effectContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    `;

    container.appendChild(effectContainer);

    // Créer les pièces qui tombent
    const coinCount = 15;
    const coins: HTMLElement[] = [];

    for (let i = 0; i < coinCount; i++) {
      const coin = document.createElement('div');
      coin.textContent = '🪙';
      coin.style.cssText = `
        position: absolute;
        font-size: 24px;
        animation: coinFall ${duration / 1000}s linear forwards;
        left: ${Math.random() * 100}%;
        animation-delay: ${Math.random() * 2}s;
      `;

      effectContainer.appendChild(coin);
      coins.push(coin);
    }

    // Ajouter l'animation CSS
    this.addCoinFallAnimation();

    return {
      id,
      type: 'coin_rain',
      duration,
      element: effectContainer,
      cleanup: () => {
        effectContainer.remove();
      },
    };
  }

  /**
   * Effet étincelles de gemmes
   */
  private static createGemSparkleEffect(
    id: string,
    targetElement?: HTMLElement
  ): VisualEffect {
    const container = targetElement || document.body;
    const duration = 2500;

    const effectContainer = document.createElement('div');
    effectContainer.id = `effect-${id}`;
    effectContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 9999;
    `;

    container.appendChild(effectContainer);

    // Créer les étincelles
    const sparkleCount = 20;

    for (let i = 0; i < sparkleCount; i++) {
      const sparkle = document.createElement('div');
      sparkle.textContent = '💎';
      sparkle.style.cssText = `
        position: absolute;
        font-size: 16px;
        animation: gemSparkle ${duration / 1000}s ease-out forwards;
        animation-delay: ${Math.random() * 1}s;
      `;

      const angle = (i / sparkleCount) * Math.PI * 2;
      const distance = 100 + Math.random() * 50;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      sparkle.style.setProperty('--end-x', `${x}px`);
      sparkle.style.setProperty('--end-y', `${y}px`);

      effectContainer.appendChild(sparkle);
    }

    this.addGemSparkleAnimation();

    return {
      id,
      type: 'gem_sparkle',
      duration,
      element: effectContainer,
      cleanup: () => {
        effectContainer.remove();
      },
    };
  }

  /**
   * Effet pulsation de croissance
   */
  private static createGrowthPulseEffect(
    id: string,
    targetElement?: HTMLElement
  ): VisualEffect {
    const container = targetElement || document.body;
    const duration = 2000;

    const effectContainer = document.createElement('div');
    effectContainer.id = `effect-${id}`;
    effectContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      background: radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, transparent 70%);
      animation: growthPulse ${duration / 1000}s ease-out forwards;
    `;

    container.appendChild(effectContainer);

    this.addGrowthPulseAnimation();

    return {
      id,
      type: 'growth_pulse',
      duration,
      element: effectContainer,
      cleanup: () => {
        effectContainer.remove();
      },
    };
  }

  /**
   * Effet boost générique
   */
  private static createGenericBoostEffect(
    id: string,
    targetElement?: HTMLElement
  ): VisualEffect {
    const container = targetElement || document.body;
    const duration = 1500;

    const effectContainer = document.createElement('div');
    effectContainer.id = `effect-${id}`;
    effectContainer.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 9999;
      font-size: 48px;
      animation: boostPop ${duration / 1000}s ease-out forwards;
    `;
    effectContainer.textContent = '⚡';

    container.appendChild(effectContainer);

    this.addBoostPopAnimation();

    return {
      id,
      type: 'boost_activation',
      duration,
      element: effectContainer,
      cleanup: () => {
        effectContainer.remove();
      },
    };
  }

  /**
   * Arrête un effet spécifique
   */
  static stopEffect(effectId: string): void {
    const effect = this.activeEffects.get(effectId);
    if (effect) {
      effect.cleanup?.();
      this.activeEffects.delete(effectId);
      console.log(`[AdEffectsService] 🛑 Effet ${effectId} arrêté`);
    }
  }

  /**
   * Arrête tous les effets
   */
  static stopAllEffects(): void {
    for (const [id, effect] of this.activeEffects) {
      effect.cleanup?.();
    }
    this.activeEffects.clear();
    console.log('[AdEffectsService] 🛑 Tous les effets arrêtés');
  }

  /**
   * Déclenche un feedback haptique
   */
  private static triggerHapticFeedback(
    type: 'light' | 'medium' | 'heavy' = 'medium'
  ): void {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [20],
        heavy: [30, 10, 30],
      };

      navigator.vibrate(patterns[type]);
    }
  }

  /**
   * Ajoute les animations CSS nécessaires
   */
  private static addCoinFallAnimation(): void {
    if (document.getElementById('coin-fall-animation')) return;

    const style = document.createElement('style');
    style.id = 'coin-fall-animation';
    style.textContent = `
      @keyframes coinFall {
        0% {
          transform: translateY(-100px) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(360deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private static addGemSparkleAnimation(): void {
    if (document.getElementById('gem-sparkle-animation')) return;

    const style = document.createElement('style');
    style.id = 'gem-sparkle-animation';
    style.textContent = `
      @keyframes gemSparkle {
        0% {
          transform: translate(0, 0) scale(0) rotate(0deg);
          opacity: 1;
        }
        50% {
          opacity: 1;
        }
        100% {
          transform: translate(var(--end-x), var(--end-y)) scale(1) rotate(180deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private static addGrowthPulseAnimation(): void {
    if (document.getElementById('growth-pulse-animation')) return;

    const style = document.createElement('style');
    style.id = 'growth-pulse-animation';
    style.textContent = `
      @keyframes growthPulse {
        0% {
          transform: scale(0);
          opacity: 0.8;
        }
        50% {
          opacity: 0.4;
        }
        100% {
          transform: scale(2);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  private static addBoostPopAnimation(): void {
    if (document.getElementById('boost-pop-animation')) return;

    const style = document.createElement('style');
    style.id = 'boost-pop-animation';
    style.textContent = `
      @keyframes boostPop {
        0% {
          transform: translate(-50%, -50%) scale(0) rotate(0deg);
          opacity: 1;
        }
        50% {
          transform: translate(-50%, -50%) scale(1.2) rotate(180deg);
          opacity: 1;
        }
        100% {
          transform: translate(-50%, -50%) scale(0.8) rotate(360deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Statistiques des effets
   */
  static getStats() {
    return {
      activeEffectsCount: this.activeEffects.size,
      totalEffectsTriggered: this.effectCounter,
      activeEffectIds: Array.from(this.activeEffects.keys()),
    };
  }
}
