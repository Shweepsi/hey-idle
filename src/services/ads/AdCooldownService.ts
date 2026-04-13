import { supabase } from '@/integrations/supabase/client';

export class AdCooldownService {
  private static readonly MAX_DAILY_ADS = 5; // Limite quotidienne

  static async getCooldownInfo(userId: string): Promise<{
    available: boolean;
    cooldownEnds: Date | null;
    timeUntilNext: number;
    dailyCount: number;
    maxDaily: number;
  }> {
    try {
      console.log('🔍 Checking ad cooldown for user:', userId);

      // Utiliser la fonction ad-rewards existante avec GET
      const { data, error } = await supabase.functions.invoke('ad-rewards', {
        body: null, // GET request
      });

      if (error) {
        console.error('❌ Error checking ad limit:', error);
        throw error;
      }

      console.log('📊 Ad limit check result:', data);

      const available = data.available || false;
      const dailyCount = data.dailyCount || 0;
      const maxDaily = data.maxDaily || this.MAX_DAILY_ADS;

      if (!available || dailyCount >= maxDaily) {
        // Limite atteinte
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const timeUntilNext = Math.ceil(
          (tomorrow.getTime() - now.getTime()) / 1000
        );

        return {
          available: false,
          cooldownEnds: tomorrow,
          timeUntilNext,
          dailyCount,
          maxDaily,
        };
      }

      return {
        available: true,
        cooldownEnds: null,
        timeUntilNext: 0,
        dailyCount,
        maxDaily,
      };
    } catch (error) {
      console.error('💥 Error in getCooldownInfo:', error);
      // Fallback en cas d'erreur - permettre 1 pub par sécurité
      return {
        available: true,
        cooldownEnds: null,
        timeUntilNext: 0,
        dailyCount: 0,
        maxDaily: this.MAX_DAILY_ADS,
      };
    }
  }

  static async updateAfterAdWatch(userId: string): Promise<void> {
    try {
      console.log('📈 Updating ad count after watch for user:', userId);

      // Cette fonction n'est plus nécessaire car l'incrémentation
      // se fait directement dans la fonction ad-rewards lors du claim
      console.log('✅ Ad count will be updated by the claim process');
    } catch (error) {
      console.error('💥 Error in updateAfterAdWatch:', error);
      throw error;
    }
  }

  static async updateCooldown(userId: string): Promise<void> {
    return this.updateAfterAdWatch(userId);
  }

  static get maxDailyAds() {
    return this.MAX_DAILY_ADS;
  }
}
