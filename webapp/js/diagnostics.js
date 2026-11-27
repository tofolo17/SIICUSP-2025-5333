/* Diagnósticos da regressão linear simples: reta de mínimos quadrados, R² e
   distância de Cook (com desmascaramento sequencial dos pontos influentes).
   Funções puras sobre uma lista de pontos {x, y}. Expõe RW.diag. */
(function (RW) {
  "use strict";

  // reta y = a + b x por mínimos quadrados; null se degenerada
  function olsLine(pts) {
    const n = pts.length; if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; }
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-12) return null;
    const b = (n * sxy - sx * sy) / den, a = (sy - b * sx) / n;
    return { a, b };
  }

  // coeficiente de determinação da reta dada
  function rSquared(pts, line) {
    const n = pts.length; if (n < 2 || !line) return null;
    let ybar = 0; for (const p of pts) ybar += p.y; ybar /= n;
    let ssr = 0, sst = 0;
    for (const p of pts) { const yh = line.a + line.b * p.x; ssr += (p.y - yh) ** 2; sst += (p.y - ybar) ** 2; }
    if (sst <= 0) return 1;
    return 1 - ssr / sst;
  }

  // distância de Cook (uma passada) para um conjunto de pontos
  function cookOnce(pts) {
    const n = pts.length; if (n < 3) return null;
    const line = olsLine(pts); if (!line) return null;
    let xbar = 0; for (const p of pts) xbar += p.x; xbar /= n;
    let Sxx = 0; for (const p of pts) Sxx += (p.x - xbar) ** 2;
    if (Sxx <= 0) return null;
    let ssr = 0; const e = [];
    for (const p of pts) { const r = p.y - (line.a + line.b * p.x); e.push(r); ssr += r * r; }
    const s2 = ssr / (n - 2);
    const thr = 4 / n, D = new Array(n);
    for (let i = 0; i < n; i++) {
      const h = 1 / n + ((pts[i].x - xbar) ** 2) / Sxx;
      D[i] = (s2 > 1e-12 && h < 1) ? (e[i] * e[i]) / (2 * s2) * (h / ((1 - h) * (1 - h))) : 0;
    }
    return { D, thr };
  }

  // detecção sequencial: remove o ponto mais influente, reajusta e repete,
  // desmascarando múltiplos influentes (threshold 4/n no conjunto corrente).
  function cookRLS(pts) {
    const n = pts.length; if (n < 3) return null;
    const flags = new Array(n).fill(false);
    let idx = pts.map((_, i) => i);
    while (idx.length >= 3) {
      const st = cookOnce(idx.map((i) => pts[i])); if (!st) break;
      let mp = -1, md = 0;
      for (let k = 0; k < st.D.length; k++) if (st.D[k] > md) { md = st.D[k]; mp = k; }
      if (mp >= 0 && md > st.thr) { flags[idx[mp]] = true; idx.splice(mp, 1); } else break;
    }
    return { flags };
  }

  RW.diag = { olsLine, rSquared, cookRLS };
})(window.RW = window.RW || {});
