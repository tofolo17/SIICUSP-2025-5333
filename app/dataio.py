"""Carregamento de pontos a partir de CSV e normalização para a tela.

O CSV tem duas colunas (x, y) em coordenadas cartesianas de escala arbitrária.
Como a aplicação trabalha em coordenadas de tela (pixels, y para baixo), os
dados são reescalados linearmente — cada eixo de forma independente — para
caber num retângulo da tela com margem, invertendo o eixo y (no cartesiano o y
cresce para cima). Assim os pontos carregados passam a se comportar como pontos
colocados à mão, e tudo (modelos e visualização das bases) funciona igual.
"""

import csv

import numpy as np

from config import CSV_MARGIN, SCREEN_HEIGHT, SCREEN_WIDTH


def ask_open_csv():
    """Abre um diálogo nativo para escolher um CSV. Retorna o caminho ou None."""
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception:
        return None
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    path = filedialog.askopenfilename(
        title="Selecione um CSV com colunas x, y",
        filetypes=[("CSV", "*.csv"), ("Todos os arquivos", "*.*")],
    )
    root.destroy()
    return path or None


def ask_save_pdf(default_name="relatorio.pdf"):
    """Abre um diálogo nativo para salvar um PDF. Retorna o caminho ou None."""
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception:
        return None
    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    path = filedialog.asksaveasfilename(
        title="Salvar relatório PDF",
        defaultextension=".pdf",
        initialfile=default_name,
        filetypes=[("PDF", "*.pdf")],
    )
    root.destroy()
    return path or None


def read_csv_xy(path):
    """Lê duas colunas numéricas (x, y), ignorando cabeçalho e linhas inválidas."""
    xs, ys = [], []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.reader(f):
            if len(row) == 1:
                row = row[0].split()  # tolera separação por espaços
            if len(row) < 2:
                continue
            try:
                x, y = float(row[0]), float(row[1])
            except ValueError:
                continue  # cabeçalho ou linha não-numérica
            xs.append(x)
            ys.append(y)
    if len(xs) < 2:
        raise ValueError("o CSV precisa de ao menos 2 linhas com (x, y) numéricos")
    return np.array(xs), np.array(ys)


def _rescale(v, vmin, vmax, lo, hi):
    if vmax <= vmin:                       # coluna constante: centraliza
        return np.full_like(v, (lo + hi) / 2.0)
    return lo + (v - vmin) / (vmax - vmin) * (hi - lo)


def load_csv_as_points(path):
    """Lê o CSV e devolve pontos em pixels (lista de (x, y) int) ajustados à tela."""
    xs, ys = read_csv_xy(path)
    m = CSV_MARGIN
    sx = _rescale(xs, xs.min(), xs.max(), m, SCREEN_WIDTH - m)
    sy = _rescale(ys, ys.min(), ys.max(), SCREEN_HEIGHT - m, m)  # inverte y (cartesiano)
    return [(int(round(a)), int(round(b))) for a, b in zip(sx, sy)]
