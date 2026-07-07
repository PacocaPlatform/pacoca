/* Paçoca — lightweight bilingual layer (pt-BR / en-US).

   Language pick order:
     1. explicit user choice saved in localStorage ("pacoca_lang")
     2. auto-detect: Brazil -> pt-BR, everyone else -> en-US
        (timezone is the primary geo signal; navigator.language is a fallback)

   Markup conventions applied on load and on every language switch:
     data-i18n="key"                -> element.textContent
     data-i18n-html="key"           -> element.innerHTML  (for <br>/<strong>)
     data-i18n-attr="attr:key;..."  -> element.setAttribute(attr, value)

   Exposes window.I18n:
     .lang            current language ("pt-BR" | "en-US")
     .t(key)          translated string (falls back to the key)
     .set(lang)       switch language + persist + re-render
     .onChange(fn)    subscribe (fn called with the new lang)

   i18n.js must load before app.js / app-nav.js so their dynamic strings
   (feeds, auth widget) read from the same dictionary. */
(function () {
  "use strict";

  var STORAGE_KEY = "pacoca_lang";

  // Brazilian IANA timezones — the reliable "is this visitor in Brazil?" signal.
  var BR_ZONES = {
    "America/Sao_Paulo": 1, "America/Bahia": 1, "America/Fortaleza": 1,
    "America/Recife": 1, "America/Maceio": 1, "America/Araguaina": 1,
    "America/Belem": 1, "America/Santarem": 1, "America/Manaus": 1,
    "America/Cuiaba": 1, "America/Campo_Grande": 1, "America/Porto_Velho": 1,
    "America/Boa_Vista": 1, "America/Rio_Branco": 1, "America/Eirunepe": 1,
    "America/Noronha": 1
  };

  function detect() {
    var saved = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (saved === "pt-BR" || saved === "en-US") return saved;

    // Primary: timezone says Brazil.
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && BR_ZONES[tz]) return "pt-BR";
    } catch (e) {}

    // Fallback: browser prefers Brazilian Portuguese (pt-BR, or bare "pt").
    // Portugal's "pt-PT" is intentionally NOT matched — the rule is Brazil only.
    var langs = navigator.languages || [navigator.language || ""];
    for (var i = 0; i < langs.length; i++) {
      if (/^pt(-br)?$/i.test(langs[i])) return "pt-BR";
    }
    return "en-US";
  }

  var DICT = {
    "pt-BR": {
      "meta.title": "Paçoca — Plataforma 2.5D de ação veloz",
      "meta.description": "Paçoca é um platformer 2.5D de ação veloz. Jogue direto no navegador, crie suas fases no Map Editor visual e publique para a comunidade.",
      "og.title": "Paçoca — Plataforma 2.5D de ação veloz",
      "og.description": "Corra, pule e crie suas próprias fases. Jogue no navegador ou abra o Map Editor.",

      "nav.recursos": "Recursos",
      "nav.temas": "Temas",
      "nav.comunidade": "Comunidade",
      "nav.fases": "Fases",
      "nav.minhas": "Minhas fases",
      "nav.moderacao": "Moderação",
      "nav.editor": "Map Editor",
      "nav.codigo": "Github",
      "nav.codigo.title": "Ver o código no GitHub",
      "nav.lang.next": "EN",
      "nav.lang.title": "Switch to English",

      "hero.eyebrow": "Platformer 2.5D · ação veloz · jogue no navegador",
      "hero.h1": "Corra rápido.<br>Pule alto.<br><span class=\"hl\">Crie seu mundo.</span>",
      "hero.imgalt": "Paçoca, o dinossauro, correndo por um vale ao pôr do sol",
      "hero.lede": "Controle o <strong>Paçoca</strong> por fases velozes: giro carregado, investida no ar, moedas, molas e inimigos — com física própria de aceleração e rampas. Depois desenhe suas próprias fases e publique para a comunidade.",
      "hero.play.title": "Jogar agora",
      "hero.play.sub": "Roda no navegador",
      "hero.editor.title": "Map Editor",
      "hero.editor.sub": "Crie suas fases",
      "hero.note": "Roda 100% no navegador — sem instalação, sem download.",
      "hero.badge.new": "NOVO!",
      "hero.badge.free": "GRÁTIS!",

      "features.title": "O que tem em Paçoca",
      "feature.physics.title": "Física com momentum",
      "feature.physics.desc": "Aceleração, atrito, força de rampa, giro carregável, investida diagonal no ar, coyote time e jump buffering.",
      "feature.editor.title": "Map Editor visual",
      "feature.editor.desc": "Pinte plataformas, rampas, moedas, molas e inimigos. Ferramentas de linha, retângulo, balde e seleção — com undo/redo completo.",
      "feature.test.title": "Teste em um clique",
      "feature.test.desc": "Jogue sua fase direto no navegador — o jogo a monta na hora. Sem instalar nada, sem download.",
      "feature.community.title": "Fases da comunidade",
      "feature.community.desc": "Publique o que você criou e jogue as fases de outras pessoas — carregadas direto no motor do jogo.",

      "themes.title": "Quatro mundos, um dinossauro",
      "themes.sub": "Cada fase escolhe um tema com materiais de terreno e parallax próprios.",
      "theme.forest": "Floresta",
      "theme.glacial": "Glacial",
      "theme.city": "Cidade",
      "theme.cave": "Caverna",

      "community.title": "Feitas pela comunidade",
      "community.sub": "Fases publicadas por outros jogadores. Abra a fase e jogue no navegador.",
      "community.browse.title": "Ver todas as fases",
      "community.browse.sub": "Filtre por autor, dificuldade e data",
      "community.feed.popular": "Mais jogadas",
      "community.feed.liked": "Mais curtidas",
      "community.feed.authors": "Autores em destaque",
      "community.loadingLevels": "Carregando fases…",
      "community.loadingAuthors": "Carregando autores…",
      "community.emptyAuthors": "Ainda não há autores.",
      "community.emptyLevels": "Ainda não há fases publicadas — seja o primeiro! ",

      "cta.title": "Pronto pra correr?",
      "cta.play.title": "Jogar agora",
      "cta.play.sub": "Roda no navegador",
      "cta.editor.title": "Abrir o Map Editor",
      "cta.editor.sub": "Crie suas fases",

      "footer.tagline": "<span class=\"nav-badge\">2.5D</span> <strong>Paçoca</strong> — platformer de ação veloz com editor de fases.",
      "footer.muted": "Interface bilíngue · Suporte a gamepad · Física própria · <a href=\"https://github.com/ricardoborges/pacoca\" target=\"_blank\" rel=\"noopener\">Código no GitHub</a>",

      "auth.login": "Entrar",
      "auth.logout": "Sair",
      "auth.you": "Você",

      "level.by": "por ",
      "level.anon": "anônimo",
      "level.noname": "Fase sem nome",
      "level.plays": "jogadas",
      "level.levels": "fases",
      "author.fallback": "Autor",

      "diff.infantil": "Infantil",
      "diff.iniciante": "Iniciante",
      "diff.normal": "Normal",
      "diff.hard": "Difícil",
      "diff.impossible": "Impossível"
    },

    "en-US": {
      "meta.title": "Paçoca — Fast-action 2.5D platformer",
      "meta.description": "Paçoca is a fast-action 2.5D platformer. Play right in your browser, build your own levels in the visual Map Editor, and publish them for the community.",
      "og.title": "Paçoca — Fast-action 2.5D platformer",
      "og.description": "Run, jump and build your own levels. Play in the browser or open the Map Editor.",

      "nav.recursos": "Features",
      "nav.temas": "Themes",
      "nav.comunidade": "Community",
      "nav.fases": "Levels",
      "nav.minhas": "My levels",
      "nav.moderacao": "Moderation",
      "nav.editor": "Map Editor",
      "nav.codigo": "Github",
      "nav.codigo.title": "View the source on GitHub",
      "nav.lang.next": "PT",
      "nav.lang.title": "Mudar para português",

      "hero.eyebrow": "2.5D platformer · fast action · play in the browser",
      "hero.h1": "Run fast.<br>Jump high.<br><span class=\"hl\">Build your world.</span>",
      "hero.imgalt": "Paçoca the dinosaur running through a valley at sunset",
      "hero.lede": "Guide <strong>Paçoca</strong> through fast-paced levels: charged spin, midair dash, coins, springs and enemies — with custom physics for acceleration and ramps. Then design your own levels and publish them for the community.",
      "hero.play.title": "Play now",
      "hero.play.sub": "Runs in your browser",
      "hero.editor.title": "Map Editor",
      "hero.editor.sub": "Build your levels",
      "hero.note": "Runs 100% in your browser — no install, no download.",
      "hero.badge.new": "NEW!",
      "hero.badge.free": "FREE!",

      "features.title": "What's inside Paçoca",
      "feature.physics.title": "Momentum-based physics",
      "feature.physics.desc": "Acceleration, friction, ramp force, chargeable spin, diagonal midair dash, coyote time and jump buffering.",
      "feature.editor.title": "Visual Map Editor",
      "feature.editor.desc": "Paint platforms, ramps, coins, springs and enemies. Line, rectangle, fill and select tools — with full undo/redo.",
      "feature.test.title": "One-click playtest",
      "feature.test.desc": "Play your level right in the browser — the game builds it instantly. Nothing to install, nothing to download.",
      "feature.community.title": "Community levels",
      "feature.community.desc": "Publish what you make and play everyone else's levels — loaded straight into the game engine.",

      "themes.title": "Four worlds, one dinosaur",
      "themes.sub": "Each level picks a theme with its own terrain materials and parallax.",
      "theme.forest": "Forest",
      "theme.glacial": "Ice",
      "theme.city": "City",
      "theme.cave": "Cave",

      "community.title": "Made by the community",
      "community.sub": "Levels published by other players. Open one and play it in the browser.",
      "community.browse.title": "Browse all levels",
      "community.browse.sub": "Filter by author, difficulty and date",
      "community.feed.popular": "Most played",
      "community.feed.liked": "Most liked",
      "community.feed.authors": "Featured authors",
      "community.loadingLevels": "Loading levels…",
      "community.loadingAuthors": "Loading authors…",
      "community.emptyAuthors": "No authors yet.",
      "community.emptyLevels": "No levels published yet — be the first! ",

      "cta.title": "Ready to run?",
      "cta.play.title": "Play now",
      "cta.play.sub": "Runs in your browser",
      "cta.editor.title": "Open the Map Editor",
      "cta.editor.sub": "Build your levels",

      "footer.tagline": "<span class=\"nav-badge\">2.5D</span> <strong>Paçoca</strong> — fast-action platformer with a level editor.",
      "footer.muted": "Bilingual UI · Gamepad support · Custom physics · <a href=\"https://github.com/ricardoborges/pacoca\" target=\"_blank\" rel=\"noopener\">Source on GitHub</a>",

      "auth.login": "Sign in",
      "auth.logout": "Sign out",
      "auth.you": "You",

      "level.by": "by ",
      "level.anon": "anonymous",
      "level.noname": "Untitled level",
      "level.plays": "plays",
      "level.levels": "levels",
      "author.fallback": "Author",

      "diff.infantil": "Kids",
      "diff.iniciante": "Beginner",
      "diff.normal": "Normal",
      "diff.hard": "Hard",
      "diff.impossible": "Impossible"
    }
  };

  var lang = detect();
  var listeners = [];

  function t(key) {
    var table = DICT[lang] || DICT["en-US"];
    return (key in table) ? table[key] : key;
  }

  function applyTo(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    root.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var bits = pair.split(":");
        if (bits.length === 2) el.setAttribute(bits[0].trim(), t(bits[1].trim()));
      });
    });
  }

  function apply() {
    document.documentElement.setAttribute("lang", lang);
    applyTo(document);
    var toggle = document.querySelector("[data-lang-toggle]");
    if (toggle) {
      toggle.textContent = t("nav.lang.next");
      toggle.setAttribute("title", t("nav.lang.title"));
      toggle.setAttribute("aria-label", t("nav.lang.title"));
    }
  }

  function set(next) {
    if (next !== "pt-BR" && next !== "en-US") return;
    if (next === lang) return;
    lang = next;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
    apply();
    listeners.forEach(function (fn) { try { fn(lang); } catch (e) {} });
  }

  function wireToggle() {
    var toggle = document.querySelector("[data-lang-toggle]");
    if (!toggle) return;
    toggle.addEventListener("click", function () {
      set(lang === "pt-BR" ? "en-US" : "pt-BR");
    });
  }

  window.I18n = {
    get lang() { return lang; },
    t: t,
    set: set,
    applyTo: applyTo,
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
  };

  // Set <html lang> immediately; translate the DOM once it exists.
  document.documentElement.setAttribute("lang", lang);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { apply(); wireToggle(); });
  } else {
    apply();
    wireToggle();
  }
})();
