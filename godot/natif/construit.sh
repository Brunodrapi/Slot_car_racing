#!/bin/bash
# Construit le moteur C++ de GRIP (GDExtension) pour chaque plate-forme.
#
#   bash godot/natif/construit.sh [linux|windows|android|tout]
#
# Il faut : godot-cpp (cloné ici à la version notée ci-dessous), SCons, un compilateur C++ ;
# MinGW-w64 pour Windows (paquet g++-mingw-w64-x86-64-posix) ; le NDK d'Android r27 pour Android
# (ANDROID_HOME ou ANDROID_NDK_ROOT). Les bibliothèques vont dans godot/natif/bin, et sont gardées
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
  case $cible in android|tout) build platform=android arch=arm64 target=$t ;; esac
done
ls -la "$ICI/bin"
