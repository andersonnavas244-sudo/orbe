"""Imágenes de Google Play y redes para Orbe Sismos.

En play-store/sismos/:
  destacada-1024x500.png            imagen destacada (feature graphic)
  publicidad/tienda-1..6.png        capturas con marco de celular y título (1080x1920)
  publicidad/redes-cuadrada.png     1080x1080
  publicidad/redes-historia.png     1080x1920

La Tierra lleva los sismos REALES del último mes (USGS, magnitud 4.5+) como puntos de luz.

    python play-store/generar_sismos.py
"""
import glob
import json
import math
import os
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import generar_graficos as gg
import generar_publicidad as gp

HERE = os.path.dirname(os.path.abspath(__file__))
APP = {'www': os.path.join(gg.ROOT, 'OrbeSismos', 'app', 'src', 'main', 'assets', 'www'), 'title': 'Orbe Sismos'}
OUT = os.path.join(HERE, 'sismos')
TEXTS = [
    ('Sismos en vivo', 'de todo el mundo, cada minuto'),
    ('Alarma si tiembla cerca', 'tú eliges la magnitud y la distancia'),
    ('Toda la información', 'magnitud, profundidad y distancia a ti'),
    ('Estoy bien, SOS y guías', 'funcionan aunque no haya internet'),
    ('Alertas de tsunami', 'boletines oficiales de NOAA'),
    ('Los más fuertes', 'terremotos históricos desde 1900'),
]


def quakes():
    url = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson'
    req = urllib.request.Request(url, headers={'User-Agent': 'OrbeSismos/1.0'})
    data = json.load(urllib.request.urlopen(req, timeout=30))
    return [(f['geometry']['coordinates'][1], f['geometry']['coordinates'][0], f['properties']['mag'] or 0) for f in data['features']]


QS = quakes()
print(len(QS), 'sismos reales del último mes')


def mag_color(m):
    return (255, 45, 85) if m >= 6.5 else (255, 90, 60) if m >= 5.5 else (255, 154, 46) if m >= 5 else (255, 209, 102)


def quake_layer(canvas, cx, cy, R, view, scale):
    """Sismos reales: punto + anillos, color y tamaño según la magnitud."""
    LAT0, LON0 = view
    H, W = canvas.shape[:2]
    lay = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(lay)
    for lat, lon, m in sorted(QS, key=lambda q: q[2]):
        la, lo = math.radians(lat), math.radians(lon) - LON0
        x_, y_, z_ = math.cos(la) * math.sin(lo), math.sin(la), math.cos(la) * math.cos(lo)
        vy = y_ * math.cos(LAT0) - z_ * math.sin(LAT0)
        vz = y_ * math.sin(LAT0) + z_ * math.cos(LAT0)
        if vz < 0.1:
            continue
        sx, sy = cx + x_ * R, cy - vy * R
        c = mag_color(m)
        r = (1.6 + (m - 4.5) * 1.8) * scale
        d.ellipse((sx - r, sy - r, sx + r, sy + r), fill=c)
        if m >= 5.5:
            for k in (2.4, 3.6):
                rr = r * k
                d.ellipse((sx - rr, sy - rr * 0.85, sx + rr, sy + rr * 0.85), outline=c, width=max(1, int(scale)))
    a = np.asarray(lay, np.float32)
    g = np.asarray(lay.filter(ImageFilter.GaussianBlur(3 * scale)), np.float32)
    return np.clip(canvas + a * 0.9 + g * 0.9, 0, 255)


def backdrop(W, H, cx, cy, R, lat0=8, lon0=-78, scale=1.0):
    canvas, xx, yy = gg.space(W, H, cx, cy, seed=13, stars=700)
    canvas, view = gg.earth(canvas, xx, yy, APP['www'], cx, cy, R, lat0=lat0, lon0=lon0, sun=(0.55, 0.5, 0.67),
                            halo_k=9, spec=0.3, spec_pow=140, rim_k=0.8, halo_a=0.7, cloud_a=0.6, night_a=1.3)
    return quake_layer(canvas, cx, cy, R, view, scale), xx


