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

  // ---- i18n helpers --------------------------------------------------------
  // Falls back to identity if i18n.js somehow didn't load, so the page still
  // renders (in whatever language the markup ships with).
  var I18N = window.I18n || { t: function (k) { return k; }, onChange: function () {} };
  function t(k) { return I18N.t(k); }

  // ---- Contextual hint under the hero CTAs --------------------------------
  var note = document.querySelector("[data-hero-note]");
  if (note) note.textContent = t("hero.note");

  // Level `theme`/`difficulty` come from the API as stable slugs; map them to
  // localized labels. (The API's Portuguese theme slug is "cidade"/"caverna".)
  function themeLabel(slug) {
    var key = { forest: "theme.forest", glacial: "theme.glacial",
                cidade: "theme.city", caverna: "theme.cave" }[slug];
    return key ? t(key) : (slug || "custom");
  }
  function diffLabel(slug) {
    var known = { infantil: 1, iniciante: 1, normal: 1, hard: 1, impossible: 1 };
    return known[slug] ? t("diff." + slug) : (slug || t("diff.normal"));
  }

  // The nav login/logout widget + admin-link reveal live in the shared
  // app-nav.js (also used by the browse page), loaded alongside this script.

  // ---- Community feeds -----------------------------------------------------
  // Feeds are cached so a language switch can re-render them without refetching.
  var FEEDS = [
    { name: "popular", endpoint: "/api/levels?sort=popular&limit=20", render: renderLevels },
    { name: "liked", endpoint: "/api/levels?sort=liked&limit=20", render: renderLevels },
    { name: "authors", endpoint: "/api/authors?limit=20", render: renderAuthors }
  ];
  FEEDS.forEach(function (f) { loadFeed(f); });

  // Re-localize the hero note + any already-rendered feed on language change.
  I18N.onChange(function () {
    if (note) note.textContent = t("hero.note");
    FEEDS.forEach(function (f) {
      var host = document.querySelector('[data-feed="' + f.name + '"]');
      if (host && f.data) f.render(host, f.data);
    });
  });

  function loadFeed(f) {
    var host = document.querySelector('[data-feed="' + f.name + '"]');
    if (!host) return;
    fetch(f.endpoint)
      .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
      .then(function (data) { f.data = data; f.render(host, data); })
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
      badges.appendChild(text(el("span", "level-theme"), themeLabel(lv.theme)));
      badges.appendChild(text(el("span", "level-diff diff-" + (lv.difficulty || "normal")),
        diffLabel(lv.difficulty)));

      var name = text(el("span", "level-name"), lv.name || t("level.noname"));
      var by = lv.author_name ? t("level.by") + lv.author_name : t("level.anon");
      var meta = text(el("span", "level-meta"),
        by + " · " + (lv.play_count || 0) + " " + t("level.plays") + " · " + (lv.like_count || 0) + " ❤");

      card.appendChild(badges);
      card.appendChild(name);
      card.appendChild(meta);
      host.appendChild(card);
    });
  }

  function renderAuthors(host, data) {
    var authors = (data && data.authors) || [];
    if (!authors.length) return renderEmpty(host, t("community.emptyAuthors"));
    host.innerHTML = "";
    authors.forEach(function (a, i) {
      var card = el("div", "level-card");
      var name = text(el("span", "level-name"), (i + 1) + ". " + (a.author_name || t("author.fallback")));
      var meta = text(el("span", "level-meta"),
        (a.plays || 0) + " " + t("level.plays") + " · " + (a.levels || 0) + " " + t("level.levels") + " · " + (a.likes || 0) + " ❤");
      card.appendChild(name);
      card.appendChild(meta);
      host.appendChild(card);
    });
  }

  function renderEmpty(host, msg) {
    host.innerHTML =
      '<p class="community-empty">' + (msg || t("community.emptyLevels")) +
      '<a class="nav-cta" style="display:inline-block;margin-left:.3rem" href="editor/">' + t("nav.editor") + '</a></p>';
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
  function text(e, t) { e.textContent = t; return e; }
})();
