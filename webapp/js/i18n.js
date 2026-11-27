/* Internacionalização (PT / EN). Expõe RW.i18n com o idioma atual e as traduções.
   Todo texto de interface do app passa por aqui, então adicionar/ajustar textos
   é mexer só neste arquivo. */
(function (RW) {
  "use strict";

  const DICT = {
    en: {
      brandSub: "line · polynomial · B-spline · P-spline, in real time",
      help: "Help", fit: "Fit", grid: "Grid", csv: "CSV", pdf: "PDF", clear: "Clear", models: "Models",
      t_help: "About and help", t_fit: "Fit view to data", t_grid: "Toggle grid", t_csv: "Import CSV (x, y)",
      t_pdf: "Export report (PDF)", t_clear: "Clear all points", t_models: "Models and parameters",
      t_zin: "Zoom in", t_zout: "Zoom out", t_lang: "Mudar para português", langShort: "PT",
      hint: "Tap to add a point · drag to move · drag the background to pan · pinch or scroll to zoom · double-tap a point to remove",
      panelTitle: "Models", close: "Close", clip: "Clip to data range",
      showR2: "Show R²", detectCook: "Detect influential points (Cook)", lineNoInfl: "Line without influential points",
      needN: " (n≥2)",
      csvErr: "CSV needs at least two numeric rows (x, y).",
      pdfErr: "PDF library did not load (check your connection).",
      pdfActive: "Active models", pdfInfl: "Influential points (Cook's distance > 4/n): ", pdfPoints: "Points: ",
      fbTab: "Feedback", fbTitle: "Send a suggestion",
      fbIntro: "Found a bug or have an idea? Tell me — it goes straight to my inbox.",
      fbMsgPh: "Your suggestion…", fbEmailPh: "Your email (optional, so I can reply)",
      fbSend: "Send", fbSending: "Sending…", fbThanks: "Thank you! Your suggestion was sent.",
      fbErr: "Could not send. Please try again later.", fbEmpty: "Please write a suggestion first.",
      fbOff: "The suggestion box is not set up yet.",
    },
    pt: {
      brandSub: "reta · polinomial · B-spline · P-spline, em tempo real",
      help: "Ajuda", fit: "Enquadrar", grid: "Grade", csv: "CSV", pdf: "PDF", clear: "Limpar", models: "Modelos",
      t_help: "Sobre e ajuda", t_fit: "Enquadrar nos dados", t_grid: "Mostrar ou ocultar a grade", t_csv: "Importar CSV (x, y)",
      t_pdf: "Exportar relatório (PDF)", t_clear: "Apagar todos os pontos", t_models: "Modelos e parâmetros",
      t_zin: "Aproximar", t_zout: "Afastar", t_lang: "Switch to English", langShort: "EN",
      hint: "Toque para adicionar um ponto · arraste para mover · arraste o fundo para deslocar · pinça ou rolagem para zoom · toque duplo num ponto para remover",
      panelTitle: "Modelos", close: "Fechar", clip: "Restringir ao domínio dos dados",
      showR2: "Mostrar R²", detectCook: "Detectar pontos influentes (Cook)", lineNoInfl: "Reta sem os pontos influentes",
      needN: " (n≥2)",
      csvErr: "O CSV precisa de ao menos duas linhas numéricas (x, y).",
      pdfErr: "A biblioteca de PDF não carregou (verifique sua conexão).",
      pdfActive: "Modelos ativos", pdfInfl: "Pontos influentes (distância de Cook > 4/n): ", pdfPoints: "Pontos: ",
      fbTab: "Sugestões", fbTitle: "Enviar uma sugestão",
      fbIntro: "Achou um erro ou tem uma ideia? Me conta, vai direto para a minha caixa de entrada.",
      fbMsgPh: "Sua sugestão…", fbEmailPh: "Seu e-mail (opcional, para eu responder)",
      fbSend: "Enviar", fbSending: "Enviando…", fbThanks: "Obrigado! Sua sugestão foi enviada.",
      fbErr: "Não foi possível enviar. Tente novamente mais tarde.", fbEmpty: "Escreva uma sugestão primeiro.",
      fbOff: "A caixa de sugestões ainda não foi configurada.",
    },
  };

  // nomes dos modelos e rótulos dos parâmetros (o motor em models.js é só inglês)
  const MODEL_NAME = {
    rls: { en: "Line", pt: "Reta" }, poly: { en: "Polynomial", pt: "Polinomial" },
    bspline: { en: "B-spline", pt: "B-spline" }, pspline: { en: "P-spline", pt: "P-spline" },
  };
  const CTRL_LABEL = {
    degree: { en: "Degree", pt: "Grau" }, nKnots: { en: "Knots", pt: "Nós" },
    showBases: { en: "Show bases", pt: "Ver bases" }, showWeighted: { en: "Show contributions", pt: "Ver contribuições" },
    alpha: { en: "Penalty λ", pt: "Penalização λ" }, r: { en: "Difference order r", pt: "Ordem da diferença r" },
  };

  let lang = (() => {
    try { const s = localStorage.getItem("re_lang"); if (s === "pt" || s === "en") return s; } catch (e) {}
    return (navigator.language || "").toLowerCase().startsWith("pt") ? "pt" : "en";
  })();

  RW.i18n = {
    getLang() { return lang; },
    setLang(l) {
      if (l !== "pt" && l !== "en") return;
      lang = l;
      try { localStorage.setItem("re_lang", lang); } catch (e) {}
    },
    toggle() { this.setLang(lang === "en" ? "pt" : "en"); },
    t(key) { return (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key; },
    modelName(id) { return MODEL_NAME[id] && MODEL_NAME[id][lang]; },
    ctrlLabel(attr) { return CTRL_LABEL[attr] && CTRL_LABEL[attr][lang]; },
  };
})(window.RW = window.RW || {});
