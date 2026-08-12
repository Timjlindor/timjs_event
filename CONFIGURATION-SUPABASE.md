# Configuration Supabase — Timj Multi-Services

Ton code (`index.html`) est déjà branché sur ton projet Supabase :
`https://zcgwkvuyxosxfyxwmfim.supabase.co`. La clé `anon` est publique, c'est
normal de la laisser dans le HTML. Il reste à activer les options côté tableau de
bord Supabase. Voici les étapes.

---

## 0. Point le plus important : héberger le site

La connexion **ne fonctionne pas** si tu ouvres le fichier directement
(`file:///...`). Il faut servir le site en `http://` ou `https://`.

Deux solutions simples et gratuites :

- **En local, pour tester** : ouvre un terminal dans le dossier du site et lance
  `python3 -m http.server 8000`, puis va sur `http://localhost:8000`.
- **En ligne (recommandé)** : dépose le dossier sur **Netlify** (glisser-déposer
  sur netlify.com/drop), **Vercel**, ou **GitHub Pages**. Tu obtiens une adresse
  du type `https://ton-site.netlify.app`.

Note bien cette adresse, tu en as besoin ci-dessous.

---

## 1. Configurer les URLs (obligatoire)

Dans Supabase → **Authentication → URL Configuration** :

- **Site URL** : mets l'adresse de ton site (ex. `https://ton-site.netlify.app`
  ou `http://localhost:8000` pour les tests).
- **Redirect URLs** : ajoute la même adresse suivie de `/index.html`, par exemple :
  - `http://localhost:8000/index.html`
  - `https://ton-site.netlify.app/index.html`

Clique sur **Save**.

---

## 2. Inscription par email (le plus simple)

Dans Supabase → **Authentication → Providers → Email** :

