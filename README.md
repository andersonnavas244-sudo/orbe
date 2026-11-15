# Orbe — apps con un globo terráqueo 3D

Apps Android (teléfono, tableta y Android TV) con un globo terráqueo 3D:

| Carpeta | App | Qué es |
|---|---|---|
| [`RadioOrbe/`](RadioOrbe/README.md) | **Orbe Radio** | +52.000 emisoras de radio de 223 países |
| [`OrbeTV/`](OrbeTV/README.md) | **Orbe TV** | ~8.700 canales de TV gratuitos de 177 países |
| [`OrbeSismos/`](OrbeSismos/README.md) | **Orbe Sismos** | Sismos, tsunamis y volcanes en vivo con alarmas |
| [`OrbeEspacio/`](OrbeEspacio/README.md) | **Orbe Espacio** | La Estación Espacial y +14.000 satélites en vivo, pasos, lanzamientos |
| [`OrbeClima/`](OrbeClima/README.md) | **Orbe Clima** | Viento, lluvia, humedad y huracanes en 3D, pronóstico y alertas |
| [`OrbePodcasts/`](OrbePodcasts/README.md) | **Orbe Podcasts** | Los podcasts más escuchados de 63 países, con reproductor completo |
| [`OrbeBiblia/`](OrbeBiblia/README.md) | **Orbe Biblia** | La Biblia completa sin internet, versículo del día y Jesús sosteniendo el mundo en 3D |
| [`politicas/`](politicas/) | Políticas de privacidad | Enlaces que pide Google Play |
| [`play-store/`](play-store/) | Fichas de Play Store | Textos, iconos, imágenes destacadas, banners de TV y capturas |

## Listas que se actualizan solas

La tarea [`.github/workflows/actualizar-listas.yml`](.github/workflows/actualizar-listas.yml) publica en
GitHub Pages las listas que descargan las apps:

- `https://andersonnavas244-sudo.github.io/orbe/radio/stations.json` (cada lunes)
- `https://andersonnavas244-sudo.github.io/orbe/tv/stations.json` (cada lunes)
- `https://andersonnavas244-sudo.github.io/orbe/espacio/sats.json` (todos los días)
- `https://andersonnavas244-sudo.github.io/orbe/clima/grid.json` (cada 6 horas)

Pon cada dirección en `CatalogUpdater.CATALOG_URL` (Radio y TV), en `MIRROR` de `js/espacio.js`
(Espacio) o en `ClimaConfig.MIRROR_URL` (Clima) y publica esa versión: desde entonces las apps descargan la lista nueva sin publicar más versiones.

## Políticas de privacidad (para Google Play)

- Orbe Radio: `https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-radio.md`
- Orbe TV: `https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-tv.md`
- Orbe Sismos: `https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-sismos.md`
- Orbe Espacio: `https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-espacio.md`
- Orbe Clima: `https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-clima.md`
- Orbe Podcasts: `https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-podcasts.md`
- Orbe Biblia: `https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-biblia.md`

Correo de contacto de las apps: lauandertechnologies@gmail.com

## Fuentes de datos del clima

- **Orbe Clima** usa solo fuentes gratuitas que permiten uso comercial: MET Norway (pronóstico y alertas,
  CC BY 4.0), NOAA GFS vía el ERDDAP de PacIOOS (mapa mundial, dominio público), OpenStreetMap Nominatim
  (buscador de ciudades) y GDACS (ciclones). No hay que contratar nada.
- **Orbe Espacio** busca ciudades con OpenStreetMap Nominatim.
- **Orbe Sismos** usa MET Norway para el pronóstico y las alertas de lluvias fuertes.

Ninguna app usa Open-Meteo (su plan gratuito no permite apps con anuncios o Premium).

## Tierra Ultra HD (motor 3D compartido)

`tools-diseno/tierra-hd/` contiene el motor 3D de la Tierra (relieve, reflejo del mar, atardecer, atmósfera,
nubes iluminadas y regulador de rendimiento) y la hoja de estilos Ultra HD. Para cambiarlo en todas las
apps a la vez: edita `tierra-hd.js` o `uhd.css` y ejecuta `python tools-diseno/tierra-hd/instalar.py`.
Para compilar todos los APK: `bash tools-diseno/compilar-todas.sh`.
