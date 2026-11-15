"""Imágenes publicitarias para Facebook e Instagram: 2 por app.

    python play-store/generar_facebook.py [sismos radio tv espacio clima podcasts]

En play-store/<app>/publicidad/:
  facebook-1.png   1080x1350 (4:5, la que más ocupa en el feed): frase gancho, celular en 3D y 3 beneficios
  facebook-2.png   1080x1080 (cuadrada): dos celulares en 3D, beneficios con ✓ y botón de descarga
Los textos para acompañar cada anuncio están en play-store/facebook-anuncios.md.
Usa los fondos que deja play-store/videos/hacer_videos.py (cache/<app>/fondo.png) y, para Orbe Sismos,
una toma real del globo 3D de la app (grabar_globo_sismos.js).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, 'videos'))
import hacer_videos as hv  # noqa: E402
from guiones import APPS  # noqa: E402

gg, gp = hv.gg, hv.gp
FB, FS = gp.FONT_B, gp.FONT_S
PINK = (255, 79, 163)

ADS = {
    'sismos': dict(
        a=dict(h='¿Y si tiembla esta noche?', s='Recibe una alarma si hay un sismo fuerte cerca de ti', shot='capturas/telefono-1-mapa.png',
               chips=['Alarma aunque la app esté cerrada', 'Avisa a tu familia que estás bien', 'Guías de emergencia sin internet']),
        b=dict(h='Un sismo no avisa. ¿Estás preparado?', shots=['capturas/telefono-5-alarmas.png', 'capturas-video/video-test.png'],
               checks=['Sismos de todo el mundo en vivo, en 3D', 'Alarma si tiembla fuerte cerca de ti', 'Test de preparación para tu familia'])),
    'radio': dict(
        a=dict(h='52.000 emisoras en un globo 3D', s='Gira el planeta y escucha la radio de cualquier país', shot='capturas/telefono-1-globo.png',
               chips=['223 países en vivo', 'Alarma y temporizador para dormir', 'Toda la radio de Colombia']),
        b=dict(h='Escucha el mundo, gratis', shots=['capturas/telefono-5-colombia.png', 'capturas/telefono-2-busqueda.png'],
               checks=['Salsa, vallenato, rock, jazz y noticias', 'Emisoras de Colombia y Latinoamérica', 'Un planeta en 8K, de día y de noche'])),
    'tv': dict(
        a=dict(h='8.700 canales gratis', s='De 177 países, en tu celular y en tu televisor', shot='capturas/telefono-1-globo.png',
               chips=['Noticias en vivo 24 horas', 'Deportes, música, cine y niños', 'Chromecast y Android TV']),
        b=dict(h='Mira el mundo en vivo', shots=['capturas/telefono-3-deportes.png', 'capturas/telefono-6-colombia.png'],
               checks=['Canales de 177 países', '10 categorías con colores', 'Comparte un canal por WhatsApp'])),
    'espacio': dict(
        a=dict(h='La Estación Espacial pasa sobre ti', s='Te avisamos 10 minutos antes para que salgas a verla', shot='capturas/telefono-3-pasos.png',
               chips=['Más de 14.000 satélites en vivo', 'Próximos lanzamientos de cohetes', 'Astronautas en órbita ahora']),
        b=dict(h='Mira el cielo como nunca', shots=['capturas/telefono-1-mapa.png', 'capturas/telefono-2-estacion.png'],
               checks=['La Estación Espacial en vivo', 'Satélites del mundo en un globo 3D', 'Cuenta regresiva de cohetes'])),
    'clima': dict(
        a=dict(h='¿Viene lluvia? Míralo en 3D', s='Viento, lluvia y huracanes de todo el planeta', shot='capturas/telefono-1-viento.png',
               chips=['Huracanes y tifones con su ruta', 'Alertas para tu ciudad', 'Pronóstico de 10 días']),
        b=dict(h='El clima del mundo en tus manos', shots=['capturas/telefono-6-huracan.png', 'capturas/telefono-4-mi-clima.png'],
               checks=['El viento del planeta en vivo', 'Lluvia de las próximas 48 horas', 'Alertas de tormentas y huracanes'])),
    'podcasts': dict(
        a=dict(h='Lo que el mundo está escuchando', s='Los podcasts más escuchados de 63 países, gratis', shot='capturas/telefono-1-mapa.png',
               chips=['El top de cada país', 'Noticias, humor y crimen real', 'Android Auto y Chromecast']),
        b=dict(h='Tu próximo podcast favorito', shots=['capturas/telefono-4-reproductor.png', 'capturas/telefono-2-explorar.png'],
               checks=['Explora por temas y países', 'Sigue donde quedaste', 'Temporizador para dormir'])),
    'biblia': dict(
        a=dict(h='Jesús sostiene el mundo', s='Y te regala un versículo para cada día', shot='capturas/telefono-1-hoy.png',
               chips=['La Biblia completa sin internet', 'Oraciones y música para orar', 'Versículos para tus estados']),
        b=dict(h='Empieza cada día con fe', shots=['capturas/telefono-2-versiculo.png', 'capturas/telefono-4-tarjetas.png'],
               checks=['Buenos días con Dios para WhatsApp', '¿Cómo te sientes? Versículos para ti', 'Lugares de la Biblia en 3D'])),
}


def background(key, w, h):
    """Fondo épico: el globo real de la app (Sismos) o el espacio con la Tierra de la publicidad."""
    if key == 'sismos':
        clip = os.path.join(hv.CACHE, 'sismos', 'clips', 'llegada')
        frames = sorted(os.listdir(clip)) if os.path.isdir(clip) else []
        if frames:
            im = Image.open(os.path.join(clip, frames[-12])).convert('RGB').resize((1080, 1920), Image.LANCZOS)
            top = (1920 - h) // 2 + 120
            im = im.crop((0, top, w, top + h)).convert('RGBA')
            shade = Image.new('RGBA', (w, h), (2, 3, 8, 0))
            y = np.linspace(0, 1, h)[:, None]
            a = 215 - 120 * np.clip(y / 0.45, 0, 1) + 110 * np.clip((y - 0.7) / 0.3, 0, 1)
            shade.putalpha(Image.fromarray(np.repeat(a, w, 1).astype(np.uint8)))
            im.alpha_composite(shade)
            return im
    bg = hv.Video.__new__(hv.Video)
    bg.key, bg.cfg = key, APPS[key]
    im = bg.backdrop()                       # 1200x2134, la Tierra abajo
    y0 = 2134 - h - 160
    return im.crop((60, y0, 60 + w, y0 + h)).convert('RGBA')


def brand(key, size=64):
    cfg = APPS[key]
    www = os.path.join(gg.ROOT, cfg['folder'], 'app', 'src', 'main', 'assets', 'www')
    icon = Image.open(os.path.join(www, 'img', 'icono.png')).convert('RGBA').resize((size, size), Image.LANCZOS)
    txt, pad = hv.plain_text(cfg['title'], gg.font(FB, int(size * 0.62)))
    im = Image.new('RGBA', (size + 16 + txt.size[0], max(size, txt.size[1])))
    im.alpha_composite(icon, (0, (im.size[1] - size) // 2))
    im.alpha_composite(txt, (size + 16 - pad, (im.size[1] - txt.size[1]) // 2))
    return im


def phone3d(key, shot, width, ay, ax=2.0, color=None):
    sh = Image.open(os.path.join(HERE, key, shot)).convert('RGB')
    ph = gp.phone(sh, width).convert('RGBA')
    glow, gpad = gp.glow_shadow(ph.size, color=color or APPS[key]['color'], blur=40, alpha=170)
    comb = Image.new('RGBA', glow.size)
    comb.alpha_composite(glow)
    comb.alpha_composite(ph, (gpad, gpad))
    big = Image.new('RGBA', (comb.size[0] + 120, comb.size[1] + 120))
    big.alpha_composite(comb, (60, 60))
    t = hv.tilt(big, ay, ax)
    return t.crop(t.getbbox())


def headline(img, text, x0, y, max_w, start, c1, c2, center=False, max_lines=3):
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    size = start
    while True:
        f = gg.font(FB, size)
        lines = hv.wrap(text, f, max_w)
        if len(lines) <= max_lines or size <= 40:
            break
        size -= 4
    for line in lines:
        t, pad = hv.grad_text(line, f, c1, c2, glow=0.7)
        x = (img.size[0] - t.size[0]) // 2 if center else x0 - pad
        img.alpha_composite(t, (x, y - pad))
        y += t.size[1] - 2 * pad + int(size * 0.12)
    return y


def chip(text, color, w_max):
    f = gg.font(FS, 34)
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    lines = hv.wrap(text, f, w_max - 90)
    lh = 44
    w = int(max(d.textlength(x, font=f) for x in lines)) + 96
    h = lh * len(lines) + 34
    im = Image.new('RGBA', (w, h))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle((0, 0, w - 1, h - 1), radius=26, fill=(10, 14, 30, 215), outline=color + (200,), width=3)
    cy = h // 2
    dr.ellipse((22, cy - 15, 52, cy + 15), fill=color + (255,))
    dr.line((30, cy, 36, cy + 7, 46, cy - 8), fill=(10, 12, 22, 255), width=5)
    for i, x in enumerate(lines):
        dr.text((70, 15 + i * lh), x, font=f, fill=(255, 255, 255))
    return im


def cta_button(text, size=44):
    btn = hv.pill(text, gg.font(FB, size), PINK + (255,), padx=44, pady=22)
    glow, pad = gp.glow_shadow(btn.size, color=PINK, blur=22, alpha=160)
    im = Image.new('RGBA', glow.size)
    im.alpha_composite(glow)
    im.alpha_composite(btn, (pad, pad))
    return im, pad


def ad_a(key):
    W, H = 1080, 1350
    cfg, ad = APPS[key], ADS[key]['a']
    c1 = cfg['color']
    c2 = PINK if c1 != PINK else hv.CYAN
    img = background(key, W, H)
    b = brand(key)
    img.alpha_composite(b, ((W - b.size[0]) // 2, 44))
    y = headline(img, ad['h'], 60, 150, W - 100, 100, c1, c2, center=True, max_lines=2) + 12
    for line in hv.wrap(ad['s'], gg.font(FS, 40), W - 140):
        s, p = hv.plain_text(line, gg.font(FS, 40), fill=(235, 240, 252))
        img.alpha_composite(s, ((W - s.size[0]) // 2, y + 6 - p))
        y += s.size[1] - 2 * p + 6
    ph = phone3d(key, ad['shot'], 420, -16)
    top = y + 40
    sc = min(1.0, (H - 120 - top) / ph.size[1])
    if sc < 1:
        ph = ph.resize((int(ph.size[0] * sc), int(ph.size[1] * sc)), Image.LANCZOS)
    img.alpha_composite(ph, (W - ph.size[0] - 20, top))
    cy = top + 40
    for t in ad['chips']:
        c = chip(t, c1, 560)
        img.alpha_composite(c, (50, cy))
        cy += c.size[1] + 22
    btn, pad = cta_button('Descárgala GRATIS')
    by = max(cy + 30, H - 250)
    img.alpha_composite(btn, (50 - pad, by - pad))
    s, p = hv.plain_text('en Google Play', gg.font(FS, 34), fill=(225, 232, 248))
    img.alpha_composite(s, (50 + (btn.size[0] - 2 * pad - s.size[0]) // 2 + p, by + btn.size[1] - 2 * pad + 10 - p))
    out = os.path.join(HERE, key, 'publicidad', 'facebook-1.png')
    img.convert('RGB').save(out, optimize=True)
    print('  ->', os.path.relpath(out, HERE))


def ad_b(key):
    W = H = 1080
    cfg, ad = APPS[key], ADS[key]['b']
    c1 = cfg['color']
    c2 = PINK if c1 != PINK else hv.CYAN
    img = background(key, W, H)
    # dos celulares con profundidad a la derecha
    back = phone3d(key, ad['shots'][1], 340, 24, color=c2)
    back = hv.with_alpha(back, 0.8)
    img.alpha_composite(back, (W - back.size[0] + 170, 250))
    front = phone3d(key, ad['shots'][0], 390, 14)
    img.alpha_composite(front, (W - front.size[0] + 10, 80))
    # columna de texto a la izquierda
    b = brand(key, 60)
    img.alpha_composite(b, (56, 56))
    y = headline(img, ad['h'], 60, 160, 470, 80, c1, c2, max_lines=4)
    y += 24
    for t in ad['checks']:
        c = chip(t, (47, 210, 122), 520)
        img.alpha_composite(c, (50, y))
        y += c.size[1] + 18
    btn, pad = cta_button('Descárgala GRATIS', 40)
    by = max(y + 26, H - 190)
    img.alpha_composite(btn, (50 - pad, by - pad))
    s, p = hv.plain_text('Disponible en Google Play', gg.font(FS, 30), fill=(225, 232, 248))
    img.alpha_composite(s, (56 - p, by + btn.size[1] - 2 * pad + 10 - p))
    out = os.path.join(HERE, key, 'publicidad', 'facebook-2.png')
    img.convert('RGB').save(out, optimize=True)
    print('  ->', os.path.relpath(out, HERE))


if __name__ == '__main__':
    for key in sys.argv[1:] or list(ADS):
        print(APPS[key]['title'])
        ad_a(key)
        ad_b(key)
