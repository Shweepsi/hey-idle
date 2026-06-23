# Hey-Idle (IdleGrow)

Jeu idle de jardin pour Android — front React/TypeScript packagé via Capacitor, backend Supabase (Postgres + edge functions), monétisation AdMob + Stripe.

## Stack

- **Front** : Vite · React · TypeScript · Tailwind · shadcn/ui · React Query
- **Mobile** : Capacitor (Android) · `@capacitor-community/admob`
- **Backend** : Supabase (Postgres, RLS, RPC server-authoritative, edge functions)
- **Paiement** : Stripe (gems)

## Démarrage local

Prérequis : Node.js + npm.

```sh
npm i
npm run dev        # serveur de dev Vite
```

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de dev (hot reload) |
| `npm run build` | Build de production |
| `npm run lint` | ESLint |
| `npm run gen:types` | Régénère les types Supabase (`src/integrations/supabase/types.ts`) |

## Architecture

- `src/economy/` — **source de vérité** de l'économie (`config.ts`) + `UnifiedCalculationService` (formules income/coût/multiplicateurs).
- `src/hooks/` — logique de jeu (récompenses, prestige, robot, plantation) via React Query.
- `src/admin/` + `src/pages/admin*` — back-office (lazy-loaded).
- `supabase/migrations/` — schéma + RPC. Le cœur économie vit dans `…_economy_v2_rpcs.sql`.
- `supabase/functions/` — `ad-rewards` (pubs), `create-payment`/`verify-payment` (Stripe).

> ⚠️ Les constantes d'économie côté SQL sont mirrorées à la main depuis `src/economy/config.ts` — garder les deux synchronisés.

## Android

Build de l'APK via la CI (`.github/workflows/android-release.yml`). L'APK n'est pas versionné dans git (voir `.gitignore`).
