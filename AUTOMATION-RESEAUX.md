# 🎬 Reel quotidien automatique — Guide de mise en place

Chaque jour à **7h (heure d'Haïti)**, une tâche automatique :
1. choisit une **photo** de votre dossier `Photographie/` (une différente chaque jour) ;
2. la transforme en **mini-reel vidéo** vertical (zoom doux, ~8 s) ;
3. génère une **légende + des hashtags** optimisés selon le style de la photo ;
4. publie une **annonce sur votre site** (fil « Dernières annonces ») ;
5. publie le reel sur les **réseaux que vous aurez configurés**.

Le moteur est **GitHub Actions** (fichier `.github/workflows/daily-reel.yml` + script `automation/daily-reel.mjs`). **Vos identifiants ne sont jamais dans le code** : ils sont stockés dans les **Secrets** de GitHub, que vous êtes seule à voir.

---

## ⚠️ À lire d'abord — les vérités importantes

- **Les réseaux sociaux ne s'activent pas tout seuls.** Chacun exige une **app développeur** et, pour Instagram/Facebook/TikTok, une **validation de la plateforme** (Meta et TikTok *auditent* les apps qui publient du contenu). Cela peut prendre **plusieurs jours à quelques semaines**.
- **Je (Claude) ne peux pas** créer ces comptes ni saisir vos identifiants à votre place. Je fournis le code et ce guide ; **vous** faites les démarches et collez les tokens dans les Secrets GitHub.
- **Instagram** exige un compte **Business ou Créateur** relié à une **Page Facebook**.
- **WhatsApp** ne permet **pas** de publier des posts automatiquement (il n'existe pas d'API publique pour ça) — il reste un bouton de contact.
- **Risque de blocage :** publier automatiquement tous les jours peut être vu comme du spam. Restez raisonnable (1 post/jour, contenu de qualité) et surveillez vos comptes au début.
- **Ce qui marche SANS aucune validation externe :** la génération du reel + la publication **sur votre site**. Vous pouvez tester ça tout de suite (voir §2).

---

## 1. Où mettre les secrets

Sur GitHub : **votre dépôt `timjs_event` → Settings → Secrets and variables → Actions → New repository secret**. Ajoutez uniquement les secrets des réseaux que vous voulez activer ; les autres sont ignorés automatiquement.

---

## 2. Étape minimale (site) — testable aujourd'hui

Ajoutez ces 2 secrets (ils servent au site **et** à héberger la vidéo) :

| Secret | Où le trouver |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API → **Project URL** (`https://zcgwkvuyxosxfyxwmfim.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → **service_role** (⚠️ clé sensible : accès total à la base — ne la partagez jamais ailleurs) |

Puis **testez sans attendre 7h** : GitHub → onglet **Actions** → workflow **« Reel quotidien 7h »** → **Run workflow**. En ~2 min, un reel du jour apparaît dans « Dernières annonces » sur le site. 🎉

---

## 3. Instagram + Facebook (Meta)

1. Créez un compte développeur : <https://developers.facebook.com> → **My Apps → Create App** (type « Business »).
2. Reliez votre **Page Facebook** et votre **compte Instagram Business** (Instagram → Paramètres → Compte → passer en compte professionnel, puis le relier à la Page).
3. Ajoutez les produits **Facebook Login** et **Instagram Graph API**.
4. Demandez les permissions (nécessite **App Review** de Meta) :
   `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`,
   `pages_show_list`, `business_management`.
5. Générez un **token de longue durée** (≈ 60 jours — à **renouveler** ensuite) via l'**Access Token Tool** / Graph API Explorer.
6. Récupérez les identifiants et ajoutez les secrets :

| Secret | Description |
|---|---|
| `META_ACCESS_TOKEN` | Le token longue durée (sert à Instagram **et** Facebook) |
| `IG_USER_ID` | L'ID du compte Instagram Business |
| `FB_PAGE_ID` | L'ID de votre Page Facebook |

> Instagram publie le reel à partir d'une **URL vidéo publique** — c'est pour ça que la vidéo est d'abord hébergée sur Supabase (§2 requis).

---

## 4. TikTok

1. <https://developers.tiktok.com> → créez une app.
2. Activez **Content Posting API** avec le scope **`video.publish`** (⚠️ audit TikTok obligatoire ; tant que l'app n'est pas approuvée, elle poste seulement en mode privé/test).
3. Faites l'autorisation OAuth pour obtenir un **access token**.

| Secret | Description |
|---|---|
| `TIKTOK_ACCESS_TOKEN` | Token d'accès TikTok |

> Le token TikTok expire (~24 h) : pour un usage **quotidien non surveillé**, il faudra ajouter la gestion du *refresh token* (on pourra le faire ensemble une fois l'app approuvée).

---

## 5. YouTube (Shorts)

1. <https://console.cloud.google.com> → nouveau projet → activez **YouTube Data API v3**.
2. **Identifiants → OAuth client ID** (type « Web » ou « TV/appareil »).
3. Obtenez un **refresh token** (permanent) via l'OAuth Playground (<https://developers.google.com/oauthplayground>, scope `https://www.googleapis.com/auth/youtube.upload`).

| Secret | Description |
|---|---|
| `YOUTUBE_CLIENT_ID` | Client ID OAuth |
| `YOUTUBE_CLIENT_SECRET` | Client secret OAuth |
| `YOUTUBE_REFRESH_TOKEN` | Refresh token (le script génère un jeton frais à chaque exécution) |

---

## 6. Régler l'heure (fuseau horaire)

Le déclenchement est à **11:00 UTC** (`.github/workflows/daily-reel.yml`), soit **7h en Haïti l'été** (EDT). En **hiver** (EST), cela tombe à 6h : changez alors la ligne `cron` en `"0 12 * * *"`. (GitHub peut retarder les tâches planifiées de quelques minutes — c'est normal.)

---

## 7. Personnaliser

- **Photos :** le reel prend **6 photos, une par catégorie** de `Photographie/` (Baptême, Graduation, Plein air, Mariage, Studio, Événementiel), en rotation quotidienne.
- **Musique :** l'instrumentale `audio/timj-reels-instrumental.mp3` est la bande-son. La **durée du reel s'aligne automatiquement sur la durée de l'audio** (chaque photo occupe `durée_audio ÷ 6`). Pour changer de musique, remplacez ce fichier (ou définissez la variable `AUDIO_PATH`).
- **Légendes & hashtags :** modifiables en haut de `automation/daily-reel.mjs` (objets `HASHTAGS` et `LEGENDES`).
- **Style de la vidéo :** filtre `zoompan` dans la fonction `makeReel`.

---

## Récapitulatif des secrets

| Réseau | Secrets | Validation plateforme ? |
|---|---|---|
| **Site + hébergement vidéo** | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ❌ Non — actif tout de suite |
| **Instagram + Facebook** | `META_ACCESS_TOKEN`, `IG_USER_ID`, `FB_PAGE_ID` | ✅ App Review Meta |
| **TikTok** | `TIKTOK_ACCESS_TOKEN` | ✅ Audit TikTok |
| **YouTube** | `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN` | ⚠️ Écran de consentement Google |

Un réseau dont les secrets manquent est **simplement ignoré**, sans erreur. Vous pouvez donc activer les réseaux **un par un**.
