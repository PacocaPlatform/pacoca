# Paçoca — Landing page

Static landing page for the Paçoca platform. Two front doors: **Jogar** (play the
game in the browser) and **Map Editor** (create your own stages). Everything is
static — no server.

## Files

- `index.html` / `styles.css` / `app.js` — the page (self-contained).
- `assets/` — hero art and theme backgrounds (copied from the game).

## Deploy layout

The landing, the game and the editor deploy as **sibling folders on the same
origin** (e.g. Cloudflare Pages). The links in the page are relative and assume:

```
/            -> site/            (this landing page)
/play/       -> build/web/       (the exported Godot WASM game)
/editor/     -> tools/map_editor/ (the visual editor)
/api/*       -> backend Worker    (community levels)
```

Same origin matters: the editor's **Testar** button hands a level to the game
through `localStorage` (key `pacoca_test_map`), which only works when `/editor/`
and `/play/` share an origin.

### Building the game (WASM)

`build/web/` is generated — export it with the **standard (non-Mono) Godot
4.7** editor plus the Web export templates (the Mono edition cannot export to
Web):

```bash
GODOT=/path/to/Godot_v4.7-stable_console ./scripts/unix/export_web.sh
```

### Assembling & hosting

`scripts/unix/build_dist.sh` (or `scripts/windows/build_dist.ps1`) assembles the
layout above with real copies into `build/dist/`:

```bash
./scripts/unix/build_dist.sh                   # from the repo root -> build/dist/
```

Host it on Cloudflare, where a single Worker serves the static files from R2 and
`/api/*` from D1 on one origin — `scripts/unix/deploy_r2.sh` uploads the bundle. Plain
Cloudflare Pages won't work: it rejects files over 25 MiB, and the game's
`index.pck`/`index.wasm` exceed that. Full steps:
[`../backend/README.md`](../backend/README.md).

## Local preview

`scripts/unix/preview.sh` (or `scripts/windows/preview.ps1`) assembles the same
layout and serves it on one origin,
so `/`, `/play/` and `/editor/` all work (including the **Testar** handoff):

```bash
./scripts/unix/preview.sh                      # http://localhost:8000
```

## Community levels feed

The "Feitas pela comunidade" section fetches `GET /api/levels?sort=popular` from
the backend Worker. If the backend isn't reachable it degrades to a friendly
"be the first to publish" message.
