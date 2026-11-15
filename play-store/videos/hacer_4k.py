"""Copia los videos terminados a play-store/videos/listos/ y crea su versión 4K (2160x3840).

    python play-store/videos/hacer_4k.py [sismos radio …]

La versión 4K se escala con Lanczos y un enfoque suave a partir del Full HD (1080x1920). Las capturas de las apps
son de 1080 px, así que el 4K se ve igual de nítido pero no tiene más detalle: sirve para plataformas o pantallas
que piden 4K. Para TikTok, Reels, Shorts, estados y Play Store, el Full HD es lo recomendado.
"""
import os
import shutil
import subprocess
import sys

import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
PS = os.path.dirname(HERE)
LISTOS = os.path.join(HERE, 'listos')
FF = imageio_ffmpeg.get_ffmpeg_exe()
APPS = ['sismos', 'radio', 'tv', 'espacio', 'clima', 'podcasts', 'biblia', 'juegos']

os.makedirs(os.path.join(LISTOS, '4k'), exist_ok=True)
for key in sys.argv[1:] or APPS:
    src = os.path.join(PS, key, 'video', f'orbe-{key}-90s.mp4')
    if not os.path.exists(src):
        print('  falta', src)
        continue
    shutil.copy2(src, os.path.join(LISTOS, f'orbe-{key}-90s.mp4'))
    out = os.path.join(LISTOS, '4k', f'orbe-{key}-90s-4k.mp4')
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=2160:3840:flags=lanczos,unsharp=5:5:0.5:5:5:0.0',
                    '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', out], check=True)
    print(f'  -> {key}: Full HD {os.path.getsize(src) / 1e6:.0f} MB · 4K {os.path.getsize(out) / 1e6:.0f} MB')
