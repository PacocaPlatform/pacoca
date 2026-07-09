"""Generated level definition for level testmplat ("Test Moving Platform").
Generated automatically from test_mplat_map.txt. Do not edit directly if you want to keep changes synced!
"""

from __future__ import annotations
import re
from generate_level import NodeBuilder, apply_modification

ANCHOR = '[node name="Platform_0"'

def base_edits(content: str) -> str:
    # Safely position the SpawnPoint
    spawn_pattern = r'(\[node name="SpawnPoint"[^\]]*\]\s*\ntransform = Transform3D\(1, 0, 0, 0, 1, 0, 0, 0, 1, )([^,]+), ([^,]+), ([^\)]+)'
    spawn_replacement = rf'\g<1>6.00, 1.50, 0'
    content = re.sub(spawn_pattern, spawn_replacement, content)
    # Retarget the theme materials (idempotent; also updates scenes created
    # before the theme changed).
    content = re.sub(r'\[ext_resource type="Material"[^\]]*id="1_GrassMat"\]',
                     '[ext_resource type="Material" path="res://materials/grass.tres" id="1_GrassMat"]', content)
    content = re.sub(r'\[ext_resource type="Material"[^\]]*id="2_RockMat"\]',
                     '[ext_resource type="Material" path="res://materials/rock.tres" id="2_RockMat"]', content)
    content = re.sub(r'\[ext_resource type="Material"[^\]]*id="4_MountainMat"\]',
                     '[ext_resource type="Material" path="res://materials/bg_forest.tres" id="4_MountainMat"]', content)
    return content

def build(b: NodeBuilder) -> None:
    b.add_platform("Platform_0", 6.00, 0.00, width=15.00)
    b.add_platform("Platform_1", 30.00, 18.00, width=3.00, rock_height=1.00)
    b.add_level_finish("Goal_0", 30.00, 20.00)
    b.add_moving_platform("MovingPlatform_0", 7.50, 6.00, direction="horizontal", travel_range=6.00, speed=3.00, width=6.00, rock_height=1.00)
    b.add_moving_platform("MovingPlatform_1", 18.00, 12.00, direction="horizontal", travel_range=4.00, speed=2.00, width=3.00, rock_height=1.00)
