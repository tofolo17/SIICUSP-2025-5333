"""Ponto de entrada: tela preta + nuvem de pontos + modelos + painel de controle.

Controles do mouse na tela principal:
    - Botão esquerdo: adiciona um ponto (ou arrasta um existente).
    - Botão direito:  remove o ponto sob o cursor.
    - Botão "menu" (canto superior esquerdo): abre/fecha o painel de controle.
"""

import sys
import pygame

import dataio
from config import (
    BACKGROUND, BASIS_BAND_BOTTOM, BASIS_BAND_HEIGHT, BASIS_COLOR, BASIS_WEIGHTED_COLOR,
    BUTTON_RECT, CLEAR_BUTTON_RECT, CSV_BUTTON_RECT, CURVE_SEGMENTS, CURVE_Y_CLAMP, FPS,
    LEGEND_DISABLED, LEGEND_MARGIN, LEGEND_ROW_H, LEGEND_SWATCH_W, LEGEND_X, MODEL_COLORS,
    MODEL_WIDTH, OUTPUT_BUTTON_RECT, PANEL_TEXT, SCREEN_HEIGHT, SCREEN_SIZE, SCREEN_WIDTH,
    TITLE, UI_FONT_SIZE,
)
from dots import Dots
from models import (
    BSplineRegression, PolynomialRegression, PSplineRegression, SimpleLinearRegression,
)
from panel import ControlPanel
from ui import Button, get_font


def _clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def _dim(color, f=0.4):
    return tuple(int(c * f) for c in color)


