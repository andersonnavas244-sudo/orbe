# Juegos de Colombia

Tejo, billar, parqués y dominó en 3D, contra la máquina o con amigos en el mismo celular, y sin internet.
En esta app no aparece el globo terráqueo: el nombre visible es «Juegos de Colombia».

- Paquete: `com.orbejuegos.app` · versión 1.1 (código 2) · Android 8.0 o superior · solo vertical, pantalla completa inmersiva
- APK de prueba: `dist/JuegosDeColombia-1.1.apk` (se genera con `bash tools-diseno/compilar-todas.sh OrbeJuegos`)

## Juegos

- **Tejo 3D:** cancha de greda, bocín y mechas que explotan. Mano 1, mecha 3, embocinada 6 y moñona 9.
  Cada ronda cada uno lanza 2 tejos. Partidas a 9, 15 o 27 puntos, contra la máquina (fácil, normal o difícil) o 2 jugadores.
- **Billar 3D:** cuatro juegos en la misma mesa: **bola 8** y **bola 9** (pool con troneras), **carambola libre** y
  **tres bandas**. Efecto con el punto del taco, línea de ayuda, tres cámaras (mesa, arriba y taco) y El Profe como rival.
- **Parqués 3D:** de 2 a 4 jugadores (contra la máquina o varios en el mismo celular, el tablero gira hacia quien juega).
  Reglas del parqués colombiano (salen todas las fichas con pares, 3 intentos si están todas presas) o de parchís
  (sale una ficha con cada 5). Cada dado por separado, comer fuera de seguro (+20 casillas de premio), +10 al llegar al
  cielo, barreras de dos fichas (con pares hay que abrirlas), tres pares seguidos suben una ficha al cielo, cuenta exacta.
- **Dominó 3D:** doble seis. 1 contra 1 (con pozo para robar), parejas 2 contra 2 o todos contra todos (sin pozo).
  Sale el doble más alto en la primera mano y después quien ganó; dominó o tranca (gana quien sume menos);
  el ganador suma las fichas de los rivales; partidas a 50 o 100.
- En parqués y dominó: rivales con avatar ilustrado (emoji) y nombre, frases rápidas y emojis en globitos,
  reloj de turno (20 s; si se acaba, la máquina juega por ti) y una ayuda corta la primera vez.

## Cómo está hecho

| Parte | Archivo |
|---|---|
| Menú, opciones, pausa, final, ajustes y Premium | `app/src/main/assets/www/js/app.js`, `css/juegos.css` |
| Motor común (three.js, sonido sintetizado, partículas, entrada táctil) | `www/js/comun.js`, `www/lib/three.min.js` |
| Tejo | `www/js/tejo.js` |
| Billar (física propia de bolas, bandas y troneras) | `www/js/billar.js` |
| Parqués: tablero y animaciones 3D / reglas, máquina e interfaz | `www/js/parques3d.js` / `www/js/parques.js` |
| Dominó: mesa y fichas 3D / reglas, máquina e interfaz | `www/js/domino3d.js` / `www/js/domino.js` |
| Avatares, globitos, frases rápidas y emojis | `www/js/charla.js` |
| Miniaturas del menú (capturas reales, 600x600) | `www/img/{tejo,billar,parques,domino}.jpg` (`play-store/capturas_juegos.js`) |
| WebView, pantalla completa y puente `AndroidJuegos` | `MainActivity.java` |
| Anuncios (solo intersticial entre partidas, sin banner) y Premium | `AdsManager.java`, `AdsConfig.java`, `BillingManager.java`, `Prefs.java` |
| Icono (tejo dorado con la mecha explotando y bola de billar) | `tools/hacer_icono.py` |

Puente nativo `window.AndroidJuegos`: `adBreak()`, `share(texto)`, `openUrl(url)`, `buyPremium()`,
`manageSubscription()`, `isPremium()` y `vibrate(ms)`. Android llama a `onNativePremium(bool, precio)`,
`orbeToast(msg)` y, con el botón atrás, `orbeBack()` (si devuelve `true` la app no se cierra).

Para probar en el computador: abre `app/src/main/assets/www/index.html` en Chrome. Parámetros:

- `?juego=tejo&modo=ia|2j&dif=0..2&meta=N`
- `?juego=billar&modo=bola8|bola9|libre|tres&rival=ia|2j&dif=0..2&meta=N`
- `?juego=parques&modo=ia|local|demo&n=2..4&dif=0..2&reglas=colombiano|parchis` (`demo`: solo máquinas)
- `?juego=domino&modo=1v1|parejas|todos&dif=0..2&meta=50|100` (con `&demo=1` también juega la máquina por ti)

Con `captura=1`, `OJ.avanzar(seg)` adelanta el juego sin reloj y `OJ.mudo = true` apaga el sonido.
Ganchos de prueba: tejo `OJ.juego.probar(lx, ly)`, billar `OJ.juego.probar(ang, fuerza, lado, alto)`,
parqués `OJ.juego.forzar = [[a, b]]`, `tirar()`, `tocarFicha(f)`, `elegir(k)`, `poner(j, f, casilla)`,
dominó `OJ.juego.tocarFicha(i)`, `tocarLado('izq'|'der')`, `robar()`, `pasar()`. Todas las esperas van por `update(dt)`.

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
