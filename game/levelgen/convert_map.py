#!/usr/bin/env python3
"""Map converter for Paçoca.

Converts an ASCII visual text map or a JSON layout into a Python level module,
generates the base scene if missing, and compiles it into a playable Godot .tscn file.
"""

from __future__ import annotations
import argparse
import json
import os
import re
import subprocess
import sys

# --------------------------------------------------------------------------- #
# Themes
# --------------------------------------------------------------------------- #
# A map can declare `theme: <name>` in its header (or "theme" in JSON) to swap
# the terrain materials. The walkable-top material keeps the id "1_GrassMat"
# and the base keeps "2_RockMat" so recompiles can retarget existing scenes.

THEMES = {
    "forest": {
        "top": "res://materials/grass.tres",
        "rock": "res://materials/rock.tres",
        "bg": "res://materials/bg_forest.tres",
    },
    "glacial": {
        "top": "res://materials/glacial_top.tres",
        "rock": "res://materials/glacial_rock.tres",
        "bg": "res://materials/bg_glacial.tres",
    },
    "cidade": {
        "top": "res://materials/cidade_top.tres",
        "rock": "res://materials/cidade_rock.tres",
        "bg": "res://materials/bg_cidade.tres",
    },
    "caverna": {
        "top": "res://materials/caverna_top.tres",
        "rock": "res://materials/caverna_rock.tres",
        "bg": "res://materials/bg_caverna.tres",
    },
}
DEFAULT_THEME = "forest"

# --------------------------------------------------------------------------- #
# Templates
# --------------------------------------------------------------------------- #

TSCN_TEMPLATE = """[gd_scene format=3 uid="uid://c33r1q6joc2l{level}"]

[ext_resource type="Material" path="{top_mat}" id="1_GrassMat"]
[ext_resource type="Material" path="{rock_mat}" id="2_RockMat"]
[ext_resource type="Material" path="res://materials/water.tres" id="3_WaterMat"]
[ext_resource type="Material" path="{bg_mat}" id="4_MountainMat"]
[ext_resource type="PackedScene" path="res://scenes/ring.tscn" id="5_RingScene"]
[ext_resource type="PackedScene" path="res://scenes/spring.tscn" id="6_SpringScene"]
[ext_resource type="PackedScene" path="res://scenes/dash_pad.tscn" id="7_DashPadScene"]
[ext_resource type="PackedScene" path="res://scenes/enemy.tscn" id="8_EnemyScene"]
[ext_resource type="PackedScene" path="res://scenes/cactus_enemy.tscn" id="9_CactusEnemyScene"]
[ext_resource type="PackedScene" path="res://scenes/spikes.tscn" id="10_SpikesScene"]
[ext_resource type="PackedScene" path="res://scenes/level_finish.tscn" id="11_LevelFinishScene"]

[sub_resource type="BoxMesh" id="BoxMesh_water"]
material = ExtResource("3_WaterMat")
size = Vector3(5000, 2, 8)

[sub_resource type="QuadMesh" id="QuadMesh_mountain"]
material = ExtResource("4_MountainMat")
size = Vector2(5000, 120)

[node name="Level{level}" type="Node3D"]

[node name="SpawnPoint" type="Marker3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -12, 1.5, 0)

[node name="Level" type="Node3D" parent="."]

[node name="TrackCSG" type="CSGCombiner3D" parent="Level"]
use_collision = true

[node name="WaterPlane" type="MeshInstance3D" parent="Level"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1000, -7.5, 0)
mesh = SubResource("BoxMesh_water")

[node name="BG_Mountains" type="MeshInstance3D" parent="Level"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1000, 15, -22)
mesh = SubResource("QuadMesh_mountain")

[node name="InteractiveObjects" type="Node3D" parent="."]

[node name="Rings" type="Node3D" parent="InteractiveObjects"]

[node name="Enemies" type="Node3D" parent="InteractiveObjects"]

[node name="Platform_0" type="CSGBox3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, -100, -100, 0)
size = Vector3(1, 1, 1)
material = ExtResource("1_GrassMat")
"""

