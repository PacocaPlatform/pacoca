/* Paçoca — "Fases da comunidade": browse every published level with filters
   (sort, difficulty, author, and a "Minha coleção" scope). Each card lets you
   play, like, and save to your personal collection. Likes/collections need a
   session (the shared Google Sign-In cookie); logged out, those actions bounce
   the visitor to the nav's "Entrar" button. */
(function () {
  "use strict";

  var THEME_LABEL = { forest: "Floresta", glacial: "Glacial", cidade: "Cidade", caverna: "Caverna" };
  var DIFF_LABEL = {
    infantil: "Infantil", iniciante: "Iniciante", normal: "Normal",
    hard: "Difícil", impossible: "Impossível"
  };

  var host = document.querySelector("[data-levels]");
  var countEl = document.querySelector("[data-count]");
  var sortSel = document.querySelector("[data-sort]");
  var diffSel = document.querySelector("[data-diff]");
  var authorInp = document.querySelector("[data-author]");
  var scopeSel = document.querySelector("[data-scope]");

  var me = null;                 // current user, or null
  var liked = Object.create(null);     // id -> true
  var collected = Object.create(null); // id -> true
  var reqSeq = 0;                // guards against out-of-order responses

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Wait for the shared nav to resolve the session, then load interactions and
  // the first page of results.
  (window.PacocaNav ? PacocaNav.ready : Promise.resolve(null))
    .then(function (user) {
      me = user;
      return loadInteractions();
    })
    .then(load);

  function loadInteractions() {
    if (!me) return Promise.resolve();
    return fetch("/api/me/interactions", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        (d.liked || []).forEach(function (id) { liked[id] = true; });
        (d.collected || []).forEach(function (id) { collected[id] = true; });
      })
      .catch(function () {});
  }

  [sortSel, diffSel, scopeSel].forEach(function (el) {
    if (el) el.addEventListener("change", load);
  });
  if (authorInp) authorInp.addEventListener("input", debounce(load, 300));

  function load() {
    var seq = ++reqSeq;
    host.innerHTML = '<p class="community-empty">Carregando fases…</p>';
    if (countEl) countEl.textContent = "";

    if (scopeSel && scopeSel.value === "collection") {
      if (!me) {
        host.innerHTML = '<p class="community-empty">Entre com sua conta para ver sua coleção. ' +
          'Use o botão <strong>Entrar</strong> no topo.</p>';
        return;
      }
      fetch("/api/me/collection", { credentials: "same-origin" })
        .then(json)
        .then(function (d) { if (seq === reqSeq) render(filterClient(d.levels || [])); })
        .catch(fail(seq));
      return;
    }

    var qs = "sort=" + encodeURIComponent(sortSel.value) + "&limit=50";
    if (diffSel.value) qs += "&difficulty=" + encodeURIComponent(diffSel.value);
    var author = (authorInp.value || "").trim();
    if (author) qs += "&author=" + encodeURIComponent(author);

    fetch("/api/levels?" + qs)
      .then(json)
      .then(function (d) { if (seq === reqSeq) render(d.levels || []); })
      .catch(fail(seq));
  }

  // The collection endpoint returns every saved level; apply the difficulty and
  // author filters on the client so they work there too.
  function filterClient(levels) {
    var diff = diffSel.value;
    var author = (authorInp.value || "").trim().toLowerCase();
    return levels.filter(function (lv) {
      if (diff && lv.difficulty !== diff) return false;
      if (author && String(lv.author_name || "").toLowerCase().indexOf(author) < 0) return false;
      return true;
    });
  }

  function json(r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); }
  function fail(seq) {
    return function () {
      if (seq === reqSeq) host.innerHTML = '<p class="community-empty">Não foi possível carregar as fases.</p>';
    };
  }

  function render(levels) {
    if (!levels.length) {
      host.innerHTML = '<p class="community-empty">Nenhuma fase encontrada com esses filtros.</p>';
      if (countEl) countEl.textContent = "";
      return;
    }
    if (countEl) {
      countEl.textContent = levels.length + (levels.length === 1 ? " fase" : " fases");
    }
    host.innerHTML = "";
    levels.forEach(function (lv) { host.appendChild(cardFor(lv)); });
  }

  function cardFor(lv) {
    var isLiked = !!liked[lv.id];
    var isColl = !!collected[lv.id];
    var card = document.createElement("div");
    card.className = "level-card";
    var ICON = "../assets/icons.svg#";
    card.innerHTML =
      '<span class="level-badges">' +
        '<span class="level-theme">' + esc(THEME_LABEL[lv.theme] || lv.theme || "custom") + '</span>' +
        '<span class="level-diff diff-' + esc(lv.difficulty || "normal") + '">' +
          esc(DIFF_LABEL[lv.difficulty] || "Normal") + '</span>' +
      '</span>' +
      '<a class="level-name" href="../l/' + encodeURIComponent(lv.id) + '">' +
        esc(lv.name || "Fase sem nome") + '</a>' +
      '<span class="level-meta">por ' + esc(lv.author_name || "anônimo") + ' · ' +
        '<span data-plays>' + (lv.play_count || 0) + '</span> jogadas · ' +
        '<span data-likes>' + (lv.like_count || 0) + '</span> ' +
        '<svg class="icon" aria-hidden="true"><use href="' + ICON + 'heart"/></svg></span>' +
      '<span class="my-actions">' +
        '<a class="btn btn-play btn-sm" href="../l/play.html?id=' + encodeURIComponent(lv.id) + '">' +
          '<svg class="icon" aria-hidden="true"><use href="' + ICON + 'play"/></svg> Jogar</a>' +
        '<button class="btn btn-secondary btn-sm act-btn' + (isLiked ? ' is-on' : '') + '" data-like ' +
          'aria-pressed="' + isLiked + '"><span class="icon-pair">' +
          '<svg class="icon icon--o" aria-hidden="true"><use href="' + ICON + 'heart-o"/></svg>' +
          '<svg class="icon icon--f" aria-hidden="true"><use href="' + ICON + 'heart"/></svg>' +
          '</span> <span data-like-label>' + (isLiked ? 'Curtido' : 'Curtir') + '</span></button>' +
        '<button class="btn btn-secondary btn-sm act-btn' + (isColl ? ' is-on' : '') + '" data-collect ' +
          'aria-pressed="' + isColl + '"><span class="icon-pair">' +
          '<svg class="icon icon--o" aria-hidden="true"><use href="' + ICON + 'star-o"/></svg>' +
          '<svg class="icon icon--f" aria-hidden="true"><use href="' + ICON + 'star"/></svg>' +
          '</span> <span data-collect-label>' + (isColl ? 'Na coleção' : 'Coleção') + '</span></button>' +
        '<button class="btn btn-secondary btn-sm act-btn" data-share title="Compartilhar link da fase">' +
          '<svg class="icon" aria-hidden="true"><use href="' + ICON + 'share"/></svg> Compartilhar</button>' +
      '</span>';

    card.querySelector("[data-like]").addEventListener("click", function () { onLike(lv, card); });
    card.querySelector("[data-collect]").addEventListener("click", function () { onCollect(lv, card); });
    card.querySelector("[data-share]").addEventListener("click", function () { PacocaShare.share(lv.id, lv.name); });
    return card;
  }

  function onLike(lv, card) {
    if (!me) return requireLogin();
    var btn = card.querySelector("[data-like]");
    var willLike = !liked[lv.id];
    btn.disabled = true;
    fetch("/api/levels/" + encodeURIComponent(lv.id) + "/like", {
      method: willLike ? "POST" : "DELETE",
      credentials: "same-origin"
    }).then(json).then(function (d) {
      liked[lv.id] = !!d.liked;
      btn.classList.toggle("is-on", liked[lv.id]);
      btn.setAttribute("aria-pressed", String(liked[lv.id]));
      card.querySelector("[data-like-label]").textContent = liked[lv.id] ? "Curtido" : "Curtir";
      if (typeof d.like_count === "number") card.querySelector("[data-likes]").textContent = d.like_count;
    }).catch(function () {}).finally(function () { btn.disabled = false; });
  }

  function onCollect(lv, card) {
    if (!me) return requireLogin();
    var btn = card.querySelector("[data-collect]");
    var willAdd = !collected[lv.id];
    btn.disabled = true;
    fetch("/api/levels/" + encodeURIComponent(lv.id) + "/collect", {
      method: willAdd ? "POST" : "DELETE",
      credentials: "same-origin"
    }).then(json).then(function (d) {
      collected[lv.id] = !!d.collected;
      btn.classList.toggle("is-on", collected[lv.id]);
      btn.setAttribute("aria-pressed", String(collected[lv.id]));
      card.querySelector("[data-collect-label]").textContent = collected[lv.id] ? "Na coleção" : "Coleção";
      // If we're viewing the collection and just removed one, drop the card.
      if (!collected[lv.id] && scopeSel.value === "collection") card.remove();
    }).catch(function () {}).finally(function () { btn.disabled = false; });
  }

  // Logged out: nudge the visitor to the nav's "Entrar" button (Google Sign-In).
  function requireLogin() {
    var navBtn = document.querySelector(".nav-login");
    if (navBtn) navBtn.click();
  }

  function debounce(fn, ms) {
    var t;
    return function () { clearTimeout(t); t = setTimeout(fn, ms); };
  }
})();
