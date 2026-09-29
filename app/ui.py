"""Widgets genéricos da interface (botões e controles de linha do painel).

Os ícones (menu/fechar) são desenhados em código, sem depender de arquivos de
fonte. Textos usam a fonte padrão do pygame (`Font(None, ...)`).
"""

import math

import pygame

from config import (
    ACCENT, BUTTON_BG, BUTTON_BG_ACTIVE, PANEL_BORDER, PANEL_TEXT, UI_FONT_SIZE,
)

_font_cache = {}


def get_font(size):
    """Fonte padrão do pygame, cacheada por tamanho."""
    if size not in _font_cache:
        _font_cache[size] = pygame.font.Font(None, size)
    return _font_cache[size]


class Button:
    """Botão retangular com rótulo de texto OU ícone desenhado ('menu' | 'close')."""

    def __init__(self, rect, label="", icon=None):
        self.rect = pygame.Rect(rect)
        self.label = label
        self.icon = icon

    def hit(self, pos):
        return self.rect.collidepoint(pos)

    def render(self, surface, active=False):
        bg = BUTTON_BG_ACTIVE if active else BUTTON_BG
        pygame.draw.rect(surface, bg, self.rect, border_radius=6)
        pygame.draw.rect(surface, PANEL_BORDER, self.rect, 1, border_radius=6)

        if self.icon == "menu":
            self._draw_menu(surface)
        elif self.icon == "close":
            self._draw_close(surface)
        elif self.icon == "trash":
            self._draw_trash(surface)
        elif self.icon == "file":
            self._draw_file(surface)
        elif self.icon == "export":
            self._draw_export(surface)
        elif self.label:
            img = get_font(UI_FONT_SIZE).render(self.label, True, PANEL_TEXT)
            surface.blit(img, img.get_rect(center=self.rect.center))

    def _draw_menu(self, surface):
        cx, cy = self.rect.center
        for dy in (-5, 0, 5):
            pygame.draw.line(surface, PANEL_TEXT,
                             (cx - 9, cy + dy), (cx + 9, cy + dy), 2)

    def _draw_close(self, surface):
        r, m = self.rect, 5
        pygame.draw.line(surface, PANEL_TEXT, (r.left + m,
                         r.top + m), (r.right - m, r.bottom - m), 2)
        pygame.draw.line(surface, PANEL_TEXT, (r.left + m,
                         r.bottom - m), (r.right - m, r.top + m), 2)

    def _draw_trash(self, surface):
        cx, cy = self.rect.center
        w, h = 12, 12
        top = cy - h // 2 + 1
        pygame.draw.line(surface, PANEL_TEXT, (cx - 3, top - 3),
                         (cx + 3, top - 3), 2)   # alça
        pygame.draw.line(surface, PANEL_TEXT, (cx - w, top),
                         (cx + w, top), 2)           # tampa
        body = pygame.Rect(cx - w + 2, top + 2, 2 * (w - 2), h)
        pygame.draw.rect(surface, PANEL_TEXT, body,
                         1)                                   # corpo
        for dx in (-4, 0, 4):
            pygame.draw.line(surface, PANEL_TEXT,
                             (cx + dx, top + 5), (cx + dx, top + h), 1)

    def _draw_file(self, surface):
        cx, cy = self.rect.center
        w, h, fold = 12, 16, 4
        left, top = cx - w // 2, cy - h // 2
        outline = [(left, top), (left + w - fold, top), (left + w, top + fold),
                   (left + w, top + h), (left, top + h)]
        pygame.draw.polygon(surface, PANEL_TEXT, outline, 1)
        pygame.draw.line(surface, PANEL_TEXT, (left + w - fold, top),
                         (left + w - fold, top + fold), 1)
        pygame.draw.line(surface, PANEL_TEXT, (left + w - fold, top + fold),
                         (left + w, top + fold), 1)
        for i in range(3):  # "linhas de texto" da página
            yy = top + 7 + i * 3
            pygame.draw.line(surface, PANEL_TEXT, (left + 3, yy), (left + w - 3, yy), 1)

    def _draw_export(self, surface):
        cx, cy = self.rect.center
        pygame.draw.line(surface, PANEL_TEXT, (cx, cy - 7), (cx, cy + 3), 2)        # haste
        pygame.draw.lines(surface, PANEL_TEXT, False,
                          [(cx - 4, cy - 1), (cx, cy + 3), (cx + 4, cy - 1)], 2)    # ponta da seta
        pygame.draw.line(surface, PANEL_TEXT, (cx - 7, cy + 6), (cx + 7, cy + 6), 2)  # bandeja


class Control:
    """Base de um controle que ocupa uma linha do painel.

    `layout` recebe o retângulo da linha; `render`/`handle_event` operam sobre
    o retângulo armazenado (coordenadas da janela principal — o painel é desenhado
    nela mesma, então não há conversão de coordenadas).
    """

    def __init__(self, label):
        self.label = label
        self.rect = pygame.Rect(0, 0, 0, 0)

    def layout(self, rect):
        self.rect = pygame.Rect(rect)

    def render(self, surface):
        raise NotImplementedError

    def handle_event(self, event):
        return False


