import { ArrowLeft, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

export const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);

  useAndroidBackButton(true, () => {
    navigate('/profile');
  });

  const handleDeleteAccount = async () => {
    if (!user) return;

    const confirmed = window.confirm(
      'Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible et supprimera toutes vos données.'
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      // Demander la suppression du compte via la fonction RPC
      const { data, error } = await supabase.rpc('request_account_deletion', {
        user_email: user.email,
      });

      if (error) {
        console.error('Erreur lors de la suppression:', error);
        toast.error('Erreur lors de la suppression du compte');
        return;
      }

      const result = data as { success: boolean; message?: string };

      if (result?.success) {
        toast.success(
          'Demande de suppression envoyée. Votre compte sera supprimé sous peu.'
        );
        await signOut();
        navigate('/');
      } else {
        toast.error(result?.message || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Erreur inattendue:', error);
      toast.error("Une erreur inattendue s'est produite");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <button
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2 mb-6 text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>

        <div className="prose prose-sm max-w-none">
          <h1 className="text-2xl font-bold mb-6">
            Politique de Confidentialité
          </h1>

          <p className="text-gray-600 mb-6">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              1. Informations collectées
            </h2>
            <p>Idle Grow collecte les informations suivantes :</p>
            <ul className="list-disc pl-6 mt-2">
              <li>
                Données de profil utilisateur (pseudonyme, statistiques de jeu)
              </li>
              <li>Progression du jeu (niveau, plantes, upgrades)</li>
              <li>Données d'utilisation pour améliorer l'expérience</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              2. Utilisation des données
            </h2>
            <p>Vos données sont utilisées pour :</p>
            <ul className="list-disc pl-6 mt-2">
              <li>Sauvegarder votre progression de jeu</li>
              <li>Afficher les classements</li>
              <li>Améliorer l'expérience utilisateur</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              3. Stockage des données
            </h2>
            <p>
              Les données sont stockées de manière sécurisée via Supabase et ne
              sont pas partagées avec des tiers sans votre consentement.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">4. Publicités</h2>
            <p>
              Cette application utilise AdMob pour afficher des publicités.
              Google peut collecter certaines données à des fins publicitaires
              selon sa propre politique de confidentialité.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">5. Vos droits</h2>
            <p>
              Vous pouvez demander la suppression de vos données en nous
              contactant à l'adresse indiquée ci-dessous.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">6. Contact</h2>
            <p>
              Pour toute question concernant cette politique :
              contact@idlegrow.com
            </p>
          </section>

          <section className="mb-6 border-t pt-6">
            <h2 className="text-lg font-semibold mb-3 text-red-600">
              7. Suppression de compte
            </h2>
            <p className="mb-4">
              Vous avez le droit de supprimer définitivement votre compte et
              toutes vos données associées. Cette action est irréversible et
              supprimera :
            </p>
            <ul className="list-disc pl-6 mb-4">
              <li>Votre profil utilisateur</li>
              <li>Votre progression de jeu</li>
              <li>Vos statistiques et classements</li>
              <li>Toutes vos données personnelles</li>
            </ul>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-800 text-sm font-medium">
                ⚠️ Attention : Cette action est définitive et ne peut pas être
                annulée.
              </p>
            </div>
            {user && (
              <Button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting
                  ? 'Suppression en cours...'
                  : 'Supprimer mon compte'}
              </Button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
