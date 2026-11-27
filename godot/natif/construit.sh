#!/bin/bash
# Construit le moteur C++ de GRIP (GDExtension) pour chaque plate-forme.
#
#   bash godot/natif/construit.sh [linux|windows|android|web|tout]
#
# Il faut : godot-cpp (cloné ici à la version notée ci-dessous), SCons, un compilateur C++ ;
# MinGW-w64 pour Windows (paquet g++-mingw-w64-x86-64-posix) ; le NDK d'Android r27 pour Android
# (ANDROID_HOME, avec ndk/<NDK_VERSION> dedans ; 27.2.12479018 par défaut) ; pour le navigateur, Emscripten À LA
# VERSION QUI A CONSTRUIT GODOT (4.0.20 pour Godot 4.7.2 : la console du jeu web l'écrit au lancement, « Build
# configuration: Emscripten … »), dans EMSDK (/root/emsdk par défaut). Les bibliothèques vont dans godot/natif/bin, et sont gardées
# dans le dépôt : on n'a pas besoin de ce script pour jouer ni pour exporter le jeu.
set -e
ICI=$(cd "$(dirname "$0")" && pwd)
CPP=${GODOT_CPP:-/root/godot/godot-cpp}
CPP_COMMIT=7fd5c4b       # godot-cpp, branche master, compilé contre l'API de Godot 4.7.2
if [ ! -d "$CPP" ]; then
  git clone https://github.com/godotengine/godot-cpp "$CPP"
  (cd "$CPP" && git checkout "$CPP_COMMIT")
fi
API="$CPP/extension_api.json"
[ -f "$API" ] || (cd "$CPP" && godot --headless --dump-extension-api)
cible=${1:-tout}
build() { (cd "$ICI" && scons "$@" godot_cpp="$CPP" custom_api_file="$API" -j"$(nproc)"); }
for t in template_debug template_release; do
  case $cible in linux|tout) build platform=linux target=$t ;; esac
  case $cible in windows|tout) build platform=windows use_mingw=yes target=$t ;; esac
  case $cible in android|tout) build platform=android arch=arm64 target=$t ndk_version="${NDK_VERSION:-27.2.12479018}" ;; esac
done
# Le navigateur : sans fils d'exécution (l'export web de GRIP n'en a pas, pour l'iPhone), en module chargé
# par le modèle « dlink » de Godot. Seulement la version publiée.
case $cible in web|tout)
  source "${EMSDK:-/root/emsdk}/emsdk_env.sh" >/dev/null
  build platform=web threads=no target=template_release ;;
esac
ls -la "$ICI/bin"
