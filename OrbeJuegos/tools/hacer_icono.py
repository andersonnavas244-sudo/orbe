"""Icono de Juegos de Colombia (sin el mundo): tejo dorado con la mecha explotando y bola de billar.

    python OrbeJuegos/tools/hacer_icono.py

Genera:
  app/src/main/res/mipmap-*/ic_launcher_bg.png   fondo morado noche con la franja amarilla, azul y roja
  app/src/main/res/mipmap-*/ic_launcher_fg.png   tejo, chispas y bola (capa delantera del icono adaptativo)
  play-store/juegos/icono-512.png                icono de Google Play
  play-store/juegos/vista-iconos.png             vista previa (redondo, cuadrado y pequeño)
Todo se dibuja en un lienzo de 108 x 108 "dp" (el del icono adaptativo); lo importante queda dentro
de la zona segura (66 dp al centro).
"""
import math
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', 'app', 'src', 'main')
PS = os.path.join(HERE, '..', '..', 'play-store', 'juegos')
DENS = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
SS = 4  # sobremuestreo para bordes suaves

AMARILLO, AZUL, ROJO = (252, 209, 22), (0, 56, 147), (206, 17, 38)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(len(a)))


def radial(size, center, radius, c0, c1):
    """Degradado radial de c0 (centro) a c1 (borde)."""
    w, h = size
    g = Image.radial_gradient('L').resize((int(radius * 2), int(radius * 2)), Image.BILINEAR)
    m = Image.new('L', size, 255)
    m.paste(g, (int(center[0] - radius), int(center[1] - radius)))
    a = Image.new('RGB', size, c0)
    b = Image.new('RGB', size, c1)
    return Image.composite(b, a, m)


class Lienzo:
    """Lienzo cuadrado de N px con coordenadas en dp (0..108) y zoom alrededor del centro."""

    def __init__(self, px, zoom=1.0, oy=0.0):
        self.N = px * SS
        self.k = self.N / 108 * zoom
        self.zoom = zoom
        self.oy = oy

    def p(self, x, y):
        return ((x - 54) * self.k + self.N / 2, (y - 54 + self.oy) * self.k + self.N / 2)

    def s(self, v):
        return v * self.k

    def box(self, cx, cy, rx, ry):
        x, y = self.p(cx, cy)
        return (x - self.s(rx), y - self.s(ry), x + self.s(rx), y + self.s(ry))


def fondo(L):
    """Morado noche con un brillo al centro y la franja tricolor en diagonal."""
    N = L.N
    img = radial((N, N), L.p(52, 44), L.s(80), (78, 40, 128), (21, 11, 42))
    # franja tricolor (2:1:1 como la bandera), en diagonal detrás del tejo
    band = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(band)
    ang = math.radians(-24)
    ux, uy = math.cos(ang), math.sin(ang)          # a lo largo de la franja
    nx, ny = -uy, ux                                # perpendicular
    cx, cy = 54, 76
    off = -9.0
    for col, w in ((AMARILLO, 8.0), (AZUL, 4.0), (ROJO, 4.0)):
        a0, a1 = off, off + w
        pts = []
        for (t, o) in ((-90, a0), (90, a0), (90, a1), (-90, a1)):
            pts.append(L.p(cx + ux * t + nx * o, cy + uy * t + ny * o))
        d.polygon(pts, fill=col + (255,))
        off = a1
    # la franja se funde un poco hacia los bordes para que no compita con el tejo
    m = Image.new('L', (N, N), 0)
    ImageDraw.Draw(m).ellipse(L.box(54, 70, 62, 46), fill=235)
    m = m.filter(ImageFilter.GaussianBlur(L.s(10)))
    band.putalpha(ImageChops.multiply(band.getchannel('A'), m))
    img = img.convert('RGBA')
    img.alpha_composite(band)
    # viñeta suave
    v = radial((N, N), L.p(54, 54), L.s(86), (0, 0, 0), (0, 0, 0))
    vm = Image.radial_gradient('L').resize((int(L.s(160)), int(L.s(160))))
    vm = vm.point(lambda x: max(0, x - 150) * 1.4)
    vmask = Image.new('L', (N, N), 255)
    vmask.paste(vm, (int(L.p(54, 54)[0] - L.s(80)), int(L.p(54, 54)[1] - L.s(80))))
    img = Image.composite(v.convert('RGBA'), img, vmask.point(lambda x: int(x * 0.55)))
    return img


