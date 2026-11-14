"""Banner de Android TV (320x180 dp -> 640x360 px en drawable-xhdpi).

Renderiza la Tierra real (textura 8K de día + luces nocturnas + nubes + brillo del océano
+ atmósfera) con las emisoras reales del catálogo como puntos de luz por género.
Se dibuja al doble de tamaño y se reduce para un borde suave.

    python tools/make-tv-banner.py
"""
import json
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
WWW = os.path.join(ROOT, 'app', 'src', 'main', 'assets', 'www')
OUT = os.path.join(ROOT, 'app', 'src', 'main', 'res', 'drawable-xhdpi', 'tv_banner.png')
Image.MAX_IMAGE_PIXELS = None

S = 2                       # supermuestreo
W, H = 640 * S, 360 * S
CX, CY, R = 104 * S, 190 * S, 166 * S   # planeta (algo cortado a la izquierda: más dramático)
LAT0, LON0 = math.radians(18), math.radians(-48)   # vista: América + Atlántico + África
SUN = np.array([0.80, 0.32, 0.50]); SUN /= np.linalg.norm(SUN)  # sol desde la derecha
CYAN, PINK = np.array([34, 211, 238.]), np.array([255, 79, 163.])
# Colores de las categorías de TV (mismo orden que js/genres.js)
GENRE_COLORS = ['#9be15d', '#ff8a3d', '#e8eef7', '#ff4fa3', '#c9a7ff', '#ffb000', '#4dd0a7', '#f5d76e', '#ff7ce5', '#22d3ee']


def tex(name, mode='RGB'):
    return np.asarray(Image.open(os.path.join(WWW, 'img', name)).convert(mode), dtype=np.float32)


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


# ---------------- fondo: espacio profundo ----------------
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
d = np.hypot((xx - CX) / W, (yy - CY) / H)
bg = np.zeros((H, W, 3), np.float32)
bg += np.array([3, 5, 14.])
bg += np.array([16, 34, 82.])[None, None] * np.exp(-d * 3.2)[..., None]
# nebulosas suaves
for (nx_, ny_, rx, ry, col_, a) in [(0.78, 0.18, 0.35, 0.22, (120, 40, 160), 0.35), (0.95, 0.85, 0.3, 0.25, (200, 40, 110), 0.25),
                                     (0.55, 0.95, 0.4, 0.2, (20, 90, 160), 0.30)]:
    g = np.exp(-(((xx / W - nx_) / rx) ** 2 + ((yy / H - ny_) / ry) ** 2) * 2.2)
    bg += np.array(col_, np.float32)[None, None] * (g * a)[..., None]
img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
dr = ImageDraw.Draw(img)
random.seed(11)
for _ in range(420):
    x, y = random.randrange(W), random.randrange(H)
    b = random.random() ** 3
    s = 1 if b < 0.85 else 2
    v = int(110 + 145 * b)
    dr.ellipse((x - s, y - s, x + s, y + s), fill=(v, v, min(255, v + 25)))
canvas = np.asarray(img, np.float32).copy()

# ---------------- planeta ----------------
day_path = os.path.join(WWW, 'img', '8k', '8k_earth_daymap.jpg')
day = tex('8k/8k_earth_daymap.jpg') if os.path.exists(day_path) else tex('earth-blue-marble.jpg')
night = tex('earth-night.jpg')
water = tex('earth-water.png', 'L') / 255.0
clouds = tex('clouds.png', 'RGBA')

nx = (xx - CX) / R
ny = -(yy - CY) / R
r2 = nx * nx + ny * ny
inside = r2 <= 1.0
nz = np.sqrt(np.clip(1 - r2, 0, 1))
# vista -> mundo (inclinación en X)
wy = ny * math.cos(LAT0) + nz * math.sin(LAT0)
wz = -ny * math.sin(LAT0) + nz * math.cos(LAT0)
wx = nx
lat = np.arcsin(np.clip(wy, -1, 1))
lon = np.arctan2(wx, wz) + LON0
u = ((lon / (2 * math.pi) + 0.5) % 1.0)
v = np.clip(0.5 - lat / math.pi, 0, 0.99999)


def sample(t, uu, vv):
    h, w = t.shape[:2]
    return t[(vv * h).astype(np.int32), (uu * w).astype(np.int32) % w]


m = inside
U, V = u[m], v[m]
N = np.stack([nx[m], ny[m], nz[m]], -1)
dif = N @ SUN
dayc = sample(day, U, V)
nightc = sample(night, U, V)
wat = sample(water, U, V)
cl = sample(clouds, U, V)

light = np.clip(dif, 0, 1)
dayw = smooth(-0.12, 0.14, dif)[:, None]
col = dayc * (0.10 + 1.05 * light ** 0.85)[:, None] * dayw
col += nightc * 1.9 * (1 - smooth(-0.18, 0.08, dif))[:, None] * np.array([1.0, 0.92, 0.75])
# nubes iluminadas por el sol
ca = (cl[:, 3] / 255.0 * 0.85)[:, None]
cloud_lit = (255 * np.clip(dif * 1.05 + 0.04, 0, 1))[:, None] * np.array([1.0, 1.0, 1.02])
col = col * (1 - ca) + cloud_lit * ca
# brillo del sol en el océano
Hh = SUN + np.array([0, 0, 1.0]); Hh /= np.linalg.norm(Hh)
spec = np.clip(N @ Hh, 0, 1) ** 70 * wat * (1 - ca[:, 0])
col += spec[:, None] * np.array([255, 235, 200.]) * 0.9
# atmósfera en el borde
rim = (1 - N[:, 2]) ** 2.6
col = col * (1 - rim[:, None] * 0.35) + rim[:, None] * np.array([90, 175, 255.]) * (0.25 + 0.9 * np.clip(dif + 0.35, 0, 1))[:, None]
canvas[m] = np.clip(col, 0, 255)

