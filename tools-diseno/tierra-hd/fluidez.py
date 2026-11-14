"""Aplica el regulador de fluidez de tierra-hd.js en las cinco apps (seguro de repetir).

    python tools-diseno/tierra-hd/fluidez.py

- La resolución del globo la decide TierraHD.ratio() (empieza en "alta" = 2 píxeles por punto,
  sube o baja según los cuadros por segundo reales del teléfono).
- Las texturas 8K (Tierra y estrellas) solo en equipos con 8 GB de memoria o más (TierraHD.can8k()).
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
js = lambda app, f: os.path.join(ROOT, app, 'app', 'src', 'main', 'assets', 'www', 'js', f)
STARS_OLD = "(maxTex >= 8192 && (navigator.deviceMemory || 4) >= 6 ? 'img/8k/8k_stars.jpg' : 'img/stars-4k.jpg')"
STARS_NEW = "'img/stars-4k.jpg'"


def edit(path, pairs):
    s = open(path, encoding='utf-8').read()
    n = 0
    for old, new in pairs:
        if old in s:
            s = s.replace(old, new)
            n += 1
    open(path, 'w', encoding='utf-8').write(s)
    print(os.path.basename(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(path)))))), os.path.basename(path), n, 'cambios')


USE8K_OLD = "const use8k = () => state.settings.quality === 'ultra' && maxTex >= 8192 && (navigator.deviceMemory || 8) >= 4;"
USE8K_NEW = "const use8k = () => state.settings.quality === 'ultra' && window.TierraHD && TierraHD.maxTex >= 8192 && TierraHD.can8k();"

for app in ('RadioOrbe', 'OrbeTV'):
    edit(js(app, 'app.js'), [
        (USE8K_OLD, USE8K_NEW),
        (STARS_OLD, STARS_NEW),
        ("""    const dpr = window.devicePixelRatio || 1;
    const ratio = state.settings.quality === 'ultra' ? Math.min(dpr, 3) : state.settings.quality === 'high' ? Math.min(dpr, 2) : 1;
    globe.renderer().setPixelRatio(ratio);""",
         """    // Tope según el ajuste de calidad; dentro de él, el regulador de fluidez (tierra-hd.js) decide
    TierraHD.setBudget(state.settings.quality === 'ultra' ? 3 : state.settings.quality === 'high' ? 1.6 : 1);
    globe.renderer().setPixelRatio(TierraHD.ratio());"""),
    ])

edit(js('OrbeEspacio', 'espacio.js'), [
    (USE8K_OLD, USE8K_NEW),
    (STARS_OLD, STARS_NEW),
    ("    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));   // Ultra HD: densidad completa de la pantalla",
     "    globe.renderer().setPixelRatio(window.TierraHD ? TierraHD.ratio() : Math.min(window.devicePixelRatio || 1, 2));   // el regulador de fluidez ajusta"),
])
edit(js('OrbeClima', 'clima.js'), [
    (USE8K_OLD, USE8K_NEW),
    (STARS_OLD, STARS_NEW),
    ("    globe.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));   // Ultra HD",
     "    globe.renderer().setPixelRatio(window.TierraHD ? TierraHD.ratio() : Math.min(window.devicePixelRatio || 1, 2));   // el regulador de fluidez ajusta"),
])
edit(js('OrbeSismos', 'sismos.js'), [
    ("""    const dpr = Math.min(window.devicePixelRatio || 1, 3);      // Ultra HD: densidad completa de la pantalla
    globe.renderer().setPixelRatio(dpr);""",
     """    globe.renderer().setPixelRatio(window.TierraHD ? TierraHD.ratio() : Math.min(window.devicePixelRatio || 1, 2));   // el regulador de fluidez ajusta"""),
    ("    const big = TierraHD.maxTex >= 8192 && (navigator.deviceMemory || 8) >= 4;", "    const big = TierraHD.can8k();"),
])
