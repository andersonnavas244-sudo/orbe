# Orbe Sismos (Android)

Sismos, tsunamis y volcanes **en vivo** sobre un globo 3D, con alarma si tiembla cerca.

## Datos reales (en vivo)

| Qué | Fuente | Frecuencia |
|---|---|---|
| Sismos | USGS (EE. UU.) + EMSC (Europa), sin duplicados | cada minuto |
| Tsunami | Boletines NOAA: Centro del Pacífico (PTWC) y Centro Nacional de EE. UU. (NTWC) | cada 5 min |
| Volcanes activos | Reporte semanal Smithsonian / USGS | al abrir |
| Noticias | Google Noticias en español | al abrir |
| Lluvias fuertes | MET Norway Locationforecast 2.0 (gratis, uso comercial permitido, CC BY 4.0) | al abrir y cada 3 h para alertas |
| ¿Lo sentiste? | USGS "Did You Feel It?" y EMSC | al abrir un sismo |
| Estadísticas por país | USGS (M2.5+, este año) | al abrir |
| Volcanes (1.214), históricos, radios, ciudades y números | incluidos en la app (`node tools/build-data.js`) | — |

## Funciones

- **Mapa:** última hora, 24 h, 7 y 30 días; ondas que laten en los sismos recientes; volcanes.
- **Sismos:** recientes, más fuertes, tu zona, históricos (desde 1900) y volcanes con actividad.
- **Alarmas:** sismo cercano (magnitud y distancia a elegir), tsunami, sismos M7+ en el mundo.
  Vigilancia en tiempo real (servicio cada minuto) + revisión de respaldo cada 15 min (WorkManager).
- **Seguridad:** Estoy bien (WhatsApp con ubicación), SOS (sirena + linterna SOS), números de emergencia,
  tsunami, guía antes/durante/después, simulacro, plan familiar y alerta temprana de Android.
- **Prepárate** (`js/guias.js`): test "¿Qué tan preparado estás?" (0–100, se comparte por WhatsApp),
  mochila con fechas de vencimiento (avisa 2 semanas antes, `KitReminders.java`), revisión de la casa y
  recordatorio cada 6 meses.
- **Guías sin internet:** según dónde estés, agua segura, alimentos, primeros auxilios, revisar la casa
  después, si quedas atrapado, niños/mayores/bebés/mascotas, mitos y verdades, y otras emergencias
  (deslizamientos, inundaciones, ceniza, incendios, huracanes, tormentas eléctricas).
- **Modo apagón:** linterna fija, brújula, SMS listos para enviar sin internet y pantalla negra sin globo.
- **Noticias** y **radios de noticias** por país. **Widget** con el último sismo cercano.
- **Hasta 3 lugares vigilados** (casa, trabajo, familia) con alarmas para todos.
- **Alarma en voz alta:** "Sismo de magnitud 5 punto 2 a 120 kilómetros de Bogotá".
- **Lluvias muy fuertes** para tus lugares (avisos cada 3 h).
- **¿Lo sentiste?:** reportes y mapa de intensidad oficiales (USGS) y botón para reportar.
- **Estadísticas por país:** sismos del año mes a mes, por magnitud y los más fuertes.
- **Compartir la tarjeta del sismo como imagen** (mapa con el epicentro) por WhatsApp y redes.
- Anuncios (nunca en alarmas ni en Seguridad) y Premium sin anuncios.

## Honestidad (importante para Google Play)

Ninguna app puede predecir sismos. Orbe Sismos avisa cuando los centros los publican (1–5 min después)
y difunde boletines oficiales de tsunami (que sí pueden llegar antes que las olas). Para avisos
**segundos antes** del temblor fuerte, la app guía a activar la alerta temprana de Android.

## Compilar

```bash
./gradlew assembleDebug
```