def estallido(L, img, cx, cy):
    """La mecha explotando: destello, rayos y chispas."""
    N = L.N
    glow = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse(L.box(cx, cy, 20, 17), fill=(255, 150, 40, 120))
    glow = glow.filter(ImageFilter.GaussianBlur(L.s(7)))
    img.alpha_composite(glow)
    # estrella de rayos (dos capas: naranja y amarilla clara)
    rnd = random.Random(7)
    for (R0, R1, col, n, rot) in ((6.0, 21.5, (255, 116, 26, 255), 12, 0.13), (4.4, 14.5, (255, 226, 90, 255), 12, 0.39)):
        pts = []
        for i in range(n * 2):
            a = rot + i * math.pi / n
            r = R1 * (0.78 + 0.32 * rnd.random()) if i % 2 == 0 else R0
            pts.append(L.p(cx + math.cos(a) * r, cy + math.sin(a) * r * 0.92))
        lay = Image.new('RGBA', (N, N), (0, 0, 0, 0))
        ImageDraw.Draw(lay).polygon(pts, fill=col)
        img.alpha_composite(lay)
    core = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(core).ellipse(L.box(cx, cy, 5.8, 5.1), fill=(255, 255, 235, 255))
    img.alpha_composite(core.filter(ImageFilter.GaussianBlur(L.s(0.9))))
    # chispas: trazos que salen del centro con una bolita en la punta
    sp = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sp)
    for i in range(11):
        a = -math.pi * 0.95 + i * (math.pi * 1.25 / 10) + rnd.uniform(-0.08, 0.08)
        r0, r1 = rnd.uniform(16.5, 19), rnd.uniform(22, 26)
        x0, y0 = cx + math.cos(a) * r0, cy + math.sin(a) * r0 * 0.92
        x1, y1 = cx + math.cos(a) * r1, cy + math.sin(a) * r1 * 0.92
        sd.line([L.p(x0, y0), L.p(x1, y1)], fill=(255, 214, 90, 255), width=max(1, int(L.s(1.3))))
        sd.ellipse(L.box(x1, y1, 1.1, 1.1), fill=(255, 245, 200, 255))
    glow2 = sp.filter(ImageFilter.GaussianBlur(L.s(1.6)))
    img.alpha_composite(glow2)
    img.alpha_composite(sp)


def tejo(L, img, cx, cy, rx, ry, th):
    """Tejo dorado (disco metálico) visto en perspectiva."""
    N = L.N
    # sombra en el suelo
    sh = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse(L.box(cx + 2, cy + th + 3, rx * 1.02, ry * 0.9), fill=(5, 0, 15, 150))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(L.s(2.2))))
    # costado (de oro oscuro a claro)
    side = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    sd = ImageDraw.Draw(side)
    x0, y0 = L.p(cx - rx, cy)
    x1, y1 = L.p(cx + rx, cy + th)
    sd.rectangle((x0, y0, x1, y1), fill=(255, 255, 255, 255))
    sd.ellipse(L.box(cx, cy + th, rx, ry), fill=(255, 255, 255, 255))
    grad = Image.new('RGBA', (N, N))
    gd = ImageDraw.Draw(grad)
    for xi in range(int(x0), int(x1) + 1):
        t = (xi - x0) / max(1, x1 - x0)
        lum = 0.55 + 0.45 * math.sin(math.pi * (0.15 + 0.7 * t)) ** 2
        c = lerp((120, 70, 8), (235, 170, 40), lum)
        gd.line([(xi, 0), (xi, N)], fill=c + (255,))
    img.alpha_composite(Image.composite(grad, Image.new('RGBA', (N, N), (0, 0, 0, 0)), side.getchannel('A')))
    # cara de arriba
    top = Image.new('L', (N, N), 0)
    ImageDraw.Draw(top).ellipse(L.box(cx, cy, rx, ry), fill=255)
    face = radial((N, N), L.p(cx - rx * 0.3, cy - ry * 0.5), L.s(rx * 1.5), (255, 236, 150), (214, 140, 22)).convert('RGBA')
    fd = ImageDraw.Draw(face)
    # aros grabados
    fd.ellipse(L.box(cx, cy, rx * 0.80, ry * 0.80), outline=(170, 100, 10, 255), width=max(1, int(L.s(1.0))))
    fd.ellipse(L.box(cx, cy + 0.25, rx * 0.80, ry * 0.80), outline=(255, 240, 170, 200), width=max(1, int(L.s(0.5))))
    fd.ellipse(L.box(cx, cy, rx * 0.42, ry * 0.42), fill=(200, 128, 18, 255))
    fd.ellipse(L.box(cx - 0.4, cy - 0.3, rx * 0.36, ry * 0.36), fill=(240, 186, 60, 255))
    img.alpha_composite(Image.composite(face, Image.new('RGBA', (N, N), (0, 0, 0, 0)), top))
    # brillo del borde
    rim = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(rim).arc(L.box(cx, cy, rx - 0.6, ry - 0.4), 190, 330, fill=(255, 250, 215, 230), width=max(1, int(L.s(1.1))))
    img.alpha_composite(rim)


