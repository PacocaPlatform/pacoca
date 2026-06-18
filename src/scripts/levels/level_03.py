"""Generated level definition for level 03 ("Ruínas Celestes").
Generated automatically from level_03_map.txt. Do not edit directly if you want to keep changes synced!
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
    return content

def build(b: NodeBuilder) -> None:
    b.add_platform("Platform_0", 32.00, 0.00, width=66.00)
    b.add_platform("Platform_1", 64.00, 4.00, width=2.00)
    b.add_platform("Platform_2", 19.00, 8.00, width=20.00)
    b.add_platform("Platform_3", 64.00, 8.00, width=2.00)
    b.add_platform("Platform_4", 27.00, 12.00, width=4.00)
    b.add_platform("Platform_5", 41.00, 12.00, width=16.00)
    b.add_platform("Platform_6", 64.00, 12.00, width=2.00)
    b.add_platform("Platform_7", 18.00, 16.00, width=10.00)
    b.add_platform("Platform_8", 27.00, 16.00, width=4.00)
    b.add_platform("Platform_9", 64.00, 16.00, width=2.00)
    b.add_platform("Platform_10", 31.00, 20.00, width=8.00)
    b.add_platform("Platform_11", 58.00, 20.00, width=2.00)
    b.add_platform("Platform_12", 65.00, 20.00, width=4.00)
    b.add_platform("Platform_13", 22.00, 24.00, width=10.00)
    b.add_platform("Platform_14", 49.00, 24.00, width=16.00)
    b.add_platform("Platform_15", 66.00, 24.00, width=2.00)
    b.add_platform("Platform_16", 66.00, 28.00, width=2.00)
    b.add_platform("Platform_17", 30.00, 32.00, width=18.00)
    b.add_platform("Platform_18", 66.00, 32.00, width=2.00)
    b.add_platform("Platform_19", 66.00, 36.00, width=2.00)
    b.add_platform("Platform_20", 44.00, 40.00, width=34.00)
    b.add_platform("Platform_21", 66.00, 40.00, width=2.00)
    b.add_platform("Platform_22", 66.00, 44.00, width=2.00)
    b.add_platform("Platform_23", 66.00, 48.00, width=2.00)
    b.add_platform("Platform_24", 68.00, 52.00, width=2.00)
    b.add_cactus("Cactus_0", 16.00, 1.00, speed=1.25)
    b.add_cactus("Cactus_1", 44.00, 1.00, speed=1.25)
    b.add_cactus("Cactus_2", 18.00, 9.00, speed=1.25)
    b.add_cactus("Cactus_3", 44.00, 13.00, speed=1.25)
    b.add_cactus("Cactus_4", 20.00, 17.00, speed=1.25)
