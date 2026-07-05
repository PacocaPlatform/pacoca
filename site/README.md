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
4.6.3** editor plus the Web export templates (the Mono edition cannot export to
Web):

```bash
GODOT=/path/to/Godot_v4.6.3-stable_console ./tools/export_web.sh
```

### Assembling the deploy folder

`build_dist.sh` (repo root) assembles the layout above with real copies into
`build/dist/`. Upload the **contents of `build/dist/`** as the site root:

```bash
./build_dist.sh                   # from the repo root -> build/dist/
```

## Local preview

`preview.sh` (repo root) assembles the same layout and serves it on one origin,
so `/`, `/play/` and `/editor/` all work (including the **Testar** handoff):

```bash
./preview.sh                      # http://localhost:8000
```

## Community levels feed

The "Feitas pela comunidade" section fetches `GET /api/levels?sort=popular` from
the backend Worker. If the backend isn't reachable it degrades to a friendly
"be the first to publish" message.
