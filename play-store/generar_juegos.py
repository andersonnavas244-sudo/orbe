"""Imágenes de Google Play para Juegos de Colombia (sin el globo terráqueo).

En play-store/juegos/:
  destacada-1024x500.png        imagen destacada (feature graphic)
  publicidad/tienda-1..8.png    capturas reales con marco de celular y título (1080x1920)

Fondo morado noche (el de la app), luces de la guirnalda desenfocadas y la franja amarilla, azul y roja.
Antes hay que sacar las capturas reales:

    node play-store/capturas_juegos.js <carpeta node_modules con puppeteer-core>
    python play-store/generar_juegos.py
"""
import glob
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

import generar_publicidad as gp

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WWW = os.path.join(ROOT, 'OrbeJuegos', 'app', 'src', 'main', 'assets', 'www')
OUT = os.path.join(HERE, 'juegos')
AMARILLO, AZUL, ROJO = (252, 209, 22), (0, 56, 147), (206, 17, 38)
ORO = (255, 211, 77)
TEXTS = {
    'menu': ('Los juegos de Colombia', 'tejo, billar, parqués y dominó en 3D'),
    'tejo-apunta': ('Tejo en 3D', 'jala el dedo, apunta al bocín y suelta'),
    'tejo-mecha': ('¡Revienta la mecha!', 'mano 1 · mecha 3 · embocinada 6 · moñona 9'),
    'billar-bola8': ('Pool bola 8 y bola 9', 'y también carambola y tres bandas'),
    'billar-guia': ('Billar con efecto', 'línea de ayuda y El Profe como rival'),
    'parques': ('Parqués de 2 a 4', 'contra la máquina o con tus amigos'),
    'domino': ('Dominó en parejas', 'mano a mano o todos contra todos'),
    'ganaste': ('¡Gana y presume!', 'sin internet y sin registrarte'),
}


def fuente(nombre, size, peso):
    """Fuentes de la app (Baloo 2 para títulos, Nunito para textos), con el peso pedido."""
    try:
        f = ImageFont.truetype(os.path.join(WWW, 'fonts', nombre), size)
        f.set_variation_by_axes([peso])
        return f
    except (OSError, ValueError):
        return ImageFont.truetype('seguibl.ttf', size)


def titulo(size):
    return fuente('baloo2.woff2', size, 800)


def texto(size):
    return fuente('nunito.woff2', size, 850)


