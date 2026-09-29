"""Configurações globais da aplicação (tela, cores e aparência dos pontos)."""

# --- Tela ---
SCREEN_WIDTH = 640
SCREEN_HEIGHT = 480
SCREEN_SIZE = (SCREEN_WIDTH, SCREEN_HEIGHT)
TITLE = "Regressão — Visualização Interativa"
FPS = 60

# --- Cores ---
BLACK = (0, 0, 0)
WHITE = (255, 255, 255)
PURPLE = (255, 102, 255)

BACKGROUND = BLACK

# --- Pontos (nuvem de dados) ---
DOT_COLOR = WHITE
DOT_RADIUS = 7
DOT_WIDTH = 1  # espessura do contorno do círculo; 0 = preenchido

# --- Modelo (curva ajustada) ---
MODEL_COLORS = [PURPLE, (90, 210, 140), (240, 170, 70), (110, 170, 240)]  # cor por modelo (índice)
MODEL_WIDTH = 2
CURVE_SEGMENTS = 100   # nº de pontos usados para desenhar a curva (sobre a tela toda)
CURVE_Y_CLAMP = 20000  # limita |y| desenhado: extrapolação explosiva sai da tela sem artefato

# --- Legenda dos modelos (canto inferior esquerdo) ---
LEGEND_X = 10
LEGEND_MARGIN = 8       # distância da borda inferior
LEGEND_ROW_H = 20       # altura de cada item
LEGEND_SWATCH_W = 24    # comprimento do traço colorido
LEGEND_DISABLED = (110, 110, 120)  # cor do texto de um modelo desligado

# --- Visualização das bases do spline ---
BASIS_COLOR = (120, 120, 140)            # funções base B_j (cruas, em [0,1])
BASIS_WEIGHTED_COLOR = (160, 150, 110)   # contribuições gamma_j * B_j
BASIS_BAND_BOTTOM = SCREEN_HEIGHT - 8    # linha de base onde as bases cruas são desenhadas
BASIS_BAND_HEIGHT = 120                  # altura (px) para mapear o intervalo [0, 1]

# --- Interface: botões no canto superior esquerdo (coluna vertical) ---
BUTTON_RECT = (8, 8, 40, 28)          # menu: abre/fecha o painel
CLEAR_BUTTON_RECT = (8, 44, 40, 28)   # limpa todos os pontos
CSV_BUTTON_RECT = (8, 80, 40, 28)     # carrega pontos de um arquivo CSV
OUTPUT_BUTTON_RECT = (8, 116, 40, 28)  # gera um relatório PDF da simulação
BUTTON_BG = (40, 40, 48)
BUTTON_BG_ACTIVE = (60, 60, 80)

CSV_MARGIN = 50  # margem (px) ao encaixar os dados do CSV na tela

# --- Interface: painel de controle (segunda "telinha", embutida) ---
PANEL_RECT = (56, 8, 380, 392)  # x, y, w, h (à direita da coluna de botões)
PANEL_BG = (28, 28, 34)
PANEL_BORDER = (90, 90, 100)
PANEL_TEXT = (235, 235, 235)
PANEL_ROWS = 6  # nº fixo de linhas por aba (iguais e alinhadas entre abas)
TAB_ACTIVE = (60, 60, 80)
TAB_INACTIVE = (40, 40, 48)
ACCENT = PURPLE  # cor de destaque (aba ativa, controles ligados)
UI_FONT_SIZE = 18
