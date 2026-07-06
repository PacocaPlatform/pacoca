/* Paçoca — public level page (/l/<id>).
 *
 * Renders a shared level's info (name, author, difficulty, plays, likes) and
 * wires the Play + Like buttons. Play goes through play.html, which counts the
 * play and hands the level to the WASM game. Liking requires a logged-in session
 * (the same cookie the editor sets via Google Sign-In). */
(function () {
  "use strict";

  var THEME_LABEL = { forest: "Floresta", glacial: "Glacial", cidade: "Cidade", caverna: "Caverna" };
  var DIFF_LABEL = {
    infantil: "Infantil", iniciante: "Iniciante", normal: "Normal",
    hard: "Difícil", impossible: "Impossível"
  };

  var root = document.querySelector("[data-level-page]");
  var status = document.querySelector("[data-level-status]");

  // The level id is the last path segment (/l/<id>) or ?id= for older links.
  function levelId() {
    var q = new URLSearchParams(location.search).get("id");
    if (q) return q;
    var parts = location.pathname.replace(/\/+$/, "").split("/");
    var last = parts[parts.length - 1];
    return last && last !== "l" ? decodeURIComponent(last) : "";
  }

  var id = levelId();
  if (!id) { status.textContent = "Fase não encontrada."; return; }

  var me = null; // current user, or null

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Load the session and the level in parallel, then render.
  Promise.all([
    fetch("/api/me", { credentials: "same-origin" }).then(function (r) { return r.json(); }).catch(function () { return { user: null }; }),
    fetch("/api/levels/" + encodeURIComponent(id), { credentials: "same-origin" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    })
  ]).then(function (out) {
    me = out[0] && out[0].user;
    render(out[1]);
  }).catch(function () {
    status.textContent = "Fase não encontrada ou indisponível.";
  });

  function render(lv) {
    var theme = THEME_LABEL[lv.theme] || lv.theme || "custom";
    var diff = DIFF_LABEL[lv.difficulty] || lv.difficulty || "Normal";
    var author = lv.author_name ? "por " + esc(lv.author_name) : "anônimo";

    root.innerHTML =
      '<article class="level-hero">' +
        '<div class="level-badges">' +
          '<span class="level-theme">' + esc(theme) + '</span>' +
          '<span class="level-diff diff-' + esc(lv.difficulty || "normal") + '">' + esc(diff) + '</span>' +
        '</div>' +
        '<h1 class="level-title">' + esc(lv.name || "Fase sem nome") + '</h1>' +
        '<p class="level-author">' + author + '</p>' +
        '<div class="level-stats">' +
          '<span class="level-stat"><strong data-plays>' + (lv.play_count || 0) + '</strong> jogadas</span>' +
          '<span class="level-stat"><strong data-likes>' + (lv.like_count || 0) + '</strong> curtidas</span>' +
        '</div>' +
        '<div class="cta-row">' +
          '<a class="btn btn-play" href="play.html?id=' + encodeURIComponent(id) + '">' +
            '<span class="btn-icon">▶</span>' +
            '<span class="btn-text"><strong>Jogar</strong><small>Roda no navegador</small></span>' +
          '</a>' +
          likeButtonHtml(lv) +
          '<button class="btn btn-editor" data-share>' +
            '<span class="btn-icon">↗</span>' +
            '<span class="btn-text"><strong>Compartilhar</strong><small>Copiar o link</small></span>' +
          '</button>' +
        '</div>' +
        '<p class="level-share"><a href="../editor/">Criar minha fase no Map Editor →</a></p>' +
      '</article>';

    var likeBtn = root.querySelector("[data-like]");
    if (likeBtn) likeBtn.addEventListener("click", function () { onLike(lv); });
    var shareBtn = root.querySelector("[data-share]");
    if (shareBtn) shareBtn.addEventListener("click", function () { PacocaShare.share(id, lv.name); });
  }

  function likeButtonHtml(lv) {
    if (!me) {
      return '<a class="btn btn-editor" href="../editor/#entrar" title="Entre para curtir">' +
        '<span class="btn-icon">♡</span>' +
        '<span class="btn-text"><strong>Curtir</strong><small>Entre com Google</small></span></a>';
    }
    var liked = !!lv.liked;
    return '<button class="btn btn-editor" data-like aria-pressed="' + liked + '">' +
      '<span class="btn-icon" data-like-icon>' + (liked ? "♥" : "♡") + '</span>' +
      '<span class="btn-text"><strong data-like-label>' + (liked ? "Curtido" : "Curtir") + '</strong>' +
      '<small>' + esc(me.name || "você") + '</small></span></button>';
  }

  function onLike(lv) {
    var btn = root.querySelector("[data-like]");
    var willLike = !lv.liked;
    btn.disabled = true;
    fetch("/api/levels/" + encodeURIComponent(id) + "/like", {
      method: willLike ? "POST" : "DELETE",
      credentials: "same-origin"
    }).then(function (r) { return r.json(); }).then(function (data) {
      lv.liked = !!data.liked;
      var likesEl = root.querySelector("[data-likes]");
      if (likesEl && typeof data.like_count === "number") likesEl.textContent = data.like_count;
      btn.setAttribute("aria-pressed", String(lv.liked));
      root.querySelector("[data-like-icon]").textContent = lv.liked ? "♥" : "♡";
      root.querySelector("[data-like-label]").textContent = lv.liked ? "Curtido" : "Curtir";
    }).catch(function () {
      /* keep previous state on error */
    }).finally(function () { btn.disabled = false; });
  }
})();
