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
#
# Avant l'export, le numéro et la date du jeu web (js/version.js) passent dans le projet
# (application/config/version, grip/date) : l'écran titre les affiche, comme celui du jeu web.
# Après, l'application installable devient GRIP, comme le jeu web (site.webmanifest, balises Apple de
# index.html) : son nom (« GRIP Recette » en recette, comme le jeu web), sa description, ses couleurs,
# une icône de 192 en plus (Chrome la demande pour proposer l'installation). Godot, lui, la nommait
# d'après le projet (SLOTLESS), qu'on ne renomme pas pour ne pas déplacer les sauvegardes.
set -e
ICI=$(cd "$(dirname "$0")/.." && pwd)
SORTIE="$ICI/exports/web"
ESSAI="$ICI/../essais/godot"
python3 - "$ICI/../js/version.js" "$ICI/project.godot" <<'PY'
import re, sys
js, projet = sys.argv[1], sys.argv[2]
try:
    v = open(js).read()
except FileNotFoundError:
    sys.exit(0)
num = re.search(r"const APP_VERSION = '([^']+)'", v).group(1)
date = re.search(r"const APP_DATE = '([^']+)'", v).group(1)
s = open(projet).read()
s, n1 = re.subn(r'^config/version="[^"]*"$', 'config/version="%s"' % num, s, flags=re.M)
s, n2 = re.subn(r'^date="[^"]*"$', 'date="%s"' % date, s, flags=re.M)
if n1 != 1 or n2 != 1:
    sys.exit("project.godot : config/version ou grip/date introuvable")
open(projet, "w").write(s)
print("version %s · %s" % (num, date))
PY
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
python3 - "$SORTIE" "$ICI/project.godot" <<'PY'
import json, os, re, sys
from PIL import Image
d, projet = sys.argv[1], sys.argv[2]
recette = re.search(r'^canal="([^"]*)"', open(projet).read(), re.M).group(1) != "prod"
court = "GRIP Recette" if recette else "GRIP"
# l'icône de 192, tirée de celle de 512
Image.open(os.path.join(d, "index.512x512.png")).resize((192, 192), Image.LANCZOS).save(os.path.join(d, "index.192x192.png"))
m = json.load(open(os.path.join(d, "index.manifest.json")))
m.update({
    "id": "./", "name": "GRIP — Racing the Line" + (" (recette)" if recette else ""), "short_name": court, "lang": "fr",
    "description": "Course automobile vue de dessus : choisis ta place sur la piste, du bord jaune au bord bleu.",
    "start_url": "./index.html", "scope": "./", "display": "standalone", "orientation": "any",
    "background_color": "#0f1117", "theme_color": "#0f1117",
})
m["icons"] = [i for i in m.get("icons", []) if i.get("sizes") != "192x192"] + [{"sizes": "192x192", "src": "index.192x192.png", "type": "image/png"}]
json.dump(m, open(os.path.join(d, "index.manifest.json"), "w"), ensure_ascii=False)
p = os.path.join(d, "index.html")
s = open(p).read()
s, n = re.subn(r"<title>[^<]*</title>", "<title>%s</title>" % court, s, count=1)
balises = ('<meta name="apple-mobile-web-app-capable" content="yes">\n'
           '<meta name="apple-mobile-web-app-title" content="%s">\n'
           '<meta name="apple-mobile-web-app-status-bar-style" content="black">\n'
           '<meta name="mobile-web-app-capable" content="yes">\n'
           '<meta name="theme-color" content="#0f1117">\n') % court
if n != 1 or "<link rel=\"manifest\"" not in s:
    sys.exit("index.html : titre ou manifeste introuvable, le modèle de Godot a changé")
s = s.replace("<link rel=\"manifest\"", balises + "<link rel=\"manifest\"", 1)
open(p, "w").write(s)
PY
for f in index.html index.js index.wasm index.side.wasm index.pck index.service.worker.js index.offline.html index.manifest.json \
         index.audio.worklet.js index.audio.position.worklet.js libgrip.web.template_release.wasm32.nothreads.wasm \
         index.png index.icon.png index.144x144.png index.180x180.png index.192x192.png index.512x512.png index.apple-touch-icon.png; do
  [ -f "$SORTIE/$f" ] && cp "$SORTIE/$f" "$ESSAI/$f"
done
grep -o '"gdextensionLibs":\[[^]]*\]' "$ESSAI/index.html"
