"""Imágenes publicitarias de Orbe Radio y Orbe TV.

Para cada app crea en play-store/<app>/publicidad/:
  tienda-1..6.png   capturas con marco de celular y título (1080x1920) — para Play Store o anuncios
  redes-cuadrada.png  publicación cuadrada (1080x1080) — Instagram / Facebook
  redes-historia.png  historia vertical (1080x1920) — Instagram / estados de WhatsApp / TikTok

Requiere las capturas de play-store/<app>/capturas/telefono-*.png (capturas.js).

    python play-store/generar_publicidad.py
"""
import glob
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import generar_graficos as gg

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_B = ['seguibl.ttf', 'segoeuib.ttf', 'arialbd.ttf']
FONT_S = ['seguisb.ttf', 'segoeui.ttf', 'arial.ttf']

TEXTS = {
    'radio': [
        ('52.000 emisoras', 'de todo el mundo en un globo 3D'),
        ('Busca por género', 'salsa, rock, jazz, noticias y más'),
        ('Temporizador y alarma', 'despierta con tu emisora favorita'),
        ('223 países', 'elige un país y escucha su radio'),
        ('La radio de Colombia', 'y de toda Latinoamérica'),
        ('Planeta en 8K', 'día y noche en tiempo real'),
    ],
    'tv': [
        ('8.700 canales gratis', 'de 177 países en un globo 3D'),
        ('Noticias del mundo', 'en vivo, las 24 horas'),
        ('Deportes, música, cine', '10 categorías con colores'),
        ('Comparte y mira en tu TV', 'WhatsApp, Chromecast y Android TV'),
        ('177 países', 'toca un país y mira su televisión'),
        ('La TV de Colombia', 'y de toda Latinoamérica'),
    ],
}
SLOGAN = {
    'radio': ('Gira el planeta', 'y escucha el mundo'),
    'tv': ('Gira el planeta', 'y mira el mundo'),
}


def backdrop(key, app, W, H, earth_cx, earth_cy, R):
    canvas, xx, yy = gg.space(W, H, earth_cx, earth_cy, seed=9, stars=700)
    canvas, view = gg.earth(canvas, xx, yy, app['www'], earth_cx, earth_cy, R, lat0=10, lon0=-70,
                            sun=(0.55, 0.55, 0.62), halo_k=9, spec=0.3, spec_pow=140, rim_k=0.8,
                            halo_a=0.7, cloud_a=0.65, night_a=1.4)
    canvas, _, _ = gg.dots(canvas, dict(app, max_dots=4000), earth_cx, earth_cy, R, view,
                           size=2.2, blur=4, glow=0.6, core=0.7)
    return canvas, xx


def text_center(img, xx, text, fnt, y, gradient=True):
    W = img.size[0]
    d = ImageDraw.Draw(img)
    w = d.textlength(text, font=fnt)
    x0 = int((W - w) / 2)
    if gradient:
        return gg.gradient_text(img, xx, text, fnt, x0, y, int(x0 + w), glow=0.35), d.textbbox((x0, y), text, font=fnt)
    d.text((x0, y), text, font=fnt, fill=(230, 236, 250))
    return img, d.textbbox((x0, y), text, font=fnt)


def phone(shot, width):
    """Celular con marco oscuro, borde brillante y cámara."""
    sw = width
    sh = int(shot.size[1] * sw / shot.size[0])
    scr = shot.resize((sw, sh), Image.LANCZOS)
    bez = int(width * 0.035)
    W, H = sw + 2 * bez, sh + 2 * bez
    rad = int(width * 0.11)
    body = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle((0, 0, W - 1, H - 1), radius=rad, fill=(12, 15, 24, 255), outline=(120, 135, 170, 255), width=3)
    m = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=rad - bez, fill=255)
    body.paste(scr, (bez, bez), m)
    cx = W // 2
    d.ellipse((cx - 9, bez + 14, cx + 9, bez + 32), fill=(5, 6, 10, 255))
    return body


def glow_shadow(size, color=(34, 211, 238), blur=40, alpha=150):
    W, H = size
    pad = blur * 3
    m = Image.new('L', (W + 2 * pad, H + 2 * pad), 0)
    ImageDraw.Draw(m).rounded_rectangle((pad, pad, pad + W, pad + H), radius=int(W * 0.11), fill=alpha)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    g = Image.new('RGBA', m.size, color + (0,))
    g.putalpha(m)
    return g, pad


