# Paçoca

A fast-paced 2.5D momentum platformer built with **Godot 4.6** and **GDScript**.

The player controls Paçoca through fast-paced levels: running, jumping, rolling, charging spin dash, performing air dashes, collecting rings (coins), and dodging enemies — all powered by custom physics for acceleration, friction, and slope mechanics.

## Features

- **Momentum Physics**: acceleration/deceleration, friction, manual gravity, slope force, chargeable spin dash, diagonal air dash, variable jump height, coyote time, and jump buffering.
- **3D Rendering on a 2D Plane (2.5D)**: the player is a `CharacterBody3D` locked to the XY plane, using animated 3D models.
- **Procedural Sound Effects + Music**: SFX are generated in real-time as sine waves; background music tracks live in `src/audio/`.
- **HUD**: score, time, rings, lives, and speed (km/h).
- **Gamepad Support**: controller selection and automatic mapping for the most common buttons.
- **Dynamic Stage Select**: the menu lists levels from `scenes/levels/levels.json` (written by the map pipeline) plus a directory scan. Builtin levels (`"builtin": true`, shipped with the game) are grouped by theme; levels you compile in the map editor land in a separate **Custom Levels** list automatically.
- **Level Themes**: forest, glacial, city, and cave terrain materials, chosen per map (`theme:` header).

## Controls

| Action | Keyboard | Gamepad |
|------|---------|---------|
| Move | Arrow keys / `A` `D` | D-pad / left analog stick |
| Jump / Air dash | `Space` / `Z` | A, B, X, Y |
| Crouch / Roll / Spin dash | `S` (hold) + jump to charge | D-pad ↓ |
| Dash | `X` / `Shift` | — |
| Pause | `Esc` | Start |

## Requirements

- **Godot 4.6** (standard edition — the project is pure GDScript, no .NET/Mono required)

## How to Run

1. Open the project in the Godot editor by pointing it to `src/project.godot`.
2. Run the project (F5). The initial scene is `res://scenes/menu.tscn`.

To run headless from the command line (from `src/`, the Godot project root):

```bash
godot --path . scenes/menu.tscn
```

## Play on the Web (WebAssembly)

Paçoca runs entirely in the browser — no install. The public site is **three
static pieces served from the same origin**, plus the community backend:

| Source | Served at | What it is |
| --- | --- | --- |
| `site/` | `/` | landing page |
| `build/web/` | `/play/` | the exported WASM game |
| `tools/map_editor/` | `/editor/` | the visual map editor |
| `backend/` | `/api/*` | Cloudflare Worker (community levels) |

Same origin matters: the links are relative, and the editor's **Testar** button
hands the level to the game through `localStorage` (only shared across `/editor/`
and `/play/` when they share an origin). So you never deploy `site/` or
`build/web/` alone — you deploy a folder that combines all three as siblings.

**1. Export the game** (needs the **standard**, non‑Mono Godot 4.6+ and the Web
export templates — the Mono edition cannot export to Web):

```bash
GODOT=/path/to/Godot ./tools/export_web.sh      # writes build/web/
```

**2a. Preview locally** — assembles the layout and serves it on one origin:

```bash
./preview.sh            # http://localhost:8000  (/, /play/, /editor/)
```

**2b. Build the deploy bundle** — real copies, one folder:

```bash
./build_dist.sh         # writes build/dist/
```

**3. Host it.** The recommended target is Cloudflare, where **one Worker serves
both the static site (from R2) and `/api/*` (from D1)** on a single origin:

```bash
./deploy_r2.sh                      # upload build/dist/ to the R2 bucket
(cd backend && npm run deploy)      # deploy the Worker
```

> ⚠️ Don't use plain Cloudflare Pages: it (and Workers Static Assets) rejects
> files over **25 MiB**, and the game's `index.pck` (~137MB) and `index.wasm`
> (~38MB) exceed that. R2 has no per-file limit, which is why the Worker serves
> the static files from an R2 bucket. Full steps: [`backend/README.md`](backend/README.md).

The backend is optional for the game itself: without it, only **Publicar** and
the community levels list are unavailable (with a friendly message) — playing,
testing, and saving levels in the browser all work offline. See
[`site/README.md`](site/README.md) for the layout details.

## Project Structure

> Note the nested `src` directory: the git repository root is at the top level, but the **Godot project** is in `src/`, and the **C# scripts** are located in `src/src/`.

