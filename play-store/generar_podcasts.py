"""Imágenes de Google Play y redes para Orbe Podcasts.

En play-store/podcasts/:
  destacada-1024x500.png            imagen destacada (feature graphic)
  publicidad/tienda-1..6.png        capturas con marco de celular y título (1080x1920)
  publicidad/redes-cuadrada.png     1080x1080
  publicidad/redes-historia.png     1080x1920

Los puntos de colores sobre la Tierra son los podcasts REALES del catálogo de la app (top de cada
país), ubicados en espiral alrededor de su país como en la app.

    python play-store/generar_podcasts.py [feature] [store] [social]
"""
import glob
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import generar_graficos as gg
import generar_publicidad as gp
from generar_iconos_app import mic_layer

HERE = os.path.dirname(os.path.abspath(__file__))
APP = {'www': os.path.join(gg.ROOT, 'OrbePodcasts', 'app', 'src', 'main', 'assets', 'www'), 'title': 'Orbe Podcasts'}
OUT = os.path.join(HERE, 'podcasts')
SHOTS = ['telefono-1-mapa.png', 'telefono-2-explorar.png', 'telefono-3-podcast.png', 'telefono-4-reproductor.png',
         'telefono-5-pais.png', 'telefono-6-biblioteca.png']
TEXTS = [
    ('El mundo en podcasts', 'lo más escuchado de 63 países'),
    ('Descubre los éxitos', 'el top de tu país y del mundo'),
    ('Todos sus episodios', 'sigue tus programas favoritos'),
    ('Un reproductor completo', 'velocidad, temporizador y Chromecast'),
    ('El top de cada país', 'toca una bandera en el globo'),
    ('Tu biblioteca', 'sigue escuchando donde quedaste'),
]
# Colores de los géneros (los mismos de la app)
GEN = {'noticias': (92, 225, 255), 'comedia': (255, 224, 102), 'sociedad': (255, 181, 71), 'crimen': (255, 79, 109), 'historia': (212, 163, 115),
       'negocios': (47, 214, 160), 'salud': (163, 230, 53), 'educacion': (123, 140, 255), 'religion': (214, 168, 255), 'deportes': (255, 107, 61),
       'ciencia': (79, 140, 255), 'cultura': (232, 85, 155), 'ninos': (249, 168, 212), 'ocio': (192, 132, 252), 'otros': (148, 163, 184)}
RANGES = {'noticias': [1489, 1490, 1526, 1527, 1528, 1529, 1530, 1531, 1511, 1311, 1325], 'comedia': [1303, 1495, 1496, 1497],
          'sociedad': [1324, 1543, 1302, 1443, 1320, 1544], 'crimen': [1488], 'historia': [1487], 'negocios': [1321, 1410, 1493, 1412, 1491, 1492, 1494],
          'salud': [1512, 1513, 1514, 1515, 1516, 1517, 1518, 1307], 'educacion': [1304, 1498, 1499, 1500, 1501],
          'religion': [1314, 1438, 1439, 1463, 1440, 1441, 1532, 1444], 'deportes': list(range(1545, 1561)), 'ciencia': [1318] + list(range(1533, 1543)),
          'cultura': [1301, 1482, 1402, 1459, 1306, 1405, 1406, 1309, 1561, 1562, 1563, 1564, 1565, 1310, 1523, 1524, 1525, 1483, 1484, 1485, 1486],
          'ninos': [1305, 1519, 1520, 1521, 1522], 'ocio': list(range(1502, 1511))}
BY_ID = {i: k for k, ids in RANGES.items() for i in ids}

CAT = json.load(open(os.path.join(APP['www'], 'data', 'catalogo.json'), encoding='utf-8'))['rows']
CENTERS = json.load(open(os.path.join(APP['www'], 'data', 'paises.json'), encoding='utf-8'))
print(len(CAT), 'podcasts reales')


def pod_points():
    out = []
    for r in CAT:
        c = CENTERS.get(r[5])
        if not c:
            continue
        rank = r[6]
        a, rr = rank * 2.399963, 0.55 + math.sqrt(rank) * 0.62
        lat = c[0] + rr * math.sin(a)
        lng = c[1] + rr * math.cos(a) / max(0.35, math.cos(math.radians(c[0])))
        out.append((math.radians(lat), math.radians(lng), GEN[BY_ID.get(r[4], 'otros')], r[7]))
    return out


PTS = pod_points()


