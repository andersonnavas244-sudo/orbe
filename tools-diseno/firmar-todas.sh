#!/usr/bin/env bash
# Genera el AAB (para Play Store) y el APK firmados de todas las apps Orbe con la misma llave.
# Usa ~/orbe-firma/firma.properties, que crea tools-diseno/firmar-juegos.sh la primera vez (ahí se escribe la contraseña).
#   bash tools-diseno/firmar-todas.sh                 → todas
#   bash tools-diseno/firmar-todas.sh OrbeTV OrbeClima → solo esas
set -u
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-/c/Users/laura/.jdks/jdk-17.0.21+9}"
export PATH="$JAVA_HOME/bin:$PATH"
FIRMA="${ORBE_FIRMA:-$HOME/orbe-firma/firma.properties}"
if [ ! -f "$FIRMA" ]; then
  echo "No encuentro $FIRMA. Primero corre: bash tools-diseno/firmar-juegos.sh (crea la llave y guarda la contraseña)."; exit 1
fi
APPS=("$@")
[ ${#APPS[@]} -eq 0 ] && APPS=(RadioOrbe OrbeTV OrbeSismos OrbeEspacio OrbeClima OrbePodcasts OrbeBiblia OrbeJuegos)
declare -A NOMBRE=([RadioOrbe]=OrbeRadio [OrbeTV]=OrbeTV [OrbeSismos]=OrbeSismos [OrbeEspacio]=OrbeEspacio [OrbeClima]=OrbeClima [OrbePodcasts]=OrbePodcasts [OrbeBiblia]=OrbeBiblia [OrbeJuegos]=JuegosDeColombia)
mkdir -p dist/aab
fallas=()
for a in "${APPS[@]}"; do
  v=$(grep -oE "versionName '[^']+'" "$a/app/build.gradle" | head -1 | cut -d"'" -f2)
  echo "== ${NOMBRE[$a]} $v"
  rm -f "$a"/app/build/outputs/bundle/release/*.aab
  if (cd "$a" && ./gradlew -q bundleRelease assembleRelease); then
    cp "$a/app/build/outputs/bundle/release/app-release.aab" "dist/aab/${NOMBRE[$a]}-$v.aab"
    cp "$a/app/build/outputs/apk/release/app-release.apk" "dist/aab/${NOMBRE[$a]}-$v-firmada.apk"
    ls -la "dist/aab/${NOMBRE[$a]}-$v.aab"
  else
    fallas+=("$a")
  fi
done
echo
[ ${#fallas[@]} -gt 0 ] && echo "Fallaron: ${fallas[*]}" || echo "Listo. Los AAB para Play Console están en dist/aab/"
