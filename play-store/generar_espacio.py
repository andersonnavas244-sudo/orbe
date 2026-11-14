"""Imágenes de Google Play y redes para Orbe Espacio.

En play-store/espacio/:
  destacada-1024x500.png            imagen destacada (feature graphic)
  publicidad/tienda-1..6.png        capturas con marco de celular y título (1080x1920)
  publicidad/redes-cuadrada.png     1080x1080
  publicidad/redes-historia.png     1080x1920

Los puntos alrededor de la Tierra son los satélites REALES del catálogo de la app (CelesTrak),
colocados con sus elementos orbitales (órbita kepleriana en el momento de generar la imagen),
así que se ve la nube de Starlink, el anillo geoestacionario, etc.

    python play-store/generar_espacio.py
"""
import glob
import json
import math
import os
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import generar_graficos as gg
import generar_publicidad as gp
from generar_iconos_app import iss_layer

HERE = os.path.dirname(os.path.abspath(__file__))
APP = {'www': os.path.join(gg.ROOT, 'OrbeEspacio', 'app', 'src', 'main', 'assets', 'www'), 'title': 'Orbe Espacio'}
OUT = os.path.join(HERE, 'espacio')
TEXTS = [
    ('La Estación Espacial en vivo', 'y más de 14.000 satélites en 3D'),
    ('Información técnica real', 'altitud, velocidad y órbita al segundo'),
    ('¿Cuándo pasa sobre ti?', 'te avisamos 10 minutos antes'),
    ('Encuéntrala en el cielo', 'hacia dónde mirar y qué tan brillante'),
    ('Próximos lanzamientos', 'cuenta regresiva de cohetes del mundo'),
    ('¿Quién está en el espacio?', 'los astronautas en órbita ahora mismo'),
]
COLORS = {'est': (255, 209, 102), 'starlink': (108, 184, 255), 'net': (167, 139, 250), 'nav': (52, 224, 161),
          'clima': (255, 159, 67), 'tierra': (34, 211, 238), 'ciencia': (255, 111, 181), 'com': (255, 107, 95),
          'edu': (198, 244, 50), 'mil': (184, 196, 217), 'otros': (139, 150, 173)}
RE = 6378.137
MU = 398600.4418


