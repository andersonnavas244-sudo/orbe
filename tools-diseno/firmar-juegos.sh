#!/usr/bin/env bash
# Firma «Juegos de Colombia» con tu llave propia y genera el AAB (para Play Store) y el APK firmados.
#
#   bash tools-diseno/firmar-juegos.sh
#
# 1. Si no existe la llave ~/orbe-firma/orbe-juegos.jks, la crea con keytool (keytool te pide la contraseña).
# 2. Te pide la contraseña (sin mostrarla) para escribir ~/orbe-firma/firma.properties, FUERA del repositorio.
# 3. Compila con Gradle (bundleRelease y assembleRelease) y copia el .aab y el .apk a OrbeJuegos/dist/.
# 4. Muestra la huella SHA-256 del certificado.
#
# La llave y la contraseña NUNCA van al repositorio. Si pierdes la llave o la contraseña, no podrás publicar
# actualizaciones de la app (a menos que uses la firma de apps de Google Play y pidas cambiar la llave de subida).
set -euo pipefail
cd "$(dirname "$0")/.."
REPO="$(pwd)"

JDK="${JDK17:-/c/Users/laura/.jdks/jdk-17.0.21+9}"
[ -x "$JDK/bin/keytool" ] || [ -x "$JDK/bin/keytool.exe" ] || { echo "No encontré el JDK 17 en $JDK (cámbialo con JDK17=/ruta)"; exit 1; }
export JAVA_HOME="$JDK"
export PATH="$JDK/bin:$PATH"

DIR="$HOME/orbe-firma"
LLAVE="$DIR/orbe-juegos.jks"
PROPS="$DIR/firma.properties"
ALIAS="orbejuegos"

mkdir -p "$DIR"
chmod 700 "$DIR" 2>/dev/null || true

echo "== Juegos de Colombia: firma para Google Play"
echo "   Carpeta de la llave (fuera del repositorio): $DIR"
echo

# (a) La llave: se crea una sola vez. keytool pide la contraseña y los datos.
if [ ! -f "$LLAVE" ]; then
  echo "No hay llave todavía. Vamos a crearla."
  echo "keytool te va a pedir una contraseña de al menos 6 caracteres (escríbela dos veces)"
  echo "y unos datos (nombre, empresa, ciudad, país: CO). Al final escribe «sí» para confirmar."
  echo
  keytool -genkeypair -v -keystore "$LLAVE" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000
  echo
  echo "Llave creada: $LLAVE"
  echo "*** IMPORTANTE: haz YA una copia de esta llave y anota la contraseña en un lugar seguro"
  echo "*** (USB, nube privada, gestor de contraseñas). Si se pierden, no podrás actualizar la app."
  echo
else
  echo "Llave encontrada: $LLAVE"
fi

# (b) firma.properties (fuera del repositorio): solo si no existe o si quieres cambiarlo.
escribir=1
if [ -f "$PROPS" ]; then
  read -r -p "Ya existe $PROPS. ¿Volver a escribirlo? (s/N) " r
  case "$r" in s|S|si|sí|SI) escribir=1 ;; *) escribir=0 ;; esac
fi
if [ "$escribir" = 1 ]; then
  read -r -s -p "Contraseña de la llave (no se muestra): " clave; echo
  # Comprueba que la contraseña abre la llave antes de guardarla
  if ! printf '%s\n' "$clave" | keytool -list -keystore "$LLAVE" -alias "$ALIAS" >/dev/null 2>&1; then
    echo "Esa contraseña no abre la llave. Vuelve a correr el script."; unset clave; exit 1
  fi
  ruta_llave="$(cygpath -m "$LLAVE" 2>/dev/null || echo "$LLAVE")"
  umask 077
  {
    echo "# Firma de Juegos de Colombia. NO subir a ningún repositorio. Guarda una copia de la llave."
    echo "storeFile=$ruta_llave"
    echo "storePassword=$clave"
    echo "keyAlias=$ALIAS"
    echo "keyPassword=$clave"
  } > "$PROPS"
  unset clave
  echo "Guardado: $PROPS (solo en este computador)"
fi
echo

# (c) Compilar el AAB y el APK firmados
v=$(grep -o "versionName '[^']*'" OrbeJuegos/app/build.gradle | cut -d"'" -f2)
aab="OrbeJuegos/app/build/outputs/bundle/release/app-release.aab"
apk="OrbeJuegos/app/build/outputs/apk/release/app-release.apk"
rm -f "$aab" "$apk"
echo "== Compilando la versión $v (tarda unos minutos)…"
( cd OrbeJuegos && ./gradlew bundleRelease assembleRelease --console=plain -q )
[ -f "$aab" ] && [ -f "$apk" ] || { echo "¡Falló la compilación!"; exit 1; }
mkdir -p OrbeJuegos/dist
cp "$aab" "OrbeJuegos/dist/JuegosDeColombia-$v.aab"
cp "$apk" "OrbeJuegos/dist/JuegosDeColombia-$v-firmada.apk"
echo
ls -la "OrbeJuegos/dist/JuegosDeColombia-$v.aab" "OrbeJuegos/dist/JuegosDeColombia-$v-firmada.apk"

# (d) Huella SHA-256 del certificado con que quedó firmado el AAB
echo
echo "== Huella del certificado (SHA-256):"
keytool -printcert -jarfile "OrbeJuegos/dist/JuegosDeColombia-$v.aab" | grep -E "Propietario|Owner|SHA256|SHA-256" || true
echo
echo "Listo. Sube $REPO/OrbeJuegos/dist/JuegosDeColombia-$v.aab en Play Console:"
echo "  Juegos de Colombia → Probar y publicar → Producción (o Prueba interna) → Crear versión → Subir."
