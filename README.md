# Paçoca

A 2.5D Sonic-style platformer built with **Godot 4.6** and **C# (.NET 8)**.

The player controls Paçoca through fast-paced levels: running, jumping, rolling, charging spin dash, performing air dashes, collecting rings (coins), and dodging enemies — all powered by custom physics for acceleration, friction, and slope mechanics.

## Features

- **Sonic-style Physics**: acceleration/deceleration, friction, manual gravity, slope force, chargeable spin dash, diagonal air dash, and variable jump height.
- **3D Rendering on a 2D Plane (2.5D)**: the player is a `CharacterBody3D` locked to the XY plane, using animated 3D models.
- **100% Procedural Audio**: all sound effects are generated in real-time as sine waves — there are no audio files.
- **HUD**: score, time, rings, lives, and speed (km/h).
- **Gamepad Support**: controller selection and automatic mapping for the most common buttons.
- **Complete Menu**: play, options, credits, achievements, and stage select (including debug stage).

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
    │   └── levels/         # level_01.tscn, debug.tscn
    ├── scripts/            # Level pipeline (convert_map.py, generate_level.py)
    │   └── levels/         # Source maps (.txt/.json) and generated modules
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

- **Palette Dock** (platforms, ramps, rings, springs, enemies, spikes, spawn, level finish) + paint/erase tools.
- **Compile** — generates the level `.tscn` from the drawing.
- **Test Level** (`F5`) — compiles the current level and opens Godot **directly in it**.
- **Run** — opens the game starting from the main menu.
- **Settings Gear** — configures the Godot executable path (automatically detected in PATH; specify manually if not found).
- Shortcuts: `B` paint · `E` erase · `F5` test · `Esc` close.

> The editor also works when opened directly (`file://`) to draw and export, but buttons that run Godot/compile require the local server.

### Command Line Compiling

From `src/` (Godot project root):

```powershell
python scripts/convert_map.py --input scripts/levels/level_04_map.txt --level 04
```

This generates/updates `src/scenes/levels/level_04.tscn`, ready to open in Godot.

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
