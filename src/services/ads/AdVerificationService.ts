import { supabase } from '@/integrations/supabase/client';

export class AdVerificationService {
  /**
   * Vérifie qu'une session publicitaire est valide et appartient à l'utilisateur
   */
  static async verifySession(
    userId: string,
    sessionId: string
  ): Promise<{
    isValid: boolean;
    session?: any;
    error?: string;
  }> {
    try {
      const { data: session, error } = await supabase
        .from('ad_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('AdMob: Session verification failed:', error);
        return { isValid: false, error: 'Session non trouvée' };
      }

      if (!session) {
        return { isValid: false, error: 'Session invalide' };
      }

      // Vérifier que la session n'est pas expirée (si elle a une date d'expiration)
      if (session.expires_at) {
        const now = new Date();
        const expiresAt = new Date(session.expires_at);

        if (now > expiresAt) {
          return { isValid: false, error: 'Session expirée' };
        }
      }

      // Vérifier que la session n'a pas déjà été complétée
      const rewardData = session.reward_data as any;
      if (rewardData?.completed) {
        return { isValid: false, error: 'Session déjà complétée' };
      }

      return { isValid: true, session };
    } catch (error) {
      console.error('AdMob: Session verification error:', error);
      return { isValid: false, error: 'Erreur de vérification' };
    }
  }

  /**
   * Vérifie l'intégrité des données de récompense
   */
  static verifyRewardIntegrity(
    session: any,
    expectedRewardType: string,
    expectedAmount: number
  ): boolean {
    if (session.reward_type !== expectedRewardType) {
      console.warn(
        `AdMob: Reward type mismatch. Expected: ${expectedRewardType}, Got: ${session.reward_type}`
      );
      return false;
    }

    if (session.reward_amount !== expectedAmount) {
      console.warn(
        `AdMob: Reward amount mismatch. Expected: ${expectedAmount}, Got: ${session.reward_amount}`
      );
      return false;
    }

    return true;
  }

  /**
   * Marque une session comme potentiellement frauduleuse
   */
  static async markSuspiciousSession(
    sessionId: string,
    reason: string
  ): Promise<void> {
    try {
      const { data: session } = await supabase
        .from('ad_sessions')
        .select('reward_data')
        .eq('id', sessionId)
        .single();

      if (session) {
        const updatedRewardData = {
          ...((session.reward_data as any) || {}),
          suspicious: {
            flagged: true,
            reason,
            timestamp: new Date().toISOString(),
          },
        };

        await supabase
          .from('ad_sessions')
          .update({ reward_data: updatedRewardData })
          .eq('id', sessionId);
      }

      console.warn(
        `AdMob: Session ${sessionId} marked as suspicious: ${reason}`
      );
    } catch (error) {
      console.error('AdMob: Failed to mark session as suspicious:', error);
    }
  }
}
