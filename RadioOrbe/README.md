# Orbe Radio (Android)

Radio mundial sobre un globo terráqueo 3D: **52.406 emisoras activas de 223 países**
(catálogo completo de [Radio Browser](https://www.radio-browser.info), noviembre 2026),
filtrables por género, país y búsqueda libre.

## Funciones

- **Globo 3D Ultra HD**: mapa en **8K (8192×4096)** cuando la GPU del teléfono lo soporta
  (si no, 4K), antialiasing, filtrado anisotrópico, relieve, brillo del sol en los océanos,
  nubes animadas, atmósfera y fronteras. Modos *Satélite / Noche* y calidad *Ultra / Full HD / Ahorro*
  (Ultra usa la densidad de píxeles completa de la pantalla).
- **Cada emisora es un punto de color según su género** (15 géneros + “Otras”).
- Toca un punto → suena. Toca un país o una zona → lista de emisoras cercanas y de todo el país.
- **Géneros**: Pop, Rock, Electrónica, Latina, Hip-Hop/R&B, Jazz/Blues, Clásica, Noticias,
  Deportes, Religiosa, Metal, Country/Folk, Chill/Lounge, Clásicos/Retro, Mundo/Étnica.
- **Búsqueda** por nombre, ciudad, género, idioma o país (resalta los resultados en el globo).
- Lista de **países** con número de emisoras, **favoritos**, **recientes** y **emisora aleatoria**.
- **Reproducción nativa en segundo plano** con ExoPlayer/Media3 (MP3, AAC, OGG, HLS), notificación y
  controles en la pantalla de bloqueo; pausa automática al desconectar audífonos o en llamadas.
- **Canción en vivo**: título y artista que envía la emisora (metadatos ICY/HLS), en la app, la notificación y el widget.
- **Día y noche en tiempo real** sobre el globo (posición real del sol) y **hora local** de cada emisora (☀️/🌙).
- **Temporizador para dormir** (15–90 min, con bajada suave de volumen) y **alarma diaria con radio**
  (sube el volumen poco a poco; se reprograma tras reiniciar el teléfono).
- **Widget** para la pantalla de inicio: última emisora, canción y botón de reproducir/pausar.
- **Compartir por WhatsApp** (o cualquier app) con enlace a la emisora.
- **Chromecast / Google TV** (receptor estándar de Google) y **Android Auto** (Favoritos, Recientes, Top mundial).

## Android TV / Google TV

El mismo APK se instala en televisores con Android TV o Google TV (aparece con su banner en el menú).
- **Control remoto**: flechas para moverse por botones, géneros y listas; **OK** para elegir.
- **🌍 Explorar el globo**: flechas giran el planeta, una mira marca el centro y dice el país y cuántas
  emisoras hay; **OK** acerca y lista las emisoras de ese punto; **Atrás** vuelve al menú.
- **Atrás** en el menú principal sale de la app (requisito de Google para TV).
- En la TV no hay anuncios (AdMob no admite televisores), ni WhatsApp, Chromecast ni alarma; calidad Full HD por defecto.
- En Play Console activa *Configuración avanzada → Factores de forma → Android TV*; Google revisa la app antes de mostrarla en TV.
- Banner: `tools/make-tv-banner.py` lo genera con la Tierra real y las emisoras del catálogo.
- Probar en el navegador: abre `index.html?tv=1` y usa las flechas y Enter del teclado.

## Premium (suscripción mensual)

Suscripción **“Premium sin anuncios”** de **9.000 COP al mes** con Google Play Billing:
quita el banner y los anuncios de pantalla completa; si se cancela o vence, vuelven los anuncios.
Para activarla, en Play Console → *Monetizar → Suscripciones* crea la suscripción con id
`premium_mensual` y un plan base mensual de 9.000 COP (Play convierte el precio en otros países).
El id está en `AdsConfig.java`. La compra solo funciona con la app instalada desde Google Play
(o en prueba interna con cuentas de prueba).

## Anuncios (AdMob)

- **Banner pequeño** fijo en la parte inferior.
- **Anuncio a pantalla completa** al elegir una emisora; la radio empieza al cerrarlo.
  Mínimo 30 s entre uno y otro (configurable en `AdsConfig.java`, `0` = siempre).
- Formulario de **consentimiento** (UMP) para usuarios de la UE/Reino Unido.

Ahora usa los **IDs de prueba de Google** (anuncios de ejemplo, no pagan). Para cobrar:
crea la app en [AdMob](https://admob.google.com), pega tus IDs en
`app/src/main/java/com/orberadio/app/AdsConfig.java` y el ID de app en
`app/src/main/res/values/strings.xml` (`admob_app_id`). Los anuncios solo existen en el APK,
no en la versión de navegador.

## Estructura

```
app/src/main/assets/www/      Interfaz (HTML/CSS/JS) + globo (globe.gl) + texturas + catálogo
  data/stations.json          Catálogo compacto de emisoras (se regenera con tools/)
app/src/main/java/.../        MainActivity (WebView + puente JS), PlaybackService (ExoPlayer + Android Auto),
                              RadioWidget, AlarmReceiver, CastHelper, BillingManager, AdsManager
tools/build-catalog.js        Descarga y regenera el catálogo desde Radio Browser
```

## Compilar

Requisitos: JDK 17 y el SDK de Android (o simplemente Android Studio).

```bash
./gradlew assembleDebug        # APK en app/build/outputs/apk/debug/
```

O abre la carpeta `RadioOrbe` con Android Studio y pulsa ▶.

## Actualizar el catálogo de emisoras

```bash
node tools/build-catalog.js
npm i --no-save countries-and-timezones && node tools/build-timezones.js   # zonas horarias
```

## Probar Android Auto y Chromecast

- **Android Auto**: con un APK instalado fuera de Play, activa en Android Auto → Ajustes → (toca 10 veces
  la versión) → Desarrollador → *Fuentes desconocidas*. Publicada en Play, Google la revisa antes.
- **Chromecast**: el teléfono y la TV en la misma Wi-Fi; menú ⋯ del reproductor → *Ver en TV*.
  Algunas emisoras que transmiten solo por `http://` pueden no sonar en la TV.

Créditos de texturas: NASA Blue Marble/Black Marble; versión 8K de
[Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0).

Las emisoras sin coordenadas en Radio Browser (~77 %) se ubican de forma aproximada dentro
de su país y la app lo indica con “ubic. aprox.”.

## Probar en el navegador

Sirve la carpeta `app/src/main/assets/www` con cualquier servidor estático
(p. ej. `npx http-server app/src/main/assets/www`) y ábrela en Chrome.
