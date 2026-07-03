# Paçoca

A 2.5D Sonic-style platformer built with **Godot 4.6** and **C# (.NET 8)**.

The player controls Paçoca through fast-paced levels: running, jumping, rolling, charging spin dash, performing air dashes, collecting rings (coins), and dodging enemies — all powered by custom physics for acceleration, friction, and slope mechanics.

## Features

- **Sonic-style Physics**: acceleration/deceleration, friction, manual gravity, slope force, chargeable spin dash, diagonal air dash, variable jump height, coyote time, and jump buffering.
- **3D Rendering on a 2D Plane (2.5D)**: the player is a `CharacterBody3D` locked to the XY plane, using animated 3D models.
- **Procedural Sound Effects + Music**: SFX are generated in real-time as sine waves; background music tracks live in `src/audio/`.
- **HUD**: score, time, rings, lives, and speed (km/h).
- **Gamepad Support**: controller selection and automatic mapping for the most common buttons.
- **Dynamic Stage Select**: the menu lists levels from `scenes/levels/levels.json` (written by the map pipeline) plus a directory scan — levels you create in the map editor appear automatically.
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

- **Godot 4.6** - **.NET / Mono** edition (required for C# projects)
- **.NET SDK 8.0**

## How to Run

1. Open the project in the Godot editor by pointing it to `src/project.godot`.
2. Godot will automatically compile the C# assembly.
3. Run the project (F5). The initial scene is `res://scenes/menu.tscn`.

To just compile the C# project via command line (from `src/`, where `Paçoca.csproj` is located):

```bash
dotnet build
```

## Project Structure

> Note the nested `src` directory: the git repository root is at the top level, but the **Godot project** is in `src/`, and the **C# scripts** are located in `src/src/`.

```
Paçoca/
├── assets/                 # Raw assets (exported models, etc.)
├── docs/                   # Documentation (e.g., map_syntax.md)
├── tools/
│   └── map_editor/         # Visual map editor (web + server.py)
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
    └── src/                # C# scripts (res://src/*.cs)
        ├── Main.cs         # Coordinates gameplay and loads levels
        ├── Player.cs       # Player (CharacterBody3D) and physics
        ├── GameSettings.cs # Global state across scenes (level, gamepad)
        ├── CameraController.cs
        ├── HUD.cs, Menu.cs, PauseMenu.cs, GameOver.cs
        └── Ring.cs, Spring.cs, DashPad.cs, Enemy.cs
```

## Level Creation (Map Editor)

Levels are drawn as **maps** (ASCII grid or JSON) and converted into Godot scenes (`level_XX.tscn`) via a Python pipeline. There is a **visual web editor** that covers the entire loop: draw → compile → test.

### Visual Editor (`tools/map_editor/`)

```bash
python tools/map_editor/server.py     # open http://localhost:8000
```

- **Palette Dock** (platforms, ramps, rings, springs, enemies, spikes, spawn, level finish).
- **Tools**: paint, erase, line, rectangle, fill bucket, and select (with copy/cut/paste), plus full undo/redo.
- **Preview minimap** — a live render of the whole level under the canvas; click it to navigate.
- **Theme selector** — forest / glacial / city / cave terrain materials per level.
- **Compile** — generates the level `.tscn` from the drawing, with validation warnings (missing spawn/goal, buried objects).
- **Test Level** (`F5`) — compiles the current level and opens Godot **directly in it**, with live player tracking on the map.
- **Run** — opens the game starting from the main menu.
- **Settings Gear** — configures the Godot executable path (automatically detected in PATH; specify manually if not found).
- Shortcuts: `B` paint · `E` erase · `L` line · `R` rectangle · `G` fill · `M` select · `Ctrl+Z/Y` undo/redo · `Ctrl+C/X/V` copy/cut/paste · `F5` test · `Esc` close.
- Source maps are saved under `tools/map_editor/levels/` (single canonical folder).

> The editor also works when opened directly (`file://`) to draw and export, but buttons that run Godot/compile require the local server.

### Command Line Compiling

From `src/` (Godot project root):

```bash
python scripts/convert_map.py --input ../tools/map_editor/levels/level_04_map.txt --level 04
```

This generates/updates `src/scenes/levels/level_04.tscn` (ready to open in Godot) and registers the level in `scenes/levels/levels.json`, which the in-game stage select reads.

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
