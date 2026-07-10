#!/usr/bin/env python3
"""Procedural content generator for the Paçoca levels.

This is a generic *engine*. The actual level content lives in per-level data
modules under ``scripts/levels/`` (``level_01.py``, ``level_02.py``, ...).
Each level module exposes:

* ``ANCHOR``       -- the first generated node tag; everything from it to EOF
                      is treated as generated and stripped/regenerated.
* ``base_edits``   -- ``(content: str) -> str`` surgical edits applied to the
                      hand-authored base scene before the generated block.
* ``build``        -- ``(b: NodeBuilder) -> None`` that emits the procedural
                      layout via the builder's ``add_*`` helpers.

The engine handles the safe parts: idempotent re-runs, loud failure on scene
drift, a ``.bak`` backup, atomic writes, and line-ending preservation.

Examples::

    python generate_level.py --level 01        # regenerate level_01.tscn
    python generate_level.py --level 02         # regenerate level_02.tscn
    python generate_level.py --level 02 --dry-run -v
"""

from __future__ import annotations

import argparse
import logging
import os
import shutil
import sys
import tempfile
import types

LOG = logging.getLogger("generate_level")


# --------------------------------------------------------------------------- #
# Node builder
# --------------------------------------------------------------------------- #
class NodeBuilder:
    """Accumulates ``.tscn`` node snippets for a level's procedural block."""

    def __init__(self) -> None:
        self.nodes: list[str] = []

    def render(self) -> str:
        return "\n".join(self.nodes)

    # -- raw escape hatch for bespoke multi-node structures ----------------- #
    def add_raw(self, snippet: str) -> None:
        self.nodes.append(snippet)

    # -- terrain ------------------------------------------------------------ #
    def add_platform(self, name, x, y, width, rock_height=4.0, grass=True):
        # Top slab: grass for exposed (walkable) surfaces, rock for interior
        # wall blocks so stacked columns read as one solid wall.
        top_material = "1_GrassMat" if grass else "2_RockMat"
        self.nodes.append(f"""
[node name="{name}" type="CSGBox3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
size = Vector3({width:.2f}, 1, 4)
material = ExtResource("{top_material}")
""")
        # Sub rock structure
        rock_y = y - 0.5 - (rock_height / 2.0)
        self.nodes.append(f"""
[node name="{name}Rock" type="CSGBox3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {rock_y:.2f}, 0)
size = Vector3({width:.2f}, {rock_height:.2f}, 3.8)
material = ExtResource("2_RockMat")
""")

    def add_ramp_up(self, name, start_x, start_y, width, height, bottom=-2.0):
        # Grass cap: 1.0m vertical thickness parallel slab
        self.nodes.append(f"""
[node name="{name}" type="CSGPolygon3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {start_x:.2f}, {start_y:.2f}, 2)
polygon = PackedVector2Array(0, 0, {width:.2f}, {height:.2f}, {width:.2f}, {height - 1.0:.2f}, 0, -1.0)
depth = 4.0
material = ExtResource("1_GrassMat")
""")
        # Sub rock base
        self.nodes.append(f"""
[node name="{name}SubRock" type="CSGPolygon3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {start_x:.2f}, {start_y:.2f}, 1.9)
polygon = PackedVector2Array(0, -1.0, {width:.2f}, {height - 1.0:.2f}, {width:.2f}, {bottom:.2f}, 0, {bottom:.2f})
depth = 3.8
material = ExtResource("2_RockMat")
""")

    def add_ramp_down(self, name, start_x, start_y, width, height, bottom=-3.0):
        end_y = start_y - height
        # Grass cap: 1.0m vertical thickness parallel slab
        self.nodes.append(f"""
[node name="{name}" type="CSGPolygon3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {start_x:.2f}, {end_y:.2f}, 2)
polygon = PackedVector2Array(0, {height:.2f}, {width:.2f}, 0, {width:.2f}, -1.0, 0, {height - 1.0:.2f})
depth = 4.0
material = ExtResource("1_GrassMat")
""")
        # Sub rock base
        self.nodes.append(f"""
[node name="{name}SubRock" type="CSGPolygon3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {start_x:.2f}, {end_y:.2f}, 1.9)
polygon = PackedVector2Array(0, {height - 1.0:.2f}, {width:.2f}, -1.0, {width:.2f}, {bottom:.2f}, 0, {bottom:.2f})
depth = 3.8
material = ExtResource("2_RockMat")
""")

    # -- interactive objects ------------------------------------------------ #
    def add_ring(self, name, x, y):
        self.nodes.append(f"""
[node name="{name}" parent="InteractiveObjects/Rings" instance=ExtResource("5_RingScene")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
""")

    def add_spring_vert(self, name, x, y, force=22.0):
        self.nodes.append(f"""
[node name="{name}" parent="InteractiveObjects" instance=ExtResource("6_SpringScene")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
""")

    def add_spring_diag(self, name, x, y, force=25.0, dx=1.2, dy=1.5, lock=0.6):
        self.nodes.append(f"""
[node name="{name}" parent="InteractiveObjects" instance=ExtResource("6_SpringScene")]
transform = Transform3D(0.965926, -0.258819, 0, 0.258819, 0.965926, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
LaunchDirection = Vector3({dx:.2f}, {dy:.2f}, 0)
ControlLockDuration = {lock:.2f}
""")

    def add_dash_pad(self, name, x, y):
        self.nodes.append(f"""
[node name="{name}" parent="InteractiveObjects" instance=ExtResource("7_DashPadScene")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
""")

    def add_enemy(self, name, x, y, speed=3.0):
        self.nodes.append(f"""
[node name="{name}" parent="InteractiveObjects/Enemies" instance=ExtResource("8_EnemyScene")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
Speed = {speed:.2f}
""")

    def add_cactus(self, name, x, y, speed=1.25):
        self.nodes.append(f"""
[node name="{name}" parent="InteractiveObjects/Enemies" instance=ExtResource("9_CactusEnemyScene")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
Speed = {speed:.2f}
""")

    def add_spikes(self, name, x, y):
        self.nodes.append(f"""
[node name="{name}" parent="InteractiveObjects" instance=ExtResource("10_SpikesScene")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
""")

    def add_level_finish(self, name, x, y):
        self.nodes.append(f"""
[node name="{name}" parent="InteractiveObjects" instance=ExtResource("11_LevelFinishScene")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
""")

    def add_moving_platform(self, name, x, y, direction="horizontal", travel_range=4.0, speed=2.0, width=2.0, rock_height=4.0, initial_direction="default", invert_on_collision=True, use_range_limit=False):
        self.nodes.append(f"""
[node name="{name}" parent="InteractiveObjects" instance=ExtResource("12_MovingPlatformScene")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, {x:.2f}, {y:.2f}, 0)
direction = "{direction}"
travel_range = {travel_range:.2f}
speed = {speed:.2f}
width = {width:.2f}
rock_height = {rock_height:.2f}
initial_direction = "{initial_direction}"
invert_on_collision = {str(invert_on_collision).lower()}
use_range_limit = {str(use_range_limit).lower()}
top_material = ExtResource("1_GrassMat")
rock_material = ExtResource("2_RockMat")
""")


