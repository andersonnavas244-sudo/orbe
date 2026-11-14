#!/usr/bin/env node
/*
 * Genera app/src/main/assets/www/data/stations.json: el catálogo compacto de TODAS
 * las emisoras activas de Radio Browser (https://www.radio-browser.info), con
 * coordenadas para el globo 3D.
 *
 *   node tools/build-catalog.js
 *
 * Las emisoras sin coordenadas se ubican de forma aproximada dentro de su país
 * (cerca de otras emisoras del mismo país, o dentro de su silueta) y se marcan
 * con approx=1 para que la app lo indique.
 */
const fs = require('fs');
const path = require('path');

const WWW = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');
const Genres = require(path.join(WWW, 'js', 'genres.js'));
const MIRRORS = ['de1', 'de2', 'fi1', 'nl1', 'at1'].map(m => `https://${m}.api.radio-browser.info`);

async function fetchJson(pathAndQuery) {
  let lastErr;
  for (const base of MIRRORS) {
    try {
      const res = await fetch(base + pathAndQuery, { headers: { 'User-Agent': 'OrbeRadio/1.0' } });
      if (!res.ok) throw new Error(base + ' HTTP ' + res.status);
      return await res.json();
    } catch (e) { lastErr = e; console.warn('  espejo falló:', e.message); }
  }
  throw lastErr;
}

// FNV-1a -> generador pseudoaleatorio determinista por emisora
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function () {
    h += 0x6D2B79F5; let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pointInPolys(lng, lat, polys) {
  return polys.some(p => pointInRing(lng, lat, p[0]) && !p.slice(1).some(h => pointInRing(lng, lat, h)));
}

function loadCountryShapes() {
  const geo = JSON.parse(fs.readFileSync(path.join(WWW, 'lib', 'countries.geojson'), 'utf8'));
  const FIX = { France: 'FR', Norway: 'NO', Kosovo: 'XK' };
  const shapes = {};
  for (const f of geo.features) {
    const p = f.properties;
    let cc = p.ISO_A2;
    if (!cc || cc === '-99') cc = FIX[p.ADMIN] || (p.WB_A2 !== '-99' ? p.WB_A2 : null);
    if (!cc) continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let minX = 180, maxX = -180, minY = 90, maxY = -90;
    for (const poly of polys) for (const [x, y] of poly[0]) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    shapes[cc] = { polys, bbox: [minX, minY, maxX, maxY] };
  }
  return shapes;
}

const r4 = n => Math.round(n * 1e4) / 1e4;

(async () => {
  console.log('Descargando estadísticas…');
  const stats = await fetchJson('/json/stats');
  console.log(`  Radio Browser reporta ${stats.stations} emisoras (${stats.stations_broken} caídas).`);

  console.log('Descargando catálogo completo (puede tardar 1–2 min)…');
  const all = await fetchJson('/json/stations?hidebroken=true&limit=200000&order=clickcount&reverse=true');
  console.log(`  ${all.length} emisoras recibidas.`);

  const shapes = loadCountryShapes();
  const seen = new Set();
  const stations = [];
  const countryNames = {};
  const geoByCountry = {};

  for (const s of all) {
    const url = (s.url_resolved || s.url || '').trim();
    const name = (s.name || '').replace(/\s+/g, ' ').trim();
    if (!url || !name || !/^https?:\/\//i.test(url)) continue;
    const key = name.toLowerCase() + '|' + url;
    if (seen.has(key)) continue;
    seen.add(key);
    const cc = (s.countrycode || '').toUpperCase();
    if (cc && s.country && !countryNames[cc]) countryNames[cc] = s.country;
    const hasGeo = typeof s.geo_lat === 'number' && typeof s.geo_long === 'number' &&
      Math.abs(s.geo_lat) <= 90 && Math.abs(s.geo_long) <= 180 && !(s.geo_lat === 0 && s.geo_long === 0);
    const st = { s, url, name, cc, lat: hasGeo ? s.geo_lat : null, lng: hasGeo ? s.geo_long : null, approx: 0 };
    if (hasGeo && cc) (geoByCountry[cc] = geoByCountry[cc] || []).push(st);
    stations.push(st);
  }

  // Ubicación aproximada para las emisoras sin coordenadas
  let placedNear = 0, placedShape = 0, noPlace = 0;
  for (const st of stations) {
    if (st.lat !== null) continue;
    const rnd = seeded(st.s.stationuuid || st.name);
    const anchors = geoByCountry[st.cc];
    const shape = shapes[st.cc];
    if (anchors && anchors.length >= 3) {
      const a = anchors[Math.floor(rnd() * anchors.length)];
      st.lat = Math.max(-89, Math.min(89, a.lat + (rnd() - 0.5) * 0.6));
      st.lng = a.lng + (rnd() - 0.5) * 0.6;
      st.approx = 1; placedNear++;
    } else if (shape) {
      const [x0, y0, x1, y1] = shape.bbox;
      for (let i = 0; i < 300; i++) {
        const lng = x0 + rnd() * (x1 - x0), lat = y0 + rnd() * (y1 - y0);
        if (pointInPolys(lng, lat, shape.polys)) { st.lat = lat; st.lng = lng; break; }
      }
      if (st.lat === null && anchors && anchors.length) { st.lat = anchors[0].lat + (rnd() - 0.5) * 0.4; st.lng = anchors[0].lng + (rnd() - 0.5) * 0.4; }
      if (st.lat !== null) { st.approx = 1; placedShape++; } else noPlace++;
    } else if (anchors && anchors.length) {
      st.lat = anchors[0].lat + (rnd() - 0.5) * 0.4; st.lng = anchors[0].lng + (rnd() - 0.5) * 0.4;
      st.approx = 1; placedNear++;
    } else noPlace++;
  }

  const FIELDS = ['id', 'name', 'url', 'lat', 'lng', 'approx', 'cc', 'genres', 'tags', 'codec', 'bitrate', 'hls', 'votes', 'favicon', 'lang', 'home'];
  const rows = stations.map(st => {
    const s = st.s;
    const { mask } = Genres.classify(s.tags, st.name);
    const tags = (s.tags || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 6).join(', ').slice(0, 70);
    return [
      s.stationuuid, st.name.slice(0, 90), st.url,
      st.lat === null ? null : r4(st.lat), st.lng === null ? null : r4(st.lng), st.approx,
      st.cc, mask, tags, (s.codec || '').slice(0, 8), s.bitrate || 0, s.hls ? 1 : 0, s.votes || 0,
      (s.favicon || '').slice(0, 200), (s.language || '').split(',')[0].slice(0, 20), (s.homepage || '').slice(0, 150)
    ];
  });

  const out = {
    v: 1,
    generated: new Date().toISOString(),
    source: 'Radio Browser (radio-browser.info) – datos públicos',
    apiTotal: stats.stations,
    fields: FIELDS,
    countries: countryNames,
    rows
  };
  const dest = path.join(WWW, 'data', 'stations.json');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out));
  const mb = (fs.statSync(dest).size / 1048576).toFixed(1);
  console.log(`Listo: ${rows.length} emisoras en ${Object.keys(countryNames).length} países → ${dest} (${mb} MB)`);
  console.log(`  con coordenadas reales: ${rows.length - placedNear - placedShape - noPlace}, aproximadas: ${placedNear + placedShape}, sin ubicación: ${noPlace}`);
})().catch(e => { console.error(e); process.exit(1); });
