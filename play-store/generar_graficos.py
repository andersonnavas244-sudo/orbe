"""Gráficos para Google Play de Orbe Radio y Orbe TV.

Genera, para cada app, en play-store/<app>/:
  destacada-1024x500.png imagen destacada (feature graphic)
  banner-tv-1280x720.png banner de Android TV para la ficha

La Tierra se renderiza con las texturas reales del proyecto (día 8K, luces nocturnas, nubes,
océano) y las emisoras/canales reales del catálogo como puntos de luz.

    python play-store/generar_graficos.py
"""
import json
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CYAN, PINK = np.array([34, 211, 238.]), np.array([255, 79, 163.])

APPS = {
    'radio': {
        'www': os.path.join(ROOT, 'RadioOrbe', 'app', 'src', 'main', 'assets', 'www'),
        'title': 'Orbe Radio', 'unit': 'emisoras',
        'colors': ['#f5d76e', '#ff8a3d', '#e8eef7', '#c9a7ff', '#ff3b3b', '#ff4fa3', '#ffb000', '#00e5ff',
                   '#4dd0a7', '#d4a373', '#7fb3ff', '#ff6b4a', '#b38b6d', '#ff7ce5', '#9be15d'],
        'max_dots': 9000,
    },
    'tv': {
        'www': os.path.join(ROOT, 'OrbeTV', 'app', 'src', 'main', 'assets', 'www'),
        'title': 'Orbe TV', 'unit': 'canales',
        'colors': ['#9be15d', '#ff8a3d', '#e8eef7', '#ff4fa3', '#c9a7ff', '#ffb000', '#4dd0a7', '#f5d76e', '#ff7ce5', '#22d3ee'],
        'max_dots': 99999,
    },
}

_tex_cache = {}


def tex(www, name, mode='RGB'):
    key = (name, mode)
    if key not in _tex_cache:
        _tex_cache[key] = np.asarray(Image.open(os.path.join(www, 'img', name)).convert(mode), dtype=np.float32)
    return _tex_cache[key]


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def font(names, size):
    for n in names:
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            pass
    return ImageFont.load_default()


def space(W, H, cx, cy, seed=11, stars=420):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.hypot((xx - cx) / W, (yy - cy) / H)
    bg = np.zeros((H, W, 3), np.float32) + np.array([3, 5, 14.])
    bg += np.array([16, 34, 82.])[None, None] * np.exp(-d * 3.2)[..., None]
    for (nx_, ny_, rx, ry, col_, a) in [(0.78, 0.18, 0.35, 0.22, (120, 40, 160), 0.35),
                                         (0.95, 0.85, 0.3, 0.25, (200, 40, 110), 0.25),
                                         (0.55, 0.95, 0.4, 0.2, (20, 90, 160), 0.30)]:
        g = np.exp(-(((xx / W - nx_) / rx) ** 2 + ((yy / H - ny_) / ry) ** 2) * 2.2)
        bg += np.array(col_, np.float32)[None, None] * (g * a)[..., None]
    img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
    dr = ImageDraw.Draw(img)
    rnd = random.Random(seed)
    for _ in range(int(stars * W * H / (1280 * 720))):
        x, y = rnd.randrange(W), rnd.randrange(H)
        b = rnd.random() ** 3
        s = 1 if b < 0.85 else 2
        v = int(110 + 145 * b)
        dr.ellipse((x - s, y - s, x + s, y + s), fill=(v, v, min(255, v + 25)))
    return np.asarray(img, np.float32).copy(), xx, yy


