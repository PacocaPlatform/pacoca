/* Paçoca — moderation console. Admins (ADMIN_EMAILS on the Worker) can list all
   levels by status and hide / remove / restore them. Non-admins see a notice. */
(function () {
  "use strict";

  var THEME_LABEL = { forest: "Floresta", glacial: "Glacial", cidade: "Cidade", caverna: "Caverna" };
  var STATUS_LABEL = { active: "Publicada", hidden: "Oculta", removed: "Removida" };

  var listHost = document.querySelector("[data-mod-list]");
  var filters = document.querySelector("[data-mod-filters]");
  var statusSel = document.querySelector("[data-status]");

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  PacocaAuth.getMe().then(function (user) {
    if (!user) return showSignedOut();
    if (!user.is_admin) return showForbidden();
    filters.hidden = false;
    statusSel.addEventListener("change", load);
    load();
  });

  function showSignedOut() {
    listHost.innerHTML =
      '<div class="level-hero" style="text-align:center">' +
      '<p style="margin-bottom:1rem">Entre com uma conta de moderador.</p>' +
      '<div id="gsi-button" style="display:inline-block"></div></div>';
    PacocaAuth.renderSignIn(document.getElementById("gsi-button"), function () { location.reload(); });
  }

  function showForbidden() {
    listHost.innerHTML = '<p class="community-empty">Acesso restrito — sua conta não tem permissão de moderação.</p>';
  }

  function load() {
    listHost.innerHTML = '<p class="community-empty">Carregando…</p>';
    fetch("/api/admin/levels?status=" + encodeURIComponent(statusSel.value) + "&limit=50", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (data) { render((data && data.levels) || []); })
      .catch(function () { listHost.innerHTML = '<p class="community-empty">Falha ao carregar.</p>'; });
  }

  function render(levels) {
    if (!levels.length) { listHost.innerHTML = '<p class="community-empty">Nenhuma fase neste filtro.</p>'; return; }
    listHost.innerHTML = '<div class="community"></div>';
    var grid = listHost.querySelector(".community");
    levels.forEach(function (lv) {
      var card = document.createElement("div");
      card.className = "level-card";
      card.innerHTML =
        '<span class="level-badges">' +
          '<span class="level-theme">' + esc(THEME_LABEL[lv.theme] || lv.theme) + '</span>' +
          '<span class="level-diff diff-' + esc(statusDiffClass(lv.status)) + '">' + esc(STATUS_LABEL[lv.status] || lv.status) + '</span>' +
        '</span>' +
        '<span class="level-name">' + esc(lv.name || "Fase sem nome") + '</span>' +
        '<span class="level-meta">por ' + esc(lv.author_name || "anônimo") + ' · ' +
          (lv.play_count || 0) + ' jogadas · ' + (lv.like_count || 0) +
          ' <svg class="icon" aria-hidden="true"><use href="../assets/icons.svg#heart"/></svg></span>' +
        '<span class="my-actions">' + actionsFor(lv) + '</span>';
      grid.appendChild(card);
    });
    grid.querySelectorAll("[data-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        moderate(btn.getAttribute("data-id"), btn.getAttribute("data-action"), btn);
      });
    });
  }

  function statusDiffClass(status) {
    return status === "active" ? "iniciante" : status === "hidden" ? "hard" : "impossible";
  }

  function actionsFor(lv) {
    var open = '<a class="btn btn-secondary btn-sm" href="../l/' + encodeURIComponent(lv.id) + '">Abrir</a>';
    var btns = [];
    if (lv.status !== "active") btns.push(mkBtn(lv.id, "active", "Restaurar"));
    if (lv.status !== "hidden") btns.push(mkBtn(lv.id, "hidden", "Ocultar"));
    if (lv.status !== "removed") btns.push(mkBtn(lv.id, "removed", "Remover"));
    return open + btns.join("");
  }

  function mkBtn(id, action, label) {
    return '<button class="btn btn-secondary btn-sm" data-id="' + esc(id) + '" data-action="' + action + '">' + label + '</button>';
  }

  function moderate(id, status, btn) {
    btn.disabled = true;
    fetch("/api/levels/" + encodeURIComponent(id) + "/moderate", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: status })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.id) { load(); }
        else { btn.disabled = false; alert(data.error || "Falha"); }
      })
      .catch(function () { btn.disabled = false; alert("Falha"); });
  }
})();
