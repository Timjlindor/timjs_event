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
-- Récapitulatif des accès
-- ============================================================
-- - Formulaire de réservation (site) : peut seulement INSÉRER une ligne
--   et UPLOADER un fichier. Il ne peut rien lire ni modifier.
-- - Toi (Supabase Dashboard → Table Editor / Storage) : accès complet en
--   lecture à toutes les réservations et preuves de paiement, car le
--   dashboard utilise la clé service_role qui ignore les policies RLS.