```
Paçoca/
├── preview.sh              # Local web preview (landing + game + editor, one origin)
├── build_dist.sh           # Assemble build/dist/ (the deploy bundle)
├── deploy_r2.sh            # Upload build/dist/ to the Cloudflare R2 bucket
├── site/                   # Landing page (static; deploys at /)
├── build/web/              # Exported WASM game (generated; deploys at /play/)
├── backend/                # Community-levels API (Cloudflare Worker; /api/*)
├── assets/                 # Raw assets (exported models, etc.)
├── docs/                   # Documentation (e.g., map_syntax.md)
├── tools/
│   ├── export_web.sh       # Exports the game to build/web/ (standard Godot)
│   └── map_editor/         # Visual map editor (fully client-side; deploys at /editor/)
└── src/                    # Godot project root (res://)
    ├── project.godot
    ├── Paçoca.csproj
    ├── scenes/             # Scenes: menu, main, hud, player, enemies, levels...
    │   └── levels/         # Generated level_XX.tscn + levels.json manifest
    ├── scripts/            # Level pipeline (convert_map.py, generate_level.py)
    │   ├── levels/         # Generated per-level modules (level_XX.py)
    │   └── tests/          # Converter unit tests (python3 -m unittest discover -s scripts/tests)
    ├── models/             # Animated FBX models (Mixamo)
    ├── materials/
    ├── textures/
    └── src/                # GDScript scripts (res://src/*.gd)
        ├── main.gd         # Coordinates gameplay and loads levels
        ├── player.gd       # Player (CharacterBody3D) and physics
        ├── game_settings.gd # Global static state across scenes (level, gamepad)
        ├── camera_controller.gd
        ├── hud.gd, menu.gd, pause_menu.gd, game_over.gd
        └── ring.gd, spring.gd, dash_pad.gd, enemy.gd
```

## Level Creation (Map Editor)

Levels are drawn as **maps** (ASCII grid or JSON) and converted into Godot scenes (`level_XX.tscn`) via a Python pipeline. There is a **visual web editor** that covers the entire loop: draw → compile → test.

### Visual Editor (`tools/map_editor/`)

The editor is a **fully client-side, online tool** — no Python server, no local
Godot. The level you draw is handed to the WebAssembly build of the game, which
builds it at runtime (`RuntimeLevelBuilder`). Serve it statically:

```bash
python -m http.server 8000        # from the repo root
# open http://localhost:8000/tools/map_editor/
```

- **Palette Dock** (platforms, ramps, rings, springs, enemies, spikes, spawn, level finish).
- **Tools**: paint, erase, line, rectangle, fill bucket, and select (with copy/cut/paste), plus full undo/redo.
- **Preview minimap** — a live render of the whole level under the canvas; click it to navigate.
- **Theme selector** — forest / glacial / city / cave terrain materials per level.
- **Fases** — save / open / delete maps, stored in the browser (`localStorage`).
- **Testar** (`F5`) — opens the game in the browser (`/play/?custom=1`) and plays the current drawing, passed via `localStorage`. No compile step.
- **Jogar** — opens the game's main menu (`/play/`).
- **Publicar** — submits the level to the community backend (`POST /api/levels`).
- Shortcuts: `B` paint · `E` erase · `L` line · `R` rectangle · `G` fill · `M` select · `Ctrl+Z/Y` undo/redo · `Ctrl+C/X/V` copy/cut/paste · `F5` test · `Esc` close.

> **Testar**/**Jogar** need the game reachable at `../play/` on the same origin
> (see [`site/README.md`](site/README.md) for the deploy layout).
> `server.py` is kept only for the legacy offline/native compile pipeline.

### Command Line Compiling

From `src/` (Godot project root):

```bash
python scripts/convert_map.py --input ../tools/map_editor/levels/level_04_map.txt --level 04
```

This generates/updates `src/scenes/levels/level_04.tscn` (ready to open in Godot) and registers the level in `scenes/levels/levels.json`, which the in-game stage select reads. New levels are registered as custom (`"builtin": false`) and show up under the menu's **Custom Levels** list; recompiling a builtin level keeps it builtin.

### Quick Syntax

Each **column** of the grid equals 2 m (X) and each **row** is 3 m (Y, `ystep`); the last non-empty row is the ground (`Y = 0`).

| Char | Element | Char | Element |
| :---: | --- | :---: | --- |
| `#` | platform | `V` `F` | vertical / diagonal spring |
| `/` `\` | ramp up / down | `D` | booster (dash pad) |
| `o` | ring | `E` `C` | enemy / cactus enemy |
| `P` | player spawn | `S` | spikes |
| `G` | level finish coin | ` ` | empty |

📖 **Complete documentation** (grid rules, heights, player headroom, JSON format, `--level` flag): [`docs/map_syntax.md`](docs/map_syntax.md).

## Architecture

- **`Main.cs`** is the gameplay coordinator (root of `main.tscn`): it reads `GameSettings.LevelToLoad`, instantiates the level inside a `LevelWrapper` node, and positions the player at the level's `SpawnPoint` (`Marker3D`). Levels are interchangeable scenes in `scenes/levels/`.
- **`GameSettings.cs`** is a global static state that stores the selected level and joystick, persisting between scene changes.
- **Scene Flow**: `menu.tscn` → `main.tscn` → `game_over.tscn` → `menu.tscn`, with `pause_menu.tscn` overlaid during gameplay.
- **UI Communication**: the `Player` emits the `PlayerStatsChanged(rings, score, speed, lives)` signal, to which `HUD` connects. Objects like `Ring`, `Spring`, `DashPad`, and `Enemy` call public methods on `Player` (`CollectRing()`, `ApplyBoost()`, `Hurt()`).

For development details, see `src/CLAUDE.md`.
