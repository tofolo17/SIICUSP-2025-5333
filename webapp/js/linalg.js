/* Álgebra linear mínima (sem dependências) para as equações normais.
   Resolve A x = b por eliminação de Gauss com pivoteamento parcial.
   Retorna null quando A é (quase) singular — serve de guard de posto. */
(function (RW) {
  "use strict";

  // Multiplica Bᵀ B  (B é n×d, dado como array de linhas de tamanho d).
  function BtB(B, d) {
    const A = Array.from({ length: d }, () => new Float64Array(d));
    for (let k = 0; k < B.length; k++) {
      const row = B[k];
      for (let i = 0; i < d; i++) {
        const ri = row[i];
        if (ri === 0) continue;
        for (let j = i; j < d; j++) A[i][j] += ri * row[j];
      }
    }
    for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) A[i][j] = A[j][i];
    return A;
  }

  // Bᵀ y  (y array de tamanho n).
  function Bty(B, y, d) {
    const r = new Float64Array(d);
    for (let k = 0; k < B.length; k++) {
      const row = B[k], yk = y[k];
      for (let i = 0; i < d; i++) r[i] += row[i] * yk;
    }
    return r;
  }

  // Resolve A x = b (A: array de linhas Float64Array d×d; b: Float64Array d).
  // Pivoteamento parcial; devolve null se encontrar pivô desprezível.
  function solve(A, b) {
    const d = b.length;
    // cópias de trabalho
    const M = A.map((r) => Float64Array.from(r));
    const x = Float64Array.from(b);
    // escala para tolerância relativa
    let scale = 0;
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) {
      const a = Math.abs(M[i][j]); if (a > scale) scale = a;
    }
    const tol = (scale || 1) * 1e-12;

    for (let col = 0; col < d; col++) {
      // pivô
      let piv = col, best = Math.abs(M[col][col]);
      for (let r = col + 1; r < d; r++) {
        const a = Math.abs(M[r][col]); if (a > best) { best = a; piv = r; }
      }
      if (best < tol) return null; // posto deficiente
      if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t;
        const tb = x[piv]; x[piv] = x[col]; x[col] = tb; }
      const pivVal = M[col][col];
      for (let r = col + 1; r < d; r++) {
        const f = M[r][col] / pivVal;
        if (f === 0) continue;
        for (let c = col; c < d; c++) M[r][c] -= f * M[col][c];
        x[r] -= f * x[col];
      }
    }
    // retro-substituição
    for (let i = d - 1; i >= 0; i--) {
      let s = x[i];
      for (let j = i + 1; j < d; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }

  RW.linalg = { BtB, Bty, solve };
})(window.RW = window.RW || {});
