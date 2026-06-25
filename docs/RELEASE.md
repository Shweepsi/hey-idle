# 🚀 Guide de publication — Hey-Idle (IdleGrow)

État au 2026-06-25. App en **beta** (`versionName 1.0.0-beta.1`, `versionCode 3`).
Le **code converge** ; la publication est surtout gatée par du **setup de comptes externes + QA device** que seul Loïc peut faire. Ce guide liste tout, dans l'ordre, avec qui fait quoi.

---

## ✅ Déjà fait (côté code — Verra)
- [x] Typage assaini, code nettoyé (−6 000 lignes), backend mort supprimé
- [x] **CI verte** (web + Android) — `tsc` + drift + build sur chaque PR/push
- [x] Build **AAB signé** prêt (workflow `android-release.yml`) — attend juste tes secrets
- [x] Page de confidentialité in-app (`PrivacyPolicyPage`)
- [x] **Économie assainie** : plantes (progression monotone), prestige (gratifiant), sink gemmes (puits récurrent)
- [x] Spec de l'échelle de prix Stripe (à implémenter quand tu testeras les paiements — §B)

---

## 🔴 Chemin critique vers le store (tâches de Loïc)

### A. AdMob (pubs) — **bloquant revenus + QA device**
- [ ] Créer/finaliser le compte **AdMob** + l'app
- [ ] Créer les **ad units** réels (rewarded video) et reporter les IDs :
  - App ID : déjà dans `AndroidManifest.xml` (`ca-app-pub-4824355487707598~3701914540`) — **vérifier qu'il est à toi**
  - Ad unit ID rewarded : dans `src/services/ads/AdMobSimpleService.ts` (`AD_UNIT_ID`) — **remplacer par le tien**, virer l'ID de test résiduel
- [ ] **Test sur device réel** : ajouter ton device en test device AdMob, lancer une pub, vérifier récompense créditée
- [ ] Pendant ce test, traiter les **2 items que j'ai laissés** (invérifiables sans device) :
  - double-retry pub (`AdMobSimpleService.loadAd` retry interne + wrap `AdRetryService` → compounding ; simplifier puis re-tester)
  - double-mutation robot (UX animation — décider)
  - → me dire « device prêt » et je te guide / les applique pendant que tu testes

### B. Stripe (paiements) — **bloquant revenus**
- [ ] Passer les clés **live** (secret + publishable) côté Supabase edge functions (`create-payment`, `verify-payment`)
- [ ] Décider l'**échelle de prix gemmes** (actuellement 1 seul pack 100 gemmes / 9,99€). Spec proposée (monétisation douce) :
  | Pack | Gemmes | Prix |
  |---|---|---|
  | Starter | 50 | 1,99€ |
  | Populaire | 170 (150+20) | 4,99€ |
  | Valeur | 400 (340+60) | 9,99€ |
  | Méga | 1200 (1000+200) | 24,99€ |
  - + découpler « retirer les pubs » en SKU séparé (4,99€)
  - → quand tu valides les prix + as les clés, je code la table de prix + le multi-pack dans `create-payment`/`verify-payment` (rapide une fois testable)
- [ ] Tester un achat de bout en bout (mode test Stripe d'abord)

### C. Google Play Console — **bloquant publication**
- [ ] Compte développeur Play (25$ one-time si pas déjà fait)
- [ ] Créer l'app, choisir le **package name** (cohérent avec `applicationId` du build.gradle)
- [ ] **Keystore de signing** : générer (ou réutiliser) la clé, puis ajouter en **secrets GitHub** (le workflow les attend) :
  `KEYSTORE_FILE` (base64), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`
  ⚠️ **Sauvegarder le keystore** (perte = impossible de mettre à jour l'app à vie)
- [ ] Fiche store : titre, descriptions courte/longue, **captures d'écran**, icône (512px), feature graphic
- [ ] **Classification de contenu** (questionnaire IARC)
- [ ] **Sécurité des données** (data safety form) — déclarer pubs/analytics/paiements
- [ ] URL de **politique de confidentialité hébergée** (la page in-app ne suffit pas pour le formulaire Play — héberger une URL publique)
- [ ] Public cible / publicités (déclarer présence de pubs)

### D. QA — **avant soumission**
- [ ] **Web loggé** (pas besoin de device) : valider le sink gemmes (acheter un boost → gemmes débitées + boost actif), le flux Stripe test, la nouvelle éco (récolte → progression plantes → prestige)
- [ ] **Device réel** : tour complet (récolte → pub → boost → paiement), perfs, pas de crash
- [ ] Vérifier l'équilibrage « ressenti » sur un vrai parcours nouveau joueur

### E. Build & soumission
- [ ] Bump version : `versionName` → `1.0.0`, `versionCode` → 4 (build.gradle)
- [ ] Déclencher `android-release.yml` → récupère l'**AAB signé**
- [ ] Upload sur Play Console → **test interne** d'abord (closed testing), puis production

---

## ⚙️ Dette technique connue (NON bloquante pour publier)
- **Historique de migrations désynchronisé** (chaos Lovable vs CLI moderne) → `db push`/`db pull` cassés. En attendant, toute migration s'applique via `supabase db query --linked --file`. À réconcilier proprement un jour (lié au squash déféré). Détail : `memory/2026-06-23-heyidle-reduction-audit.md`.
- Constantes éco mirrorées config.ts ↔ SQL → garde-fou CI `npm run check:drift` (ne couvre pas tout, mais l'essentiel).

---

## 🧭 Ordre conseillé
1. **C** (Play Console + keystore) en parallèle de **A** (AdMob device) — les deux sont des prérequis longs.
2. **B** (Stripe) une fois que tu peux tester.
3. **D** (QA) quand A+B sont en place.
4. **E** (build + soumission test interne) → production.

Le prochain jalon réaliste : **A + C en place → QA → test interne Play**. Verra reste dispo pour tout le code (Stripe multi-pack, fixes pub device, polish) dès que c'est testable.
