# Ficha de Google Play — Juegos de Colombia

## Nombre de la app (máx. 30 caracteres)

Juegos de Colombia: Tejo y más

## Descripción breve (máx. 80 caracteres)

Tejo, billar, parqués y dominó en 3D, con amigos o la máquina y sin internet.

## Descripción completa (máx. 4.000 caracteres)

🇨🇴 Los juegos de la tienda del barrio y de la casa de la abuela, ahora en tu celular: tejo, billar, parqués y dominó, en 3D y sin internet.

🎯 TEJO 3D
• Cancha de greda, bocín y mechas de verdad: lanza el tejo y escucha el ¡pum! cuando revienta la mecha.
• Arrastra el dedo hacia atrás para dar fuerza, apunta y suelta.
• Mano 1 punto, mecha 3, embocinada 6 y moñona 9, como en la cancha.
• Partidas a 9, 15 o 27 puntos.

🎱 BILLAR 3D
• Cuatro juegos en la misma mesa: pool bola 8, bola 9, carambola libre y tres bandas.
• Bola 8: mete tus lisas o tus rayadas y al final la negra. Bola 9: pégale siempre a la más baja y mete la 9.
• Carambola libre y tres bandas, como en los billares de Colombia.
• Efecto en la bola, línea de ayuda y tres cámaras: mesa, desde arriba y detrás del taco.
• Juega contra El Profe, el rival de la máquina.

🎲 PARQUÉS 3D
• De 2 a 4 jugadores: contra la máquina o con tus amigos en el mismo celular (el tablero gira hacia quien juega).
• Reglas del parqués colombiano (sales con pares) o de parchís (sales con un 5).
• Cómete las fichas rivales y gana 20 casillas de premio; mete una ficha al cielo y gana 10.
• Barreras, seguros, tres pares seguidos y cuenta exacta para llegar al cielo.

🔲 DOMINÓ 3D
• Doble seis, como se juega en Colombia: 1 contra 1 con pozo, parejas 2 contra 2 o todos contra todos.
• ¡Dominó! o tranca: gana la mano quien sume menos y se lleva los puntos de los rivales.
• Partidas a 50 o 100 puntos.

😄 CON AMBIENTE
• Rivales con su avatar y su nombre, frases rápidas («¡Buena!», «¡Paso!», «¡Dale!») y emojis.
• Reloj de turno para que nadie se demore.
• Juega solo contra la máquina, en fácil, normal o difícil, o con amigos en el mismo celular.

📶 SIN INTERNET
• Los cuatro juegos funcionan sin conexión, en cualquier parte.
• No necesitas cuenta ni registrarte.

🏆 MÁS
• Lleva la cuenta de tus partidas ganadas.
• Comparte el resultado con tus amigos por WhatsApp.
• Sonido y vibración que puedes apagar. Pantalla completa.

⭐ PREMIUM
• Suscripción mensual opcional para quitar todos los anuncios. Se cancela cuando quieras desde Google Play.

¡Mecha, carambola, parqués y dominó! Descarga Juegos de Colombia y juega donde estés.

## Categoría y etiquetas

- Categoría: **Juegos → Juegos de mesa** (o *Casual*)
- Etiquetas: tejo, billar, pool, carambola, parqués, parchís, dominó, juegos colombianos, juego de mesa, 2 a 4 jugadores, sin internet

## Datos de contacto

- Correo: **lauandertechnologies@gmail.com**
- Política de privacidad: `https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-juegos.md`

## Respuestas para los formularios de Play Console

- **Ubicación:** no se usa.
- **Notificaciones:** no hay.
- **Anuncios:** sí (AdMob): solo a pantalla completa entre partidas, como máximo 2 cada 40 minutos; sin banner y nunca mientras se juega.
- **Compras:** suscripción mensual `premium_mensual` (quita los anuncios).
- **Público objetivo:** 13 años o más.
- **Contenido:** sin violencia, sin apuestas con dinero real, sin contenido generado por usuarios ni chat entre personas (las frases rápidas y los emojis son fijos y solo se ven en el propio teléfono; los rivales son personajes de la máquina).
- **Seguridad de los datos:** la app no recoge datos personales; las partidas y ajustes se guardan solo en el teléfono. AdMob recoge el identificador de publicidad (ver política).

## Gráficos (en esta carpeta)

| Archivo | Dónde va en Play Console |
|---|---|
| `icono-512.png` | Icono de la app |
| `destacada-1024x500.png` | Gráfico de funciones (imagen destacada) |
| `publicidad/tienda-1..8.png` | Capturas de pantalla del teléfono (con marco y título) |
| `capturas/telefono-*.png` | Capturas sin marco (alternativa) |

Se regeneran con:

```bash
python OrbeJuegos/tools/hacer_icono.py
node play-store/capturas_juegos.js <carpeta node_modules con puppeteer-core>
python play-store/generar_juegos.py
```
