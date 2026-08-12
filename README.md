# Timj Multi-Services

Site web statique pour Timj Multi-Services : décoration événementielle, photographie/vidéographie, premiers soins, et réservation en ligne (paiement MonCash / NatCash).

## Structure

- `index.html` — page d'accueil
- `Decoration.html`, `Photographie.html`, `Premiers-Soins.html`, `reservation.html` — pages de services
- `anniversaire.html`, `bapteme.html`, `graduation.html`, `mariage.html`, `promesse.html`, `romantique.html`, `shower.html` — pages thématiques de décoration
- `Snake.html` / `snake.js` — mini-jeu Snake
- `style.css` — styles du site
- `images/`, `Photographie/` — ressources visuelles
- `supabase/` — configuration Supabase (voir [CONFIGURATION-SUPABASE.md](CONFIGURATION-SUPABASE.md))

## Lancer le site en local

Le site utilise Supabase, qui nécessite d'être servi via `http://` ou `https://` (le mode `file://` ne fonctionne pas). Par exemple :

```bash
python3 -m http.server 8000
```

Puis ouvrez `http://localhost:8000` dans votre navigateur.