# halo exterior
dist = np.sqrt(r2)
ang_light = np.clip((nx * SUN[0] + ny * SUN[1]) / np.maximum(dist, 1e-6) + 0.55, 0.15, 1.4)
halo = np.exp(-(dist - 1) * 11) * ang_light
halo[inside] = 0
canvas += halo[..., None] * np.array([60, 150, 255.]) * 0.95
canvas = np.clip(canvas, 0, 255)

# ---------------- emisoras reales como puntos de luz ----------------
cat = json.load(open(os.path.join(WWW, 'data', 'stations.json'), encoding='utf-8'))
F = {f: i for i, f in enumerate(cat['fields'])}
rows = [r for r in cat['rows'] if r[F['lat']] is not None]
rows.sort(key=lambda r: -r[F['votes']])
dots = Image.new('RGB', (W, H))
dd = ImageDraw.Draw(dots)
for r in rows:
    la, lo = math.radians(r[F['lat']]), math.radians(r[F['lng']]) - LON0
    x_, y_, z_ = math.cos(la) * math.sin(lo), math.sin(la), math.cos(la) * math.cos(lo)
    vy = y_ * math.cos(LAT0) - z_ * math.sin(LAT0)
    vz = y_ * math.sin(LAT0) + z_ * math.cos(LAT0)
    if vz < 0.08:
        continue
    sx, sy = CX + x_ * R, CY - vy * R
    mask = r[F['genres']]
    gi = next((i for i in range(len(GENRE_COLORS)) if mask & (1 << i)), None)
    c = GENRE_COLORS[gi] if gi is not None else '#9fb3cf'
    rad = 2.0 * S * (0.6 + 0.4 * vz)
    dd.ellipse((sx - rad, sy - rad, sx + rad, sy + rad), fill=c)
dots_a = np.asarray(dots, np.float32)
glow = np.asarray(dots.filter(ImageFilter.GaussianBlur(4 * S)), np.float32)
canvas = np.clip(canvas + glow * 1.6 + dots_a * 0.85, 0, 255)

# ---------------- ondas de radio con brillo ----------------
waves = Image.new('RGB', (W, H))
wd = ImageDraw.Draw(waves)
for k, (rr, wdt) in enumerate([(1.07, 5), (1.15, 4), (1.23, 3)]):
    rad = R * rr
    t = k / 2
    c = tuple(int(x) for x in (PINK * (1 - t) + CYAN * t))
    wd.arc((CX - rad, CY - rad, CX + rad, CY + rad), -34 + k * 3, 34 - k * 3, fill=c, width=wdt * S)
wa = np.asarray(waves, np.float32)
wg = np.asarray(waves.filter(ImageFilter.GaussianBlur(7 * S)), np.float32)
canvas = np.clip(canvas + wa + wg * 1.8, 0, 255)

img = Image.fromarray(canvas.astype(np.uint8))

# ---------------- textos ----------------
X0 = 330 * S
draw = ImageDraw.Draw(img)
tag_font = font(['seguisb.ttf', 'arialbd.ttf'], 13 * S)
title = 'Orbe TV'
size = 96 * S
while True:
    tfont = font(['seguibl.ttf', 'segoeuib.ttf', 'arialbd.ttf'], size)
    if draw.textlength(title, font=tfont) <= W - X0 - 22 * S or size < 30:
        break
    size -= 2
sub_font = font(['seguisb.ttf', 'arial.ttf'], 19 * S)

# etiqueta "EN VIVO"
ty = 120 * S
draw.rounded_rectangle((X0, ty, X0 + 112 * S, ty + 24 * S), radius=12 * S, fill=(255, 40, 80))
draw.ellipse((X0 + 10 * S, ty + 8 * S, X0 + 18 * S, ty + 16 * S), fill=(255, 255, 255))
draw.text((X0 + 24 * S, ty + 3 * S), 'EN VIVO', font=tag_font, fill=(255, 255, 255))

# título con degradado y resplandor
title_y = ty + 26 * S
mask = Image.new('L', (W, H), 0)
ImageDraw.Draw(mask).text((X0, title_y), title, font=tfont, fill=255)
mk = np.asarray(mask, np.float32) / 255.0
gx = np.clip((xx - X0) / (W - X0 - 22 * S), 0, 1)[..., None]
grad = CYAN * (1 - gx) + PINK * gx
glow_m = np.asarray(mask.filter(ImageFilter.GaussianBlur(10 * S)), np.float32)[..., None] / 255.0
base = np.asarray(img, np.float32)
base = np.clip(base + grad * glow_m * 0.5, 0, 255)
base = base * (1 - mk[..., None]) + grad * mk[..., None]
img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
draw = ImageDraw.Draw(img)
bbox = draw.textbbox((X0, title_y), title, font=tfont)
n_ch = len(cat['rows'])
n_cc = len({r[F['cc']] for r in cat['rows']})
sub = f"{n_ch:,}".replace(',', '.') + f' canales · {n_cc} países'
draw.text((X0 + 2 * S, bbox[3] + 10 * S), sub, font=sub_font, fill=(225, 233, 250))

img = img.resize((W // S, H // S), Image.LANCZOS)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT, optimize=True)
print('banner ->', os.path.abspath(OUT))
