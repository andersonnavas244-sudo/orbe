# Juegos de Colombia

Tejo 3D y Billar 3D (carambola libre y a tres bandas), para 1 o 2 jugadores en el mismo celular y sin internet.
En esta app no aparece el globo terráqueo: el nombre visible es «Juegos de Colombia».

- Paquete: `com.orbejuegos.app` · versión 1.0 (código 1) · Android 8.0 o superior · solo vertical
- APK de prueba: `dist/JuegosDeColombia-1.0.apk` (se genera con `bash tools-diseno/compilar-todas.sh OrbeJuegos`)

## Juegos

- **Tejo 3D:** cancha de greda inclinada, bocín y mechas que explotan. Mano 1, mecha 3, embocinada 6 y moñona 9.
  Cada ronda cada uno lanza 2 tejos. Partidas a 9, 15 o 27 puntos, contra la máquina (fácil, normal o difícil) o 2 jugadores.
- **Billar 3D:** carambola en mesa sin troneras. Libre (tocar las otras dos bolas) o tres bandas (además 3 bandas antes
  de la segunda bola). Efecto con el punto del taco, línea de ayuda, tres cámaras (mesa, arriba y taco) y El Profe
  como rival de la máquina. Partidas a 5, 10 o 20.

## Cómo está hecho

| Parte | Archivo |
|---|---|
| Menú, opciones, pausa, final, ajustes y Premium | `app/src/main/assets/www/js/app.js`, `css/juegos.css` |
| Motor común (three.js, sonido sintetizado, partículas, entrada táctil) | `www/js/comun.js`, `www/lib/three.min.js` |
| Tejo | `www/js/tejo.js` |
| Billar (física propia de bolas y bandas) | `www/js/billar.js` |
| Miniaturas del menú (recortes de capturas reales) | `www/img/tejo.jpg`, `www/img/billar.jpg` (`play-store/capturas_juegos.js`) |
| WebView y puente `AndroidJuegos` | `MainActivity.java` |
| Anuncios (solo intersticial entre partidas, sin banner) y Premium | `AdsManager.java`, `AdsConfig.java`, `BillingManager.java`, `Prefs.java` |
| Icono (tejo dorado con la mecha explotando y bola de billar) | `tools/hacer_icono.py` |

Puente nativo `window.AndroidJuegos`: `adBreak()`, `share(texto)`, `openUrl(url)`, `buyPremium()`,
`manageSubscription()`, `isPremium()` y `vibrate(ms)`. Android llama a `onNativePremium(bool, precio)`,
`orbeToast(msg)` y, con el botón atrás, `orbeBack()` (si devuelve `true` la app no se cierra).

Para probar en el computador: abre `app/src/main/assets/www/index.html` en Chrome. Parámetros:
`?juego=tejo&modo=ia|2j&dif=0..2&meta=N` o `?juego=billar&modo=libre|tres&rival=ia|2j&dif=0..2&meta=N`.
Con `captura=1`, `OJ.avanzar(seg)` adelanta el juego y `OJ.juego.probar(...)` lanza o taca (ver `play-store/capturas_juegos.js`).

```bash
python OrbeJuegos/tools/hacer_icono.py
node play-store/capturas_juegos.js <carpeta node_modules con puppeteer-core>
python play-store/generar_juegos.py
```

## Antes de publicar

1. **AdMob:** cambia el ID de prueba del intersticial en `AdsConfig.java` y el de la app en `res/values/strings.xml`.
2. **Premium:** crea la suscripción `premium_mensual` (9.000 COP/mes) en Play Console.
3. **Firma:** configura tu propia clave en `app/build.gradle` (no la subas al repositorio).
4. **Ficha:** textos en `play-store/juegos/ficha.md`; política en `politicas/privacidad-orbe-juegos.md`.

## Créditos

Gráficos 3D con three.js (licencia MIT). Texturas, sonidos e icono hechos por código para la app.
Fuentes Baloo 2 y Nunito (SIL Open Font License).
