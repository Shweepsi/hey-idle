#!/usr/bin/env bash
#
# Runbook — applique le nettoyage backend Vague 3 en prod.
# À lancer UNE fois, après t'être connecté :  supabase login
#
#   ./scripts/apply-backend-cleanup.sh
#
# Ce script :
#   1. vérifie que tu es bien connecté à Supabase
#   2. link le projet (idempotent)
#   3. montre les migrations EN ATTENTE (dry-run) avant d'appliquer
#   4. applique la migration DROP (supabase db push — te demandera le mot de passe DB)
#   5. supprime l'edge function morte validate-ad-reward
#   6. régénère src/integrations/supabase/types.ts
#   7. commit la régénération des types en local (push laissé à toi)
#
# ⚠️ `db push` applique TOUTES les migrations en attente, pas seulement le DROP
#    (donc aussi gems faucet / balance si pas encore déployées en prod — c'est voulu).
# ⚠️ Le DROP est destructif/irréversible. Objets morts vérifiés, mais c'est ta main.

set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="osfexuqvlpxrfaukfobn"
EDGE_FN="validate-ad-reward"

echo "▶ 1/6 — Vérification de l'auth Supabase…"
if ! supabase projects list >/dev/null 2>&1; then
  echo "❌ Pas connecté. Lance d'abord :  supabase login"
  exit 1
fi
echo "   ✅ connecté."

echo "▶ 2/6 — Link du projet ($PROJECT_REF)…"
supabase link --project-ref "$PROJECT_REF"

echo "▶ 3/6 — Migrations EN ATTENTE (aperçu, rien n'est appliqué) :"
supabase db push --dry-run || true
echo ""
read -r -p "   Appliquer ces migrations en PROD ? [y/N] " ok
if [[ "${ok:-}" != "y" && "${ok:-}" != "Y" ]]; then
  echo "   ⏹ Annulé. Rien n'a été modifié."
  exit 0
fi

echo "▶ 4/6 — Application des migrations (db push)…"
supabase db push

echo "▶ 5/6 — Suppression de l'edge function morte ($EDGE_FN)…"
supabase functions delete "$EDGE_FN" || echo "   (déjà supprimée ou absente — on continue)"

echo "▶ 6/6 — Régénération des types Supabase…"
npm run gen:types

if ! git diff --quiet -- src/integrations/supabase/types.ts; then
  git add src/integrations/supabase/types.ts
  git commit -m "chore(types): regen Supabase types after backend cleanup (Vague 3)"
  echo ""
  echo "✅ Terminé. Types régénérés et commités en local."
  echo "   → Pousse quand tu veux :  git push"
else
  echo ""
  echo "✅ Terminé. (types.ts inchangé — rien à committer.)"
fi
