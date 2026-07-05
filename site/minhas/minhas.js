/* Paçoca — "Minhas fases": the logged-in author's own published levels, with
   stats and a delete (soft-remove) action. Requires a session; if logged out,
   shows a Sign-In button. */
(function () {
  "use strict";

  var THEME_LABEL = { forest: "Floresta", glacial: "Glacial", cidade: "Cidade", caverna: "Caverna" };
  var DIFF_LABEL = {
    infantil: "Infantil", iniciante: "Iniciante", normal: "Normal",
    hard: "Difícil", impossible: "Impossível"
  };
  var STATUS_LABEL = { active: "Publicada", hidden: "Oculta" };

  var host = document.querySelector("[data-my-levels]");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  PacocaAuth.getMe().then(function (user) {
    if (!user) return showSignedOut();
    loadLevels();
  });

  function showSignedOut() {
    host.innerHTML =
      '<div class="level-hero" style="text-align:center">' +
      '<p style="margin-bottom:1rem">Entre com sua conta Google para ver as fases que você publicou.</p>' +
      '<div id="gsi-button" style="display:inline-block"></div></div>';
    PacocaAuth.renderSignIn(document.getElementById("gsi-button"), function () { location.reload(); });
  }

  function loadLevels() {
    fetch("/api/me/levels", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) { render((data && data.levels) || []); })
      .catch(function () { host.innerHTML = '<p class="community-empty">Não foi possível carregar suas fases.</p>'; });
  }

  function render(levels) {
    if (!levels.length) {
      host.innerHTML =
        '<p class="community-empty">Você ainda não publicou fases. ' +
        '<a class="nav-cta" style="display:inline-block;margin-left:.3rem" href="../editor/">Criar no Map Editor</a></p>';
      return;
    }
    host.innerHTML = '<div class="community"></div>';
    var grid = host.querySelector(".community");
    levels.forEach(function (lv) {
      var card = document.createElement("div");
      card.className = "level-card";
      var statusTag = lv.status !== "active"
        ? '<span class="level-diff diff-hard">' + esc(STATUS_LABEL[lv.status] || lv.status) + '</span>' : "";
      card.innerHTML =
        '<span class="level-badges">' +
          '<span class="level-theme">' + esc(THEME_LABEL[lv.theme] || lv.theme) + '</span>' +
          '<span class="level-diff diff-' + esc(lv.difficulty || "normal") + '">' + esc(DIFF_LABEL[lv.difficulty] || "Normal") + '</span>' +
          statusTag +
        '</span>' +
        '<span class="level-name">' + esc(lv.name || "Fase sem nome") + '</span>' +
        '<span class="level-meta">' + (lv.play_count || 0) + ' jogadas · ' + (lv.like_count || 0) + ' ❤</span>' +
        '<span class="my-actions">' +
          '<a class="btn btn-secondary btn-sm" href="../l/' + encodeURIComponent(lv.id) + '">Abrir</a>' +
          '<button class="btn btn-secondary btn-sm" data-del="' + esc(lv.id) + '">Excluir</button>' +
        '</span>';
      grid.appendChild(card);
    });
    grid.querySelectorAll("[data-del]").forEach(function (btn) {
      btn.addEventListener("click", function () { del(btn.getAttribute("data-del"), btn); });
    });
  }

  function del(id, btn) {
    if (!confirm("Excluir esta fase? O link compartilhado deixará de funcionar.")) return;
    btn.disabled = true;
    fetch("/api/levels/" + encodeURIComponent(id), { method: "DELETE", credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.ok) {
          var card = btn.closest(".level-card");
          if (card) card.remove();
        } else { btn.disabled = false; alert(data.error || "Falha ao excluir"); }
      })
      .catch(function () { btn.disabled = false; alert("Falha ao excluir"); });
  }
})();
