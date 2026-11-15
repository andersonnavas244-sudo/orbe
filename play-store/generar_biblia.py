"""Imágenes de Google Play y redes para Orbe Biblia.

En play-store/biblia/:
  destacada-1024x500.png            imagen destacada (feature graphic)
  publicidad/tienda-1..6.png        capturas con marco de celular y título (1080x1920)
  publicidad/redes-cuadrada.png     1080x1080
  publicidad/redes-historia.png     1080x1920

La Tierra al amanecer con luz dorada, como el versículo del día de la app.

    python play-store/generar_biblia.py
"""
import glob
import os

import numpy as np
from PIL import Image, ImageDraw

import generar_graficos as gg
import generar_publicidad as gp

HERE = os.path.dirname(os.path.abspath(__file__))
APP = {'www': os.path.join(gg.ROOT, 'OrbeBiblia', 'app', 'src', 'main', 'assets', 'www'), 'title': 'Orbe Biblia'}
OUT = os.path.join(HERE, 'biblia')
GOLD = (245, 194, 107)
TEXTS = [
    ('Jesús sostiene el mundo', 'y te regala un versículo cada día'),
    ('Un versículo para cada día', 'compártelo en tus estados'),
    ('Oraciones de la Biblia', 'Padre Nuestro, Salmo 23, Salmo 91…'),
    ('La Biblia completa', 'Reina-Valera 1909, sin internet'),
    ('Busca cualquier palabra', 'en los 31.102 versículos'),
    ('Planes de lectura', 'la Biblia en 1 año, paso a paso'),
]


def backdrop(W, H, cx, cy, R, lat0=12, lon0=-70, scale=1.0):
    """Espacio + la Tierra con el amanecer dorado del lado izquierdo."""
    canvas, xx, yy = gg.space(W, H, cx, cy, seed=51, stars=800)
    canvas, view = gg.earth(canvas, xx, yy, APP['www'], cx, cy, R, lat0=lat0, lon0=lon0, sun=(-0.75, 0.35, 0.55),
                            halo_k=9, spec=0.3, spec_pow=140, rim_k=0.8, halo_a=0.7, cloud_a=0.55, night_a=1.5)
    # luz dorada del amanecer saliendo por el borde de la Tierra
    lx, ly = cx - R * 0.72, cy - R * 0.68
    r = np.sqrt((xx - lx) ** 2 + (yy - ly) ** 2)
    glow = np.clip(1 - r / (R * 1.6), 0, 1) ** 2.2
    canvas = np.clip(canvas + glow[..., None] * np.array([255, 190, 105.]) * 0.75, 0, 255)
    return canvas, xx


