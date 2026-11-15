"""Icono de Orbe Biblia hecho con la imagen de Jesús sosteniendo la Tierra (arte/).

    python OrbeBiblia/tools/hacer_icono.py "OrbeBiblia/arte/Jesús Sosteniendo la Tierra Luminosa.png"

Genera:
  app/src/main/res/mipmap-*/ic_launcher_bg.png   la imagen (icono adaptativo de Android, todas las densidades)
  app/src/main/res/mipmap-*/ic_launcher_fg.png   capa delantera vacía (todo va en el fondo)
  app/src/main/assets/www/img/icono.png          icono redondo de la cabecera y la pantalla de carga
  play-store/biblia/icono-512.png                icono de Google Play
  play-store/biblia/vista-iconos.png             vista previa (redondo, cuadrado y pequeño)
El dibujo importante (la cara y la Tierra) queda dentro de la zona segura del icono adaptativo (66 de 108 dp).
"""
import os
import sys

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'src', 'main')
PS = os.path.join(HERE, '..', '..', 'play-store', 'biblia')
DENS = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
# Parte de la imagen con Jesús y la Tierra (fracciones del alto): desde el cabello hasta las manos
TOP, BOTTOM = 0.055, 0.80


def compose(src, size, content):
    """Lienzo cuadrado: la imagen desenfocada de fondo y Jesús con la Tierra al centro (content = fracción del alto)."""
    im = Image.open(src).convert('RGB')
    W, H = im.size
    crop = im.crop((0, int(TOP * H), W, int(BOTTOM * H)))
    S = size * 3
    # fondo: la misma imagen, ampliada, desenfocada y un poco más oscura
    bg = im.copy()
    k = max(S / W, S / H) * 1.25
    bg = bg.resize((int(W * k), int(H * k)), Image.LANCZOS)
    cy = int(0.33 * bg.size[1])
    bg = bg.crop(((bg.size[0] - S) // 2, max(0, cy - S // 2), (bg.size[0] - S) // 2 + S, max(0, cy - S // 2) + S))
    bg = ImageEnhance.Brightness(bg.filter(ImageFilter.GaussianBlur(S * 0.03))).enhance(0.75)
    # Jesús con la Tierra, centrado, con los bordes fundidos
    ch = int(S * content)
    cw = int(crop.size[0] * ch / crop.size[1])
    fg = crop.resize((cw, ch), Image.LANCZOS)
    mask = Image.new('L', (cw, ch), 0)
    ImageDraw.Draw(mask).rectangle((int(cw * 0.06), int(ch * 0.03), int(cw * 0.94), int(ch * 0.97)), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(cw * 0.05))
    bg.paste(fg, ((S - cw) // 2, (S - ch) // 2), mask)
    return bg.resize((size, size), Image.LANCZOS)


def circle(img):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, img.size[0] - 1, img.size[1] - 1), fill=255)
    out = img.convert('RGBA')
    out.putalpha(m)
    return out


def main(src):
    for dens, px in DENS.items():
        d = os.path.join(APP, 'res', 'mipmap-' + dens)
        os.makedirs(d, exist_ok=True)
        # en el icono adaptativo solo se ve el centro (72 de 108 dp): el contenido ocupa ~64 % del lienzo
        compose(src, px, 0.64).save(os.path.join(d, 'ic_launcher_bg.png'), optimize=True)
        Image.new('RGBA', (px, px), (0, 0, 0, 0)).save(os.path.join(d, 'ic_launcher_fg.png'), optimize=True)
    # Google Play muestra el cuadrado completo (con esquinas redondeadas): Jesús más grande
    os.makedirs(PS, exist_ok=True)
    compose(src, 512, 0.98).save(os.path.join(PS, 'icono-512.png'), optimize=True)
    circle(compose(src, 256, 0.96)).save(os.path.join(APP, 'assets', 'www', 'img', 'icono.png'), optimize=True)
    # vista previa: lo que se ve en el teléfono (zona visible del icono adaptativo)
    big = compose(src, 432, 0.64)
    vis = big.crop((72, 72, 360, 360)).resize((240, 240), Image.LANCZOS)
    prev = Image.new('RGBA', (760, 320), (36, 44, 66, 255))
    prev.alpha_composite(circle(vis), (40, 40))
    sq = vis.convert('RGBA')
    m = Image.new('L', sq.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 239, 239), radius=52, fill=255)
    sq.putalpha(m)
    prev.alpha_composite(sq, (320, 40))
    prev.alpha_composite(circle(vis.resize((144, 144), Image.LANCZOS)), (590, 88))
    prev.convert('RGB').save(os.path.join(PS, 'vista-iconos.png'))
    print('iconos listos')


if __name__ == '__main__':
    main(sys.argv[1])
