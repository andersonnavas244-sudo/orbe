# Orbe Biblia

La Santa Biblia completa (Reina-Valera 1909, dominio público) sin internet, con el versículo del día,
oraciones, planes de lectura y Jesús sosteniendo el mundo en 3D.

- Paquete: `com.orbebiblia.app` · versión 1.0 (código 1) · Android 8.0 o superior
- APK de prueba: `dist/OrbeBiblia-1.0.apk`

## Funciones

- **Hoy:** el «Salvator Mundi» de Leonardo da Vinci con la Tierra 3D girando en la mano de Jesús, el versículo
  del día (366 escogidos por tema), palabras para cada momento (8 temas, 206 versículos), oraciones de la Biblia
  (Padre Nuestro, Salmos 23, 91, 121 y 51, Bienaventuranzas, 1 Corintios 13, bendición de Números 6) y tu plan.
- **Biblia:** 66 libros, letra capital dorada, resaltados de 4 colores, favoritos, copiar, compartir como imagen,
  escuchar en voz alta (motor de voz del teléfono), tamaño de letra y temas Noche / Sepia / Claro.
- **Buscar:** cualquier palabra o frase en los 31.102 versículos (sin tildes ni mayúsculas).
- **Planes:** la Biblia en 1 año, el Nuevo Testamento en 90 días, y Salmos y Proverbios en 31 días.
- **Más:** favoritos, versículo del día por notificación a la hora elegida, velocidad de la voz, Premium.
- **Música para orar:** `www/audio/oracion.m4a`, compuesta con `play-store/videos/musica_oracion.py`.
- **Compartir:** imagen 1080×1920 para estados, con Jesús sosteniendo el planeta y el versículo.

## Cómo está hecho

| Parte | Archivo |
|---|---|
| Interfaz | `app/src/main/assets/www/js/biblia.js`, `css/biblia.css` |
| Texto bíblico (por libro), versículos del día y temas | `www/data/biblia/*.json`, `diario.json`, `temas.json` (`tools/build_biblia.py`) |
| Cuadro y posición del planeta | `www/img/salvator.jpg`, `www/data/cuadro.json` (`tools/hacer_cuadro.py`) |
| Versículo del día (notificación) | `DailyVerse.java` |
| Lectura en voz alta | `Speech.java` |
| Anuncios y Premium | `AdsManager.java`, `AdsConfig.java`, `BillingManager.java` |

Para regenerar los datos:

```bash
python OrbeBiblia/tools/build_biblia.py spaRV1909_vpl.txt
```

(descarga: <https://eBible.org/Scriptures/spaRV1909_vpl.zip>)

```bash
python OrbeBiblia/tools/hacer_cuadro.py salvator.jpg
```

(Wikimedia Commons, «Leonardo da Vinci, Salvator Mundi, c.1500, oil on walnut, 45.4 × 65.6 cm.jpg»)

## Antes de publicar

1. **AdMob:** cambia los IDs de prueba en `AdsConfig.java` y `res/values/strings.xml`.
2. **Premium:** crea la suscripción `premium_mensual` (9.000 COP/mes) en Play Console.
3. **Firma:** configura tu propia clave en `app/build.gradle` (no la subas al repositorio).

## Créditos

Texto: Santa Biblia Reina-Valera 1909 (dominio público, eBible.org), con las tildes actualizadas · Imagen:
«Salvator Mundi», atribuido a Leonardo da Vinci (c. 1500, dominio público) · Texturas de la Tierra: NASA ·
Música: original de la app.
