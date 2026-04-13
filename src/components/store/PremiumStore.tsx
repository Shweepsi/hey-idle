import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gem, ShoppingCart, Sparkles, Zap, Crown } from 'lucide-react';
import { useStripePayment } from '@/hooks/useStripePayment';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export const PremiumStore = () => {
  const { createPayment, verifyPayment, isLoading } = useStripePayment();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(false);

  // Gérer le retour de paiement
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');

    if (paymentStatus === 'success' && sessionId) {
      setIsVerifying(true);

      verifyPayment(sessionId).then((result) => {
        if (result.verified) {
          // Actualiser les données du jeu et le statut premium
          queryClient.invalidateQueries({ queryKey: ['gameData'] });
          queryClient.invalidateQueries({ queryKey: ['premiumStatus'] });
          toast({
            title: 'Merci !',
            description: 'Premium activé. Les publicités sont désactivées.',
            variant: 'default',
          });
        }

        // Nettoyer les paramètres URL
        setSearchParams({});
        setIsVerifying(false);
      });
    } else if (paymentStatus === 'cancelled') {
      toast({
        variant: 'destructive',
        title: 'Paiement annulé',
        description: 'Votre paiement a été annulé',
      });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, verifyPayment, queryClient, toast]);

  const handlePurchase = async () => {
    const result = await createPayment();
    if (!result.success) {
      console.error('Échec du paiement:', result.error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Boutique Premium
        </h2>
        <p className="text-muted-foreground">
          Débloquez des ressources premium pour booster votre jardin
        </p>
      </div>

      <Card className="premium-card relative overflow-hidden border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-pink-500/5">
        {/* Effet de brillance */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full blur-xl" />

        <CardHeader className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  🚀 Early Access Pack
                  <Badge
                    variant="secondary"
                    className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  >
                    Populaire
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Pack de démarrage pour les joueurs premium
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">9,99 €</div>
              <div className="text-sm text-muted-foreground">Achat unique</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <Gem className="h-5 w-5 text-purple-400" />
              <div className="flex-1">
                <div className="font-medium">100 Gemmes</div>
                <div className="text-sm text-muted-foreground">
                  Monnaie premium pour débloquer des améliorations
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <Zap className="h-5 w-5 text-yellow-400" />
              <div className="flex-1">
                <div className="font-medium">Désactivation des publicités</div>
                <div className="text-sm text-muted-foreground">
                  Plus de pubs, récompenses automatiques
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50">
              <Crown className="h-5 w-5 text-yellow-400" />
              <div className="flex-1">
                <div className="font-medium">Badge Premium</div>
                <div className="text-sm text-muted-foreground">
                  Badge spécial visible dans le classement
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handlePurchase}
            disabled={isLoading || isVerifying}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium py-3 rounded-lg transition-all hover:scale-105"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Création du paiement...
              </>
            ) : isVerifying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Vérification...
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Acheter maintenant
              </>
            )}
          </Button>

          <div className="text-xs text-center text-muted-foreground">
            Paiement sécurisé par Stripe • Remboursement sous 30 jours
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
