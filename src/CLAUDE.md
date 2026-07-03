# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Paçoca is a 2.5D Sonic-style platformer built with **Godot 4.6** and **C# (.NET 8)**. UI text is in Portuguese (e.g. "MOEDAS" = rings, "VIDAS" = lives, "JOGAR" = play).

## Directory layout (important — nested `src`)

- Git repo root: the top-level `pacoca/` directory.
- **Godot project root** (`res://`): `src/` — contains `project.godot`, `Paçoca.csproj`, `scenes/`, `models/`, `materials/`, `textures/`.
- **C# scripts**: `src/src/` — so a script is referenced as `res://src/Player.cs`.
- **Map sources** (`.txt`/`.json`): `tools/map_editor/levels/` (single canonical folder). The pipeline generates `src/scripts/levels/level_XX.py`, `src/scenes/levels/level_XX.tscn`, and updates `src/scenes/levels/levels.json`.

All scene/resource paths in code use `res://` (the Godot project root), not filesystem paths.

## Build & Run

There is no `.sln`. The project uses the `Godot.NET.Sdk/4.6.3` SDK.

```bash
# Compile C# (run from the Godot project root, where Paçoca.csproj lives)
dotnet build

# Map-converter unit tests (also from the Godot project root)
python3 -m unittest discover -s scripts/tests
```

Running the game requires the **Godot 4.6 (Mono/.NET) editor**, which compiles the C# assembly and launches scenes. The Godot MCP server (`mcp__godot__*`) is available for launching the editor, running the project, and inspecting debug output. The main scene is `res://scenes/menu.tscn` (set in `project.godot`).

## Scene / flow architecture

Scene transitions are done with `GetTree().ChangeSceneToFile(...)`:

`menu.tscn` → (sets `GameSettings.LevelToLoad`, then) `main.tscn` → on death `game_over.tscn` → back to `menu.tscn`. `pause_menu.tscn` overlays gameplay.

- **`Main.cs`** (root of `main.tscn`) is the gameplay coordinator. It reads `GameSettings.LevelToLoad`, instances the level under a `LevelWrapper` node, and moves the `Player` to the level's `SpawnPoint` (a `Marker3D`). Levels are swappable scenes in `scenes/levels/` (`level_01.tscn`, `debug.tscn`). `Main.RestartStage()` reloads the current level in place (used on respawn).
- **Stage select is dynamic**: `Menu.cs` builds the level list from `res://scenes/levels/levels.json` (written by `scripts/convert_map.py`) plus a `DirAccess` scan of `scenes/levels/`. Themes (`forest`/`glacial`/`cidade`/`caverna`) filter that list and map to terrain materials in `materials/`.
- **`GameSettings.cs`** is a static (non-autoload) global holding cross-scene state: `LevelToLoad` and the selected joypad device. `ApplyJoypadSettings()` rewrites `InputMap` events to bind a chosen gamepad and pre-maps common buttons.

## Gameplay model (key conventions)

- The player is a **`CharacterBody3D` (`Player.cs`) locked to the XY plane** — `_PhysicsProcess` forcibly zeroes `Z` position and velocity every frame. This is 3D rendering with 2D-plane physics, not a 2D scene.
- `Sonic4Player2D.cs` is a `CharacterBody2D` alternate implementation that is **not referenced by any scene** — the live player is the 3D `Player`. Don't confuse the two.
- Custom physics (not Godot defaults): manual gravity, acceleration/deceleration/friction, slope force from floor normal, spin dash charging, air dash, variable jump height, rolling state. Tunable via `[Export]` fields at the top of `Player.cs`.
- Player ↔ UI communication uses the `PlayerStatsChanged(rings, score, speed, lives)` **signal**. `HUD.cs` finds the `Player` node and subscribes; gameplay objects (`Ring`, `Spring`, `DashPad`, `Enemy`) call public `Player` methods like `CollectRing()`, `ApplyBoost()`, `Hurt()`.
- **Sound effects are procedural** — generated as sine waves at runtime via `AudioStreamGenerator`/`AudioStreamGeneratorPlayback` (see `PlaySound(frequency, duration, volume)` in `Player.cs` and the audio setup duplicated in `Menu.cs`). Background music is MP3 files under `audio/`, routed through the shared "Music" bus.
- Character animations come from Mixamo FBX models (`models/paçoca-*.fbx`), each with an `AnimationPlayer` playing the `"mixamo_com"` clip. The player swaps between idle/running/jumping model nodes by toggling visibility rather than blending.

## Conventions

- `Nullable` and `ImplicitUsings` are enabled. Node references are typically `private T _x = null!;` fields assigned from `GetNode<T>(...)` in `_Ready()`.
- C# class names match their script file and are used as Godot script classes; node-path strings in `GetNode` are tightly coupled to the `.tscn` scene tree — renaming nodes in a scene requires updating these paths.
