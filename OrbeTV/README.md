# Orbe TV (Android, teléfono y TV)

Canales de televisión **gratuitos** de todo el mundo sobre un globo terráqueo 3D, filtrables por
categoría, país y búsqueda. Hermana de Orbe Radio: mismo globo 8K, mismo diseño, anuncios,
suscripción Premium y versión para Android TV / Google TV.

## Funciones

- **Globo 3D Ultra HD** (8K cuando la GPU lo soporta), día y noche en tiempo real, nubes, fronteras.
- **Cada canal es un punto de color por categoría**: Noticias, Deportes, Música, Películas, Series,
  Infantiles, Documentales, Religiosos, Entretenimiento, Generalistas.
- Toca un canal → **video a pantalla completa** (ExoPlayer: HLS, DASH y transmisiones directas).
- **Zapping**: ▲/▼ o CH+/CH− en el control remoto; en el celular, deslizar arriba/abajo.
- Si una señal falla prueba las alternativas del canal; si el canal está caído salta al siguiente.
- **Imagen en imagen** en el celular al salir con el botón de inicio.
- **Chromecast** (receptor estándar de Google), **compartir por WhatsApp**, favoritos, recientes,
  canal aleatorio, hora local de cada canal.
- **Android TV / Google TV** con control remoto (mismo APK, banner propio, sin anuncios en la TV).
- **Anuncios AdMob** (banner + intersticial al abrir un canal, mínimo 30 s entre uno y otro) y
  **Premium mensual** (9.000 COP/mes) que los quita. IDs en `AdsConfig.java` (ahora son de prueba).

## Catálogo de canales

```bash
node tools/build-catalog.js
```

- Fuentes abiertas: [iptv-org](https://github.com/iptv-org/iptv) (canales, señales y logos) y
  [Free-TV/IPTV](https://github.com/Free-TV/IPTV) (canales gratuitos en abierto).
- Se quitan canales para adultos, cerrados y los de la *blocklist* de iptv-org (canales que pidieron
  ser retirados). Se unen duplicados.
- **Se prueba cada señal**. Quedan los que responden y los que el servidor niega desde aquí
  (403/451, normalmente bloqueo por país), marcados con 🔒 en la app.
- Conviene volver a generarlo cada semana: las señales de TV cambian a menudo.
- La app **no aloja ni retransmite video**: cada canal se reproduce desde la señal pública de su emisor.

## Lista que se actualiza sola

La app descarga la lista nueva en segundo plano (como máximo cada 12 h) y la usa desde la
siguiente vez que se abre; si no hay internet o la lista llega dañada, sigue con la incluida en el APK.

1. Sube este proyecto a un repositorio de GitHub (puede ser privado el código; la página es pública).
2. En el repositorio: **Settings → Pages → Source: GitHub Actions**.
3. Pestaña **Actions → “Actualizar canales” → Run workflow** (después corre sola cada lunes).
4. Pon la dirección en `CatalogUpdater.java`: `CATALOG_URL = "https://andersonnavas244-sudo.github.io/TU-REPO/stations.json"`
   y publica esa versión de la app. Desde ahí, los canales se actualizan sin publicar más versiones.

Nota: GitHub prueba las señales desde servidores en EE. UU.; los canales que solo se ven en su país
quedan con 🔒 en vez de descartarse. `tools/anchors.json` sirve para ubicar los canales en el mapa.

## Canales que fallan en tu equipo

Si ninguna señal de un canal abre, se marca con ⚠️ y pasa al final de las listas (también en el zapping
y en “canal aleatorio”). Se perdona a los 3 días o en cuanto vuelve a abrir.

## Canal de inicio

Menú ⋯ de un canal → **Usar como canal de inicio**. Al abrir la app empieza directo en ese canal (sin
anuncio) y ▲ ▼ recorre tus favoritos, como un televisor normal. Se quita en Capas y ajustes.

## Aviso legal (importante para Google Play)

Que un canal se vea gratis en internet no siempre significa que se pueda incluir en una app con
anuncios. Antes de publicar, revisa la lista y quita los canales dudosos (por ejemplo, canales de
pago que aparezcan por error). Google Play retira las apps de TV que muestran contenido sin
autorización. La suscripción Premium cobra por funciones de la app (sin anuncios), no por los canales.

## Compilar

```bash
./gradlew assembleDebug        # APK en app/build/outputs/apk/debug/
```

Requiere JDK 17 y el SDK de Android (o Android Studio). Banner de TV: `python tools/make-tv-banner.py`.

## Probar en el navegador

Sirve `app/src/main/assets/www` con un servidor estático y ábrelo; `?tv=1` simula el modo TV.
En el navegador muchos canales no abren por restricciones del propio navegador (CORS / http);
en la app de Android sí.
