/* Orbe Podcasts – iconos vectoriales (nítidos en pantallas 4K) y géneros */
(() => {
  'use strict';

  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <linearGradient id="g-tab" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9ccb"/><stop offset=".55" stop-color="#b06bff"/><stop offset="1" stop-color="#5ce1ff"/></linearGradient>
  </defs></svg>`;
  const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;

  const G = {
    mapa: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 0 0-6.9 12h3.4l1-2.2a2 2 0 0 1 .4-2.8l1.4-1c.4-.3.6-.7.6-1.2V6.5A2 2 0 0 1 14 4.3 8 8 0 0 0 12 4Zm5.5 2.2-1.5.8v2.5a3 3 0 0 1-1.3 2.4l-1.4 1 .4 1.1h2.8l1.4 2.4a8 8 0 0 0-.4-10.2Z"/>',
    explorar: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm4.6 5.4-6.3 2.9-2.9 6.3 6.3-2.9 2.9-6.3ZM12 10.8a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/>',
    biblioteca: '<path d="M4 3h3v18H4zm5 0h3v18H9zm5.2 1.1 2.9-.8 4.6 17.1-2.9.8z"/>',
    buscar: '<path fill-rule="evenodd" d="M10.5 3a7.5 7.5 0 0 1 6 12l4.3 4.3-1.5 1.5-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/>',
    menu: '<path d="M3 6h11v2H3zm16 0h2v2h-2zM3 16h2v2H3zm7 0h11v2H10zM3 11h6v2H3zm11 0h7v2h-7z"/><circle cx="16.5" cy="7" r="2.5"/><circle cx="7.5" cy="17" r="2.5"/><circle cx="11.5" cy="12" r="2.5"/>',
    close: '<path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z"/>',
    play: '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.9l10.6-6.8a1 1 0 0 0 0-1.7L9.5 4.3A1 1 0 0 0 8 5.2Z"/>',
    pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/>',
    back15: '<path d="M12 4V1L7 5l5 4V6a7 7 0 1 1-7 7H3a9 9 0 1 0 9-9Z"/>',
    fwd30: '<path d="M12 4V1l5 4-5 4V6a7 7 0 1 0 7 7h2a9 9 0 1 1-9-9Z"/>',
    moon: '<path d="M14.5 2.5A9.5 9.5 0 1 0 21.5 17 8 8 0 0 1 14.5 2.5Z"/>',
    cast: '<path d="M3 17v3h3a3 3 0 0 0-3-3Zm0-4v2a5 5 0 0 1 5 5h2a7 7 0 0 0-7-7Zm0-4v2a9 9 0 0 1 9 9h2A11 11 0 0 0 3 9Zm18-6H3a2 2 0 0 0-2 2v3h2V5h18v14h-7v2h7a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z"/>',
    share: '<path d="M18 16a3 3 0 0 0-2.2 1l-7-4a3 3 0 0 0 0-2l7-4A3 3 0 1 0 15 5l-7 4a3 3 0 1 0 0 6l7 4a3 3 0 1 0 3-3Z"/>',
    plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
    check: '<path d="m9.5 16.2-4.2-4.2-1.4 1.4 5.6 5.6 11-11-1.4-1.4z"/>',
    mic: '<path d="M12 2a3.5 3.5 0 0 1 3.5 3.5v6a3.5 3.5 0 0 1-7 0v-6A3.5 3.5 0 0 1 12 2ZM6 11h2a4 4 0 0 0 8 0h2a6 6 0 0 1-5 5.9V20h3v2H8v-2h3v-3.1A6 6 0 0 1 6 11Z"/>',
    globe: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1.6 2.2A8 8 0 0 0 4.1 11h3.4c.1-2.5.9-4.9 2.9-6.8ZM12 4.5c-1.6 1.6-2.4 3.9-2.5 6.5h5c-.1-2.6-.9-4.9-2.5-6.5Zm1.6-.3c2 1.9 2.8 4.3 2.9 6.8h3.4a8 8 0 0 0-6.3-6.8ZM4.1 13a8 8 0 0 0 6.3 6.8c-2-1.9-2.8-4.3-2.9-6.8H4.1Zm5.4 0c.1 2.6.9 4.9 2.5 6.5 1.6-1.6 2.4-3.9 2.5-6.5h-5Zm7 0c-.1 2.5-.9 4.9-2.9 6.8a8 8 0 0 0 6.3-6.8h-3.4Z"/>'
  };

  // Géneros de la app (agrupan los de Apple Podcasts)
  const GEN = {
    noticias: { n: 'Noticias', c: ['#5ce1ff', '#c4f6ff', '#1b86b8'], g: '<path d="M4 4h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V4Zm2 3v3h9V7H6Zm0 5v2h9v-2H6Zm0 4v2h6v-2H6Zm13-9h2v11a2 2 0 0 1-2 2V7Z"/>' },
    comedia: { n: 'Comedia', c: ['#ffe066', '#fff4b8', '#d9a100'], g: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20ZM8.5 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm7 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM7 13.5a5 5 0 0 0 10 0z"/>' },
    sociedad: { n: 'Sociedad y cultura', c: ['#ffb547', '#ffe0ad', '#d06a0a'], g: '<circle cx="8" cy="7.5" r="3.2"/><circle cx="16.5" cy="8.5" r="2.7"/><path d="M2 20a6 6 0 0 1 12 0zm11.5 0a6.5 6.5 0 0 0-1.7-4.4A5 5 0 0 1 22 19v1z"/>' },
    crimen: { n: 'Crimen real', c: ['#ff4f6d', '#ffc0cb', '#b5163a'], g: '<path fill-rule="evenodd" d="M10.5 3a7.5 7.5 0 0 1 6 12l4.3 4.3-1.5 1.5-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z"/><path d="M8 10.5h5v1.6H8z"/>' },
    historia: { n: 'Historia', c: ['#d4a373', '#f3dcc0', '#8a5a2b'], g: '<path d="M12 2 2 7v2h20V7zM4 10h2.5v8H4zm4.7 0h2.5v8H8.7zm4.6 0h2.5v8h-2.5zm4.7 0H20v8h-2.5zM2 19h20v3H2z"/>' },
    negocios: { n: 'Negocios', c: ['#2fd6a0', '#b4f5df', '#0b8a64'], g: '<path d="M3 20h18v2H3z"/><path d="M5 13h3v6H5zm5-4h3v10h-3zm5-5h3v15h-3z"/>' },
    salud: { n: 'Salud y bienestar', c: ['#a3e635', '#e6fbb8', '#5c8f0b'], g: '<path d="M12 21s-8-5.2-8-11.2A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8 3.2C20 15.8 12 21 12 21Z"/>' },
    educacion: { n: 'Educación', c: ['#7b8cff', '#d2d8ff', '#3a47c9'], g: '<path d="M12 3.5 1.5 8.8 12 14l8.6-4.3v6.1h1.9V8.8z"/><path d="M6 12.4v3.8c0 1.8 2.7 3.3 6 3.3s6-1.5 6-3.3v-3.8l-6 3z"/>' },
    religion: { n: 'Religión y espiritualidad', c: ['#d6a8ff', '#f1e2ff', '#8a4cc9'], g: '<path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z"/>' },
    deportes: { n: 'Deportes', c: ['#ff6b3d', '#ffcbb8', '#c4370e'], g: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 4.2-3.2 2.3 1.2 3.8h4l1.2-3.8zM4.3 10.8a7.9 7.9 0 0 0 1.4 5.3l2.2-.8-1.1-3.6zm15.4 0-2.5.9-1.1 3.6 2.2.8a7.9 7.9 0 0 0 1.4-5.3zm-9.4 7.1-1.3 1.9a8 8 0 0 0 6 0l-1.3-1.9z"/>' },
    ciencia: { n: 'Ciencia y tecnología', c: ['#4f8cff', '#c7dbff', '#1e4fc2'], g: '<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="10" ry="3.8" fill="none" stroke="currentColor" stroke-width="1.8"/><ellipse cx="12" cy="12" rx="10" ry="3.8" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="3.8" fill="none" stroke="currentColor" stroke-width="1.8" transform="rotate(-60 12 12)"/>' },
    cultura: { n: 'Arte, cine y música', c: ['#e8559b', '#ffc4df', '#a3165a'], g: '<path d="M9 3v11.3A3.5 3.5 0 1 0 11 17.5V8h7V3z"/>' },
    ninos: { n: 'Niños y familia', c: ['#f9a8d4', '#ffe1f1', '#c2448a'], g: '<path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/>' },
    ocio: { n: 'Ocio y videojuegos', c: ['#c084fc', '#ecd9ff', '#7a33c4'], g: '<path fill-rule="evenodd" d="M7 7h10a5 5 0 0 1 4.9 6l-.8 4a2.6 2.6 0 0 1-4.6 1L15 16H9l-1.5 2a2.6 2.6 0 0 1-4.6-1l-.8-4A5 5 0 0 1 7 7Zm0 3v1.5H5.5V13H7v1.5h1.5V13H10v-1.5H8.5V10zm8.5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm2 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>' },
    otros: { n: 'Otros', c: ['#94a3b8', '#e2e8f0', '#566377'], g: G.mic }
  };
  // Códigos de género de Apple Podcasts → género de la app
  const RANGES = [
    ['noticias', [1489, 1490, 1526, 1527, 1528, 1529, 1530, 1531, 1511, 1311, 1325]],
    ['comedia', [1303, 1495, 1496, 1497]],
    ['sociedad', [1324, 1543, 1302, 1443, 1320, 1544]],
    ['crimen', [1488]], ['historia', [1487]],
    ['negocios', [1321, 1410, 1493, 1412, 1491, 1492, 1494]],
    ['salud', [1512, 1513, 1514, 1515, 1516, 1517, 1518, 1307]],
    ['educacion', [1304, 1498, 1499, 1500, 1501]],
    ['religion', [1314, 1438, 1439, 1463, 1440, 1441, 1532, 1444]],
    ['deportes', [1545, 1546, 1547, 1548, 1549, 1550, 1551, 1552, 1553, 1554, 1555, 1556, 1557, 1558, 1559, 1560]],
    ['ciencia', [1318, 1533, 1534, 1535, 1536, 1537, 1538, 1539, 1540, 1541, 1542]],
    ['cultura', [1301, 1482, 1402, 1459, 1306, 1405, 1406, 1309, 1561, 1562, 1563, 1564, 1565, 1310, 1523, 1524, 1525, 1483, 1484, 1485, 1486]],
    ['ninos', [1305, 1519, 1520, 1521, 1522]],
    ['ocio', [1502, 1503, 1504, 1505, 1506, 1507, 1508, 1509, 1510]]
  ];
  const BY_ID = {};
  for (const [k, ids] of RANGES) for (const id of ids) BY_ID[id] = k;
  const ORDER = ['noticias', 'sociedad', 'comedia', 'crimen', 'historia', 'negocios', 'salud', 'educacion', 'religion', 'deportes', 'ciencia', 'cultura', 'ninos', 'ocio', 'otros'];

  window.OrbeIcons = {
    DEFS, GEN, ORDER,
    genreOf: id => BY_ID[+id] || 'otros',
    ui: name => svg(G[name] || G.mic),
    /** Icono "3D" de género: azulejo con degradado, brillo y sombra. */
    genre(k, size = 26) {
      const g = GEN[k] || GEN.otros;
      return `<span class="tile3d" style="--c:${g.c[0]};--c1:${g.c[1]};--c2:${g.c[2]};--s:${size}px">${svg(g.g)}</span>`;
    }
  };
})();