def bola(L, img, cx, cy, r, col=(232, 22, 34)):
    """Bola de billar roja, brillante (como la de carambola)."""
    N = L.N
    sh = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse(L.box(cx + 1.5, cy + r * 0.92, r * 0.95, r * 0.32), fill=(5, 0, 15, 170))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(L.s(1.6))))
    m = Image.new('L', (N, N), 0)
    ImageDraw.Draw(m).ellipse(L.box(cx, cy, r, r), fill=255)
    body = radial((N, N), L.p(cx - r * 0.35, cy - r * 0.4), L.s(r * 1.7), lerp(col, (255, 255, 255), 0.22), lerp(col, (0, 0, 0), 0.6)).convert('RGBA')
    # luz de borde abajo a la derecha (reflejo de la cancha)
    bd = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(bd).arc(L.box(cx, cy, r * 0.9, r * 0.9), 20, 110, fill=(255, 120, 120, 150), width=max(1, int(L.s(1.2))))
    body.alpha_composite(bd.filter(ImageFilter.GaussianBlur(L.s(0.8))))
    img.alpha_composite(Image.composite(body, Image.new('RGBA', (N, N), (0, 0, 0, 0)), m))
    hl = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse(L.box(cx - r * 0.38, cy - r * 0.42, r * 0.26, r * 0.19), fill=(255, 255, 255, 240))
    img.alpha_composite(hl.filter(ImageFilter.GaussianBlur(L.s(0.5))))
    hl2 = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    ImageDraw.Draw(hl2).ellipse(L.box(cx - r * 0.22, cy - r * 0.25, r * 0.55, r * 0.45), fill=(255, 255, 255, 50))
    img.alpha_composite(hl2.filter(ImageFilter.GaussianBlur(L.s(2))))


def frente(L):
    """Capa delantera: chispas, tejo y bola (fondo transparente)."""
    img = Image.new('RGBA', (L.N, L.N), (0, 0, 0, 0))
    estallido(L, img, 44, 45)
    tejo(L, img, 44, 61, 23, 9.6, 6.2)
    bola(L, img, 74, 70, 11.5)
    return img


def render(px, zoom=1.0, oy=0.0, partes=('bg', 'fg')):
    L = Lienzo(px, zoom, oy)
    out = Image.new('RGBA', (L.N, L.N), (0, 0, 0, 0))
    if 'bg' in partes:
        out = fondo(L)
    if 'fg' in partes:
        out.alpha_composite(frente(L))
    return out.resize((px, px), Image.LANCZOS)


def circle(img):
    m = Image.new('L', img.size, 0)
    ImageDraw.Draw(m).ellipse((0, 0, img.size[0] - 1, img.size[1] - 1), fill=255)
    out = img.convert('RGBA')
    out.putalpha(m)
    return out


def main():
    for dens, px in DENS.items():
        d = os.path.join(APP, 'res', 'mipmap-' + dens)
        os.makedirs(d, exist_ok=True)
        render(px, partes=('bg',)).convert('RGB').save(os.path.join(d, 'ic_launcher_bg.png'), optimize=True)
        render(px, partes=('fg',)).save(os.path.join(d, 'ic_launcher_fg.png'), optimize=True)
    # Google Play muestra el cuadrado completo (con esquinas redondeadas): el dibujo más grande
    os.makedirs(PS, exist_ok=True)
    render(512, zoom=1.3, oy=-1).convert('RGB').save(os.path.join(PS, 'icono-512.png'), optimize=True)
    # vista previa: lo que se ve en el teléfono (zona visible del icono adaptativo: 72 de 108 dp)
    big = render(432)
    vis = big.crop((72, 72, 360, 360)).resize((240, 240), Image.LANCZOS)
    prev = Image.new('RGBA', (1030, 320), (232, 232, 238, 255))
    prev.alpha_composite(circle(vis), (40, 40))
    sq = vis.convert('RGBA')
    m = Image.new('L', sq.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 239, 239), radius=52, fill=255)
    sq.putalpha(m)
    prev.alpha_composite(sq, (320, 40))
    prev.alpha_composite(circle(vis.resize((96, 96), Image.LANCZOS)), (600, 112))
    prev.alpha_composite(circle(vis.resize((48, 48), Image.LANCZOS)), (720, 136))
    play = Image.open(os.path.join(PS, 'icono-512.png')).convert('RGBA').resize((240, 240), Image.LANCZOS)
    pm = Image.new('L', (240, 240), 0)
    ImageDraw.Draw(pm).rounded_rectangle((0, 0, 239, 239), radius=46, fill=255)
    play.putalpha(pm)
    prev.alpha_composite(play, (770, 40))
    prev.convert('RGB').save(os.path.join(PS, 'vista-iconos.png'))
    print('iconos listos')


if __name__ == '__main__':
    main()
