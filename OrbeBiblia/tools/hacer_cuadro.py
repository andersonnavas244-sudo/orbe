"""Prepara el «Salvator Mundi» de Leonardo da Vinci (c. 1500, dominio público) para Orbe Biblia:
Jesús sostiene en la mano el planeta 3D de la app en lugar de la esfera de cristal original.

    python OrbeBiblia/tools/hacer_cuadro.py ruta/al/salvator.jpg

Fuente: Wikimedia Commons, «Leonardo da Vinci, Salvator Mundi, c.1500, oil on walnut, 45.4 × 65.6 cm.jpg» (Public domain).
Genera en app/src/main/assets/www/img/:
  salvator.jpg         el cuadro (1080 px de ancho)
Y en data/cuadro.json la posición del planeta (centro y radio en fracciones del cuadro), que usa js/biblia.js.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'app', 'src', 'main', 'assets', 'www', 'img')
ORBE = dict(x=0.824, y=0.853, r=0.139)   # centro (fracción del ancho y del alto) y radio (fracción del ancho)


def main(src):
    im = Image.open(src).convert('RGB')
    W = 1080
    H = round(im.size[1] * W / im.size[0])
    im = im.resize((W, H), Image.LANCZOS)
    im.save(os.path.join(OUT, 'salvator.jpg'), quality=88, optimize=True, progressive=True)
    # El planeta se apoya sobre los dedos de Jesús (sin recortar la mano).
    # (un poco más grande que la esfera para que luzca en el celular; la base queda sobre los dedos)
    base = ORBE['y'] - 0.06 * ORBE['r'] * W / H + ORBE['r'] * 0.90 * W / H
    gr = ORBE['r'] * 1.10
    gy = base - gr * W / H
    meta = dict(esfera=ORBE, globo=dict(x=ORBE['x'], y=round(gy, 4), r=round(gr, 4)), ratio=round(H / W, 4))
    import json
    with open(os.path.join(OUT, '..', 'data', 'cuadro.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f)
    print('cuadro', (W, H), meta)


if __name__ == '__main__':
    main(sys.argv[1])
