"""Geração de um relatório PDF descritivo da simulação (via matplotlib).

O PDF é didático: traz um gráfico dos pontos e das curvas dos modelos visíveis,
e páginas de texto com a equação, os parâmetros, os coeficientes e o R² de cada
modelo, além da tabela de pontos utilizados. Tudo em coordenadas de tela (origem
no canto superior esquerdo, y para baixo) — as mesmas em que o ajuste é feito.
"""

import textwrap
from datetime import datetime

import matplotlib
matplotlib.use("Agg")  # backend sem janela: escreve o arquivo silenciosamente

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.backends.backend_pdf import PdfPages  # noqa: E402

from config import CURVE_SEGMENTS, MODEL_COLORS, SCREEN_HEIGHT, SCREEN_WIDTH  # noqa: E402

_A4 = (8.27, 11.69)  # polegadas


def _norm(color):
    return tuple(c / 255 for c in color)


def _fmt(v):
    if isinstance(v, bool):
        return "sim" if v else "não"
    if isinstance(v, int):
        return str(v)
    return f"{v:.4g}"


def generate_pdf(path, models, points):
    """Gera o relatório em `path`. `points` é a lista de (x, y) em pixels."""
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    for model in models:           # garante ajuste coerente com os pontos atuais
        model.fit(xs, ys)
    with PdfPages(path) as pdf:
        _plot_page(pdf, models, xs, ys)
        _text_pages(pdf, models, points, xs, ys)


def _plot_page(pdf, models, xs, ys):
    fig, ax = plt.subplots(figsize=(_A4[0], 6))
    if xs:
        ax.scatter(xs, ys, facecolors="none", edgecolors="black", s=40,
                   zorder=3, label="pontos")
    for i, model in enumerate(models):
        if not model.enabled:
            continue
        curve = model.curve(0, SCREEN_WIDTH, CURVE_SEGMENTS)
        if len(curve) >= 2:
            cx = [p[0] for p in curve]
            cy = [p[1] for p in curve]
            ax.plot(cx, cy, color=_norm(MODEL_COLORS[i % len(MODEL_COLORS)]),
                    lw=2, label=model.name)
    ax.set_xlim(0, SCREEN_WIDTH)
    ax.set_ylim(0, SCREEN_HEIGHT)
    ax.invert_yaxis()  # espelha a tela (y para baixo)
    ax.set_xlabel("x (pixels de tela)")
    ax.set_ylabel("y (pixels de tela; origem no topo)")
    ax.grid(True, alpha=0.2)
    ax.legend(loc="best", fontsize=8)
    fig.suptitle("Relatório de Regressão Interativa", fontsize=15, fontweight="bold")
    pdf.savefig(fig)
    plt.close(fig)


def _model_lines(model, xs, ys):
    status = "VISÍVEL" if model.enabled else "oculto"
    out = [f"[{model.name}]  ({status})", f"  {model.DESCRIPTION}",
           f"  Equação: {model.equation_text()}"]
    params = [("Ativado", model.enabled), ("Clipar domínio", model.clip_domain)]
    for spec in model.param_specs():
        params.append((spec.label, getattr(model, spec.attr)))
    out.append("  Parâmetros: " + ", ".join(f"{lbl}={_fmt(v)}" for lbl, v in params))
    if model.is_fitted():
        r2 = model.r_squared(xs, ys)
        if r2 is not None:
            out.append(f"  R² (qualidade do ajuste) = {r2:.4f}")
        gamma = np.round(model.gamma, 2)
        out.append(f"  Coeficientes (γ), {len(gamma)} valores: {list(gamma)}")
    else:
        out.append("  (não ajustado — pontos insuficientes para este modelo)")
    return out


def _points_lines(points, per_row=4):
    items = [f"({x:.0f}, {y:.0f})" for x, y in points]
    return ["  " + "   ".join(items[i:i + per_row]) for i in range(0, len(items), per_row)]


def _text_pages(pdf, models, points, xs, ys):
    lines = [
        "RELATÓRIO DE REGRESSÃO INTERATIVA",
        datetime.now().strftime("Gerado em %d/%m/%Y %H:%M"),
        "",
        "Coordenadas em pixels de tela (origem no canto superior esquerdo, y para baixo).",
        "Ajuste por mínimos quadrados (penalizados):  gamma = (B^T B + K)^(-1) B^T y.",
        f"Pontos utilizados: {len(points)}"
        + (f"   |   x em [{min(xs):.0f}, {max(xs):.0f}]" if xs else ""),
        "",
        "MODELOS VISÍVEIS: "
        + (", ".join(m.name for m in models if m.enabled) or "(nenhum)"),
        "=" * 70,
    ]
    for model in models:
        lines += _model_lines(model, xs, ys)
        lines.append("")
    lines.append("=" * 70)
    lines.append(f"PONTOS (x, y) — {len(points)} no total:")
    lines += _points_lines(points)
    _emit(pdf, lines)


def _emit(pdf, lines, per_page=50, width=92):
    wrapped = []
    for line in lines:
        if len(line) <= width:
            wrapped.append(line)
        else:
            wrapped += textwrap.wrap(line, width, subsequent_indent="      ") or [""]
    for i in range(0, len(wrapped), per_page):
        fig = plt.figure(figsize=_A4)
        fig.text(0.07, 0.96, "\n".join(wrapped[i:i + per_page]),
                 va="top", ha="left", family="monospace", fontsize=9)
        pdf.savefig(fig)
        plt.close(fig)
