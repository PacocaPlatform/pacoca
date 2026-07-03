"""Generated level definition for level 04 ("Sky Ruins").
Generated automatically from level_04_map.txt. Do not edit directly if you want to keep changes synced!
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
    return content

def build(b: NodeBuilder) -> None:
    b.add_platform("Platform_0", 0.00, 0.00, width=2.00, grass=False)
    b.add_platform("Platform_1", 32.00, 0.00, width=62.00)
    b.add_platform("Platform_2", 107.00, 0.00, width=20.00)
    b.add_platform("Platform_3", 0.00, 3.00, width=2.00, grass=False)
    b.add_platform("Platform_4", 65.00, 3.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_5", 96.00, 3.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_6", 128.00, 3.00, width=22.00, rock_height=1.00)
    b.add_platform("Platform_7", 157.00, 3.00, width=12.00, rock_height=1.00, grass=False)
    b.add_platform("Platform_8", 180.00, 3.00, width=34.00, rock_height=1.00)
    b.add_platform("Platform_9", 198.00, 3.00, width=2.00, rock_height=1.00, grass=False)
    b.add_platform("Platform_10", 0.00, 6.00, width=2.00, grass=False)
    b.add_platform("Platform_11", 69.00, 6.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_12", 94.00, 6.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_13", 141.00, 6.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_14", 157.00, 6.00, width=12.00, grass=False)
    b.add_platform("Platform_15", 198.00, 6.00, width=2.00, grass=False)
    b.add_platform("Platform_16", 0.00, 9.00, width=2.00, grass=False)
    b.add_platform("Platform_17", 73.00, 9.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_18", 92.00, 9.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_19", 145.00, 9.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_20", 157.00, 9.00, width=12.00)
    b.add_platform("Platform_21", 198.00, 9.00, width=2.00, grass=False)
    b.add_platform("Platform_22", 0.00, 12.00, width=2.00, grass=False)
    b.add_platform("Platform_23", 77.00, 12.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_24", 90.00, 12.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_25", 198.00, 12.00, width=2.00, grass=False)
    b.add_platform("Platform_26", 0.00, 15.00, width=2.00, grass=False)
    b.add_platform("Platform_27", 81.00, 15.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_28", 88.00, 15.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_29", 198.00, 15.00, width=2.00, grass=False)
    b.add_platform("Platform_30", 0.00, 18.00, width=2.00, grass=False)
    b.add_platform("Platform_31", 85.00, 18.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_32", 198.00, 18.00, width=2.00, grass=False)
    b.add_platform("Platform_33", 0.00, 21.00, width=2.00, grass=False)
    b.add_platform("Platform_34", 198.00, 21.00, width=2.00, grass=False)
    b.add_platform("Platform_35", 0.00, 24.00, width=2.00, grass=False)
    b.add_platform("Platform_36", 198.00, 24.00, width=2.00, grass=False)
    b.add_platform("Platform_37", 0.00, 27.00, width=2.00)
    b.add_platform("Platform_38", 198.00, 27.00, width=2.00, grass=False)
    b.add_platform("Platform_39", 198.00, 30.00, width=2.00)
    b.add_cactus("Cactus_0", 168.00, 4.00, speed=1.25)
    b.add_level_finish("Goal_0", 190.00, 8.00)