class Toggle(Control):
    """Controle on/off ligado a um atributo booleano de um objeto (obj.attr).

    Clicar em qualquer ponto da linha alterna o valor.
    """

    def __init__(self, label, obj, attr):
        super().__init__(label)
        self.obj = obj
        self.attr = attr

    @property
    def value(self):
        return getattr(self.obj, self.attr)

    def render(self, surface):
        img = get_font(UI_FONT_SIZE).render(self.label, True, PANEL_TEXT)
        surface.blit(img, img.get_rect(
            midleft=(self.rect.x + 8, self.rect.centery)))

        box = pygame.Rect(0, 0, 22, 22)
        box.center = (self.rect.right - 20, self.rect.centery)
        if self.value:
            pygame.draw.rect(surface, ACCENT, box, border_radius=4)
            pygame.draw.lines(
                surface, (20, 20, 24), False,
                [(box.left + 5, box.centery),
                 (box.centerx - 1, box.bottom - 6),
                 (box.right - 4, box.top + 5)], 2,
            )
        else:
            pygame.draw.rect(surface, PANEL_BORDER, box, 2, border_radius=4)

    def handle_event(self, event):
        if (event.type == pygame.MOUSEBUTTONDOWN and event.button == 1
                and self.rect.collidepoint(event.pos)):
            setattr(self.obj, self.attr, not self.value)
            return True
        return False


class Slider(Control):
    """Controle deslizante ligado a um atributo numérico (spec.attr de obj).

    Guiado por um `ParamSpec` (label, vmin, vmax, step). Com `step` definido,
    o valor encaixa nesse passo (ex.: step=1 → graus inteiros); com `step=None`
    o valor é contínuo. Clicar na linha posiciona o valor e inicia o arraste.
    """

    def __init__(self, spec, obj):
        super().__init__(spec.label)
        self.spec = spec
        self.obj = obj
        self._dragging = False

    @property
    def value(self):
        return getattr(self.obj, self.spec.attr)

    def _set_value(self, v):
        s = self.spec
        if s.values:  # conjunto discreto de valores: encaixa no mais próximo
            v = min(s.values, key=lambda c: abs(c - v))
            setattr(self.obj, s.attr, v)
            return
        v = max(s.vmin, min(s.vmax, v))
        if s.step:
            k = round((v - s.vmin) / s.step)
            v = s.vmin + k * s.step
            if float(s.step).is_integer() and float(s.vmin).is_integer():
                v = int(round(v))
        setattr(self.obj, s.attr, v)

    def _track(self):
        r = self.rect
        return r.x + 12, r.right - 12, r.bottom - 12  # x1, x2, y

    def _value_to_x(self, x1, x2):
        s = self.spec
        if s.values:  # posição = índice da parada mais próxima
            idx = min(range(len(s.values)), key=lambda i: abs(s.values[i] - self.value))
            frac = idx / (len(s.values) - 1)
        elif s.log:
            frac = (math.log(self.value) - math.log(s.vmin)) / \
                (math.log(s.vmax) - math.log(s.vmin))
        else:
            frac = (self.value - s.vmin) / (s.vmax - s.vmin)
        return x1 + frac * (x2 - x1)

    def _x_to_value(self, px, x1, x2):
        s = self.spec
        frac = min(1.0, max(0.0, (px - x1) / max(x2 - x1, 1)))
        if s.values:
            return s.values[round(frac * (len(s.values) - 1))]
        if s.log:
            return math.exp(math.log(s.vmin) + frac * (math.log(s.vmax) - math.log(s.vmin)))
        return s.vmin + frac * (s.vmax - s.vmin)

    def _value_text(self):
        v = self.value
        return str(v) if isinstance(v, int) else f"{v:.3g}"

    def render(self, surface):
        font = get_font(UI_FONT_SIZE)
        label = font.render(
            f"{self.label}: {self._value_text()}", True, PANEL_TEXT)
        surface.blit(label, (self.rect.x + 8, self.rect.y + 4))

        x1, x2, y = self._track()
        pygame.draw.line(surface, PANEL_BORDER, (x1, y), (x2, y), 2)

        s = self.spec
        n = None  # nº de intervalos entre marcas (se houver paradas discretas)
        if s.values:
            n = len(s.values) - 1
        elif s.step:
            n = max(int(round((s.vmax - s.vmin) / s.step)), 1)
        if n:
            for k in range(n + 1):
                tx = x1 + (k / n) * (x2 - x1)
                pygame.draw.line(surface, PANEL_BORDER,
                                 (tx, y - 3), (tx, y + 3), 1)

        kx = self._value_to_x(x1, x2)
        pygame.draw.circle(surface, ACCENT, (int(kx), int(y)), 7)

    def handle_event(self, event):
        if (event.type == pygame.MOUSEBUTTONDOWN and event.button == 1
                and self.rect.collidepoint(event.pos)):
            self._dragging = True
            x1, x2, _ = self._track()
            self._set_value(self._x_to_value(event.pos[0], x1, x2))
            return True
        if event.type == pygame.MOUSEMOTION and self._dragging:
            x1, x2, _ = self._track()
            self._set_value(self._x_to_value(event.pos[0], x1, x2))
            return True
        if event.type == pygame.MOUSEBUTTONUP and event.button == 1 and self._dragging:
            self._dragging = False
            return True
        return False
