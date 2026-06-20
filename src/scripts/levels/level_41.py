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
    return content

def build(b: NodeBuilder) -> None:
    b.add_platform("Platform_0", 23.00, 0.00, width=48.00)
    b.add_platform("Platform_1", 81.00, 0.00, width=28.00)
    b.add_platform("Platform_2", 0.00, 3.00, width=2.00)
    b.add_platform("Platform_3", 68.00, 3.00, width=2.00)
    b.add_platform("Platform_4", 89.00, 3.00, width=4.00)
    b.add_platform("Platform_5", 0.00, 6.00, width=2.00)
    b.add_platform("Platform_6", 24.00, 6.00, width=38.00, rock_height=1.00)
    b.add_platform("Platform_7", 49.00, 6.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_8", 68.00, 6.00, width=2.00)
    b.add_platform("Platform_9", 92.00, 6.00, width=6.00)
    b.add_platform("Platform_10", 0.00, 9.00, width=2.00)
    b.add_platform("Platform_11", 42.00, 9.00, width=2.00)
    b.add_platform("Platform_12", 68.00, 9.00, width=2.00)
    b.add_platform("Platform_13", 78.00, 9.00, width=14.00, rock_height=1.00)
    b.add_platform("Platform_14", 93.00, 9.00, width=4.00)
    b.add_platform("Platform_15", 0.00, 12.00, width=2.00)
    b.add_platform("Platform_16", 30.00, 12.00, width=18.00, rock_height=1.00)
    b.add_platform("Platform_17", 42.00, 12.00, width=2.00)
    b.add_platform("Platform_18", 54.00, 12.00, width=6.00, rock_height=1.00)
    b.add_platform("Platform_19", 68.00, 12.00, width=2.00)
    b.add_platform("Platform_20", 78.00, 12.00, width=14.00)
    b.add_platform("Platform_21", 95.00, 12.00, width=4.00)
    b.add_platform("Platform_22", 0.00, 15.00, width=2.00)
    b.add_platform("Platform_23", 19.00, 15.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_24", 42.00, 15.00, width=2.00)
    b.add_platform("Platform_25", 47.00, 15.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_26", 68.00, 15.00, width=2.00)
    b.add_platform("Platform_27", 78.00, 15.00, width=14.00)
    b.add_platform("Platform_28", 97.00, 15.00, width=4.00)
    b.add_platform("Platform_29", 8.00, 18.00, width=18.00)
    b.add_platform("Platform_30", 42.00, 18.00, width=2.00)
    b.add_platform("Platform_31", 68.00, 18.00, width=2.00)
    b.add_platform("Platform_32", 78.00, 18.00, width=14.00)
    b.add_platform("Platform_33", 100.00, 18.00, width=6.00)
    b.add_platform("Platform_34", 0.00, 21.00, width=2.00)
    b.add_platform("Platform_35", 42.00, 21.00, width=2.00)
    b.add_platform("Platform_36", 54.00, 21.00, width=6.00, rock_height=1.00)
    b.add_platform("Platform_37", 68.00, 21.00, width=2.00)
    b.add_platform("Platform_38", 78.00, 21.00, width=14.00)
    b.add_platform("Platform_39", 102.00, 21.00, width=2.00)
    b.add_platform("Platform_40", 0.00, 24.00, width=2.00)
    b.add_platform("Platform_41", 42.00, 24.00, width=2.00)
    b.add_platform("Platform_42", 47.00, 24.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_43", 68.00, 24.00, width=2.00)
    b.add_platform("Platform_44", 78.00, 24.00, width=14.00)
    b.add_platform("Platform_45", 0.00, 27.00, width=2.00)
    b.add_platform("Platform_46", 42.00, 27.00, width=2.00)
    b.add_platform("Platform_47", 54.00, 27.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_48", 68.00, 27.00, width=2.00)
    b.add_platform("Platform_49", 78.00, 27.00, width=14.00)
    b.add_platform("Platform_50", 0.00, 30.00, width=2.00)
    b.add_platform("Platform_51", 42.00, 30.00, width=2.00)
    b.add_platform("Platform_52", 52.00, 30.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_53", 68.00, 30.00, width=2.00)
    b.add_platform("Platform_54", 78.00, 30.00, width=14.00)
    b.add_platform("Platform_55", 0.00, 33.00, width=2.00)
    b.add_platform("Platform_56", 42.00, 33.00, width=2.00)
    b.add_platform("Platform_57", 47.00, 33.00, width=4.00, rock_height=1.00)
    b.add_platform("Platform_58", 68.00, 33.00, width=2.00)
    b.add_platform("Platform_59", 78.00, 33.00, width=14.00)
    b.add_platform("Platform_60", 0.00, 36.00, width=2.00)
    b.add_platform("Platform_61", 42.00, 36.00, width=2.00)
    b.add_platform("Platform_62", 68.00, 36.00, width=2.00)
    b.add_platform("Platform_63", 78.00, 36.00, width=14.00)
    b.add_platform("Platform_64", 0.00, 39.00, width=2.00)
    b.add_platform("Platform_65", 42.00, 39.00, width=2.00)
    b.add_platform("Platform_66", 60.00, 39.00, width=18.00)
    b.add_platform("Platform_67", 78.00, 39.00, width=14.00)
    b.add_platform("Platform_68", 42.00, 42.00, width=2.00)
    b.add_platform("Platform_69", 78.00, 42.00, width=14.00)
