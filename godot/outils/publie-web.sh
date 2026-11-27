#!/bin/bash
# Exporte la version web de SLOTLESS et la publie dans essais/godot (la recette).
#
#   bash godot/outils/publie-web.sh
#
# Le service worker que Godot écrit (l'application installable) remplit son cache À TRAVERS le cache
# HTTP du navigateur, où GitHub Pages garde chaque fichier dix minutes : juste après une publication,
# un téléphone pouvait ranger la page neuve avec le moteur d'avant, et les resservir ensemble à chaque
# ouverture (« GDExtension libraries are not supported by this engine version »). On le corrige après
# l'export : le service worker va chercher ses fichiers sur le réseau, sans le cache HTTP, et le nouveau
# remplace l'ancien dès qu'il est installé. La page, elle, se répare si elle tombe malgré tout sur un
# moteur d'une autre version (html/head_include de l'export Web).
# Les icônes et l'image de chargement (index.png) sont recopiées aussi : elles suivent l'icône et l'image de
# démarrage du projet (celles de GRIP depuis le retour du logo) ; Godot les réencode à l'identique.
set -e
ICI=$(cd "$(dirname "$0")/.." && pwd)
SORTIE="$ICI/exports/web"
ESSAI="$ICI/../essais/godot"
rm -rf "$SORTIE" && mkdir -p "$SORTIE"
godot --headless --path "$ICI" --export-release "Web" "$SORTIE/index.html" > "$SORTIE/../export-web.log" 2>&1
python3 - "$SORTIE/index.service.worker.js" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
remplace = [
    ("cache.addAll(CACHED_FILES)", "cache.addAll(CACHED_FILES.map((f) => new Request(f, { cache: 'reload' })))"),
    ("response = await self.fetch(event.request);", "response = await self.fetch(event.request, { cache: 'reload' });"),
    # le nouveau service worker remplace l'ancien tout de suite, et efface son cache : sinon l'ancien
    # resservait sa page (cassée ou non) tant que l'application n'avait pas été fermée
    ("self.addEventListener('install', (event) => {", "self.addEventListener('install', (event) => {\n\tself.skipWaiting();"),
]
for avant, apres in remplace:
    if s.count(avant) != 1:
        sys.exit("service worker : « %s » introuvable, le modèle de Godot a changé" % avant)
    s = s.replace(avant, apres)
open(p, "w").write(s)
PY
for f in index.html index.js index.wasm index.side.wasm index.pck index.service.worker.js index.offline.html index.manifest.json \
         index.audio.worklet.js index.audio.position.worklet.js libgrip.web.template_release.wasm32.nothreads.wasm \
         index.png index.icon.png index.144x144.png index.180x180.png index.512x512.png index.apple-touch-icon.png; do
  [ -f "$SORTIE/$f" ] && cp "$SORTIE/$f" "$ESSAI/$f"
done
grep -o '"gdextensionLibs":\[[^]]*\]' "$ESSAI/index.html"