# --------------------------------------------------------------------------- #
# Safe text surgery (shared with level modules)
# --------------------------------------------------------------------------- #
def safe_replace(content: str, old: str, new: str, *, label: str) -> str:
    """Replace ``old`` with ``new``, raising if ``old`` is not present."""
    if old not in content:
        raise ValueError(f"[{label}] expected snippet not found in scene")
    return content.replace(old, new)


def apply_modification(content: str, old: str, new: str, *, label: str) -> str:
    """Idempotently move the scene from ``old`` to ``new``.

    * ``new`` already present -> nothing to do.
    * ``old`` present         -> replace it with ``new``.
    * neither present         -> the scene drifted; fail loudly.
    """
    if new in content:
        LOG.debug("[%s] already applied, skipping", label)
        return content
    if old in content:
        LOG.debug("[%s] applying", label)
        return content.replace(old, new)
    raise ValueError(
        f"[{label}] neither the old nor the new snippet was found; "
        "the base scene may have changed"
    )


def strip_generated(content: str, anchor: str) -> str:
    """Remove the previously generated tail, if any."""
    idx = content.find(anchor)
    if idx == -1:
        return content
    LOG.info("Detected previous generation; stripping old generated block")
    return content[:idx].rstrip()


# --------------------------------------------------------------------------- #
# Level module loading
# --------------------------------------------------------------------------- #
def scene_path_for(level: str) -> str:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(
        os.path.join(
            script_dir, "..", "scenes", "levels", f"level_{level}.tscn"
        )
    )


