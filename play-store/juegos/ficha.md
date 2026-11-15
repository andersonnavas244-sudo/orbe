# Ficha de Google Play — Juegos de Colombia

## Nombre de la app (máx. 30 caracteres)

Juegos de Colombia: Tejo 3D

## Descripción breve (máx. 80 caracteres)

Tejo y billar colombianos en 3D. Revienta mechas y haz carambolas, sin internet.

## Descripción completa (máx. 4.000 caracteres)

🇨🇴 Los juegos de la tienda del barrio, ahora en tu celular: el tejo con sus mechas que explotan y el billar de carambola, en 3D y sin internet.

🎯 TEJO 3D
• Cancha de greda, bocín y mechas de verdad: lanza el tejo y escucha el ¡pum! cuando revienta la mecha.
• Arrastra el dedo hacia atrás para dar fuerza, apunta y suelta.
• Puntos como en la cancha:
  – Mano, 1 punto: si nadie revienta mecha ni emboca, gana el tejo que quedó más cerca del bocín.
  – Mecha, 3 puntos: revientas una mecha.
  – Embocinada, 6 puntos: el tejo queda dentro del bocín.
  – Moñona, 9 puntos: revientas la mecha y además quedas en el bocín.
• Cada ronda cada uno lanza 2 tejos. Partidas a 9 (rápida), 15 o 27 puntos (la tradicional).
• Chispas, humo, destello y vibración en cada mecha.

🎱 BILLAR 3D
• Carambola en mesa sin troneras, como en los billares de Colombia, con bola blanca, amarilla y roja.
• Carambola libre: tu bola debe tocar las otras dos.
• Tres bandas: además, tu bola debe tocar tres bandas antes de la segunda bola. ¡El clásico!
• Si haces carambola, sigues tacando.
• Efecto: escoge dónde le pega el taco a la bola. Arriba corre, abajo retrocede y a los lados cambia el rebote en las bandas.
• Línea de ayuda para apuntar y tres cámaras: mesa, desde arriba y detrás del taco.
• Juega contra El Profe, el rival de la máquina que sabe de bandas. Partidas a 5, 10 o 20 carambolas.

👥 1 O 2 JUGADORES
• Juega solo contra la máquina, en fácil, normal o difícil.
• O reta a un amigo en el mismo celular: se pasan el teléfono por turnos.

📶 SIN INTERNET
• Los dos juegos funcionan sin conexión, en cualquier parte.
• No necesitas cuenta ni registrarte.

🏆 MÁS
• Lleva la cuenta de tus partidas ganadas.
• Comparte el resultado con tus amigos por WhatsApp.
• Sonido y vibración que puedes apagar.

⭐ PREMIUM
• Suscripción mensual opcional para quitar todos los anuncios. Se cancela cuando quieras desde Google Play.

¡Mecha, moñona y carambola! Descarga Juegos de Colombia y juega tejo y billar donde estés.

## Categoría y etiquetas

- Categoría: **Juegos → Deportes** (o *Casual*)
- Etiquetas: tejo, billar, carambola, tres bandas, juegos colombianos, juego de mesa, 2 jugadores, sin internet

## Datos de contacto

- Correo: **lauandertechnologies@gmail.com**
- Política de privacidad: `https://github.com/andersonnavas244-sudo/orbe/blob/main/politicas/privacidad-orbe-juegos.md`

## Respuestas para los formularios de Play Console

- **Ubicación:** no se usa.
- **Notificaciones:** no hay.
- **Anuncios:** sí (AdMob): solo a pantalla completa entre partidas, como máximo 2 cada 40 minutos; sin banner y nunca mientras se juega.
- **Compras:** suscripción mensual `premium_mensual` (quita los anuncios).
- **Público objetivo:** 13 años o más.
- **Contenido:** sin violencia, sin apuestas con dinero real, sin contenido generado por usuarios ni chat.
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
