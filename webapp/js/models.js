/* Modelos de regressão no arcabouço aditivo estruturado (seção 3.5 do relatório).
   Todos compartilham o estimador gamma_hat = (BᵀB + λK)⁻¹ Bᵀy; mudam apenas a
   base B e a penalização K. Ajuste em COORDENADAS MATEMÁTICAS (y para cima). */
(function (RW) {
  "use strict";
  const { BtB, Bty, solve } = RW.linalg;

  // ---------- utilidades de B-spline (Cox–de Boor) ----------
  function uniformKnots(a, b, nKnots, p) {
    const m = Math.max(2, nKnots);
    let h = (b - a) / (m - 1);
    if (!(h > 0)) h = 1; // x degenerado (todos iguais)
    const knots = [];
    for (let i = -p; i < m + p; i++) knots.push(a + i * h);
    return knots; // tamanho m + 2p  ->  d = m + p - 1
  }

  // Todas as funções base B_j^p avaliadas em x (meio-aberto [t_i, t_{i+1})).
  function bsplineAll(x, knots, p) {
    const segs = knots.length - 1;
    let N = new Float64Array(segs);
    for (let i = 0; i < segs; i++) N[i] = (knots[i] <= x && x < knots[i + 1]) ? 1 : 0;
    for (let deg = 1; deg <= p; deg++) {
      const next = new Float64Array(segs - deg);
      for (let i = 0; i < segs - deg; i++) {
        let a = 0, b = 0;
        const d1 = knots[i + deg] - knots[i];
        if (d1 > 0) a = ((x - knots[i]) / d1) * N[i];
        const d2 = knots[i + deg + 1] - knots[i + 1];
        if (d2 > 0) b = ((knots[i + deg + 1] - x) / d2) * N[i + 1];
        next[i] = a + b;
      }
      N = next;
    }
    return N; // tamanho segs - p = d
  }

  // Matriz de penalização K = λ · DᵣᵀDᵣ  (Dᵣ = diferenças de ordem r).
  function penaltyK(d, r, lambda) {
    if (!(lambda > 0) || r < 1 || r >= d) return null;
    // começa da identidade d×d e diferencia r vezes -> Dr (d-r)×d
    let D = [];
    for (let i = 0; i < d; i++) { const row = new Float64Array(d); row[i] = 1; D.push(row); }
    for (let t = 0; t < r; t++) {
      const nd = [];
      for (let i = 0; i < D.length - 1; i++) {
        const row = new Float64Array(d);
        for (let j = 0; j < d; j++) row[j] = D[i + 1][j] - D[i][j];
        nd.push(row);
      }
      D = nd;
    }
    // K = λ DᵀD
    const K = Array.from({ length: d }, () => new Float64Array(d));
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
      let s = 0; for (let k = 0; k < D.length; k++) s += D[k][i] * D[k][j];
      K[i][j] = lambda * s;
    }
    return K;
  }

  // ---------- classe mãe ----------
  function fit(model, points) {
    model.fitted = false; model.gamma = null;
    const n = points.length;
    if (n < 2) return;
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    model._xmin = Math.min.apply(null, xs);
    model._xmax = Math.max.apply(null, xs);
    model._prepare(xs);
    const d = model._d;
    const B = new Array(n);
    for (let i = 0; i < n; i++) B[i] = model._basisRow(xs[i]);
    const A = BtB(B, d);
    const K = model._penalty(d);
    if (K) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) A[i][j] += K[i][j];
    const g = solve(A, Bty(B, ys, d));
    if (!g) return; // guard de posto
    model.gamma = g; model.fitted = true;
  }

  function predict(model, x) {
    const row = model._basisRow(x); let s = 0;
    for (let i = 0; i < model._d; i++) s += model.gamma[i] * row[i];
    return s;
  }

  function curve(model, xlo, xhi, segs) {
    if (!model.fitted) return [];
    let lo = xlo, hi = xhi;
    if (model.clipDomain && model._xmin != null) {
      lo = Math.max(lo, model._xmin); hi = Math.min(hi, model._xmax);
    }
    if (hi <= lo) return [];
    const out = [];
    for (let s = 0; s <= segs; s++) {
      const x = lo + (hi - lo) * s / segs;
      out.push({ x, y: predict(model, x) });
    }
    return out;
  }

  function basisComponents(model, segs) {
    if (!model.fitted || !model._hasBases) return [];
    const a = model._xmin, b = model._xmax, out = [];
    for (let j = 0; j < model._d; j++) {
      const poly = [];
      for (let s = 0; s <= segs; s++) {
        const x = a + (b - a) * s / segs;
        poly.push({ x, v: model._basisRow(x)[j] });
      }
      out.push(poly);
    }
    return out;
  }

  function weightedComponents(model, segs) {
    if (!model.fitted || !model._hasBases) return [];
    const a = model._xmin, b = model._xmax, g = model.gamma, out = [];
    for (let j = 0; j < model._d; j++) {
      const poly = [];
      for (let s = 0; s <= segs; s++) {
        const x = a + (b - a) * s / segs;
        poly.push({ x, y: g[j] * model._basisRow(x)[j] });
      }
      out.push(poly);
    }
    return out;
  }

  // adiciona os métodos comuns a um modelo
  function wire(m) {
    m.fitted = false; m.gamma = null; m._xmin = null; m._xmax = null;
    m.fit = (pts) => fit(m, pts);
    m.predict = (x) => predict(m, x);
    m.curve = (lo, hi, segs) => curve(m, lo, hi, segs);
    m.basisComponents = (segs) => basisComponents(m, segs);
    m.weightedComponents = (segs) => weightedComponents(m, segs);
    return m;
  }

  // ---------- modelos concretos ----------
  function createAll() {
    // RLS — base [1, x]
    const rls = wire({
      id: "rls", name: "Line", color: "#C01C8B",
      enabled: true, clipDomain: false, _hasBases: false,
      params: {}, controls: [],
      _prepare() { this._d = 2; },
      _basisRow(x) { return [1, x]; },
      _penalty() { return null; },
    });

    // Polinomial — base de Vandermonde, x padronizado
    const poly = wire({
      id: "poly", name: "Polynomial", color: "#1E8E4E",
      enabled: false, clipDomain: false, _hasBases: false,
      params: { degree: 3 },
      controls: [{ attr: "degree", label: "Degree", min: 1, max: 4, step: 1, type: "int" }],
      _prepare(xs) {
        const n = xs.length; let mean = 0; for (const v of xs) mean += v; mean /= n;
        let sd = 0; for (const v of xs) sd += (v - mean) * (v - mean);
        sd = Math.sqrt(sd / n) || 1;
        this._mean = mean; this._sd = sd; this._d = this.params.degree + 1;
      },
      _basisRow(x) {
        const z = (x - this._mean) / this._sd, row = new Float64Array(this._d);
        let acc = 1; for (let i = 0; i < this._d; i++) { row[i] = acc; acc *= z; }
        return row;
      },
      _penalty() { return null; },
    });

    // B-spline — Cox–de Boor, sem penalização
    const bspline = wire({
      id: "bspline", name: "B-spline", color: "#E07B1A",
      enabled: false, clipDomain: true, _hasBases: true,
      params: { degree: 3, nKnots: 6, showBases: false, showWeighted: false },
      controls: [
        { attr: "degree", label: "Degree", min: 0, max: 3, step: 1, type: "int" },
        { attr: "nKnots", label: "Knots", min: 2, max: 20, step: 1, type: "int" },
        { attr: "showBases", label: "Show bases", type: "toggle" },
        { attr: "showWeighted", label: "Show contributions", type: "toggle" },
      ],
      _prepare(xs) {
        const p = this.params.degree;
        this._knots = uniformKnots(this._xmin, this._xmax, this.params.nKnots, p);
        this._p = p; this._d = this._knots.length - p - 1;
      },
      _basisRow(x) { return bsplineAll(x, this._knots, this._p); },
      _penalty() { return null; },
    });

    // P-spline — mesma base; K = λ DᵣᵀDᵣ
    const pspline = wire({
      id: "pspline", name: "P-spline", color: "#2563C9",
      enabled: false, clipDomain: true, _hasBases: false,
      params: { degree: 3, nKnots: 12, alpha: 1e-3, r: 2 },
      controls: [
        { attr: "degree", label: "Degree", min: 0, max: 3, step: 1, type: "int" },
        { attr: "nKnots", label: "Knots", min: 2, max: 30, step: 1, type: "int" },
        { attr: "alpha", label: "Penalty λ", type: "values",
          values: [0, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1] },
        { attr: "r", label: "Difference order r", min: 1, max: 3, step: 1, type: "int" },
      ],
      _prepare(xs) {
        const p = this.params.degree;
        this._knots = uniformKnots(this._xmin, this._xmax, this.params.nKnots, p);
        this._p = p; this._d = this._knots.length - p - 1;
      },
      _basisRow(x) { return bsplineAll(x, this._knots, this._p); },
      _penalty(d) { return penaltyK(d, this.params.r, this.params.alpha); },
    });

    return [rls, poly, bspline, pspline];
  }

  RW.models = { createAll };
})(window.RW = window.RW || {});
