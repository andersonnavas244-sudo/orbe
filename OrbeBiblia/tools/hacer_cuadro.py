"""Prepara la imagen de Jesús sosteniendo la Tierra (hecha con IA) para Orbe Biblia:
el planeta 3D de la app gira exactamente sobre el globo de la imagen, y las manos de Jesús quedan por delante.

    python OrbeBiblia/tools/hacer_cuadro.py "OrbeBiblia/arte/Jesús Sosteniendo la Tierra Luminosa.png"

Genera en app/src/main/assets/www/:
  img/jesus.jpg        la imagen (1080 px de ancho)
  img/jesus-manos.png  (opcional, MANOS = True) las manos que van DELANTE del planeta
  data/cuadro.json     dónde va el planeta y la capa de las manos (fracciones del ancho y del alto)
"""
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
WWW = os.path.join(HERE, '..', 'app', 'src', 'main', 'assets', 'www')
# Globo de la imagen original: centro (fracción del ancho y del alto) y radio (fracción del ancho)
GLOBO = dict(x=0.4885, y=0.6164, r=0.262)   # un poco más pequeño que el globo pintado: se ven las puntas de los dedos
# Capa de manos por delante: en esta imagen no hace falta (las manos quedan debajo del globo)
MANOS = False


def largest_parts(mask, keep=2, min_px=400):
    """Deja solo las manchas grandes (las dos manos) y quita puntitos sueltos."""
    h, w = mask.shape
    seen = np.zeros_like(mask, bool)
    parts = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        q, pix = deque([(y0, x0)]), []
        seen[y0, x0] = True
        while q:
            y, x = q.popleft()
            pix.append((y, x))
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < h and 0 <= xx < w and mask[yy, xx] and not seen[yy, xx]:
                    seen[yy, xx] = True
                    q.append((yy, xx))
        if len(pix) >= min_px:
            parts.append(pix)
    parts.sort(key=len, reverse=True)
    out = np.zeros_like(mask, bool)
    for pix in parts[:keep]:
        ys, xs = zip(*pix)
        out[list(ys), list(xs)] = True
    return out


def main(src):
    im = Image.open(src).convert('RGB')
    W = 1080
    H = round(im.size[1] * W / im.size[0])
    im = im.resize((W, H), Image.LANCZOS)
    im.save(os.path.join(WWW, 'img', 'jesus.jpg'), quality=90, optimize=True, progressive=True)
    meta = dict(img='img/jesus.jpg', ratio=round(H / W, 4), globo=dict(GLOBO))
    if MANOS:
        a = np.asarray(im, np.float32)
        yy, xx = np.mgrid[0:H, 0:W]
        cx, cy, r = GLOBO['x'] * W, GLOBO['y'] * H, GLOBO['r'] * W
        inside = ((xx - cx) ** 2 + (yy - cy) ** 2) <= (r * 1.04) ** 2
        low = yy > cy + r * 0.45
        R, G, B = a[..., 0], a[..., 1], a[..., 2]
        # piel con luz dorada: cálida (rojo > verde > azul) y no blanca como las nubes
        skin = (R > 175) & (G > 115) & (R - B > 55) & (G - B > 18) & (R - G > 12)
        m = inside & low & skin
        m = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(7))
                       .filter(ImageFilter.MinFilter(3))) > 127
        m = largest_parts(m, keep=2, min_px=int(W * 0.8))
        mk = Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.GaussianBlur(1.4))
        hands = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        hands.paste(im, (0, 0), mk)
        hands.putalpha(mk)
        bbox = mk.getbbox()
        if bbox:
            hands.crop(bbox).save(os.path.join(WWW, 'img', 'jesus-manos.png'), optimize=True)
            meta['manos'] = dict(img='img/jesus-manos.png', x=round(bbox[0] / W, 4), y=round(bbox[1] / H, 4),
                                 w=round((bbox[2] - bbox[0]) / W, 4), h=round((bbox[3] - bbox[1]) / H, 4))
    with open(os.path.join(WWW, 'data', 'cuadro.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f)
    print('imagen', (W, H), meta)


if __name__ == '__main__':
    main(sys.argv[1])
