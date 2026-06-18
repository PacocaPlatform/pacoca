"""Generated level definition for level 04 ("Ruinas Celestes").
Generated automatically from level_04_map.json. Do not edit directly if you want to keep changes synced!
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
    b.add_platform("Platform_0", 4.00, 0.00, width=10.00)
    b.add_platform("Platform_1", 20.00, 0.00, width=14.00)
    b.add_platform("Platform_2", 56.00, 0.00, width=14.00)
    b.add_platform("Platform_3", 71.00, 0.00, width=4.00)
    b.add_platform("Platform_4", 84.00, 0.00, width=10.00)
    b.add_platform("Platform_5", 112.00, 0.00, width=14.00)
    b.add_platform("Platform_6", 132.00, 0.00, width=18.00)
    b.add_platform("Platform_7", 180.00, 0.00, width=10.00)
    b.add_platform("Platform_8", 200.00, 0.00, width=10.00)
    b.add_platform("Platform_9", 150.00, 1.00, width=14.00)
    b.add_platform("Platform_10", 164.00, 1.00, width=2.00)
    b.add_platform("Platform_11", 184.00, 1.00, width=2.00)
    b.add_ramp_up("RampUp_0", 67.00, -0.50, width=2.00, height=1.00)
    b.add_ramp_down("RampDown_0", 73.00, 0.50, width=2.00, height=1.00)
    b.add_ring("Ring_0", 16.00, 1.20)
    b.add_ring("Ring_1", 20.00, 1.20)
    b.add_ring("Ring_2", 24.00, 1.20)
    b.add_ring("Ring_3", 146.00, 2.20)
    b.add_ring("Ring_4", 150.00, 2.20)
    b.add_ring("Ring_5", 154.00, 2.20)
    b.add_spring_vert("SpringV_0", 38.00, -0.50, force=22.00)
    b.add_spring_diag("SpringD_0", 170.00, -0.50, force=25.00, dx=1.20, dy=1.50, lock=0.60)
    b.add_dash_pad("DashPad_0", 32.00, -0.50)
    b.add_dash_pad("DashPad_1", 100.00, -0.50)
    b.add_dash_pad("DashPad_2", 190.00, -0.50)
    b.add_enemy("Enemy_0", 44.00, 0.00, speed=3.00)
    b.add_enemy("Enemy_1", 82.00, 1.00, speed=3.00)
    b.add_cactus("Cactus_0", 94.00, 0.00, speed=1.25)
    b.add_spikes("Spikes_0", 124.00, 0.50)
    b.add_spikes("Spikes_1", 128.00, 0.50)
    b.add_spikes("Spikes_2", 132.00, 0.50)