def earth(canvas, xx, yy, www, cx, cy, R, lat0=18, lon0=-48, sun=(0.80, 0.32, 0.50), halo_k=11,
          spec=0.9, spec_pow=70, rim_k=1.0, halo_a=0.95, cloud_a=0.85, night_a=1.9):
    LAT0, LON0 = math.radians(lat0), math.radians(lon0)
    SUN = np.array(sun); SUN = SUN / np.linalg.norm(SUN)
    day_name = '8k/8k_earth_daymap.jpg' if os.path.exists(os.path.join(www, 'img', '8k', '8k_earth_daymap.jpg')) else 'earth-blue-marble.jpg'
    day, night = tex(www, day_name), tex(www, 'earth-night.jpg')
    # Las apps ya no llevan clouds.png (usan clouds-4k.jpg): la copia con transparencia está en tools-diseno/texturas
    cloud_www = www if os.path.exists(os.path.join(www, 'img', 'clouds.png')) else os.path.join(ROOT, 'tools-diseno', 'texturas', '..', '_nubes')
    water_www = www if os.path.exists(os.path.join(www, 'img', 'earth-water.png')) else os.path.join(ROOT, 'RadioOrbe', 'app', 'src', 'main', 'assets', 'www')
    water, clouds = tex(water_www, 'earth-water.png', 'L') / 255.0, tex(cloud_www, 'clouds.png', 'RGBA')
    nx, ny = (xx - cx) / R, -(yy - cy) / R
    r2 = nx * nx + ny * ny
    inside = r2 <= 1.0
    nz = np.sqrt(np.clip(1 - r2, 0, 1))
    wy = ny * math.cos(LAT0) + nz * math.sin(LAT0)
    wz = -ny * math.sin(LAT0) + nz * math.cos(LAT0)
    lat = np.arcsin(np.clip(wy, -1, 1))
    lon = np.arctan2(nx, wz) + LON0
    u = ((lon / (2 * math.pi) + 0.5) % 1.0)
    v = np.clip(0.5 - lat / math.pi, 0, 0.99999)

    def sample(t, uu, vv):
        h, w = t.shape[:2]
        return t[(vv * h).astype(np.int32), (uu * w).astype(np.int32) % w]

    m = inside
    U, V = u[m], v[m]
    N = np.stack([nx[m], ny[m], nz[m]], -1)
    dif = N @ SUN
    dayc, nightc, wat, cl = sample(day, U, V), sample(night, U, V), sample(water, U, V), sample(clouds, U, V)
    light = np.clip(dif, 0, 1)
    col = dayc * (0.10 + 1.05 * light ** 0.85)[:, None] * smooth(-0.12, 0.14, dif)[:, None]
    col += nightc * night_a * (1 - smooth(-0.18, 0.08, dif))[:, None] * np.array([1.0, 0.92, 0.75])
    ca = (cl[:, 3] / 255.0 * cloud_a)[:, None]
    col = col * (1 - ca) + (255 * np.clip(dif * 1.05 + 0.04, 0, 1))[:, None] * ca
    Hh = SUN + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
    col += (np.clip(N @ Hh, 0, 1) ** spec_pow * wat * (1 - ca[:, 0]))[:, None] * np.array([255, 235, 200.]) * spec
    rim = (1 - N[:, 2]) ** 2.6
    col = col * (1 - rim[:, None] * 0.35 * rim_k) + rim[:, None] * rim_k * np.array([90, 175, 255.]) * (0.25 + 0.9 * np.clip(dif + 0.35, 0, 1))[:, None]
    canvas[m] = np.clip(col, 0, 255)
    dist = np.sqrt(r2)
    ang = np.clip((nx * SUN[0] + ny * SUN[1]) / np.maximum(dist, 1e-6) + 0.55, 0.15, 1.4)
    halo = np.exp(-(dist - 1) * halo_k) * ang
    halo[inside] = 0
    canvas += halo[..., None] * np.array([60, 150, 255.]) * halo_a
    return np.clip(canvas, 0, 255), (LAT0, LON0)


