"""Iconos realistas de las apps (los que se ven en el teléfono y en la TV).

Crea, para Orbe Radio y Orbe TV, el icono adaptativo de Android en todas las densidades:
  app/src/main/res/mipmap-<densidad>/ic_launcher_fg.png   (planeta + ondas / televisor)
  app/src/main/res/mipmap-<densidad>/ic_launcher_bg.png   (espacio con estrellas)
y además www/img/icono.png (pantalla de carga) y play-store/<app>/vista-iconos.png (vista previa).

Estilo sobrio: Tierra nítida iluminada de frente (sin resplandores fuertes), pocos puntos de
emisoras/canales y ondas/marco limpios, para que se lea bien en tamaño pequeño.
El dibujo importante queda dentro de la zona segura (66 de 108 dp) para cualquier máscara.

    python play-store/generar_iconos_app.py
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

import generar_graficos as gg

ROOT = gg.ROOT
DENS = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
PROJ = {'radio': 'RadioOrbe', 'tv': 'OrbeTV', 'sismos': 'OrbeSismos', 'espacio': 'OrbeEspacio', 'clima': 'OrbeClima', 'podcasts': 'OrbePodcasts'}
PODCASTS_APP = {'www': os.path.join(ROOT, 'OrbePodcasts', 'app', 'src', 'main', 'assets', 'www'), 'title': 'Orbe Podcasts'}
CLIMA_APP = {'www': os.path.join(ROOT, 'OrbeClima', 'app', 'src', 'main', 'assets', 'www'), 'title': 'Orbe Clima'}
ESPACIO_APP = {'www': os.path.join(ROOT, 'OrbeEspacio', 'app', 'src', 'main', 'assets', 'www'), 'title': 'Orbe Espacio'}
SISMOS_APP = {'www': os.path.join(ROOT, 'OrbeSismos', 'app', 'src', 'main', 'assets', 'www'), 'title': 'Orbe Sismos'}
# Iluminación casi frontal (se ve casi toda la Tierra de día), sol arriba a la derecha
SUN_FRONT = (0.38, 0.30, 0.87)


def sober_earth(fg, xx, yy, app, cx, cy, R):
    return gg.earth(fg, xx, yy, app['www'], cx, cy, R, lat0=12, lon0=-62, sun=SUN_FRONT,
                    halo_k=16, spec=0.28, spec_pow=140, rim_k=0.55, halo_a=0.45, cloud_a=0.6, night_a=1.2)


def few_dots(fg, app, cx, cy, R, view, size, k):
    lite = dict(app, max_dots=600)
    out, _, _ = gg.dots(fg, lite, cx, cy, R, view, size=max(0.9, 0.8 * k), blur=max(1, 1.2 * k), glow=0.35, core=0.55)
    return out


def iss_layer(W, cx, cy, span, ang):
    """Estación Espacial Internacional (8 alas solares doradas) como capa RGBA nítida."""
    u = span / 100.0                       # 1 unidad = 1/100 del ancho de la estación
    L = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    ox, oy = cx - 50 * u, cy - 30 * u
    box = lambda x0, y0, x1, y1: (ox + x0 * u, oy + y0 * u, ox + x1 * u, oy + y1 * u)
    # Panel solar: degradado dorado con celdas
    pw, ph = max(4, int(10.5 * u)), max(8, int(21 * u))
    g = np.linspace(0, 1, ph)[:, None]
    top, mid, bot = np.array([246, 200, 112.]), np.array([190, 124, 34.]), np.array([96, 60, 12.])
    col = np.where(g < 0.5, top + (mid - top) * (g / 0.5), mid + (bot - mid) * ((g - 0.5) / 0.5))
    panel = np.repeat(col[:, None, :], pw, axis=1).reshape(ph, pw, 3)
    step = max(2, int(2.4 * u))
    panel[::step, :, :] *= 0.55
    panel[:, ::step, :] *= 0.55
    sheen = np.clip(1 - np.abs(np.arange(pw)[None, :] / pw - np.arange(ph)[:, None] / ph * 0.6 - 0.15) / 0.18, 0, 1)[..., None] * 40
    panel = np.clip(panel + sheen, 0, 255)
    pimg = Image.fromarray(np.dstack([panel, np.full((ph, pw), 255.)]).astype(np.uint8), 'RGBA')
    d = ImageDraw.Draw(L)
    d.rectangle(box(6, 28.4, 94, 31.6), fill=(212, 218, 230, 255))
    for x in (8, 19.5, 69, 80.5):
        for y in (5, 34):
            L.alpha_composite(pimg, (int(ox + x * u), int(oy + y * u)))
        d.rectangle(box(x + 4.6, 26, x + 5.9, 34), fill=(200, 208, 222, 255))
    for x in (33, 63):
        d.rectangle(box(x, 20, x + 4, 40), fill=(238, 242, 248, 255))
    d.rounded_rectangle(box(40, 22, 60, 38), radius=int(4 * u), fill=(214, 220, 232, 255), outline=(110, 118, 134, 255), width=max(1, int(0.6 * u)))
    d.rounded_rectangle(box(47.5, 10, 52.5, 50), radius=int(2.5 * u), fill=(236, 240, 246, 255), outline=(110, 118, 134, 255), width=max(1, int(0.6 * u)))
    d.ellipse(box(47.8, 27.8, 52.2, 32.2), fill=(150, 170, 200, 255))
    return L.rotate(ang, resample=Image.BICUBIC, center=(cx, cy))


def hurricane_layer(W, H, ex, ey, R, k):
    """Huracán: brazos de nubes en espiral (giro antihorario, hemisferio norte) con ojo bien marcado."""
    lay = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(lay)
    for arm in range(3):
        base = arm * 2 * np.pi / 3
        prev = None
        for th in np.linspace(0, 2.1 * np.pi, 220):
            r = R * 0.05 * np.exp(0.36 * th)
            if r > R * 0.52:
                break
            ang = base + th
            x, y = ex + r * np.cos(ang), ey - r * np.sin(ang) * 0.9
            if prev:
                f = th / (2.1 * np.pi)
                w = max(2, int(R * (0.13 - 0.1 * f)))
                d.line((prev[0], prev[1], x, y), fill=int(255 * (1 - 0.55 * f)), width=w)
            prev = (x, y)
    r = R * 0.13
    d.ellipse((ex - r, ey - r * 0.9, ex + r, ey + r * 0.9), fill=255)
    lay = lay.filter(ImageFilter.GaussianBlur(R * 0.018))
    eye = Image.new('L', (W, H), 0)
    re_ = R * 0.038
    ImageDraw.Draw(eye).ellipse((ex - re_, ey - re_, ex + re_, ey + re_), fill=255)
    eye = eye.filter(ImageFilter.GaussianBlur(R * 0.01))
    a = np.asarray(lay, np.float32) / 255.0
    return a * (1 - np.asarray(eye, np.float32) / 255.0 * 0.9)


def mic_layer(W, cx, cy, h):
    """Micrófono de estudio metálico (cápsula con rejilla, aro y pie) como capa RGBA."""
    L = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    u = h / 100.0
    bw, bh = 46 * u, 62 * u                      # cápsula
    x0, y0 = cx - bw / 2, cy - h / 2
    # cápsula: degradado metálico horizontal
    cap = np.zeros((int(bh), int(bw), 4), np.float32)
    gx = np.linspace(-1, 1, int(bw))[None, :]
    shade = 0.55 + 0.45 * np.cos(gx * 1.35) + 0.25 * np.exp(-((gx + 0.45) ** 2) / 0.02)
    base = np.array([196, 204, 222.])
    cap[..., :3] = np.clip(base * shade[..., None], 0, 255)
    cap[..., 3] = 255
    capi = Image.fromarray(cap.astype(np.uint8), 'RGBA')
    m = Image.new('L', capi.size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, capi.size[0] - 1, capi.size[1] - 1), radius=int(bw / 2), fill=255)
    capi.putalpha(m)
    # rejilla
    gr = Image.new('RGBA', capi.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(gr)
    step = max(3, int(4.2 * u))
    for yy in range(int(bh * 0.08), int(bh * 0.62), step):
        d.line((0, yy, capi.size[0], yy), fill=(40, 46, 64, 150), width=max(1, int(1.1 * u)))
    for xx in range(0, capi.size[0], step):
        d.line((xx, int(bh * 0.08), xx, int(bh * 0.62)), fill=(40, 46, 64, 110), width=max(1, int(0.9 * u)))
    gm = Image.new('L', capi.size, 0)
    ImageDraw.Draw(gm).rounded_rectangle((int(bw * 0.06), int(bh * 0.04), int(bw * 0.94), int(bh * 0.64)), radius=int(bw * 0.44), fill=255)
    gr.putalpha(Image.fromarray((np.asarray(gr.split()[3], np.float32) * np.asarray(gm, np.float32) / 255).astype(np.uint8)))
    capi.alpha_composite(gr)
    # banda central rosa
    d2 = ImageDraw.Draw(capi)
    d2.rectangle((0, int(bh * 0.66), capi.size[0], int(bh * 0.74)), fill=(255, 110, 175, 255))
    capi.putalpha(Image.fromarray(np.minimum(np.asarray(capi.split()[3]), np.asarray(m)).astype(np.uint8)))
    L.alpha_composite(capi, (int(x0), int(y0)))
    d = ImageDraw.Draw(L)
    # aro (horquilla) y pie
    ring_w = max(3, int(5 * u))
    d.arc((cx - 34 * u, cy - h / 2 + 20 * u, cx + 34 * u, cy - h / 2 + 88 * u), 0, 180, fill=(170, 178, 198, 255), width=ring_w)
    d.rectangle((cx - 3.5 * u, cy - h / 2 + 88 * u, cx + 3.5 * u, cy + h / 2 - 6 * u), fill=(150, 158, 178, 255))
    d.rounded_rectangle((cx - 22 * u, cy + h / 2 - 8 * u, cx + 22 * u, cy + h / 2), radius=int(4 * u), fill=(120, 128, 150, 255))
    # brillo vertical
    hl = Image.new('L', (W, W), 0)
    ImageDraw.Draw(hl).rounded_rectangle((x0 + bw * 0.18, y0 + bh * 0.08, x0 + bw * 0.3, y0 + bh * 0.9), radius=int(bw * 0.06), fill=95)
    hl = hl.filter(ImageFilter.GaussianBlur(2 * u))
    white = Image.new('RGBA', (W, W), (255, 255, 255, 0)); white.putalpha(hl)
    L.alpha_composite(white)
    return L


def render_layers(key, app, size):
    """Devuelve (fondo RGB, primer plano RGBA) de size x size (lienzo de 108 dp)."""
    S = 2
    W = H = size * S
    k = S * size / 216
    cx = cy = W // 2
    bg, xx, yy = gg.space(W, H, cx, cy, seed=5, stars=900)
    bg *= 0.9
    fg = np.zeros((H, W, 3), np.float32)

    if key == 'sismos':
        # Tierra + ondas sísmicas saliendo de un epicentro en los Andes colombianos
        R = int(W * 0.25)
        fg, view = sober_earth(fg, xx, yy, app, cx, cy, R)
        LAT0, LON0 = view
        la, lo = np.radians(3.5), np.radians(-76.0) - LON0
        x_, y_, z_ = np.cos(la) * np.sin(lo), np.sin(la), np.cos(la) * np.cos(lo)
        vy = y_ * np.cos(LAT0) - z_ * np.sin(LAT0)
        ex, ey = cx + x_ * R, cy - vy * R

        def quake(d):
            for i, (rr, col) in enumerate([(0.10, (230, 20, 50)), (0.20, (240, 50, 50)), (0.31, (245, 90, 40)), (0.43, (240, 130, 40))]):
                r = R * rr
                d.ellipse((ex - r, ey - r * 0.8, ex + r, ey + r * 0.8), outline=col, width=max(2, int((3.4 - i * 0.6) * k)))
            r = R * 0.035
            d.ellipse((ex - r, ey - r, ex + r, ey + r), fill=(255, 59, 78))
        fg = gg.glow_layer(fg, quake, 2.5 * k, glow=0.3)
    elif key == 'podcasts':
        # La Tierra con un micrófono de estudio delante y ondas de sonido de colores
        ecx, ecy = int(W * 0.42), int(H * 0.44)
        R = int(W * 0.2)
        fg, view = sober_earth(fg, xx, yy, app, ecx, ecy, R)
        mx, my, mh = W * 0.6, H * 0.6, W * 0.3

        def waves(d):
            cy0 = my - mh * 0.2
            for i, (rr, col) in enumerate(((0.115, (255, 122, 182)), (0.155, (176, 107, 255)), (0.195, (92, 225, 255)))):
                r = W * rr
                for a0, a1 in ((-50, 50), (130, 230)):
                    d.arc((mx - r, cy0 - r, mx + r, cy0 + r), a0, a1, fill=col, width=max(2, int((4.4 - i * 0.6) * k)))
        fg = gg.glow_layer(fg, waves, 2.2 * k, glow=0.3)
        mic = mic_layer(W, mx, my, mh)
        ia = np.asarray(mic, np.float32)
        a = ia[..., 3:4] / 255.0
        fg = fg * (1 - a) + ia[..., :3] * a
        shape_mask = ia[..., 3] > 8
    elif key == 'clima':
        # Tierra con un huracán sobre el Caribe y corrientes de viento alrededor
        R = int(W * 0.24)
        fg, view = sober_earth(fg, xx, yy, app, cx, cy, R)
        LAT0, LON0 = view
        la, lo = np.radians(24.0), np.radians(-70.0) - LON0
        x_, y_, z_ = np.cos(la) * np.sin(lo), np.sin(la), np.cos(la) * np.cos(lo)
        vy = y_ * np.cos(LAT0) - z_ * np.sin(LAT0)
        ex, ey = cx + x_ * R, cy - vy * R
        hur = hurricane_layer(W, H, ex, ey, R, k)[..., None]
        fg = fg * (1 - hur * 0.92) + np.array([248, 251, 255.]) * hur * 0.92

        def winds(d):
            # Dos corrientes de viento que abrazan el planeta (sin cruzar su cara)
            for (rr, t0, t1, col, wd) in ((1.2, 118, 232, (110, 225, 255), 3.4), (1.2, 298, 412, (120, 240, 215), 3.4)):
                t = np.radians(np.linspace(t0, t1, 140))
                X, Y = cx + R * rr * np.cos(t), cy - R * rr * np.sin(t)
                pts = list(zip(X, Y))
                for i in range(len(pts) - 1):
                    f = i / len(pts)
                    c = tuple(int(v * (0.25 + 0.75 * f)) for v in col)
                    d.line((pts[i], pts[i + 1]), fill=c, width=max(2, int(wd * k * (0.35 + 0.65 * f))))
                x1, y1 = pts[-1]; x0, y0 = pts[-5]
                ang2 = np.arctan2(y1 - y0, x1 - x0)
                L = 11 * k
                d.polygon([(x1 + np.cos(ang2) * L * 0.7, y1 + np.sin(ang2) * L * 0.7),
                           (x1 + np.cos(ang2 + 2.45) * L, y1 + np.sin(ang2 + 2.45) * L),
                           (x1 + np.cos(ang2 - 2.45) * L, y1 + np.sin(ang2 - 2.45) * L)], fill=col)
        fg = gg.glow_layer(fg, winds, 2.0 * k, glow=0.25)
    elif key == 'espacio':
        # Tierra, una órbita inclinada con satélites y la Estación Espacial arriba a la derecha
        ecx, ecy = int(W * 0.45), int(H * 0.57)
        R = int(W * 0.205)
        fg, view = sober_earth(fg, xx, yy, app, ecx, ecy, R)
        rx, ry, rot = W * 0.31, W * 0.1, np.radians(-21)
        # puntos del anillo (delante / detrás de la Tierra)
        t = np.linspace(0, 2 * np.pi, 1400)
        px_, py_ = rx * np.cos(t), ry * np.sin(t)
        X = ecx + px_ * np.cos(rot) - py_ * np.sin(rot)
        Y = ecy + px_ * np.sin(rot) + py_ * np.cos(rot)
        behind = (np.sin(t) < 0) & ((X - ecx) ** 2 + (Y - ecy) ** 2 < (R * 1.01) ** 2)

        def ring(d):
            pts = list(zip(X, Y))
            for i in range(len(pts) - 1):
                if behind[i] or behind[i + 1]:
                    continue
                front = np.sin(t[i]) >= 0
                c = (120, 232, 255) if front else (70, 150, 200)
                d.line((pts[i], pts[i + 1]), fill=c, width=max(2, int((3.0 if front else 2.0) * k)))
            for tt, rr in ((2.25, 4.2), (0.55, 3.4), (3.9, 3.0)):
                x0 = ecx + rx * np.cos(tt) * np.cos(rot) - ry * np.sin(tt) * np.sin(rot)
                y0 = ecy + rx * np.cos(tt) * np.sin(rot) + ry * np.sin(tt) * np.cos(rot)
                r = rr * k
                d.ellipse((x0 - r, y0 - r, x0 + r, y0 + r), fill=(255, 230, 160))
        fg = gg.glow_layer(fg, ring, 2.2 * k, glow=0.28)
        # la Estación sobre el anillo, arriba a la derecha
        tt = -0.62
        sx = ecx + rx * np.cos(tt) * np.cos(rot) - ry * np.sin(tt) * np.sin(rot)
        sy = ecy + rx * np.cos(tt) * np.sin(rot) + ry * np.sin(tt) * np.cos(rot)
        sx, sy = min(sx, W * 0.6), max(sy - W * 0.06, H * 0.36)
        iss = iss_layer(W, sx, sy, W * 0.255, 21)
        ia = np.asarray(iss, np.float32)
        a = ia[..., 3:4] / 255.0
        fg = fg * (1 - a) + ia[..., :3] * a
        shape_mask = ia[..., 3] > 8
    elif key == 'radio':
        R = int(W * 0.215)
        fg, view = sober_earth(fg, xx, yy, app, cx, cy, R)
        fg = few_dots(fg, app, cx, cy, R, view, size, k)
        fg = gg.waves(fg, cx, cy, R, k, both=True, radii=(1.2, 1.38), glow=0.45, width=4)
    else:
        # Televisor: marco oscuro tipo aluminio con borde de color fino, pantalla negra y la Tierra dentro
        x0, x1 = int(W * 0.235), int(W * 0.765)
        y0, y1 = int(H * 0.315), int(H * 0.715)
        img = Image.new('RGB', (W, H))
        d = ImageDraw.Draw(img)
        d.line((W * 0.43, H * 0.235, W * 0.5, y0), fill=(150, 160, 185), width=max(2, int(3 * k)))
        d.line((W * 0.57, H * 0.235, W * 0.5, y0), fill=(150, 160, 185), width=max(2, int(3 * k)))
        d.ellipse((W * 0.43 - 3 * k, H * 0.235 - 3 * k, W * 0.43 + 3 * k, H * 0.235 + 3 * k), fill=(255, 79, 163))
        d.ellipse((W * 0.57 - 3 * k, H * 0.235 - 3 * k, W * 0.57 + 3 * k, H * 0.235 + 3 * k), fill=(34, 211, 238))
        d.rounded_rectangle((x0, y0, x1, y1), radius=int(W * 0.05), fill=(46, 52, 70))
        bez = int(9 * k)
        d.rounded_rectangle((x0 + bez, y0 + bez, x1 - bez, y1 - bez), radius=int(W * 0.03), fill=(2, 4, 10))
        d.rounded_rectangle((W * 0.42, y1, W * 0.58, y1 + 7 * k), radius=int(3 * k), fill=(70, 78, 100))
        d.rounded_rectangle((W * 0.36, y1 + 7 * k, W * 0.64, y1 + 12 * k), radius=int(3 * k), fill=(90, 98, 122))
        fg = np.asarray(img, np.float32).copy()
        shape_mask = fg.sum(axis=2) > 0          # partes sólidas del televisor (opacas)
        # brillo metálico del marco (degradado vertical suave)
        frame_mask = np.zeros((H, W), bool)
        frame_mask[y0:y1, x0:x1] = True
        shade = np.clip(1.25 - (yy - y0) / (y1 - y0) * 0.5, 0.75, 1.25)[..., None]
        fg = np.where(frame_mask[..., None] & (fg.sum(axis=2, keepdims=True) > 60), fg * shade, fg)
        # borde de color fino (cian → rosa)
        m = Image.new('L', (W, H), 0)
        ImageDraw.Draw(m).rounded_rectangle((x0, y0, x1, y1), radius=int(W * 0.05), outline=255, width=max(2, int(2.5 * k)))
        mk = np.asarray(m, np.float32)[..., None] / 255.0
        gx = np.clip((xx - x0) / (x1 - x0), 0, 1)[..., None]
        edge = gg.CYAN * (1 - gx) + gg.PINK * gx
        fg = fg * (1 - mk) + edge * mk
        glow = np.asarray(Image.fromarray((edge * mk).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4 * k)), np.float32)
        fg = np.clip(fg + glow * 0.35, 0, 255)
        # la Tierra en la pantalla
        R = int((y1 - y0 - 2 * bez) * 0.43)
        ecx, ecy = cx, (y0 + y1) // 2
        screen = np.zeros_like(fg)
        screen, view = sober_earth(screen, xx, yy, app, ecx, ecy, R)
        screen = few_dots(screen, app, ecx, ecy, R, view, size, k)
        inner = np.zeros((H, W), bool)
        inner[y0 + bez:y1 - bez, x0 + bez:x1 - bez] = True
        fg = np.where(inner[..., None], np.clip(fg + screen, 0, 255), fg)
        # reflejo diagonal sutil sobre la pantalla
        refl = np.clip(1 - np.abs((xx - x0) - (yy - y0) * 1.6 - (x1 - x0) * 0.15) / ((x1 - x0) * 0.18), 0, 1) * 14
        fg = np.where(inner[..., None], np.clip(fg + refl[..., None], 0, 255), fg)

    lum = fg.max(axis=2)
    alpha = np.clip(lum / 30.0, 0, 1) * 255
    if key == 'tv':
        alpha = np.maximum(alpha, (shape_mask | inner) * 255)
    if key in ('espacio', 'podcasts'):
        alpha = np.maximum(alpha, shape_mask * 255)
    fg_img = Image.fromarray(np.dstack([np.clip(fg, 0, 255), alpha]).astype(np.uint8), 'RGBA')
    bg_img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8))
    return bg_img.resize((size, size), Image.LANCZOS), fg_img.resize((size, size), Image.LANCZOS)


def masked_preview(bg, fg, shape):
    """Simula cómo se ve con la máscara del teléfono (círculo o cuadrado redondeado)."""
    s = bg.size[0]
    full = bg.convert('RGBA')
    full.alpha_composite(fg)
    vis = int(s * 72 / 108)
    off = (s - vis) // 2
    crop = full.crop((off, off, off + vis, off + vis))
    m = Image.new('L', (vis, vis), 0)
    d = ImageDraw.Draw(m)
    if shape == 'circle':
        d.ellipse((0, 0, vis - 1, vis - 1), fill=255)
    else:
        d.rounded_rectangle((0, 0, vis - 1, vis - 1), radius=int(vis * 0.22), fill=255)
    crop.putalpha(m)
    return crop


if __name__ == '__main__':
    import sys
    apps = dict(gg.APPS, sismos=SISMOS_APP, espacio=ESPACIO_APP, clima=CLIMA_APP, podcasts=PODCASTS_APP)
    only = sys.argv[1:]          # p. ej.: python generar_iconos_app.py sismos
    for key, app in apps.items():
        if only and key not in only:
            continue
        gg._tex_cache.clear()
        res = os.path.join(ROOT, PROJ[key], 'app', 'src', 'main', 'res')
        print(app['title'])
        big_bg = big_fg = None
        for dens, px in DENS.items():
            bg, fg = render_layers(key, app, px)
            d = os.path.join(res, 'mipmap-' + dens)
            os.makedirs(d, exist_ok=True)
            bg.save(os.path.join(d, 'ic_launcher_bg.png'), optimize=True)
            fg.save(os.path.join(d, 'ic_launcher_fg.png'), optimize=True)
            big_bg, big_fg = bg, fg
            print('  ', dens, px, 'px')
        # Icono 512 para Google Play: zona visible del icono (72 de 108 dp) a pantalla completa
        pbg, pfg = render_layers(key, app, 768)
        full = pbg.convert('RGBA'); full.alpha_composite(pfg)
        os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), key), exist_ok=True)
        full.crop((128, 128, 640, 640)).convert('RGB').save(os.path.join(os.path.dirname(os.path.abspath(__file__)), key, 'icono-512.png'), optimize=True)
        splash = masked_preview(big_bg, big_fg, 'circle').resize((256, 256), Image.LANCZOS)
        splash.save(os.path.join(app['www'], 'img', 'icono.png'), optimize=True)
        # Vista previa en tamaño real de pantalla de inicio (y ampliada)
        prev = Image.new('RGBA', (760, 320), (36, 44, 66, 255))
        prev.alpha_composite(masked_preview(big_bg, big_fg, 'circle').resize((240, 240), Image.LANCZOS), (40, 40))
        prev.alpha_composite(masked_preview(big_bg, big_fg, 'square').resize((240, 240), Image.LANCZOS), (320, 40))
        small = masked_preview(big_bg, big_fg, 'circle').resize((144, 144), Image.LANCZOS)
        prev.alpha_composite(small, (590, 88))
        prev.convert('RGB').save(os.path.join(os.path.dirname(os.path.abspath(__file__)), key, 'vista-iconos.png'))
