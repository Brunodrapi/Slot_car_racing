#!/usr/bin/env bash
# Fabrique la version jouable et la recopie dans le clone du dépôt publié, prête à pousser.
#
#   tools/publier.sh <clone de GRIP-game/Grip-Game->
#
# Le contenu du clone est remplacé par dist/ (son .git est gardé), puis un commit est préparé avec le
# numéro de version. Rien n'est poussé : `git -C <clone> push origin main` reste à faire.
set -euo pipefail
cible="${1:?usage : tools/publier.sh <clone du dépôt publié>}"
racine="$(cd "$(dirname "$0")/.." && pwd)"
[ -d "$cible/.git" ] || { echo "$cible n'est pas un clone git" >&2; exit 1; }
cd "$racine"
npm run --silent build
version="$(sed -n "s/.*APP_VERSION = '\([^']*\)'.*/\1/p" js/version.js)"
find "$cible" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a dist/. "$cible/"
git -C "$cible" add -A
if git -C "$cible" diff --cached --quiet; then echo "rien de nouveau à publier ($version)"; exit 0; fi
git -C "$cible" commit -q -m "GRIP $version"
echo "prêt : GRIP $version dans $cible — reste à pousser (git -C $cible push origin main)"
