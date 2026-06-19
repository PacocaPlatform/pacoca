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
# Templates
# --------------------------------------------------------------------------- #

TSCN_TEMPLATE = """[gd_scene format=3 uid="uid://c33r1q6joc2l{level}"]

[ext_resource type="Material" uid="uid://dbuyyv4i7g0p7" path="res://materials/grass.tres" id="1_GrassMat"]
[ext_resource type="Material" uid="uid://clhv3grjlph27" path="res://materials/rock.tres" id="2_RockMat"]
[ext_resource type="Material" path="res://materials/water.tres" id="3_WaterMat"]
[ext_resource type="Material" path="res://materials/mountain_bg.tres" id="4_MountainMat"]
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
    
    # Read ystep setting. Default is the canonical 3.0 used by the visual editor,
    # so a headerless map compiles at the same vertical scale the editor draws at.
    # Existing maps may pin a different value via the `ystep:` header (e.g. level_01).
    DEFAULT_YSTEP = 3.0
    ystep_val = settings.get("ystep") or settings.get("y_step")
    Y_STEP = float(ystep_val) if ystep_val is not None else DEFAULT_YSTEP
    
    # We will build structures by scanning the grid cells
    # Column width: 2.0 (X)
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
                
                # Compute coordinates
                width = (c_end - c_start + 1) * 2.0
                x = ((c_start + c_end) / 2.0) * 2.0
                y = r * Y_STEP
                
                # Detect if floating (r > 0 and no solid block '#' or '/' or '\' directly below it)
                is_floating = r > 0
                if is_floating:
                    for col in range(c_start, c_end + 1):
                        char_below = get_char(col, r - 1)
                        if char_below in ('#', '/', '\\'):
                            is_floating = False
                            break
                            
                platforms.append({"x": x, "y": y, "width": width, "rock_height": 1.0 if is_floating else 4.0})
            else:
                c += 1
                
    # 2. Merge ramps up '/' (diagonally up-right: c+1, r+1)
    for r in range(H):
        for c in range(W):
            if get_char(c, r) == '/' and (c, r) not in visited_ramps_up:
                # Trace diagonal chain
                chain = [(c, r)]
                visited_ramps_up.add((c, r))
                curr_c, curr_r = c, r
                while get_char(curr_c + 1, curr_r + 1) == '/':
                    curr_c += 1
                    curr_r += 1
                    chain.append((curr_c, curr_r))
                    visited_ramps_up.add((curr_c, curr_r))
                
                c_start, r_start = chain[0]
                c_end, r_end = chain[-1]
                
                width = (c_end - c_start + 1) * 2.0
                height = (r_end - r_start + 1) * Y_STEP
                start_x = c_start * 2.0 - 1.0
                start_y = (r_start - 1) * Y_STEP + 0.5
                ramps_up.append({"x": start_x, "y": start_y, "width": width, "height": height})
 
    # 3. Merge ramps down '\' (diagonally down-right: c+1, r-1)
    for r in reversed(range(H)):
        for c in range(W):
            if get_char(c, r) == '\\' and (c, r) not in visited_ramps_down:
                # Trace diagonal chain
                chain = [(c, r)]
                visited_ramps_down.add((c, r))
                curr_c, curr_r = c, r
                while get_char(curr_c + 1, curr_r - 1) == '\\':
                    curr_c += 1
                    curr_r -= 1
                    chain.append((curr_c, curr_r))
                    visited_ramps_down.add((curr_c, curr_r))
                
                c_start, r_start = chain[0]
                c_end, r_end = chain[-1]
                
                width = (c_end - c_start + 1) * 2.0
                height = (r_start - r_end + 1) * Y_STEP
                start_x = c_start * 2.0 - 1.0
                start_y = r_start * Y_STEP + 0.5
                ramps_down.append({"x": start_x, "y": start_y, "width": width, "height": height})
 
    # 4. Parse items
    for r in range(H):
        for c in range(W):
            char = get_char(c, r)
            x = c * 2.0
            
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
 
    return {
        "level": settings.get("level", "03"),
        "name": settings.get("name", "Generated Level"),
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
        rock_str = ""
        if plat.get("rock_height", 4.0) != 4.0:
            rock_str = f', rock_height={plat["rock_height"]:.2f}'
        build_lines.append(
            f'    b.add_platform("Platform_{i}", {plat["x"]:.2f}, {plat["y"]:.2f}, width={plat["width"]:.2f}{rock_str})'
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
        
    return PY_TEMPLATE.format(
        level=level_data["level"],
        name=level_data["name"],
        source_file=os.path.basename(source_file),
        spawn_x=level_data["spawn"][0],
        spawn_y=level_data["spawn"][1],
        build_code=build_code
    )

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
    print(f"Level identified: ID='{level_id}', Name='{level_name}'")
    
    # Path coordinates
    script_dir = os.path.dirname(os.path.abspath(__file__))
    py_module_path = os.path.join(script_dir, "levels", f"level_{level_id}.py")
    tscn_scene_path = os.path.join(script_dir, "..", "scenes", "levels", f"level_{level_id}.tscn")
    
    # 1. Create base scene (.tscn) if missing
    tscn_scene_path = os.path.normpath(tscn_scene_path)
    if not os.path.exists(tscn_scene_path):
        print(f"Creating base Godot scene file at '{tscn_scene_path}'...")
        os.makedirs(os.path.dirname(tscn_scene_path), exist_ok=True)
        with open(tscn_scene_path, "w", encoding="utf-8") as f:
            f.write(TSCN_TEMPLATE.format(level=level_id))
            
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
        print(f"Success! Level {level_id} compiles correctly to '{tscn_scene_path}'")
        return 0
    else:
        print("Compilation failed:")
        print(result.stderr)
        return result.returncode

if __name__ == "__main__":
    sys.exit(main())
