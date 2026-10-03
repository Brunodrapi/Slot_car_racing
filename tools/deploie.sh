#!/usr/bin/env bash
# Déploie la fonction serveur `record` sur Supabase.
#
#   tools/deploie.sh [nom-de-fonction]
#
# POURQUOI UN SCRIPT POUR UNE COMMANDE. Parce que ce n'est pas une commande, c'est une commande plus
# trois choses qu'on oublie : le bon numéro de projet, le jeton au bon endroit, et le fait que le
# CLI n'est pas installé dans ce conteneur. Chacune rate d'une façon différente et peu bavarde —
# « project not found », « Access token not provided », « command not found » — et on y repasse à
# chaque déploiement.
#
# LE JETON NE SE TAPE PAS ICI. `SUPABASE_ACCESS_TOKEN` est un jeton personnel : il vaut pour tout le
# compte, tous projets confondus, et il n'en existe pas de plus étroit pour déployer. Il se pose dans
# les réglages de l'environnement cloud (Edit → API credentials, ou une variable d'environnement), et
# une NOUVELLE session le reçoit. Jamais dans le dépôt, jamais dans le chat : une clé qui passe par
# un de ces deux canaux est une clé à révoquer.
set -euo pipefail

FONCTION="${1:-record}"
PROJET="${SUPABASE_PROJECT_REF:-fyaifqvghkvrydcldiup}"
RACINE="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  cat >&2 <<'FIN'
  SUPABASE_ACCESS_TOKEN n'est pas dans l'environnement.

  Où le poser : menu de l'environnement cloud dans la barre de titre de la session → Edit,
  section « API credentials » si elle est proposée, sinon comme variable d'environnement.
  Une nouvelle session le reçoit ; celle en cours, non.

  Le jeton se crée sur https://supabase.com/dashboard/account/tokens et se révoque au même endroit.
FIN
  exit 2
fi

if [ ! -d "$RACINE/supabase/functions/$FONCTION" ]; then
  echo "  supabase/functions/$FONCTION n'existe pas" >&2
  exit 2
fi

cd "$RACINE"
echo "  déploiement de « $FONCTION » sur le projet $PROJET"
# `npx` plutôt qu'une installation : le conteneur est recréé à chaque session, et une dépendance
# installée dans l'image serait à remettre à jour sans que personne ne le voie.
npx --yes supabase@latest functions deploy "$FONCTION" --project-ref "$PROJET"
echo
echo "  déployé. Ce que ça NE dit pas : que la fonction accepte un vrai temps. Elle exige un jeton"
echo "  Google, donc un navigateur et un vrai compte — il faut poser un tour dans le jeu pour le voir."
