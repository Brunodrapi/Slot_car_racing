#!/usr/bin/env bash
# Publie en prod : fabrique la version minifiée et la recopie dans le clone du dépôt de la prod.
#
#   tools/publier.sh <clone de GRIP-game/grip-game.github.io>     (servi à https://grip-game.github.io)
#
# La recette n'a rien à publier : c'est ce dépôt-ci, servi tel quel par GitHub Pages
# (https://brunodrapi.github.io/Slot_car_racing/). La prod, elle, ne reçoit que la version fabriquée.
#
# Le contenu du clone est remplacé par dist/ (son .git est gardé), puis un commit est préparé. Son
# message est le JOURNAL DES VERSIONS, pas le code : les entrées de CHANGELOG.md publiées depuis la
# version que la prod porte encore. Rien n'est poussé : `git -C <clone> push origin main` reste à faire.
#
# On ne publie qu'un dépôt sans modification en cours, et qu'une version qui a son entrée au journal.
set -euo pipefail
cible="${1:?usage : tools/publier.sh <clone de GRIP-game/grip-game.github.io>}"
racine="$(cd "$(dirname "$0")/.." && pwd)"
[ -e "$cible/.git" ] || { echo "$cible n'est pas une copie de travail git" >&2; exit 1; }
cd "$racine"
git diff --quiet HEAD || { echo "des modifications ne sont pas encore dans un commit : on ne publie qu'un commit" >&2; exit 1; }
version="$(sed -n "s/.*APP_VERSION = '\([^']*\)'.*/\1/p" js/version.js)"
avant="$(node -e "try { console.log(require(process.argv[1]).version) } catch (_) { console.log('0.0.0') }" "$(cd "$cible" && pwd)/manifeste.json")"
# Les entrées du journal entre la version publiée (exclue) et celle-ci (incluse), les plus récentes d'abord.
journal="$(node - "$avant" "$version" <<'JS'
const [avant, version] = process.argv.slice(2);
const num = (v) => v.split(/[.-]/).slice(0, 3).map(Number);
const cmp = (a, b) => { const x = num(a), y = num(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
const texte = require('fs').readFileSync('CHANGELOG.md', 'utf8');
const sections = texte.split(/^## /m).slice(1).map((s) => { const [tete, ...corps] = s.split('\n'); return { v: tete.trim(), corps: corps.join('\n').trim() }; });
if (!sections.some((s) => s.v === version)) { console.error(`CHANGELOG.md n'a pas d'entrée « ## ${version} » : on n'en publie pas sans`); process.exit(1); }
const dedans = sections.filter((s) => cmp(s.v, avant) > 0 && cmp(s.v, version) <= 0);
console.log(dedans.length === 1 ? dedans[0].corps : dedans.map((s) => s.v + '\n' + s.corps).join('\n\n'));
JS
)"
npm run --silent build
find "$cible" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a dist/. "$cible/"
git -C "$cible" add -A
if git -C "$cible" diff --cached --quiet; then echo "rien de nouveau à publier ($version)"; exit 0; fi
git -C "$cible" commit -q -F - <<MSG
GRIP $version

$journal
MSG
echo "prêt : GRIP $version (la prod portait $avant) — reste à pousser (git -C $cible push origin main)"
