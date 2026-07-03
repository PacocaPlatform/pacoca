# Paçoca — Visual Map Editor

A web-based editor to design stages and compile them into Godot `.tscn` scenes without leaving the browser.

## How to Run (Full Mode, with "Compile now" button)

From the repository root:

```bash
python tools/map_editor/server.py
```

Then open **http://localhost:8000** in your browser.

- Draw the stage on the grid with the paint, line, rectangle, fill, and select tools (full undo/redo).
- **Preview minimap** — live render of the whole level below the canvas; click it to navigate.
- **Theme** — choose forest / glacial / city / cave terrain materials (saved as `theme:` in the map header).
- **Maps** — saves the current map to disk (`tools/map_editor/levels/level_<id>_map.txt`), lists created custom levels, and allows **opening them for editing** or **deleting**.
- **Compile** — generates `src/scenes/levels/level_<id>.tscn` from the map, prints validation warnings, and registers the level in `src/scenes/levels/levels.json` (the game menu reads it, so the level shows up in the stage select).
- **Test Level** (**F5**) — compiles the current level and opens Godot **directly in it**.
- **Run** — opens the game starting from the main menu.

### Shortcuts

- **B** = paint · **E** = erase · **L** = line · **R** = rectangle · **G** = fill · **M** = select · **F5** = test stage · **Esc** = cancel selection/paste or close the code drawer.
- **Ctrl/Cmd+Z** undo · **Ctrl/Cmd+Shift+Z** / **Ctrl+Y** redo · with a selection: **Ctrl/Cmd+C/X** copy/cut, **Del** clear, **Ctrl/Cmd+V** then click to paste.

### Godot Path

The **Test Level** / **Run** buttons need the Godot executable. The server resolves it in this order: **saved path in editor → `GODOT_BIN` environment variable → system PATH detection → default path**.

- Click the **gear icon** (top bar) to see/set the path. If Godot is in your PATH, it is automatically detected and filled on startup; otherwise, specify the path manually and click **Save** (persists in `editor_config.json`, which is ignored by git).

### Environment Variables

- `PORT` — server port (default `8000`).
- `GODOT_BIN` — Godot executable path (used if no path is saved in the editor).

## Simple Mode (without server)

You can open `index.html` directly via `file://` to draw, copy/download the ASCII/JSON representation, and compile manually. In this mode, the **Compile now** button will not work (browsers do not allow launching local processes) — use the command shown in the Compile tab instead.

## Architecture

- `index.html` / `app.js` / `styles.css` — the static web editor.
- `icons/` — SVG icons for the palette blocks.
- `levels/` — **source maps** (`.txt`/`.json`) saved by the editor (custom levels).
- `server.py` — local Python server (stdlib, no dependencies). Serves the editor and exposes the JSON API (`/api/compile`, `/api/run`, `/api/config`, `/api/maps`).
- Build scripts (`convert_map.py`, `generate_level.py`) remain in `src/scripts/` — the server merely orchestrates them. When compiling, it reads the map from `levels/` and writes the generated artifacts (`.py`/`.tscn`) to the Godot project (`src/`).

Map syntax and design metrics: see [`docs/map_syntax.md`](../../docs/map_syntax.md).
