/* =====================================================================
   Tierra Ultra HD — motor 3D compartido por las apps Orbe (Radio, TV, Sismos, Espacio y Clima).
   Fuente única: tools-diseno/tierra-hd/tierra-hd.js (se copia a www/js/ de cada app).

   Qué hace sobre el globo de globe.gl:
     · Día y noche reales con relieve (mapa de normales), reflejo del Sol en el mar,
       atardecer anaranjado, luces de ciudades y luz de luna tenue en la noche.
     · Atmósfera en el borde del planeta (más azul de día, rojiza en el atardecer).
     · Nubes iluminadas por el Sol, con su sombra sobre la superficie.
     · Regulador de fluidez: arranca en calidad alta (ligera), mide los cuadros por segundo y
       baja o sube la resolución y los efectos según lo que aguante cada teléfono.
   ===================================================================== */
(() => {
  'use strict';

  const VERT = `
    varying vec3 vNormal; varying vec3 vTangent; varying vec3 vBitangent; varying vec2 vUv; varying vec3 vViewPos;
    void main() {
      vUv = uv;
      vec3 n = normalize(normal);
      vec3 t = cross(vec3(0.0, 1.0, 0.0), n);
      float tl = length(t);
      t = tl > 0.0001 ? t / tl : vec3(1.0, 0.0, 0.0);
      vec3 b = cross(n, t);
      vNormal = normalize(normalMatrix * n); vTangent = normalize(normalMatrix * t); vBitangent = normalize(normalMatrix * b);
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vViewPos = mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`;

  const COMMON = `
    #define PI 3.141592653589793
    uniform vec2 sunPosition; uniform vec2 globeRotation;
    varying vec3 vNormal; varying vec2 vUv; varying vec3 vViewPos;
    float toRad(in float a) { return a * PI / 180.0; }
    vec3 polar2Cartesian(in vec2 c) { float theta = toRad(90.0 - c.x); float phi = toRad(90.0 - c.y); return vec3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta)); }
    vec3 sunDirection() {
      float invLon = toRad(globeRotation.x); float invLat = -toRad(globeRotation.y);
      mat3 rotX = mat3(1, 0, 0, 0, cos(invLat), -sin(invLat), 0, sin(invLat), cos(invLat));
      mat3 rotY = mat3(cos(invLon), 0, sin(invLon), 0, 1, 0, -sin(invLon), 0, cos(invLon));
      return normalize(rotX * rotY * polar2Cartesian(sunPosition));
    }`;

  const FRAG = `
    precision highp float;
    uniform sampler2D dayTexture; uniform sampler2D nightTexture; uniform sampler2D normalTexture; uniform sampler2D specTexture; uniform sampler2D cloudTexture;
    uniform float hasNormal; uniform float hasSpec; uniform float hasClouds; uniform float cloudShift; uniform float reliefK; uniform float nightAmbient;
    varying vec3 vTangent; varying vec3 vBitangent;
    ${COMMON}
    void main() {
      vec3 L = sunDirection();
      vec3 N = normalize(vNormal); vec3 V = normalize(-vViewPos);
      float ndl = dot(N, L);
      float day = smoothstep(-0.10, 0.22, ndl);
      vec3 dayCol = texture2D(dayTexture, vUv).rgb;
      vec3 nightCol = texture2D(nightTexture, vUv).rgb;
      float water = hasSpec > 0.5 ? texture2D(specTexture, vUv).r : 0.0;

      // Relieve: las montañas reciben luz del lado del Sol y sombra del otro
      float relief = 0.0;
      if (hasNormal > 0.5) {
        vec2 nm = texture2D(normalTexture, vUv).rg * 2.0 - 1.0;
        vec3 Nb = normalize(N + reliefK * (nm.x * normalize(vTangent) + nm.y * normalize(vBitangent)));
        relief = clamp((dot(Nb, L) - ndl) * 1.6, -0.34, 0.34) * (1.0 - water);
      }
      float shade = 0.30 + 0.80 * pow(clamp(ndl, 0.0, 1.0), 0.62);
      vec3 lit = dayCol * (shade + relief);

      // Sombra de las nubes sobre la superficie
      if (hasClouds > 0.5) {
        float c = texture2D(cloudTexture, vec2(vUv.x - cloudShift, vUv.y)).r;
        lit *= 1.0 - 0.34 * smoothstep(0.25, 0.85, c);
      }
      // Atardecer y amanecer: franja cálida junto a la línea día/noche
      float tw = smoothstep(-0.18, 0.02, ndl) * (1.0 - smoothstep(0.02, 0.34, ndl));
      lit *= mix(vec3(1.0), vec3(1.22, 0.86, 0.66), tw * 0.75);
      // Reflejo del Sol en el mar
      float nh = max(dot(N, normalize(L + V)), 0.0);
      lit += vec3(1.0, 0.95, 0.84) * (pow(nh, 140.0) * 0.5 + pow(nh, 24.0) * 0.10) * water * day;

      // Noche: luces de las ciudades y una luz de luna muy tenue
      vec3 night = nightCol * vec3(1.55, 1.42, 1.18) + dayCol * vec3(0.5, 0.62, 1.0) * nightAmbient;
      vec3 col = mix(night, lit, day);

      // Atmósfera en el borde del planeta
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
      vec3 atmo = mix(vec3(0.30, 0.56, 1.0), vec3(1.0, 0.55, 0.32), tw * 0.8);
      col += atmo * fres * (0.10 + 0.72 * smoothstep(-0.25, 0.3, ndl));
      gl_FragColor = vec4(col, 1.0);
    }`;

  const CLOUD_VERT = `
    varying vec3 vNormal; varying vec2 vUv; varying vec3 vViewPos;
    void main() {
      vUv = uv; vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(position, 1.0); vViewPos = mv.xyz;
      gl_Position = projectionMatrix * mv;
    }`;
  const CLOUD_FRAG = `
    precision highp float;
    uniform sampler2D map; uniform float opacity; uniform float flatLight;
    ${COMMON}
    void main() {
      float c = texture2D(map, vUv).r;
      vec3 N = normalize(vNormal);
      float ndl = dot(N, sunDirection());
      float day = mix(smoothstep(-0.14, 0.24, ndl), 1.0, flatLight);
      float tw = (1.0 - flatLight) * smoothstep(-0.18, 0.02, ndl) * (1.0 - smoothstep(0.02, 0.34, ndl));
      vec3 col = mix(vec3(0.06, 0.08, 0.14), vec3(1.0), day) * mix(vec3(1.0), vec3(1.22, 0.82, 0.62), tw * 0.85);
      // un poco de volumen: las nubes densas son más blancas
      col *= 0.82 + 0.18 * smoothstep(0.3, 0.95, c);
      float alpha = smoothstep(0.10, 0.80, c) * opacity * mix(0.30, 1.0, day);
      gl_FragColor = vec4(col, alpha);
    }`;

  // Punto de la Tierra con el Sol justo encima (aprox. NOAA), en grados [lng, lat].
  function sunPosition(d) {
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const doy = (d - start) / 864e5;
    const g = 2 * Math.PI / 365 * (doy - 1 + (d.getUTCHours() - 12) / 24);
    const decl = (0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
      + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g)) * 180 / Math.PI;
    const eot = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    let lng = -(utcMin + eot - 720) / 4;
    lng = ((lng + 540) % 360) - 180;
    return [lng, decl];
  }

  const T = {
    VERT, FRAG, sunPosition,
    globe: null, Shader: null, Tex: null, mesh: null, aniso: 1, maxTex: 4096,
    mats: [], earth: null, cloudMesh: null, level: 0, onLevel: null, maxRatio: 3,
    // ?calidad=fija desactiva el regulador (para tomar las capturas de Play Store con un navegador sin GPU)
    locked: /[?&]calidad=fija/.test(location.search)
  };

  /** Llamar una vez, con el globo listo y su material original puesto. Devuelve false si el equipo no lo soporta. */
  T.init = function (globe) {
    T.globe = globe;
    const cur = globe.globeMaterial();
    globe.scene().traverse(o => {
      if (!T.Shader && o.material && o.material.type === 'ShaderMaterial') T.Shader = o.material.constructor;
      if (!T.mesh && o.isMesh && o.material === cur) T.mesh = o;
    });
    T.Tex = cur.map && cur.map.constructor;
    try {
      const caps = globe.renderer().capabilities;
      T.maxTex = caps.maxTextureSize || 4096;
      T.aniso = caps.getMaxAnisotropy ? caps.getMaxAnisotropy() : 1;
    } catch (e) { /* valores por defecto */ }
    if (!T._loop) { T._loop = true; requestAnimationFrame(tick); }
    applyLevel();
    return !!(T.Shader && T.Tex && T.mesh);
  };

  T.loadTexture = url => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { const t = new T.Tex(img); t.colorSpace = ''; t.anisotropy = T.aniso; t.needsUpdate = true; res(t); };
    img.onerror = rej; img.src = url;
  });

  /**
   * Material de la Tierra. urls: { day, night, normal?, spec? } · opts: { nightAmbient, relief }
   * Devuelve una promesa con el material (ya registrado para seguir al Sol y a la cámara).
   */
  T.createEarth = async function (urls, opts = {}) {
    const opt = url => url ? T.loadTexture(url).catch(() => null) : Promise.resolve(null);
    const [day, night, normal, spec] = await Promise.all([T.loadTexture(urls.day), T.loadTexture(urls.night), opt(urls.normal), opt(urls.spec)]);
    const pov = T.globe.pointOfView();
    const mat = new T.Shader({
      uniforms: {
        dayTexture: { value: day }, nightTexture: { value: night }, normalTexture: { value: normal || day }, specTexture: { value: spec || day },
        cloudTexture: { value: day }, hasNormal: { value: normal ? 1 : 0 }, hasSpec: { value: spec ? 1 : 0 }, hasClouds: { value: 0 }, cloudShift: { value: 0 },
        reliefK: { value: opts.relief || 5.5 }, nightAmbient: { value: opts.nightAmbient == null ? 0.05 : opts.nightAmbient },
        sunPosition: { value: sunPosition(new Date()) }, globeRotation: { value: [pov.lng, pov.lat] }
      },
      vertexShader: VERT, fragmentShader: FRAG
    });
    mat.userData = { normalOk: !!normal };
    T.mats.push(mat); T.earth = mat;
    if (T.cloudMesh) linkCloudShadow();
    applyLevel();
    return mat;
  };

  /** Capa de nubes iluminada por el Sol (textura en escala de grises). Devuelve la malla. */
  T.createClouds = async function (url, opts = {}) {
    const tex = await T.loadTexture(url);
    const pov = T.globe.pointOfView();
    const mat = new T.Shader({
      uniforms: { map: { value: tex }, opacity: { value: opts.opacity == null ? 0.9 : opts.opacity }, flatLight: { value: opts.flat ? 1 : 0 },
        sunPosition: { value: sunPosition(new Date()) }, globeRotation: { value: [pov.lng, pov.lat] } },
      vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false
    });
    const mesh = new T.mesh.constructor(T.mesh.geometry, mat);
    mesh.scale.setScalar(1.0055); mesh.renderOrder = 1;
    T.mesh.parent.add(mesh);
    T.mats.push(mat); T.cloudMesh = mesh; mesh.userData.drift = opts.drift == null ? 0.00009 : opts.drift;
    linkCloudShadow();
    return mesh;
  };
  T.setCloudsFlat = flat => { if (T.cloudMesh) T.cloudMesh.material.uniforms.flatLight.value = flat ? 1 : 0; };
  T.setCloudsVisible = on => { if (T.cloudMesh) { T.cloudMesh.visible = !!on; linkCloudShadow(); } };

  function linkCloudShadow() {
    if (!T.earth) return;
    const on = T.cloudMesh && T.cloudMesh.visible && T.level < 1;
    T.earth.uniforms.hasClouds.value = on ? 1 : 0;
    if (T.cloudMesh) T.earth.uniforms.cloudTexture.value = T.cloudMesh.material.uniforms.map.value;
  }

  // ---------- regulador de fluidez ----------
  // La app arranca en calidad "alta" (hasta 2 píxeles por punto), que ya se ve nítida y es ligera.
  //   -1 máxima: hasta 3x (solo si el equipo demuestra que va sobrado)
  //    0 alta:   hasta 2x
  //    1 media:  hasta 1,5x y sin sombras de nubes
  //    2 ligera: hasta 1,2x, sin relieve y la interfaz sin desenfoques
  // El nivel que mejor le va a cada teléfono se recuerda para la próxima vez.
  const RATIO = { '-1': 3, 0: 2, 1: 1.5, 2: 1.2 };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('orbe.hd') || '{}') || {}; } catch (e) { saved = {}; }
  T.level = T.locked ? -1 : (typeof saved.level === 'number' ? Math.max(-1, Math.min(2, saved.level)) : 0);
  T.maxRatio = 3;
  const remember = () => { try { localStorage.setItem('orbe.hd', JSON.stringify({ level: T.level, noBoost: !!saved.noBoost })); } catch (e) { /* sin almacenamiento */ } };
  /** Píxeles por punto con los que debe dibujar el globo ahora mismo. */
  T.ratio = () => Math.max(1, Math.min(window.devicePixelRatio || 1, RATIO[T.level], T.maxRatio));
  T.startRatio = T.ratio;
  /** Texturas 8K solo en equipos con mucha memoria y que no hayan necesitado bajar la calidad. */
  T.can8k = () => T.maxTex >= 8192 && (navigator.deviceMemory || 4) >= 8 && T.level <= 0;
  /** Tope que pone la app desde sus ajustes de calidad (3 = sin tope). */
  T.setBudget = function (max) { T.maxRatio = max || 3; applyLevel(); };

  function applyLevel() {
    if (T.earth) T.earth.uniforms.hasNormal.value = T.level >= 2 ? 0 : (T.earth.userData.normalOk ? 1 : 0);
    linkCloudShadow();
    try {
      const r = T.globe.renderer(), want = T.ratio();
      if (Math.abs(r.getPixelRatio() - want) > 0.01) { r.setPixelRatio(want); T.globe.width(innerWidth).height(innerHeight); }
    } catch (e) { /* sin cambios */ }
    document.documentElement.classList.toggle('lite', T.level >= 2);
    if (T.onLevel) T.onLevel(T.level);
  }
  T.resetQuality = function () { slow = 0; good = 0; applyLevel(); };

  let last = 0, acc = 0, frames = 0, slow = 0, good = 0, sunAt = 0, warm = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    // El Sol y la cámara
    if (T.globe && T.mats.length) {
      const pov = T.globe.pointOfView();
      const sun = now - sunAt > 20000 ? (sunAt = now, sunPosition(new Date())) : null;
      for (const m of T.mats) { m.uniforms.globeRotation.value = [pov.lng, pov.lat]; if (sun) m.uniforms.sunPosition.value = sun; }
    }
    if (T.cloudMesh && T.cloudMesh.visible) {
      T.cloudMesh.rotation.y += T.cloudMesh.userData.drift;
      if (T.earth) T.earth.uniforms.cloudShift.value = T.cloudMesh.rotation.y / (2 * Math.PI);
    }
    // Cuadros por segundo (solo con la app visible)
    if (document.hidden || T.locked) { last = 0; return; }
    if (last) {
      const dt = now - last;
      if (dt < 500) { acc += dt; frames++; }
      if (acc >= 2000) {
        const fps = frames * 1000 / acc; acc = 0; frames = 0;
        if (++warm > 3) {                               // los primeros segundos (carga de texturas) no cuentan
          if (fps < 42) { slow++; good = 0; } else { slow = Math.max(0, slow - 1); good = fps >= 57 ? good + 1 : 0; }
          if (slow >= 2 && T.level < 2) {               // va lento: un escalón menos
            if (T.level === -1) saved.noBoost = true;
            T.level++; slow = 0; warm = 2; remember(); applyLevel();
          } else if (good >= 5 && T.level === 0 && !saved.noBoost && (window.devicePixelRatio || 1) > 2.05 && T.maxRatio > 2) {
            T.level = -1; good = 0; warm = 2; remember(); applyLevel();   // va sobrado: prueba la calidad máxima
          }
        }
      }
    }
    last = now;
  }

  window.TierraHD = T;
})();
