#!/usr/bin/env bash
# Fabrique la version jouable d'un canal et la recopie dans son dépôt de publication, prête à pousser.
#
#   tools/publier.sh recette <dossier>   # branche `recette` de ce dépôt → https://brunodrapi.github.io/Slot_car_racing/
#   tools/publier.sh prod <dossier>      # GRIP-game/grip-game.github.io → https://grip-game.github.io
#
# <dossier> est une copie de travail de la cible : pour la recette, un `git worktree` de la branche
# `recette` ; pour la prod, un clone de GRIP-game/grip-game.github.io. Son contenu est remplacé par
# dist/ (son .git est gardé), puis un commit est préparé, qui nomme la version, le canal et le commit
# source. Rien n'est poussé : `git -C <dossier> push` reste à faire.
#
# On ne publie qu'un dépôt sans modification en cours : chaque publication correspond ainsi à un
# commit, et la prod est exactement ce que la recette a montré.
set -euo pipefail
canal="${1:?usage : tools/publier.sh recette|prod <dossier>}"
cible="${2:?usage : tools/publier.sh recette|prod <dossier>}"
case "$canal" in recette|prod) ;; *) echo "canal inconnu : $canal (recette ou prod)" >&2; exit 1 ;; esac
racine="$(cd "$(dirname "$0")/.." && pwd)"
[ -e "$cible/.git" ] || { echo "$cible n'est pas une copie de travail git" >&2; exit 1; }
cd "$racine"
git diff --quiet HEAD || { echo "des modifications ne sont pas encore dans un commit : on ne publie qu'un commit" >&2; exit 1; }
source="$(git rev-parse --short HEAD)"
node tools/build-dist.js --canal="$canal"
version="$(sed -n "s/.*APP_VERSION = '\([^']*\)'.*/\1/p" js/version.js)"
find "$cible" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a dist/. "$cible/"
git -C "$cible" add -A
if git -C "$cible" diff --cached --quiet; then echo "rien de nouveau à publier ($version, $canal)"; exit 0; fi
git -C "$cible" commit -q -m "GRIP $version ($canal, source $source)"
echo "prêt : GRIP $version en $canal dans $cible — reste à pousser (git -C $cible push)"
