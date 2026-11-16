"""Videos publicitarios de las apps Orbe: 1 min 30 s, vertical 1080x1920, 30 fps, con voz, música y subtítulos.

    python play-store/videos/hacer_videos.py [sismos radio tv espacio clima podcasts]

Sale en play-store/<app>/video/orbe-<app>-90s.mp4 (+ portada.png). Sirve para TikTok, Reels, Shorts,
estados de WhatsApp y anuncios. Todo se genera aquí: la voz es la de Windows (voz.ps1), la música se
sintetiza con numpy (sin derechos de autor de terceros) y las imágenes son capturas reales de la app.
"""
import hashlib
import importlib
import math
import os
import re
import subprocess
import sys
import wave

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
PS = os.path.dirname(HERE)
sys.path.insert(0, PS)
import generar_graficos as gg  # noqa: E402
import generar_publicidad as gp  # noqa: E402
from guiones import APPS, MUSICA  # noqa: E402

import imageio_ffmpeg  # noqa: E402

W, H, FPS = 1080, 1920, 30
TOTAL = 90.0
SR = 44100
PRE, GAP = 0.45, 0.75           # silencio antes y después de cada narración
CACHE = os.path.join(HERE, 'cache')
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
PINK, CYAN = (255, 79, 163), (34, 211, 238)
FB, FS = gp.FONT_B, gp.FONT_S


# =====================================================================
#  Voz
# =====================================================================
def tts(key, text, voz, rate):
    os.makedirs(os.path.join(CACHE, key), exist_ok=True)
    h = hashlib.sha1(f'{voz}|{rate:.3f}|{text}'.encode()).hexdigest()[:12]
    wav = os.path.join(CACHE, key, f'voz-{h}.wav')
    if not os.path.exists(wav):
        txt = wav[:-4] + '.txt'
        with open(txt, 'w', encoding='utf-8') as f:
            f.write(text)
        subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', os.path.join(HERE, 'voz.ps1'),
                        '-Texto', txt, '-Salida', wav, '-Voz', voz, '-Velocidad', f'{rate:.3f}'], check=True, capture_output=True)
    with wave.open(wav) as w:
        sr, n = w.getframerate(), w.getnframes()
        a = np.frombuffer(w.readframes(n), np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2:
            a = a.reshape(-1, 2).mean(1)
    # recorta silencios de los extremos y pasa a 44,1 kHz
    nz = np.where(np.abs(a) > 0.01)[0]
    if len(nz):
        a = a[max(0, nz[0] - int(sr * 0.03)): nz[-1] + int(sr * 0.08)]
    t_new = np.arange(int(len(a) * SR / sr)) / SR
    return np.interp(t_new, np.arange(len(a)) / sr, a).astype(np.float32)


def plan_voices(key, cfg):
    rate = 1.06
    for _ in range(4):
        voices = [tts(key, e['n'], cfg['voz'], rate) for e in cfg['escenas']]
        durs = [PRE + len(v) / SR + GAP for v in voices]
        durs[-1] = max(durs[-1], 9.0)                       # el cierre se queda en pantalla
        total = sum(durs)
        if total > TOTAL - 0.5:
            rate = min(1.45, rate * total / (TOTAL - 2.0))
        elif total < TOTAL - 7 and rate > 0.96:
            rate = max(0.95, rate * total / (TOTAL - 4.0))   # habla un poco más pausado
        else:
            break
    extra = TOTAL - sum(durs)
    durs = [d + extra * (0.25 if i == len(durs) - 1 else 0.75 / (len(durs) - 1)) for i, d in enumerate(durs)]
    print(f'  voz {cfg["voz"]} a {rate:.2f}x · escenas: ' + ' '.join(f'{d:.1f}' for d in durs))
    return voices, durs


# =====================================================================
#  Música (sintetizada) y efectos
# =====================================================================
def spectral(x, lp=None, hp=None):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lp:
        g /= np.sqrt(1 + (f / lp) ** 4)
    if hp:
        g *= (f / hp) ** 2 / np.sqrt(1 + (f / hp) ** 4)
    return np.fft.irfft(X * g, len(x)).astype(np.float32)


def reverb(x, secs=1.8, mix=0.28, seed=3):
    rng = np.random.default_rng(seed)
    n = int(secs * SR)
    ir = rng.standard_normal(n).astype(np.float32) * np.exp(-np.linspace(0, 7, n)).astype(np.float32)
    ir = spectral(ir, lp=5000)
    ir /= np.sqrt((ir ** 2).sum())
    m = len(x) + n
    nfft = 1 << (m - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)]
    return (x * (1 - mix) + wet.astype(np.float32) * mix * 2.2).astype(np.float32)


