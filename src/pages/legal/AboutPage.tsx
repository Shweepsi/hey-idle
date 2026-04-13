import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { APP_VERSION } from '@/version';
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton';

export const AboutPage = () => {
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
          <h1 className="text-2xl font-bold mb-6">À Propos d'Idle Grow</h1>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Le Jeu</h2>
            <p>
              Idle Grow est un jeu de simulation de jardinage relaxant où vous
              cultivez des plantes virtuelles, collectez des pièces et
              progressez à votre rythme.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Fonctionnalités</h2>
            <ul className="list-disc pl-6">
              <li>Système de plantation et récolte automatisée</li>
              <li>Multiples types de plantes avec différents rendements</li>
              <li>Système d'améliorations et d'outils</li>
              <li>Classements entre joueurs</li>
              <li>Système de prestige pour progression avancée</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Développeur</h2>
            <p>
              Développé avec passion pour offrir une expérience de jeu relaxante
              et addictive.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Version</h2>
            <p>Version {APP_VERSION}</p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Technologies</h2>
            <p>Construit avec React, TypeScript, Tailwind CSS et Supabase.</p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Support</h2>
            <p>
              Pour obtenir de l'aide ou signaler un problème :
              contact@idlegrow.com
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Remerciements</h2>
            <p>
              Merci à tous les joueurs qui font vivre cette communauté de
              jardiniers virtuels !
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};
