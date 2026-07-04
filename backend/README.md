# Paçoca API (Cloudflare Worker + D1)

Backend for **community levels**: publishes and serves user-created levels as the
canonical structured JSON that the in-engine `RuntimeLevelBuilder`
(`src/src/runtime_level_builder.gd`) consumes.

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

```bash
cd backend
npm install
npm run types                 # generate worker-configuration.d.ts (Env)
npm run db:local              # apply schema.sql to the local D1
npm run dev                   # wrangler dev on http://127.0.0.1:8787
```

Smoke test:

```bash
curl -X POST http://127.0.0.1:8787/api/levels \
  -H 'content-type: application/json' \
  -d '{"name":"Demo","theme":"forest","map":{"platforms":[{"x":0,"y":0,"width":20}],"goals":[[10,2]]}}'
curl 'http://127.0.0.1:8787/api/levels?sort=new'
```

## Deploy (Cloudflare)

Requires a Cloudflare account with Workers + D1 (and authorizing the Cloudflare
connectors in this environment):

```bash
npx wrangler d1 create pacoca-levels     # copy the id into wrangler.jsonc
npm run db:remote                        # apply schema to the remote D1
npm run deploy
```

The Worker is served under `/api/*`; the static editor + game (Cloudflare Pages)
call it same-origin in production (CORS reflection covers cross-origin local dev).