def satellites(t=None):
    """Posiciones (lat, lon en radianes, radio en radios terrestres, color) con órbitas keplerianas."""
    rows = json.load(open(os.path.join(APP['www'], 'data', 'sats.json'), encoding='utf-8'))['rows']
    t = t or time.time()
    ep = np.array([time.mktime(time.strptime(r[3][:19], '%Y-%m-%dT%H:%M:%S')) - time.timezone for r in rows])
    mm = np.array([r[4] for r in rows]); e = np.array([r[5] for r in rows])
    inc = np.radians([r[6] for r in rows]); raan = np.radians([r[7] for r in rows])
    argp = np.radians([r[8] for r in rows]); M0 = np.radians([r[9] for r in rows])
    n = mm * 2 * np.pi / 86400.0
    a = np.cbrt(MU / n ** 2)
    M = (M0 + n * (t - ep)) % (2 * np.pi)
    E = M.copy()
    for _ in range(8):
        E = E - (E - e * np.sin(E) - M) / (1 - e * np.cos(E))
    nu = 2 * np.arctan2(np.sqrt(1 + e) * np.sin(E / 2), np.sqrt(1 - e) * np.cos(E / 2))
    r = a * (1 - e * np.cos(E))
    u = argp + nu
    x = r * (np.cos(raan) * np.cos(u) - np.sin(raan) * np.sin(u) * np.cos(inc))
    y = r * (np.sin(raan) * np.cos(u) + np.cos(raan) * np.sin(u) * np.cos(inc))
    z = r * np.sin(u) * np.sin(inc)
    jd = t / 86400.0 + 2440587.5
    gmst = math.radians((280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360)
    lon = np.arctan2(y, x) - gmst
    lat = np.arcsin(z / r)
    cols = [COLORS.get(r_[13], COLORS['otros']) for r_ in rows]
    ok = (mm > 0.9) & (r > RE + 100)
    return lat[ok], lon[ok], (r / RE)[ok], [c for c, k in zip(cols, ok) if k]


SATS = satellites()
print(len(SATS[0]), 'satélites reales')


def sat_layer(canvas, cx, cy, R, view, scale, max_r=2.2):
    """Dibuja los satélites con un brillo suave; los que quedan detrás de la Tierra no se ven."""
    LAT0, LON0 = view
    H, W = canvas.shape[:2]
    lat, lon, rr, cols = SATS
    lo = lon - LON0
    x_, y_, z_ = np.cos(lat) * np.sin(lo) * rr, np.sin(lat) * rr, np.cos(lat) * np.cos(lo) * rr
    vy = y_ * math.cos(LAT0) - z_ * math.sin(LAT0)
    vz = y_ * math.sin(LAT0) + z_ * math.cos(LAT0)
    sx, sy = cx + x_ * R, cy - vy * R
    behind = (vz < 0) & (x_ ** 2 + vy ** 2 < 1.0)
    keep = ~behind & (rr < max_r) & (sx > -20) & (sx < W + 20) & (sy > -20) & (sy < H + 20)
    lay = Image.new('RGB', (W, H))
    d = ImageDraw.Draw(lay)
    s = max(0.8, 0.55 * scale)
    order = np.argsort(rr)[::-1]
    for i in order:
        if not keep[i]:
            continue
        c = cols[i]
        front = vz[i] > 0 and x_[i] ** 2 + vy[i] ** 2 < 1.0      # delante del disco: más tenue para que se vea la Tierra
        k = 0.45 if front else 0.95
        cc = tuple(int(v * k) for v in c)
        d.ellipse((sx[i] - s, sy[i] - s, sx[i] + s, sy[i] + s), fill=cc)
    a = np.asarray(lay, np.float32)
    g = np.asarray(lay.filter(ImageFilter.GaussianBlur(2.2 * scale)), np.float32)
    return np.clip(canvas + a * 0.8 + g * 0.55, 0, 255)


def backdrop(W, H, cx, cy, R, lat0=10, lon0=-70, scale=1.0, max_r=2.2):
    canvas, xx, yy = gg.space(W, H, cx, cy, seed=21, stars=800)
    canvas, view = gg.earth(canvas, xx, yy, APP['www'], cx, cy, R, lat0=lat0, lon0=lon0, sun=(0.55, 0.45, 0.70),
                            halo_k=9, spec=0.3, spec_pow=140, rim_k=0.8, halo_a=0.7, cloud_a=0.6, night_a=1.3)
    return sat_layer(canvas, cx, cy, R, view, scale, max_r), xx


def paste_iss(img, cx, cy, span, ang=14):
    W, H = img.size
    side = int(span * 1.6)
    lay = iss_layer(side, side / 2, side / 2, span, ang)
    sh = Image.new('RGBA', lay.size, (0, 0, 0, 0))
    sh.putalpha(lay.split()[3].filter(ImageFilter.GaussianBlur(span * 0.03)).point(lambda v: int(v * 0.55)))
    base = img.convert('RGBA')
    base.alpha_composite(sh, (int(cx - side / 2 + span * 0.02), int(cy - side / 2 + span * 0.04)))
    base.alpha_composite(lay, (int(cx - side / 2), int(cy - side / 2)))
    return base.convert('RGB')


def feature():
    S = 2
    W, H = 1024 * S, 500 * S
    R = int(H * 0.40)
    cx, cy = int(R * 1.05), int(H * 0.55)
    canvas, xx = backdrop(W, H, cx, cy, R, scale=S * 1.2, max_r=1.9)
    img = Image.fromarray(canvas.astype(np.uint8))
    img = paste_iss(img, cx + R * 0.95, cy - R * 0.92, R * 0.95)
    draw = ImageDraw.Draw(img)
    x0, x1 = int(cx + R * 1.5), W - 36 * S
    k = S * 500 / 360
    tf, size = gg.fit_font(draw, 'Orbe Espacio', gp.FONT_B, int(78 * k), x1 - x0)
    sub = 'La Estación Espacial en vivo'
    sf, _ = gg.fit_font(draw, sub, gp.FONT_S, int(22 * k), x1 - x0)
    tag = gg.font(gp.FONT_S, int(13 * k))
    ty = int(H * 0.27)
    tw = draw.textlength('EN VIVO', font=tag)
    draw.rounded_rectangle((x0, ty, x0 + 26 * k + tw + 12 * k, ty + 26 * k), radius=13 * k, fill=(255, 64, 90))
    draw.ellipse((x0 + 11 * k, ty + 9 * k, x0 + 19 * k, ty + 17 * k), fill=(255, 255, 255))
    draw.text((x0 + 26 * k, ty + 4 * k), 'EN VIVO', font=tag, fill=(255, 255, 255))
    title_y = int(ty + 34 * k)
    img = gg.gradient_text(img, xx, 'Orbe Espacio', tf, x0, title_y, x1, S=S)
    draw = ImageDraw.Draw(img)
    bb = draw.textbbox((x0, title_y), 'Orbe Espacio', font=tf)
    draw.text((x0 + 2 * k, bb[3] + 10 * k), sub, font=sf, fill=(232, 238, 252))
    draw.text((x0 + 2 * k, bb[3] + 44 * k), 'y +14.000 satélites en 3D', font=sf, fill=(255, 214, 120))
    img.resize((1024, 500), Image.LANCZOS).save(os.path.join(OUT, 'destacada-1024x500.png'), optimize=True)
    print('  -> espacio/destacada-1024x500.png')


def store():
    shots = sorted(glob.glob(os.path.join(OUT, 'capturas', 'telefono-*.png')))[:6]
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    W, H = 1080, 1920
    bg, xx = backdrop(W, H, W // 2, int(H * 1.30), int(W * 0.92), lat0=-28, lon0=-70, scale=2.0, max_r=1.6)
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
        shadow, pad = gp.glow_shadow(ph.size, color=(92, 200, 255))
        x = (W - ph.size[0]) // 2
        base = img.convert('RGBA')
        base.alpha_composite(shadow, (x - pad, top - pad))
        base.alpha_composite(ph, (x, top))
        base.convert('RGB').save(os.path.join(out_dir, f'tienda-{i}.png'), optimize=True)
        print(f'  -> espacio/publicidad/tienda-{i}.png')


def social():
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    icon = Image.open(os.path.join(APP['www'], 'img', 'icono.png')).convert('RGBA')
    for name, (W, H), (ecx, ecy, er), y0, ipx in [('redes-cuadrada.png', (1080, 1080), (540, 1600, 820), 60, 150),
                                                  ('redes-historia.png', (1080, 1920), (540, 2250, 950), 260, 220)]:
        bg, xx = backdrop(W, H, ecx, ecy, er, lat0=-28, lon0=-70, scale=2.0, max_r=1.6)
        img = Image.fromarray(bg.astype(np.uint8))
        big = H > W
        img = paste_iss(img, W * (0.79 if big else 0.85), ecy - er * (1.02 if big else 0.94), er * 0.36)
        img = img.convert('RGBA')
        img.alpha_composite(icon.resize((ipx, ipx), Image.LANCZOS), ((W - ipx) // 2, y0))
        img = img.convert('RGB')
        img, bb = gp.text_center(img, xx, 'Orbe Espacio', gg.font(gp.FONT_B, 120 if big else 100), y0 + ipx + 30)
        sf = gg.font(gp.FONT_S, 56 if big else 46)
        img, bb = gp.text_center(img, xx, 'La Estación Espacial en vivo', sf, bb[3] + 30, gradient=False)
        img, bb = gp.text_center(img, xx, 'y te avisa cuando pasa sobre ti', sf, bb[3] + 8, gradient=False)
        d = ImageDraw.Draw(img)
        nf = gg.font(gp.FONT_B, 50 if big else 40)
        txt = 'Satélites  ·  Cohetes  ·  Astronautas'
        w = d.textlength(txt, font=nf)
        d.text(((W - w) / 2, bb[3] + 36), txt, font=nf, fill=(255, 255, 255))
        gp.cta(img, 'Gratis en Google Play', bb[3] + 36 + (80 if big else 66))
        img.save(os.path.join(out_dir, name), optimize=True)
        print(f'  -> espacio/publicidad/{name}')


if __name__ == '__main__':
    import sys
    os.makedirs(OUT, exist_ok=True)
    what = sys.argv[1:] or ['feature', 'store', 'social']
    if 'feature' in what:
        feature()
    if 'store' in what and glob.glob(os.path.join(OUT, 'capturas', 'telefono-*.png')):
        store()
    if 'social' in what:
        social()