def feature():
    S = 2
    W, H = 1024 * S, 500 * S
    R = int(H * 0.47)
    cx, cy = int(R * 0.7), int(H * 0.53)
    canvas, xx = backdrop(W, H, cx, cy, R, scale=S * 1.4)
    img = Image.fromarray(canvas.astype(np.uint8))
    draw = ImageDraw.Draw(img)
    x0, x1 = int(cx + R * 1.12), W - 40 * S
    k = S * 500 / 360
    tf, size = gg.fit_font(draw, 'Orbe Sismos', gp.FONT_B, int(80 * k), x1 - x0)
    sub = 'Sismos y tsunamis en vivo'
    sf, _ = gg.fit_font(draw, sub, gp.FONT_S, int(22 * k), x1 - x0)
    tag = gg.font(gp.FONT_S, int(13 * k))
    ty = int(H * 0.26)
    draw.rounded_rectangle((x0, ty, x0 + 150 * k, ty + 26 * k), radius=13 * k, fill=(255, 40, 80))
    draw.ellipse((x0 + 11 * k, ty + 9 * k, x0 + 19 * k, ty + 17 * k), fill=(255, 255, 255))
    draw.text((x0 + 26 * k, ty + 4 * k), 'ALERTAS EN VIVO', font=tag, fill=(255, 255, 255))
    title_y = int(ty + 34 * k)
    img = gg.gradient_text(img, xx, 'Orbe Sismos', tf, x0, title_y, x1, S=S)
    draw = ImageDraw.Draw(img)
    bb = draw.textbbox((x0, title_y), 'Orbe Sismos', font=tf)
    draw.text((x0 + 2 * k, bb[3] + 10 * k), sub, font=sf, fill=(230, 236, 250))
    draw.text((x0 + 2 * k, bb[3] + 44 * k), 'Alarma si tiembla cerca de ti', font=sf, fill=(255, 170, 120))
    img.resize((1024, 500), Image.LANCZOS).save(os.path.join(OUT, 'destacada-1024x500.png'), optimize=True)
    print('  -> sismos/destacada-1024x500.png')


def store():
    shots = sorted(glob.glob(os.path.join(OUT, 'capturas', 'telefono-*.png')))
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    W, H = 1080, 1920
    bg, xx = backdrop(W, H, W // 2, int(H * 1.32), int(W * 0.95), lat0=-28, lon0=-76, scale=2.2)
    sf = gg.font(gp.FONT_S, 44)
    for i, (path, (t1, t2)) in enumerate(zip(shots, TEXTS), start=1):
        img = Image.fromarray(bg.astype(np.uint8))
        tf, _ = gg.fit_font(ImageDraw.Draw(img), t1, gp.FONT_B, 92, W - 100)
        img, bb = gp.text_center(img, xx, t1, tf, 120)
        img, bb2 = gp.text_center(img, xx, t2, sf, bb[3] + 22, gradient=False)
        ph = gp.phone(Image.open(path).convert('RGB'), 700)
        top = bb2[3] + 70
        if top + ph.size[1] > H - 30:
            s = (H - 30 - top) / ph.size[1]
            ph = ph.resize((int(ph.size[0] * s), int(ph.size[1] * s)), Image.LANCZOS)
        shadow, pad = gp.glow_shadow(ph.size, color=(255, 90, 60))
        x = (W - ph.size[0]) // 2
        base = img.convert('RGBA')
        base.alpha_composite(shadow, (x - pad, top - pad))
        base.alpha_composite(ph, (x, top))
        base.convert('RGB').save(os.path.join(out_dir, f'tienda-{i}.png'), optimize=True)
        print(f'  -> sismos/publicidad/tienda-{i}.png')


def social():
    out_dir = os.path.join(OUT, 'publicidad')
    icon = Image.open(os.path.join(APP['www'], 'img', 'icono.png')).convert('RGBA')
    for name, (W, H), (ecx, ecy, er), y0, ipx in [('redes-cuadrada.png', (1080, 1080), (540, 1660, 900), 60, 150),
                                                  ('redes-historia.png', (1080, 1920), (540, 2300, 1000), 260, 220)]:
        bg, xx = backdrop(W, H, ecx, ecy, er, lat0=-28, lon0=-76, scale=2.2)
        img = Image.fromarray(bg.astype(np.uint8)).convert('RGBA')
        img.alpha_composite(icon.resize((ipx, ipx), Image.LANCZOS), ((W - ipx) // 2, y0))
        img = img.convert('RGB')
        big = H > W
        img, bb = gp.text_center(img, xx, 'Orbe Sismos', gg.font(gp.FONT_B, 120 if big else 100), y0 + ipx + 30)
        sf = gg.font(gp.FONT_S, 56 if big else 46)
        img, bb = gp.text_center(img, xx, 'Sismos y tsunamis en vivo', sf, bb[3] + 30, gradient=False)
        img, bb = gp.text_center(img, xx, 'y alarma si tiembla cerca', sf, bb[3] + 8, gradient=False)
        d = ImageDraw.Draw(img)
        nf = gg.font(gp.FONT_B, 54 if big else 44)
        txt = 'Estoy bien  ·  SOS  ·  Simulacro'
        w = d.textlength(txt, font=nf)
        d.text(((W - w) / 2, bb[3] + 36), txt, font=nf, fill=(255, 255, 255))
        gp.cta(img, 'Gratis en Google Play', bb[3] + 36 + (80 if big else 66))
        img.save(os.path.join(out_dir, name), optimize=True)
        print(f'  -> sismos/publicidad/{name}')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    feature()
    if glob.glob(os.path.join(OUT, 'capturas', 'telefono-*.png')):
        store()
    social()
