# 🔔 Notifications push — activation

Les visiteurs peuvent s'abonner (bouton « 🔔 M'abonner » sur l'accueil) et
reçoivent une **notification sur leur téléphone chaque matin** quand le reel du
jour est publié — même site fermé.

Tout le code est déjà en place :
- `sw.js` (service worker), `manifest.json` (app installable), `js/push.js` (bouton d'abonnement)
- `automation/send-push.mjs` + une étape dans le workflow « Reel quotidien 7h »

Il reste **2 petites étapes** de ton côté.

---

## Étape 1 — Créer la table des abonnés (SQL)

Supabase → **SQL Editor** → **New query** → colle et **Run** :

```sql
create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    endpoint text unique not null,
    subscription jsonb not null,
    created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- N'importe quel visiteur peut s'abonner (insertion seulement).
-- La LECTURE reste réservée au service (envoi des notifications) : les
-- abonnements des visiteurs ne sont donc jamais exposés publiquement.
drop policy if exists "Tout le monde peut s'abonner" on public.push_subscriptions;
create policy "Tout le monde peut s'abonner"
    on public.push_subscriptions
    for insert to anon, authenticated
    with check (true);
```

## Étape 2 — Ajouter les clés VAPID (GitHub Secrets)

GitHub → dépôt `timjs_event` → **Settings → Secrets and variables → Actions → New repository secret**. Ajoute ces **2 secrets** :

| Name | Secret |
|---|---|
| `VAPID_PUBLIC_KEY` | `BF7xXcwCajA-FZeKE1xQgxdaebyRmPcnkLOaYbT5PU4EOjmPuUpEPWU8VaYU6Lor12CGeKlWmKNj3O-szqjKy1Y` |
| `VAPID_PRIVATE_KEY` | `XVOMm2z27_H90DsiwMX3E-loCJ7k0wgahaOYeNofsqk` |

> 🔒 La clé **publique** est déjà dans le site (normal, elle est publique). La clé **privée** ne doit vivre **que** dans ce secret GitHub — ne la mets nulle part ailleurs.

---

## C'est prêt !

- Sur **Android / ordinateur** : le visiteur clique « 🔔 M'abonner », autorise, c'est fait.
- Sur **iPhone** : Apple exige d'abord d'**« Ajouter à l'écran d'accueil »** (bouton Partager ⬆️), puis d'ouvrir l'app et de cliquer « M'abonner ». Le bouton affiche déjà ce rappel aux visiteurs iPhone.

Chaque matin, après la publication du reel, tous les abonnés reçoivent la
notification automatiquement. Les abonnements expirés sont nettoyés tout seuls.

### Tester
Onglet **Actions** → « Reel quotidien 7h » → **Run workflow**. Si tu es abonné(e),
tu devrais recevoir la notification en fin d'exécution.