def dots(canvas, app, cx, cy, R, view, size=1.6, blur=4, glow=1.6, core=0.85):
    LAT0, LON0 = view
    H, W = canvas.shape[:2]
    cat = json.load(open(os.path.join(app['www'], 'data', 'stations.json'), encoding='utf-8'))
    F = {f: i for i, f in enumerate(cat['fields'])}
    rows = [r for r in cat['rows'] if r[F['lat']] is not None]
    rows.sort(key=lambda r: -r[F['votes']])
    layer = Image.new('RGB', (W, H))
    dd = ImageDraw.Draw(layer)
    colors = app['colors']
    for r in rows[:app['max_dots']]:
        la, lo = math.radians(r[F['lat']]), math.radians(r[F['lng']]) - LON0
        x_, y_, z_ = math.cos(la) * math.sin(lo), math.sin(la), math.cos(la) * math.cos(lo)
        vy = y_ * math.cos(LAT0) - z_ * math.sin(LAT0)
        vz = y_ * math.sin(LAT0) + z_ * math.cos(LAT0)
        if vz < 0.08:
            continue
        sx, sy = cx + x_ * R, cy - vy * R
        gi = next((i for i in range(len(colors)) if r[F['genres']] & (1 << i)), None)
        c = colors[gi] if gi is not None else '#9fb3cf'
        rad = size * (0.6 + 0.4 * vz)
        dd.ellipse((sx - rad, sy - rad, sx + rad, sy + rad), fill=c)
    a = np.asarray(layer, np.float32)
    g = np.asarray(layer.filter(ImageFilter.GaussianBlur(blur)), np.float32)
    known = cat.get('countries') or {}
    ncc = len({r[F['cc']] for r in cat['rows'] if r[F['cc']] and (not known or r[F['cc']] in known)})
    return np.clip(canvas + g * glow + a * core, 0, 255), len(cat['rows']), ncc


def glow_layer(canvas, draw_fn, blur, glow=1.8):
    H, W = canvas.shape[:2]
    lay = Image.new('RGB', (W, H))
    draw_fn(ImageDraw.Draw(lay))
    a = np.asarray(lay, np.float32)
    g = np.asarray(lay.filter(ImageFilter.GaussianBlur(blur)), np.float32)
    return np.clip(canvas + a + g * glow, 0, 255)


def waves(canvas, cx, cy, R, S, both=False, radii=(1.07, 1.15, 1.23), glow=1.8, width=5):
    def fn(d):
        for k, rr in enumerate(radii):
            rad = R * rr
            t = k / max(1, len(radii) - 1)
            c = tuple(int(x) for x in (PINK * (1 - t) + CYAN * t))
            w = max(2, int((width - k) * S))
            d.arc((cx - rad, cy - rad, cx + rad, cy + rad), -34 + k * 3, 34 - k * 3, fill=c, width=w)
            if both:
                d.arc((cx - rad, cy - rad, cx + rad, cy + rad), 180 - 34 + k * 3, 180 + 34 - k * 3, fill=c, width=w)
    return glow_layer(canvas, fn, 7 * S, glow)


def gradient_text(img, xx, text, fnt, x0, y0, x1, glow=0.5, S=1):
    W, H = img.size
    mask = Image.new('L', (W, H), 0)
    ImageDraw.Draw(mask).text((x0, y0), text, font=fnt, fill=255)
    mk = np.asarray(mask, np.float32) / 255.0
    gx = np.clip((xx - x0) / max(1, (x1 - x0)), 0, 1)[..., None]
    grad = CYAN * (1 - gx) + PINK * gx
    gm = np.asarray(mask.filter(ImageFilter.GaussianBlur(10 * S)), np.float32)[..., None] / 255.0
    base = np.asarray(img, np.float32)
    base = np.clip(base + grad * gm * glow, 0, 255)
    base = base * (1 - mk[..., None]) + grad * mk[..., None]
    return Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))


def fit_font(draw, text, names, start, max_w, min_size=20):
    size = start
    while True:
        f = font(names, size)
        if draw.textlength(text, font=f) <= max_w or size <= min_size:
            return f, size
        size -= 2


