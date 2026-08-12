#!/usr/bin/env bash
#
# Publier.command — Double-cliquez sur ce fichier dans le Finder pour
# publier vos modifications du site Timj Multi-Services en ligne.

cd "$(dirname "$0")" || exit 1
clear
echo "==================================================="
echo "   Publier le site Timj Multi-Services en ligne"
echo "==================================================="
echo ""
printf "Décrivez brièvement votre modification (ou appuyez sur Entrée) : "
read -r MSG
echo ""

if [ -z "$MSG" ]; then
  ./deploy.sh
else
  ./deploy.sh "$MSG"
fi

echo ""
printf "Terminé. Appuyez sur Entrée pour fermer cette fenêtre."
read -r _
