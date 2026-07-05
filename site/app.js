/* Paçoca landing — link wiring + community feeds (most played / most liked /
   top authors). Each level card links to its public page /l/<id>. */
(function () {
  "use strict";

  // ---- Where the game build and editor live -------------------------------
  // The whole platform is static: landing, game (WASM) and editor deploy as
  // sibling folders on the same origin (e.g. Cloudflare Worker + R2).
  var TARGETS = { play: "play/", editor: "editor/" };

  document.querySelectorAll("[data-link]").forEach(function (el) {
    var key = el.getAttribute("data-link");
    if (TARGETS[key]) el.setAttribute("href", TARGETS[key]);
  });

  // ---- Contextual hint under the hero CTAs --------------------------------
  var note = document.querySelector("[data-hero-note]");
  if (note) {
    note.textContent = "Roda 100% no navegador — sem instalação, sem download.";
  }

  var THEME_LABEL = { forest: "Floresta", glacial: "Glacial", cidade: "Cidade", caverna: "Caverna" };
  var DIFF_LABEL = {
    infantil: "Infantil", iniciante: "Iniciante", normal: "Normal",
    hard: "Difícil", impossible: "Impossível"
  };

  // The nav login/logout widget + admin-link reveal live in the shared
  // app-nav.js (also used by the browse page), loaded alongside this script.

  // ---- Community feeds -----------------------------------------------------
  loadFeed("popular", "/api/levels?sort=popular&limit=20", renderLevels);
  loadFeed("liked", "/api/levels?sort=liked&limit=20", renderLevels);
  loadFeed("authors", "/api/authors?limit=20", renderAuthors);

  function loadFeed(name, endpoint, render) {
    var host = document.querySelector('[data-feed="' + name + '"]');
    if (!host) return;
    fetch(endpoint)
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (data) { render(host, data); })
      .catch(function () { renderEmpty(host); });
  }

  function renderLevels(host, data) {
    var levels = (data && data.levels) || [];
    if (!levels.length) return renderEmpty(host);
    host.innerHTML = "";
    levels.forEach(function (lv) {
      var card = el("a", "level-card");
      card.href = "l/" + encodeURIComponent(lv.id);

      var badges = el("span", "level-badges");
      badges.appendChild(text(el("span", "level-theme"), THEME_LABEL[lv.theme] || lv.theme || "custom"));
      badges.appendChild(text(el("span", "level-diff diff-" + (lv.difficulty || "normal")),
        DIFF_LABEL[lv.difficulty] || lv.difficulty || "Normal"));

      var name = text(el("span", "level-name"), lv.name || "Fase sem nome");
      var by = lv.author_name ? "por " + lv.author_name : "anônimo";
      var meta = text(el("span", "level-meta"),
        by + " · " + (lv.play_count || 0) + " jogadas · " + (lv.like_count || 0) + " ❤");

      card.appendChild(badges);
      card.appendChild(name);
      card.appendChild(meta);
      host.appendChild(card);
    });
  }

  function renderAuthors(host, data) {
    var authors = (data && data.authors) || [];
    if (!authors.length) return renderEmpty(host, "Ainda não há autores.");
    host.innerHTML = "";
    authors.forEach(function (a, i) {
      var card = el("div", "level-card");
      var name = text(el("span", "level-name"), (i + 1) + ". " + (a.author_name || "Autor"));
      var meta = text(el("span", "level-meta"),
        (a.plays || 0) + " jogadas · " + (a.levels || 0) + " fases · " + (a.likes || 0) + " ❤");
      card.appendChild(name);
      card.appendChild(meta);
      host.appendChild(card);
    });
  }

  function renderEmpty(host, msg) {
    host.innerHTML =
      '<p class="community-empty">' + (msg || "Ainda não há fases publicadas — seja o primeiro! ") +
      '<a class="nav-cta" style="display:inline-block;margin-left:.3rem" href="editor/">Map Editor</a></p>';
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function text(e, t) { e.textContent = t; return e; }
})();
