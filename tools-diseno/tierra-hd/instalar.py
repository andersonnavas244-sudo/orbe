"""Instala el motor Tierra Ultra HD y sus texturas en las apps Orbe.

    python tools-diseno/tierra-hd/instalar.py

- Copia tierra-hd.js a www/js/ y las texturas (relieve, mar, nubes, estrellas) a www/img/.
- La primera vez adapta el código de cada app (es seguro volver a ejecutarlo: no repite cambios).
Texturas: Solar System Scope (CC BY 4.0), convertidas en tools-diseno/texturas/.
"""
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(ROOT, 'tools-diseno', 'texturas')
APPS = ['RadioOrbe', 'OrbeTV', 'OrbeSismos', 'OrbeEspacio', 'OrbeClima']
CLASICAS = ('RadioOrbe', 'OrbeTV', 'OrbeSismos')
www = lambda app: os.path.join(ROOT, app, 'app', 'src', 'main', 'assets', 'www')

STARS = "(maxTex >= 8192 && (navigator.deviceMemory || 4) >= 6 ? 'img/8k/8k_stars.jpg' : 'img/stars-4k.jpg')"


def cut(s, start, end, new):
    a = s.index(start)
    b = s.index(end, a)
    return s[:a] + new + s[b:]


def sub(s, old, new, must=True):
    if old not in s:
        if must:
            raise SystemExit('No se encontró: ' + old[:70])
        return s
    return s.replace(old, new, 1)


def copy_assets(app):
    w = www(app)
    os.makedirs(os.path.join(w, 'img', '8k'), exist_ok=True)
    shutil.copy(os.path.join(HERE, 'tierra-hd.js'), os.path.join(w, 'js', 'tierra-hd.js'))
    css = open(os.path.join(HERE, 'uhd.css'), encoding='utf-8').read()
    if app in CLASICAS:
        css += open(os.path.join(HERE, 'uhd-clasicas.css'), encoding='utf-8').read()
        for f in ('space-grotesk-500.woff2', 'space-grotesk-600.woff2', 'space-grotesk-ext-600.woff2', 'space-grotesk-700.woff2',
                  'jetbrains-mono-500.woff2', 'jetbrains-mono-700.woff2'):
            shutil.copy(os.path.join(www('OrbeEspacio'), 'fonts', f), os.path.join(w, 'fonts', f))
    open(os.path.join(w, 'css', 'uhd.css'), 'w', encoding='utf-8').write(css)
    for f in ('earth-normal.jpg', 'earth-spec.jpg', 'stars-4k.jpg'):
        shutil.copy(os.path.join(TEX, f), os.path.join(w, 'img', f))
    shutil.copy(os.path.join(TEX, '8k_stars.jpg'), os.path.join(w, 'img', '8k', '8k_stars.jpg'))
    if app in ('RadioOrbe', 'OrbeTV', 'OrbeEspacio'):
        shutil.copy(os.path.join(TEX, 'clouds-4k.jpg'), os.path.join(w, 'img', 'clouds-4k.jpg'))
    if app == 'OrbeSismos':
        for f in ('8k_earth_daymap.jpg',):
            src = os.path.join(www('RadioOrbe'), 'img', '8k', f)
            if not os.path.exists(os.path.join(w, 'img', '8k', f)):
                shutil.copy(src, os.path.join(w, 'img', '8k', f))
    # archivos que ya no se usan
    old = ['night-sky.png', 'clouds.png']
    for f in old:
        p = os.path.join(w, 'img', f)
        if os.path.exists(p):
            os.remove(p)


def patch_html(app):
    p = os.path.join(www(app), 'index.html')
    s = open(p, encoding='utf-8').read()
    if 'tierra-hd.js' not in s:
        s = s.replace('<script src="lib/globe.gl.min.js"></script>', '<script src="lib/globe.gl.min.js"></script>\n  <script src="js/tierra-hd.js"></script>', 1)
    if 'uhd.css' not in s:
        i = s.rindex('<link rel="stylesheet"')
        j = s.index('>', i) + 1
        s = s[:j] + '\n  <link rel="stylesheet" href="css/uhd.css">' + s[j:]
    open(p, 'w', encoding='utf-8').write(s)