PY_TEMPLATE = '''"""Generated level definition for level {level} ("{name}").
Generated automatically from {source_file}. Do not edit directly if you want to keep changes synced!
"""

from __future__ import annotations
import re
from generate_level import NodeBuilder, apply_modification

ANCHOR = '[node name="Platform_0"'

def base_edits(content: str) -> str:
    # Safely position the SpawnPoint
    spawn_pattern = r'(\\[node name="SpawnPoint"[^\\]]*\\]\\s*\\ntransform = Transform3D\\(1, 0, 0, 0, 1, 0, 0, 0, 1, )([^,]+), ([^,]+), ([^\\)]+)'
    spawn_replacement = rf'\\g<1>{spawn_x:.2f}, {spawn_y:.2f}, 0'
    content = re.sub(spawn_pattern, spawn_replacement, content)
    # Retarget the theme materials (idempotent; also updates scenes created
    # before the theme changed).
    content = re.sub(r'\\[ext_resource type="Material"[^\\]]*id="1_GrassMat"\\]',
                     '[ext_resource type="Material" path="{top_mat}" id="1_GrassMat"]', content)
    content = re.sub(r'\\[ext_resource type="Material"[^\\]]*id="2_RockMat"\\]',
                     '[ext_resource type="Material" path="{rock_mat}" id="2_RockMat"]', content)
    content = re.sub(r'\\[ext_resource type="Material"[^\\]]*id="4_MountainMat"\\]',
                     '[ext_resource type="Material" path="{bg_mat}" id="4_MountainMat"]', content)
    return content

def build(b: NodeBuilder) -> None:
{build_code}
'''

# --------------------------------------------------------------------------- #
# Grid parser
# --------------------------------------------------------------------------- #

