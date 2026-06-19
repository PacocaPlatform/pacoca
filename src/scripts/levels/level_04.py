"""Generated level definition for level 04 ("Ruínas Celestes").
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
    return content

def build(b: NodeBuilder) -> None:
    b.add_platform("Platform_0", 20.00, 0.00, width=42.00)
    b.add_ring("Ring_0", 8.00, 1.20)
    b.add_ring("Ring_1", 10.00, 1.20)
    b.add_ring("Ring_2", 12.00, 1.20)
    b.add_ring("Ring_3", 14.00, 1.20)
    b.add_ring("Ring_4", 16.00, 1.20)
    b.add_level_finish("Goal_0", 36.00, 8.00)