RADIO_DN = '''  function enableDayNight() {
    if (!baseMat) baseMat = globe.globeMaterial();
    TierraHD.setCloudsFlat(false);
    if (dnMat) { globe.globeMaterial(dnMat); return; }
    if (!hdReady) { toast('Este equipo no soporta el modo día y noche'); return; }
    // Tierra Ultra HD: relieve, reflejo del Sol en el mar, atardecer y atmósfera (js/tierra-hd.js)
    TierraHD.createEarth({ day: texUrl('day'), night: TEXTURES.night.k4, normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' })
      .then(mat => { dnMat = mat; if (state.settings.texture === 'real') globe.globeMaterial(dnMat); })
      .catch(() => toast('No se pudo cargar el modo día y noche'));
  }

'''
RADIO_CLOUDS = '''  let cloudsLoading = false;
  function setClouds(on) {
    if (!on) { if (clouds) TierraHD.setCloudsVisible(false); return; }
    if (clouds) { TierraHD.setCloudsVisible(true); return; }
    if (!hdReady || cloudsLoading) return;
    cloudsLoading = true;
    // Nubes iluminadas por el Sol, con sombra sobre la superficie
    TierraHD.createClouds(texUrl('clouds'), { flat: state.settings.texture !== 'real' }).then(m => {
      clouds = m; cloudsLoading = false; TierraHD.setCloudsVisible(state.settings.clouds);
    }).catch(() => { cloudsLoading = false; });
  }

'''


def patch_radio_tv(app):
    p = os.path.join(www(app), 'js', 'app.js')
    s = open(p, encoding='utf-8').read()
    if 'TierraHD' in s:
        return
    s = sub(s, "clouds: { k8: 'img/clouds.png',               k4: 'img/clouds.png' }", "clouds: { k8: 'img/clouds-4k.jpg',            k4: 'img/clouds-4k.jpg' }")
    s = s.replace("// 4K con transparencia: ahorra memoria de GPU", "// 4K en grises (la luz la pone el Sol)")
    s = sub(s, ".backgroundImageUrl('img/night-sky.png')", ".backgroundImageUrl(" + STARS + ")\n      .globeCurvatureResolution(2)")
    s = sub(s, "    baseMat = globe.globeMaterial();\n    sharpenGlobe();", "    baseMat = globe.globeMaterial();\n    hdReady = TierraHD.init(globe);\n    sharpenGlobe();")
    s = sub(s, "  let baseMat = null, dnMat = null, sunTimer = null;", "  let baseMat = null, dnMat = null, sunTimer = null, hdReady = false;")
    s = cut(s, "  function enableDayNight() {", "  function setTexture(name) {", RADIO_DN)
    s = sub(s, "    if (clouds) clouds.material.opacity = 0.75;\n    globe.globeImageUrl(texUrl(name));", "    TierraHD.setCloudsFlat(true);\n    globe.globeImageUrl(texUrl(name));")
    s = cut(s, "  function setClouds(on) {", "  // Tamaño de los puntos", RADIO_CLOUDS)
    s = sub(s, " if (clouds) { clouds.parent.remove(clouds); clouds = null; if (state.settings.clouds) setClouds(true); } }", " }")
    s = sub(s, "state.settings.quality = q.dataset.q; applyQuality(); saveSettings();", "state.settings.quality = q.dataset.q; applyQuality(); TierraHD.resetQuality(); saveSettings();")
    s = s.replace("url(img/clouds.png)", "url(img/clouds-4k.jpg)")
    open(p, 'w', encoding='utf-8').write(s)


def patch_espacio():
    p = os.path.join(www('OrbeEspacio'), 'js', 'espacio.js')
    s = open(p, encoding='utf-8').read()
    if 'TierraHD' in s:
        return
    s = sub(s, ".backgroundImageUrl('img/night-sky.png')", ".backgroundImageUrl(" + STARS + ")\n      .globeCurvatureResolution(2)")
    s = sub(s, "    enableDayNight();\n    if (state.settings.clouds) setClouds(true);", "    hdReady = TierraHD.init(globe);\n    enableDayNight();\n    if (state.settings.clouds) setClouds(true);")
    s = sub(s, "  let globe, maxTex = 4096, maxAniso = 1, baseMat = null, dnMat = null, clouds = null;", "  let globe, maxTex = 4096, maxAniso = 1, baseMat = null, dnMat = null, clouds = null, hdReady = false;")
    s = cut(s, "  function enableDayNight() {", "  let sizeStep = -1;", '''  function enableDayNight() {
    if (!hdReady) return;
    // Tierra Ultra HD: relieve, reflejo del Sol en el mar, atardecer y atmósfera (js/tierra-hd.js)
    TierraHD.createEarth({ day: use8k() ? TEXTURES.day.k8 : TEXTURES.day.k4, night: TEXTURES.night, normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' })
      .then(mat => { dnMat = mat; globe.globeMaterial(dnMat); }).catch(() => {});
  }
  let cloudsLoading = false;
  function setClouds(on) {
    if (!on) { if (clouds) TierraHD.setCloudsVisible(false); return; }
    if (clouds) { TierraHD.setCloudsVisible(true); return; }
    if (!hdReady || cloudsLoading) return;
    cloudsLoading = true;
    TierraHD.createClouds('img/clouds-4k.jpg', { opacity: 0.8 }).then(m => { clouds = m; cloudsLoading = false; TierraHD.setCloudsVisible(state.settings.clouds); })
      .catch(() => { cloudsLoading = false; });
  }
''')
    open(p, 'w', encoding='utf-8').write(s)


