"""Painel de controle (segunda "telinha", embutida na janela principal).

Estrutura:
    - 1 aba por modelo disponível (navegação entre abas no topo).
    - cada aba tem PANEL_ROWS linhas de igual tamanho, alinhadas entre abas,
      de modo que a linha i ocupa a mesma posição em qualquer aba.
    - cada linha pode conter um controle. A RLS usa só a linha 0 (on/off).

O painel desenha-se sobre a janela principal e, quando aberto, consome os
cliques sobre sua área (para não criar pontos por baixo). Fechá-lo apenas o
oculta — a aplicação principal continua.
"""

import pygame

from config import (
    ACCENT, PANEL_BG, PANEL_BORDER, PANEL_RECT, PANEL_ROWS, PANEL_TEXT,
    TAB_ACTIVE, TAB_INACTIVE, UI_FONT_SIZE,
)
from models import ParamSpec
from ui import Button, Slider, Toggle, get_font


class ControlPanel:
    def __init__(self, models):
        self.models = models
        self.visible = False
        self.active_tab = 0
        self.rect = pygame.Rect(PANEL_RECT)
        self.close_btn = Button((0, 0, 20, 20), icon="close")

        # Controles por modelo. A linha 0 é sempre o on/off (genérico, alinhado
        # entre todas as abas); as linhas seguintes vêm de param_specs().
        # Linhas 0 e 1: toggles genéricos (alinhados em todas as abas).
        # Linhas seguintes: controles específicos vindos de param_specs().
        self.controls = []
        for model in models:
            controls = [
                Toggle("Ativar modelo", model, "enabled"),
                Toggle("Clipar domínio", model, "clip_domain"),
            ]
            for spec in model.param_specs():
                if isinstance(spec, ParamSpec):
                    controls.append(Slider(spec, model))
                else:  # ToggleSpec
                    controls.append(Toggle(spec.label, model, spec.attr))
            self.controls.append(controls)

        self.tab_rects = []
        self.row_rects = []

    def toggle(self):
        self.visible = not self.visible

    def _layout(self):
        pad = 10
        r = self.rect
        x = r.x + pad
        w = r.w - 2 * pad

        # Cabeçalho (título + botão fechar)
        header_h = 24
        self.close_btn.rect = pygame.Rect(r.right - pad - 20, r.y + pad, 20, 20)
        y = r.y + pad + header_h

        # Abas (uma por modelo, dividindo a largura)
        tab_h = 26
        n = max(len(self.models), 1)
        tw = w // n
        self.tab_rects = [
            pygame.Rect(x + i * tw, y, tw - 3, tab_h) for i in range(len(self.models))
        ]
        y += tab_h + 8

        # Linhas (PANEL_ROWS de igual altura)
        rows_h = (r.bottom - pad) - y
        rh = rows_h // PANEL_ROWS
        self.row_rects = [
            pygame.Rect(x, y + i * rh, w, rh - 6) for i in range(PANEL_ROWS)
        ]

        # Posiciona os controles da aba ativa nas primeiras linhas
        for i, control in enumerate(self.controls[self.active_tab]):
            if i < PANEL_ROWS:
                control.layout(self.row_rects[i])

    def handle_event(self, event):
        """Trata um evento. Retorna True se o consumiu.

        Cliques (botão esquerdo) sobre a área do painel são sempre consumidos.
        Movimento e soltura são encaminhados aos controles para suportar o
        arraste de sliders (que pode continuar fora da área do painel).
        """
        if not self.visible:
            return False
        self._layout()

        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            if not self.rect.collidepoint(event.pos):
                return False
            if self.close_btn.hit(event.pos):
                self.visible = False
                return True
            for i, tab in enumerate(self.tab_rects):
                if tab.collidepoint(event.pos):
                    self.active_tab = i
                    return True
            for control in self.controls[self.active_tab]:
                if control.handle_event(event):
                    return True
            return True  # clique no fundo do painel: consome mesmo assim

        if event.type in (pygame.MOUSEMOTION, pygame.MOUSEBUTTONUP):
            consumed = False
            for control in self.controls[self.active_tab]:
                if control.handle_event(event):
                    consumed = True
            return consumed

        return False

    def render(self, surface):
        if not self.visible:
            return
        self._layout()
        r = self.rect

        pygame.draw.rect(surface, PANEL_BG, r, border_radius=8)
        pygame.draw.rect(surface, PANEL_BORDER, r, 1, border_radius=8)

        title = get_font(UI_FONT_SIZE).render("Visualização", True, PANEL_TEXT)
        surface.blit(title, (r.x + 10, r.y + 12))
        self.close_btn.render(surface)

        for i, (tab, model) in enumerate(zip(self.tab_rects, self.models)):
            active = i == self.active_tab
            pygame.draw.rect(surface, TAB_ACTIVE if active else TAB_INACTIVE, tab, border_radius=6)
            if active:
                pygame.draw.rect(surface, ACCENT, tab, 1, border_radius=6)
            lbl = get_font(UI_FONT_SIZE).render(model.name, True, PANEL_TEXT)
            surface.blit(lbl, lbl.get_rect(center=tab.center))

        # Mostra a grade fixa de 5 linhas (contorno tênue por linha)
        for row in self.row_rects:
            pygame.draw.rect(surface, TAB_INACTIVE, row, 1, border_radius=4)

        for control in self.controls[self.active_tab]:
            control.render(surface)
