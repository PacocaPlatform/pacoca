"""Generated level definition for level 41 ("Sky Ruins 2").
Generated automatically from level_41_map.txt. Do not edit directly if you want to keep changes synced!
"""

from __future__ import annotations
import re
from generate_level import NodeBuilder, apply_modification

ANCHOR = '[node name="Platform_0"'

def base_edits(content: str) -> str:
    # Safely position the SpawnPoint
    spawn_pattern = r'(\[node name="SpawnPoint"[^\]]*\]\s*\ntransform = Transform3D\(1, 0, 0, 0, 1, 0, 0, 0, 1, )([^,]+), ([^,]+), ([^\)]+)'
    spawn_replacement = rf'\g<1>2.00, 19.50, 0'
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
    b.add_platform("Platform_1", 24.00, 0.00, width=46.00)
    b.add_platform("Platform_2", 68.00, 0.00, width=2.00, grass=False)
    b.add_platform("Platform_3", 78.00, 0.00, width=18.00)
    b.add_platform("Platform_4", 89.00, 0.00, width=4.00, grass=False)
    b.add_platform("Platform_5", 93.00, 0.00, width=4.00)
    b.add_platform("Platform_6", 0.00, 3.00, width=2.00, grass=False)
    b.add_platform("Platform_7", 68.00, 3.00, width=2.00, grass=False)
    b.add_platform("Platform_8", 88.00, 3.00, width=2.00)
    b.add_platform("Platform_9", 90.00, 3.00, width=2.00, grass=False)
    b.add_platform("Platform_10", 0.00, 6.00, width=2.00, grass=False)
    b.add_platform("Platform_11", 23.00, 6.00, width=36.00, rock_height=1.00)
    b.add_platform("Platform_12", 42.00, 6.00, width=2.00, rock_height=1.00, grass=False)
    b.add_platform("Platform_13", 49.00, 6.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_14", 68.00, 6.00, width=2.00, grass=False)
    b.add_platform("Platform_15", 90.00, 6.00, width=2.00)
    b.add_platform("Platform_16", 93.00, 6.00, width=4.00, rock_height=1.00, grass=False)
    b.add_platform("Platform_17", 0.00, 9.00, width=2.00, grass=False)
    b.add_platform("Platform_18", 42.00, 9.00, width=2.00, grass=False)
    b.add_platform("Platform_19", 68.00, 9.00, width=2.00, grass=False)
    b.add_platform("Platform_20", 78.00, 9.00, width=14.00, rock_height=1.00, grass=False)
    b.add_platform("Platform_21", 92.00, 9.00, width=2.00)
    b.add_platform("Platform_22", 94.00, 9.00, width=2.00, grass=False)
    b.add_platform("Platform_23", 0.00, 12.00, width=2.00, grass=False)
    b.add_platform("Platform_24", 30.00, 12.00, width=18.00, rock_height=1.00)
    b.add_platform("Platform_25", 42.00, 12.00, width=2.00, grass=False)
    b.add_platform("Platform_26", 54.00, 12.00, width=6.00, rock_height=1.00)
    b.add_platform("Platform_27", 68.00, 12.00, width=2.00, grass=False)
    b.add_platform("Platform_28", 78.00, 12.00, width=14.00, grass=False)
    b.add_platform("Platform_29", 94.00, 12.00, width=2.00)
    b.add_platform("Platform_30", 96.00, 12.00, width=2.00, rock_height=1.00, grass=False)
    b.add_platform("Platform_31", 0.00, 15.00, width=2.00, grass=False)
    b.add_platform("Platform_32", 19.00, 15.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_33", 42.00, 15.00, width=2.00, grass=False)
    b.add_platform("Platform_34", 47.00, 15.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_35", 68.00, 15.00, width=2.00, grass=False)
    b.add_platform("Platform_36", 78.00, 15.00, width=14.00, grass=False)
    b.add_platform("Platform_37", 96.00, 15.00, width=2.00)
    b.add_platform("Platform_38", 98.00, 15.00, width=2.00, rock_height=1.00, grass=False)
    b.add_platform("Platform_39", 0.00, 18.00, width=2.00, grass=False)
    b.add_platform("Platform_40", 9.00, 18.00, width=16.00, rock_height=1.00)
    b.add_platform("Platform_41", 42.00, 18.00, width=2.00, grass=False)
    b.add_platform("Platform_42", 68.00, 18.00, width=2.00, grass=False)
    b.add_platform("Platform_43", 78.00, 18.00, width=14.00, grass=False)
    b.add_platform("Platform_44", 99.00, 18.00, width=4.00)
    b.add_platform("Platform_45", 102.00, 18.00, width=2.00, rock_height=1.00, grass=False)
    b.add_platform("Platform_46", 0.00, 21.00, width=2.00, grass=False)
    b.add_platform("Platform_47", 42.00, 21.00, width=2.00, grass=False)
    b.add_platform("Platform_48", 54.00, 21.00, width=6.00, rock_height=1.00)
    b.add_platform("Platform_49", 68.00, 21.00, width=2.00, grass=False)
    b.add_platform("Platform_50", 78.00, 21.00, width=14.00, grass=False)
    b.add_platform("Platform_51", 102.00, 21.00, width=2.00)
    b.add_platform("Platform_52", 0.00, 24.00, width=2.00, grass=False)
    b.add_platform("Platform_53", 42.00, 24.00, width=2.00, grass=False)
    b.add_platform("Platform_54", 47.00, 24.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_55", 68.00, 24.00, width=2.00, grass=False)
    b.add_platform("Platform_56", 78.00, 24.00, width=14.00, grass=False)
    b.add_platform("Platform_57", 0.00, 27.00, width=2.00, grass=False)
    b.add_platform("Platform_58", 42.00, 27.00, width=2.00, grass=False)
    b.add_platform("Platform_59", 54.00, 27.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_60", 68.00, 27.00, width=2.00, grass=False)
    b.add_platform("Platform_61", 78.00, 27.00, width=14.00, grass=False)
    b.add_platform("Platform_62", 0.00, 30.00, width=2.00, grass=False)
    b.add_platform("Platform_63", 42.00, 30.00, width=2.00, grass=False)
    b.add_platform("Platform_64", 52.00, 30.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_65", 68.00, 30.00, width=2.00, grass=False)
    b.add_platform("Platform_66", 78.00, 30.00, width=14.00, grass=False)
    b.add_platform("Platform_67", 0.00, 33.00, width=2.00, grass=False)
    b.add_platform("Platform_68", 42.00, 33.00, width=2.00, grass=False)
    b.add_platform("Platform_69", 47.00, 33.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_70", 68.00, 33.00, width=2.00, grass=False)
    b.add_platform("Platform_71", 78.00, 33.00, width=14.00, grass=False)
    b.add_platform("Platform_72", 0.00, 36.00, width=2.00, grass=False)
    b.add_platform("Platform_73", 42.00, 36.00, width=2.00, grass=False)
    b.add_platform("Platform_74", 68.00, 36.00, width=2.00, grass=False)
    b.add_platform("Platform_75", 78.00, 36.00, width=14.00, grass=False)
    b.add_platform("Platform_76", 0.00, 39.00, width=2.00)
    b.add_platform("Platform_77", 42.00, 39.00, width=2.00, grass=False)
    b.add_platform("Platform_78", 60.00, 39.00, width=18.00)
    b.add_platform("Platform_79", 78.00, 39.00, width=14.00, grass=False)
    b.add_platform("Platform_80", 42.00, 42.00, width=2.00)
    b.add_platform("Platform_81", 78.00, 42.00, width=14.00)
