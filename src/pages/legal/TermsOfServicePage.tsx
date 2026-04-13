import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';

export const TermsOfServicePage = () => {
  const navigate = useNavigate();

  useAndroidBackButton(true, () => {
    navigate('/profile');
  });

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
          <h1 className="text-2xl font-bold mb-6">Conditions d'Utilisation</h1>

          <p className="text-gray-600 mb-6">
            Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
          </p>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              1. Acceptation des conditions
            </h2>
            <p>
              En utilisant Idle Grow, vous acceptez ces conditions d'utilisation
              dans leur intégralité.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              2. Description du service
            </h2>
            <p>
              Idle Grow est un jeu mobile de simulation de jardinage où les
              joueurs cultivent des plantes virtuelles pour gagner des pièces et
              progresser.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              3. Utilisation acceptable
            </h2>
            <p>Vous vous engagez à :</p>
            <ul className="list-disc pl-6 mt-2">
              <li>
                Utiliser l'application de manière conforme aux lois applicables
              </li>
              <li>Ne pas tenter de pirater ou manipuler le jeu</li>
              <li>Respecter les autres utilisateurs dans les classements</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              4. Contenu généré par l'utilisateur
            </h2>
            <p>
              Tout contenu que vous créez (pseudonymes, données de jeu) reste
              votre propriété mais vous nous accordez le droit de l'utiliser
              dans le cadre du service.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">
              5. Limitation de responsabilité
            </h2>
            <p>
              Idle Grow est fourni "en l'état" sans garantie. Nous ne sommes pas
              responsables des pertes de données ou des problèmes techniques.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">6. Modifications</h2>
            <p>
              Nous nous réservons le droit de modifier ces conditions à tout
              moment. Les modifications prennent effet dès leur publication.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">7. Résiliation</h2>
            <p>
              Nous pouvons suspendre ou résilier votre accès en cas de violation
              de ces conditions.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">8. Contact</h2>
            <p>
              Pour toute question concernant ces conditions :
              contact@idlegrow.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
