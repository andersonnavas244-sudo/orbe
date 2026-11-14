/* Orbe Clima – iconos vectoriales con volumen (nítidos en pantallas 4K a cualquier tamaño) */
(() => {
  'use strict';

  // Degradados compartidos (en un SVG visible de tamaño 0, así funcionan en todo el documento)
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="g-tab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7cf4ff"/><stop offset=".55" stop-color="#5b8cff"/><stop offset="1" stop-color="#9b7bff"/></linearGradient>
    <radialGradient id="w-sun" cx=".38" cy=".35" r=".7"><stop offset="0" stop-color="#fffbe0"/><stop offset=".45" stop-color="#ffd84a"/><stop offset="1" stop-color="#ff9a1f"/></radialGradient>
    <linearGradient id="w-ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe46b"/><stop offset="1" stop-color="#ffab2e"/></linearGradient>
    <radialGradient id="w-moon" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fffdf0"/><stop offset=".6" stop-color="#f1e7c3"/><stop offset="1" stop-color="#c9bf9d"/></radialGradient>
    <linearGradient id="w-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#e8eef9"/><stop offset="1" stop-color="#b9c6dc"/></linearGradient>
    <linearGradient id="w-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9e1ee"/><stop offset=".6" stop-color="#9eabc2"/><stop offset="1" stop-color="#6d7a93"/></linearGradient>
    <linearGradient id="w-drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9ae2ff"/><stop offset="1" stop-color="#2f7cff"/></linearGradient>
    <linearGradient id="w-bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7a8"/><stop offset=".5" stop-color="#ffd23a"/><stop offset="1" stop-color="#ff9500"/></linearGradient>
    <linearGradient id="w-fog" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c4cede" stop-opacity=".2"/><stop offset=".5" stop-color="#e6ecf6"/><stop offset="1" stop-color="#c4cede" stop-opacity=".2"/></linearGradient>
    <radialGradient id="w-storm" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff9aa9"/><stop offset=".45" stop-color="#ff4f6d"/><stop offset="1" stop-color="#9c1438"/></radialGradient>
    <filter id="w-sh" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.4" flood-color="#0a1430" flood-opacity=".45"/></filter>
  </defs></svg>`;

  const svg = (body, vb = '0 0 24 24', extra = '') => `<svg viewBox="${vb}" ${extra} aria-hidden="true">${body}</svg>`;

  // ---------- piezas del icono del tiempo (lienzo 64×64) ----------
  const sun = (cx = 32, cy = 32, r = 13) => `<g filter="url(#w-sh)">${Array.from({ length: 8 }, (_, i) => {
    const a = i * 45;
    return `<rect x="${cx - 2.2}" y="${cy - r - 10}" width="4.4" height="7.5" rx="2.2" fill="url(#w-ray)" transform="rotate(${a} ${cx} ${cy})"/>`;
  }).join('')}<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#w-sun)"/></g>`;
  const moon = (cx = 32, cy = 30, r = 14) => `<g filter="url(#w-sh)"><path d="M${cx + r * 0.25} ${cy - r}a${r} ${r} 0 1 0 ${r * 0.8} ${r * 1.55}a${r * 0.9} ${r * 0.9} 0 0 1-${r * 0.8}-${r * 1.55}z" fill="url(#w-moon)"/></g>`;
  const cloud = (x = 0, y = 0, s = 1, dark = false) => `<g filter="url(#w-sh)" transform="translate(${x} ${y}) scale(${s})"><path d="M18 46a10 10 0 0 1-1.2-19.9A14 14 0 0 1 43.6 22 11 11 0 0 1 46 46z" fill="url(#${dark ? 'w-dark' : 'w-cloud'})"/><path d="M20 30a9 9 0 0 1 9-7" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none" stroke-linecap="round"/></g>`;
  const drops = (n = 3, y = 48, light = false) => Array.from({ length: n }, (_, i) => {
    const x = 22 + i * (n === 2 ? 14 : 10);
    return `<path d="M${x} ${y}c0 0-3.2 4.4-3.2 6.4a3.2 3.2 0 0 0 6.4 0c0-2-3.2-6.4-3.2-6.4z" fill="url(#w-drop)" ${light ? 'transform="scale(.85)" transform-origin="' + x + ' ' + y + '"' : ''} filter="url(#w-sh)"/>`;
  }).join('');
  const flakes = (y = 50) => [22, 32, 42].map((x, i) => `<g transform="translate(${x} ${y + (i % 2) * 3})" stroke="#fff" stroke-width="1.8" stroke-linecap="round" filter="url(#w-sh)"><path d="M0-4V4M-3.5-2 3.5 2M-3.5 2 3.5-2"/></g>`).join('');
  const bolt = () => `<path d="M33 40h7l-5 9h6L28 62l4-10h-5z" fill="url(#w-bolt)" stroke="#b56a00" stroke-width=".8" stroke-linejoin="round" filter="url(#w-sh)"/>`;
  const fog = () => [40, 47, 54].map((y, i) => `<rect x="${12 + i * 3}" y="${y}" width="${40 - i * 4}" height="4" rx="2" fill="url(#w-fog)"/>`).join('');

  /** Icono del tiempo según el código WMO (clima.js traduce los símbolos de MET Norway) y si es de día. */
  function weather(code, day = true, size = 64) {
    const sky = day ? sun(24, 24, 11) : moon(24, 22, 12);
    let b;
    if (code === 0) b = day ? sun() : moon(32, 32, 16);
    else if (code === 1) b = sky + cloud(10, 12, 0.72);
    else if (code === 2) b = sky + cloud(4, 6, 0.9);
    else if (code === 3) b = cloud(-8, -2, 0.75, true) + cloud(4, 4, 0.92);
    else if (code === 45 || code === 48) b = cloud(0, -6, 0.92) + fog();
    else if (code >= 51 && code <= 57) b = cloud(0, -4, 0.95) + drops(2, 46, true);
    else if (code >= 61 && code <= 67) b = cloud(0, -6, 0.95, true) + drops(3, 44);
    else if (code >= 71 && code <= 77) b = cloud(0, -6, 0.95) + flakes(48);
    else if (code >= 80 && code <= 82) b = sky + cloud(4, -2, 0.9, true) + drops(3, 46);
    else if (code === 85 || code === 86) b = sky + cloud(4, -2, 0.9) + flakes(50);
    else if (code >= 95) b = cloud(0, -8, 0.95, true) + bolt() + drops(2, 44);
    else b = cloud(0, 0, 0.95);
    return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" class="wx" aria-hidden="true">${b}</svg>`;
  }

  const WMO = {
    0: 'Despejado', 1: 'Casi despejado', 2: 'Parcialmente nublado', 3: 'Nublado', 45: 'Niebla', 48: 'Niebla con escarcha',
    51: 'Llovizna débil', 53: 'Llovizna', 55: 'Llovizna intensa', 56: 'Llovizna helada', 57: 'Llovizna helada intensa',
    61: 'Lluvia débil', 63: 'Lluvia', 65: 'Lluvia fuerte', 66: 'Lluvia helada', 67: 'Lluvia helada fuerte',
    71: 'Nieve débil', 73: 'Nieve', 75: 'Nieve intensa', 77: 'Granizo fino', 80: 'Chubascos', 81: 'Chubascos fuertes',
    82: 'Chubascos muy fuertes', 85: 'Chubascos de nieve', 86: 'Nevadas fuertes', 95: 'Tormenta eléctrica', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte con granizo'
  };

  // Ciclón tropical: esfera roja con volumen y la espiral blanca de nubes
  const SPIRAL = 'M12 2C8.2 2 5.5 3.6 4.3 6.3c2.2-1.4 5.3-1.4 6.9.4-3.5 0-6.6 2.3-6.6 5.8 0 .9.2 1.8.6 2.7 0-2.6 2.3-5 5-5-1.1 2.3-.4 5.4 1.9 6.6-.8-1.9.4-4.2 2.3-5 0 3.5-2.3 6.6-5.8 7.3.8.4 1.9.4 2.7.4 5.4 0 9.7-4.3 9.7-9.7C21 5.6 17.5 2 13.2 2H12Zm0 8.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z';
  const storm = () => svg(`<g filter="url(#w-sh)"><circle cx="32" cy="32" r="29" fill="url(#w-storm)"/>
    <ellipse cx="25" cy="18" rx="15" ry="9" fill="#fff" opacity=".28"/>
    <path d="${SPIRAL}" fill-rule="evenodd" fill="#fff" transform="translate(8.5 8.5) scale(1.96)"/></g>`, '0 0 64 64');

  const G = {
    mapa: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 0 0-6.9 12h3.4l1-2.2a2 2 0 0 1 .4-2.8l1.4-1c.4-.3.6-.7.6-1.2V6.5A2 2 0 0 1 14 4.3 8 8 0 0 0 12 4Zm5.5 2.2-1.5.8v2.5a3 3 0 0 1-1.3 2.4l-1.4 1 .4 1.1h2.8l1.4 2.4a8 8 0 0 0-.4-10.2Z"/>',
    clima: '<circle cx="8.5" cy="7.5" r="3.5"/><path d="M8 20.5a4.5 4.5 0 0 1-.7-9 6.2 6.2 0 0 1 11.7 1.5 3.9 3.9 0 0 1-.6 7.5z"/>',
    huracan: '<path fill-rule="evenodd" d="M12 2C8.2 2 5.5 3.6 4.3 6.3c2.2-1.4 5.3-1.4 6.9.4-3.5 0-6.6 2.3-6.6 5.8 0 .9.2 1.8.6 2.7 0-2.6 2.3-5 5-5-1.1 2.3-.4 5.4 1.9 6.6-.8-1.9.4-4.2 2.3-5 0 3.5-2.3 6.6-5.8 7.3.8.4 1.9.4 2.7.4 5.4 0 9.7-4.3 9.7-9.7C21 5.6 17.5 2 13.2 2H12Zm0 8.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6Z" fill-rule="evenodd"/>',
    alertas: '<path d="M12 22a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"/>',
    search: '<path fill-rule="evenodd" d="M10.5 3a7.5 7.5 0 0 1 6 12l4.3 4.3-1.5 1.5-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/>',
    menu: '<path d="M3 6h11v2H3zm16 0h2v2h-2zM3 16h2v2H3zm7 0h11v2H10zM3 11h6v2H3zm11 0h7v2h-7z"/><circle cx="16.5" cy="7" r="2.5"/><circle cx="7.5" cy="17" r="2.5"/><circle cx="11.5" cy="12" r="2.5"/>',
    close: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>',
    share: '<path d="M18 16a3 3 0 0 0-2.2 1l-7-4a3 3 0 0 0 0-2l7-4A3 3 0 1 0 15 5l-7 4a3 3 0 1 0 0 6l7 4a3 3 0 1 0 3-3Z"/>',
    pin: '<path fill-rule="evenodd" d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7Zm0 4.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"/>',
    gps: '<path fill-rule="evenodd" d="M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm1-6v2.1A8 8 0 0 1 19.9 11H22v2h-2.1A8 8 0 0 1 13 19.9V22h-2v-2.1A8 8 0 0 1 4.1 13H2v-2h2.1A8 8 0 0 1 11 4.1V2zm-1 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/>',
    plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
    trash: '<path d="M9 3h6l1 2h4v2H4V5h4zm-3 6h12l-1 12H7z"/>',
    wind: '<path d="M3 8h10a3 3 0 1 0-3-3h2a1 1 0 1 1 1 1H3zm0 4h15a3 3 0 1 1-3 3h2a1 1 0 1 0 1-1H3zm0 4h7v2H3z"/>',
    rain: '<path d="M7 13.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 17.8 6a3.8 3.8 0 0 1-.3 7.5z"/><path d="M8 15h1.8l-1.3 4H6.7zm4 0h1.8l-1.3 4h-1.8zm4 0h1.8l-1.3 4h-1.8z"/>',
    cloud: '<path d="M7 19a5 5 0 0 1-.7-10A7 7 0 0 1 19.4 11 4 4 0 0 1 18.5 19z"/>',
    temp: '<path fill-rule="evenodd" d="M12 2a3 3 0 0 1 3 3v8.3a5 5 0 1 1-6 0V5a3 3 0 0 1 3-3Zm0 2a1 1 0 0 0-1 1v9.3l-.4.3a3 3 0 1 0 2.8 0l-.4-.3V5a1 1 0 0 0-1-1Zm-1 7h2v5.3a2 2 0 1 1-2 0z"/>',
    drop: '<path d="M12 2s7 7.8 7 12.5a7 7 0 0 1-14 0C5 9.8 12 2 12 2Z"/>',
    sunrise: '<path d="M11 2h2v5h-2zM4.2 6.6l1.4-1.4 2.8 2.8L7 9.4zm11.4 1.4 2.8-2.8 1.4 1.4L17 9.4zM2 16h4a6 6 0 0 1 12 0h4v2H2zm6 0h8a4 4 0 0 0-8 0z"/>',
    uv: '<path d="M11 1h2v3h-2zm0 19h2v3h-2zM1 11h3v2H1zm19 0h3v2h-3zM4.2 5.6l1.4-1.4 2.1 2.1-1.4 1.4zm12.1 12.1 1.4-1.4 2.1 2.1-1.4 1.4zM4.2 18.4l2.1-2.1 1.4 1.4-2.1 2.1zm12.1-12.1 2.1-2.1 1.4 1.4-2.1 2.1zM12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"/>',
    air: '<path d="M4 10h10a3 3 0 1 0-3-3H9a5 5 0 1 1 5 5H4zm0 4h13a4 4 0 1 1-4 4h2a2 2 0 1 0 2-2H4z"/>',
    eye: '<path fill-rule="evenodd" d="M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>',
    gauge: '<path fill-rule="evenodd" d="M12 3a10 10 0 0 1 10 10c0 2.1-.6 4-1.7 5.6l-1.7-1A8 8 0 1 0 5.4 17.6l-1.7 1A10 10 0 0 1 12 3Zm4.6 4.6 1.4 1.4-4.2 4.6a2 2 0 1 1-1.5-1.3z"/>'
  };

  // Colores de las capas (iconos 3D de los chips)
  const LAYER = { viento: ['#5ce1ff', '#c9f6ff', '#1d7fd6'], lluvia: ['#4f8cff', '#bcd2ff', '#2a3fd1'], nubes: ['#c9d3e6', '#ffffff', '#7f8ca6'], humedad: ['#6fb8ff', '#d2ebff', '#2f5fd6'],
    temp: ['#ff8a3d', '#ffd0a8', '#e0402c'], huracan: ['#ff4f6d', '#ffc2cd', '#c11d45'] };
  const LAYER_G = { viento: G.wind, lluvia: G.rain, nubes: G.cloud, humedad: G.drop, temp: G.temp, huracan: G.huracan };

  window.OrbeIcons = {
    DEFS, WMO,
    ui: name => svg(G[name] || G.clima),
    weather, storm,
    /** Icono "3D" de capa: azulejo con degradado, brillo y sombra. */
    layer(name, size = 26) {
      const c = LAYER[name] || LAYER.viento;
      return `<span class="tile3d" style="--c:${c[0]};--c1:${c[1]};--c2:${c[2]};--s:${size}px">${svg(LAYER_G[name] || G.wind)}</span>`;
    },
    tile(glyph, colors, size = 44) {
      const c = colors || LAYER.viento;
      return `<span class="tile3d" style="--c:${c[0]};--c1:${c[1]};--c2:${c[2]};--s:${size}px">${svg(G[glyph] || glyph)}</span>`;
    },
    LAYER
  };
})();
