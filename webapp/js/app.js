/* Fiação da aplicação: estado, interação (mouse + toque), painel, diagnósticos,
   ajuda, PDF e o laço de render. */
(function (RW) {
  "use strict";

  const CURVE_SEG = 180, COMP_SEG = 140, BASES_SEG = 120;
  const HIT_R = 16, MOVE_TOL = 6, DBLTAP_MS = 320, BAND_H = 70;

  const canvas = document.getElementById("plot");
  const plot = new RW.Plot(canvas);
  const models = RW.models.createAll();
  const ctx = plot.ctx;
  const r2badge = document.getElementById("r2badge");

  const state = {
    points: [],
    showGrid: true,
    selected: -1,
    showR2: true,          // badge de R² (RLS)
    cookOn: false,         // detectar influentes (Cook) e pintar de vermelho
    cookExclude: false,    // desenhar RLS sem os influentes (tracejada)
    hintActive: true,      // anel de dica no estado inicial
    hintIndex: 4,          // 5º ponto
    r2: null, cook: null, cookLine: null,
    viewLocked: false,     // auto-enquadra até o usuário mexer na vista
  };

  // ---------------- render loop ----------------
  let renderQueued = false;
  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }
  function fitAll() { for (const m of models) if (m.enabled) m.fit(state.points); }
  function changeData() { fitAll(); computeDiagnostics(); updateR2Badge(); requestRender(); }

  // ---------------- diagnósticos (RLS) ----------------
  function olsLine(pts) {
    const n = pts.length; if (n < 2) return null;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const p of pts) { sx += p.x; sy += p.y; sxx += p.x * p.x; sxy += p.x * p.y; }
    const den = n * sxx - sx * sx;
    if (Math.abs(den) < 1e-12) return null;
    const b = (n * sxy - sx * sy) / den, a = (sy - b * sx) / n;
    return { a, b };
  }
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
  function computeDiagnostics() {
    const line = models[0];
    state.r2 = (line.enabled && line.fitted)
      ? rSquared(state.points, { a: line.gamma[0], b: line.gamma[1] }) : null;
    state.cook = (line.enabled && (state.cookOn || state.cookExclude)) ? cookRLS(state.points) : null;
    state.cookLine = null;
    if (line.enabled && state.cookExclude && state.cook) {
      const kept = state.points.filter((_, i) => !state.cook.flags[i]);
      state.cookLine = olsLine(kept);
    }
  }
  function updateR2Badge() {
    const show = state.showR2 && models[0].enabled && state.r2 != null;
    r2badge.hidden = !show;
    if (!show) return;
    const v = Math.max(0, state.r2);
    const c = v >= 0.75 ? "#1E8E4E" : v >= 0.4 ? "#E0A52E" : "#C0392B";
    r2badge.style.setProperty("--c", c);
    r2badge.querySelector(".r2-text").textContent = "R² = " + v.toFixed(3);
  }

  // ---------------- render ----------------
  function drawBasesBand(m) {
    const comps = m.basisComponents(BASES_SEG);
    if (!comps.length) return;
    const base = plot.H - 12;
    ctx.save();
    ctx.strokeStyle = "#C9D0DC"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(plot.W, base + 0.5); ctx.stroke();
    ctx.globalAlpha = 0.5; ctx.strokeStyle = m.color; ctx.lineWidth = 1.5;
    for (const comp of comps) {
      ctx.beginPath();
      for (let k = 0; k < comp.length; k++) {
        const px = plot.sX(comp[k].x), py = base - comp[k].v * BAND_H;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    plot.clear();
    if (state.showGrid) plot.drawGrid();
    const xlo = plot.dX(0), xhi = plot.dX(plot.W);

    for (const m of models) {
      if (!m.enabled || !m.fitted) continue;
      if (m._hasBases && m.params.showBases) drawBasesBand(m);
      if (m.params.showWeighted) for (const comp of m.weightedComponents(COMP_SEG)) plot.line(comp, m.color, 1.6, 0.5);
      plot.line(m.curve(xlo, xhi, CURVE_SEG), m.color, 3.4, 1);
    }

    // RLS sem os pontos influentes (tracejada)
    if (state.cookLine) {
      const l = state.cookLine;
      ctx.save(); ctx.setLineDash([9, 6]);
      plot.line([{ x: xlo, y: l.a + l.b * xlo }, { x: xhi, y: l.a + l.b * xhi }], models[0].color, 2.6, 0.95);
      ctx.restore();
    }

    // pontos (influentes em vermelho)
    const flags = (state.cook && (state.cookOn || state.cookExclude)) ? state.cook.flags : null;
    for (let i = 0; i < state.points.length; i++) {
      const p = state.points[i], infl = flags && flags[i];
      plot.dot(p.x, p.y, 6, infl ? "#C0392B" : "#FFFFFF", infl ? "#7B241C" : "#131A2A", 2);
      if (i === state.selected) plot.dot(p.x, p.y, 11, null, "#1B3A8C", 2.5);
    }
    // anel de dica (some ao mover um ponto)
    if (state.hintActive && state.hintIndex < state.points.length) {
      const p = state.points[state.hintIndex];
      plot.dot(p.x, p.y, 15, null, "#E53935", 3);
      plot.dot(p.x, p.y, 22, null, "rgba(229,57,53,0.38)", 2);
    }
    updateLegend();
  }

  // ---------------- enquadramento ----------------
  function dataBBox() {
    if (!state.points.length) return { xmin: Infinity };
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of state.points) {
      if (p.x < xmin) xmin = p.x; if (p.x > xmax) xmax = p.x;
      if (p.y < ymin) ymin = p.y; if (p.y > ymax) ymax = p.y;
    }
    return { xmin, xmax, ymin, ymax };
  }
  function fitView() { plot.fitTo(dataBBox()); requestRender(); }

  // ---------------- hit test ----------------
  function hitTest(px, py) {
    let best = -1, bd = HIT_R * HIT_R;
    for (let i = 0; i < state.points.length; i++) {
      const dx = plot.sX(state.points[i].x) - px, dy = plot.sY(state.points[i].y) - py;
      const d = dx * dx + dy * dy;
      if (d <= bd) { bd = d; best = i; }
    }
    return best;
  }
  function removePoint(i) {
    if (i < 0) return;
    state.points.splice(i, 1);
    if (state.selected === i) state.selected = -1;
    else if (state.selected > i) state.selected--;
    changeData();
  }

  // ---------------- interação ----------------
  const pointers = new Map();
  let gesture = null;
  let lastTap = { t: 0, i: -1 };
  function localPos(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  canvas.addEventListener("pointerdown", (e) => {
    canvas.setPointerCapture(e.pointerId);
    const pos = localPos(e); pointers.set(e.pointerId, pos);
    if (pointers.size === 2) {
      const pts = [...pointers.values()];
      gesture = { type: "pinch", dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } };
      return;
    }
    const hit = hitTest(pos.x, pos.y);
    gesture = hit >= 0 ? { type: "point", i: hit, down: pos, moved: false }
                       : { type: "empty", down: pos, last: pos, moved: false };
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const pos = localPos(e); pointers.set(e.pointerId, pos);
    if (!gesture) return;
    if (gesture.type === "pinch" && pointers.size >= 2) {
      const pts = [...pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      if (gesture.dist > 0) plot.zoomAt(mid.x, mid.y, dist / gesture.dist);
      plot.panByPixels(mid.x - gesture.mid.x, mid.y - gesture.mid.y);
      gesture.dist = dist; gesture.mid = mid; state.viewLocked = true; requestRender(); return;
    }
    if (gesture.type === "point") {
      if (Math.hypot(pos.x - gesture.down.x, pos.y - gesture.down.y) > MOVE_TOL) {
        gesture.moved = true; state.hintActive = false;
      }
      state.points[gesture.i] = { x: plot.dX(pos.x), y: plot.dY(pos.y) };
      state.selected = gesture.i; changeData(); return;
    }
    if (gesture.type === "empty") {
      if (Math.hypot(pos.x - gesture.down.x, pos.y - gesture.down.y) > MOVE_TOL) gesture.moved = true;
      if (gesture.moved) { plot.panByPixels(pos.x - gesture.last.x, pos.y - gesture.last.y); gesture.last = pos; state.viewLocked = true; requestRender(); }
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (!gesture) return;
    if (gesture.type === "empty" && !gesture.moved) {
      state.points.push({ x: plot.dX(gesture.down.x), y: plot.dY(gesture.down.y) });
      state.selected = state.points.length - 1; lastTap = { t: 0, i: -1 }; changeData();
    } else if (gesture.type === "point" && !gesture.moved) {
      const now = performance.now();
      if (lastTap.i === gesture.i && now - lastTap.t < DBLTAP_MS) { removePoint(gesture.i); lastTap = { t: 0, i: -1 }; }
      else { state.selected = gesture.i; lastTap = { t: now, i: gesture.i }; requestRender(); }
    }
    if (pointers.size === 0) gesture = null;
    else if (pointers.size === 1 && gesture.type === "pinch") {
      const only = [...pointers.values()][0]; gesture = { type: "empty", down: only, last: only, moved: true };
    }
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault(); const pos = localPos(e);
    plot.zoomAt(pos.x, pos.y, e.deltaY < 0 ? 1.12 : 1 / 1.12); state.viewLocked = true; requestRender();
  }, { passive: false });
  canvas.addEventListener("contextmenu", (e) => {
    const pos = localPos(e), hit = hitTest(pos.x, pos.y);
    if (hit >= 0) { e.preventDefault(); removePoint(hit); }
  });
  window.addEventListener("keydown", (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && state.selected >= 0) { e.preventDefault(); removePoint(state.selected); }
    if (e.key === "Escape") closeHelp();
  });

  // ---------------- painel ----------------
  const panel = document.getElementById("panel");
  function fmtAlpha(v) {
    if (v === 0) return "0";
    if (v >= 0.01) return String(v);
    return v.toExponential(0).replace("e-", "e−");
  }
  function diagToggle(label, checked, on) {
    const w = document.createElement("div"); w.className = "ctl";
    w.innerHTML = `<label class="row"><span>${label}</span><input type="checkbox" ${checked ? "checked" : ""}></label>`;
    w.querySelector("input").addEventListener("change", (e) => on(e.target.checked));
    return w;
  }
  function buildControl(m, c) {
    const wrap = document.createElement("div"); wrap.className = "ctl";
    if (c.type === "toggle") {
      wrap.innerHTML = `<label class="row"><span>${c.label}</span><input type="checkbox"></label>`;
      const cb = wrap.querySelector("input"); cb.checked = !!m.params[c.attr];
      cb.addEventListener("change", () => { m.params[c.attr] = cb.checked; requestRender(); });
      return wrap;
    }
    const isValues = c.type === "values";
    const max = isValues ? c.values.length - 1 : c.max, min = isValues ? 0 : c.min;
    const cur = isValues ? Math.max(0, c.values.indexOf(m.params[c.attr])) : m.params[c.attr];
    const fmtVal = (v) => isValues ? fmtAlpha(c.values[v]) : String(v);
    wrap.innerHTML = `<div class="row"><span>${c.label}</span><b class="val">${fmtVal(cur)}</b></div>
      <input type="range" min="${min}" max="${max}" step="1" value="${cur}">`;
    const rng = wrap.querySelector("input"), val = wrap.querySelector(".val");
    rng.addEventListener("input", () => {
      const idx = parseInt(rng.value, 10);
      m.params[c.attr] = isValues ? c.values[idx] : idx; val.textContent = fmtVal(idx); changeData();
    });
    return wrap;
  }
  function buildPanel() {
    panel.innerHTML = `<div class="panel-head"><h2>Models</h2><button id="panel-close" aria-label="Close">✕</button></div>`;
    for (const m of models) {
      const card = document.createElement("div"); card.className = "model-card";
      card.innerHTML = `<label class="model-head"><span class="sw" style="background:${m.color}"></span>
          <span class="mname">${m.name}</span><input type="checkbox" class="en" ${m.enabled ? "checked" : ""}></label>
        <div class="model-body"></div>`;
      const body = card.querySelector(".model-body"), en = card.querySelector(".en");
      const refresh = () => { body.hidden = !m.enabled; };
      en.addEventListener("change", () => { m.enabled = en.checked; refresh(); changeData(); });
      const clip = document.createElement("div"); clip.className = "ctl";
      clip.innerHTML = `<label class="row"><span>Clip to data range</span><input type="checkbox" ${m.clipDomain ? "checked" : ""}></label>`;
      clip.querySelector("input").addEventListener("change", (e) => { m.clipDomain = e.target.checked; requestRender(); });
      body.appendChild(clip);
      for (const c of m.controls) body.appendChild(buildControl(m, c));
      if (m.id === "rls") {
        body.appendChild(diagToggle("Show R²", state.showR2, (v) => { state.showR2 = v; updateR2Badge(); }));
        body.appendChild(diagToggle("Detect influential points (Cook)", state.cookOn, (v) => { state.cookOn = v; changeData(); }));
        body.appendChild(diagToggle("Line without influential points", state.cookExclude, (v) => { state.cookExclude = v; changeData(); }));
      }
      refresh(); panel.appendChild(card);
    }
    panel.querySelector("#panel-close").addEventListener("click", () => togglePanel(false));
  }
  function togglePanel(open) {
    const show = open == null ? !panel.classList.contains("open") : open;
    panel.classList.toggle("open", show);
    document.body.classList.toggle("panel-open", show);
  }

  // ---------------- legenda ----------------
  const legend = document.getElementById("legend");
  function updateLegend() {
    const act = models.filter((m) => m.enabled);
    legend.innerHTML = act.map((m) =>
      `<span class="lg"><i style="background:${m.color}"></i>${m.name}${m.enabled && !m.fitted ? " (n≥2)" : ""}</span>`).join("");
    legend.hidden = act.length === 0;
  }

  // ---------------- CSV ----------------
  function loadCSV(text) {
    const pts = [];
    for (const raw of text.split(/\r?\n/)) {
      const parts = raw.split(/[,;\t ]+/).filter((s) => s !== "");
      if (parts.length < 2) continue;
      const x = parseFloat(parts[0]), y = parseFloat(parts[1]);
      if (isFinite(x) && isFinite(y)) pts.push({ x, y });
    }
    if (pts.length < 2) { alert("CSV needs at least two numeric rows (x, y)."); return; }
    state.points = pts; state.selected = -1; state.hintActive = false;
    fitAll(); computeDiagnostics(); updateR2Badge(); fitView();
  }

  // ---------------- PDF ----------------
  function exportPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert("PDF library did not load (check your connection)."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    doc.setTextColor(19, 26, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("Regression Explorer", 40, 46);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(90, 99, 114);
    doc.text("Gustavo Valencio Tofolo · IME-USP · PUB scholarship (grant 2025-5333)", 40, 62);
    doc.text(new Date().toLocaleString(), pw - 40, 62, { align: "right" });
    const img = canvas.toDataURL("image/png"), ar = canvas.width / canvas.height;
    let w = pw - 80, h = w / ar; const maxh = ph - 210;
    if (h > maxh) { h = maxh; w = h * ar; }
    doc.addImage(img, "PNG", (pw - w) / 2, 78, w, h);
    let y = 78 + h + 26;
    doc.setTextColor(19, 26, 42); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("Active models", 40, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const m of models) {
      if (!m.enabled) continue;
      const ps = Object.entries(m.params).filter(([, v]) => typeof v !== "boolean").map(([k, v]) => `${k}=${v}`);
      let line = "• " + m.name + (ps.length ? ` (${ps.join(", ")})` : "");
      if (m.id === "rls" && state.r2 != null) line += `   R² = ${Math.max(0, state.r2).toFixed(3)}`;
      doc.text(line, 48, y); y += 14;
    }
    if (models[0].enabled && state.cook) {
      const k = state.cook.flags.filter(Boolean).length;
      doc.text(`Influential points (Cook's distance > 4/n): ${k}`, 48, y); y += 14;
    }
    doc.text(`Points: ${state.points.length}`, 48, y);
    doc.save("regression-explorer.pdf");
  }

  // ---------------- ajuda ----------------
  let helpModal = null;
  const HELP = [
    { id: "general", label: "About", html:
      `<h3>What this is</h3>
       <p>Regression Explorer is an interactive tool to explore regression models in
       real time. You place points and the fitted curves react at once, so the effect
       of each choice becomes visible. The focus is pedagogical: to make visible what
       usually stays only on paper.</p>
       <h3>Credits</h3>
       <p class="meta">Author: <b>Gustavo Valencio Tofolo</b><br>
       Advisor: Prof. Dr. Francisco Felipe de Queiroz<br>
       IME-USP — Institute of Mathematics and Statistics, University of São Paulo<br>
       Supported by the <b>PUB scholarship</b> (USP Unified Scholarship Program), grant 2025-5333.</p>
       <p><a href="https://github.com/tofolo17/SIICUSP-2025-5333" target="_blank" rel="noopener">github.com/tofolo17/SIICUSP-2025-5333</a></p>
       <h3>How to use</h3>
       <p>Tap to add a point, drag to move it, double-tap (or right-click) to remove it.
       Drag the background to pan, pinch or scroll to zoom, and press <span class="pill">Fit</span>
       to frame the data.</p>` },
    { id: "rls", label: "Line", html:
      `<h3>Line — simple linear regression</h3>
       <p>Fits the straight line <i>y = a + b x</i> that minimizes the squared residuals
       (ordinary least squares).</p>
       <ul>
         <li><b>R²</b>: share of the variance explained (0 to 1). The light is
         green, yellow or red by quality.</li>
         <li><b>Influential points (Cook's distance)</b>: points whose removal would
         most change the line are flagged in red (threshold 4/n).</li>
         <li><b>Line without influential points</b>: shows, dashed, the line refit after
         dropping the red points, to compare.</li>
       </ul>` },
    { id: "poly", label: "Polynomial", html:
      `<h3>Polynomial</h3>
       <p>Fits a global polynomial of the chosen degree.</p>
       <ul><li><b>Degree</b> (1–4): 1 is a straight line; higher degrees bend more,
       but can oscillate near the edges.</li></ul>` },
    { id: "bspline", label: "B-spline", html:
      `<h3>B-spline</h3>
       <p>A smooth curve built from local basis functions (Cox–de Boor). It is a sum
       of bumps, each active only on a small region.</p>
       <ul>
         <li><b>Degree</b> (0–3): smoothness of each piece (3 = cubic).</li>
         <li><b>Knots</b>: number of joints; more knots means more flexibility.</li>
         <li><b>Show bases</b>: the individual basis functions, in a strip at the bottom.</li>
         <li><b>Show contributions</b>: each basis scaled by its coefficient; they sum to the curve.</li>
       </ul>` },
    { id: "pspline", label: "P-spline", html:
      `<h3>P-spline — penalized spline</h3>
       <p>A B-spline with a roughness penalty, so you can use many knots without
       overfitting.</p>
       <ul>
         <li><b>Degree</b> and <b>Knots</b>: as in the B-spline.</li>
         <li><b>Penalty λ</b>: how strongly wiggliness is penalized; larger λ means
         smoother, tending to a straight line.</li>
         <li><b>Difference order r</b>: which differences of the coefficients are
         penalized (r = 2 penalizes curvature).</li>
       </ul>` },
  ];
  function buildHelp() {
    helpModal = document.createElement("div"); helpModal.id = "help-modal"; helpModal.hidden = true;
    const tabs = HELP.map((t, i) => `<button class="help-tab${i === 0 ? " active" : ""}" data-id="${t.id}">${t.label}</button>`).join("");
    helpModal.innerHTML = `<div class="help-card">
        <div class="help-head"><h2>Regression Explorer</h2><button id="help-close" aria-label="Close">✕</button></div>
        <div class="help-tabs">${tabs}</div>
        <div class="help-body">${HELP[0].html}</div></div>`;
    document.body.appendChild(helpModal);
    const body = helpModal.querySelector(".help-body");
    helpModal.querySelectorAll(".help-tab").forEach((b) => b.addEventListener("click", () => {
      helpModal.querySelectorAll(".help-tab").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      body.innerHTML = HELP.find((t) => t.id === b.dataset.id).html;
    }));
    helpModal.querySelector("#help-close").addEventListener("click", closeHelp);
    helpModal.addEventListener("click", (e) => { if (e.target === helpModal) closeHelp(); });
  }
  function openHelp() { if (helpModal) helpModal.hidden = false; }
  function closeHelp() { if (helpModal) helpModal.hidden = true; }

  // ---------------- barra e controles ----------------
  function wireToolbar() {
    document.getElementById("btn-help").addEventListener("click", openHelp);
    document.getElementById("btn-fit").addEventListener("click", () => { fitView(); state.viewLocked = true; });
    document.getElementById("btn-pdf").addEventListener("click", exportPDF);
    document.getElementById("btn-clear").addEventListener("click", () => {
      state.points = []; state.selected = -1; state.hintActive = false; changeData();
    });
    const grid = document.getElementById("btn-grid");
    grid.addEventListener("click", () => { state.showGrid = !state.showGrid; grid.classList.toggle("active", state.showGrid); requestRender(); });
    grid.classList.toggle("active", state.showGrid);
    document.getElementById("btn-panel").addEventListener("click", () => togglePanel());
    const file = document.getElementById("file-csv");
    document.getElementById("btn-csv").addEventListener("click", () => file.click());
    file.addEventListener("change", () => {
      const f = file.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => loadCSV(String(rd.result)); rd.readAsText(f); file.value = "";
    });
    document.getElementById("btn-zin").addEventListener("click", () => { plot.zoomAt(plot.W / 2, plot.H / 2, 1.3); state.viewLocked = true; requestRender(); });
    document.getElementById("btn-zout").addEventListener("click", () => { plot.zoomAt(plot.W / 2, plot.H / 2, 1 / 1.3); state.viewLocked = true; requestRender(); });
  }

  // ---------------- início ----------------
  function seed() {
    const xs = [-4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
    const ys = [-2.1, -1.0, -1.3, 0.2, 0.9, 0.7, 1.9, 2.4, 2.1, 3.2];
    state.points = xs.map((x, i) => ({ x, y: ys[i] }));
    models[0].enabled = true;        // apenas RLS no estado inicial
    state.hintActive = true; state.hintIndex = 4;
  }

  seed();
  buildPanel();
  buildHelp();
  wireToolbar();
  fitAll(); computeDiagnostics(); updateR2Badge();
  if (window.matchMedia("(min-width: 820px)").matches) togglePanel(true);

  // auto-enquadra em todo resize enquanto o usuário não mexeu na vista
  // (evita a corrida de timing do primeiro layout); trava após interação.
  const ro = new ResizeObserver(() => {
    plot.resize();
    if (!state.viewLocked) fitView(); else requestRender();
  });
  ro.observe(canvas);
})(window.RW = window.RW || {});
