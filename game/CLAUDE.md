# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Paçoca is a 2.5D momentum platformer built with **Godot 4.7** and **GDScript** (pure — no .NET/Mono). UI text is in Portuguese (e.g. "MOEDAS" = rings, "VIDAS" = lives, "JOGAR" = play).

## Directory layout

- Git repo root: the top-level `pacoca/` directory.
- **Godot project root** (`res://`): `game/` — contains `project.godot`, `scenes/`, `scripts/`, `levelgen/`, `models/`, `materials/`, `textures/`.
- **GDScript game code**: `game/scripts/` — so a script is referenced as `res://scripts/player.gd`. Files are `snake_case.gd`; each declares a `class_name` (PascalCase) matching the old C# class (e.g. `player.gd` → `class_name Player`).
- **Level pipeline** (Python, build-time): `game/levelgen/` — `convert_map.py` / `generate_level.py`, kept as a direct child of the Godot root so their `../scenes`-relative output paths resolve.
- **Map sources** (`.txt`/`.json`): `tools/map_editor/levels/` (single canonical folder). The pipeline generates `game/levelgen/levels/level_XX.py`, `game/scenes/levels/level_XX.tscn`, and updates `game/scenes/levels/levels.json`.

All scene/resource paths in code use `res://` (the Godot project root), not filesystem paths.

## Build & Run

There is no compile step — GDScript is loaded by the engine directly.

```bash
# Run the game headless (from the Godot project root)
godot --path . scenes/menu.tscn

# Map-converter unit tests (also from the Godot project root)
python3 -m unittest discover -s levelgen/tests
```

Running the game requires the **Godot 4.7 editor** (standard edition is fine). The main scene is `res://scenes/menu.tscn` (set in `project.godot`).

## Scene / flow architecture

Scene transitions are done with `get_tree().change_scene_to_file(...)`:

`menu.tscn` → (sets `GameSettings.level_to_load`, then) `main.tscn` → on death `game_over.tscn` → back to `menu.tscn`. `pause_menu.tscn` overlays gameplay.

- **`main.gd`** (root of `main.tscn`) is the gameplay coordinator. It reads `GameSettings.level_to_load`, instances the level under a `LevelWrapper` node, and moves the `Player` to the level's `SpawnPoint` (a `Marker3D`). Levels are swappable scenes in `scenes/levels/` (`level_01.tscn`, `debug.tscn`). `Main.restart_stage()` reloads the current level in place (used on respawn); `Player`/`LevelFinish` call it via `get_tree().current_scene.has_method(...)` to avoid a class-name dependency cycle.
- **Stage select is dynamic**: `menu.gd` builds the level list from `res://scenes/levels/levels.json` (written by `levelgen/convert_map.py`) plus a `DirAccess` scan of `scenes/levels/`. Manifest entries with `"builtin": true` (shipped levels) are listed under their theme (`forest`/`glacial`/`cidade`/`caverna`, mapped to terrain materials in `materials/`); everything else — map-editor output, dir-scanned scenes — appears in the "Custom Levels" list on the theme panel. `convert_map.py` writes new levels as `"builtin": false` and preserves the flag on recompiles.
- **`game_settings.gd`** is a `class_name GameSettings extends RefCounted` with **static** vars/funcs (accessed as `GameSettings.foo`, never instanced) holding cross-scene state: `level_to_load`, `level_theme` and the selected joypad device. `apply_joypad_settings()` rewrites `InputMap` events to bind a chosen gamepad and pre-maps common buttons.
- **Backgrounds are runtime-parallax**: `Main._setup_parallax_background()` hides each level's legacy `Level/BG_Mountains` quad and spawns a `ParallaxBackground3D` (camera-following quad, UV-scrolled at ~5% of camera speed) using `materials/bg_<theme>.tres` → seamless art in `images/backgrounds/bg_<theme>.png`, regenerated from `forest-background.png` by `tools/generate_theme_backgrounds.py`. Theme resolution: menu selection > `levels.json` > filename > forest.

## Gameplay model (key conventions)

- The player is a **`CharacterBody3D` (`player.gd`) locked to the XY plane** — `_physics_process` forcibly zeroes `Z` position and velocity every frame. This is 3D rendering with 2D-plane physics, not a 2D scene.
- Custom physics (not Godot defaults): manual gravity, acceleration/deceleration/friction, slope force from floor normal, spin dash charging, air dash, variable jump height, rolling state. Tunable via `@export` fields at the top of `player.gd`.
- Player ↔ UI communication uses the `player_stats_changed(rings, score, speed, lives)` **signal**. `hud.gd` finds the `Player` node and subscribes; gameplay objects (`Ring`, `Spring`, `DashPad`, `Enemy`) call public `Player` methods like `collect_ring()`, `apply_boost()`, `hurt()`.
- **Sound effects are procedural** — generated as sine waves at runtime via `AudioStreamGenerator`/`AudioStreamGeneratorPlayback` (see `play_sound(frequency, duration, volume)` in `player.gd` and the audio setup duplicated in `menu.gd`). Background music is OGG Vorbis files under `audio/`, routed through the shared "Music" bus (streamed via `PLAYBACK_TYPE_STREAM` — the Web export's default "Sample" playback only supports WAV). **Keep these tracks mono / 22050 Hz**: on `PLAYBACK_TYPE_STREAM` the Vorbis decode runs on the web audio worker thread every frame, and 48 kHz stereo overruns weaker mobile CPUs (Chrome Android) → the music stutters even though the game itself is smooth. Re-encode with `ffmpeg -ac 1 -ar 22050 -c:a libvorbis -q:a 5` before committing new music.
- Character animations come from Mixamo FBX models (`models/paçoca-*.fbx`), each with an `AnimationPlayer` playing the `"mixamo_com"` clip. The player swaps between idle/running/jumping model nodes by toggling visibility rather than blending.

## Conventions

- Methods and member vars are `snake_case`; each script declares a PascalCase `class_name`. **`@export` var names are kept PascalCase** (e.g. `MaxSpeed`, `LaunchForce`, `Direction`) so existing `.tscn` property overrides and the map pipeline output keep binding without edits — do not rename them.
- Node references are typed fields (`var _x: T`) assigned from `get_node(...)` in `_ready()`; node-path strings are tightly coupled to the `.tscn` scene tree, so renaming nodes in a scene requires updating these paths.
- Avoid `class_name` dependency cycles: `player.gd`/`level_finish.gd` reach `Main` via `get_tree().current_scene.has_method(...)` rather than a typed reference.
