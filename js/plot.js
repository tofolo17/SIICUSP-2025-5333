/* Plano cartesiano: transform data<->tela, grid adaptativo, pan, zoom e
   enquadramento aos dados. Coordenadas matemáticas (y para cima). */
(function (RW) {
  "use strict";

  const COL = {
    bg: "#FFFFFF", minor: "#EEF1F6", major: "#DCE2EC",
    axis: "#9AA3B2", axisText: "#6B7280",
  };

  function niceStep(x) {
    if (!(x > 0)) return 1;
    const exp = Math.floor(Math.log10(x)), f = x / Math.pow(10, exp);
    let nf;
    if (f < 1.5) nf = 1; else if (f < 3) nf = 2; else if (f < 7) nf = 5; else nf = 10;
    return nf * Math.pow(10, exp);
  }

  function fmt(v, step) {
    if (Math.abs(v) < step * 1e-6) return "0";
    const dec = Math.max(0, -Math.floor(Math.log10(step)));
    if (dec > 6 || Math.abs(v) >= 1e6) return v.toExponential(1).replace("e+", "e");
    return v.toFixed(dec);
  }

  class Plot {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.cx = 0; this.cy = 0;      // centro em coords de dados
      this.sx = 40; this.sy = 40;    // pixels por unidade
      this.W = 300; this.H = 200; this.dpr = 1;
      this.resize();
    }
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.W = Math.max(1, Math.round(r.width));
      this.H = Math.max(1, Math.round(r.height));
      this.dpr = dpr;
      this.canvas.width = Math.round(this.W * dpr);
      this.canvas.height = Math.round(this.H * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    // transforms
    sX(x) { return this.W / 2 + (x - this.cx) * this.sx; }
    sY(y) { return this.H / 2 - (y - this.cy) * this.sy; }
    dX(px) { return this.cx + (px - this.W / 2) / this.sx; }
    dY(py) { return this.cy - (py - this.H / 2) / this.sy; }

    zoomAt(px, py, factor) {
      const dx = this.dX(px), dy = this.dY(py);
      this.sx *= factor; this.sy *= factor;
      this.cx = dx - (px - this.W / 2) / this.sx;
      this.cy = dy + (py - this.H / 2) / this.sy;
    }
    panByPixels(dpx, dpy) { this.cx -= dpx / this.sx; this.cy += dpy / this.sy; }

    fitTo(bbox, margin = 0.12) {
      let { xmin, xmax, ymin, ymax } = bbox;
      if (!isFinite(xmin)) { this.cx = 0; this.cy = 0; this.sx = this.sy = 40; return; }
      let wx = xmax - xmin, wy = ymax - ymin;
      if (!(wx > 0)) wx = Math.max(1, Math.abs(xmax) || 1);
      if (!(wy > 0)) wy = Math.max(1, Math.abs(ymax) || 1);
      this.cx = (xmin + xmax) / 2; this.cy = (ymin + ymax) / 2;
      this.sx = (this.W * (1 - 2 * margin)) / wx;
      this.sy = (this.H * (1 - 2 * margin)) / wy;
    }

    clear() {
      this.ctx.clearRect(0, 0, this.W, this.H);
      this.ctx.fillStyle = COL.bg;
      this.ctx.fillRect(0, 0, this.W, this.H);
    }

    drawGrid() {
      const ctx = this.ctx, W = this.W, H = this.H;
      const xl = this.dX(0), xr = this.dX(W), yb = this.dY(H), yt = this.dY(0);
      const stepX = niceStep(90 / this.sx), stepY = niceStep(90 / this.sy);

      // linhas menores (1/5 do passo)
      ctx.lineWidth = 1;
      const drawVert = (step, color) => {
        ctx.strokeStyle = color; ctx.beginPath();
        for (let x = Math.ceil(xl / step) * step; x <= xr; x += step) {
          const px = Math.round(this.sX(x)) + 0.5;
          ctx.moveTo(px, 0); ctx.lineTo(px, H);
        }
        ctx.stroke();
      };
      const drawHorz = (step, color) => {
        ctx.strokeStyle = color; ctx.beginPath();
        for (let y = Math.ceil(yb / step) * step; y <= yt; y += step) {
          const py = Math.round(this.sY(y)) + 0.5;
          ctx.moveTo(0, py); ctx.lineTo(W, py);
        }
        ctx.stroke();
      };
      drawVert(stepX / 5, COL.minor); drawHorz(stepY / 5, COL.minor);
      drawVert(stepX, COL.major); drawHorz(stepY, COL.major);

      // eixos
      ctx.strokeStyle = COL.axis; ctx.lineWidth = 1.4; ctx.beginPath();
      const ax = Math.round(this.sX(0)) + 0.5, ay = Math.round(this.sY(0)) + 0.5;
      const haveY = ax >= 0 && ax <= W, haveX = ay >= 0 && ay <= H;
      if (haveY) { ctx.moveTo(ax, 0); ctx.lineTo(ax, H); }
      if (haveX) { ctx.moveTo(0, ay); ctx.lineTo(W, ay); }
      ctx.stroke();

      // rótulos
      ctx.fillStyle = COL.axisText;
      ctx.font = "12px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      const labelY = haveX ? Math.min(H - 16, Math.max(2, ay + 4)) : H - 16;
      for (let x = Math.ceil(xl / stepX) * stepX; x <= xr; x += stepX) {
        if (Math.abs(x) < stepX * 1e-6) continue;
        ctx.fillText(fmt(x, stepX), this.sX(x), labelY);
      }
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      const labelX = haveY ? Math.min(W - 4, Math.max(28, ax - 6)) : W - 4;
      for (let y = Math.ceil(yb / stepY) * stepY; y <= yt; y += stepY) {
        if (Math.abs(y) < stepY * 1e-6) continue;
        ctx.fillText(fmt(y, stepY), labelX, this.sY(y));
      }
    }

    // polilinha em coords de dados: pts = [{x,y}]
    line(pts, color, width, alpha) {
      if (pts.length < 2) return;
      const ctx = this.ctx;
      ctx.save();
      ctx.globalAlpha = alpha == null ? 1 : alpha;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = "round"; ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(this.sX(pts[0].x), this.sY(pts[0].y));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(this.sX(pts[i].x), this.sY(pts[i].y));
      ctx.stroke();
      ctx.restore();
    }

    dot(x, y, r, fill, stroke, strokeW) {
      const ctx = this.ctx, px = this.sX(x), py = this.sY(y);
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.lineWidth = strokeW || 2; ctx.strokeStyle = stroke; ctx.stroke(); }
    }
  }

  RW.Plot = Plot;
})(window.RW = window.RW || {});
