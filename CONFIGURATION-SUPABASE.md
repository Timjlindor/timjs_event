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

Une fois les URLs (section 1) et l'email (section 2) configurés, ta page de
connexion marche. Google et Facebook s'ajoutent quand tu veux. Une fois le
schéma (section 6) exécuté, les réservations et preuves de paiement
apparaissent dans ton dashboard Supabase.
