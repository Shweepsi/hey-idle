// Smart validation cache to reduce DB calls
export class ValidationCacheService {
  private static plantTypesCache: Map<string, any> = new Map();
  private static playerDataCache: {
    data: any | null;
    timestamp: number;
    ttl: number;
  } = { data: null, timestamp: 0, ttl: 5000 }; // 5s TTL

  // Cache plant types (static data, longer TTL)
  static cachePlantTypes(plantTypes: any[]) {
    plantTypes.forEach((plant) => {
      this.plantTypesCache.set(plant.id, plant);
    });
  }

  static getCachedPlantType(plantTypeId: string) {
    return this.plantTypesCache.get(plantTypeId);
  }

  // Cache player data with short TTL
  static cachePlayerData(data: any) {
    this.playerDataCache = {
      data,
      timestamp: Date.now(),
      ttl: 5000, // 5 seconds
    };
  }

  static getCachedPlayerData() {
    const now = Date.now();
    if (
      this.playerDataCache.data &&
      now - this.playerDataCache.timestamp < this.playerDataCache.ttl
    ) {
      return this.playerDataCache.data;
    }
    return null;
  }

  // Clear cache when needed
  static clearPlayerData() {
    this.playerDataCache.data = null;
  }

  static clearAll() {
    this.plantTypesCache.clear();
    this.playerDataCache.data = null;
  }
}
