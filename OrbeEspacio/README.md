# Orbe Espacio

La Estación Espacial Internacional y más de 14.000 satélites en vivo sobre un globo 3D Ultra HD, con
aviso "la Estación pasa sobre tu ciudad en 10 minutos", próximos lanzamientos y astronautas en órbita.

- Paquete: `com.orbeespacio.app` · versión 1.0 (código 1) · Android 8.0 o superior
- APK de prueba: `dist/OrbeEspacio-1.0.apk`

## Cómo funciona

| Parte | Archivo |
|---|---|
| Globo, satélites, pestañas | `app/src/main/assets/www/js/espacio.js` |
| Órbitas SGP4 en segundo plano (Web Worker) | `app/src/main/assets/www/js/orbitas-worker.js` + `lib/satellite.min.js` (satellite.js 6.0.2, MIT) |
| Iconos vectoriales | `app/src/main/assets/www/js/iconos.js` |
| Diseño (Space Grotesk, Inter, JetBrains Mono) | `app/src/main/assets/www/css/espacio.css` |
| Catálogo incluido (funciona sin internet) | `app/src/main/assets/www/data/sats.json` ← `node tools/build-sats.js` |
| Descargas con caché (12 h el catálogo) | `Net.java` |
| Avisos de pasos y lanzamientos (AlarmManager) | `Reminders.java`, `BootReceiver.java` |
| Anuncios y Premium | `AdsConfig.java`, `AdsManager.java`, `BillingManager.java` |

- **Órbitas:** CelesTrak (grupo `active` + `stations`). La app los descarga como mucho cada 12 h (2 h la
  Estación). Si no hay internet usa la copia incluida.
- **Pasos visibles:** se calculan en el teléfono para los próximos 10 días (y hasta 30 si no hay ninguno
  visible): cielo oscuro donde estás (Sol a más de 6° bajo el horizonte) y la Estación iluminada por el Sol.
- **Lanzamientos y astronautas:** Launch Library 2 (The Space Devs), con caché de 30 min y 6 h.

## Importante antes de publicar

1. **Copia del catálogo en GitHub Pages.** CelesTrak limita las descargas por dirección IP y las operadoras
   móviles comparten una misma IP entre muchas personas. Activa el workflow `actualizar-listas.yml`
   (ver README principal) y pon la dirección en `MIRROR` de `js/espacio.js`:
   `https://andersonnavas244-sudo.github.io/orbe/espacio/sats.json`
2. **AdMob:** cambia los IDs de prueba en `AdsConfig.java` y `res/values/strings.xml`.
3. **Premium:** crea la suscripción `premium_mensual` (9.000 COP/mes) en Play Console.
4. **Firma:** configura tu propia clave en `app/build.gradle` (no la subas al repositorio).

## Compilar

```bash
./gradlew assembleRelease
```

## Créditos

Texturas de la Tierra: Solar System Scope (CC BY 4.0) y NASA. Banderas: Twemoji (CC BY 4.0).
Datos: CelesTrak, The Space Devs (Launch Library 2), © OpenStreetMap Nominatim (buscador de ciudades).
