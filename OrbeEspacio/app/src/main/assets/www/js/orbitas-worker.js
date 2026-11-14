/* Orbe Espacio – cálculo de órbitas (SGP4) de miles de satélites.
 * Normalmente corre en segundo plano (Web Worker). Si el equipo no permite workers, la misma
 * función se usa desde la página (window.OrbitasLocal).
 * Recibe el catálogo y, cada vez que se le pide, devuelve la posición 3D de todos los satélites
 * (en coordenadas del globo) y si están iluminados por el Sol o en la sombra de la Tierra. */
(function () {
  'use strict';
  const isWorker = typeof importScripts === 'function' && typeof window === 'undefined';
  if (isWorker) importScripts('../lib/satellite.min.js');
  const S = self.satellite;

  const R = 100;                 // radio del globo en la escena
  const RE = 6371;               // radio medio de la Tierra (km)
  const D2R = Math.PI / 180;
  let recs = [];

  function toOmm(r) {
    return { OBJECT_NAME: r[0], NORAD_CAT_ID: r[1], OBJECT_ID: r[2], EPOCH: r[3], MEAN_MOTION: r[4], ECCENTRICITY: r[5],
      INCLINATION: r[6], RA_OF_ASC_NODE: r[7], ARG_OF_PERICENTER: r[8], MEAN_ANOMALY: r[9], BSTAR: r[10],
      MEAN_MOTION_DOT: r[11], MEAN_MOTION_DDOT: r[12] };
  }

  function handle(m, post) {
    if (m.type === 'init') {
      recs = m.rows.map(r => { try { return S.json2satrec(toOmm(r)); } catch (err) { return null; } });
      post({ type: 'ready', n: recs.length });
      return;
    }
    if (m.type !== 'step') return;
    const n = recs.length;
    const pos = new Float32Array(n * 3);
    const lit = new Uint8Array(n);
    const jd = m.t / 86400000 + 2440587.5;
    const gmst = S.gstime(jd);
    // Dirección del Sol en coordenadas del globo (desde el punto subsolar)
    const sp = (90 - m.sunLat) * D2R, st = (90 - m.sunLng) * D2R;
    const sx = Math.sin(sp) * Math.cos(st), sy = Math.cos(sp), sz = Math.sin(sp) * Math.sin(st);
    for (let i = 0; i < n; i++) {
      const rec = recs[i];
      if (!rec) { lit[i] = 255; continue; }
      const tsince = (jd - rec.jdsatepoch) * 1440;
      let pv;
      try { pv = S.sgp4(rec, tsince); } catch (err) { pv = null; }
      if (!pv || !pv.position || rec.error) { lit[i] = 255; continue; }
      const g = S.eciToGeodetic(pv.position, gmst);
      if (!(g.height > 80) || !isFinite(g.height)) { lit[i] = 255; continue; }   // ya reingresó
      const phi = Math.PI / 2 - g.latitude, theta = Math.PI / 2 - g.longitude;
      const r = R * (1 + g.height / RE);
      const x = r * Math.sin(phi) * Math.cos(theta), y = r * Math.cos(phi), z = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      // ¿En la sombra de la Tierra? (sombra cilíndrica)
      const d = x * sx + y * sy + z * sz;
      if (d < 0) {
        const px = x - d * sx, py = y - d * sy, pz = z - d * sz;
        lit[i] = (px * px + py * py + pz * pz) < R * R ? 0 : 1;
      } else lit[i] = 1;
    }
    post({ type: 'pos', id: m.id, t: m.t, pos, lit }, [pos.buffer, lit.buffer]);
  }

  if (isWorker) self.onmessage = e => handle(e.data, (d, tr) => self.postMessage(d, tr || []));
  else self.OrbitasLocal = handle;
})();
