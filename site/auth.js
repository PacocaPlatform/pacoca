/* Paçoca — shared Google Sign-In helper for the landing-side pages
   (Minhas fases, Moderação, and the level page's like button).

   Exposes window.PacocaAuth:
     getMe()                         -> Promise<user|null>  (user may have .is_admin)
     renderSignIn(hostEl, onLogin)   -> render the GIS button into hostEl
     logout()                        -> Promise (clears the session cookie)

   The Google client id is fetched from /api/config, so nothing is hardcoded. */
(function () {
  "use strict";

  var API = "/api";

  function getMe() {
    return fetch(API + "/me", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (d) { return (d && d.user) || null; })
      .catch(function () { return null; });
  }

  function logout() {
    return fetch(API + "/auth/logout", { method: "POST", credentials: "same-origin" })
      .catch(function () {});
  }

  // GIS loads async (script has defer); poll briefly until it's ready.
  function whenGoogleReady(cb, tries) {
    tries = tries || 0;
    if (window.google && google.accounts && google.accounts.id) return cb();
    if (tries > 40) return; // ~10s then give up quietly
    setTimeout(function () { whenGoogleReady(cb, tries + 1); }, 250);
  }

  // Renders the Sign-In button into hostEl. onLogin(user) fires after a
  // successful login. Silently no-ops if the backend has no client id set.
  function renderSignIn(hostEl, onLogin) {
    fetch(API + "/config")
      .then(function (r) { return r.json(); })
      .then(function (cfg) {
        var clientId = cfg && cfg.google_client_id;
        if (!clientId) return;
        whenGoogleReady(function () {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: function (resp) { onCredential(resp, onLogin); }
          });
          google.accounts.id.renderButton(hostEl, { theme: "filled_blue", size: "large", text: "signin_with" });
        });
      })
      .catch(function () {});
  }

  function onCredential(response, onLogin) {
    fetch(API + "/auth/google", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: response.credential })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { if (data && data.user && onLogin) onLogin(data.user); })
      .catch(function () {});
  }

  window.PacocaAuth = { getMe: getMe, logout: logout, renderSignIn: renderSignIn };
})();
