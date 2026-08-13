-- Timj Multi-Services — schema pour la table des réservations et le
-- stockage des preuves de paiement.
--
-- À exécuter une fois dans Supabase → SQL Editor → New query → Run.
-- Sans hébergement, sur file:///, aucune requête Supabase ne peut passer :
-- voir CONFIGURATION-SUPABASE.md, section 0.

-- ============================================================
-- 1. Table des réservations
-- ============================================================

create table if not exists public.reservations (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    user_id uuid references auth.users (id) on delete set null,
    full_name text not null,
    phone text not null,
    email text,
    service text not null,
    event_date date,
    amount text not null,
    payment_method text not null,
    details text,
    payment_proof_path text,
    status text not null default 'en_attente'
        check (status in ('en_attente', 'confirmee', 'annulee'))
);

alter table public.reservations enable row level security;

-- N'importe quel visiteur (connecté ou non) peut créer une réservation,
-- mais personne ne peut lire, modifier ou supprimer les réservations des
-- autres depuis le site : il n'y a pas de policy SELECT/UPDATE/DELETE.
-- Toi seul, depuis le Table Editor Supabase (qui utilise la clé service,
-- pas la clé anon), vois toutes les réservations.
drop policy if exists "Toute personne peut réserver" on public.reservations;
create policy "Toute personne peut réserver"
    on public.reservations
    for insert
    to anon, authenticated
    with check (true);

create index if not exists reservations_created_at_idx
    on public.reservations (created_at desc);

-- ============================================================
-- 1bis. Table des annonces / nouveautés (page d'accueil)
-- ============================================================
--
-- La page d'accueil affiche un fil d'annonces. Tout le monde peut LIRE les
-- annonces, mais seule l'administratrice (ton email) peut en PUBLIER ou en
-- SUPPRIMER. Pour changer l'administratrice, remplace l'email ci-dessous
-- dans les deux policies.

create table if not exists public.annonces (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    author_email text,
    title text not null,
    body text not null
);

alter table public.annonces enable row level security;

-- Lecture publique : n'importe quel visiteur voit les annonces.
drop policy if exists "Lecture publique des annonces" on public.annonces;
create policy "Lecture publique des annonces"
    on public.annonces
    for select
    to anon, authenticated
    using (true);

-- Publication réservée à l'administratrice (compare l'email du compte connecté).
drop policy if exists "Admin peut publier une annonce" on public.annonces;
create policy "Admin peut publier une annonce"
    on public.annonces
    for insert
    to authenticated
    with check (auth.jwt() ->> 'email' = 'lindorelie23@gmail.com');

-- Suppression réservée à l'administratrice.
drop policy if exists "Admin peut supprimer une annonce" on public.annonces;
create policy "Admin peut supprimer une annonce"
    on public.annonces
    for delete
    to authenticated
    using (auth.jwt() ->> 'email' = 'lindorelie23@gmail.com');

create index if not exists annonces_created_at_idx
    on public.annonces (created_at desc);

-- ============================================================
-- 2. Stockage des preuves de paiement (bucket privé)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Upload autorisé pour tout le monde (le formulaire de réservation
-- fonctionne sans compte), mais le bucket reste privé : personne ne peut
-- lister ou télécharger les fichiers des autres depuis le site.
drop policy if exists "Upload public des preuves de paiement" on storage.objects;
create policy "Upload public des preuves de paiement"
    on storage.objects
    for insert
    to anon, authenticated
    with check (bucket_id = 'payment-proofs');

-- ============================================================
-- 3. Publications automatiques (YouTube / Facebook / Instagram / TikTok)
-- ============================================================
--
-- Ces publications ne sont jamais écrites par le site lui-même : elles
-- sont synchronisées par la fonction "sync-social-posts" (voir
-- supabase/functions/), qui utilise la clé service_role et contourne donc
-- RLS. Aucune policy INSERT/UPDATE/DELETE n'est créée ici volontairement :
-- ni les visiteurs ni les comptes connectés ne peuvent écrire dans cette
-- table, seule la fonction planifiée le peut.

create table if not exists public.social_posts (
    id uuid primary key default gen_random_uuid(),
    platform text not null check (platform in ('youtube', 'facebook', 'instagram', 'tiktok')),
    external_id text not null,
    title text,
    body text,
    media_url text,
    thumbnail_url text,
    permalink text not null,
    published_at timestamptz not null,
    created_at timestamptz not null default now(),
    unique (platform, external_id)
);

