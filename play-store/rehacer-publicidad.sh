#!/usr/bin/env bash
# Rehace las capturas y las imágenes de Play Store de las apps Orbe con la interfaz actual.
#   bash play-store/rehacer-publicidad.sh <node_modules con puppeteer-core>
# Requiere el servidor de vista previa "orbe-raiz" (puerto 5170, sirve todo el repositorio).
set -u
cd "$(dirname "$0")/.."
NM="$1"
B="http://localhost:5170"
Q="calidad=fija"
echo "== Mapa del clima reciente (para las capturas de Orbe Clima)"
node OrbeClima/tools/build-grid.js && cp OrbeClima/tools/cache/grid.json OrbeClima/app/src/main/assets/www/data/grid-prueba.json
echo "== Capturas"
node play-store/capturas.js "$NM" "$B/RadioOrbe/app/src/main/assets/www/index.html?$Q" "$B/OrbeTV/app/src/main/assets/www/index.html?$Q" 2>&1 | grep -v "^    at "
node play-store/capturas_sismos.js "$NM" "$B/OrbeSismos/app/src/main/assets/www/index.html?$Q" 2>&1 | grep -v "^    at "
node play-store/capturas_espacio.js "$NM" "$B/OrbeEspacio/app/src/main/assets/www/index.html?$Q" 2>&1 | grep -v "^    at "
node play-store/capturas_clima.js "$NM" "$B/OrbeClima/app/src/main/assets/www/index.html?mirror=data/grid-prueba.json&$Q" 2>&1 | grep -v "^    at "
rm -f OrbeClima/app/src/main/assets/www/data/grid-prueba.json
echo "== Imágenes de tienda y redes"
cd play-store
python generar_publicidad.py
python generar_sismos.py
python generar_espacio.py store
python generar_clima.py store
echo "== listo"