def store_shots(key, app):
    shots = sorted(glob.glob(os.path.join(HERE, key, 'capturas', 'telefono-*.png')))
    out_dir = os.path.join(HERE, key, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    W, H = 1080, 1920
    bg, xx = backdrop(key, app, W, H, W // 2, int(H * 1.32), int(W * 0.95))
    tf = gg.font(FONT_B, 92)
    sf = gg.font(FONT_S, 44)
    for i, (path, (t1, t2)) in enumerate(zip(shots, TEXTS[key]), start=1):
        img = Image.fromarray(bg.astype(np.uint8))
        tf_fit, _ = gg.fit_font(ImageDraw.Draw(img), t1, FONT_B, 92, W - 100)
        img, bb = text_center(img, xx, t1, tf_fit, 120)
        img, bb2 = text_center(img, xx, t2, sf, bb[3] + 22, gradient=False)
        ph = phone(Image.open(path).convert('RGB'), 700)
        top = bb2[3] + 70
        if top + ph.size[1] > H - 30:  # que siempre quepa
            scale = (H - 30 - top) / ph.size[1]
            ph = ph.resize((int(ph.size[0] * scale), int(ph.size[1] * scale)), Image.LANCZOS)
        shadow, pad = glow_shadow(ph.size)
        x = (W - ph.size[0]) // 2
        base = img.convert('RGBA')
        base.alpha_composite(shadow, (x - pad, top - pad))
        base.alpha_composite(ph, (x, top))
        base.convert('RGB').save(os.path.join(out_dir, f'tienda-{i}.png'), optimize=True)
        print('  ->', f'{key}/publicidad/tienda-{i}.png')


def cta(img, text, y):
    W = img.size[0]
    d = ImageDraw.Draw(img)
    f = gg.font(FONT_B, 40)
    w = d.textlength(text, font=f)
    x0 = int((W - w) / 2) - 40
    d.rounded_rectangle((x0, y, x0 + w + 80, y + 84), radius=42, fill=(255, 79, 163))
    d.text((x0 + 40, y + 16), text, font=f, fill=(255, 255, 255))


def social(key, app):
    out_dir = os.path.join(HERE, key, 'publicidad')
    icon = Image.open(os.path.join(app['www'], 'img', 'icono.png')).convert('RGBA')
    s1, s2 = SLOGAN[key]
    n_text = TEXTS[key][0][0]
    for name, (W, H), earth, y0, icon_px in [
        ('redes-cuadrada.png', (1080, 1080), (540, 1660, 900), 60, 150),
        ('redes-historia.png', (1080, 1920), (540, 2300, 1000), 260, 220),
    ]:
        bg, xx = backdrop(key, app, W, H, *earth)
        img = Image.fromarray(bg.astype(np.uint8)).convert('RGBA')
        ic = icon.resize((icon_px, icon_px), Image.LANCZOS)
        img.alpha_composite(ic, ((W - icon_px) // 2, y0))
        img = img.convert('RGB')
        y = y0 + icon_px + 30
        tf = gg.font(FONT_B, 120 if H > W else 104)
        img, bb = text_center(img, xx, app['title'], tf, y)
        sf = gg.font(FONT_S, 56 if H > W else 48)
        img, bb = text_center(img, xx, s1, sf, bb[3] + 30, gradient=False)
        img, bb = text_center(img, xx, s2, sf, bb[3] + 8, gradient=False)
        nf = gg.font(FONT_B, 54 if H > W else 46)
        # cifra en blanco con sombra: se lee bien aunque quede sobre el brillo del planeta
        d = ImageDraw.Draw(img)
        w = d.textlength(n_text, font=nf)
        x0, y = int((W - w) / 2), bb[3] + 36
        sh = Image.new('L', img.size, 0)
        ImageDraw.Draw(sh).text((x0, y), n_text, font=nf, fill=200)
        sh = sh.filter(ImageFilter.GaussianBlur(8))
        img = Image.composite(Image.new('RGB', img.size, (0, 0, 0)), img, sh)
        d = ImageDraw.Draw(img)
        d.text((x0, y), n_text, font=nf, fill=(255, 255, 255))
        bb = d.textbbox((x0, y), n_text, font=nf)
        cta(img, 'Gratis en Google Play', bb[3] + 40)
        img.save(os.path.join(out_dir, name), optimize=True)
        print('  ->', f'{key}/publicidad/{name}')


if __name__ == '__main__':
    for key, app in gg.APPS.items():
        gg._tex_cache.clear()
        print(app['title'])
        store_shots(key, app)
        social(key, app)
