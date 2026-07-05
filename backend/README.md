# Paçoca API + host (Cloudflare Worker + D1 + R2)

One Worker that does two jobs, on **one origin**:

1. **Community levels API** (`/api/*`, backed by D1) — publishes and serves
   user-created levels as the canonical structured JSON that the in-engine
   `RuntimeLevelBuilder` (`src/src/runtime_level_builder.gd`) consumes.
2. **Static host** (everything else, backed by an R2 bucket) — serves the landing
   page, the WASM game (`/play/`) and the map editor (`/editor/`). R2 is used
   instead of Pages/Static Assets because the game's `index.pck` (~137MB) and
   `index.wasm` (~38MB) exceed their 25 MiB/file limit.

Serving both from one origin is what makes the editor's **Testar** handoff
(`localStorage`) and the same-origin `/api` fetches work.

Anonymous publishing today; the schema reserves `author_id` for when user login
is added (see [`schema.sql`](./schema.sql)), so auth slots in without a migration.

## API

| Method | Path | Body / Query | Result |
| --- | --- | --- | --- |
| `GET` | `/api/health` | — | `{ ok: true }` |
| `GET` | `/api/levels` | `?sort=new\|popular&limit=&offset=` | listing (no `map`) |
| `GET` | `/api/levels/:id` | — | full level incl. `map` |
| `POST` | `/api/levels` | `{ name, theme, map, author_name? }` | `{ id }` |
| `POST` | `/api/levels/:id/play` | — | `{ play_count }` |

Publishing is validated server-side (`src/validation.ts`) with the same caps as
the game's runtime builder — a level is just data, so the only risk is an
oversized/malformed payload.

## Local development

`wrangler dev` runs the **whole** Worker — the same one that in production serves
the site (from R2) *and* `/api/*` (from D1). But its local R2 bucket and local D1
start **empty**, so a fresh `npx wrangler dev` returns 404 at `/` (nothing in R2)
and 500 at `/api/levels` (no tables). Seed them first:

```bash
cd backend
npm install
npm run types                 # generate worker-configuration.d.ts (Env)
npm run db:local              # create the D1 tables locally (fixes /api)
LOCAL=1 ../deploy_r2.sh       # seed the LOCAL R2 with build/dist/ (fixes the site)
npm run dev                   # http://127.0.0.1:8787 — serves site + /api together
```

> Just iterating on the **site/game/editor** (no live API)? Skip all this and use
> `./preview.sh` from the repo root — a plain static server on one origin, no
> seeding. Only **Publicar** and the community feed need the Worker's `/api`.

API smoke test:

```bash
curl -X POST http://127.0.0.1:8787/api/levels \
  -H 'content-type: application/json' \
  -d '{"name":"Demo","theme":"forest","map":{"platforms":[{"x":0,"y":0,"width":20}],"goals":[[10,2]]}}'
curl 'http://127.0.0.1:8787/api/levels?sort=new'
```

## Deploy (Cloudflare)

Requires a Cloudflare account with Workers + D1 + R2. From the repo root:

```bash
# 1. Auth
npx wrangler login

# 2. Database (D1)
cd backend
npx wrangler d1 create pacoca-levels     # copy the id into wrangler.jsonc
npm run db:remote                        # apply schema.sql to the remote D1
cd ..

# 3. Static bucket (R2)
(cd backend && npx wrangler r2 bucket create pacoca-site)

# 4. Export the game + build the bundle + upload it to R2
GODOT=/path/to/Godot ./tools/export_web.sh
./deploy_r2.sh                           # runs build_dist.sh, uploads build/dist/ -> R2

# 5. Deploy the Worker (serves /api from D1 and everything else from R2)
(cd backend && npm run deploy)
```

Re-run `./deploy_r2.sh` after changing the site/game, and `npm run deploy` after
changing the Worker code.

**Custom domain:** add a route in `wrangler.jsonc` (or the dashboard) so the
Worker answers on your hostname — then `/`, `/play/`, `/editor/` and `/api/*` all
share that origin. Without one, the Worker is reachable at its `*.workers.dev`
subdomain. CORS reflection still covers cross-origin local dev.
