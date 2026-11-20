#!/bin/bash
# Installe l'extension WebRTC officielle de Godot (godotengine/webrtc-native) dans godot/addons/.
#
#   bash godot/outils/webrtc.sh [version]        (1.2.2-stable par défaut)
#
# Sur ordinateur et téléphone, Godot n'a pas WebRTC de lui-même : c'est cette extension qui le lui
# donne, et sans elle le multijoueur n'y est pas (la version web, elle, prend celui du navigateur).
# Elle vient de l'équipe de Godot, compilée pour Windows, Linux, Mac, Android et iPhone ; le
# fichier webrtc_native.gdextension qu'elle apporte dit à Godot quelle bibliothèque charger, et
# l'exclut de la version web.
set -euo pipefail
VERSION="${1:-1.2.2-stable}"
ICI="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fL -o "$TMP/webrtc.zip" "https://github.com/godotengine/webrtc-native/releases/download/$VERSION/godot-extension-webrtc_native.zip"
unzip -q "$TMP/webrtc.zip" -d "$TMP/x"
rm -rf "$ICI/addons/webrtc_native"
mkdir -p "$ICI/addons"
cp -r "$TMP/x/addons/webrtc_native" "$ICI/addons/"
echo "installé : $ICI/addons/webrtc_native ($(du -sh "$ICI/addons/webrtc_native" | cut -f1))"
