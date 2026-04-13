export class AdValidationService {
  /**
   * Valide qu'AdMob a confirmé la récompense
   * Plus besoin de validation de durée - AdMob s'en charge
   */
  static validateAdReward(rewarded: boolean): boolean {
    console.log(`🔍 Validation récompense AdMob: ${rewarded}`);
    return rewarded;
  }
}
