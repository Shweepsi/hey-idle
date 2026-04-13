import { AdReward } from '@/types/ads';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class AdCacheService {
  private static cache = new Map<string, CacheEntry<any>>();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  static set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  static has(key: string): boolean {
    return this.get(key) !== null;
  }

  static delete(key: string): void {
    this.cache.delete(key);
  }

  static clear(): void {
    this.cache.clear();
  }

  // Méthodes spécialisées pour les récompenses
  static getRewardsKey(playerLevel: number): string {
    return `rewards_level_${playerLevel}`;
  }

  static cacheRewards(playerLevel: number, rewards: AdReward[]): void {
    this.set(this.getRewardsKey(playerLevel), rewards);
  }

  static getCachedRewards(playerLevel: number): AdReward[] | null {
    return this.get<AdReward[]>(this.getRewardsKey(playerLevel));
  }

  /**
   * Vide le cache des récompenses pour un niveau spécifique
   */
  static clearRewardsCache(playerLevel: number): void {
    this.delete(this.getRewardsKey(playerLevel));
  }

  /**
   * Vide tout le cache des récompenses
   */
  static clearAllRewardsCache(): void {
    const keys = Array.from(this.cache.keys());
    keys
      .filter((key) => key.startsWith('rewards_level_'))
      .forEach((key) => {
        this.delete(key);
      });
  }
}