def patch_clima():
    p = os.path.join(www('OrbeClima'), 'js', 'clima.js')
    s = open(p, encoding='utf-8').read()
    if 'TierraHD' in s:
        return
    s = sub(s, ".backgroundImageUrl('img/night-sky.png')", ".backgroundImageUrl(" + STARS + ")\n      .globeCurvatureResolution(2)")
    s = sub(s, "    enableDayNight();\n    setupOverlays();", "    hdReady = TierraHD.init(globe);\n    enableDayNight();\n    setupOverlays();")
    s = sub(s, "  let globe, maxTex = 4096, maxAniso = 1, baseMat = null, dnMat = null, globeMesh = null, Shader = null, Tex = null;",
            "  let globe, maxTex = 4096, maxAniso = 1, baseMat = null, dnMat = null, globeMesh = null, Shader = null, Tex = null, hdReady = false;")
    s = cut(s, "  function enableDayNight() {", "  // ---------- capas del clima sobre el globo", '''  function enableDayNight() {
    if (!hdReady) return;
    // Tierra Ultra HD: relieve, reflejo del Sol en el mar, atardecer y atmósfera (js/tierra-hd.js)
    TierraHD.createEarth({ day: use8k() ? TEXTURES.day.k8 : TEXTURES.day.k4, night: TEXTURES.night, normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' }, { nightAmbient: 0.09 })
      .then(mat => { dnMat = mat; globe.globeMaterial(dnMat); }).catch(() => {});
  }

''')
    open(p, 'w', encoding='utf-8').write(s)


def patch_sismos():
    p = os.path.join(www('OrbeSismos'), 'js', 'sismos.js')
    s = open(p, encoding='utf-8').read()
    if 'TierraHD' in s:
        return
    s = sub(s, ".backgroundImageUrl('img/night-sky.png')", ".backgroundImageUrl('img/stars-4k.jpg')\n      .globeCurvatureResolution(2)")
    s = sub(s, "        const sp = $('#splash'); $('#splash-bar').style.width = '100%';", "        setupHD();\n        const sp = $('#splash'); $('#splash-bar').style.width = '100%';")
    s = sub(s, "  function drawQuakes() {", '''  // Tierra Ultra HD (js/tierra-hd.js): día y noche reales, relieve, reflejo del mar y atmósfera.
  // La noche se deja un poco más clara para que el mapa se lea bien junto a los sismos.
  function setupHD() {
    if (!window.TierraHD || !TierraHD.init(globe)) return;
    const big = TierraHD.maxTex >= 8192 && (navigator.deviceMemory || 8) >= 4;
    TierraHD.createEarth({ day: big ? 'img/8k/8k_earth_daymap.jpg' : 'img/earth-blue-marble.jpg', night: 'img/earth-night.jpg',
      normal: 'img/earth-normal.jpg', spec: 'img/earth-spec.jpg' }, { nightAmbient: 0.22 })
      .then(mat => globe.globeMaterial(mat)).catch(() => {});
  }
  function drawQuakes() {''')
    open(p, 'w', encoding='utf-8').write(s)


if __name__ == '__main__':
    for app in APPS:
        copy_assets(app)
        patch_html(app)
        print('✓', app)
    patch_radio_tv('RadioOrbe')
    patch_radio_tv('OrbeTV')
    patch_espacio()
    patch_clima()
    patch_sismos()
    print('Código adaptado.')