def parse_ascii_grid(lines: list[str]) -> dict:
    """Parses visual ASCII grid layout and returns structured level objects."""
    # Find grid start
    grid_lines = []
    settings = {}
    
    in_grid = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_grid:
                grid_lines.append(line)
            continue
        
        if stripped == "[grid]":
            in_grid = True
            continue
        
        if in_grid:
            grid_lines.append(line)
        else:
            # Parse settings
            if ":" in line:
                key, val = line.split(":", 1)
                settings[key.strip().lower()] = val.strip()
    
    # Process grid
    if not grid_lines:
        raise ValueError("Grid section '[grid]' not found or empty.")
    
    # Grid coordinates: bottom-most non-empty line is Y = 0
    # Let's remove trailing empty lines at the bottom of the grid
    while grid_lines and not grid_lines[-1].strip():
        grid_lines.pop()
        
    H = len(grid_lines)
    if H == 0:
        raise ValueError("Grid is empty.")
    
    # Find max width
    W = max(len(line) for line in grid_lines)
    
    # Pad all lines to same width
    padded_grid = [line.ljust(W) for line in grid_lines]
    
    # Read ystep and xstep settings. Defaults are the canonical 3.0 and 2.0.
    DEFAULT_YSTEP = 3.0
    ystep_val = settings.get("ystep") or settings.get("y_step")
    Y_STEP = float(ystep_val) if ystep_val is not None else DEFAULT_YSTEP
    
    DEFAULT_XSTEP = 2.0
    xstep_val = settings.get("xstep") or settings.get("x_step")
    X_STEP = float(xstep_val) if xstep_val is not None else DEFAULT_XSTEP
    
    # We will build structures by scanning the grid cells
    # Column width: X_STEP (X)
    # Row height: Y_STEP (Y)
    
    platforms = []
    ramps_up = []
    ramps_down = []
    rings = []
    springs_vert = []
    springs_diag = []
    dash_pads = []
    enemies = []
    cactus_enemies = []
    spikes = []
    goals = []
    spawn = None
    
    visited_hashes = set()
    visited_ramps_up = set()
    visited_ramps_down = set()
    
    # Helper to get char at (c, r) where r=0 is bottom
    def get_char(c, r):
        if c < 0 or c >= W or r < 0 or r >= H:
            return ' '
        line_idx = H - 1 - r
        return padded_grid[line_idx][c]
    
    # 1. Merge standard platforms '#'
    # A horizontal run is split into segments by "exposure": cells with another
    # '#' directly above are interior wall blocks and get a rock top instead of
    # a grass cap, so stacked columns render as a solid rock wall rather than a
    # pile of grass-striped platforms.
    for r in range(H):
        c = 0
        while c < W:
            if get_char(c, r) == '#' and (c, r) not in visited_hashes:
                # Start merging horizontally
                c_start = c
                while c < W and get_char(c, r) == '#':
                    visited_hashes.add((c, r))
                    c += 1
                c_end = c - 1

                y = r * Y_STEP

                # Split the run into segments with uniform exposure
                seg_start = c_start
                while seg_start <= c_end:
                    exposed = get_char(seg_start, r + 1) != '#'
                    seg_end = seg_start
                    while seg_end + 1 <= c_end and (get_char(seg_end + 1, r + 1) != '#') == exposed:
                        seg_end += 1

                    width = (seg_end - seg_start + 1) * X_STEP
                    x = ((seg_start + seg_end) / 2.0) * X_STEP

                    # Detect if floating (r > 0 and no solid block '#' or '/' or '\' directly below it)
                    is_floating = r > 0
                    if is_floating:
                        for col in range(seg_start, seg_end + 1):
                            char_below = get_char(col, r - 1)
                            if char_below in ('#', '/', '\\'):
                                is_floating = False
                                break

                    platforms.append({
                        "x": x, "y": y, "width": width,
                        "rock_height": 1.0 if is_floating else 4.0,
                        "grass": exposed,
                    })
                    seg_start = seg_end + 1
            else:
                c += 1
                
    # 2. Merge ramps up '/'
    # Two shapes are supported:
    #   * Diagonal chains (c+1, r+1): steep ramps rising Y_STEP per column.
    #   * Horizontal runs on the same row ("///"): ONE gentle ramp rising a
    #     single row over the whole run. This is the recommended way to draw
    #     walkable slopes at the default scale (a 1-cell diagonal step is ~56
    #     degrees; three cells in a row is ~27 degrees).
    for r in range(H):
        for c in range(W):
            if get_char(c, r) == '/' and (c, r) not in visited_ramps_up:
                # Trace diagonal chain
                chain = [(c, r)]
                curr_c, curr_r = c, r
                while get_char(curr_c + 1, curr_r + 1) == '/':
                    curr_c += 1
                    curr_r += 1
                    chain.append((curr_c, curr_r))
                if len(chain) < 2:
                    continue  # lone '/': handled by the horizontal pass below
                visited_ramps_up.update(chain)

                c_start, r_start = chain[0]
                c_end, r_end = chain[-1]

                width = (c_end - c_start + 1) * X_STEP
                height = (r_end - r_start + 1) * Y_STEP
                start_x = c_start * X_STEP - (X_STEP / 2.0)
                start_y = (r_start - 1) * Y_STEP + 0.5
                ramps_up.append({"x": start_x, "y": start_y, "width": width, "height": height})

    # 2b. Horizontal runs of remaining '/': one ramp rising one row over the run
    for r in range(H):
        c = 0
        while c < W:
            if get_char(c, r) == '/' and (c, r) not in visited_ramps_up:
                c_start = c
                while c < W and get_char(c, r) == '/' and (c, r) not in visited_ramps_up:
                    visited_ramps_up.add((c, r))
                    c += 1
                c_end = c - 1
                width = (c_end - c_start + 1) * X_STEP
                start_x = c_start * X_STEP - (X_STEP / 2.0)
                start_y = (r - 1) * Y_STEP + 0.5
                ramps_up.append({"x": start_x, "y": start_y, "width": width, "height": Y_STEP})
            else:
                c += 1

    # 3. Merge ramps down '\' (diagonal chains c+1, r-1; then horizontal runs)
    for r in reversed(range(H)):
        for c in range(W):
            if get_char(c, r) == '\\' and (c, r) not in visited_ramps_down:
                # Trace diagonal chain
                chain = [(c, r)]
                curr_c, curr_r = c, r
                while get_char(curr_c + 1, curr_r - 1) == '\\':
                    curr_c += 1
                    curr_r -= 1
                    chain.append((curr_c, curr_r))
                if len(chain) < 2:
                    continue  # lone '\': handled by the horizontal pass below
                visited_ramps_down.update(chain)

                c_start, r_start = chain[0]
                c_end, r_end = chain[-1]

                width = (c_end - c_start + 1) * X_STEP
                height = (r_start - r_end + 1) * Y_STEP
                start_x = c_start * X_STEP - (X_STEP / 2.0)
                start_y = r_start * Y_STEP + 0.5
                ramps_down.append({"x": start_x, "y": start_y, "width": width, "height": height})

    # 3b. Horizontal runs of remaining '\': one ramp falling one row over the run
    for r in range(H):
        c = 0
        while c < W:
            if get_char(c, r) == '\\' and (c, r) not in visited_ramps_down:
                c_start = c
                while c < W and get_char(c, r) == '\\' and (c, r) not in visited_ramps_down:
                    visited_ramps_down.add((c, r))
                    c += 1
                c_end = c - 1
                width = (c_end - c_start + 1) * X_STEP
                start_x = c_start * X_STEP - (X_STEP / 2.0)
                start_y = r * Y_STEP + 0.5
                ramps_down.append({"x": start_x, "y": start_y, "width": width, "height": Y_STEP})
            else:
                c += 1
 
    # 4. Parse items
    warnings = []
    OBJECT_CHARS = "oVFD>ECSPG"
    for r in range(H):
        for c in range(W):
            char = get_char(c, r)
            x = c * X_STEP

            # Objects anchor to the row BELOW them; on the bottom row that means
            # below Y=0 (buried under the ground / in the water).
            if r == 0 and char in OBJECT_CHARS:
                warnings.append(
                    f"'{char}' at column {c} is on the bottom row: it will spawn below Y=0. "
                    "Draw objects one row above the surface they should sit on."
                )

            if char == 'o': # Ring
                rings.append([x, (r - 1) * Y_STEP + 1.2])
            elif char == 'V': # Vertical Spring
                springs_vert.append({"x": x, "y": (r - 1) * Y_STEP + 0.5, "force": 22.0})
            elif char == 'F': # Diagonal Spring (Forward)
                springs_diag.append({"x": x, "y": (r - 1) * Y_STEP + 0.5, "force": 25.0, "dx": 1.2, "dy": 1.5, "lock": 0.6})
            elif char in ('>', 'D'): # Dash Pad
                dash_pads.append([x, (r - 1) * Y_STEP + 0.5])
            elif char == 'E': # Enemy
                enemies.append({"x": x, "y": (r - 1) * Y_STEP + 1.0, "speed": 3.0})
            elif char == 'C': # Cactus Enemy
                cactus_enemies.append({"x": x, "y": (r - 1) * Y_STEP + 1.0, "speed": 1.25})
            elif char == 'S': # Spikes
                spikes.append([x, (r - 1) * Y_STEP + 0.5])
            elif char == 'P': # Player Spawn
                spawn = [x, (r - 1) * Y_STEP + 1.5]
            elif char == 'G': # Goal / Level Finish
                goals.append([x, (r - 1) * Y_STEP + 2.0])
                
    # If no spawn point was specified, place it default
    if spawn is None:
        spawn = [0.0, 1.5]
        warnings.append("no 'P' (player spawn) in the map: using default spawn at (0.0, 1.5).")
    if not goals:
        warnings.append("no 'G' (goal coin) in the map: the level cannot be completed.")
    if not platforms and not ramps_up and not ramps_down:
        warnings.append("the map has no solid ground ('#', '/' or '\\'): the player will fall into the void.")

    return {
        "warnings": warnings,
        "level": settings.get("level", "03"),
        "name": settings.get("name", "Generated Level"),
        "theme": settings.get("theme", DEFAULT_THEME),
        "spawn": spawn,
        "platforms": platforms,
        "ramps_up": ramps_up,
        "ramps_down": ramps_down,
        "rings": rings,
        "springs_vert": springs_vert,
        "springs_diag": springs_diag,
        "dash_pads": dash_pads,
        "enemies": enemies,
        "cactus_enemies": cactus_enemies,
        "spikes": spikes,
        "goals": goals
    }

