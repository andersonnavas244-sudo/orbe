/*
 * Mapa mundial del clima para Orbe Clima: viento, lluvia, temperatura y humedad en una rejilla de 6°
 * para las próximas 48 horas (cada 3 horas).
 * Datos: modelo GFS de NOAA (dominio público de EE. UU., uso comercial libre), servidos por el
 * ERDDAP de PacIOOS (Universidad de Hawái) — sin clave ni límites de uso comercial.
 * Lo publica el workflow de GitHub cada 6 horas en GitHub Pages (clima/grid.json) y la app lo
 * descarga de ahí (ClimaConfig.MIRROR_URL): un solo archivo pequeño para todos los usuarios.
 *
 * Uso: node OrbeClima/tools/build-grid.js [salida.json]
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = process.argv[2] || path.join(__dirname, 'cache', 'grid.json');
const ERDDAP = 'https://pae-paha.pacioos.hawaii.edu/erddap/griddap/ncep_global.json';
const STEP = 6;   // grados

/** Convierte la tabla de ERDDAP (tiempo, lat, lon, u, v, t, lluvia, humedad) a la rejilla de la app. */
function toGrid(table, step) {
  const ci = n => table.columnNames.indexOf(n);
  const [iT, iLa, iLo, iU, iV, iTm, iP, iH] = ['time', 'latitude', 'longitude', 'ugrd10m', 'vgrd10m', 'tmp2m', 'pratesfc', 'rh2m'].map(ci);
  const times = [...new Set(table.rows.map(r => r[iT]))].sort().map(t => Date.parse(t));
  const lat0 = -84, nlat = Math.round(168 / step) + 1, lng0 = -180, nlng = Math.round(360 / step);
  const n = nlat * nlng, steps = times.length;
  const mk = () => Array.from({ length: steps }, () => new Array(n).fill(0));
  const g = { generated: new Date().toISOString(), source: 'NOAA GFS (vía PacIOOS ERDDAP)', lat0, dlat: step, nlat, lng0, dlng: step, nlng, times,
    u: mk(), v: mk(), p: mk(), h: mk(), t: mk() };
  const tIdx = new Map(times.map((t, i) => [t, i]));
  const kmh = x => Math.round((x || 0) * 3.6);
  for (const r of table.rows) {
    const s = tIdx.get(Date.parse(r[iT]));
    const i = Math.round((r[iLa] - lat0) / step);
    let lon = r[iLo]; if (lon >= 180) lon -= 360;
    const j = Math.round((lon - lng0) / step);
    if (s == null || i < 0 || i >= nlat || j < 0 || j >= nlng) continue;
    const k = i * nlng + j;
    g.u[s][k] = kmh(r[iU]); g.v[s][k] = kmh(r[iV]);
    g.p[s][k] = Math.round(Math.max(0, r[iP] || 0) * 3600 * 3 * 10);   // décimas de mm en 3 h
    g.t[s][k] = Math.round((r[iTm] || 273.15) - 273.15);
    g.h[s][k] = Math.round(r[iH] || 0);
  }
  return g;
}

function query(step, hours = 48) {
  const iso = d => d.toISOString().slice(0, 13) + ':00:00Z';
  const t0 = new Date(), t1 = new Date(Date.now() + hours * 3600e3);
  const sub = `[(${iso(t0)}):1:(${iso(t1)})][(-84):${step * 2}:(84)][(0):${step * 2}:(${360 - step})]`;
  return ERDDAP + '?' + ['ugrd10m', 'vgrd10m', 'tmp2m', 'pratesfc', 'rh2m'].map(v => v + encodeURIComponent(sub).replace(/%3A/g, ':')).join(',');
}

if (require.main === module) {
  (async () => {
    let j = null;
    for (let tries = 0; tries < 4 && !j; tries++) {
      try {
        const r = await fetch(query(STEP), { headers: { 'User-Agent': 'OrbeClima-build/1.1' }, signal: AbortSignal.timeout(180000) });
        if (r.ok) j = await r.json(); else { console.warn('HTTP', r.status, (await r.text()).slice(0, 200)); await new Promise(z => setTimeout(z, 20000)); }
      } catch (e) { console.warn(e.message); await new Promise(z => setTimeout(z, 20000)); }
    }
    if (!j) throw new Error('ERDDAP no respondió');
    const g = toGrid(j.table, STEP);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(g));
    console.log(`${g.nlat * g.nlng} puntos × ${g.times.length} horas → ${OUT} (${(fs.statSync(OUT).size / 1e3).toFixed(0)} KB)`);
  })().catch(e => { console.error(e); process.exit(1); });
}
module.exports = { toGrid, query };
