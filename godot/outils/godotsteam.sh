#!/bin/bash
# Réinstalle GodotSteam (codeberg.org/godotsteam, édition GDExtension) dans godot/addons/godotsteam,
# avec toutes ses bibliothèques (Mac, 32 bits, ARM, Android) :
#
#   bash godot/outils/godotsteam.sh [version]          (4.24 par défaut)
#
# Le dépôt n'en garde que Windows et Linux 64 bits ; le fichier godotsteam.gdextension du dépôt
# est remplacé par celui du paquet.
set -euo pipefail
VERSION="${1:-4.24}"
ICI="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fL -o "$TMP/gs.zip" "https://codeberg.org/godotsteam/godotsteam/releases/download/v$VERSION-gde/godotsteam-$VERSION-gdextension-plugin-4.4.zip"
unzip -q "$TMP/gs.zip" -d "$TMP/x"
rm -rf "$ICI/addons/godotsteam"
mkdir -p "$ICI/addons"
cp -r "$TMP/x/addons/godotsteam" "$ICI/addons/"
echo "installé : $ICI/addons/godotsteam ($(du -sh "$ICI/addons/godotsteam" | cut -f1))"
