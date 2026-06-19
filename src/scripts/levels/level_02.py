"""Level 02 definition: "Templo nas Nuvens" (Sky Temple).

A distinct, shorter and more vertical course than level 01:

    Section 1  Trilha Inicial   (X  20-280)  ground warm-up, rings, a ramp.
    Section 2  A Subida         (X 280-650)  spring-assisted vertical climb.
    Section 3  Pontes Celestes  (X 650-1010) floating bridges with hazards.
    Section 4  Descida & Meta   (X 1010-1290) fast descent runway to the goal.

The base scene (``level_02.tscn``) is authored with the goal/water/mountain
already in place, so no surgical ``base_edits`` are needed here.
"""

from __future__ import annotations

from generate_level import NodeBuilder, apply_modification

# First node emitted by ``build`` -- the regeneration anchor.
ANCHOR = '[node name="L2_Start1"'


def base_edits(content: str) -> str:
    # Register level finish scene as external resource
    finish_anchor = (
        '[ext_resource type="PackedScene" path="res://scenes/spikes.tscn" '
        'id="10_SpikesScene"]'
    )
    return apply_modification(
        content,
        finish_anchor,
        finish_anchor
        + '\n[ext_resource type="PackedScene" path="res://scenes/level_finish.tscn" '
        'id="11_LevelFinishScene"]',
        label="ext_resource level_finish",
    )


