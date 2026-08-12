#!/usr/bin/env bash
#
# deploy.sh — Publie les modifications du site Timj Multi-Services en ligne.
#
# Ce script :
#   1. compresse automatiquement les photos trop lourdes (> 1,5 Mo) ;
#   2. enregistre les changements (git commit) ;
#   3. les envoie sur GitHub (git push) ;
#   → GitHub Pages et Vercel redéploient ensuite le site tout seuls (~1 min).
#
# Usage : ./deploy.sh "Message décrivant la modification"
#         (le message est optionnel)

set -uo pipefail
cd "$(dirname "$0")" || exit 1

MSG="${1:-Mise a jour du site ($(date '+%Y-%m-%d %H:%M'))}"

echo "→ Compression des photos volumineuses (> 1,5 Mo)..."
find Photographie -type f \( -iname '*.jpg' -o -iname '*.jpeg' \) -size +1500k -print0 2>/dev/null \
  | while IFS= read -r -d '' f; do
      if sips -Z 2000 -s format jpeg -s formatOptions 72 "$f" --out "$f" >/dev/null 2>&1; then
        echo "   compressé : $f"
      fi
    done

echo "→ Recherche de modifications..."
git add -A
if git diff --cached --quiet; then
  echo "✅ Aucune modification à publier. Le site est déjà à jour."
  exit 0
fi

echo "→ Enregistrement des changements..."
git commit -q -m "$MSG" || { echo "❌ Échec du commit."; exit 1; }

echo "→ Envoi vers GitHub..."
if ! git push -q origin main; then
  echo "❌ Échec de l'envoi. Vérifiez votre connexion Internet, puis relancez."
  exit 1
fi

echo ""
echo "✅ Publié ! Le site se met à jour tout seul dans ~1 minute :"
echo "   https://timjlindor.github.io/timjs_event/"
