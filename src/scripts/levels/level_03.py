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
    spawn_replacement = rf'\g<1>0.00, 1.50, 0'
    content = re.sub(spawn_pattern, spawn_replacement, content)
    return content

def build(b: NodeBuilder) -> None:
    b.add_platform("Platform_0", 20.00, 0.00, width=42.00)
    b.add_platform("Platform_1", 19.00, 2.00, width=16.00)