# --------------------------------------------------------------------------- #
# Code Generator
# --------------------------------------------------------------------------- #

def generate_python_module(level_data: dict, source_file: str) -> str:
    """Builds the python code block contents using templates and node lists."""
    build_lines = []
    
    # 1. Platforms
    for i, plat in enumerate(level_data["platforms"]):
        extra = ""
        if plat.get("rock_height", 4.0) != 4.0:
            extra += f', rock_height={plat["rock_height"]:.2f}'
        if not plat.get("grass", True):
            extra += ', grass=False'
        build_lines.append(
            f'    b.add_platform("Platform_{i}", {plat["x"]:.2f}, {plat["y"]:.2f}, width={plat["width"]:.2f}{extra})'
        )
        
    # 2. Ramps Up
    for i, ramp in enumerate(level_data["ramps_up"]):
        build_lines.append(
            f'    b.add_ramp_up("RampUp_{i}", {ramp["x"]:.2f}, {ramp["y"]:.2f}, width={ramp["width"]:.2f}, height={ramp["height"]:.2f})'
        )
        
    # 3. Ramps Down
    for i, ramp in enumerate(level_data["ramps_down"]):
        build_lines.append(
            f'    b.add_ramp_down("RampDown_{i}", {ramp["x"]:.2f}, {ramp["y"]:.2f}, width={ramp["width"]:.2f}, height={ramp["height"]:.2f})'
        )
        
    # 4. Rings
    for i, ring in enumerate(level_data["rings"]):
        build_lines.append(
            f'    b.add_ring("Ring_{i}", {ring[0]:.2f}, {ring[1]:.2f})'
        )
        
    # 5. Springs Vertical
    for i, spring in enumerate(level_data["springs_vert"]):
        build_lines.append(
            f'    b.add_spring_vert("SpringV_{i}", {spring["x"]:.2f}, {spring["y"]:.2f}, force={spring["force"]:.2f})'
        )
        
    # 6. Springs Diagonal
    for i, spring in enumerate(level_data["springs_diag"]):
        build_lines.append(
            f'    b.add_spring_diag("SpringD_{i}", {spring["x"]:.2f}, {spring["y"]:.2f}, force={spring["force"]:.2f}, '
            f'dx={spring["dx"]:.2f}, dy={spring["dy"]:.2f}, lock={spring["lock"]:.2f})'
        )
        
    # 7. Dash Pads
    for i, pad in enumerate(level_data["dash_pads"]):
        build_lines.append(
            f'    b.add_dash_pad("DashPad_{i}", {pad[0]:.2f}, {pad[1]:.2f})'
        )
        
    # 8. Enemies
    for i, enemy in enumerate(level_data["enemies"]):
        build_lines.append(
            f'    b.add_enemy("Enemy_{i}", {enemy["x"]:.2f}, {enemy["y"]:.2f}, speed={enemy["speed"]:.2f})'
        )
        
    # 9. Cactus Enemies
    for i, enemy in enumerate(level_data["cactus_enemies"]):
        build_lines.append(
            f'    b.add_cactus("Cactus_{i}", {enemy["x"]:.2f}, {enemy["y"]:.2f}, speed={enemy["speed"]:.2f})'
        )
        
    # 10. Spikes
    for i, spike in enumerate(level_data["spikes"]):
        build_lines.append(
            f'    b.add_spikes("Spikes_{i}", {spike[0]:.2f}, {spike[1]:.2f})'
        )
        
    # 11. Goals
    if "goals" in level_data:
        for i, goal in enumerate(level_data["goals"]):
            build_lines.append(
                f'    b.add_level_finish("Goal_{i}", {goal[0]:.2f}, {goal[1]:.2f})'
            )
        
    build_code = "\n".join(build_lines)
    if not build_code:
        build_code = "    pass"
        
    theme = THEMES.get(level_data.get("theme", DEFAULT_THEME), THEMES[DEFAULT_THEME])
    return PY_TEMPLATE.format(
        level=level_data["level"],
        name=level_data["name"],
        source_file=os.path.basename(source_file),
        spawn_x=level_data["spawn"][0],
        spawn_y=level_data["spawn"][1],
        top_mat=theme["top"],
        rock_mat=theme["rock"],
        bg_mat=theme["bg"],
        build_code=build_code
    )

