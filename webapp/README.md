# Regression Explorer — web app (escopo nuvem)

Versão web da ferramenta de regressão, **estática** (HTML + Canvas + JavaScript
puro, sem dependências de runtime e sem servidor). Pensada para rodar no
**GitHub Pages** e ser acessada por QR code durante a apresentação. Abre direto
na tela interativa, sem login, e funciona em celular, tablet e computador.

Este é o passo **na nuvem**, separado do escopo local do projeto (o app em
PyGame fica em `../app`, o pôster em `../poster`, a apresentação em
`../presentation`, etc.).

## O que tem

- Plano cartesiano com **grid adaptativo**, **pan** (arrastar o fundo), **zoom**
  (roda no desktop, pinça no celular) e botão **Fit** que enquadra os dados.
- Pontos: tocar no vazio adiciona, arrastar move, toque-duplo (ou clique
  direito, ou tecla Delete) remove.
- Modelos: **Line (RLS)**, **Polynomial**, **B-spline** e **P-spline**, com os
  mesmos parâmetros do app local (grau, nós, penalização λ, ordem r) e a
  visualização de **bases** e **contribuições**. Importação de **CSV** (x, y).
- Mais: **R²** com farol, detecção de **pontos influentes** (Cook), **exportação
  de PDF**, **ajuda** embutida, **seletor de idioma PT/EN** e uma **caixa de
  sugestões** (enviada por e-mail via Web3Forms).
- Mesma matemática do relatório (seção 3.5): estimador único
  `γ̂ = (BᵀB + λK)⁻¹Bᵀy`, implementado em JS (`js/linalg.js`, `js/models.js`).

## Rodar localmente

Como são arquivos estáticos, qualquer servidor simples serve. Ex.:

```bash
cd webapp
python -m http.server 8000
```

Abra `http://localhost:8000`. (Abrir o `index.html` por duplo clique também
funciona, por usar scripts clássicos, não módulos.)

## Publicação (GitHub Pages, automática)

O deploy é automático. A cada push na `main`, o workflow
`.github/workflows/deploy-pages.yml` (via `peaceiris/actions-gh-pages`) publica
o conteúdo da pasta `webapp/` no branch `gh-pages`. Em **Settings → Pages**, a
fonte é **Deploy from a branch → `gh-pages` → `/(root)`**.

URL publicada: **<https://tofolo17.github.io/SIICUSP-2025-5333/>**

Para gerar o **QR code** apontando para essa URL, qualquer gerador serve (ou o
pacote `qrcode` em Python).

### Integrações opcionais

- **Caixa de sugestões** (aba *Sugestões* da ajuda): envia por e-mail via
  [Web3Forms](https://web3forms.com). Basta colar a *access key* na constante
  `WEB3FORMS_KEY` em `js/app.js`. Sem a chave, o formulário avisa que ainda não
  foi configurado.
- **Contador de acessos**: há uma linha comentada do
  [GoatCounter](https://www.goatcounter.com) no fim do `index.html`. Troque
  `SEU-CODIGO` pelo código do seu site e descomente para ativar. O painel
  (visitas, país, horário) é privado, acessível só com o seu login.

## Estrutura

```
webapp/
  index.html          estrutura da página e carga dos scripts
  css/style.css       estilo (Newsreader + IBM Plex, azul IME), responsivo
  js/linalg.js        álgebra linear (solve das equações normais)
  js/models.js        Line / Polynomial / B-spline / P-spline (Cox–de Boor, penalização)
  js/diagnostics.js   diagnósticos da RLS: reta de MQ, R² e distância de Cook
  js/i18n.js          dicionário e idioma (PT/EN); todo texto de interface passa por aqui
  js/plot.js          plano cartesiano: transform, grid, pan, zoom, fit
  js/app.js           estado, interação (mouse + toque), painel, ajuda, render
```

Cada arquivo `js/*` registra o que expõe no namespace `window.RW` (`RW.linalg`,
`RW.models`, `RW.Plot`, `RW.diag`, `RW.i18n`), e o `app.js` costura tudo. Para
**adicionar um modelo**, mexe-se em `models.js`; para **ajustar textos**, em
`i18n.js`; a matemática de diagnóstico fica em `diagnostics.js`.