def pod_layer(canvas, cx, cy, R, view, scale):
    LAT0, LON0 = view
    H, W = canvas.shape[:2]
    lay = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(lay)
    for la, lo, col, charts in PTS:
        lo = lo - LON0
        x_, y_, z_ = math.cos(la) * math.sin(lo), math.sin(la), math.cos(la) * math.cos(lo)
        vy = y_ * math.cos(LAT0) - z_ * math.sin(LAT0)
        vz = y_ * math.sin(LAT0) + z_ * math.cos(LAT0)
        if vz < 0.12:
            continue
        sx, sy = cx + x_ * R * 1.006, cy - vy * R * 1.006
        r = (1.0 + min(charts, 8) * 0.18) * scale
        d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=col)
    a = np.asarray(lay, np.float32)
    g = np.asarray(lay.filter(ImageFilter.GaussianBlur(2.6 * scale)), np.float32)
    return np.clip(canvas + a * 0.9 + g * 0.9, 0, 255)


def backdrop(W, H, cx, cy, R, lat0=12, lon0=-62, scale=1.0):
    canvas, xx, yy = gg.space(W, H, cx, cy, seed=41, stars=800)
    canvas, view = gg.earth(canvas, xx, yy, APP['www'], cx, cy, R, lat0=lat0, lon0=lon0, sun=(0.55, 0.45, 0.70),
                            halo_k=9, spec=0.3, spec_pow=140, rim_k=0.8, halo_a=0.7, cloud_a=0.5, night_a=1.3)
    return pod_layer(canvas, cx, cy, R, view, scale), xx