# --------------------------------------------------------------------------- #
# Level manifest (levels.json)
# --------------------------------------------------------------------------- #

def is_builtin_level(script_dir: str, level_id: str) -> bool:
    """True when the manifest flags this level id as builtin (shipped)."""
    manifest_path = os.path.normpath(
        os.path.join(script_dir, "..", "scenes", "levels", "levels.json")
    )
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f) or {}
    except (OSError, ValueError):
        return False
    return any(
        e.get("id") == level_id and e.get("builtin")
        for e in data.get("levels", [])
    )


def update_manifest(script_dir: str, level_id: str, level_name: str, theme: str) -> str:
    """Upsert this level in scenes/levels/levels.json (read by the game menu).

    Levels shipped with the game carry ``"builtin": true`` in the manifest.
    Anything compiled by the map editor lands as a custom level
    (``"builtin": false``) and shows up under the menu's custom-levels list;
    recompiling an existing builtin level keeps it builtin.
    """
    manifest_path = os.path.normpath(
        os.path.join(script_dir, "..", "scenes", "levels", "levels.json")
    )
    data = {"levels": []}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                data = json.load(f) or {}
        except (OSError, ValueError):
            data = {}
    levels = data.setdefault("levels", [])

    entry = {
        "id": level_id,
        "name": level_name,
        "theme": theme,
        "scene": f"res://scenes/levels/level_{level_id}.tscn",
        "builtin": False,
    }
    for i, existing in enumerate(levels):
        if existing.get("id") == level_id:
            entry["builtin"] = bool(existing.get("builtin", False))
            levels[i] = entry
            break
    else:
        levels.append(entry)
    levels.sort(key=lambda e: str(e.get("id", "")))

    with open(manifest_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    return manifest_path


# --------------------------------------------------------------------------- #
# Main CLI entry point
# --------------------------------------------------------------------------- #

def main() -> int:
    parser = argparse.ArgumentParser(description="Convert Paçoca Text/JSON Maps into Godot levels.")
    parser.add_argument(
        "-i", "--input", required=True,
        help="Path to the input text map (.txt) or structured map (.json)",
    )
    parser.add_argument(
        "--level", default=None,
        help="Level ID override (e.g. 03). If not provided, read from file settings or defaulted.",
    )
    args = parser.parse_args()
    
    input_path = os.path.abspath(args.input)
    if not os.path.exists(input_path):
        print(f"Error: Input file '{input_path}' does not exist.")
        return 1
        
    # Load level data
    print(f"Parsing map from '{input_path}'...")
    try:
        if input_path.endswith(".json"):
            with open(input_path, "r", encoding="utf-8") as f:
                level_data = json.load(f)
            # Normalize platforms to have rock_height
            for plat in level_data.get("platforms", []):
                if "rock_height" not in plat:
                    is_floating = plat["y"] > 0.0
                    if is_floating:
                        plat_x_min = plat["x"] - plat["width"] / 2.0
                        plat_x_max = plat["x"] + plat["width"] / 2.0
                        for other in level_data.get("platforms", []):
                            if other == plat:
                                continue
                            other_x_min = other["x"] - other["width"] / 2.0
                            other_x_max = other["x"] + other["width"] / 2.0
                            if not (plat_x_max <= other_x_min or plat_x_min >= other_x_max):
                                if other["y"] < plat["y"] and other["y"] >= plat["y"] - 5.0:
                                    is_floating = False
                                    break
                    plat["rock_height"] = 1.0 if is_floating else 4.0
            level_data.setdefault("warnings", [])
            if not level_data.get("goals"):
                level_data["warnings"].append("no goal in the map: the level cannot be completed.")
            if not level_data.get("spawn"):
                level_data["warnings"].append("no spawn in the map: using the scene default.")
        else:
            with open(input_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            level_data = parse_ascii_grid(lines)
    except Exception as e:
        print(f"Error parsing map file: {e}")
        return 1
        
    # Override level ID if supplied
    if args.level:
        level_data["level"] = args.level

    level_id = level_data["level"]
    level_name = level_data["name"]

    theme = str(level_data.get("theme") or DEFAULT_THEME).strip().lower()
    if theme not in THEMES:
        level_data.setdefault("warnings", []).append(
            f"unknown theme '{theme}' (available: {', '.join(sorted(THEMES))}); using '{DEFAULT_THEME}'."
        )
        theme = DEFAULT_THEME
    level_data["theme"] = theme

    print(f"Level identified: ID='{level_id}', Name='{level_name}', Theme='{theme}'")

    script_dir = os.path.dirname(os.path.abspath(__file__))
    if is_builtin_level(script_dir, level_id):
        level_data.setdefault("warnings", []).append(
            f"level ID '{level_id}' is a BUILTIN level shipped with the game — compiling "
            "OVERWRITES it (and it stays under its theme, not in the custom list). "
            "Change the Level ID in the editor to create a custom level."
        )

    counts = {
        "platforms": len(level_data.get("platforms", [])),
        "ramps": len(level_data.get("ramps_up", [])) + len(level_data.get("ramps_down", [])),
        "rings": len(level_data.get("rings", [])),
        "enemies": len(level_data.get("enemies", [])) + len(level_data.get("cactus_enemies", [])),
        "goals": len(level_data.get("goals", [])),
    }
    print("Contents: " + ", ".join(f"{v} {k}" for k, v in counts.items()))

    for warning in level_data.get("warnings", []):
        print(f"WARNING: {warning}")
    
    # Path coordinates
    py_module_path = os.path.join(script_dir, "levels", f"level_{level_id}.py")
    tscn_scene_path = os.path.join(script_dir, "..", "scenes", "levels", f"level_{level_id}.tscn")
    
    # 1. Create base scene (.tscn) if missing
    tscn_scene_path = os.path.normpath(tscn_scene_path)
    if not os.path.exists(tscn_scene_path):
        print(f"Creating base Godot scene file at '{tscn_scene_path}'...")
        os.makedirs(os.path.dirname(tscn_scene_path), exist_ok=True)
        theme_mats = THEMES[theme]
        with open(tscn_scene_path, "w", encoding="utf-8") as f:
            f.write(TSCN_TEMPLATE.format(
                level=level_id,
                top_mat=theme_mats["top"],
                rock_mat=theme_mats["rock"],
                bg_mat=theme_mats["bg"],
            ))
            
    # 2. Generate Python level module script
    print(f"Generating Python level module at '{py_module_path}'...")
    py_content = generate_python_module(level_data, input_path)
    os.makedirs(os.path.dirname(py_module_path), exist_ok=True)
    with open(py_module_path, "w", encoding="utf-8") as f:
        f.write(py_content)
        
    # 3. Invoke procedural builder (generate_level.py) to compile it
    print(f"Compiling Level {level_id} to scene...")
    gen_script = os.path.join(script_dir, "generate_level.py")
    cmd = [sys.executable, gen_script, "--level", level_id]
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode == 0:
        print(result.stdout.strip())
        manifest_path = update_manifest(script_dir, level_id, level_name, theme)
        print(f"Manifest updated: '{manifest_path}'")
        print(f"Success! Level {level_id} compiles correctly to '{tscn_scene_path}'")
        return 0
    else:
        print("Compilation failed:")
        print(result.stderr)
        return result.returncode

if __name__ == "__main__":
    sys.exit(main())