def promo(app, W, H, out, S=2):
    """Planeta a la izquierda + título a la derecha (destacada y banner de TV)."""
    W2, H2 = W * S, H * S
    R = int(H2 * 0.462)
    cx, cy = int(R * 0.62), int(H2 * 0.528)
    canvas, xx, yy = space(W2, H2, cx, cy)
    canvas, view = earth(canvas, xx, yy, app['www'], cx, cy, R)
    canvas, n, ncc = dots(canvas, app, cx, cy, R, view, size=1.6 * S * H / 360, blur=4 * S * H / 360)
    canvas = waves(canvas, cx, cy, R, S * H / 360)
    img = Image.fromarray(canvas.astype(np.uint8))
    draw = ImageDraw.Draw(img)
    x0 = int(cx + R * 1.23 + 22 * S * H / 360)
    x1 = W2 - int(26 * S * H / 360)
    tfont, size = fit_font(draw, app['title'], ['seguibl.ttf', 'segoeuib.ttf', 'arialbd.ttf'], int(96 * S * H / 360), x1 - x0)
    sub = f"{n:,}".replace(',', '.') + f" {app['unit']} · {ncc} países"
    sfont, _ = fit_font(draw, sub, ['seguisb.ttf', 'arial.ttf'], int(19 * S * H / 360), x1 - x0)
    tag_font = font(['seguisb.ttf', 'arialbd.ttf'], int(13 * S * H / 360))
    k = S * H / 360
    block_h = 24 * k + 8 * k + size * 1.15 + 10 * k + 22 * k
    ty = int((H2 - block_h) / 2)
    draw.rounded_rectangle((x0, ty, x0 + 112 * k, ty + 24 * k), radius=12 * k, fill=(255, 40, 80))
    draw.ellipse((x0 + 10 * k, ty + 8 * k, x0 + 18 * k, ty + 16 * k), fill=(255, 255, 255))
    draw.text((x0 + 24 * k, ty + 3 * k), 'EN VIVO', font=tag_font, fill=(255, 255, 255))
    title_y = int(ty + 30 * k)
    img = gradient_text(img, xx, app['title'], tfont, x0, title_y, x1, S=S)
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((x0, title_y), app['title'], font=tfont)
    draw.text((x0 + 2 * k, bbox[3] + 10 * k), sub, font=sfont, fill=(225, 233, 250))
    img.resize((W, H), Image.LANCZOS).save(out, optimize=True)
    print('  ->', os.path.relpath(out, ROOT))


def icon(app_key, app, out, S=2):
    """Icono 512x512: planeta realista centrado con ondas (radio) o dentro de una pantalla (TV)."""
    W = H = 512 * S
    cx = cy = W // 2
    R = int(W * (0.30 if app_key == 'tv' else 0.33))
    if app_key == 'tv':
        cy = int(H * 0.53)
    canvas, xx, yy = space(W, H, cx, cy, seed=5, stars=900)
    canvas, view = earth(canvas, xx, yy, app['www'], cx, cy, R, halo_k=9)
    canvas, _, _ = dots(canvas, app, cx, cy, R, view, size=2.4 * S, blur=5 * S)
    if app_key == 'radio':
        canvas = waves(canvas, cx, cy, R, S * 1.6, both=True, radii=(1.14, 1.30))
    else:
        def tv(d):
            pad = int(W * 0.085)
            top, bot = int(H * 0.22), int(H * 0.86)
            w = int(10 * S)
            for i in range(w):
                t = i / w
                c = tuple(int(x) for x in (CYAN * (1 - t) + PINK * t))
                d.rounded_rectangle((pad + i, top + i, W - pad - i, bot - i), radius=int(W * 0.07), outline=c, width=1)
            d.line((cx - W * 0.12, H * 0.10, cx, top), fill=tuple(int(x) for x in PINK), width=int(9 * S))
            d.line((cx + W * 0.12, H * 0.10, cx, top), fill=tuple(int(x) for x in CYAN), width=int(9 * S))
        canvas = glow_layer(canvas, tv, 6 * S)
    Image.fromarray(canvas.astype(np.uint8)).resize((512, 512), Image.LANCZOS).save(out, optimize=True)
    print('  ->', os.path.relpath(out, ROOT))


if __name__ == '__main__':
    for key, app in APPS.items():
        _tex_cache.clear()
        d = os.path.join(HERE, key)
        os.makedirs(d, exist_ok=True)
        print(app['title'])
        # el icono 512 lo genera generar_iconos_app.py (mismo estilo que el icono de la app)
        promo(app, 1024, 500, os.path.join(d, 'destacada-1024x500.png'))
        promo(app, 1280, 720, os.path.join(d, 'banner-tv-1280x720.png'))