def fondo(W, H, seed=3, franja=None, luces=60):
    """Morado noche con brillo arriba, bombillos desenfocados y la franja tricolor."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    cx, cy = W * 0.5, H * 0.32
    r = np.sqrt(((xx - cx) / W) ** 2 + ((yy - cy) / H * (H / W) ** 0.5) ** 2)
    t = np.clip(r / 0.85, 0, 1)[..., None]
    c0, c1 = np.array([66, 34, 108.]), np.array([13, 8, 24.])
    img = c0 * (1 - t) + c1 * t
    base = Image.fromarray(img.astype(np.uint8)).convert('RGBA')
    # luces de la guirnalda (bokeh)
    rnd = random.Random(seed)
    bok = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(bok)
    cols = [(255, 211, 77), (255, 90, 90), (90, 209, 255), (125, 255, 122), (255, 154, 60)]
    for i in range(luces):
        x, y = rnd.uniform(0, W), rnd.uniform(0, H) ** 1.0
        rr = rnd.uniform(0.01, 0.035) * W
        a = int(rnd.uniform(25, 70) * (1.2 - y / H))
        d.ellipse((x - rr, y - rr, x + rr, y + rr), fill=cols[i % 5] + (max(0, a),))
    base.alpha_composite(bok.filter(ImageFilter.GaussianBlur(W * 0.006)))
    if franja:
        base.alpha_composite(tricolor(W, H, *franja))
    return base


def tricolor(W, H, y, ang, grosor):
    """Franja amarilla (doble), azul y roja en diagonal, que cruza todo el ancho."""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    a = math.radians(ang)
    ux, uy, nx, ny = math.cos(a), math.sin(a), -math.sin(a), math.cos(a)
    off = 0.0
    L = W * 2
    for col, w in ((AMARILLO, 2), (AZUL, 1), (ROJO, 1)):
        o0, o1 = off, off + w * grosor
        pts = [(W / 2 + ux * s + nx * o, y + uy * s + ny * o) for s, o in ((-L, o0), (L, o0), (L, o1), (-L, o1))]
        d.polygon(pts, fill=col + (255,))
        off = o1
    return lay


def centrado(img, txt, fnt, y, color, sombra=True):
    d = ImageDraw.Draw(img)
    w = d.textlength(txt, font=fnt)
    x = (img.size[0] - w) / 2
    if sombra:
        sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((x, y + fnt.size * 0.06), txt, font=fnt, fill=(0, 0, 0, 150))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(fnt.size * 0.05)))
    d.text((x, y), txt, font=fnt, fill=color)
    return d.textbbox((x, y), txt, font=fnt)


def ajustar(fn, txt, size, max_w):
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    while size > 30 and d.textlength(txt, font=fn(size)) > max_w:
        size -= 2
    return fn(size)


def capturas():
    """Capturas ordenadas por número: [(clave, ruta)]."""
    out = []
    for p in sorted(glob.glob(os.path.join(OUT, 'capturas', 'telefono-*.png'))):
        clave = os.path.basename(p)[len('telefono-'):-4].split('-', 1)[1]
        out.append((clave, p))
    return out


def store():
    out_dir = os.path.join(OUT, 'publicidad')
    os.makedirs(out_dir, exist_ok=True)
    W, H = 1080, 1920
    for i, (clave, ruta) in enumerate(capturas(), start=1):
        t1, t2 = TEXTS.get(clave, ('Juegos de Colombia', 'tejo, billar, parqués y dominó'))
        img = fondo(W, H, seed=i, franja=(H * 0.80, -14, 26))
        # la franja pequeña de la app, arriba del título
        d = ImageDraw.Draw(img)
        fx = (W - 180) / 2
        d.rounded_rectangle((fx, 70, fx + 180, 82), radius=6, fill=AMARILLO)
        d.rectangle((fx + 90, 70, fx + 135, 82), fill=AZUL)
        d.rounded_rectangle((fx + 135, 70, fx + 180, 82), radius=6, fill=ROJO)
        d.rectangle((fx + 135, 70, fx + 150, 82), fill=ROJO)
        bb = centrado(img, t1, ajustar(titulo, t1, 104, W - 90), 98, ORO)
        bb2 = centrado(img, t2, ajustar(texto, t2, 46, W - 110), bb[3] + 14, (236, 228, 255))
        ph = gp.phone(Image.open(ruta).convert('RGB'), 700)
        top = bb2[3] + 60
        if top + ph.size[1] > H - 40:
            s = (H - 40 - top) / ph.size[1]
            ph = ph.resize((int(ph.size[0] * s), int(ph.size[1] * s)), Image.LANCZOS)
        shadow, pad = gp.glow_shadow(ph.size, color=ORO, alpha=120)
        x = (W - ph.size[0]) // 2
        img.alpha_composite(shadow, (x - pad, top - pad))
        img.alpha_composite(ph, (x, top))
        img.convert('RGB').save(os.path.join(out_dir, f'tienda-{i}.png'), optimize=True)
        print(f'  -> juegos/publicidad/tienda-{i}.png')


def telefono_girado(ruta, ancho, ang):
    ph = gp.phone(Image.open(ruta).convert('RGB'), ancho)
    return ph.rotate(ang, resample=Image.BICUBIC, expand=True)


def feature():
    S = 2
    W, H = 1024 * S, 500 * S
    img = fondo(W, H, seed=9, franja=(H * 0.80, -12, 15 * S), luces=40)
    shots = dict(capturas())
    # tres celulares a la derecha: billar y dominó atrás, el tejo adelante
    for clave, ancho, ang, cx, cy in (('billar-bola8', 190 * S, -9, 0.625, 0.57), ('domino', 190 * S, 9, 0.935, 0.57),
                                      ('tejo-apunta', 226 * S, 0, 0.785, 0.55)):
        if clave not in shots:
            continue
        ph = telefono_girado(shots[clave], ancho, ang)
        sh = Image.new('RGBA', (ph.size[0] + 120 * S, ph.size[1] + 120 * S), (0, 0, 0, 0))
        sh.paste((0, 0, 0, 170), (60 * S, 70 * S), ph.getchannel('A'))
        sh = sh.filter(ImageFilter.GaussianBlur(22 * S))
        x, y = int(W * cx - ph.size[0] / 2), int(H * cy - ph.size[1] / 2)
        img.alpha_composite(sh, (x - 60 * S, y - 60 * S))
        img.alpha_composite(ph, (x, y))
    d = ImageDraw.Draw(img)
    x0 = 56 * S
    # franja pequeña
    d.rounded_rectangle((x0, 92 * S, x0 + 120 * S, 100 * S), radius=4 * S, fill=AMARILLO)
    d.rectangle((x0 + 60 * S, 92 * S, x0 + 90 * S, 100 * S), fill=AZUL)
    d.rounded_rectangle((x0 + 90 * S, 92 * S, x0 + 120 * S, 100 * S), radius=4 * S, fill=ROJO)
    d.rectangle((x0 + 90 * S, 92 * S, x0 + 100 * S, 100 * S), fill=ROJO)
    f1 = titulo(92 * S)
    for txt, y, col in (('Juegos de', 112 * S, (255, 255, 255)), ('Colombia', 190 * S, ORO)):
        sh = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).text((x0, y + 6 * S), txt, font=f1, fill=(0, 0, 0, 160))
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(5 * S)))
        ImageDraw.Draw(img).text((x0, y), txt, font=f1, fill=col)
    d = ImageDraw.Draw(img)
    d.text((x0 + 4 * S, 300 * S), 'Tejo, billar, parqués y dominó', font=texto(28 * S), fill=(236, 228, 255))
    d.text((x0 + 4 * S, 346 * S), 'de 1 a 4 jugadores · sin internet', font=texto(26 * S), fill=(255, 211, 77))
    img.convert('RGB').resize((1024, 500), Image.LANCZOS).save(os.path.join(OUT, 'destacada-1024x500.png'), optimize=True)
    print('  -> juegos/destacada-1024x500.png')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if not capturas():
        raise SystemExit('Primero saca las capturas: node play-store/capturas_juegos.js <node_modules>')
    feature()
    store()