INTERVALS = {'M': [0, 4, 7, 12], 'm': [0, 3, 7, 12], 'M7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'M9': [0, 4, 7, 11, 14], 'm9': [0, 3, 7, 10, 14]}


def music(style, total):
    st = MUSICA[style]
    beat = 60 / st['bpm']
    n = int(total * SR)
    L, R = np.zeros(n, np.float32), np.zeros(n, np.float32)
    t_all = np.arange(n) / SR
    rng = np.random.default_rng(7)
    chord_len = 8 * beat
    k = 0
    pad = np.zeros(n, np.float32)
    padR = np.zeros(n, np.float32)
    bass = np.zeros(n, np.float32)
    arp = np.zeros((2, n), np.float32)
    while k * chord_len < total:
        root, typ = st['chords'][k % len(st['chords'])]
        f0 = 110 * 2 ** (root / 12)
        a, b = int(k * chord_len * SR), min(n, int(((k + 1) * chord_len + 0.6) * SR))
        tt = t_all[a:b] - k * chord_len
        env = np.minimum(1, tt / 0.9) * np.minimum(1, np.maximum(0, (chord_len + 0.6 - tt) / 0.9))
        for iv in INTERVALS[typ]:
            fr = f0 * 2 * 2 ** (iv / 12)
            for det, side in ((-0.004, 0), (0.0, 2), (0.005, 1)):
                ff = fr * (1 + det)
                w = sum(np.sin(2 * np.pi * ff * h * tt + h) / h for h in (1, 2, 3, 4)) * 0.5
                if side in (0, 2):
                    pad[a:b] += (w * env).astype(np.float32)
                if side in (1, 2):
                    padR[a:b] += (w * env).astype(np.float32)
        # bajo: raíz grave en los tiempos 1 y 3 (o sostenido en los estilos lentos)
        fb = f0 / 2
        for j in range(0, 8, 2 if st['beat'] in ('pop', 'cumbia') else 4):
            s0 = int((k * chord_len + j * beat) * SR)
            ln = int((2 if st['beat'] in ('pop', 'cumbia') else 4) * beat * SR)
            seg = np.arange(min(ln, n - s0)) / SR
            if s0 >= n:
                break
            bass[s0:s0 + len(seg)] += np.sin(2 * np.pi * fb * seg) * np.exp(-seg * (2.2 if st['beat'] in ('pop', 'cumbia') else 0.5)) * np.minimum(1, seg / 0.01)
        # arpegio brillante (corcheas), alternando izquierda y derecha
        if st['beat'] in ('pop', 'suave', 'calma', 'cumbia'):
            notes = [f0 * 4 * 2 ** (iv / 12) for iv in INTERVALS[typ]]
            step = beat / 2
            for j in range(16):
                s0 = int((k * chord_len + j * step) * SR)
                if s0 >= n:
                    break
                fr = notes[(j * 2 + (j // 4)) % len(notes)]
                seg = np.arange(min(int(1.2 * SR), n - s0)) / SR
                pl = np.sin(2 * np.pi * fr * seg) * np.exp(-seg * (5 if st['beat'] in ('pop', 'cumbia') else 2.5)) * np.minimum(1, seg / 0.004)
                arp[j % 2, s0:s0 + len(seg)] += pl.astype(np.float32)
        k += 1
    pad, padR = spectral(pad, lp=2400), spectral(padR, lp=2400)
    L += pad * 0.055
    R += padR * 0.055
    L += bass * 0.16
    R += bass * 0.16
    arp = np.stack([spectral(arp[0], lp=6000), spectral(arp[1], lp=6000)])
    L += arp[0] * 0.035 + arp[1] * 0.015
    R += arp[1] * 0.035 + arp[0] * 0.015

    # percusión (entra después de la portada)
    drums = np.zeros(n, np.float32)
    hats = np.zeros(n, np.float32)
    start = 4 * beat
    nb = int(total / beat)
    for j in range(nb):
        t0 = j * beat
        if t0 < start or t0 > total - 3 * beat:
            continue
        s0 = int(t0 * SR)
        if st['beat'] == 'pop':
            seg = np.arange(int(0.35 * SR)) / SR
            kick = np.sin(2 * np.pi * (48 * seg + 60 * (1 - np.exp(-seg * 30)) / 30)) * np.exp(-seg * 9)
            drums[s0:s0 + len(seg)] += kick[:n - s0] * 0.9
            if j % 2 == 1:
                seg = np.arange(int(0.2 * SR)) / SR
                clap = rng.standard_normal(len(seg)) * np.exp(-seg * 22)
                drums[s0:s0 + len(seg)] += spectral(clap.astype(np.float32), lp=4000, hp=900)[:n - s0] * 0.35
            for half in (0, 0.5):
                s1 = int((t0 + half * beat) * SR)
                seg = np.arange(int(0.06 * SR)) / SR
                hat = rng.standard_normal(len(seg)) * np.exp(-seg * 70)
                hats[s1:s1 + len(seg)] += hat[:max(0, n - s1)] * (0.5 if half else 0.3)
        elif st['beat'] == 'latido':
            if j % 4 == 0:   # latido doble, grave
                for off, amp in ((0, 1.0), (0.28, 0.7)):
                    s1 = int((t0 + off * beat) * SR)
                    seg = np.arange(int(0.4 * SR)) / SR
                    th = np.sin(2 * np.pi * (40 * seg + 35 * (1 - np.exp(-seg * 25)) / 25)) * np.exp(-seg * 8)
                    drums[s1:s1 + len(seg)] += th[:max(0, n - s1)] * amp
            for q in range(4):   # tic-tac de reloj, muy suave
                s1 = int((t0 + q * beat / 4) * SR)
                seg = np.arange(int(0.03 * SR)) / SR
                tick = rng.standard_normal(len(seg)) * np.exp(-seg * 120)
                hats[s1:s1 + len(seg)] += tick[:max(0, n - s1)] * (0.35 if q == 0 else 0.15)
        elif st['beat'] == 'cumbia':   # bombo en 1 y 3, guacharaca en corcheas (larga-corta) y llamador a contratiempo
            if j % 2 == 0:
                seg = np.arange(int(0.4 * SR)) / SR
                kick = np.sin(2 * np.pi * (52 * seg + 55 * (1 - np.exp(-seg * 28)) / 28)) * np.exp(-seg * 8)
                drums[s0:s0 + len(seg)] += kick[:n - s0] * 0.85
            seg = np.arange(int(0.16 * SR)) / SR      # llamador (tambor seco y agudo) en el contratiempo
            s1 = int((t0 + 0.5 * beat) * SR)
            tom = np.sin(2 * np.pi * 190 * seg) * np.exp(-seg * 30) + rng.standard_normal(len(seg)) * np.exp(-seg * 60) * 0.3
            drums[s1:s1 + len(seg)] += tom[:max(0, n - s1)] * 0.5
            for q, (ln, amp) in enumerate(((0.22, 0.55), (0.08, 0.3), (0.22, 0.5), (0.08, 0.3))):   # guacharaca
                s1 = int((t0 + q * beat / 4) * SR)
                seg = np.arange(int(ln * beat * SR)) / SR
                rasp = rng.standard_normal(len(seg)) * (0.6 + 0.4 * np.sin(2 * np.pi * 70 * seg)) * np.minimum(1, seg / 0.01) * np.exp(-seg * 14)
                hats[s1:s1 + len(seg)] += rasp[:max(0, n - s1)] * amp
        elif st['beat'] == 'calma':   # música para orar: sin percusión
            pass
        else:   # suave: solo un shaker
            for half in (0, 0.5):
                s1 = int((t0 + half * beat) * SR)
                seg = np.arange(int(0.08 * SR)) / SR
                sh = rng.standard_normal(len(seg)) * np.exp(-seg * 45)
                hats[s1:s1 + len(seg)] += sh[:max(0, n - s1)] * 0.18
    hats = spectral(hats, hp=6000)
    L += drums * 0.30 + hats * 0.08
    R += drums * 0.30 + hats * 0.08
    L, R = reverb(L, seed=3), reverb(R, seed=4)
    fade = np.minimum(1, t_all / 2.0) * np.minimum(1, np.maximum(0, (total - t_all) / 3.0))
    return np.stack([L * fade, R * fade])


def whoosh(dur=0.55, seed=1):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    x = rng.standard_normal(n).astype(np.float32)
    t = np.linspace(0, 1, n)
    env = np.sin(np.pi * t) ** 2
    return spectral(x, lp=3000, hp=250) * env.astype(np.float32) * 0.12


def boom(dur=2.4, seed=2):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.arange(n) / SR
    low = np.sin(2 * np.pi * (34 * t + 30 * (1 - np.exp(-t * 6)) / 6)) * np.exp(-t * 1.6)
    rumble = spectral(rng.standard_normal(n).astype(np.float32), lp=120) * np.exp(-t * 1.2) * 3
    return (low * 0.8 + rumble).astype(np.float32)


def riser(dur=2.5, seed=9):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    t = np.linspace(0, 1, n)
    noise = spectral(rng.standard_normal(n).astype(np.float32), hp=400)
    tone = np.sin(2 * np.pi * np.cumsum(180 + 900 * t ** 2) / SR)
    return ((noise * 0.10 + tone * 0.06) * t ** 2.2).astype(np.float32)


def mix_audio(key, cfg, voices, starts):
    n = int(TOTAL * SR)
    voice = np.zeros(n, np.float32)
    for v, s in zip(voices, starts):
        a = int((s + PRE) * SR)
        voice[a:a + len(v)] += v[:max(0, n - a)]
    voice *= 0.92 / max(1e-6, np.abs(voice).max())
    mus = music(cfg['musica'], TOTAL)
    # baja la música mientras se habla
    env = np.convolve(np.abs(voice), np.ones(int(0.25 * SR)) / int(0.25 * SR), mode='same')
    duck = 1 - 0.55 * np.clip(env / 0.04, 0, 1)
    duck = np.convolve(duck, np.ones(int(0.3 * SR)) / int(0.3 * SR), mode='same')
    mus *= (duck * 1.0)[None, :]
    mus *= 0.30 / max(1e-6, np.sqrt((mus ** 2).mean()) * 3.2)
    out = mus + voice[None, :]
    for s in starts[1:]:
        a = int(max(0, s - 0.3) * SR)
        w = whoosh(seed=int(s * 10))
        out[:, a:a + len(w)] += w[:max(0, n - a)]
    if cfg.get('golpes'):
        for i, s in enumerate(starts[1:], start=1):            # golpe grave en cada escena
            b = boom(dur=1.8, seed=10 + i)
            a = int(s * SR)
            out[:, a:a + len(b)] += b[:max(0, n - a)] * 0.32
    r = riser(2.6) * (1.0 if cfg.get('golpes') else 0.6)          # sube la emoción antes del cierre
    a = int(max(0, starts[-1] - 2.6) * SR)
    out[:, a:a + len(r)] += r[:max(0, n - a)]
    if cfg['musica'] == 'tension':
        b = boom()
        out[:, int(0.15 * SR):int(0.15 * SR) + len(b)] += b * 0.55
        c = int(starts[-1] * SR)
        b = boom(seed=5)
        out[:, c:c + len(b)] += b[:max(0, n - c)] * 0.35
    out *= 0.95 / max(1e-6, np.abs(out).max())
    path = os.path.join(CACHE, key, 'audio.wav')
    pcm = (np.clip(out.T, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path


# =====================================================================
#  Imágenes
# =====================================================================
def ease(x):
    x = min(1.0, max(0.0, x))
    return 1 - (1 - x) ** 3


def with_alpha(img, k):
    if k >= 0.999:
        return img
    im = img.copy()
    im.putalpha(im.getchannel('A').point(lambda v: int(v * k)))
    return im


def wrap(text, fnt, max_w, balance=True):
    """Parte el texto en líneas; con balance, las líneas quedan de largo parecido (sin una palabra sola abajo)."""
    lines = _wrap(text, fnt, max_w)
    if balance and len(lines) > 1:
        d = ImageDraw.Draw(Image.new('L', (1, 1)))
        best, best_score = lines, None
        for w in range(int(max_w), int(max_w * 0.5), -20):
            ls = _wrap(text, fnt, w)
            if len(ls) != len(lines):
                break
            lens = [d.textlength(x, font=fnt) for x in ls]
            score = max(lens) - min(lens)
            if best_score is None or score < best_score:
                best, best_score = ls, score
        return best
    return lines


def _wrap(text, fnt, max_w):
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    lines, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=fnt) <= max_w or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def grad_text(text, fnt, c1, c2, glow=0.55):
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    l, t, r, b = d.textbbox((0, 0), text, font=fnt)
    pad = 40
    w, h = r - l + 2 * pad, b - t + 2 * pad
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).text((pad - l, pad - t), text, font=fnt, fill=255)
    gx = np.linspace(0, 1, w)[None, :, None]
    col = (np.array(c1)[None, None, :] * (1 - gx) + np.array(c2)[None, None, :] * gx).repeat(h, 0)
    rgb = Image.fromarray(col.astype(np.uint8))
    g = m.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * glow))
    out = Image.new('RGBA', (w, h))
    gl = rgb.copy()
    gl.putalpha(g)
    out.alpha_composite(gl)
    tx = rgb.copy()
    tx.putalpha(m)
    out.alpha_composite(tx)
    return out, pad


def plain_text(text, fnt, fill=(232, 238, 250), shadow=True):
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    l, t, r, b = d.textbbox((0, 0), text, font=fnt)
    pad = 16
    im = Image.new('RGBA', (r - l + 2 * pad, b - t + 2 * pad))
    if shadow:
        s = Image.new('L', im.size, 0)
        ImageDraw.Draw(s).text((pad - l, pad - t + 3), text, font=fnt, fill=200)
        sh = Image.new('RGBA', im.size, (0, 0, 0, 0))
        sh.putalpha(s.filter(ImageFilter.GaussianBlur(5)))
        im.alpha_composite(sh)
    ImageDraw.Draw(im).text((pad - l, pad - t), text, font=fnt, fill=fill + (255,))
    return im, pad


def pill(text, fnt, bg, fg=(255, 255, 255), padx=26, pady=12):
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    l, t, r, b = d.textbbox((0, 0), text, font=fnt)
    w, h = r - l + 2 * padx, b - t + 2 * pady
    im = Image.new('RGBA', (w, h))
    ImageDraw.Draw(im).rounded_rectangle((0, 0, w - 1, h - 1), radius=h // 2, fill=bg)
    ImageDraw.Draw(im).text((padx - l, pady - t), text, font=fnt, fill=fg)
    return im


def caption_img(text):
    fnt = gg.font(FS, 46)
    lines = wrap(text, fnt, 900)
    d = ImageDraw.Draw(Image.new('L', (1, 1)))
    lh = 60
    w = int(max(d.textlength(x, font=fnt) for x in lines)) + 56
    h = lh * len(lines) + 36
    im = Image.new('RGBA', (w, h))
    dr = ImageDraw.Draw(im)
    dr.rounded_rectangle((0, 0, w - 1, h - 1), radius=26, fill=(6, 9, 20, 200))
    for i, x in enumerate(lines):
        tw = d.textlength(x, font=fnt)
        dr.text(((w - tw) / 2, 14 + i * lh), x, font=fnt, fill=(255, 255, 255))
    return im


def caption_chunks(text):
    parts = [p.strip() for p in re.split(r'(?<=[.?!])\s+', text) if p.strip()]
    out = []
    for p in parts:
        if len(p) <= 64:
            out.append(p)
            continue
        cur = ''
        for piece in re.split(r'(?<=,)\s+', p):
            if cur and len(cur) + len(piece) > 64:
                out.append(cur)
                cur = piece
            else:
                cur = (cur + ' ' + piece).strip()
        if cur:
            out.append(cur)
    return out


class Clip:
    """Toma grabada del globo 3D real de la app (JPG a 15 cuadros por segundo; se intercalan a 30)."""
    def __init__(self, folder, fps=15):
        import glob
        self.files = sorted(glob.glob(os.path.join(folder, '*.jpg')))
        self.fps, self.cache = fps, {}
        if not self.files:
            raise FileNotFoundError(f'No hay cuadros grabados en {folder} (corre grabar_globo_sismos.js)')

    def get(self, i):
        i = max(0, min(len(self.files) - 1, i))
        if i not in self.cache:
            if len(self.cache) > 8:
                self.cache.pop(next(iter(self.cache)))
            self.cache[i] = Image.open(self.files[i]).convert('RGB')
        return self.cache[i]

    def frame(self, u, size, loop=False):
        x = u * self.fps
        n = len(self.files) - 1
        if loop == 'bucle' and n > 0:             # se repite hacia adelante, con un fundido corto en la unión
            fade = min(12, n // 4)
            per = n + 1 - fade
            x = x % per
            if x < fade and u * self.fps >= per:
                a = x / fade
                return Image.blend(self.get(int(per + x)), self.get(int(x)), a).resize(size, Image.BILINEAR)
            return self.get(int(x)).resize(size, Image.BILINEAR)
        if loop and n > 0:                        # ida y vuelta, sin saltos
            x = x % (2 * n)
            x = 2 * n - x if x > n else x
        x = max(0.0, min(float(n), x))
        i0 = int(x)
        a = x - i0
        im = self.get(i0)
        if a > 0.04 and i0 < n:
            im = Image.blend(im, self.get(i0 + 1), a)
        return im.resize(size, Image.BILINEAR)


def tilt(img, ay, ax=0.0):
    """Gira la imagen en 3D (grados alrededor del eje vertical y del horizontal) con perspectiva."""
    w, h = img.size
    f = 2.4 * max(w, h)
    ry, rx = math.radians(ay), math.radians(ax)
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    dst = []
    for x, y in src:
        X, Y, Z = x - w / 2, y - h / 2, 0.0
        X, Z = X * math.cos(ry) + Z * math.sin(ry), -X * math.sin(ry) + Z * math.cos(ry)
        Y, Z = Y * math.cos(rx) - Z * math.sin(rx), Y * math.sin(rx) + Z * math.cos(rx)
        k = f / (f + Z)
        dst.append((w / 2 + X * k, h / 2 + Y * k))
    A, B = [], []
    for (x, y), (X, Y) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -X * x, -X * y])
        A.append([0, 0, 0, x, y, 1, -Y * x, -Y * y])
        B += [X, Y]
    c = np.linalg.solve(np.array(A, float), np.array(B, float))
    return img.transform((w, h), Image.PERSPECTIVE, tuple(c), Image.BILINEAR)


def vertical_shade(top_a=200, mid_a=90, bottom_a=210):
    """Sombra arriba y abajo para que los textos se lean sobre el globo en movimiento."""
    y = np.linspace(0, 1, H)[:, None]
    a = np.where(y < 0.5, top_a + (mid_a - top_a) * np.clip(y / 0.35, 0, 1), mid_a + (bottom_a - mid_a) * np.clip((y - 0.62) / 0.38, 0, 1))
    im = Image.new('RGBA', (W, H), (2, 3, 8, 0))
    im.putalpha(Image.fromarray(np.repeat(a, W, 1).astype(np.uint8)))
    return im


def red_vignette():
    yy, xx = np.mgrid[0:H, 0:W]
    r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    a = np.clip((r - 0.55) / 0.6, 0, 1) ** 1.6 * 255
    im = Image.new('RGBA', (W, H), (255, 30, 40, 0))
    im.putalpha(Image.fromarray(a.astype(np.uint8)))
    return im


class Video:
    def __init__(self, key, cfg):
        self.key, self.cfg = key, cfg
        self.epic = bool(cfg.get('epico'))
        self.tres_d = cfg.get('tres_d', True)       # celular en 3D y destellos en todas las apps
        self.clips, self.phone_geo = {}, {}
        self.white = Image.new('RGBA', (W, H), (255, 245, 235, 255))
        self.black = Image.new('RGBA', (W, H), (0, 0, 0, 255))
        self.black = Image.new('RGBA', (W, H), (0, 0, 0, 255))
        if cfg.get('clips_dir'):                    # clips del juego real grabados a 30 fps (grabar_juegos.js)
            folder = os.path.join(CACHE, cfg['clips_dir'])
            for name in os.listdir(folder):
                if os.path.isdir(os.path.join(folder, name)):
                    self.clips[name] = Clip(os.path.join(folder, name), fps=30)
            self.shade_soft = vertical_shade(150, 30, 120)
            self.shade_bottom = vertical_shade(0, 0, 235)
            self.blur_shade = vertical_shade(150, 95, 175)
        if self.epic:
            folder = os.path.join(CACHE, key, 'clips')
            for name in os.listdir(folder):
                self.clips[name] = Clip(os.path.join(folder, name))
            self.shade = vertical_shade()
            self.shade_soft = vertical_shade(170, 40, 190)
            self.shade_bottom = vertical_shade(0, 0, 235)
            self.vign = red_vignette()
        self.www = os.path.join(gg.ROOT, cfg['folder'], 'app', 'src', 'main', 'assets', 'www')
        ico = os.path.join(PS, cfg['icono']) if cfg.get('icono') else os.path.join(self.www, 'img', 'icono.png')
        self.icon = Image.open(ico).convert('RGBA')
        c = cfg['color']
        self.c1, self.c2 = (c, PINK) if c != PINK else (c, CYAN)
        self.bg = self.backdrop()

    # Fondo: espacio + la Tierra abajo (como la publicidad de la tienda), un poco más grande para moverlo
    def backdrop(self):
        os.makedirs(os.path.join(CACHE, self.key), exist_ok=True)
        path = os.path.join(CACHE, self.key, 'fondo.png')
        if os.path.exists(path):
            return Image.open(path).convert('RGBA')
        W2, H2 = 1200, 2134
        cx, cy, R = W2 // 2, int(H2 * 1.30), int(W2 * 0.93)
        if self.cfg.get('fondo') == 'juegos':      # Juegos de Colombia: sin el globo (fondo de fiesta de su ficha)
            import generar_juegos as gj
            im = gj.fondo(W2, H2, seed=5, franja=(H2 * 0.90, -12, 30), luces=70).convert('RGB')
            im.save(path)
            return im.convert('RGBA')
        if self.key in ('radio', 'tv'):
            canvas, _ = gp.backdrop(self.key, gg.APPS[self.key], W2, H2, cx, cy, R)
        else:
            mod = importlib.import_module('generar_' + self.key)
            canvas, _ = mod.backdrop(W2, H2, cx, cy, R, scale=2.0)
        im = Image.fromarray(np.clip(canvas, 0, 255).astype(np.uint8))
        im.save(path)
        return im.convert('RGBA')

    def brand(self):
        ic = self.icon.resize((64, 64), Image.LANCZOS)
        txt, pad = plain_text(self.cfg['title'], gg.font(FB, 38))
        w = 64 + 14 + txt.size[0] - 2 * pad
        im = Image.new('RGBA', (w + 2 * pad, 64 + 2 * pad))
        im.alpha_composite(ic, (pad, pad))
        im.alpha_composite(txt, (pad + 78 - pad, pad + (64 - txt.size[1]) // 2 + 2))
        return im

    def scene_layers(self, e):
        L = {}
        if e.get('cta'):
            return self.cta_layers(e)
        if e['img'] is None:
            return self.hook_layers(e)
        L['brand'] = (self.brand(), ((W - self.brand().size[0]) // 2, 40))
        tag = pill(e['tag'], gg.font(FB, 30), self.cfg['color'] + (235,), fg=(10, 12, 22))
        L['tag'] = (tag, ((W - tag.size[0]) // 2, 168))
        d = ImageDraw.Draw(Image.new('L', (1, 1)))
        tf, _ = gg.fit_font(d, e['t'], FB, 98, W - 90, min_size=56)
        t, pad = grad_text(e['t'], tf, self.c1, self.c2)
        L['title'] = (t, ((W - t.size[0]) // 2, 236 - pad))
        ty = 236 + t.size[1] - 2 * pad
        s, pad2 = plain_text(e['s'], gg.font(FS, 44))
        L['sub'] = (s, ((W - s.size[0]) // 2, ty + 22 - pad2))
        top = ty + 22 + s.size[1] - 2 * pad2 + 46
        shot = Image.open(os.path.join(PS, self.cfg.get('dir', self.key), e['img'])).convert('RGB')
        width = 590
        ph = gp.phone(shot, width).convert('RGBA')
        maxh = 1600 - top
        if ph.size[1] > maxh:
            width = int(width * maxh / ph.size[1])
            ph = gp.phone(shot, width).convert('RGBA')
        glow, gpad = gp.glow_shadow(ph.size, color=self.cfg['color'], blur=36, alpha=140)
        comb = Image.new('RGBA', (ph.size[0] + 2 * gpad, ph.size[1] + 2 * gpad))
        comb.alpha_composite(glow)
        comb.alpha_composite(ph, (gpad, gpad))
        L['phone'] = (comb, ((W - comb.size[0]) // 2, top - gpad))
        if e.get('phoneclip'):
            # la pantalla del celular muestra la grabación real de la app; aquí solo se guarda la geometría
            self.phone_geo[id(e)] = (width, glow, gpad)
        return L

    def hook_layers(self, e):
        L = {}
        if e.get('bgclip'):
            return self.hook_clip_layers(e)
        ic = self.icon.resize((300, 300), Image.LANCZOS)
        glow, gpad = gp.glow_shadow((300, 300), color=self.cfg['color'], blur=50, alpha=170)
        comb = Image.new('RGBA', (300 + 2 * gpad, 300 + 2 * gpad))
        comb.alpha_composite(glow)
        comb.alpha_composite(ic, (gpad, gpad))
        L['icon'] = (comb, ((W - comb.size[0]) // 2, 470 - gpad))
        tag = pill(e['tag'], gg.font(FB, 34), self.cfg['color'] + (235,), fg=(10, 12, 22))
        L['tag'] = (tag, ((W - tag.size[0]) // 2, 870))
        d = ImageDraw.Draw(Image.new('L', (1, 1)))
        tf, _ = gg.fit_font(d, e['t'], FB, 128, W - 80, min_size=70)
        t, pad = grad_text(e['t'], tf, self.c1, self.c2, glow=0.7)
        L['title'] = (t, ((W - t.size[0]) // 2, 950 - pad))
        ty = 950 + t.size[1] - 2 * pad
        y = ty + 26
        for i, line in enumerate(wrap(e['s'], gg.font(FS, 52), 940)):
            s, p2 = plain_text(line, gg.font(FS, 52))
            L[f'sub{i}'] = (s, ((W - s.size[0]) // 2, y - p2))
            y += s.size[1] - 2 * p2 + 10
        return L

    def hook_clip_layers(self, e):
        """Portada sobre la toma real del globo: textos arriba, el planeta en el centro."""
        L = {}
        tag = pill(e['tag'], gg.font(FB, 34), self.cfg['color'] + (235,), fg=(10, 12, 22))
        top = 1260 if self.cfg.get('portada_abajo') else 190
        L['tag'] = (tag, ((W - tag.size[0]) // 2, top))
        d = ImageDraw.Draw(Image.new('L', (1, 1)))
        tf, _ = gg.fit_font(d, e['t'], FB, 132, W - 70, min_size=70)
        t, pad = grad_text(e['t'], tf, self.c1, self.c2, glow=0.8)
        L['title'] = (t, ((W - t.size[0]) // 2, top + 80 - pad))
        y = top + 80 + t.size[1] - 2 * pad + 20
        for i, line in enumerate(wrap(e['s'], gg.font(FS, 52), 940)):
            s, p2 = plain_text(line, gg.font(FS, 52))
            L[f'sub{i}'] = (s, ((W - s.size[0]) // 2, y - p2))
            y += s.size[1] - 2 * p2 + 10
        return L

    def cta_layers(self, e):
        L = {}
        ic = self.icon.resize((280, 280), Image.LANCZOS)
        glow, gpad = gp.glow_shadow((280, 280), color=self.cfg['color'], blur=50, alpha=180)
        comb = Image.new('RGBA', (280 + 2 * gpad, 280 + 2 * gpad))
        comb.alpha_composite(glow)
        comb.alpha_composite(ic, (gpad, gpad))
        L['icon'] = (comb, ((W - comb.size[0]) // 2, 400 - gpad))
        d = ImageDraw.Draw(Image.new('L', (1, 1)))
        tf, _ = gg.fit_font(d, e['t'], FB, 132, W - 80, min_size=80)
        t, pad = grad_text(e['t'], tf, self.c1, self.c2, glow=0.75)
        L['title'] = (t, ((W - t.size[0]) // 2, 740 - pad))
        y = 740 + t.size[1] - 2 * pad + 24
        for i, line in enumerate(wrap(e['s'], gg.font(FS, 54), 940)):
            s, p2 = plain_text(line, gg.font(FS, 54), fill=(255, 255, 255))
            L[f'sub{i}'] = (s, ((W - s.size[0]) // 2, y - p2))
            y += s.size[1] - 2 * p2 + 10
        btn = pill('Descárgala gratis en Google Play', gg.font(FB, 44), PINK + (255,), padx=46, pady=26)
        L['btn'] = (btn, ((W - btn.size[0]) // 2, y + 50))
        y += 50 + btn.size[1] + 30
        s, p2 = plain_text(f'Busca «{self.cfg["title"]}»', gg.font(FS, 40), fill=(200, 210, 230))
        L['busca'] = (s, ((W - s.size[0]) // 2, y - p2))
        y += s.size[1] - 2 * p2 + 40
        if self.cfg.get('nota'):
            for i, line in enumerate(wrap(self.cfg['nota'], gg.font(FS, 30), 900)):
                s, p2 = plain_text(line, gg.font(FS, 30), fill=(170, 182, 205))
                L[f'nota{i}'] = (s, ((W - s.size[0]) // 2, y - p2))
                y += s.size[1] - 2 * p2 + 4
        return L

    # -----------------------------------------------------------------
    def build(self):
        cfg = self.cfg
        print(cfg['title'])
        voices, durs = plan_voices(self.key, cfg)
        starts = list(np.cumsum([0] + durs[:-1]))
        audio = mix_audio(self.key, cfg, voices, starts)
        scenes = []
        for e, v, s, d in zip(cfg['escenas'], voices, starts, durs):
            layers = self.scene_layers(e)
            chunks = caption_chunks(e['n'])
            vd = len(v) / SR
            weights = np.array([len(c) + 8 for c in chunks], float)
            cs, t0 = [], s + PRE
            for c, w in zip(chunks, weights / weights.sum() * vd):
                cs.append((t0, t0 + w, caption_img(c)))
                t0 += w
            cs[-1] = (cs[-1][0], max(cs[-1][1], s + d - 0.35), cs[-1][2])
            scenes.append(dict(e=e, s=s, d=d, L=layers, caps=cs))
        out_dir = os.path.join(PS, cfg.get('dir', self.key), 'video')
        os.makedirs(out_dir, exist_ok=True)
        silent = os.path.join(CACHE, self.key, 'video-sin-audio.mp4')
        wr = imageio_ffmpeg.write_frames(silent, (W, H), fps=FPS, codec='libx264', pix_fmt_in='rgb24', macro_block_size=8,
                                         output_params=['-crf', '20', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
        wr.send(None)
        nfr = int(TOTAL * FPS)
        for i in range(nfr):
            t = i / FPS
            fr = self.frame(t, scenes)
            if i == int(2.6 * FPS):
                fr.convert('RGB').save(os.path.join(out_dir, cfg.get('portada', 'portada.png')))
            wr.send(np.asarray(fr.convert('RGB')))
            if i % 450 == 0:
                print(f'  {self.key}: {i * 100 // nfr}%', flush=True)
        wr.close()
        out = os.path.join(out_dir, cfg.get('salida', f'orbe-{self.key}-90s.mp4'))
        subprocess.run([FFMPEG, '-y', '-loglevel', 'error', '-i', silent, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                        '-shortest', '-movflags', '+faststart', out], check=True)
        print(f'  -> {os.path.relpath(out, gg.ROOT)} ({os.path.getsize(out) / 1e6:.1f} MB)')

    def frame(self, t, scenes):
        # fondo que se desplaza despacio (y tiembla en la portada de Orbe Sismos)
        k = t / TOTAL
        ox, oy = 30 + 60 * k, 40 + 150 * k
        if self.key == 'sismos' and t < 1.6 and not self.epic:
            amp = 9 * (1 - t / 1.6)
            ox += amp * math.sin(t * 61)
            oy += amp * math.sin(t * 47 + 1)
        ox, oy = int(ox), int(oy)
        sc = next(s for s in reversed(scenes) if t >= s['s'])
        u, d = t - sc['s'], sc['d']
        fade_out = 1 - ease((u - (d - 0.32)) / 0.32) if u > d - 0.32 else 1.0
        e = sc['e']
        si = scenes.index(sc)
        bgc = e.get('bgclip') or (self.cfg.get('fondo_clip') if self.epic else None)
        if bgc:
            own = bool(e.get('bgclip'))
            lp = 'bucle' if self.cfg.get('clips_dir') else not own
            img = self.clips[bgc].frame(u if own else t * 0.5, (W, H), loop=lp).convert('RGBA')
            img.alpha_composite(self.shade_soft if own else self.shade)
            if own and self.cfg.get('portada_abajo'):
                img.alpha_composite(self.shade_bottom)
            if e.get('cta'):
                img = Image.blend(img, self.black, 0.38)
        elif self.cfg.get('fondo_blur') and e.get('phoneclip'):
            # fondo: la misma jugada, desenfocada y oscurecida, mezclada con el fondo de fiesta
            small = self.clips[e['phoneclip']].frame(u + e.get('clipoff', 0), (216, 384), loop='bucle')
            small = small.filter(ImageFilter.GaussianBlur(7)).resize((W, H), Image.BILINEAR).convert('RGBA')
            img = Image.blend(self.bg.crop((ox, oy, ox + W, oy + H)), small, 0.62)
            img.alpha_composite(self.blur_shade)
        else:
            img = self.bg.crop((ox, oy, ox + W, oy + H))
        # ondas sísmicas que salen del icono en la portada y el cierre de Orbe Sismos
        if self.key == 'sismos' and e['img'] is None:
            cy = 540 if e.get('cta') else (980 if e.get('bgclip') else 620)
            ring = Image.new('RGBA', (W, 1700))
            dr = ImageDraw.Draw(ring)
            for j in range(3):
                ph = ((u * 0.55) + j / 3) % 1
                r = (330 + ph * 620) if e.get('bgclip') else (170 + ph * 420)
                a = int(150 * (1 - ph) * fade_out)
                dr.ellipse((W / 2 - r, cy - r * 0.92, W / 2 + r, cy + r * 0.92), outline=(255, 90, 60, a), width=5)
            img.alpha_composite(ring, (0, 0))
        order = list(sc['L'].keys())
        for idx, name in enumerate(order):
            lay, (x, y) = sc['L'][name]
            delay = 0.08 * idx
            p = ease((u - delay) / 0.55)
            if p <= 0:
                continue
            k_a = p * fade_out
            dy = int((1 - p) * (260 if name == 'phone' else 40))
            if name == 'phone':
                dy += int(6 * math.sin(u * 1.6))       # flota suavemente
                if e.get('phoneclip') and id(e) in self.phone_geo:
                    width, glow, gpad = self.phone_geo[id(e)]
                    lp = 'bucle' if self.cfg.get('clips_dir') else False
                    ph = gp.phone(self.clips[e['phoneclip']].frame(u + e.get('clipoff', 0), (720, 1280), loop=lp), width).convert('RGBA')
                    lay = Image.new('RGBA', glow.size)
                    lay.alpha_composite(glow)
                    lay.alpha_composite(ph, (gpad, gpad))
                if self.epic or self.tres_d:
                    lay = tilt(lay, 9 * math.sin(u * 0.8 + si) + (1 - p) * 38, 3 * math.sin(u * 0.6))
            if name in ('icon',) and e.get('cta'):
                bounce = 1 + 0.06 * math.sin(min(1, u / 0.6) * math.pi)
                if abs(bounce - 1) > 0.002:
                    nw = int(lay.size[0] * bounce)
                    lay2 = lay.resize((nw, nw), Image.BILINEAR)
                    x, y, lay = x - (nw - lay.size[0]) // 2, y - (nw - lay.size[1]) // 2, lay2
            if name == 'btn':
                pulse = 1 + 0.035 * math.sin(u * 4.2)
                nw, nh = int(lay.size[0] * pulse), int(lay.size[1] * pulse)
                x, y, lay = x - (nw - lay.size[0]) // 2, y - (nh - lay.size[1]) // 2, lay.resize((nw, nh), Image.BILINEAR)
            img.alpha_composite(with_alpha(lay, k_a), (x, y + dy))
        if self.epic or self.tres_d:
            if si > 0 and u < 0.22:                              # destello al cambiar de escena
                img = Image.blend(img, self.white, (0.45 if self.cfg.get('golpes') else 0.22) * (1 - u / 0.22))
            if e.get('tag') == 'ALARMA':                          # alarma: bordes rojos que laten
                img.alpha_composite(with_alpha(self.vign, (0.35 + 0.3 * math.sin(u * 6.5)) * fade_out))
        # subtítulos
        for c0, c1, cim in sc['caps']:
            if c0 - 0.05 <= t <= c1:
                a = min(1, (t - c0 + 0.05) / 0.15) * fade_out
                img.alpha_composite(with_alpha(cim, a), ((W - cim.size[0]) // 2, 1635))
                break
        if self.epic and self.cfg.get('golpes'):                 # la cámara tiembla (solo Orbe Sismos)
            amp = 0
            if t < 1.8:
                amp = 12 * (1 - t / 1.8)
            elif e.get('tag') == 'ALARMA' and u < 1.2:
                amp = 10 * (1 - u / 1.2)
            if amp > 0.5:
                sx, sy = int(amp * math.sin(t * 61)), int(amp * math.sin(t * 47 + 1))
                moved = Image.new('RGBA', (W, H), (0, 0, 0, 255))
                moved.paste(img, (sx, sy))
                img = moved
        # entrada y salida a negro
        g = min(1, t / 0.6) * min(1, (TOTAL - t) / 0.8)
        if g < 1:
            img = Image.blend(Image.new('RGBA', (W, H), (0, 0, 0, 255)), img, max(0, g))
        return img


if __name__ == '__main__':
    keys = sys.argv[1:] or [k for k in APPS if k != 'juegos2m']
    for key in keys:
        TOTAL = float(APPS[key].get('total', 90.0))     # duración del video (por defecto 1 min 30 s)
        gg._tex_cache.clear()
        Video(key, APPS[key]).build()
