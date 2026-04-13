import { PlantType } from '@/types/game';
import { supabase } from '@/integrations/supabase/client';

/**
 * Cache client pour les types de plantes (données statiques)
 * Évite les requêtes répétées pour ces données qui changent rarement
 */
class PlantTypesCacheService {
  private cache: PlantType[] | null = null;
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  private fetchPromise: Promise<PlantType[]> | null = null;

  /**
   * Récupère les types de plantes avec cache
   */
  async getPlantTypes(): Promise<PlantType[]> {
    const now = Date.now();

    // Si on a des données en cache et qu'elles sont encore valides
    if (this.cache && now - this.lastFetchTime < this.CACHE_DURATION) {
      return this.cache;
    }

    // Si une requête est déjà en cours, on l'attend
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    // Sinon on lance une nouvelle requête
    this.fetchPromise = this.fetchFromDatabase();

    try {
      const result = await this.fetchPromise;
      return result;
    } finally {
      this.fetchPromise = null;
    }
  }

  /**
   * Récupération depuis la base de données
   */
  private async fetchFromDatabase(): Promise<PlantType[]> {
    const { data: plantTypes, error } = await supabase
      .from('plant_types')
      .select('*')
      .order('level_required', { ascending: true });

    if (error) {
      console.error(
        'Erreur lors de la récupération des types de plantes:',
        error
      );
      throw error;
    }

    if (!plantTypes) {
      throw new Error('Aucun type de plante trouvé');
    }

    // Mettre à jour le cache
    this.cache = plantTypes;
    this.lastFetchTime = Date.now();

    console.log(
      `✅ Types de plantes mis en cache (${plantTypes.length} types)`
    );
    return plantTypes;
  }

  /**
   * Récupère un type de plante spécifique par ID
   */
  async getPlantTypeById(id: string): Promise<PlantType | undefined> {
    const plantTypes = await this.getPlantTypes();
    return plantTypes.find((pt) => pt.id === id);
  }

  /**
   * Récupère les types de plantes par niveau requis
   */
  async getPlantTypesByLevel(level: number): Promise<PlantType[]> {
    const plantTypes = await this.getPlantTypes();
    return plantTypes.filter((pt) => pt.level_required <= level);
  }

  /**
   * Invalider le cache (utile lors de mises à jour)
   */
  invalidateCache(): void {
    this.cache = null;
    this.lastFetchTime = 0;
    this.fetchPromise = null;
    console.log('🔄 Cache des types de plantes invalidé');
  }

  /**
   * Pré-charger le cache
   */
  async preloadCache(): Promise<void> {
    try {
      await this.getPlantTypes();
      console.log('🚀 Cache des types de plantes pré-chargé');
    } catch (error) {
      console.warn('⚠️ Échec du pré-chargement du cache:', error);
    }
  }

  /**
   * Obtenir les statistiques du cache
   */
  getCacheStats(): { isCached: boolean; age: number; count: number } {
    const now = Date.now();
    return {
      isCached: this.cache !== null,
      age: this.cache ? now - this.lastFetchTime : 0,
      count: this.cache ? this.cache.length : 0,
    };
  }
}

// Instance singleton
export const PlantTypesCache = new PlantTypesCacheService();