class App:
    def __init__(self):
        pygame.init()
        pygame.display.set_caption(TITLE)
        self.screen = pygame.display.set_mode(SCREEN_SIZE)
        self.clock = pygame.time.Clock()

        self.dots = Dots()
        # nº de abas do painel = nº de modelos
        self.models = [
            SimpleLinearRegression(),
            PolynomialRegression(degree=3),
            BSplineRegression(degree=3, n_knots=6),
            PSplineRegression(degree=3, n_knots=20, alpha=1e-4, r=2),
        ]
        self.panel = ControlPanel(self.models)
        self.menu_button = Button(BUTTON_RECT, icon="menu")
        self.clear_button = Button(CLEAR_BUTTON_RECT, icon="trash")
        self.csv_button = Button(CSV_BUTTON_RECT, icon="file")
        self.output_button = Button(OUTPUT_BUTTON_RECT, icon="export")
        self.running = True

    def run(self):
        while self.running:
            self._handle_events()
            self._update()
            self._render()
            self.clock.tick(FPS)
        pygame.quit()
        sys.exit()

    def _handle_events(self):
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                self.running = False
                continue

            # Botões do canto (têm prioridade sobre a nuvem).
            if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                if self.menu_button.hit(event.pos):
                    self.panel.toggle()
                    continue
                if self.clear_button.hit(event.pos):
                    self.dots.clear()
                    continue
                if self.csv_button.hit(event.pos):
                    self._load_csv()
                    continue
                if self.output_button.hit(event.pos):
                    self._save_pdf()
                    continue

            # Painel aberto consome cliques sobre sua área.
            if self.panel.handle_event(event):
                continue

            # Interações com a nuvem de pontos.
            if event.type == pygame.MOUSEBUTTONDOWN:
                if event.button == 1:
                    self.dots.add_or_grab(event.pos)
                elif event.button == 3:
                    self.dots.delete(event.pos)
            elif event.type == pygame.MOUSEBUTTONUP:
                if event.button == 1:
                    self.dots.release()
            elif event.type == pygame.MOUSEMOTION:
                self.dots.drag(event.pos)

    def _load_csv(self):
        """Abre um CSV (colunas x, y), normaliza para a tela e plota os pontos."""
        path = dataio.ask_open_csv()
        if not path:
            return
        try:
            points = dataio.load_csv_as_points(path)
        except Exception as exc:
            print(f"[CSV] não foi possível carregar '{path}': {exc}")
            return
        self.dots.set_points(points)

    def _save_pdf(self):
        """Gera um relatório PDF descritivo da simulação atual."""
        path = dataio.ask_save_pdf()
        if not path:
            return
        try:
            import report  # import tardio: só carrega matplotlib quando preciso
            report.generate_pdf(path, self.models, list(self.dots.coordinates))
            print(f"[PDF] relatório salvo em {path}")
        except Exception as exc:
            print(f"[PDF] falha ao gerar '{path}': {exc}")

    def _update(self):
        """Reajusta cada modelo à nuvem de pontos atual (fit a cada frame)."""
        xs = [x for x, _ in self.dots.coordinates]
        ys = [y for _, y in self.dots.coordinates]
        for model in self.models:
            model.fit(xs, ys)

    def _render(self):
        self.screen.fill(BACKGROUND)

        for i, model in enumerate(self.models):
            if not model.enabled:
                continue
            color = MODEL_COLORS[i % len(MODEL_COLORS)]

            # Bases cruas B_j: desenhadas numa faixa inferior (valores em [0, 1]).
            if getattr(model, "show_bases", False):
                for comp in model.basis_components(0, SCREEN_WIDTH, CURVE_SEGMENTS):
                    pts = [(px, BASIS_BAND_BOTTOM - v * BASIS_BAND_HEIGHT)
                           for px, v in comp]
                    if len(pts) >= 2:
                        pygame.draw.lines(
                            self.screen, BASIS_COLOR, False, pts, 1)

            # Contribuições gamma_j * B_j: na escala da curva (somam à curva final).
            if getattr(model, "show_weighted", False):
                for comp in model.weighted_components(0, SCREEN_WIDTH, CURVE_SEGMENTS):
                    pts = [(px, _clamp(v, -CURVE_Y_CLAMP, CURVE_Y_CLAMP))
                           for px, v in comp]
                    if len(pts) >= 2:
                        pygame.draw.lines(
                            self.screen, BASIS_WEIGHTED_COLOR, False, pts, 1)

            # Curva final (domínio = tela inteira: extrapola além da nuvem).
            curve = model.curve(0, SCREEN_WIDTH, CURVE_SEGMENTS)
            if len(curve) >= 2:
                points = [(px, _clamp(py, -CURVE_Y_CLAMP, CURVE_Y_CLAMP))
                          for px, py in curve]
                pygame.draw.lines(self.screen, color, False,
                                  points, MODEL_WIDTH)

        self.dots.render(self.screen)
        self._render_legend()

        # Interface por cima de tudo (o painel cobre a legenda quando aberto).
        self.menu_button.render(self.screen, active=self.panel.visible)
        self.clear_button.render(self.screen)
        self.csv_button.render(self.screen)
        self.output_button.render(self.screen)
        self.panel.render(self.screen)

        pygame.display.flip()

    def _render_legend(self):
        """Legenda (canto inferior esquerdo): cor + nome de cada modelo.

        Modelos desligados aparecem esmaecidos, para preservar o mapa de cores.
        """
        font = get_font(UI_FONT_SIZE)
        n = len(self.models)
        top = SCREEN_HEIGHT - LEGEND_MARGIN - n * LEGEND_ROW_H
        for i, model in enumerate(self.models):
            cy = top + i * LEGEND_ROW_H + LEGEND_ROW_H // 2
            color = MODEL_COLORS[i % len(MODEL_COLORS)]
            swatch = color if model.enabled else _dim(color)
            text = PANEL_TEXT if model.enabled else LEGEND_DISABLED
            pygame.draw.line(self.screen, swatch, (LEGEND_X, cy),
                             (LEGEND_X + LEGEND_SWATCH_W, cy), 3)
            img = font.render(model.name, True, text)
            self.screen.blit(
                img, (LEGEND_X + LEGEND_SWATCH_W + 8, cy - img.get_height() // 2))


if __name__ == "__main__":
    App().run()
