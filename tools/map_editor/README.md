# Paçoca — Visual Map Editor

A fully client-side web editor to design stages and play them in the browser.
No Python server, no local Godot: the level you draw is handed to the
WebAssembly build of the game, which builds it at runtime via
`RuntimeLevelBuilder`.

## How to Run

The editor is a static site. In production it deploys next to the game
(`/editor/` and `/play/` on the same origin — see [`site/README.md`](../../site/README.md)).
For local development, serve the repo root with any static server and open the
editor:

```bash
python -m http.server 8000        # from the repo root
# open http://localhost:8000/tools/map_editor/
```

> Opening `index.html` via `file://` also works for drawing and exporting, but
> **Testar**/**Jogar** need the game to be reachable at `../play/` (same origin),
> so use a static server with the deployed folder layout.

- Draw the stage on the grid with the paint, line, rectangle, fill, and select tools (full undo/redo).
- **Preview minimap** — live render of the whole level below the canvas; click it to navigate.
- **Theme** — choose forest / glacial / city / cave terrain materials (saved as `theme:` in the map).
- **Level name is the only identity** — there is no ID field. The internal id is derived from the name (`"Fase do Dragão"` → `fasedodragao`).

### Actions (top bar)

- **Fases** — save / open / delete maps. Maps are stored **in the browser**
  (`localStorage`, key `pacoca_maps`); nothing is written to disk.
- **Código** — export the level as ASCII grid or structured JSON, or import one back in.
- **Testar** (**F5**) — opens the game in a new tab (`../play/?custom=1`) and plays
  the current drawing. The level is passed via `localStorage` (key
  `pacoca_test_map`) and built in-engine — no compile step.
- **Jogar** — opens the game's main menu (`../play/`).
- **Publicar** — submits the level to the community backend (`POST /api/levels`)
  as canonical structured JSON. Optionally set your name in the **Publicar** tab.

### Shortcuts

- **B** = paint · **E** = erase · **L** = line · **R** = rectangle · **G** = fill · **M** = select · **F5** = test stage · **Esc** = cancel selection/paste or close the code drawer.
- **Ctrl/Cmd+Z** undo · **Ctrl/Cmd+Shift+Z** / **Ctrl+Y** redo · with a selection: **Ctrl/Cmd+C/X** copy/cut, **Del** clear, **Ctrl/Cmd+V** then click to paste.

## The level format

The editor exports the **structured JSON** (absolute coordinates) shared by three
consumers, which all agree on the same keys and caps:

- the in-engine `RuntimeLevelBuilder` (`src/src/runtime_level_builder.gd`),
- the community backend validator (`backend/src/validation.ts`),
- the browser test handoff (`localStorage['pacoca_test_map']`).

Keys: `platforms`, `ramps_up`, `ramps_down`, `rings`, `springs_vert`,
`springs_diag`, `dash_pads`, `enemies`, `cactus_enemies`, `spikes`, `goals`,
`spawn`, plus `theme` / `name`.

## Architecture

- `index.html` / `app.js` / `styles.css` — the static web editor (no build step).
- `icons/`, `images/` — palette and preview art.
- `server.py` — **legacy/optional.** The old native pipeline (compile a map into a
  `.tscn` via `convert_map.py` and launch native Godot). The editor no longer
  depends on it; it is kept only for the offline/native workflow.

Map syntax and design metrics: see [`docs/map_syntax.md`](../../docs/map_syntax.md).
