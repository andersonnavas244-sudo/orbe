"""Imágenes de Google Play y redes para Orbe Clima.

En play-store/clima/:
  destacada-1024x500.png            imagen destacada (feature graphic)
  publicidad/tienda-1..6.png        capturas con marco de celular y título (1080x1920)
  publicidad/redes-cuadrada.png     1080x1080
  publicidad/redes-historia.png     1080x1920

Las líneas de viento sobre la Tierra salen del pronóstico REAL (OrbeClima/tools/cache/grid.json,
generado con `node OrbeClima/tools/build-grid.js`): cada línea sigue el viento de ese lugar.

    python play-store/generar_clima.py
"""
import glob
import json
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import generar_graficos as gg
import generar_publicidad as gp
from generar_iconos_app import hurricane_layer

HERE = os.path.dirname(os.path.abspath(__file__))
APP = {'www': os.path.join(gg.ROOT, 'OrbeClima', 'app', 'src', 'main', 'assets', 'www'), 'title': 'Orbe Clima'}
GRID = os.path.join(gg.ROOT, 'OrbeClima', 'tools', 'cache', 'grid.json')
OUT = os.path.join(HERE, 'clima')
SHOTS = ['telefono-1-viento.png', 'telefono-2-lluvia.png', 'telefono-4-mi-clima.png', 'telefono-5-pronostico.png',
         'telefono-6-huracan.png', 'telefono-7-alertas.png']
TEXTS = [
    ('El viento del planeta en vivo', 'míralo moverse en 3D'),
    ('Lluvia de las próximas 48 h', 'dónde y cuánto va a llover'),
    ('El tiempo de tu ciudad', 'temperatura, viento, lluvia y UV'),
    ('Pronóstico de 10 días', 'hora por hora y día por día'),
    ('Huracanes y tifones', 'trayectoria y cono de pronóstico'),
    ('Alertas para tu ciudad', 'lluvia fuerte, tormentas y huracanes'),
]

G = json.load(open(GRID, encoding='utf-8'))
U = np.array(G['u'][0], np.float32).reshape(G['nlat'], G['nlng'])
V = np.array(G['v'][0], np.float32).reshape(G['nlat'], G['nlng'])


def wind(lat, lng):
    fi = np.clip((lat - G['lat0']) / G['dlat'], 0, G['nlat'] - 1.001)
    fj = ((lng - G['lng0']) / G['dlng']) % G['nlng']
    i0, j0 = int(fi), int(fj)
    i1, j1 = min(G['nlat'] - 1, i0 + 1), (j0 + 1) % G['nlng']
    di, dj = fi - i0, fj - j0
    def bl(A):
        return (A[i0, j0] * (1 - dj) + A[i0, j1] * dj) * (1 - di) + (A[i1, j0] * (1 - dj) + A[i1, j1] * dj) * di
    return bl(U), bl(V)


def wind_layer(canvas, cx, cy, R, view, scale, n=2600, seed=3):
    """Líneas de corriente del viento real proyectadas sobre el disco de la Tierra."""
    LAT0, LON0 = view
    H, W = canvas.shape[:2]
    rng = np.random.default_rng(seed)
    lay = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(lay)

    def proj(lat, lng):
        la, lo = math.radians(lat), math.radians(lng) - LON0
        x_, y_, z_ = math.cos(la) * math.sin(lo), math.sin(la), math.cos(la) * math.cos(lo)
        vy = y_ * math.cos(LAT0) - z_ * math.sin(LAT0)
        vz = y_ * math.sin(LAT0) + z_ * math.cos(LAT0)
        return cx + x_ * R * 1.004, cy - vy * R * 1.004, vz
    for _ in range(n):
        lat = math.degrees(math.asin(2 * rng.random() - 1)) * 0.95
        lng = rng.random() * 360 - 180
        pts = []
        for k in range(22):
            u, v = wind(lat, lng)
            sp = math.hypot(u, v)
            if sp < 3:
                break
            x, y, vz = proj(lat, lng)
            if vz < 0.08:
                break
            pts.append((x, y, sp))
            c = max(0.25, math.cos(math.radians(lat)))
            lng += u * 0.045 / c
            lat += v * 0.045
            if abs(lat) > 80:
                break
        for k in range(1, len(pts)):
            f = k / len(pts)
            sp = pts[k][2]
            a = min(1.0, 0.25 + sp / 60)
            col = (int(170 * f * a + 60), int(225 * f * a + 30), int(255 * f * a + 30))
            d.line((pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]), fill=col, width=max(1, int(scale * 0.9)))
    a = np.asarray(lay, np.float32)
    g = np.asarray(lay.filter(ImageFilter.GaussianBlur(2.0 * scale)), np.float32)
    return np.clip(canvas + a * 0.55 + g * 0.45, 0, 255)


def project_point(view, cx, cy, R, lat, lng):
    LAT0, LON0 = view
    la, lo = math.radians(lat), math.radians(lng) - LON0
    x_, y_, z_ = math.cos(la) * math.sin(lo), math.sin(la), math.cos(la) * math.cos(lo)
    vy = y_ * math.cos(LAT0) - z_ * math.sin(LAT0)
    return cx + x_ * R, cy - vy * R


