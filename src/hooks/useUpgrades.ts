
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { LevelUpgrade, PlayerUpgrade } from '@/types/upgrades';
import { UnifiedCalculationService } from '@/services/UnifiedCalculationService';
import { useAnimations } from '@/contexts/AnimationContext';


export const useUpgrades = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { triggerCoinAnimation, triggerGemAnimation } = useAnimations();
  

  const { data: availableUpgrades = [], isLoading: upgradesLoading } = useQuery({
    queryKey: ['levelUpgrades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('level_upgrades')
        .select('*')
        .order('level_required');
      
      if (error) throw error;
      return data as LevelUpgrade[];
    }
  });

  const { data: playerUpgrades = [], isLoading: playerUpgradesLoading } = useQuery({
    queryKey: ['playerUpgrades', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('player_upgrades')
        .select(`
          *,
          level_upgrades(*)
        `)
        .eq('user_id', user.id)
        .eq('active', true);
      
      if (error) throw error;
      return data as PlayerUpgrade[];
    },
    enabled: !!user?.id
  });

  const purchaseUpgradeMutation = useMutation({
    mutationFn: async (upgradeId: string) => {
      if (!user?.id) throw new Error('Non authentifié');

      const { data, error } = await supabase.rpc('purchase_upgrade_atomic', {
        p_user_id: user.id,
        p_upgrade_id: upgradeId
      });

      if (error) throw error;

      const result = data as {
        success: boolean;
        error?: string;
        effect_type?: string;
        cost_coins?: number;
        cost_gems?: number;
      };

      if (!result.success) throw new Error(result.error || 'Achat échoué');
      return result;
    },
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['playerUpgrades'] });
      queryClient.invalidateQueries({ queryKey: ['gameData'] });

      if (result.cost_coins && result.cost_coins > 0) {
        triggerCoinAnimation(-result.cost_coins);
      }
      if (result.cost_gems && result.cost_gems > 0) {
        triggerGemAnimation(-result.cost_gems);
      }

      // Forcer la collecte du robot si c'est une amélioration robot
      if (result.effect_type === 'auto_harvest' || result.effect_type === 'robot_level') {
        setTimeout(async () => {
          try {
            if (!user?.id) return;
            await supabase.rpc('collect_robot_income_atomic', { p_user_id: user.id });
            queryClient.invalidateQueries({ queryKey: ['passiveRobotState'] });
            queryClient.invalidateQueries({ queryKey: ['gameData'] });
          } catch {
            queryClient.invalidateQueries({ queryKey: ['passiveRobotState'] });
          }
        }, 500);
      }

      toast.success('Amélioration achetée !', {
        description: 'Votre bonus est maintenant actif'
      });
    },
    onError: (error: any) => {
      toast.error('Erreur lors de l\'achat', {
        description: error.message || 'Veuillez réessayer'
      });
    }
  });

  const purchaseUpgrade = (upgradeId: string) => {
    purchaseUpgradeMutation.mutate(upgradeId);
  };

  const isUpgradePurchased = (upgradeId: string) => {
    return playerUpgrades.some(pu => pu.upgrade_id === upgradeId);
  };

  // Calculer tous les multiplicateurs actifs
  const getActiveMultipliers = () => {
    return UnifiedCalculationService.calculateActiveMultipliers(playerUpgrades);
  };

  // Obtenir les améliorations de déblocage automatique
  const getAutoUnlockUpgrades = () => {
    return playerUpgrades.filter(upgrade => 
      upgrade.level_upgrades?.effect_type === 'auto_unlock'
    );
  };

  // Grouper les améliorations par catégorie et afficher tous les paliers
  const getSequentialUpgrades = () => {
    const categories: { [key: string]: LevelUpgrade[] } = {};
    
    // Grouper par effect_type
    availableUpgrades.forEach(upgrade => {
      if (!categories[upgrade.effect_type]) {
        categories[upgrade.effect_type] = [];
      }
      categories[upgrade.effect_type].push(upgrade);
    });

    // Pour chaque catégorie, trier par niveau requis et coût
    const sequentialUpgrades: LevelUpgrade[] = [];
    
    Object.entries(categories).forEach(([effectType, upgrades]) => {
      const sorted = upgrades.sort((a, b) => {
        if (a.level_required !== b.level_required) {
          return a.level_required - b.level_required;
        }
        return a.cost_coins - b.cost_coins;
      });

      // Ajouter tous les paliers pour cette catégorie
      sequentialUpgrades.push(...sorted);
    });

    return sequentialUpgrades;
  };

  // Nouvelle fonction pour obtenir les paliers d'une catégorie
  const getCategoryTiers = (effectType: string) => {
    const categoryUpgrades = availableUpgrades.filter(upgrade => upgrade.effect_type === effectType);
    return categoryUpgrades.sort((a, b) => {
      if (a.level_required !== b.level_required) {
        return a.level_required - b.level_required;
      }
      return a.cost_coins - b.cost_coins;
    });
  };

  // Calculer la progression par catégorie
  const getCategoryProgress = () => {
    const categories: { [key: string]: { total: number; purchased: number; name: string } } = {};
    
    availableUpgrades.forEach(upgrade => {
      if (!categories[upgrade.effect_type]) {
        categories[upgrade.effect_type] = {
          total: 0,
          purchased: 0,
          name: getCategoryDisplayName(upgrade.effect_type)
        };
      }
      categories[upgrade.effect_type].total++;
      if (isUpgradePurchased(upgrade.id)) {
        categories[upgrade.effect_type].purchased++;
      }
    });

    return categories;
  };

  const getCategoryDisplayName = (effectType: string) => {
    switch (effectType) {
      case 'harvest_multiplier': return 'Récolte';
      case 'growth_speed': return 'Croissance';
      case 'exp_multiplier': return 'Expérience';
      case 'gem_chance': return 'Gemmes';
      case 'plant_cost_reduction': return 'Économie';
      case 'auto_harvest': return 'Automatisation';
      case 'robot_level': return 'Automatisation';
      default: return effectType.replace('_', ' ');
    }
  };

  return {
    availableUpgrades,
    playerUpgrades,
    upgradesLoading: upgradesLoading || playerUpgradesLoading,
    purchaseUpgrade,
    isUpgradePurchased,
    getActiveMultipliers,
    getAutoUnlockUpgrades,
    getSequentialUpgrades,
    getCategoryProgress,
    getCategoryDisplayName,
    getCategoryTiers,
    isPurchasing: purchaseUpgradeMutation.isPending
  };
};