def jesus_canvas(W, H, ph, px, py, seed=51):
    """Espacio + el Salvator Mundi (Leonardo, dominio público) con la Tierra en su mano. Devuelve (canvas, xx)."""
    import json
    meta = json.load(open(os.path.join(APP['www'], 'data', 'cuadro.json'), encoding='utf-8'))
    canvas, xx, yy = gg.space(W, H, W // 2, H // 2, seed=seed, stars=500)
    pic = Image.open(os.path.join(APP['www'], 'img', 'salvator.jpg')).convert('RGB')
    pw = round(ph / meta['ratio'])
    pic = np.asarray(pic.resize((pw, ph), Image.LANCZOS), np.float32)
    # bordes del cuadro fundidos con el espacio
    fx = np.minimum(1, np.minimum(np.arange(pw), pw - 1 - np.arange(pw)) / (pw * 0.08))
    fy = np.minimum(1, (ph - 1 - np.arange(ph)) / (ph * 0.06))
    a = (fy[:, None] * fx[None, :])[..., None]
    y0, y1, x0, x1 = max(0, py), min(H, py + ph), max(0, px), min(W, px + pw)
    sub = pic[y0 - py:y1 - py, x0 - px:x1 - px]
    aa = a[y0 - py:y1 - py, x0 - px:x1 - px]
    canvas[y0:y1, x0:x1] = canvas[y0:y1, x0:x1] * (1 - aa) + sub * aa
    g = meta['globo']
    cx, cy, R = px + g['x'] * pw, py + g['y'] * ph, g['r'] * pw
    canvas, _ = gg.earth(canvas, xx, yy, APP['www'], cx, cy, R, lat0=10, lon0=-60, sun=(0.55, 0.45, 0.70),
                         halo_k=9, spec=0.3, spec_pow=140, rim_k=0.8, halo_a=0.7, cloud_a=0.55, night_a=1.3)
    r = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    glow = np.clip(1 - r / (R * 3.2), 0, 1) ** 2.4
    canvas = np.clip(canvas + glow[..., None] * np.array([255, 205, 130.]) * 0.35, 0, 255)
    return canvas, xx


def feature():
    S = 2
    W, H = 1024 * S, 500 * S
    ph = int(H * 1.0)
    canvas, xx = jesus_canvas(W, H, ph, int(W * 0.04), 0)
    img = Image.fromarray(canvas.astype(np.uint8))
    draw = ImageDraw.Draw(img)
    x0, x1 = int(W * 0.40), W - 40 * S
    k = S * 500 / 360
    tf, _ = gg.fit_font(draw, 'Orbe Biblia', gp.FONT_B, int(80 * k), x1 - x0)
    sub = 'La Biblia completa, sin internet'
    sf, _ = gg.fit_font(draw, sub, gp.FONT_S, int(22 * k), x1 - x0)
    tag = gg.font(gp.FONT_S, int(13 * k))
    ty = int(H * 0.26)
    draw.rounded_rectangle((x0, ty, x0 + 172 * k, ty + 26 * k), radius=13 * k, fill=GOLD)
    draw.text((x0 + 12 * k, ty + 4 * k), 'VERSÍCULO DEL DÍA', font=tag, fill=(27, 20, 5))
    title_y = int(ty + 34 * k)
    img = gg.gradient_text(img, xx, 'Orbe Biblia', tf, x0, title_y, x1, S=S)
    draw = ImageDraw.Draw(img)
    bb = draw.textbbox((x0, title_y), 'Orbe Biblia', font=tf)
    draw.text((x0 + 2 * k, bb[3] + 10 * k), sub, font=sf, fill=(230, 236, 250))
    draw.text((x0 + 2 * k, bb[3] + 44 * k), 'Un versículo para cada día', font=sf, fill=(255, 205, 130))
    img.resize((1024, 500), Image.LANCZOS).save(os.path.join(OUT, 'destacada-1024x500.png'), optimize=True)
    print('  -> biblia/destacada-1024x500.png')


def store():
    shots = sorted(glob.glob(os.path.join(OUT, 'capturas', 'telefono-*.png')))
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    W, H = 1080, 1920
    bg, xx = backdrop(W, H, W // 2, int(H * 1.32), int(W * 0.95), lat0=-20, lon0=-60, scale=2.2)
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
        shadow, pad = gp.glow_shadow(ph.size, color=GOLD)
        x = (W - ph.size[0]) // 2
        base = img.convert('RGBA')
        base.alpha_composite(shadow, (x - pad, top - pad))
        base.alpha_composite(ph, (x, top))
        base.convert('RGB').save(os.path.join(out_dir, f'tienda-{i}.png'), optimize=True)
        print(f'  -> biblia/publicidad/tienda-{i}.png')


def social():
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    for name, (W, H), ph, ty in [('redes-cuadrada.png', (1080, 1080), 700, 700), ('redes-historia.png', (1080, 1920), 1240, 1250)]:
        big = H > W
        pw = ph / 1.4713
        canvas, xx = jesus_canvas(W, H, ph, int((W - pw) / 2), 0)
        img = Image.fromarray(canvas.astype(np.uint8))
        y = ty
        img, bb = gp.text_center(img, xx, 'Orbe Biblia', gg.font(gp.FONT_B, 120 if big else 92), y)
        sf = gg.font(gp.FONT_S, 54 if big else 40)
        img, bb = gp.text_center(img, xx, 'La Biblia completa y un versículo cada día', sf, bb[3] + 24, gradient=False)
        d = ImageDraw.Draw(img)
        nf = gg.font(gp.FONT_B, 50 if big else 38)
        txt = 'Sin internet  ·  Gratis'
        w = d.textlength(txt, font=nf)
        d.text(((W - w) / 2, bb[3] + 30), txt, font=nf, fill=(255, 222, 160))
        gp.cta(img, 'Gratis en Google Play', bb[3] + 30 + (80 if big else 62))
        img.save(os.path.join(out_dir, name), optimize=True)
        print(f'  -> biblia/publicidad/{name}')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    feature()
    if glob.glob(os.path.join(OUT, 'capturas', 'telefono-*.png')):
        store()
    social()
