# Ferramenta visual para exploração de estruturas semiparamétricas em regressão

> 🇧🇷 [Português](#o-que-você-encontrará-neste-repositório) · 🇺🇸 [English](#what-will-you-find-in-this-repository)

> 🌐 **Demo online / Live demo:** <https://tofolo17.github.io/SIICUSP-2025-5333/> — roda direto no navegador (celular, tablet ou computador), sem instalar.

## O que você encontrará neste repositório?

Aplicação interativa desenvolvida no projeto de iniciação científica de **Gustavo Valencio Tofolo**, orientado pelo
**Prof. Dr. Francisco Felipe de Queiroz** (Departamento de Matemática Aplicada, IME-USP), com bolsa do Programa
Unificado de Bolsas (PUB). Esta versão acompanha o relatório parcial de **2026**.

A ideia é tornar tangíveis os modelos de regressão estudados: você clica na tela para criar uma nuvem de pontos e vê,
em tempo real, como cada modelo se ajusta a ela e como seus parâmetros mudam a curva.

Modelos implementados a partir dos fundamentos, todos como casos particulares de um **modelo aditivo estruturado**:

- **RLS** — regressão linear simples;
- **Polinomial** — grau de 1 a 4;
- **B-spline** — grau e número de nós ajustáveis, com opção de ver as funções base $B_j$ e as contribuições
  $\hat\gamma_j B_j$;
- **P-spline** — B-spline com penalização por diferenças (α e ordem $r$ ajustáveis).

As implementações foram validadas contra `numpy.polyfit` e `scipy.interpolate`, com diferenças da ordem da precisão de
máquina (detalhes no relatório).

### Versão web (sem instalar)

🌐 **<https://tofolo17.github.io/SIICUSP-2025-5333/>** — abre direto no navegador, sem login.

Porta web da ferramenta, estática (HTML + Canvas + JavaScript puro, sem servidor). Tem as mesmas funcionalidades da
versão desktop e acrescenta:

- **plano cartesiano** com grid, **zoom** e **pan** (estilo GeoGebra) e um botão para **enquadrar aos dados**;
- **R²** da RLS em tempo real, com farol (verde / amarelo / vermelho);
- **detecção de pontos influentes** pela distância de Cook, e a RLS reajustada sem eles;
- **exportação de PDF** e um botão de **ajuda** com explicações de cada modelo;
- interface **responsiva**, pensada para o celular.

Publicada no **GitHub Pages**; cada push na `main` republica automaticamente (via GitHub Actions). O código está em
`webapp/`.

### Estrutura

```
├── Relatório Parcial 2°Sem - Entrega.pdf   # relatório: fundamentação teórica, metodologia e resultados
├── app/              # versão desktop (PyGame)
    ├── main.py        # ponto de entrada (janela, eventos e desenho)
    ├── models.py      # modelos de regressão (classe-mãe + RLS, polinomial, B-spline, P-spline)
    ├── panel.py       # painel de controle: uma aba por modelo
    ├── ui.py          # botões, sliders e toggles
    ├── dots.py        # nuvem de pontos editável
    ├── dataio.py      # leitura de CSV e diálogos de arquivo
    ├── report.py      # exportação de um relatório PDF da simulação
    └── config.py      # tela, cores e layout
└── webapp/            # versão web (HTML + Canvas + JS), publicada no GitHub Pages
    ├── index.html
    ├── css/style.css
    └── js/            # linalg, models, plot, app
```

### Ferramentas

Python 3, NumPy, PyGame e Matplotlib (só para o PDF de saída). SciPy foi usado apenas na validação.

### Como usar

```bash
git clone https://github.com/tofolo17/SIICUSP-2025-5333.git
cd SIICUSP-2025-5333/app
pip install -r requirements.txt
python main.py
```

| Ação                     | Controle                                         |
|--------------------------|--------------------------------------------------|
| Adicionar / arrastar ponto | botão esquerdo do mouse                        |
| Remover ponto            | botão direito do mouse                           |
| Abrir o painel de modelos | botão "menu" (canto superior esquerdo)          |
| Limpar, carregar CSV, exportar PDF | botões logo abaixo do menu             |

O CSV deve ter duas colunas numéricas (x, y); os dados são reescalados para caber na tela.

### Licença

Ainda sem licença definida; a intenção, descrita no relatório, é disponibilizar a ferramenta como software livre sob a
licença MIT.

---

## What will you find in this repository?

An interactive application built in the undergraduate research project of **Gustavo Valencio Tofolo**, advised by
**Prof. Dr. Francisco Felipe de Queiroz** (Department of Applied Mathematics, IME-USP), funded by USP's Programa
Unificado de Bolsas (PUB). This version goes with the **2026** partial report (in Portuguese).

The goal is to make the studied regression models tangible: you click on the screen to build a point cloud and watch,
in real time, how each model fits it and how its parameters change the curve.

Models implemented from first principles, all as special cases of a **structured additive model**:

- **RLS** — simple linear regression;
- **Polynomial** — degree 1 to 4;
- **B-spline** — adjustable degree and number of knots, with the option to show the basis functions $B_j$ and the
  contributions $\hat\gamma_j B_j$;
- **P-spline** — B-spline with a difference penalty (adjustable α and order $r$).

The implementations were validated against `numpy.polyfit` and `scipy.interpolate`, with differences on the order of
machine precision (details in the report).

### Web version (no install)

🌐 **<https://tofolo17.github.io/SIICUSP-2025-5333/>** — runs straight in the browser, no login.

A static web port of the tool (HTML + Canvas + plain JavaScript, no server). It has the same features as the desktop
version and adds:

- a **Cartesian plane** with grid, **zoom** and **pan** (GeoGebra-style) and a **fit-to-data** button;
- **R²** for the line in real time, with a traffic light (green / yellow / red);
- **influential-point detection** via Cook's distance, and the line refit without them;
- **PDF export** and a **help** button explaining each model;
- a **responsive**, mobile-first interface.

Deployed on **GitHub Pages**; every push to `main` redeploys automatically (via GitHub Actions). The code lives in
`webapp/`.

### Structure

```
├── Relatório Parcial 2°Sem - Entrega.pdf   # report: theory, methodology and results
├── app/              # desktop version (PyGame)
    ├── main.py        # entry point (window, events and drawing)
    ├── models.py      # regression models (base class + RLS, polynomial, B-spline, P-spline)
    ├── panel.py       # control panel: one tab per model
    ├── ui.py          # buttons, sliders and toggles
    ├── dots.py        # editable point cloud
    ├── dataio.py      # CSV loading and file dialogs
    ├── report.py      # exports a PDF report of the simulation
    └── config.py      # screen, colors and layout
└── webapp/            # web version (HTML + Canvas + JS), deployed on GitHub Pages
    ├── index.html
    ├── css/style.css
    └── js/            # linalg, models, plot, app
```

### Tools

Python 3, NumPy, PyGame and Matplotlib (only for the output PDF). SciPy was used only for validation.

### How to use

```bash
git clone https://github.com/tofolo17/SIICUSP-2025-5333.git
cd SIICUSP-2025-5333/app
pip install -r requirements.txt
python main.py
```

| Action                   | Control                                          |
|--------------------------|--------------------------------------------------|
| Add / drag a point       | left mouse button                                |
| Remove a point           | right mouse button                               |
| Open the models panel    | "menu" button (top-left corner)                  |
| Clear, load CSV, export PDF | buttons right below the menu                  |

The CSV must have two numeric columns (x, y); the data is rescaled to fit the screen.

### License

No license defined yet; as stated in the report, the plan is to release the tool as free software under the MIT
license.