def load_level_module(level: str):
    """Load levels/level_<id>.py by executing its source directly.

    A normal import would go through the bytecode cache (__pycache__), whose
    mtime check has 1-second granularity — when the editor recompiles quickly,
    the freshly rewritten module would silently run stale code.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if script_dir not in sys.path:
        sys.path.insert(0, script_dir)  # for `from generate_level import ...`
    path = os.path.join(script_dir, "levels", f"level_{level}.py")
    if not os.path.exists(path):
        raise ValueError(f"no level definition module for level '{level}'")
    module = types.ModuleType(f"levels.level_{level}")
    module.__file__ = path
    with open(path, "r", encoding="utf-8") as f:
        source = f.read()
    exec(compile(source, path, "exec"), module.__dict__)
    return module


def build_scene(content: str, module) -> str:
    content = strip_generated(content, module.ANCHOR)
    content = module.base_edits(content)
    builder = NodeBuilder()
    module.build(builder)
    # rstrip so a first (fresh-scaffold) run matches subsequent (stripped) runs.
    return content.rstrip() + "\n" + builder.render()


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #
def detect_newline(path: str) -> str:
    """Return the dominant line ending of an existing file ("\\r\\n" or "\\n")."""
    with open(path, "rb") as f:
        sample = f.read()
    return "\r\n" if b"\r\n" in sample else "\n"


def write_atomic(path: str, content: str, *, backup: bool, newline: str = "\n") -> None:
    if backup and os.path.exists(path):
        bak = path + ".bak"
        shutil.copy2(path, bak)
        LOG.info("Backup written to %s", bak)

    directory = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline=newline) as f:
            f.write(content)
        os.replace(tmp, path)
    except BaseException:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def parse_args(argv=None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--level", default="01",
        help="Level id to generate (e.g. 01, 02). Picks the matching scene "
        "and levels/level_<id>.py module. Default: 01",
    )
    parser.add_argument(
        "-i", "--input", default=None,
        help="Override the source .tscn path (default: derived from --level)",
    )
    parser.add_argument(
        "-o", "--output", default=None,
        help="Where to write the result (default: overwrite the input)",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute the result but do not write anything",
    )
    parser.add_argument(
        "--no-backup", action="store_true",
        help="Do not write a .bak backup before overwriting",
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug logging",
    )
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    try:
        module = load_level_module(args.level)
    except ValueError as exc:
        LOG.error("%s", exc)
        return 1

    input_path = os.path.abspath(args.input) if args.input else scene_path_for(args.level)
    output_path = os.path.abspath(args.output) if args.output else input_path

    LOG.info("Reading from: %s", input_path)
    if not os.path.exists(input_path):
        LOG.error("Could not find scene file at %s", input_path)
        return 1

    with open(input_path, "r", encoding="utf-8") as f:
        content = f.read()

    try:
        result = build_scene(content, module)
    except ValueError as exc:
        LOG.error("Generation aborted: %s", exc)
        return 1

    if args.dry_run:
        LOG.info("Dry run: %d chars would be written to %s", len(result), output_path)
        return 0

    newline = detect_newline(input_path)
    write_atomic(output_path, result, backup=not args.no_backup, newline=newline)
    LOG.info("Level %s generated successfully -> %s", args.level, output_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
