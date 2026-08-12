# 📊 Compteur de visiteurs — activation

Le site enregistre **une visite par session** (aucune donnée personnelle : seulement la page visitée et la date). Le code est déjà en place dans `premium.js` (chargé sur toutes les pages). Il reste **une seule étape** : créer la table dans Supabase.

## Étape unique — coller ce SQL dans Supabase

Supabase → ton projet → **SQL Editor** → **New query** → colle ceci → **Run** :

```sql
-- Table des visites (aucune donnée personnelle)
create table if not exists public.page_views (
    id uuid primary key default gen_random_uuid(),
    path text,
    created_at timestamptz not null default now()
);

alter table public.page_views enable row level security;

-- N'importe quel visiteur peut enregistrer SA visite (insertion seulement)
drop policy if exists "Visiteurs peuvent enregistrer une visite" on public.page_views;
create policy "Visiteurs peuvent enregistrer une visite"
    on public.page_views for insert to anon, authenticated with check (true);

-- Vue agrégée : nombre de visites par jour (lecture publique, sans aucun détail)
create or replace view public.daily_views as
    select (created_at at time zone 'America/Port-au-Prince')::date as jour,
           count(*) as visites
    from public.page_views
    group by 1
    order by 1 desc;

grant select on public.daily_views to anon, authenticated;
```

C'est tout. Dès que c'est exécuté, chaque visite du site est comptée.

## Voir tes visiteurs par jour

- **Dans Supabase** : Table Editor / SQL Editor → `select * from daily_views;`
- **Ou** dis-le-moi : je peux interroger `daily_views` et t'afficher le nombre de visiteurs par jour quand tu veux.

> Remarque : ce compteur mesure les **visites par session de navigateur** (bonne approximation du nombre de visiteurs). Il inclut un peu de trafic automatisé (robots), comme tout compteur simple. Pour des statistiques très détaillées (sources, pays, temps passé…), on pourra ajouter Google Analytics plus tard.
