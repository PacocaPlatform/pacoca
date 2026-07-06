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
    b.add_platform("Platform_1", 64.00, 3.00, width=2.00)
    b.add_platform("Platform_2", 19.00, 6.00, width=20.00, rock_height=1.00)
    b.add_platform("Platform_3", 64.00, 6.00, width=2.00)
    b.add_platform("Platform_4", 15.00, 9.00, width=4.00)
    b.add_platform("Platform_5", 27.00, 9.00, width=4.00)
    b.add_platform("Platform_6", 41.00, 9.00, width=16.00, rock_height=1.00)
    b.add_platform("Platform_7", 64.00, 9.00, width=2.00)
    b.add_platform("Platform_8", 16.00, 12.00, width=2.00)
    b.add_platform("Platform_9", 27.00, 12.00, width=4.00)
    b.add_platform("Platform_10", 64.00, 12.00, width=2.00)
    b.add_platform("Platform_11", 31.00, 15.00, width=8.00)
    b.add_platform("Platform_12", 58.00, 15.00, width=2.00, rock_height=1.00)
    b.add_platform("Platform_13", 65.00, 15.00, width=4.00)
    b.add_platform("Platform_14", 22.00, 18.00, width=10.00, rock_height=1.00)
    b.add_platform("Platform_15", 49.00, 18.00, width=16.00, rock_height=1.00)
    b.add_platform("Platform_16", 66.00, 18.00, width=2.00)
    b.add_platform("Platform_17", 66.00, 21.00, width=2.00)
    b.add_platform("Platform_18", 30.00, 24.00, width=18.00, rock_height=1.00)
    b.add_platform("Platform_19", 66.00, 24.00, width=2.00)
    b.add_platform("Platform_20", 66.00, 27.00, width=2.00)
    b.add_platform("Platform_21", 44.00, 30.00, width=34.00, rock_height=1.00)
    b.add_platform("Platform_22", 66.00, 30.00, width=2.00)
    b.add_platform("Platform_23", 66.00, 33.00, width=2.00)
    b.add_platform("Platform_24", 66.00, 36.00, width=2.00)
    b.add_platform("Platform_25", 68.00, 39.00, width=2.00, rock_height=1.00)
    b.add_ring("Ring_0", 2.00, 4.20)
    b.add_ring("Ring_1", 4.00, 4.20)
    b.add_ring("Ring_2", 6.00, 7.20)
    b.add_ring("Ring_3", 8.00, 10.20)
    b.add_ring("Ring_4", 10.00, 10.20)
    b.add_ring("Ring_5", 12.00, 13.20)
    b.add_ring("Ring_6", 14.00, 16.20)
    b.add_ring("Ring_7", 16.00, 19.20)
    b.add_ring("Ring_8", 20.00, 19.20)
    b.add_ring("Ring_9", 20.00, 22.20)
    b.add_ring("Ring_10", 20.00, 25.20)
    b.add_ring("Ring_11", 22.00, 25.20)
    b.add_ring("Ring_12", 24.00, 25.20)
    b.add_ring("Ring_13", 26.00, 28.20)
    b.add_ring("Ring_14", 28.00, 31.20)
    b.add_ring("Ring_15", 30.00, 31.20)
    b.add_ring("Ring_16", 32.00, 31.20)
    b.add_ring("Ring_17", 32.00, 34.20)
    b.add_ring("Ring_18", 34.00, 34.20)
    b.add_ring("Ring_19", 36.00, 34.20)
    b.add_ring("Ring_20", 40.00, 34.20)
    b.add_ring("Ring_21", 42.00, 34.20)
    b.add_ring("Ring_22", 48.00, 34.20)
    b.add_cactus("Cactus_0", 16.00, 1.00, speed=1.25)
    b.add_cactus("Cactus_1", 44.00, 1.00, speed=1.25)
    b.add_cactus("Cactus_2", 18.00, 7.00, speed=1.25)
    b.add_cactus("Cactus_3", 44.00, 10.00, speed=1.25)
    b.add_cactus("Cactus_4", 20.00, 13.00, speed=1.25)
    b.add_level_finish("Goal_0", 68.00, 41.00)
