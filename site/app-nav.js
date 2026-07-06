/* Paçoca — shared nav auth widget. Any page that includes auth.js + this script
   and has a `[data-auth-slot]` in its nav gets a login/logout control:

     logged out -> "Entrar" button that reveals Google Sign-In on click
     logged in  -> the user's name + "Sair"

   It also toggles optional nav links by data-attribute:
     [data-auth-link]  shown only when logged in (e.g. "Minhas fases")
     [data-admin-link] shown only for admins

   Exposes window.PacocaNav.ready — a promise resolving to the user (or null) —
   so pages can react to the session without a second /api/me round-trip. */
(function () {
  "use strict";

  var slot = document.querySelector("[data-auth-slot]");
  var authLinks = document.querySelectorAll("[data-auth-link]");
  var adminLink = document.querySelector("[data-admin-link]");

  var ready = (window.PacocaAuth ? PacocaAuth.getMe() : Promise.resolve(null))
    .then(function (user) {
      if (user) renderSignedIn(user);
      else renderSignedOut();
      return user;
    });

  function renderSignedIn(user) {
    authLinks.forEach(function (l) { l.hidden = false; });
    if (adminLink) adminLink.hidden = !user.is_admin;
    if (!slot) return;
    slot.innerHTML = "";
    var name = document.createElement("span");
    name.className = "nav-user";
    name.textContent = user.name || "Você";
    var out = document.createElement("button");
    out.className = "nav-login";
    out.type = "button";
    out.textContent = "Sair";
    out.addEventListener("click", function () {
      PacocaAuth.logout().then(function () { location.reload(); });
    });
    slot.appendChild(name);
    slot.appendChild(out);
  }

  function renderSignedOut() {
    authLinks.forEach(function (l) { l.hidden = true; });
    if (adminLink) adminLink.hidden = true;
    if (!slot) return;
    slot.innerHTML = "";
    // Compact "Entrar" button that swaps in the real Google widget on click,
    // keeping the nav on-brand instead of showing the wide GIS button upfront.
    var btn = document.createElement("button");
    btn.className = "nav-login";
    btn.type = "button";
    btn.textContent = "Entrar";
    var gsiHost = document.createElement("span");
    gsiHost.style.display = "none";
    btn.addEventListener("click", function () {
      btn.style.display = "none";
      gsiHost.style.display = "inline-block";
      PacocaAuth.renderSignIn(gsiHost, function () { location.reload(); });
    });
    slot.appendChild(btn);
    slot.appendChild(gsiHost);
  }

  window.PacocaNav = { ready: ready };
})();
