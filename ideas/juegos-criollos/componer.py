"""Une las 3 capturas (tejo, bolo, billar) en una imagen de presentación con celulares."""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
FUENTES = r'C:\Windows\Fonts'


def fuente(nombre, tam):
    for n in nombre:
        p = os.path.join(FUENTES, n)
        if os.path.exists(p):
            return ImageFont.truetype(p, tam)
    return ImageFont.load_default()


W, H = 2400, 1780
fondo = Image.new('RGB', (W, H))
d = ImageDraw.Draw(fondo)
for y in range(H):  # degradado noche
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(22 + 10 * t), int(12 + 6 * t), int(44 + 14 * t)))

JUEGOS = [('tejo', 'Tejo', (255, 150, 40)), ('bolo', 'Bolo criollo', (255, 120, 70)), ('billar', 'Billar a 3 bandas', (60, 225, 175))]
ALTO = 1250
ancho = int(ALTO * 1170 / 2532)
BISEL = 24
paso = ancho + 2 * BISEL + 110
x0 = (W - (3 * (ancho + 2 * BISEL) + 2 * 110)) // 2
Y0 = 300

brillo = Image.new('RGB', (W, H), (0, 0, 0))
db = ImageDraw.Draw(brillo)
for i, (_, _, col) in enumerate(JUEGOS):
    cx = x0 + i * paso + ancho // 2 + BISEL
    db.ellipse([cx - 420, Y0 + 120, cx + 420, Y0 + ALTO - 60], fill=tuple(int(c * 0.55) for c in col))
brillo = brillo.filter(ImageFilter.GaussianBlur(160))
fondo = Image.fromarray(np.clip(np.asarray(fondo, dtype='int16') + np.asarray(brillo, dtype='int16'), 0, 255).astype('uint8'))
d = ImageDraw.Draw(fondo)

titulo = fuente(['seguibl.ttf', 'segoeuib.ttf'], 104)
sub = fuente(['segoeuib.ttf', 'segoeui.ttf'], 46)
etiqueta = fuente(['seguibl.ttf', 'segoeuib.ttf'], 50)
t = 'Juegos criollos en 3D'
d.text(((W - d.textlength(t, font=titulo)) / 2, 70), t, font=titulo, fill=(255, 211, 77))
s = 'Para jugar en el celular con amigos y familia'
d.text(((W - d.textlength(s, font=sub)) / 2, 200), s, font=sub, fill=(230, 222, 255))

for i, (clave, nombre, col) in enumerate(JUEGOS):
    cap = Image.open(os.path.join(AQUI, f'captura-{clave}.png')).convert('RGB').resize((ancho, ALTO), Image.LANCZOS)
    x = x0 + i * paso
    sombra = Image.new('L', (W, H), 0)
    ImageDraw.Draw(sombra).rounded_rectangle([x + 10, Y0 + 30, x + ancho + 2 * BISEL + 10, Y0 + ALTO + 2 * BISEL + 30], 90, fill=170)
    sombra = sombra.filter(ImageFilter.GaussianBlur(30))
    fondo.paste((5, 3, 12), (0, 0), sombra)
    d = ImageDraw.Draw(fondo)
    d.rounded_rectangle([x, Y0, x + ancho + 2 * BISEL, Y0 + ALTO + 2 * BISEL], 86, fill=(12, 12, 14), outline=(70, 70, 82), width=3)
    mascara = Image.new('L', (ancho, ALTO), 0)
    ImageDraw.Draw(mascara).rounded_rectangle([0, 0, ancho - 1, ALTO - 1], 64, fill=255)
    fondo.paste(cap, (x + BISEL, Y0 + BISEL), mascara)
    d.rounded_rectangle([x + BISEL + ancho // 2 - 70, Y0 + BISEL + 14, x + BISEL + ancho // 2 + 70, Y0 + BISEL + 46], 16, fill=(0, 0, 0))
    tw = d.textlength(nombre, font=etiqueta)
    cx = x + BISEL + ancho // 2
    d.text((cx - tw / 2, Y0 + ALTO + 2 * BISEL + 34), nombre, font=etiqueta, fill=col)

salida = os.path.join(AQUI, 'juegos-criollos-3d.jpg')
fondo.save(salida, quality=93)
for clave, _, _ in JUEGOS:
    Image.open(os.path.join(AQUI, f'captura-{clave}.png')).convert('RGB').save(os.path.join(AQUI, f'{clave}-3d.jpg'), quality=92)
print(salida)