def build(b: NodeBuilder) -> None:
    # SECTION 1 -- Trilha Inicial (X = 20 to 280)
    b.add_platform("L2_Start1", 30.0, 0.0, width=40.0)
    b.add_ring("L2_RingStart1_1", 25.0, 1.2)
    b.add_ring("L2_RingStart1_2", 30.0, 1.2)
    b.add_ring("L2_RingStart1_3", 35.0, 1.2)
    b.add_enemy("L2_EnemyStart1", 35.0, 1.0, speed=3.0)

    b.add_platform("L2_Start2", 85.0, 0.0, width=30.0)
    b.add_cactus("L2_CactusStart1", 85.0, 1.0, speed=1.25)

    b.add_ramp_up("L2_StartRamp", 105.0, 0.0, width=15.0, height=4.0, bottom=-2.0)

    b.add_platform("L2_Start3", 140.0, 4.0, width=35.0)
    b.add_dash_pad("L2_DashStart1", 128.0, 4.5)
    b.add_ring("L2_RingStart3_1", 135.0, 5.2)
    b.add_ring("L2_RingStart3_2", 140.0, 5.2)
    b.add_ring("L2_RingStart3_3", 145.0, 5.2)

    b.add_platform("L2_Start4", 195.0, 4.0, width=40.0)
    b.add_enemy("L2_EnemyStart2", 195.0, 5.0, speed=3.5)

    b.add_platform("L2_Start5", 250.0, 3.0, width=35.0)
    b.add_ring("L2_RingStart5_1", 245.0, 4.2)
    b.add_ring("L2_RingStart5_2", 250.0, 4.2)
    b.add_ring("L2_RingStart5_3", 255.0, 4.2)
    b.add_spring_vert("L2_ClimbLauncher", 262.0, 3.5, force=25.0)

    # SECTION 2 -- A Subida (X = 280 to 650)
    b.add_platform("L2_Climb1", 295.0, 11.0, width=18.0)
    b.add_ring("L2_RingClimb1_1", 290.0, 12.2)
    b.add_ring("L2_RingClimb1_2", 295.0, 12.2)
    b.add_ring("L2_RingClimb1_3", 300.0, 12.2)
    b.add_spring_vert("L2_ClimbSpring1", 295.0, 11.5, force=22.0)

    b.add_platform("L2_Climb2", 325.0, 17.0, width=16.0)
    b.add_cactus("L2_CactusClimb1", 325.0, 18.0, speed=1.25)
    b.add_spring_diag("L2_ClimbDiag1", 330.0, 17.5, force=24.0, dx=1.2, dy=1.5, lock=0.6)

    b.add_platform("L2_Climb3", 375.0, 21.0, width=20.0)
    b.add_dash_pad("L2_DashClimb1", 365.0, 21.5)
    b.add_ring("L2_RingClimb3_1", 370.0, 22.2)
    b.add_ring("L2_RingClimb3_2", 375.0, 22.2)
    b.add_ring("L2_RingClimb3_3", 380.0, 22.2)

    b.add_platform("L2_Climb4", 425.0, 19.0, width=24.0)
    b.add_enemy("L2_EnemyClimb1", 425.0, 20.0, speed=3.0)

    b.add_platform("L2_Climb5", 485.0, 17.0, width=28.0)
    b.add_ring("L2_RingClimb5_1", 480.0, 18.2)
    b.add_ring("L2_RingClimb5_2", 485.0, 18.2)
    b.add_ring("L2_RingClimb5_3", 490.0, 18.2)

    b.add_platform("L2_Climb6", 545.0, 19.0, width=24.0)
    b.add_cactus("L2_CactusClimb2", 545.0, 20.0, speed=1.25)

    b.add_platform("L2_ClimbTop", 610.0, 16.0, width=40.0)
    b.add_dash_pad("L2_DashClimbTop", 595.0, 16.5)
    b.add_spring_diag("L2_SkyLauncher", 622.0, 16.5, force=25.0, dx=1.2, dy=1.5, lock=0.6)

    # SECTION 3 -- Pontes Celestes (X = 650 to 1010)
    b.add_platform("L2_Sky1", 685.0, 19.0, width=35.0)
    b.add_enemy("L2_EnemySky1", 685.0, 20.0, speed=3.0)
    b.add_ring("L2_RingSky1_1", 678.0, 20.2)
    b.add_ring("L2_RingSky1_2", 685.0, 20.2)
    b.add_ring("L2_RingSky1_3", 692.0, 20.2)

    b.add_platform("L2_Sky2", 745.0, 21.0, width=30.0)
    b.add_spikes("L2_SpikesSky1", 745.0, 21.5)

    b.add_platform("L2_Sky3", 800.0, 20.0, width=35.0)
    b.add_dash_pad("L2_DashSky1", 788.0, 20.5)
    b.add_ring("L2_RingSky3_1", 795.0, 21.2)
    b.add_ring("L2_RingSky3_2", 800.0, 21.2)
    b.add_ring("L2_RingSky3_3", 805.0, 21.2)

    b.add_platform("L2_SkyStep1", 850.0, 22.0, width=10.0)
    b.add_platform("L2_SkyStep2", 878.0, 20.0, width=10.0)

    b.add_platform("L2_Sky4", 920.0, 19.0, width=40.0)
    b.add_cactus("L2_CactusSky1", 920.0, 20.0, speed=1.25)
    b.add_spikes("L2_SpikesSky2", 935.0, 19.5)

    b.add_platform("L2_Sky5", 985.0, 17.0, width=35.0)
    b.add_ring("L2_RingSky5_1", 980.0, 18.2)
    b.add_ring("L2_RingSky5_2", 985.0, 18.2)
    b.add_ring("L2_RingSky5_3", 990.0, 18.2)

    # SECTION 4 -- Descida & Meta (X = 1010 to 1290)
    b.add_ramp_down("L2_DescentRamp", 1010.0, 16.0, width=30.0, height=12.0, bottom_y=-3.0)

    b.add_platform("L2_Runway", 1100.0, 4.0, width=120.0)
    b.add_dash_pad("L2_DashRunway", 1055.0, 4.5)
    b.add_enemy("L2_EnemyRunway", 1090.0, 5.0, speed=3.5)
    for i, ring_x in enumerate(range(1080, 1150, 10)):
        b.add_ring(f"L2_RingRunway_{i}", ring_x, 5.2)
    b.add_cactus("L2_CactusRunway", 1135.0, 5.0, speed=1.25)

    b.add_ramp_up("L2_FinalRamp", 1175.0, 4.0, width=20.0, height=6.0, bottom=-2.0)

    # Victory ring arc into the goal.
    b.add_ring("L2_Victory1", 1205.0, 13.5)
    b.add_ring("L2_Victory2", 1210.0, 14.5)
    b.add_ring("L2_Victory3", 1215.0, 14.5)
    b.add_ring("L2_Victory4", 1220.0, 13.5)

    b.add_platform("L2_GoalArena", 1250.0, 8.0, width=40.0)

    # Goal Coin
    b.add_level_finish("L2_GoalFinish", 1250.0, 10.5)
