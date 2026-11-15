"""Música de fondo para orar y leer en Orbe Biblia (compuesta aquí, sin derechos de terceros).

    python play-store/videos/musica_oracion.py
Sale en OrbeBiblia/app/src/main/assets/www/audio/oracion.m4a (2 minutos, se repite en bucle).
"""
import os
import subprocess
import wave

import numpy as np

import hacer_videos as hv

OUT = os.path.join(hv.gg.ROOT, 'OrbeBiblia', 'app', 'src', 'main', 'assets', 'www', 'audio')
os.makedirs(OUT, exist_ok=True)
secs = 120.0
m = hv.music('oracion', secs)
# fundido suave para que el bucle no se note
n = m.shape[1]
f = int(4 * hv.SR)
ramp = np.linspace(0, 1, f)
m[:, :f] *= ramp
m[:, -f:] *= ramp[::-1]
m *= 0.6 / max(1e-6, np.abs(m).max())
tmp = os.path.join(hv.CACHE, 'oracion.wav')
os.makedirs(hv.CACHE, exist_ok=True)
with wave.open(tmp, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(hv.SR)
    w.writeframes((np.clip(m.T, -1, 1) * 32767).astype(np.int16).tobytes())
out = os.path.join(OUT, 'oracion.m4a')
subprocess.run([hv.FFMPEG, '-y', '-loglevel', 'error', '-i', tmp, '-c:a', 'aac', '-b:a', '96k', out], check=True)
print('->', out, round(os.path.getsize(out) / 1e6, 2), 'MB')