def paste_mic(img, cx, cy, h):
    W, H = img.size
    side = int(h * 1.5)
    lay = mic_layer(side, side / 2, side / 2, h)
    sh = Image.new('RGBA', lay.size, (0, 0, 0, 0))
    sh.putalpha(lay.split()[3].filter(ImageFilter.GaussianBlur(h * 0.05)).point(lambda v: int(v * 0.6)))
    # ondas de sonido
    waves = Image.new('RGBA', lay.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(waves)
    c0 = side / 2 - h * 0.2
    for i, (rr, col) in enumerate(((0.36, (255, 122, 182)), (0.48, (176, 107, 255)), (0.6, (92, 225, 255)))):
        r = h * rr
        for a0, a1 in ((-50, 50), (130, 230)):
            d.arc((side / 2 - r, c0 - r, side / 2 + r, c0 + r), a0, a1, fill=col + (255,), width=max(3, int(h * (0.035 - i * 0.005))))
    glow = waves.filter(ImageFilter.GaussianBlur(h * 0.03))
    base = img.convert('RGBA')
    x, y = int(cx - side / 2), int(cy - side / 2)
    base.alpha_composite(glow, (x, y)); base.alpha_composite(waves, (x, y))
    base.alpha_composite(sh, (x + int(h * 0.02), y + int(h * 0.05)))
    base.alpha_composite(lay, (x, y))
    return base.convert('RGB')


def feature():
    S = 2
    W, H = 1024 * S, 500 * S
    R = int(H * 0.47)
    cx, cy = int(R * 0.95), int(H * 0.52)
    canvas, xx = backdrop(W, H, cx, cy, R, scale=S * 1.3)
    img = Image.fromarray(canvas.astype(np.uint8))
    img = paste_mic(img, cx + R * 0.82, cy + R * 0.25, R * 0.95)
    draw = ImageDraw.Draw(img)
    x0, x1 = int(cx + R * 1.45), W - 36 * S
    k = S * 500 / 360
    tf, _ = gg.fit_font(draw, 'Orbe Podcasts', gp.FONT_B, int(78 * k), x1 - x0)
    sub = 'Lo más escuchado de 63 países'
    sf, _ = gg.fit_font(draw, sub, gp.FONT_S, int(22 * k), x1 - x0)
    tag = gg.font(gp.FONT_S, int(13 * k))
    ty = int(H * 0.27)
    tw = draw.textlength('TOP DEL MUNDO', font=tag)
    draw.rounded_rectangle((x0, ty, x0 + 26 * k + tw + 12 * k, ty + 26 * k), radius=13 * k, fill=(232, 85, 155))
    draw.ellipse((x0 + 11 * k, ty + 9 * k, x0 + 19 * k, ty + 17 * k), fill=(255, 255, 255))
    draw.text((x0 + 26 * k, ty + 4 * k), 'TOP DEL MUNDO', font=tag, fill=(255, 255, 255))
    title_y = int(ty + 34 * k)
    img = gg.gradient_text(img, xx, 'Orbe Podcasts', tf, x0, title_y, x1, S=S)
    draw = ImageDraw.Draw(img)
    bb = draw.textbbox((x0, title_y), 'Orbe Podcasts', font=tf)
    draw.text((x0 + 2 * k, bb[3] + 10 * k), sub, font=sf, fill=(232, 238, 252))
    draw.text((x0 + 2 * k, bb[3] + 44 * k), 'en un globo 3D, gratis', font=sf, fill=(255, 175, 215))
    img.resize((1024, 500), Image.LANCZOS).save(os.path.join(OUT, 'destacada-1024x500.png'), optimize=True)
    print('  -> podcasts/destacada-1024x500.png')


def store():
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    W, H = 1080, 1920
    bg, xx = backdrop(W, H, W // 2, int(H * 1.30), int(W * 0.92), lat0=-20, lon0=-62, scale=2.0)
    sf = gg.font(gp.FONT_S, 44)
    for i, (name, (t1, t2)) in enumerate(zip(SHOTS, TEXTS), start=1):
        path = os.path.join(OUT, 'capturas', name)
        if not os.path.exists(path):
            continue
        img = Image.fromarray(bg.astype(np.uint8))
        tf, _ = gg.fit_font(ImageDraw.Draw(img), t1, gp.FONT_B, 92, W - 100)
        img, bb = gp.text_center(img, xx, t1, tf, 120)
        img, bb2 = gp.text_center(img, xx, t2, sf, bb[3] + 22, gradient=False)
        ph = gp.phone(Image.open(path).convert('RGB'), 700)
        top = bb2[3] + 70
        if top + ph.size[1] > H - 30:
            s = (H - 30 - top) / ph.size[1]
            ph = ph.resize((int(ph.size[0] * s), int(ph.size[1] * s)), Image.LANCZOS)
        shadow, pad = gp.glow_shadow(ph.size, color=(232, 85, 155))
        x = (W - ph.size[0]) // 2
        base = img.convert('RGBA')
        base.alpha_composite(shadow, (x - pad, top - pad))
        base.alpha_composite(ph, (x, top))
        base.convert('RGB').save(os.path.join(out_dir, f'tienda-{i}.png'), optimize=True)
        print(f'  -> podcasts/publicidad/tienda-{i}.png')


def social():
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    icon = Image.open(os.path.join(APP['www'], 'img', 'icono.png')).convert('RGBA')
    for name, (W, H), (ecx, ecy, er), y0, ipx in [('redes-cuadrada.png', (1080, 1080), (540, 1600, 820), 60, 150),
                                                  ('redes-historia.png', (1080, 1920), (540, 2250, 950), 260, 220)]:
        bg, xx = backdrop(W, H, ecx, ecy, er, lat0=-20, lon0=-62, scale=2.0)
        img = Image.fromarray(bg.astype(np.uint8)).convert('RGBA')
        img.alpha_composite(icon.resize((ipx, ipx), Image.LANCZOS), ((W - ipx) // 2, y0))
        img = img.convert('RGB')
        big = H > W
        img, bb = gp.text_center(img, xx, 'Orbe Podcasts', gg.font(gp.FONT_B, 116 if big else 98), y0 + ipx + 30)
        sf = gg.font(gp.FONT_S, 56 if big else 46)
        img, bb = gp.text_center(img, xx, 'Los podcasts más escuchados', sf, bb[3] + 30, gradient=False)
        img, bb = gp.text_center(img, xx, 'de 63 países, en 3D', sf, bb[3] + 8, gradient=False)
        d = ImageDraw.Draw(img)
        nf = gg.font(gp.FONT_B, 50 if big else 40)
        txt = 'Noticias  ·  Historias  ·  Comedia'
        w = d.textlength(txt, font=nf)
        d.text(((W - w) / 2, bb[3] + 36), txt, font=nf, fill=(255, 255, 255))
        gp.cta(img, 'Gratis en Google Play', bb[3] + 36 + (80 if big else 66))
        img.save(os.path.join(out_dir, name), optimize=True)
        print(f'  -> podcasts/publicidad/{name}')


if __name__ == '__main__':
    import sys
    os.makedirs(OUT, exist_ok=True)
    what = sys.argv[1:] or ['feature', 'store', 'social']
    if 'feature' in what:
        feature()
    if 'store' in what:
        store()
    if 'social' in what:
        social()
