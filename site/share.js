/* Paçoca — shared "Compartilhar" helper used by the level page, "Minhas fases"
   and the community listing. Uses the native share sheet on mobile (navigator.share)
   and falls back to copying the link to the clipboard, with a small self-contained
   toast for feedback so it works on any page without extra markup. */
(function () {
  "use strict";

  function levelUrl(id) {
    return location.origin + "/l/" + encodeURIComponent(id);
  }

  function toast(msg) {
    var t = document.createElement("div");
    t.className = "share-toast";
    t.textContent = msg;
    document.body.appendChild(t);
    // Force a reflow so the CSS transition runs, then show and auto-dismiss.
    void t.offsetWidth;
    t.classList.add("is-on");
    setTimeout(function () {
      t.classList.remove("is-on");
      setTimeout(function () { t.remove(); }, 250);
    }, 1800);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand("copy");
        ta.remove();
        ok ? resolve() : reject();
      } catch (e) { reject(e); }
    });
  }

  // share(id, name): open the native share sheet when available, otherwise copy
  // the level link and confirm with a toast.
  function share(id, name) {
    if (!id) return;
    var url = levelUrl(id);
    var title = name ? "Paçoca — " + name : "Fase da comunidade Paçoca";
    if (navigator.share) {
      navigator.share({ title: title, text: "Jogue esta fase do Paçoca:", url: url })
        .catch(function () { /* user dismissed — no-op */ });
      return;
    }
    copy(url)
      .then(function () { toast("Link copiado!"); })
      .catch(function () { window.prompt("Copie o link da fase:", url); });
  }

  window.PacocaShare = { share: share, url: levelUrl };
})();
