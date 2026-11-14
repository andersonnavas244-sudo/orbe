# Orbe Podcasts

Los podcasts más escuchados de 63 países sobre un globo 3D Ultra HD, con reproductor completo.

- Paquete: `com.orbepodcasts.app` · versión 1.0 (código 1) · Android 8.0 o superior
- APK de prueba: `dist/OrbePodcasts-1.0.apk`

## Cómo funciona

| Parte | Archivo |
|---|---|
| Globo, géneros, Explorar, Biblioteca, Buscar, reproductor | `app/src/main/assets/www/js/podcasts.js` |
| Iconos y géneros | `app/src/main/assets/www/js/iconos.js` |
| Diseño | `app/src/main/assets/www/css/podcasts.css` + `uhd.css` |
| Tierra Ultra HD (compartido con las otras apps) | `app/src/main/assets/www/js/tierra-hd.js` |
| Catálogo incluido (1.972 podcasts) | `www/data/catalogo.json` ← `node tools/build-catalog.js` |
| Reproductor en segundo plano, Android Auto | `PlaybackService.java` (Media3 / ExoPlayer) |
| Dónde quedó cada episodio, biblioteca | `StationStore.java` |
| Chromecast | `CastHelper.java` |
| Puente con la interfaz | `MainActivity.java` (`window.AndroidPod`) |

- **Datos:** listas oficiales de Apple Podcasts por país (en vivo, caché 12 h), episodios y búsqueda con la
  iTunes Search API (caché 1 h). El audio se reproduce directamente desde el servidor de cada podcast.
- **Reproductor:** retoma cada episodio donde quedó, velocidad 0,8×–2×, −15/+30 s, temporizador (también
  "al terminar el episodio"), controles en la pantalla bloqueada y en los audífonos, Chromecast y Android Auto.
- **Anuncios:** banner + máx. 2 intersticiales cada 40 min (al empezar un episodio nuevo y tras 20 min
  escuchando; el episodio sigue exactamente donde iba).

## Antes de publicar

1. **AdMob:** cambia los IDs de prueba en `AdsConfig.java` y `res/values/strings.xml`.
2. **Premium:** crea la suscripción `premium_mensual` (9.000 COP/mes) en Play Console.
3. **Firma:** configura tu propia clave en `app/build.gradle` (no la subas al repositorio).
4. Renueva el catálogo incluido de vez en cuando: `node OrbePodcasts/tools/build-catalog.js`.
