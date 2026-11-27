# app — ferramenta visual de regressão

Aplicação em PyGame para inserir/manipular pontos e visualizar, em tempo real,
o ajuste de modelos de regressão. Materializa a fundamentação do Relatório
Parcial (em especial a formulação de Modelos Aditivos Estruturados, seção 3.5).

## Como rodar

```bash
pip install -r requirements.txt
python main.py
```

## Controles

| Ação | Efeito |
|---|---|
| Clique esquerdo (vazio) | adiciona um ponto |
| Clique esquerdo (sobre ponto) | arrasta o ponto |
| Clique direito | remove o ponto sob o cursor |
| Botão "menu" (topo-esquerda) | abre/fecha o painel de controle |
| Botão "lixeira" | limpa todos os pontos |
| Botão "página" | carrega pontos de um CSV (colunas x, y) |
| Botão "exportar" | gera um relatório PDF da simulação |

No painel, há **uma aba por modelo** (RLS, Polinomial, B-spline, P-spline).
Cada aba tem 6 linhas alinhadas entre abas: linha 0 = ligar/desligar o modelo,
linha 1 = clipar domínio (limita a curva ao intervalo dos dados; por padrão a
curva extrapola pela tela), linhas seguintes = controles específicos:

- **Polinomial**: grau (1–4).
- **B-spline**: grau (0–3), nº de nós (2–20), "Ver bases" (mostra as funções
  base `B_j`) e "Ver bases × γ" (mostra as contribuições `γ_j·B_j`, que somadas
  dão a curva). Já vem com "clipar domínio" ligado, pois a base tem suporte
  compacto.
- **P-spline**: grau (0–3), nº de nós (2–30), penalização `α` (slider discreto:
  `0, 10⁻⁸, …, 10⁰`; `α=0` recupera o B-spline puro) e ordem da diferença `r`
  (1–3). Usa muitos nós e deixa `α` controlar a suavidade; `α` grande com `r=2`
  tende a uma reta. Ajusta mesmo com nº de nós maior que o nº de pontos.

Há uma **legenda** no canto inferior esquerdo associando cada cor ao seu modelo
(modelos desligados aparecem esmaecidos). Nenhum modelo ajusta com menos de 2
pontos.

## Estrutura dos arquivos

| Arquivo | Responsabilidade |
|---|---|
| `main.py` | `App`: loop principal (eventos → update → render) e fiação dos componentes |
| `config.py` | Constantes: tela, cores, aparência de pontos/curva e do painel |
| `dots.py` | `Dots`: nuvem de pontos (sem ordenação — ver nota abaixo) |
| `models.py` | `StructuredAdditiveModel` (mãe); `SimpleLinearRegression`, `PolynomialRegression`, `BSplineRegression`, `PSplineRegression` (filhos); `ParamSpec`/`ToggleSpec` |
| `ui.py` | Widgets genéricos: `Button`, `Control`/`Toggle`/`Slider` |
| `panel.py` | `ControlPanel`: a "segunda telinha" embutida (abas + 6 linhas) |
| `dataio.py` | Carregar CSV (diálogo + normalização à tela) e diálogo de salvar PDF |
| `report.py` | Gera o relatório PDF (gráfico + equações/parâmetros/R²/pontos) |

## Decisões de design

- **Modelos por herança.** A classe mãe concentra todo o ajuste por mínimos
  quadrados (penalizados) — `gamma_hat = (BᵀB + K)⁻¹Bᵀy` — e cada filho só
  define sua base `_basis` (matriz B) e, se houver, `_penalty` (matriz K). A
  RLS é o caso `K = 0` com base `[1, x]`; o Polinomial, `K = 0` com base de
  Vandermonde `[1, x, …, xˡ]`; o B-spline, `K = 0` com base de Cox–de Boor
  (`d = m + l − 1` funções de suporte local); o P-spline é o B-spline com
  `K = α·DᵣᵀDᵣ` (penalização por diferenças). É a tradução direta da seção 3.5.
- **Controles declarativos.** O modelo expõe seus parâmetros via `param_specs()`
  (lista de `ParamSpec`, sem conhecer o pygame) e o painel constrói o widget
  (`Slider`/`Toggle`). Os toggles genéricos (ligar/desligar, clipar domínio)
  ficam alinhados nas primeiras linhas de toda aba.
- **Extrapolação por padrão.** A curva é desenhada sobre a tela toda (extrapola
  além da nuvem); `clip_domain` a restringe ao intervalo dos dados.
- **Nuvem sem ordenação.** Diferente da interpolação do protótipo, a regressão
  por mínimos quadrados independe da ordem dos pontos; isso simplifica `Dots` e
  permite x repetido.
- **Ajuste em coordenadas de tela.** Fit e desenho no mesmo sistema (y para
  baixo), então o resultado visual fica correto sem conversão de coordenadas.
  Quando entrarem eixos matemáticos, o fit migra para lá.
- **Painel embutido, não janela do SO.** O pygame mainline instalado não expõe
  o caminho limpo para uma segunda janela com a API de `Surface`; o painel é
  desenhado sobre a janela principal e fechá-lo não encerra a aplicação.
- **Controles específicos por modelo** virão de `model.param_specs()`
  (UI-agnóstico). Hoje a RLS só tem o on/off genérico (linha 0).
