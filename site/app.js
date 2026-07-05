/* Paçoca landing — link wiring + community levels feed. */
(function () {
  "use strict";

  // ---- Where the game build and editor live -------------------------------
  // The whole platform is static: landing, game (WASM) and editor deploy as
  // sibling folders on the same origin (e.g. Cloudflare Pages).
  var TARGETS = {
    play: "play/",
    editor: "editor/"
  };

  document.querySelectorAll("[data-link]").forEach(function (el) {
    var key = el.getAttribute("data-link");
    if (TARGETS[key]) el.setAttribute("href", TARGETS[key]);
  });

  // ---- Contextual hint under the hero CTAs --------------------------------
  var note = document.querySelector("[data-hero-note]");
  if (note) {
    note.textContent = "Roda 100% no navegador (WebAssembly) — sem instalação, sem download.";
  }

  // ---- Community levels feed ----------------------------------------------
  var host = document.querySelector("[data-community]");
  if (!host) return;

  // Same-origin community API (Cloudflare Worker under /api/*).
  var endpoints = ["/api/levels?sort=popular&limit=6"];

  var THEME_LABEL = { forest: "Floresta", glacial: "Glacial", cidade: "Cidade", caverna: "Caverna" };

  function tryFetch(i) {
    if (i >= endpoints.length) return renderEmpty();
    fetch(endpoints[i])
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (data) {
        var levels = Array.isArray(data) ? data : (data && data.levels) || [];
        if (!levels.length) return renderEmpty();
        render(levels);
      })
      .catch(function () { tryFetch(i + 1); });
  }

  function render(levels) {
    host.innerHTML = "";
    levels.slice(0, 6).forEach(function (lv) {
      var card = document.createElement("a");
      card.className = "level-card";
      card.href = "editor/";

      var theme = document.createElement("span");
      theme.className = "level-theme";
      theme.textContent = THEME_LABEL[lv.theme] || lv.theme || "custom";

      var name = document.createElement("span");
      name.className = "level-name";
      name.textContent = lv.name || "Fase sem nome";

      var meta = document.createElement("span");
      meta.className = "level-meta";
      var by = lv.author_name ? "por " + lv.author_name : "anônimo";
      var plays = (lv.play_count != null) ? " · " + lv.play_count + " jogadas" : "";
      meta.textContent = by + plays;

      card.appendChild(theme);
      card.appendChild(name);
      card.appendChild(meta);
      host.appendChild(card);
    });
  }

  function renderEmpty() {
    host.innerHTML =
      '<p class="community-empty">Ainda não há fases publicadas — seja o primeiro! ' +
      'Crie a sua no <a class="nav-cta" style="display:inline-block;margin-left:.3rem" href="editor/">Map Editor</a></p>';
  }

  tryFetch(0);
})();
