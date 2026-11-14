# Orbe Clima

Viento, lluvia, humedad, temperatura y huracanes del planeta moviéndose sobre un globo 3D Ultra HD, con
pronóstico de tus lugares y alertas.

- Paquete: `com.orbeclima.app` · versión 1.1 (código 2) · Android 8.0 o superior
- APK de prueba: `dist/OrbeClima-1.1.apk`

## Cómo funciona

| Parte | Archivo |
|---|---|
| Globo, capas, viento animado, pestañas | `app/src/main/assets/www/js/clima.js` |
| Iconos del tiempo con volumen | `app/src/main/assets/www/js/iconos.js` |
| Diseño (Space Grotesk, Inter, JetBrains Mono) | `app/src/main/assets/www/css/clima.css` |
| Fuentes de datos e identificación de la app | `ClimaConfig.java` |
| Alertas cada hora en segundo plano | `WeatherAlerts.java`, `AlertWorker.java`, `BootReceiver.java` |
| Descargas con caché | `Net.java` |
| Mapa mundial para GitHub Pages | `tools/build-grid.js` (lo corre el workflow cada 6 horas) |

## Fuentes de datos (todas gratuitas y con uso comercial permitido)

| Qué | Fuente | Licencia |
|---|---|---|
| Pronóstico de cada lugar (hora a hora y 10 días) y alertas | MET Norway Locationforecast 2.0 | CC BY 4.0 / NLOD |
| Mapa mundial de viento, lluvia, temperatura y humedad (48 h) | NOAA GFS vía el ERDDAP de PacIOOS | Dominio público |
| Buscador de ciudades | OpenStreetMap Nominatim (una búsqueda por toque) | ODbL |
| Huracanes y tifones | GDACS (Comisión Europea y ONU) | Uso libre con crédito |

- **Mapa del clima:** rejilla mundial de 6° para 48 horas (cada 3 h). La app descarga la copia de GitHub
  Pages (`ClimaConfig.MIRROR_URL`); si no está disponible, pide directo a NOAA una rejilla de 12°.
- **Capas:** viento, lluvia, humedad y temperatura se dibujan en la app sobre esferas transparentes; el
  viento son miles de partículas que siguen el campo interpolado. La capa *Humedad* reemplaza a la antigua
  capa de nubosidad (el GFS público no trae nubes); el globo sigue mostrando nubes reales de fondo.
- **Pronóstico:** MET Norway da el tiempo actual, 24 horas y 10 días. El amanecer, el atardecer y el UV con
  cielo despejado se calculan en el teléfono. Ya no hay índice de calidad del aire.
- **Huracanes:** GDACS (activos y temporada), con trayectoria, pronóstico y cono de incertidumbre.
- **Alertas:** lluvia ≥ 50 mm/24 h o ≥ 15 mm/h, tormentas eléctricas, ráfagas ≥ 70 km/h, ≥ 38 °C, ≤ −5 °C y
  ciclones a menos de 300/600/1.000 km de tus lugares. Cada alerta se avisa una sola vez.

MET Norway exige identificar la app en cada consulta (`ClimaConfig.USER_AGENT`) y usar caché: la app guarda
cada pronóstico 50 minutos y las búsquedas de ciudades un día.

## Importante antes de publicar

1. **Copia del mapa en GitHub Pages:** activa el workflow (ver el README principal). La dirección ya está en
   `ClimaConfig.MIRROR_URL`: `https://andersonnavas244-sudo.github.io/orbe/clima/grid.json`
2. **AdMob:** cambia los IDs de prueba en `AdsConfig.java` y `res/values/strings.xml`.
3. **Premium:** crea la suscripción `premium_mensual` (9.000 COP/mes) en Play Console.
4. **Firma:** configura tu propia clave en `app/build.gradle` (no la subas al repositorio).

## Créditos

Pronóstico: MET Norway (CC BY 4.0) · Mapa mundial: NOAA GFS vía PacIOOS · Buscador: © OpenStreetMap ·
Ciclones: GDACS (Comisión Europea y ONU) · Fronteras: Natural Earth · Texturas: Solar System Scope
(CC BY 4.0) y NASA · Banderas: Twemoji (CC BY 4.0).