alter table public.social_posts enable row level security;

-- Lecture publique : tout le monde voit les publications synchronisées.
drop policy if exists "Lecture publique des publications sociales" on public.social_posts;
create policy "Lecture publique des publications sociales"
    on public.social_posts
    for select
    to anon, authenticated
    using (true);

create index if not exists social_posts_published_at_idx
    on public.social_posts (published_at desc);

-- Le refresh token TikTok change à chaque utilisation (rotation
-- obligatoire côté TikTok) : il doit donc être stocké quelque part que la
-- fonction peut mettre à jour, plutôt que dans un secret figé. Aucune
-- policy = totalement inaccessible depuis le site, y compris connecté.
create table if not exists public.platform_tokens (
    platform text primary key,
    refresh_token text not null,
    updated_at timestamptz not null default now()
);

alter table public.platform_tokens enable row level security;

-- ============================================================
-- 4. Planification automatique (optionnel, à exécuter en dernier)
-- ============================================================
--
-- Nécessite d'activer les extensions "pg_cron" et "pg_net" une fois dans
-- Supabase → Database → Extensions (recherche "cron" et "pg_net", active
-- les deux). Ensuite, remplace <ANON_KEY> par ta clé anon (celle déjà
-- utilisée dans js/supabase-client.js) et exécute ce bloc :
--
-- select cron.schedule(
--     'sync-social-posts-every-20-min',
--     '*/20 * * * *',
--     $$
--     select net.http_post(
--         url := 'https://zcgwkvuyxosxfyxwmfim.supabase.co/functions/v1/sync-social-posts',
--         headers := jsonb_build_object('Authorization', 'Bearer <ANON_KEY>', 'Content-Type', 'application/json'),
--         body := '{}'::jsonb
--     );
--     $$
-- );
--
-- Pour arrêter la synchronisation automatique plus tard :
-- select cron.unschedule('sync-social-posts-every-20-min');

-- ============================================================
-- 5. Lecture native, likes et commentaires réels
-- ============================================================
--
-- Ajoute le type de média (pour savoir s'il faut afficher un lecteur
-- vidéo natif ou une simple photo), l'URL d'intégration du lecteur, et
-- les compteurs réels de likes/commentaires récupérés depuis chaque
-- plateforme au moment de la synchronisation.

alter table public.social_posts
    add column if not exists media_type text
        check (media_type in ('photo', 'video', 'text')),
    add column if not exists video_embed_url text,
    add column if not exists like_count integer,
    add column if not exists comment_count integer;

-- ============================================================
-- 6. Compteur réel de parties jouées (page Jeu — défi communautaire)
-- ============================================================
--
-- Chaque partie terminée insère une ligne. Aucune donnée personnelle :
-- juste un score et une date. Lecture ET écriture publiques, car c'est
-- un compteur affiché à tous, pas une donnée privée comme les
-- réservations.

create table if not exists public.game_plays (
    id uuid primary key default gen_random_uuid(),
    game text not null default 'arcade',
    score integer not null default 0,
    played_at timestamptz not null default now()
);

alter table public.game_plays enable row level security;

drop policy if exists "Enregistrer une partie" on public.game_plays;
create policy "Enregistrer une partie"
    on public.game_plays
    for insert
    to anon, authenticated
    with check (score >= 0 and score <= 100000);

drop policy if exists "Voir le nombre de parties" on public.game_plays;
create policy "Voir le nombre de parties"
    on public.game_plays
    for select
    to anon, authenticated
    using (true);

create index if not exists game_plays_played_at_idx
    on public.game_plays (played_at desc);

-- ============================================================
-- Récapitulatif des accès
-- ============================================================
-- - Formulaire de réservation (site) : peut seulement INSÉRER une ligne
--   et UPLOADER un fichier. Il ne peut rien lire ni modifier.
-- - Fil de publications sociales (site) : peut seulement LIRE. Seule la
--   fonction planifiée sync-social-posts peut écrire (clé service_role).
-- - Toi (Supabase Dashboard → Table Editor / Storage) : accès complet en
--   lecture à toutes les réservations et preuves de paiement, car le
--   dashboard utilise la clé service_role qui ignore les policies RLS.
