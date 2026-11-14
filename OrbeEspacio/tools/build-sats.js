/*
 * Genera app/src/main/assets/www/data/sats.json: el catálogo de satélites activos (CelesTrak,
 * formato OMM compacto) con el tipo de cada satélite.
 *   - Va dentro del APK para que la app funcione desde el primer segundo, incluso sin internet.
 *   - El workflow de GitHub lo publica cada día en GitHub Pages (espacio/sats.json); la app lo
 *     descarga de ahí (MIRROR en espacio.js) para no depender de los límites de CelesTrak.
 *
 * Uso: node OrbeEspacio/tools/build-sats.js
 * CelesTrak permite descargar cada grupo una vez cada 2 horas por IP: se guarda una copia en
 * tools/cache y, si algo falla, se conserva el tipo que ya tenía cada satélite.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www', 'data', 'sats.json');
const CACHE = path.join(__dirname, 'cache');
// Grupos de CelesTrak → tipo en la app (el primero que aparece gana)
const GROUPS = [
  ['stations', 'est'], ['starlink', 'starlink'], ['oneweb', 'net'], ['kuiper', 'net'], ['qianfan', 'net'],
  ['gnss', 'nav'], ['weather', 'clima'], ['resource', 'tierra'], ['planet', 'tierra'], ['spire', 'tierra'],
  ['science', 'ciencia'], ['geodetic', 'ciencia'], ['geo', 'com'], ['iridium-NEXT', 'com'], ['globalstar', 'com'],
  ['orbcomm', 'com'], ['amateur', 'edu'], ['cubesat', 'edu'], ['military', 'mil']
];

// Igual que classify() en espacio.js, para satélites nuevos que aún no están en ningún grupo
function classify(name) {
  const n = name.toUpperCase();
  if (/^STARLINK/.test(n)) return 'starlink';
  if (/^(ONEWEB|KUIPER|QIANFAN|GUOWANG|SPACESAIL|HULIANWANG)/.test(n)) return 'net';
  if (/(NAVSTAR|GPS |GLONASS|GALILEO|BEIDOU|QZS|IRNSS|NAVIC|GSAT0)/.test(n)) return 'nav';
  if (/(NOAA|GOES|METEOSAT|METOP|HIMAWARI|FENGYUN|FY-\d|ELEKTRO|METEOR|DMSP|JPSS|SUOMI|GEO-KOMPSAT)/.test(n)) return 'clima';
  if (/(LANDSAT|SENTINEL|WORLDVIEW|PLEIADES|SPOT |FLOCK|LEMUR|SKYSAT|ICEYE|CAPELLA|RADARSAT|TERRA|AQUA|GAOFEN|JILIN|SUPERVIEW|PLANETSCOPE|CBERS)/.test(n)) return 'tierra';
  if (/(^HST$|HUBBLE|CHANDRA|SWIFT|FERMI|NUSTAR|TESS|XMM|INTEGRAL|ASTROSAT|EINSTEIN|AGILE|GRACE|ICESAT|CALIPSO|SMAP|SWOT)/.test(n)) return 'ciencia';
  if (/(IRIDIUM|INTELSAT|SES|EUTELSAT|ASTRA|GLOBALSTAR|ORBCOMM|INMARSAT|TELSTAR|ECHOSTAR|VIASAT|AMAZONAS|HISPASAT|ARABSAT|TURKSAT|CHINASAT|APSTAR|ASIASAT|JCSAT|SKYNET|DIRECTV|O3B|TDRS|MUOS|NILESAT|YAMAL|EXPRESS)/.test(n)) return 'com';
  if (/(CUBESAT|AMSAT|OSCAR|FUNCUBE|^AO-|^SO-|^FO-|^IO-|^CAS-)/.test(n)) return 'edu';
  if (/^(USA |COSMOS|YAOGAN|NROL|SBIRS|WGS|AEHF|OFEK)/.test(n)) return 'mil';
  if (/^(ISS|CSS|TIANHE|WENTIAN|MENGTIAN)/.test(n)) return 'est';
  return 'otros';
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function group(name) {
  const file = path.join(CACHE, name + '.json');
  const fresh = fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 2 * 3600e3;
  if (!fresh) {
    try {
      const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(name)}&FORMAT=json`;
      const r = await fetch(url, { headers: { 'User-Agent': 'OrbeEspacio-build/1.0' } });
      const t = await r.text();
      if (r.ok && t.trim().startsWith('[')) fs.writeFileSync(file, t);
      else console.warn(`  ${name}: ${r.status} ${t.slice(0, 80).replace(/\s+/g, ' ')}`);
    } catch (e) { console.warn(`  ${name}: ${e.message}`); }
    await sleep(1500);
  }
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null; } catch (e) { return null; }
}
const row = (o, cat) => [o.OBJECT_NAME, o.NORAD_CAT_ID, o.OBJECT_ID, o.EPOCH, o.MEAN_MOTION, o.ECCENTRICITY, o.INCLINATION,
  o.RA_OF_ASC_NODE, o.ARG_OF_PERICENTER, o.MEAN_ANOMALY, o.BSTAR, o.MEAN_MOTION_DOT, o.MEAN_MOTION_DDOT, cat];

(async () => {
  fs.mkdirSync(CACHE, { recursive: true });
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* primera vez */ }
  const prevCat = new Map(prev ? prev.rows.map(r => [r[1], r[13]]) : []);

  const catOf = new Map(), union = new Map();
  for (const [g, cat] of GROUPS) {
    const list = await group(g);
    if (!list) continue;
    for (const o of list) {
      if (!catOf.has(o.NORAD_CAT_ID)) catOf.set(o.NORAD_CAT_ID, cat);
      if (!union.has(o.NORAD_CAT_ID)) union.set(o.NORAD_CAT_ID, o);
    }
    console.log(`${g.padEnd(13)} ${String(list.length).padStart(6)}`);
  }
  const active = await group('active');
  const source = active || [...union.values()];
  console.log(`active        ${active ? active.length : 'no disponible: se usan los grupos'}`);
  if (!source.length) { console.error('Sin datos de CelesTrak: se conserva el archivo anterior.'); return; }
  // Datos más frescos de cada grupo (p. ej. la Estación Espacial) sobre los de "active"
  const byId = new Map(source.map(o => [o.NORAD_CAT_ID, o]));
  for (const [id, o] of union) if (!byId.has(id) || o.EPOCH > byId.get(id).EPOCH) byId.set(id, o);

  const rows = [...byId.values()].map(o => row(o, catOf.get(o.NORAD_CAT_ID) || prevCat.get(o.NORAD_CAT_ID) || classify(o.OBJECT_NAME)));
  if (prev && rows.length < prev.rows.length * 0.8) {
    console.error(`Solo ${rows.length} satélites (antes ${prev.rows.length}): parece una descarga incompleta, se conserva el archivo anterior.`);
    return;
  }
  const out = { generated: new Date().toISOString(), source: 'CelesTrak (celestrak.org)', count: rows.length, rows };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const counts = {};
  for (const r of rows) counts[r[13]] = (counts[r[13]] || 0) + 1;
  console.log(`\n${rows.length} satélites → ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(2)} MB)`, counts);
})().catch(e => { console.error(e); process.exit(1); });
