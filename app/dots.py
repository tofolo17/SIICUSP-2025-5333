"""Nuvem de pontos (dados) manipulável pelo usuário.

Diferente do protótipo de interpolação, aqui os pontos formam uma nuvem
*sem ordem*: a regressão por mínimos quadrados independe da ordem dos
dados, então não há inserção ordenada nem troca de posição durante o
arraste. Isso simplifica a classe e ainda permite pontos com x repetido.
"""

import math
import pygame

from config import DOT_COLOR, DOT_RADIUS, DOT_WIDTH


class Dots:
    def __init__(self):
        self.coordinates = []      # lista de (x, y) em coordenadas de tela
        self._drag_index = None    # índice do ponto sendo arrastado, ou None

    def _dot_at(self, pos):
        """Índice do primeiro ponto sob `pos`, ou None se não houver."""
        for i, dot in enumerate(self.coordinates):
            if math.dist(pos, dot) <= DOT_RADIUS:
                return i
        return None

    def add_or_grab(self, pos):
        """Clique esquerdo: pega um ponto existente para arrastar ou cria um novo."""
        index = self._dot_at(pos)
        if index is None:
            self.coordinates.append(pos)
        else:
            self._drag_index = index

    def delete(self, pos):
        """Clique direito: remove os pontos sob o cursor."""
        self.coordinates = [
            dot for dot in self.coordinates if math.dist(pos, dot) > DOT_RADIUS
        ]

    def drag(self, pos):
        """Move o ponto atualmente pego (se houver) para `pos`."""
        if self._drag_index is not None:
            self.coordinates[self._drag_index] = pos

    def release(self):
        """Solta o ponto que estava sendo arrastado."""
        self._drag_index = None

    def clear(self):
        """Remove todos os pontos."""
        self.coordinates = []
        self._drag_index = None

    def set_points(self, points):
        """Substitui todos os pontos (ex.: ao carregar um CSV)."""
        self.coordinates = [(int(px), int(py)) for px, py in points]
        self._drag_index = None

    def render(self, screen):
        for dot in self.coordinates:
            pygame.draw.circle(screen, DOT_COLOR, dot, DOT_RADIUS, DOT_WIDTH)