def backdrop(W, H, cx, cy, R, lat0=14, lon0=-68, scale=1.0, storm=True):
    canvas, xx, yy = gg.space(W, H, cx, cy, seed=31, stars=800)
    canvas, view = gg.earth(canvas, xx, yy, APP['www'], cx, cy, R, lat0=lat0, lon0=lon0, sun=(0.55, 0.45, 0.70),
                            halo_k=9, spec=0.3, spec_pow=140, rim_k=0.8, halo_a=0.7, cloud_a=0.55, night_a=1.3)
    canvas = wind_layer(canvas, cx, cy, R, view, scale)
    if storm:
        ex, ey = project_point(view, cx, cy, R, 23.0, -64.0)
        hur = hurricane_layer(W, H, ex, ey, R * 0.7, scale)[..., None]
        canvas = canvas * (1 - hur * 0.9) + np.array([248, 251, 255.]) * hur * 0.9
    return canvas, xx


def feature():
    S = 2
    W, H = 1024 * S, 500 * S
    R = int(H * 0.47)
    cx, cy = int(R * 0.98), int(H * 0.52)
    canvas, xx = backdrop(W, H, cx, cy, R, scale=S * 1.2)
    img = Image.fromarray(canvas.astype(np.uint8))
    draw = ImageDraw.Draw(img)
    x0, x1 = int(cx + R * 1.18), W - 36 * S
    k = S * 500 / 360
    tf, size = gg.fit_font(draw, 'Orbe Clima', gp.FONT_B, int(82 * k), x1 - x0)
    sub = 'Viento, lluvia y huracanes en 3D'
    sf, _ = gg.fit_font(draw, sub, gp.FONT_S, int(22 * k), x1 - x0)
    tag = gg.font(gp.FONT_S, int(13 * k))
    ty = int(H * 0.27)
    tw = draw.textlength('EN VIVO', font=tag)
    draw.rounded_rectangle((x0, ty, x0 + 26 * k + tw + 12 * k, ty + 26 * k), radius=13 * k, fill=(255, 64, 90))
    draw.ellipse((x0 + 11 * k, ty + 9 * k, x0 + 19 * k, ty + 17 * k), fill=(255, 255, 255))
    draw.text((x0 + 26 * k, ty + 4 * k), 'EN VIVO', font=tag, fill=(255, 255, 255))
    title_y = int(ty + 34 * k)
    img = gg.gradient_text(img, xx, 'Orbe Clima', tf, x0, title_y, x1, S=S)
    draw = ImageDraw.Draw(img)
    bb = draw.textbbox((x0, title_y), 'Orbe Clima', font=tf)
    draw.text((x0 + 2 * k, bb[3] + 10 * k), sub, font=sf, fill=(232, 238, 252))
    draw.text((x0 + 2 * k, bb[3] + 44 * k), 'y alertas para tu ciudad', font=sf, fill=(130, 220, 255))
    img.resize((1024, 500), Image.LANCZOS).save(os.path.join(OUT, 'destacada-1024x500.png'), optimize=True)
    print('  -> clima/destacada-1024x500.png')


def store():
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    W, H = 1080, 1920
    bg, xx = backdrop(W, H, W // 2, int(H * 1.30), int(W * 0.92), lat0=-26, lon0=-68, scale=2.0, storm=False)
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
        shadow, pad = gp.glow_shadow(ph.size, color=(79, 140, 255))
        x = (W - ph.size[0]) // 2
        base = img.convert('RGBA')
        base.alpha_composite(shadow, (x - pad, top - pad))
        base.alpha_composite(ph, (x, top))
        base.convert('RGB').save(os.path.join(out_dir, f'tienda-{i}.png'), optimize=True)
        print(f'  -> clima/publicidad/tienda-{i}.png')


def social():
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    icon = Image.open(os.path.join(APP['www'], 'img', 'icono.png')).convert('RGBA')
    for name, (W, H), (ecx, ecy, er), y0, ipx in [('redes-cuadrada.png', (1080, 1080), (540, 1600, 820), 60, 150),
                                                  ('redes-historia.png', (1080, 1920), (540, 2250, 950), 260, 220)]:
        bg, xx = backdrop(W, H, ecx, ecy, er, lat0=-20, lon0=-68, scale=2.0, storm=False)
        img = Image.fromarray(bg.astype(np.uint8)).convert('RGBA')
        img.alpha_composite(icon.resize((ipx, ipx), Image.LANCZOS), ((W - ipx) // 2, y0))
        img = img.convert('RGB')
        big = H > W
        img, bb = gp.text_center(img, xx, 'Orbe Clima', gg.font(gp.FONT_B, 124 if big else 104), y0 + ipx + 30)
        sf = gg.font(gp.FONT_S, 56 if big else 46)
        img, bb = gp.text_center(img, xx, 'Viento, lluvia y huracanes', sf, bb[3] + 30, gradient=False)
        img, bb = gp.text_center(img, xx, 'moviéndose en 3D', sf, bb[3] + 8, gradient=False)
        d = ImageDraw.Draw(img)
        nf = gg.font(gp.FONT_B, 50 if big else 40)
        txt = 'Pronóstico  ·  Alertas  ·  48 horas'
        w = d.textlength(txt, font=nf)
        d.text(((W - w) / 2, bb[3] + 36), txt, font=nf, fill=(255, 255, 255))
        gp.cta(img, 'Gratis en Google Play', bb[3] + 36 + (80 if big else 66))
        img.save(os.path.join(out_dir, name), optimize=True)
        print(f'  -> clima/publicidad/{name}')


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
