# Map Drawing Guide — Paçoca 2.5D

This document describes how to draw Paçoca stages in **Text (ASCII Grid)** or **JSON**, how the visual editor and converter work, and how to turn a map into a playable Godot level (`.tscn`).

> **Source of Truth:** The behavior described here reflects `src/scripts/convert_map.py` (parser) and `src/scripts/generate_level.py` (scene generator). If this documentation and the code diverge, the code wins — see the [Known Inconsistencies](#known-inconsistencies) section.

---

## Pipeline Overview

```
map .txt / .json
      │
      ▼
src/scripts/convert_map.py        ← parses and generates level data
      │   ├─ creates src/scripts/levels/level_XX.py     (data module: build())
      │   └─ creates src/scenes/levels/level_XX.tscn    (base scene, only if missing)
      ▼
src/scripts/generate_level.py     ← compiles geometry/objects into .tscn
      │
      ▼
src/scenes/levels/level_XX.tscn   ← playable level, open in Godot
```

Three ways to produce the input map:

1. **Visual Editor** (`tools/map_editor/index.html`) — draw by clicking, export `.txt` or `.json`.
2. **ASCII Grid** written by hand in any text editor.
3. **Structured JSON** — for exact decimal coordinates and custom parameters.

---

## Coordinate System

The map is a side view (XY plane). The game is rendered in 3D, but physics live in the XY plane (Z is locked to 0).

| Axis | Meaning | Conversion from Grid |
| :--- | :--- | :--- |
| **X** (horizontal) | Each **column** equals **2.0 m**. | `x = column * 2.0` |
| **Y** (vertical) | Each **row** equals `ystep` meters (see below). | `y = row * ystep` |

- **Column 0** (far left) is the start of the level.
- The **last non-empty row** of the `[grid]` block is the lowest floor, `Y = 0`. Rows above increase the height.
- The converter **merges** horizontal sequences of `#` into a single physics collider to prevent the player from getting stuck on seams.

### The `ystep` Parameter (Read Carefully)

`ystep` defines how many meters each vertical row of the grid is worth. It is read from the file header:

```text
ystep: 3.0
```

- **The default height is `3.0` m per row.** Both the visual editor and `convert_map.py`'s default use this value, so every new level starts with the same vertical scale — you don't need to worry about it.
- The editor automatically writes `ystep: 3.0` in the exported `.txt`, and the `.json` loads equivalent absolute coordinates.
- The `ystep:` header exists only as a fallback for legacy or experimental cases (e.g., `level_01.txt` was made with `ystep: 1.0`). **To standardize, do not define `ystep` when creating new stages** — let the default of 3.0 apply.

---

## Character Legend

| Character | Element | Scene / Behavior |
| :--- | :--- | :--- |
| ` ` (space) or `.` | **Air / Empty** | Empty space |
| `#` | **Grass Platform** | Solid block (`CSGBox3D`) with a stone base |
| `/` | **Ramp Up** | Diagonal ramp rising to the right (`CSGPolygon3D`) |
| `\` | **Ramp Down** | Diagonal ramp falling to the right (`CSGPolygon3D`) |
| `o` | **Ring** | Collectible coin (`ring.tscn`) |
| `V` | **Vertical Spring** | Launches the player upward (`spring.tscn`, force 22) |
| `F` | **Diagonal Spring** | Launches forward and up (`spring.tscn`, force 25) |
| `D` or `>` | **Booster (Dash Pad)** | Accelerates the player forward (`dash_pad.tscn`) |
| `E` | **Common Enemy** | Patrol robot (`enemy.tscn`, speed 3.0) |
| `C` | **Cactus Enemy** | Patrol cactus (`cactus_enemy.tscn`, speed 1.25) |
| `S` | **Spikes** | Row of spikes causing damage (`spikes.tscn`) |
| `P` | **Player Spawn** | Player starting position (`Marker3D` SpawnPoint) |
| `G` | **Level Finish Coin** | Giant spinning coin that finishes the level (`level_finish.tscn`) |

> `>` is accepted as an alias for `D` only by the Python converter. The visual editor only knows `D`.

### Object Height Rule (Important)

Platforms (`#`) and ramps occupy the row they are drawn on. **However, objects (rings, springs, enemies, spikes, spawn, goal) anchor to the row immediately BELOW them.** In other words, they float above the surface that would be one row below:

| Object | Final Height (`r` = row, 0-based) |
| :--- | :--- |
| Ring `o` | `(r-1) * ystep + 1.2` |
| Spring `V` / `F`, dash `D`, spikes `S` | `(r-1) * ystep + 0.5` |
| Enemy `E` / `C` | `(r-1) * ystep + 1.0` |
| Spawn `P` | `(r-1) * ystep + 1.5` |
| Goal `G` | `(r-1) * ystep + 2.0` |

**In practice:** To place a ring, enemy, or spawn **on top** of a platform, draw it in the row **immediately above** the `#`. See in the example below how `P`, `C`, and `o` are all in the row above the ground.

### Floating vs. Anchored Platforms

The converter automatically decides the depth of each platform's (`#`) stone base:

- **Anchored (`rock_height = 4.0`)**: If `#`, `/`, or `\` exists directly below any column of the block, the stone goes all the way down to the ground.
- **Floating (`rock_height = 1.0`)**: Nothing solid below — a thin suspended ledge.

In JSON, you can force this with the `rock_height` field on each platform.

---

## Option 1 — ASCII Grid

A header with `key: value` pairs, followed by a `[grid]` section containing the drawing.

Header keys: `level`, `name`, `theme` (optional: `forest` default, `glacial`, `cidade`, `caverna` — selects the terrain materials), `xstep`/`ystep` (optional scale overrides).

```text
level: 03
name: Sky Ruins
theme: forest

[grid]

                                  G
                                  #
                ooo oo  o        #
              ooo                #
             o#################  #
          ooo                    #
          o#########             #
        o o                      #
       o #####       ########    #
      o   C   ####           #  ##
    oo  #    ##       C         #
   o   ##C   ##  ########       #
  oo  ##########                 #
   P     C             C         #
 #################################
```

### Grid Rules

- Blank lines at the top are preserved (adding height); blank lines at the end are discarded (the last non-empty line is `Y = 0`).
- The final width is that of the longest line; shorter lines are padded with spaces to the right.
- Adjacent `#` on a horizontal line are merged into a single collider.
- **Walls**: `#` stacked vertically render as solid rock; the grass cap only appears on cells with nothing solid directly above (i.e., walkable surfaces).

### Ramps: Gentle vs. Steep

There are two ways to draw ramps, with very different slopes at the default scale (2 m columns × 3 m rows):

- **Horizontal run (recommended)** — `///` on the **same row** produces ONE gentle ramp rising a single row (3 m) across the whole run. `///` = 6 m wide → **~27°**, comfortable to run up. The same applies to `\\\` for descents.
- **Diagonal chain (steep)** — `/` cells stacked diagonally (column +1, row +1; `\` descends column +1, row -1) merge into a steep ramp rising 3 m per column: **~56°**. The player can traverse it (the game raises the floor limit to 60°), but slope physics will fight you — treat it as a "half-pipe wall", not a regular path.
- A lone `/` or `\` counts as a horizontal run of one column (2 m wide × 3 m tall, still steep). For anything the player should casually run up, prefer runs of 2+ cells on the same row.

---

## Option 2 — Structured JSON

Ideal for exact decimal coordinates, custom parameters (enemy speed, spring force/direction), or external generation.

```json
{
  "level": "03",
  "name": "Chaos Temple",
  "spawn": [4.0, 1.5],
  "platforms": [
    { "x": 3.0, "y": 0.0, "width": 8.0 },
    { "x": 20.0, "y": 0.0, "width": 14.0, "rock_height": 1.0 }
  ],
  "ramps_up": [
    { "x": 73.0, "y": -0.5, "width": 2.0, "height": 1.0 }
  ],
  "ramps_down": [
    { "x": 79.0, "y": -0.5, "width": 2.0, "height": 1.0 }
  ],
  "rings": [
    [16.0, 1.2],
    [20.0, 1.2]
  ],
  "springs_vert": [
    { "x": 42.0, "y": -0.5, "force": 22.0 }
  ],
  "springs_diag": [
    { "x": 102.0, "y": 14.5, "force": 25.0, "dx": 1.2, "dy": 1.5, "lock": 0.6 }
  ],
  "dash_pads": [
    [34.0, -0.5]
  ],
  "enemies": [
    { "x": 50.0, "y": 0.0, "speed": 3.0 }
  ],
  "cactus_enemies": [
    { "x": 88.0, "y": 0.0, "speed": 1.25 }
  ],
  "spikes": [
    [106.0, 0.5]
  ],
  "goals": [
    [120.0, 2.0]
  ]
}
```

| Key | Type | Fields |
| :--- | :--- | :--- |
| `spawn` | `[x, y]` | — |
| `platforms` | objects | `x` (center), `y`, `width`, `rock_height?`, `grass?` (default `true`; `false` = rock top, used for interior wall blocks) |
| `ramps_up` / `ramps_down` | objects | `x`, `y`, `width`, `height` |
| `rings` | `[x, y]` | — |
| `springs_vert` | objects | `x`, `y`, `force` |
| `springs_diag` | objects | `x`, `y`, `force`, `dx`, `dy`, `lock` |
| `dash_pads` | `[x, y]` | — |
| `enemies` / `cactus_enemies` | objects | `x`, `y`, `speed` |
| `spikes` | `[x, y]` | — |
| `goals` | `[x, y]` | — |

> In JSON, platform `x` is the **center** of the block; `width` is the total width in meters. `rock_height` is optional — if omitted, the converter automatically detects whether the platform floats.

---

## Compiling to Godot

The converter lives in `src/scripts/`, and `--input` paths are relative to the directory from which you run the command. **Run it from the Godot project root (`src/`)**, not the Git repository root.

```powershell
# From D:\dev\games\Paçoca\src
python scripts/convert_map.py --input scripts/levels/level_04_map.txt --level 04
python scripts/convert_map.py --input scripts/levels/level_04_map.json --level 04
```

This command will:

1. Parse the `.txt`/`.json` into level structures (printing `WARNING:` lines for common mistakes).
2. Create `src/scenes/levels/level_04.tscn` (water, background mountains, SpawnPoint) **if it doesn't exist yet**, using the map's theme materials.
3. Generate `src/scripts/levels/level_04.py` (data module with `build()`).
4. Call `generate_level.py`, which compiles the geometry and distributes items/enemies in the scene (retargeting theme materials on recompiles).
5. Register the level in `src/scenes/levels/levels.json` — the game menu reads this manifest, so the level appears automatically. New levels are registered with `"builtin": false` and show up in the menu's **Custom Levels** list; levels flagged `"builtin": true` (shipped with the game) stay grouped by theme, and recompiling one keeps the flag.

Afterwards, open/reload the project in Godot 4.6 (Mono/.NET) to test.

### Re-generation is Idempotent

`generate_level.py` finds the generated block by the anchor `[node name="Platform_0"` and replaces it entirely on each run, making a `.tscn.bak` backup and repositioning the SpawnPoint via `base_edits`. You can recompile as many times as you like without accumulating duplicate nodes. **Do not manually edit the generated part of `.tscn`** — it will be overwritten.

### Running a Specific Stage Directly (the `--level` flag)

Levels (`level_XX.tscn`) are not playable on their own: they are loaded by `main.tscn` via `Main.cs`. To launch the game **directly into a level** (useful for iteration), pass the level through the command line — `Main.cs` reads the argument and overrides `GameSettings.LevelToLoad`:

```powershell
# By ID (resolves to res://scenes/levels/level_04.tscn)
& "<godot>.exe" --path .\src scenes/main.tscn -- --level=04

# Or by full res:// path
& "<godot>.exe" --path .\src scenes/main.tscn -- --level=res://scenes/levels/level_04.tscn
```

The `--` separates Godot arguments from game arguments; `--level=` must come after it. Without this flag, the game loads the default level.

---

## The Visual Editor (`tools/map_editor/`)

A web app with an optional local server. For the complete workflow (compile/test/run), execute:

```powershell
python tools/map_editor/server.py   # then open http://localhost:8000
```

Without the server (opening `index.html` via `file://`), the editor works for drawing and exporting, but process-executing buttons are disabled.

**Interface**
- **Sidebar** with tools (Paint / Erase / Line / Rectangle / Fill / Select / Clear) and the **icon palette** (tooltip on hover) showing the 12 elements.
- **Top bar** with level ID/name, **theme selector**, grid dimensions, zoom, gridlines, and preview toggle.
- **Canvas** dominant; **preview minimap** strip below it (click to navigate); bottom bar with coordinates and horizontal navigation.
- **Drawer** (button **Code**) with tabs **ASCII**, **JSON**, **Import**, and **Compile**.
- Only **one** spawn `P` is allowed (painting another removes the previous one).
- Exports `.txt` (`level_XX_map.txt`) and `.json` (`level_XX_map.json`).

**Actions (require the local server)**
- **Compile** — generates the level `.tscn`.
- **Test Level** (shortcut **F5**) — compiles the current level and opens Godot **directly in it** (performs an incremental `dotnet build` first so the `--level` flag works).
- **Run** — opens the game from the menu.

**Keyboard Shortcuts**
- **B** = paint · **E** = erase · **L** = line · **R** = rectangle · **G** = fill bucket · **M** = select · **F5** = test stage · **Esc** = cancel selection/paste or close the drawer.
- **Ctrl/Cmd+Z** = undo · **Ctrl/Cmd+Shift+Z** or **Ctrl+Y** = redo (covers strokes, shapes, fills, clear, resize, imports, and pastes).
- With a selection: **Ctrl/Cmd+C** copy · **Ctrl/Cmd+X** cut · **Del** clear · **Ctrl/Cmd+V** then click = paste (transparent: empty cells don't overwrite).

**Map validation**: on compile, the converter prints `WARNING:` lines (shown in the editor's result box) for common mistakes — no `P` spawn, no `G` goal (level cannot be completed), objects drawn on the bottom row (they would spawn below `Y = 0`), or a map with no solid ground.

> Godot Configuration: The server uses the `GODOT_BIN` environment variable (with a default path). E.g.: `GODOT_BIN="C:\...\Godot.exe" python tools/map_editor/server.py`.

> The editor uses `Y_STEP = 3.0` internally to generate both ASCII (writing `ystep: 3.0` in the header) and JSON (absolute coordinates).

---

## Design Metrics (Platformer Kit)

- **Block / Ramp:** 2 m wide per column.
- **Grid Row:** 3 m high (default `ystep`).
- **Max Walkable Slope:** 60° (`Player.FloorMaxAngleDegrees`). Horizontal ramp runs (`///`) are ~27°; diagonal chains are ~56° — steep but traversable.
- **Jump:** ~4 m standing, up to ~15 m at maximum speed.
- **Vertical Spring:** launches ~22 m high.
- **Fatal Fall:** avoid reachable platforms below `Y < -15 m` (water/abyss).
- **Default Base Scene Spawn:** `(-12, 1.5)` until repositioned by `P`/`spawn`.

### Player Size and Headroom (Passable Clearances)

The player collision is a **sphere of radius 0.55 → diameter 1.1 m** (fixed; does not shrink when rolling). To pass through a gap, the physical minimum is **~1.1 m**; aim for **≥1.5 m** for visual clearance.

Each grid row is 3 m high, so **a single empty row = 3 m of free vertical space** — more than enough for the character.

**Tunnel under a floating platform (ground below, floating above).** Two rules before calculation:

- Never stack `#` directly on top of `#`: the top block is detected as **anchored** (4 m stone base) and blocks the gap.
- The floating platform has its solid part extending **1.5 m below its center** (grass + stone), and the row immediately below it must be **empty** for it to count as floating.

With **N empty rows** between the floor and the floating platform, the clearance height is `(N+1) * 3 - 2.0` m:

| Empty Rows (N) | Clearance Height | Passable? (1.1 m player) |
| :--- | :--- | :--- |
| 1 | **4.0 m** | ✅ plenty of room |
| 2 | 7.0 m | ✅ |
| 3 | 10.0 m | ✅ |

In other words, at `ystep: 3.0`, **a single empty row opens a 4 m corridor** — very comfortable. (`level_01`, with `ystep: 1.0`, is the tight case: it would need ~3 empty rows.)

---

## Known Inconsistencies

Points where the editor, converter, and old docs diverged — recorded here to avoid surprises:

1. **Vertical Height — STANDARDIZED at 3.0.** Both the editor and `convert_map.py` use the same default (`3.0`), and the editor writes `ystep: 3.0` to the `.txt`. There is no longer a scale mismatch for new levels.
   - **Legacy Levels:** `level_01.txt` locks `ystep: 1.0` in the header and remains valid. `level_04_map.txt` has no header and was already compiling at 3.0, so it remains unchanged.

2. **Relative Paths.** The commands shown in the editor use `scripts/...`, which only work if run from inside `src/` (Godot project root), not the repository root.

3. **Alias `>`.** Accepted by the converter as a dash pad, but absent from the visual editor.
