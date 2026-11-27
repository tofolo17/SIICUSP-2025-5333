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

  // ---------------- i18n (PT / EN) ----------------
  // Dicionário e idioma vivem em js/i18n.js (RW.i18n). Aliases finos para uso local:
  const tr = (k) => RW.i18n.t(k);
  const mname = (m) => RW.i18n.modelName(m.id) || m.name;
  const clabel = (a) => RW.i18n.ctrlLabel(a) || a;
  // chave do Web3Forms (cole a sua access key aqui para ativar a caixa de sugestões)
  const WEB3FORMS_KEY = "PASTE_YOUR_WEB3FORMS_ACCESS_KEY_HERE";
  function wireFeedback(container) {
    const mount = container.querySelector(".suggest-mount");
    if (!mount) return;
    mount.innerHTML = `<h3>${tr("fbTitle")}</h3>
      <p>${tr("fbIntro")}</p>
      <form class="suggest-form">
        <textarea class="sg-msg" rows="4" placeholder="${tr("fbMsgPh")}"></textarea>
        <input type="email" class="sg-email" placeholder="${tr("fbEmailPh")}">
        <button type="submit" class="sg-send">${tr("fbSend")}</button>
        <p class="sg-status" role="status"></p>
      </form>`;
    const form = mount.querySelector(".suggest-form");
    const status = mount.querySelector(".sg-status");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const msg = form.querySelector(".sg-msg").value.trim();
      const email = form.querySelector(".sg-email").value.trim();
      if (!msg) { status.textContent = tr("fbEmpty"); return; }
      if (!WEB3FORMS_KEY || WEB3FORMS_KEY.indexOf("PASTE_") === 0) { status.textContent = tr("fbOff"); return; }
      const btn = form.querySelector(".sg-send");
      btn.disabled = true; status.textContent = tr("fbSending");
      try {
        const res = await fetch("https://api.web3forms.com/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({
            access_key: WEB3FORMS_KEY,
            subject: "Regression Explorer — nova sugestão",
            from_name: "Regression Explorer",
            message: msg,
            reply_to: email || "",
          }),
        });
        const data = await res.json();
        if (data.success) mount.innerHTML = `<h3>${tr("fbTitle")}</h3><p>${tr("fbThanks")}</p>`;
        else { status.textContent = tr("fbErr"); btn.disabled = false; }
      } catch (err) { status.textContent = tr("fbErr"); btn.disabled = false; }
    });
  }
  function setBtnText(id, labelKey, titleKey) {
    const b = document.getElementById(id); if (!b) return;
    const s = b.querySelector("span"); if (s) s.textContent = tr(labelKey);
    b.title = tr(titleKey);
  }
  function applyLang() {
    document.documentElement.lang = RW.i18n.getLang();
    const bsub = document.querySelector("#brand p"); if (bsub) bsub.textContent = tr("brandSub");
    setBtnText("btn-help", "help", "t_help"); setBtnText("btn-fit", "fit", "t_fit");
    setBtnText("btn-grid", "grid", "t_grid"); setBtnText("btn-csv", "csv", "t_csv");
    setBtnText("btn-pdf", "pdf", "t_pdf"); setBtnText("btn-clear", "clear", "t_clear");
    setBtnText("btn-panel", "models", "t_models");
    const lb = document.getElementById("btn-lang");
    if (lb) { const s = lb.querySelector("span"); if (s) s.textContent = tr("langShort"); lb.title = tr("t_lang"); }
    const zi = document.getElementById("btn-zin"); if (zi) zi.title = tr("t_zin");
    const zo = document.getElementById("btn-zout"); if (zo) zo.title = tr("t_zout");
    const h = document.getElementById("hint"); if (h) h.textContent = tr("hint");
    buildPanel(); buildHelp(); updateR2Badge(); requestRender();
  }

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
  // Funções puras (reta MQ, R², Cook) vivem em js/diagnostics.js (RW.diag).
  const olsLine = RW.diag.olsLine, rSquared = RW.diag.rSquared, cookRLS = RW.diag.cookRLS;
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
      wrap.innerHTML = `<label class="row"><span>${clabel(c.attr)}</span><input type="checkbox"></label>`;
      const cb = wrap.querySelector("input"); cb.checked = !!m.params[c.attr];
      cb.addEventListener("change", () => { m.params[c.attr] = cb.checked; requestRender(); });
      return wrap;
    }
    const isValues = c.type === "values";
    const max = isValues ? c.values.length - 1 : c.max, min = isValues ? 0 : c.min;
    const cur = isValues ? Math.max(0, c.values.indexOf(m.params[c.attr])) : m.params[c.attr];
    const fmtVal = (v) => isValues ? fmtAlpha(c.values[v]) : String(v);
    wrap.innerHTML = `<div class="row"><span>${clabel(c.attr)}</span><b class="val">${fmtVal(cur)}</b></div>
      <input type="range" min="${min}" max="${max}" step="1" value="${cur}">`;
    const rng = wrap.querySelector("input"), val = wrap.querySelector(".val");
    rng.addEventListener("input", () => {
      const idx = parseInt(rng.value, 10);
      m.params[c.attr] = isValues ? c.values[idx] : idx; val.textContent = fmtVal(idx); changeData();
    });
    return wrap;
  }
  function buildPanel() {
    panel.innerHTML = `<div class="panel-head"><h2>${tr("panelTitle")}</h2><button id="panel-close" aria-label="${tr("close")}">✕</button></div>`;
    for (const m of models) {
      const card = document.createElement("div"); card.className = "model-card";
      card.innerHTML = `<label class="model-head"><span class="sw" style="background:${m.color}"></span>
          <span class="mname">${mname(m)}</span><input type="checkbox" class="en" ${m.enabled ? "checked" : ""}></label>
        <div class="model-body"></div>`;
      const body = card.querySelector(".model-body"), en = card.querySelector(".en");
      const refresh = () => { body.hidden = !m.enabled; };
      en.addEventListener("change", () => { m.enabled = en.checked; refresh(); changeData(); });
      const clip = document.createElement("div"); clip.className = "ctl";
      clip.innerHTML = `<label class="row"><span>${tr("clip")}</span><input type="checkbox" ${m.clipDomain ? "checked" : ""}></label>`;
      clip.querySelector("input").addEventListener("change", (e) => { m.clipDomain = e.target.checked; requestRender(); });
      body.appendChild(clip);
      for (const c of m.controls) body.appendChild(buildControl(m, c));
      if (m.id === "rls") {
        body.appendChild(diagToggle(tr("showR2"), state.showR2, (v) => { state.showR2 = v; updateR2Badge(); }));
        body.appendChild(diagToggle(tr("detectCook"), state.cookOn, (v) => { state.cookOn = v; changeData(); }));
        body.appendChild(diagToggle(tr("lineNoInfl"), state.cookExclude, (v) => { state.cookExclude = v; changeData(); }));
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
      `<span class="lg"><i style="background:${m.color}"></i>${mname(m)}${m.enabled && !m.fitted ? tr("needN") : ""}</span>`).join("");
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
    if (pts.length < 2) { alert(tr("csvErr")); return; }
    state.points = pts; state.selected = -1; state.hintActive = false;
    fitAll(); computeDiagnostics(); updateR2Badge(); fitView();
  }

  // ---------------- PDF ----------------
  function exportPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) { alert(tr("pdfErr")); return; }
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
    doc.text(tr("pdfActive"), 40, y); y += 16;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    for (const m of models) {
      if (!m.enabled) continue;
      const ps = Object.entries(m.params).filter(([, v]) => typeof v !== "boolean").map(([k, v]) => `${k}=${v}`);
      let line = "• " + mname(m) + (ps.length ? ` (${ps.join(", ")})` : "");
      if (m.id === "rls" && state.r2 != null) line += `   R² = ${Math.max(0, state.r2).toFixed(3)}`;
      doc.text(line, 48, y); y += 14;
    }
    if (models[0].enabled && state.cook) {
      const k = state.cook.flags.filter(Boolean).length;
      doc.text(tr("pdfInfl") + k, 48, y); y += 14;
    }
    doc.text(tr("pdfPoints") + state.points.length, 48, y);
    doc.save("regression-explorer.pdf");
  }

  // ---------------- ajuda ----------------
  let helpModal = null;
  const HELP = {
    en: [
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
      { id: "feedback", label: "Feedback", html: `<div class="suggest-mount"></div>` },
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
    ],
    pt: [
      { id: "general", label: "Sobre", html:
        `<h3>O que é isto</h3>
         <p>O Regression Explorer é uma ferramenta interativa para explorar modelos de
         regressão em tempo real. Você coloca pontos e as curvas ajustadas reagem na hora,
         tornando visível o efeito de cada escolha. O foco é pedagógico, mostrar o que
         costuma ficar só no papel.</p>
         <h3>Créditos</h3>
         <p class="meta">Autor: <b>Gustavo Valencio Tofolo</b><br>
         Orientador: Prof. Dr. Francisco Felipe de Queiroz<br>
         IME-USP — Instituto de Matemática e Estatística da Universidade de São Paulo<br>
         Apoio do <b>Programa Unificado de Bolsas (PUB)</b>, processo 2025-5333.</p>
         <p><a href="https://github.com/tofolo17/SIICUSP-2025-5333" target="_blank" rel="noopener">github.com/tofolo17/SIICUSP-2025-5333</a></p>
         <h3>Como usar</h3>
         <p>Toque para adicionar um ponto, arraste para mover, toque duplo (ou botão direito)
         para remover. Arraste o fundo para deslocar, pinça ou rolagem para zoom, e use
         <span class="pill">Enquadrar</span> para enquadrar nos dados.</p>` },
      { id: "feedback", label: "Sugestões", html: `<div class="suggest-mount"></div>` },
      { id: "rls", label: "Reta", html:
        `<h3>Reta — regressão linear simples</h3>
         <p>Ajusta a reta <i>y = a + b x</i> que minimiza os resíduos ao quadrado
         (mínimos quadrados ordinários).</p>
         <ul>
           <li><b>R²</b>: fração da variância explicada (0 a 1). O farol fica verde,
           amarelo ou vermelho conforme a qualidade.</li>
           <li><b>Pontos influentes (distância de Cook)</b>: os pontos cuja remoção mais
           mudaria a reta ficam marcados em vermelho (limiar 4/n).</li>
           <li><b>Reta sem os pontos influentes</b>: mostra, tracejada, a reta reajustada
           sem os pontos vermelhos, para comparar.</li>
         </ul>` },
      { id: "poly", label: "Polinomial", html:
        `<h3>Polinomial</h3>
         <p>Ajusta um polinômio global do grau escolhido.</p>
         <ul><li><b>Grau</b> (1 a 4): 1 é uma reta; graus maiores dobram mais, mas podem
         oscilar perto das bordas.</li></ul>` },
      { id: "bspline", label: "B-spline", html:
        `<h3>B-spline</h3>
         <p>Uma curva suave feita de funções base locais (Cox–de Boor). É uma soma de
         corcovas, cada uma ativa só numa pequena região.</p>
         <ul>
           <li><b>Grau</b> (0 a 3): suavidade de cada pedaço (3 = cúbica).</li>
           <li><b>Nós</b>: número de junções; mais nós significa mais flexibilidade.</li>
           <li><b>Ver bases</b>: as funções base individuais, numa faixa embaixo.</li>
           <li><b>Ver contribuições</b>: cada base multiplicada pelo seu coeficiente; elas
           somam para formar a curva.</li>
         </ul>` },
      { id: "pspline", label: "P-spline", html:
        `<h3>P-spline — spline penalizado</h3>
         <p>Uma B-spline com uma penalização de rugosidade, para usar muitos nós sem
         superajuste.</p>
         <ul>
           <li><b>Grau</b> e <b>Nós</b>: como na B-spline.</li>
           <li><b>Penalização λ</b>: o quanto a oscilação é penalizada; λ maior deixa
           mais suave, tendendo a uma reta.</li>
           <li><b>Ordem da diferença r</b>: quais diferenças dos coeficientes são
           penalizadas (r = 2 penaliza a curvatura).</li>
         </ul>` },
    ],
  };
  function buildHelp() {
    if (helpModal) helpModal.remove();
    const tabs = HELP[RW.i18n.getLang()];
    const tabsHtml = tabs.map((tab, i) => `<button class="help-tab${i === 0 ? " active" : ""}" data-id="${tab.id}">${tab.label}</button>`).join("");
    helpModal = document.createElement("div"); helpModal.id = "help-modal"; helpModal.hidden = true;
    helpModal.innerHTML = `<div class="help-card">
        <div class="help-head"><h2>Regression Explorer</h2><button id="help-close" aria-label="${tr('close')}">✕</button></div>
        <div class="help-tabs">${tabsHtml}</div>
        <div class="help-body">${tabs[0].html}</div></div>`;
    document.body.appendChild(helpModal);
    const body = helpModal.querySelector(".help-body");
    helpModal.querySelectorAll(".help-tab").forEach((b) => b.addEventListener("click", () => {
      helpModal.querySelectorAll(".help-tab").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      body.innerHTML = tabs.find((tab) => tab.id === b.dataset.id).html;
      if (b.dataset.id === "feedback") wireFeedback(body);
    }));
    helpModal.querySelector("#help-close").addEventListener("click", closeHelp);
    helpModal.addEventListener("click", (e) => { if (e.target === helpModal) closeHelp(); });
  }
  function openHelp(tabId) {
    if (!helpModal) return;
    helpModal.hidden = false;
    if (typeof tabId === "string") {
      const b = helpModal.querySelector(`.help-tab[data-id="${tabId}"]`);
      if (b) b.click();                 // ativa a aba pedida (ex.: "script")
    }
  }
  function closeHelp() { if (helpModal) helpModal.hidden = true; }

  // ---------------- barra e controles ----------------
  function wireToolbar() {
    document.getElementById("btn-help").addEventListener("click", () => openHelp());
    document.getElementById("btn-lang").addEventListener("click", () => { RW.i18n.toggle(); applyLang(); });
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
  wireToolbar();
  applyLang();           // monta painel + ajuda no idioma atual e traduz a barra
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