- Active **Enable Email provider**.
- Laisse **Confirm email** activé (l'utilisateur reçoit un mail de confirmation).
- Si tu veux tester sans confirmer à chaque fois, tu peux désactiver
  temporairement **Confirm email** — à réactiver en production.

Après ça, le formulaire « Créer le compte » et « Se connecter » de ta page
fonctionnent.

> Astuce : les emails par défaut de Supabase sont limités (quelques-uns par
> heure). Pour un vrai site, configure un fournisseur SMTP dans
> **Project Settings → Auth → SMTP Settings**.

---

## 3. Connexion Google

1. Va sur https://console.cloud.google.com → crée un projet.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
3. Type : **Web application**.
4. Dans **Authorized redirect URIs**, colle l'URL de callback Supabase :
   `https://zcgwkvuyxosxfyxwmfim.supabase.co/auth/v1/callback`
5. Copie le **Client ID** et le **Client Secret**.
6. Dans Supabase → **Authentication → Providers → Google** : active-le, colle le
   Client ID et le Client Secret, puis **Save**.

---

## 4. Connexion Facebook

1. Va sur https://developers.facebook.com → **My Apps → Create App**.
2. Ajoute le produit **Facebook Login**.
3. Dans **Facebook Login → Settings → Valid OAuth Redirect URIs**, colle :
   `https://zcgwkvuyxosxfyxwmfim.supabase.co/auth/v1/callback`
4. Récupère l'**App ID** et l'**App Secret** (dans Settings → Basic).
5. Dans Supabase → **Authentication → Providers → Facebook** : active-le, colle
   l'App ID et l'App Secret, puis **Save**.

---

## 5. Connexion Apple (plus complexe)

Apple exige un compte **Apple Developer payant (99 $/an)**. Si tu ne l'as pas,
tu peux **retirer le bouton Apple** de la page (dis-le-moi, je le fais en 10 s).

Sinon :
1. Sur https://developer.apple.com → crée un **Services ID** et une clé
   **Sign in with Apple**.
2. Return URL : `https://zcgwkvuyxosxfyxwmfim.supabase.co/auth/v1/callback`
3. Dans Supabase → **Authentication → Providers → Apple** : active-le et remplis
   les identifiants générés, puis **Save**.

---

## 6. Sauvegarder les réservations dans Supabase (nouveau)

Avant, le formulaire de `reservation.html` enregistrait tout uniquement dans
le `localStorage` du navigateur du client : rien n'arrivait jusqu'à toi. Ce
n'est plus le cas. Il reste une étape unique à faire, une seule fois :

1. Dans Supabase → **SQL Editor** → **New query**.
2. Ouvre le fichier [`supabase/schema.sql`](supabase/schema.sql) de ce projet,
   colle tout son contenu dans l'éditeur, puis clique **Run**.
3. Ça crée :
   - une table **`reservations`** (nom, téléphone, service, date, montant,
     moyen de paiement, détails, chemin de la preuve de paiement) ;
   - un bucket de stockage **`payment-proofs`** (privé) pour les captures
     d'écran de paiement.

Après ça :

- Chaque réservation envoyée depuis le site apparaît dans **Table Editor →
  reservations**.
- Chaque preuve de paiement est visible dans **Storage → payment-proofs**
  (le chemin exact est dans la colonne `payment_proof_path` de la table).
- Le site ne peut qu'**ajouter** des réservations, jamais lire, modifier ou
  supprimer celles des autres visiteurs (RLS activé) — seul toi, depuis le
  dashboard, vois tout.
- Si Supabase est indisponible (site pas encore hébergé, coupure réseau), le
  formulaire continue de fonctionner : la réservation part quand même par
  WhatsApp, et un message à l'écran précise que l'enregistrement Supabase a
  échoué.

> Comme pour l'auth (section 0), l'insertion Supabase ne fonctionne pas en
> ouvrant le fichier directement (`file:///...`) : héberge le site ou teste
> avec `python3 -m http.server 8000`.

---

## 7. Publier automatiquement les posts YouTube / Facebook / Instagram / TikTok

La page d'accueil peut republier automatiquement tes nouvelles vidéos et
publications dans le fil "Dernières annonces", sans que tu fasses quoi que
ce soit de plus une fois que c'est branché. Ça fonctionne par
**vérification périodique** (toutes les 20 minutes environ), pas en temps
réel instantané.

C'est la partie la plus technique de la configuration. Prends ton temps,
fais une plateforme à la fois, et n'hésite pas à me redemander de l'aide à
n'importe quelle étape.

### 7.0 Ce qu'il te faut avant de commencer

- Le **CLI Supabase** installé sur ton ordinateur, pour déployer les deux
  fonctions du dossier `supabase/functions/` :
  ```bash
  npm install -g supabase
  supabase login
  supabase link --project-ref zcgwkvuyxosxfyxwmfim
  ```
- Ta **clé service_role** (Project Settings → API → `service_role` —
  différente de la clé `anon` publique, celle-ci ne doit **jamais**
  apparaître dans le code du site).

### 7.1 YouTube (le plus simple)

1. Va sur https://console.cloud.google.com → crée un projet.
2. **APIs & Services → Library** → cherche "YouTube Data API v3" → **Enable**.
3. **APIs & Services → Credentials → Create Credentials → API key**. Copie
   la clé.
4. Récupère l'ID de ta chaîne YouTube : va sur ta chaîne → **À propos** →
   l'URL ou le bouton "Partager la chaîne" donne un ID du type `UCxxxxxxxx`.

### 7.2 Facebook (Page) et Instagram (même app Meta)

1. Ton compte Instagram doit être un compte **Professionnel ou Créateur**,
   lié à ta **Page Facebook** (Paramètres Instagram → Compte → Passer à un
   compte professionnel, puis lie-le à la Page dans les paramètres de la
   Page Facebook).
2. Va sur https://developers.facebook.com → **Mes Apps → Créer une app** →
   type "Entreprise".
3. Ajoute le produit **Graph API Explorer** (dans le tableau de bord de
   l'app, section Outils).
4. Dans le **Graph API Explorer** : sélectionne ton app, ta Page, coche les
   permissions `pages_read_engagement`, `pages_show_list`,
   `instagram_basic`. Génère un **User Access Token**, puis clique sur
   "Générer un token d'accès longue durée" (ou utilise l'outil "Access
   Token Debugger" pour l'étendre à 60 jours).
5. Avec ce token, appelle `GET /me/accounts` pour récupérer l'**ID de ta
   Page** et son **token d'accès Page** (les tokens de Page issus d'un
   token utilisateur longue durée n'expirent pas tant que tu ne révoques
   pas l'accès).
6. Appelle `GET /{page-id}?fields=instagram_business_account` avec le token
   de Page pour récupérer l'**ID du compte Instagram Business** lié.

Tu obtiens : `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`, `IG_USER_ID`.

### 7.3 TikTok (le plus exigeant)

1. Va sur https://developers.tiktok.com → crée un compte développeur →
   **Manage apps → Create app**.
2. Ajoute le produit **Login Kit**, avec les scopes `user.info.basic` et
   `video.list`.
3. Dans les paramètres de l'app, ajoute une **Redirect URI** : ce sera
   l'URL de la fonction `tiktok-oauth-callback` une fois déployée (étape
   7.4), du type :
   `https://zcgwkvuyxosxfyxwmfim.supabase.co/functions/v1/tiktok-oauth-callback`
4. Note le **Client Key** et le **Client Secret** de l'app.

### 7.4 Déployer les fonctions et configurer les secrets

```bash
supabase functions deploy sync-social-posts --no-verify-jwt
supabase functions deploy tiktok-oauth-callback --no-verify-jwt

supabase secrets set \
  YOUTUBE_API_KEY=xxx \
  YOUTUBE_CHANNEL_ID=UCxxxxxxxx \
  FB_PAGE_ID=xxx \
  FB_PAGE_ACCESS_TOKEN=xxx \
  IG_USER_ID=xxx \
  TIKTOK_CLIENT_KEY=xxx \
  TIKTOK_CLIENT_SECRET=xxx \
  TIKTOK_REDIRECT_URI=https://zcgwkvuyxosxfyxwmfim.supabase.co/functions/v1/tiktok-oauth-callback
```

(Omets les variables d'une plateforme que tu ne veux pas connecter tout de
suite — la fonction l'ignore simplement, sans erreur.)

### 7.5 Connecter TikTok (une seule fois)

Remplace `<CLIENT_KEY>` et ouvre ce lien dans ton navigateur, connecté à ton
compte TikTok :

```
https://www.tiktok.com/v2/auth/authorize/?client_key=<CLIENT_KEY>&scope=user.info.basic,video.list&response_type=code&redirect_uri=https%3A%2F%2Fzcgwkvuyxosxfyxwmfim.supabase.co%2Ffunctions%2Fv1%2Ftiktok-oauth-callback&state=setup
```

Autorise l'app. Tu dois voir "TikTok connecté avec succès". C'est fait une
fois pour toutes (la fonction renouvelle elle-même l'accès ensuite).

### 7.6 Exécuter le schéma et activer la planification

1. Si ce n'est pas déjà fait, exécute `supabase/schema.sql` en entier dans
   le **SQL Editor** (sections 3 et 4) — ça crée les tables `social_posts`
   et `platform_tokens`.
2. Dans **Database → Extensions**, active **pg_cron** et **pg_net**.
3. Dans le **SQL Editor**, décommente et exécute le bloc `cron.schedule(...)`
   de la section 4 de `supabase/schema.sql`, en remplaçant `<ANON_KEY>` par
   ta clé anon.

### 7.7 Tester

Dans **Edge Functions → sync-social-posts**, clique sur "Invoke" (ou
`curl -X POST https://zcgwkvuyxosxfyxwmfim.supabase.co/functions/v1/sync-social-posts`)
pour déclencher une synchronisation immédiate, puis vérifie
**Table Editor → social_posts** : tes dernières publications doivent
apparaître. Elles s'affichent automatiquement dans le fil de la page
d'accueil, avec un badge indiquant la plateforme d'origine.

---

## Récapitulatif

| Fonction              | Action requise                                   |
|-----------------------|--------------------------------------------------|
| Héberger le site      | Netlify / Vercel / GitHub Pages (ou localhost)   |
| URLs Supabase         | Site URL + Redirect URLs                          |
| Email                 | Activer le provider Email                         |
| Google                | Créer OAuth client + coller ID/Secret            |
| Facebook              | Créer une app + coller App ID/Secret             |
| Apple                 | Compte développeur payant (sinon retirer le bouton) |
| Réservations          | Exécuter `supabase/schema.sql` dans le SQL Editor |
| Annonces (page d'accueil) | Compte admin `lindorelie23@gmail.com` + schéma exécuté |
| Sync YouTube/FB/IG/TikTok | Clés API des 4 plateformes + déployer les 2 Edge Functions + pg_cron |

Une fois les URLs (section 1) et l'email (section 2) configurés, ta page de
connexion marche. Google et Facebook s'ajoutent quand tu veux. Une fois le
schéma (section 6) exécuté, les réservations et preuves de paiement
apparaissent dans ton dashboard Supabase. La section 7 (optionnelle et plus
longue) active la republication automatique des réseaux sociaux.
