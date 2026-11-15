#!/usr/bin/env bash
# Compila el APK de cada app Orbe y lo copia a <app>/dist/<Nombre>-<versión>.apk
#   JAVA_HOME=/ruta/al/jdk17 bash tools-diseno/compilar-todas.sh [Carpeta …]
set -u
cd "$(dirname "$0")/.."
APPS=("$@")
[ ${#APPS[@]} -eq 0 ] && APPS=(RadioOrbe OrbeTV OrbeSismos OrbeEspacio OrbeClima OrbePodcasts OrbeBiblia OrbeJuegos)
declare -A NOMBRE=([RadioOrbe]=OrbeRadio [OrbeTV]=OrbeTV [OrbeSismos]=OrbeSismos [OrbeEspacio]=OrbeEspacio [OrbeClima]=OrbeClima [OrbePodcasts]=OrbePodcasts [OrbeBiblia]=OrbeBiblia [OrbeJuegos]=JuegosDeColombia)
for a in "${APPS[@]}"; do
  [ -d "$a" ] || continue
  v=$(grep -o "versionName '[^']*'" "$a/app/build.gradle" | cut -d"'" -f2)
  echo "== $a $v"
  rm -f "$a/app/src/main/assets/www/data/grid-prueba.json"
  apk="$a/app/build/outputs/apk/release/app-release.apk"
  rm -f "$apk"   # así un fallo nunca copia un APK viejo
  ( cd "$a" && ./gradlew assembleRelease --console=plain -q 2>&1 | grep -v "kotlin_module\|^warning\|deprecat\|^Note:" | tail -8 )
  if [ -f "$apk" ]; then
    mkdir -p "$a/dist" && cp "$apk" "$a/dist/${NOMBRE[$a]}-$v.apk"
    ls -la "$a/dist/${NOMBRE[$a]}-$v.apk"
  else
    echo "   ¡FALLÓ la compilación de $a!"
  fi
done
