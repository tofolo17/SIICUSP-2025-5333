"""Modelos de regressão sob a ótica dos Modelos Aditivos Estruturados.

Base teórica: seção 3.5 do Relatório Parcial. A função de regressão é
escrita como

    s(x) = beta_0 + f(x),    f(x) = sum_j gamma_j * phi_j(x),

que, em forma matricial, vira  y = B gamma + eps, onde B é a matriz de base
(coluna j = phi_j avaliada nos x_i). A estimação por mínimos quadrados
(penalizados) leva ao MESMO estimador para todos os modelos:

    gamma_hat = (B^T B + K)^{-1} B^T y,

diferindo apenas na forma específica de B (a base) e K (a penalização).
Por isso `StructuredAdditiveModel` concentra toda a lógica compartilhada e
cada modelo concreto só precisa definir sua base e, se houver, sua penalização.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class ParamSpec:
    """Descrição UI-agnóstica de um parâmetro ajustável de um modelo.

    O painel usa isto para construir o widget; o modelo não conhece o pygame.
    `attr` é o nome do atributo no modelo; `step=None` indica valor contínuo,
    senão o controle encaixa nesse passo (ex.: step=1 para inteiros).
    """

    attr: str
    label: str
    vmin: float
    vmax: float
    step: float | None = None
    log: bool = False  # se True, o slider mapeia o valor em escala logarítmica
    values: tuple | None = None  # se definido, o slider assume apenas estes valores (discreto)


@dataclass(frozen=True)
class ToggleSpec:
    """Descrição UI-agnóstica de um parâmetro booleano (vira um checkbox/Toggle)."""

    attr: str
    label: str


class StructuredAdditiveModel(ABC):
    """Classe mãe: ajuste por mínimos quadrados (penalizados) y = B gamma.

    Subclasses devem definir `_basis` e, opcionalmente, `_penalty`.
    """

    name = "Modelo"  # rótulo exibido na aba do painel (cada modelo sobrescreve)

    def __init__(self):
        self.enabled = True            # liga/desliga (controle on/off no painel)
        self.clip_domain = False       # se True, a curva fica restrita ao domínio dos dados
        self.gamma = None              # coeficientes estimados (gamma_hat)
        self._x_min = None
        self._x_max = None

    # --- a ser especializado por cada modelo ---

    @abstractmethod
    def _basis(self, x):
        """Matriz de base B (n x d): coluna j = phi_j(x). `x` é um array 1D."""
        raise NotImplementedError

    def _penalty(self, d):
        """Matriz de penalização K (d x d).

        Padrão: sem penalização (K = 0), recuperando o estimador clássico de
        mínimos quadrados. Modelos como P-splines sobrescrevem este método.
        """
        return np.zeros((d, d))

    def param_specs(self):
        """Parâmetros específicos do modelo, expostos ao painel de controle.

        Descrição UI-agnóstica (o modelo não conhece o pygame); o painel decide
        como renderizar. Padrão: nenhum. A RLS herda esta lista vazia — seu
        único controle é o on/off genérico. P-splines retornarão, p.ex., o λ.
        """
        return []

    def _prepare(self, x):
        """Hook opcional: a subclasse calcula estado de ajuste a partir de x
        (ex.: padronização, posição de nós) ANTES de montar a base. Padrão: nada."""
        pass

    # --- lógica compartilhada por todos os modelos ---

    def fit(self, x, y):
        """Estima gamma a partir dos pontos (x, y). Em sistema singular
        (ex.: poucos pontos ou x colineares), deixa o modelo como não ajustado."""
        x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)

        # Regressão exige ao menos 2 pontos. Sem este guard, a penalização de um
        # P-spline (com a partição da unidade da base) chega a "ajustar" um único
        # ponto — um ajuste que os dados não sustentam. Nenhum modelo desenha com
        # menos de 2 pontos.
        if x.size < 2:
            self.gamma = None
            return self

        self._prepare(x)
        B = self._basis(x)
        K = self._penalty(B.shape[1])

        # Equações normais: (B^T B + K) gamma = B^T y
        A = B.T @ B + K
        rhs = B.T @ y

        # Posto deficiente => sem solução única (poucos pontos para a base, ou x
        # colineares). A penalização K pode tornar A inversível mesmo com n < d,
        # então testamos o posto de A (e não só n vs. nº de colunas).
        if np.linalg.matrix_rank(A) < A.shape[0]:
            self.gamma = None
        else:
            try:
                self.gamma = np.linalg.solve(A, rhs)
            except np.linalg.LinAlgError:
                self.gamma = None

        self._x_min, self._x_max = float(x.min()), float(x.max())
        return self

    def predict(self, x):
        """Avalia o modelo ajustado: y_hat = B(x) gamma."""
        x = np.asarray(x, dtype=float)
        return self._basis(x) @ self.gamma

    def is_fitted(self):
        return self.gamma is not None

    # --- descrição do modelo (para o relatório PDF) ---

    DESCRIPTION = "Modelo de regressão aditivo estruturado."

    def equation_text(self):
        """Equação do modelo em texto (forma geral; subclasses especializam)."""
        return "s(x) = soma_j  gamma_j * phi_j(x)"

    def r_squared(self, x, y):
        """Coeficiente de determinação R² do ajuste sobre (x, y), ou None."""
        if not self.is_fitted():
            return None
        y = np.asarray(y, dtype=float)
        ss_res = float(np.sum((y - self.predict(np.asarray(x, dtype=float))) ** 2))
        ss_tot = float(np.sum((y - y.mean()) ** 2))
        return 1.0 - ss_res / ss_tot if ss_tot > 0 else None

    def _draw_domain(self, x_min, x_max):
        """Domínio efetivo de desenho: restringe a [_x_min,_x_max] se clip_domain."""
        if self.clip_domain:
            return max(x_min, self._x_min), min(x_max, self._x_max)
        return x_min, x_max

    def curve(self, x_min, x_max, segments):
        """Polilinha [(x, y), ...] da curva ajustada sobre [x_min, x_max].

        O domínio é fornecido por quem desenha (tipicamente toda a largura da
        tela), de modo que a curva EXTRAPOLA para além da nuvem de pontos. Se
        `clip_domain` estiver ligado, a curva é restrita ao intervalo dos dados
        [_x_min, _x_max]. Retorna [] se o modelo não está ajustado (o que inclui
        o caso de todos os pontos na mesma vertical, sem solução única).
        """
        if not self.is_fitted():
            return []
        x_min, x_max = self._draw_domain(x_min, x_max)
        xs = np.linspace(x_min, x_max, segments)
        ys = self.predict(xs)
        return [(float(px), float(py)) for px, py in zip(xs, ys)]

    def basis_components(self, x_min, x_max, segments):
        """Polilinhas das funções base B_j (cruas). Vazio se não há o que mostrar.

        Sobrescrito por modelos cuja base é interessante de visualizar (B-spline).
        """
        return []

    def weighted_components(self, x_min, x_max, segments):
        """Polilinhas das contribuições gamma_j * B_j (que somadas dão a curva)."""
        return []


class SimpleLinearRegression(StructuredAdditiveModel):
    """Regressão Linear Simples: s(x) = beta_0 + beta_1 * x.

    Caso particular do modelo aditivo estruturado com base phi_1(x) = 1,
    phi_2(x) = x e sem penalização (K = 0). O estimador recai no clássico
    gamma_hat = (B^T B)^{-1} B^T y, com gamma = (beta_0, beta_1).
    """

    name = "RLS"
    DESCRIPTION = ("Regressão linear simples: ajusta a reta y = b0 + b1*x por "
                   "mínimos quadrados (base [1, x], sem penalização).")

    def _basis(self, x):
        return np.column_stack([np.ones_like(x), x])

    def equation_text(self):
        if self.is_fitted():
            b0, b1 = self.gamma
            return f"s(x) = {b0:.3f} + {b1:.3f} * x"
        return "s(x) = b0 + b1 * x"


class PolynomialRegression(StructuredAdditiveModel):
    """Regressão polinomial: s(x) = gamma_0 + gamma_1 x + ... + gamma_l x^l (grau l).

    Base teórica: seção 3.3.2. Caso particular do modelo aditivo estruturado
    com base phi_j(x) = x^j (j = 0..grau) e sem penalização (K = 0). Grau 1
    recupera a RLS. NÃO é spline: é um único polinômio global sobre todo o
    domínio (e exibe, de propósito, as oscilações de graus altos — pedagógico).

    Nota numérica: a base é montada sobre x padronizado (centrado e
    escalonado) para evitar o mau condicionamento das equações normais quando
    x está em escala de pixels e o grau é alto. A padronização é interna e
    reaplicada no predict, então o ajuste é o mesmo polinômio de mínimos
    quadrados, porém numericamente estável.
    """

    name = "Polinomial"
    DESCRIPTION = ("Regressão polinomial: um único polinômio global de grau l "
                   "(base 1, x, ..., x^l). NÃO é spline. Sem penalização.")

    def equation_text(self):
        return (f"s(x) = g0 + g1*x + ... + g{self.degree}*x^{self.degree}"
                f"   (grau {self.degree}; coeficientes sobre x padronizado)")

    def __init__(self, degree=3):
        super().__init__()
        self.degree = degree
        self._x_center = 0.0
        self._x_scale = 1.0

    def param_specs(self):
        return [ParamSpec("degree", "Grau", 1, 4, step=1)]

    def _prepare(self, x):
        std = x.std()
        self._x_center = float(x.mean())
        self._x_scale = float(std) if std > 0 else 1.0

    def _basis(self, x):
        z = (x - self._x_center) / self._x_scale
        return np.vander(z, self.degree + 1, increasing=True)


class BSplineRegression(StructuredAdditiveModel):
    """Regressão por B-splines: s(x) = sum_j gamma_j B_j(x).

    Base teórica: seções 3.3.3 e 3.3.4. A base de B-splines de grau l com m nós
    igualmente espaçados (distância constante h) tem d = m + l - 1 funções, cada
    uma com suporte local. Construção pela recursão de Cox-de Boor; a sequência
    de nós é estendida por l nós de cada lado, com o mesmo h. Sem penalização
    (K = 0) — recai em mínimos quadrados (a penalização entra nos P-splines, 3.4).

    Como o suporte é compacto, fora do intervalo dos dados a curva tende a zero;
    por isso o modelo já vem com clip_domain ligado por padrão.
    """

    name = "B-spline"
    DESCRIPTION = ("Regressão por B-splines: combinação de funções base locais "
                   "(Cox-de Boor) com grau l e m nós igualmente espaçados. Sem penalização.")

    def equation_text(self):
        d = self.n_knots + self.degree - 1
        return (f"s(x) = soma_(j=1)^{d}  gamma_j * B_j(x)"
                f"   (grau {self.degree}, {self.n_knots} nós, {d} bases)")

    def __init__(self, degree=3, n_knots=6):
        super().__init__()
        self.degree = degree         # grau l do spline
        self.n_knots = n_knots       # m nós igualmente espaçados sobre [x_min, x_max]
        self.show_bases = False      # ver as funções base B_j (cruas)
        self.show_weighted = False   # ver as contribuições gamma_j * B_j
        self.clip_domain = True      # suporte compacto: clipar faz sentido como padrão
        self._knots = None

    def param_specs(self):
        return [
            ParamSpec("degree", "Grau", 0, 3, step=1),
            ParamSpec("n_knots", "Nº de nós", 2, 20, step=1),
            ToggleSpec("show_bases", "Ver bases"),
            ToggleSpec("show_weighted", "Ver bases × γ"),
        ]

    def _prepare(self, x):
        xlo, xhi = float(np.min(x)), float(np.max(x))
        if xhi <= xlo:
            xhi = xlo + 1.0
        l, m = self.degree, self.n_knots
        h = (xhi - xlo) / (m - 1)
        # nós sobre [xlo, xhi] estendidos por l de cada lado com o mesmo h
        self._knots = xlo + h * np.arange(-l, m + l)

    def _basis(self, x):
        return self._cox_de_boor(np.asarray(x, dtype=float), self._knots, self.degree)

    @staticmethod
    def _cox_de_boor(x, knots, degree):
        """Matriz de base B (len(x) x d), d = len(knots) - 1 - degree."""
        # Grau 0: indicadores dos intervalos [t_i, t_{i+1})
        cols = len(knots) - 1
        B = np.zeros((x.size, cols))
        for i in range(cols):
            B[:, i] = (x >= knots[i]) & (x < knots[i + 1])
        # Recursão até o grau desejado
        for d in range(1, degree + 1):
            cols = len(knots) - 1 - d
            nxt = np.zeros((x.size, cols))
            for i in range(cols):
                den1 = knots[i + d] - knots[i]
                den2 = knots[i + d + 1] - knots[i + 1]
                t1 = (x - knots[i]) / den1 * B[:, i] if den1 > 0 else 0.0
                t2 = (knots[i + d + 1] - x) / den2 * B[:, i + 1] if den2 > 0 else 0.0
                nxt[:, i] = t1 + t2
            B = nxt
        return B

    def basis_components(self, x_min, x_max, segments):
        if not self.is_fitted():
            return []
        x_min, x_max = self._draw_domain(x_min, x_max)
        xs = np.linspace(x_min, x_max, segments)
        B = self._basis(xs)
        return [[(float(xs[k]), float(B[k, j])) for k in range(xs.size)]
                for j in range(B.shape[1])]

    def weighted_components(self, x_min, x_max, segments):
        if not self.is_fitted():
            return []
        x_min, x_max = self._draw_domain(x_min, x_max)
        xs = np.linspace(x_min, x_max, segments)
        B = self._basis(xs)
        return [[(float(xs[k]), float(B[k, j] * self.gamma[j])) for k in range(xs.size)]
                for j in range(B.shape[1])]


class PSplineRegression(BSplineRegression):
    """Splines penalizados (P-splines): seção 3.4.

    É um B-spline (mesma base de Cox-de Boor) com penalização por diferenças
    finitas de ordem r entre coeficientes consecutivos:

        K = alpha * D_r^T D_r,

    onde D_r é o operador de diferença de ordem r e `alpha` é o peso da
    penalização (o λ da seção 3.4). O estimador continua o da mãe,
    gamma_hat = (B^T B + K)^{-1} B^T y. A ideia é usar MUITOS nós e deixar a
    penalização — não o número de nós — controlar a suavidade. Para alpha
    grande, o ajuste tende a um polinômio de grau r-1 (ex.: r=2 → quase reta).

    Como K cobre o complemento do espaço de polinômios de grau r-1, o sistema
    `A = B^T B + K` fica inversível mesmo com nº de nós > nº de pontos — por isso
    o guard de posto da mãe (sobre A) já permite o ajuste nesse regime.
    """

    name = "P-spline"
    DESCRIPTION = ("Spline penalizado: B-spline com penalização das diferenças de "
                   "ordem r dos coeficientes (peso alpha) controlando a suavidade. "
                   "alpha grande com r=2 aproxima uma reta; alpha=0 recai no B-spline.")

    def equation_text(self):
        d = self.n_knots + self.degree - 1
        return (f"s(x) = soma gamma_j * B_j(x),  penalizacao  alpha * ||D_{self.r} gamma||^2"
                f"   (alpha={self.alpha:g}, r={self.r}, grau {self.degree}, {self.n_knots} nós, {d} bases)")

    # Paradas do slider de α: 0 (B-spline puro) e potências de 10 de 1e-8 a 1e0.
    ALPHA_VALUES = (0.0,) + tuple(10.0 ** k for k in range(-8, 1))

    def __init__(self, degree=3, n_knots=20, alpha=1e-4, r=2):
        super().__init__(degree=degree, n_knots=n_knots)
        self.alpha = alpha   # peso da penalização (λ da seção 3.4)
        self.r = r           # ordem das diferenças
        self.clip_domain = True

    def param_specs(self):
        return [
            ParamSpec("degree", "Grau", 0, 3, step=1),
            ParamSpec("n_knots", "Nº de nós", 2, 30, step=1),
            ParamSpec("alpha", "Penalização α", 0, 1, values=self.ALPHA_VALUES),  # 0 => B-spline puro
            ParamSpec("r", "Ordem da dif. r", 1, 3, step=1),
        ]

    def _penalty(self, d):
        r = int(min(self.r, d - 1))
        if r < 1 or self.alpha <= 0:
            return np.zeros((d, d))
        D = np.diff(np.eye(d), n=r, axis=0)   # operador de diferença de ordem r
        return self.alpha * (D.T @ D)
