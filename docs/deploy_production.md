# Production deploy — quick checklist

Short "happy path" reference for shipping Paçoca to production. For initial
setup, details and troubleshooting, see [`build_and_deploy.md`](./build_and_deploy.md).

**All commands run from the repository root.**

## Architecture (what goes where)

A single **Cloudflare Worker** (`pacoca-api`) serves everything on one origin:

- static files (landing `/`, game `/play/`, editor `/editor/`) → read from an **R2** bucket (`pacoca-site`)
- community API `/api/*` → **D1** (`pacoca-levels`)

The game (`index.pck` ~137MB, `index.wasm` ~38MB) exceeds Pages' 25 MiB per-file
limit, hence R2 + Worker instead of Pages.

## Full deploy (3 steps)

```bash
# 1. Export the Godot game -> build/web/  (only if the game changed)
GODOT=/Applications/Godot.app/Contents/MacOS/Godot ./scripts/unix/export_web.sh

# 2. Assemble the bundle and upload the static files to R2
./scripts/unix/deploy_r2.sh            # runs build_dist.sh and pushes build/dist/ -> remote R2

# 3. Publish the Worker (serves /api from D1 + static files from R2)
(cd backend && npm run deploy)
```

## What to re-ship depending on what changed

| Changed… | Run |
| --- | --- |
| landing / editor (static files only) | `./scripts/unix/deploy_r2.sh` |
| the game (`game/**/*.gd`, scenes, assets, audio) | step 1 **then** step 2 |
| Worker logic (`backend/src/`) | step 3 |
| database schema (`backend/schema.sql`) | `(cd backend && npm run db:remote)` |

`deploy_r2.sh` does **not** re-export the game — if you touched the game, run the
export (step 1) first.

## Heads-up: the threaded build requires COOP/COEP headers

The Web preset uses `thread_support=true` (audio mixer off the main thread → no
music stutter). This **requires** cross-origin isolation, or the game won't boot:

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

The Worker already sends these headers for the `play/` path
([`backend/src/index.ts`](../backend/src/index.ts), `serveStatic`). If the game
ever loads blank in production, check DevTools → Network that the `/play/index.html`
response carries both headers.

## Post-deploy check

```bash
# Confirm the isolation headers are live on the game page:
curl -sSI https://pacoca-api.ricardoborges.workers.dev/play/index.html \
  | grep -i cross-origin
```

Then in a browser:

1. Open the production URL (the Worker's `*.workers.dev` subdomain, or the custom
   domain if one is set in `wrangler.jsonc`).
2. Play a level: music should be smooth (no stutter) and the framerate fine.
3. Log in with Google and publish a test level (exercises `/api` + D1).

## Production config reference

| Item | Value |
| --- | --- |
| Worker | `pacoca-api` (`backend/wrangler.jsonc`) |
| Production URL | `https://pacoca-api.ricardoborges.workers.dev` |
| R2 bucket | `pacoca-site` (binding `ASSETS`) |
| D1 database | `pacoca-levels` (binding `DB`) |
| Secret | `SESSION_SECRET` via `npx wrangler secret put SESSION_SECRET` |
| Public vars | `GOOGLE_CLIENT_ID`, `ADMIN_EMAILS` in `wrangler.jsonc` (`vars`) |
