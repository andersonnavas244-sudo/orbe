/*
 * Catálogo de Orbe Podcasts: los 50 podcasts más escuchados de cada país (listas oficiales de
 * Apple Podcasts) + el centro de cada país para ubicarlos en el globo.
 *   app/src/main/assets/www/data/catalogo.json
 *   app/src/main/assets/www/data/paises.json
 * La app además descarga en vivo el top de cada país y los episodios (iTunes Search API).
 *
 * Uso: node OrbePodcasts/tools/build-catalog.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const WWW = path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'www');
const GEO = path.join(__dirname, '..', '..', 'OrbeEspacio', 'app', 'src', 'main', 'assets', 'www', 'lib', 'countries.geojson');
// Tiendas de Apple con listas de podcasts (primero Latinoamérica y España)
const PAISES = ['co', 'mx', 'ar', 'cl', 'pe', 'ec', 've', 'bo', 'py', 'uy', 'cr', 'pa', 'gt', 'hn', 'sv', 'ni', 'do', 'es', 'us', 'ca', 'br', 'pt',
  'gb', 'ie', 'fr', 'de', 'it', 'nl', 'be', 'ch', 'at', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'gr', 'tr', 'ua', 'ro', 'hu', 'il', 'ae', 'sa', 'eg',
  'za', 'ng', 'ke', 'in', 'pk', 'id', 'ph', 'th', 'vn', 'my', 'sg', 'jp', 'kr', 'tw', 'hk', 'au', 'nz'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ART = /^https:\/\/is\d-ssl\.mzstatic\.com\/image\/thumb\/(.+)\/\d+x\d+bb\.(jpg|png|webp)$/;

// Centro de cada país: promedio del polígono más grande (queda dentro del país casi siempre)
function centers() {
  const geo = JSON.parse(fs.readFileSync(GEO, 'utf8'));
  const fix = { France: 'FR', Norway: 'NO', Kosovo: 'XK' };
  const out = {};
  for (const f of geo.features) {
    let cc = f.properties.ISO_A2;
    if (!cc || cc === '-99') cc = fix[f.properties.ADMIN] || f.properties.ISO_A2_EH;
    if (!cc || cc === '-99') continue;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    let best = null, area = -1;
    for (const p of polys) {
      const ring = p[0]; let a = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
      if (Math.abs(a) > area) { area = Math.abs(a); best = ring; }
    }
    let x = 0, y = 0;
    for (const [lx, ly] of best) { x += lx; y += ly; }
    out[cc.toLowerCase()] = [+(y / best.length).toFixed(2), +(x / best.length).toFixed(2)];
  }
  // ajustes: territorios de ultramar que desplazan el centro
  Object.assign(out, { sg: [1.35, 103.82], hk: [22.32, 114.17], fr: [46.6, 2.4], no: [61.5, 9.5], us: [39.5, -98.4], ca: [56.1, -106.3], cl: [-35.7, -71.5], ru: [61.5, 99.0], nz: [-41.5, 172.7] });
  return out;
}

(async () => {
  const seen = new Map();
  for (const cc of PAISES) {
    const url = `https://rss.marketingtools.apple.com/api/v2/${cc}/podcasts/top/50/podcasts.json`;
    let res = null;
    for (let t = 0; t < 3 && !res; t++) {
      try {
        const r = await fetch(url, { headers: { 'User-Agent': 'OrbePodcasts-build/1.0' }, signal: AbortSignal.timeout(20000) });
        if (r.ok) res = (await r.json()).feed.results; else await sleep(3000);
      } catch (e) { await sleep(3000); }
    }
    if (!res) { console.warn('  sin datos:', cc); continue; }
    let added = 0;
    res.forEach((p, rank) => {
      const m = ART.exec(p.artworkUrl100 || '');
      const g = (p.genres || [])[0];
      if (!m || !p.id) return;
      if (seen.has(p.id)) { seen.get(p.id).charts.push([cc, rank + 1]); return; }
      seen.set(p.id, { id: p.id, name: (p.name || '').trim(), author: (p.artistName || '').replace(/\s{2,}.*$/, '').trim(), art: m[1] + '.' + m[2],
        genre: g ? +g.genreId : 26, cc, rank: rank + 1, charts: [[cc, rank + 1]] });
      added++;
    });
    process.stdout.write(`${cc}:${added} `);
    await sleep(350);
  }
  console.log('');
  // Fila compacta: [id, nombre, autor, arte, género, país, puesto, países donde está en el top]
  const rows = [...seen.values()].map(p => [p.id, p.name, p.author, p.art, p.genre, p.cc, p.rank, p.charts.length]);
  const out = { generated: new Date().toISOString(), source: 'Apple Podcasts (listas por país)', fields: ['id', 'name', 'author', 'art', 'genre', 'cc', 'rank', 'charts'], rows };
  fs.mkdirSync(path.join(WWW, 'data'), { recursive: true });
  fs.writeFileSync(path.join(WWW, 'data', 'catalogo.json'), JSON.stringify(out));
  const c = centers();
  const used = {};
  for (const cc of PAISES) if (c[cc]) used[cc] = c[cc];
  fs.writeFileSync(path.join(WWW, 'data', 'paises.json'), JSON.stringify(used));
  console.log(`${rows.length} podcasts de ${PAISES.length} países → catalogo.json (${(fs.statSync(path.join(WWW, 'data', 'catalogo.json')).size / 1e3).toFixed(0)} KB)`);
  const missing = PAISES.filter(cc => !c[cc]); if (missing.length) console.log('sin centro:', missing.join(','));
})().catch(e => { console.error(e); process.exit(1); });
