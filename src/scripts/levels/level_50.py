"""Generated level definition for level 50 ("Minha Fase").
Generated automatically from level_50_map.txt. Do not edit directly if you want to keep changes synced!
"""

from __future__ import annotations
import re
from generate_level import NodeBuilder, apply_modification

ANCHOR = '[node name="Platform_0"'

def base_edits(content: str) -> str:
    # Safely position the SpawnPoint
    spawn_pattern = r'(\[node name="SpawnPoint"[^\]]*\]\s*\ntransform = Transform3D\(1, 0, 0, 0, 1, 0, 0, 0, 1, )([^,]+), ([^,]+), ([^\)]+)'
    spawn_replacement = rf'\g<1>4.00, 1.50, 0'
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
    b.add_platform("Platform_0", 0.00, 0.00, width=2.00, grass=False)
    b.add_platform("Platform_1", 36.00, 0.00, width=70.00)
    b.add_platform("Platform_2", 85.00, 0.00, width=20.00)
    b.add_platform("Platform_3", 110.00, 0.00, width=22.00, grass=False)
    b.add_platform("Platform_4", 129.00, 0.00, width=12.00, grass=False)
    b.add_platform("Platform_5", 143.00, 0.00, width=12.00, grass=False)
    b.add_platform("Platform_6", 175.00, 0.00, width=48.00, grass=False)
    b.add_platform("Platform_7", 0.00, 3.00, width=2.00, grass=False)
    b.add_platform("Platform_8", 100.00, 3.00, width=2.00)
    b.add_platform("Platform_9", 111.00, 3.00, width=20.00, grass=False)
    b.add_platform("Platform_10", 129.00, 3.00, width=12.00, grass=False)
    b.add_platform("Platform_11", 143.00, 3.00, width=12.00, grass=False)
    b.add_platform("Platform_12", 175.00, 3.00, width=48.00, grass=False)
    b.add_platform("Platform_13", 0.00, 6.00, width=2.00, grass=False)
    b.add_platform("Platform_14", 103.00, 6.00, width=4.00)
    b.add_platform("Platform_15", 113.00, 6.00, width=16.00, grass=False)
    b.add_platform("Platform_16", 129.00, 6.00, width=12.00, grass=False)
    b.add_platform("Platform_17", 143.00, 6.00, width=12.00, grass=False)
    b.add_platform("Platform_18", 175.00, 6.00, width=48.00, grass=False)
    b.add_platform("Platform_19", 0.00, 9.00, width=2.00, grass=False)
    b.add_platform("Platform_20", 106.00, 9.00, width=2.00)
    b.add_platform("Platform_21", 114.00, 9.00, width=14.00, grass=False)
    b.add_platform("Platform_22", 129.00, 9.00, width=12.00, grass=False)
    b.add_platform("Platform_23", 143.00, 9.00, width=12.00, grass=False)
    b.add_platform("Platform_24", 158.00, 9.00, width=14.00, grass=False)
    b.add_platform("Platform_25", 182.00, 9.00, width=34.00)
    b.add_platform("Platform_26", 0.00, 12.00, width=2.00, grass=False)
    b.add_platform("Platform_27", 108.00, 12.00, width=2.00)
    b.add_platform("Platform_28", 115.00, 12.00, width=12.00, grass=False)
    b.add_platform("Platform_29", 129.00, 12.00, width=12.00, grass=False)
    b.add_platform("Platform_30", 143.00, 12.00, width=12.00, grass=False)
    b.add_platform("Platform_31", 158.00, 12.00, width=14.00)
    b.add_platform("Platform_32", 0.00, 15.00, width=2.00, grass=False)
    b.add_platform("Platform_33", 111.00, 15.00, width=4.00)
    b.add_platform("Platform_34", 117.00, 15.00, width=8.00, grass=False)
    b.add_platform("Platform_35", 129.00, 15.00, width=12.00, grass=False)
    b.add_platform("Platform_36", 143.00, 15.00, width=12.00)
    b.add_platform("Platform_37", 0.00, 18.00, width=2.00, grass=False)
    b.add_platform("Platform_38", 114.00, 18.00, width=2.00)
    b.add_platform("Platform_39", 118.00, 18.00, width=6.00, grass=False)
    b.add_platform("Platform_40", 129.00, 18.00, width=12.00, grass=False)
    b.add_platform("Platform_41", 0.00, 21.00, width=2.00, grass=False)
    b.add_platform("Platform_42", 117.00, 21.00, width=4.00)
    b.add_platform("Platform_43", 120.00, 21.00, width=2.00, grass=False)
    b.add_platform("Platform_44", 129.00, 21.00, width=12.00)
    b.add_platform("Platform_45", 0.00, 24.00, width=2.00, grass=False)
    b.add_platform("Platform_46", 120.00, 24.00, width=2.00)
    b.add_platform("Platform_47", 0.00, 27.00, width=2.00, grass=False)
    b.add_platform("Platform_48", 0.00, 30.00, width=2.00, grass=False)
    b.add_platform("Platform_49", 0.00, 33.00, width=2.00)
    b.add_ring("Ring_0", 12.00, 1.20)
    b.add_ring("Ring_1", 14.00, 1.20)
    b.add_ring("Ring_2", 16.00, 1.20)
    b.add_ring("Ring_3", 18.00, 1.20)
    b.add_ring("Ring_4", 20.00, 1.20)
    b.add_ring("Ring_5", 24.00, 1.20)
    b.add_ring("Ring_6", 26.00, 1.20)
    b.add_ring("Ring_7", 28.00, 1.20)
    b.add_ring("Ring_8", 30.00, 1.20)
    b.add_cactus("Cactus_0", 22.00, 1.00, speed=1.25)
    b.add_cactus("Cactus_1", 44.00, 1.00, speed=1.25)
    b.add_cactus("Cactus_2", 134.00, 25.00, speed=1.25)
    b.add_level_finish("Goal_0", 194.00, 17.00)
