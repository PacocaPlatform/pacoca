"""Level 01 definition: base-scene edits + procedural layout.

The output is intentionally byte-for-byte identical to the original
single-file generator; this module only relocates that data behind the
generic engine in ``generate_level.py``.
"""

from __future__ import annotations

from generate_level import NodeBuilder, apply_modification

# The first node emitted by ``build``. Everything from here to EOF is treated
# as generated and is stripped/regenerated on each run.
ANCHOR = '[node name="SpringCaveUpperLauncher"'


def base_edits(content: str) -> str:
    # 1. Register the spikes scene as an external resource.
    spikes_anchor = (
        '[ext_resource type="PackedScene" path="res://scenes/cactus_enemy.tscn" '
        'id="9_CactusEnemyScene"]'
    )
    content = apply_modification(
        content,
        spikes_anchor,
        spikes_anchor
        + '\n[ext_resource type="PackedScene" path="res://scenes/spikes.tscn" '
        'id="10_SpikesScene"]',
        label="ext_resource spikes",
    )

    # 1b. Register level finish scene as external resource
    finish_anchor = (
        '[ext_resource type="PackedScene" path="res://scenes/spikes.tscn" '
        'id="10_SpikesScene"]'
    )
    content = apply_modification(
        content,
        finish_anchor,
        finish_anchor
        + '\n[ext_resource type="PackedScene" path="res://scenes/level_finish.tscn" '
        'id="11_LevelFinishScene"]',
        label="ext_resource level_finish",
    )

    # 2. Water plane mesh size.
    content = apply_modification(
        content,
        '[sub_resource type="BoxMesh" id="BoxMesh_water"]\n'
        'material = ExtResource("3_WaterMat")\n'
        "size = Vector3(600, 2, 8)",
        '[sub_resource type="BoxMesh" id="BoxMesh_water"]\n'
        'material = ExtResource("3_WaterMat")\n'
        "size = Vector3(3000, 2, 8)",
        label="water mesh size",
    )

    # 3. Background mountain mesh size.
    content = apply_modification(
        content,
        '[sub_resource type="QuadMesh" id="QuadMesh_mountain"]\n'
        'material = ExtResource("4_MountainMat")\n'
        "size = Vector2(800, 120)",
        '[sub_resource type="QuadMesh" id="QuadMesh_mountain"]\n'
        'material = ExtResource("4_MountainMat")\n'
        "size = Vector2(3000, 120)",
        label="mountain mesh size",
    )

    # 4. Water plane node transform.
    content = apply_modification(
        content,
        '[node name="WaterPlane" type="MeshInstance3D" parent="Level"]\n'
        "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 200, -7.5, 0)",
        '[node name="WaterPlane" type="MeshInstance3D" parent="Level"]\n'
        "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1000, -7.5, 0)",
        label="water node transform",
    )

    # 5. Background mountains node transform.
    content = apply_modification(
        content,
        '[node name="BG_Mountains" type="MeshInstance3D" parent="Level"]\n'
        "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 180, 15, -22)",
        '[node name="BG_Mountains" type="MeshInstance3D" parent="Level"]\n'
        "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1000, 15, -22)",
        label="mountain node transform",
    )

    # 6. Rename GoalPlatform -> BridgePlatform (and its sub-rock).
    content = apply_modification(
        content,
        '[node name="GoalPlatform" type="CSGBox3D" parent="Level/TrackCSG"]',
        '[node name="BridgePlatform" type="CSGBox3D" parent="Level/TrackCSG"]',
        label="rename GoalPlatform",
    )
    content = apply_modification(
        content,
        '[node name="GoalSubRock" type="CSGBox3D" parent="Level/TrackCSG"]',
        '[node name="BridgeSubRock" type="CSGBox3D" parent="Level/TrackCSG"]',
        label="rename GoalSubRock",
    )

    # 7. Move GoalRuin.
    content = apply_modification(
        content,
        '[node name="GoalRuin" type="CSGCombiner3D" parent="Level"]\n'
        "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 380, 6.5, -3)",
        '[node name="GoalRuin" type="CSGCombiner3D" parent="Level"]\n'
        "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2000, 12.5, -3)",
        label="move GoalRuin",
    )

    # 8. Move EnemyGoal.
    content = apply_modification(
        content,
        '[node name="EnemyGoal" parent="InteractiveObjects/Enemies" '
        'instance=ExtResource("8_EnemyScene")]\n'
        "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 370, 3.0, 0)",
        '[node name="EnemyGoal" parent="InteractiveObjects/Enemies" '
        'instance=ExtResource("8_EnemyScene")]\n'
        "transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1995, 9.0, 0)",
        label="move EnemyGoal",
    )

    return content


def build(b: NodeBuilder) -> None:
    # SECTION 1 (X = 395 to 700)
    b.add_spring_diag("SpringCaveUpperLauncher", 390.0, 2.5, force=24.0, dx=1.2, dy=1.5, lock=0.6)

    # Upper Path platforms
    b.add_platform("UpperPlatform1", 420.0, 10.0, width=20.0)
    b.add_ring("RingUpper1_1", 415.0, 11.2)
    b.add_ring("RingUpper1_2", 420.0, 11.2)
    b.add_ring("RingUpper1_3", 425.0, 11.2)

    b.add_platform("UpperPlatform2", 460.0, 12.0, width=20.0)
    b.add_ring("RingUpper2_1", 435.0, 12.0)
    b.add_ring("RingUpper2_2", 440.0, 13.0)
    b.add_ring("RingUpper2_3", 445.0, 12.5)

    b.add_platform("UpperPlatform3", 505.0, 14.0, width=30.0)
    b.add_dash_pad("DashPadUpper1", 495.0, 14.5)
    b.add_ring("RingUpper3_1", 505.0, 15.2)
    b.add_ring("RingUpper3_2", 510.0, 15.2)
    b.add_ring("RingUpper3_3", 515.0, 15.2)

    b.add_platform("UpperPlatform4", 550.0, 11.0, width=20.0)

    b.add_platform("UpperPlatform5", 600.0, 8.0, width=40.0)
    b.add_cactus("CactusUpper1", 600.0, 9.0, speed=1.25)

    # Slope down to junction Y=2.0
    b.add_ramp_down("UpperSlopeDown", 620.0, 8.0, width=30.0, height=6.0, bottom_y=-3.0)

    # Lower Path platforms (Cave Path)
    b.add_platform("CavePlatform1", 430.0, -6.0, width=30.0)
    b.add_cactus("CactusCave1", 430.0, -5.0, speed=1.0)
    b.add_ring("RingCave1_1", 420.0, -4.8)
    b.add_ring("RingCave1_2", 425.0, -4.8)

    # Floating block & Spikes in gap
    b.add_platform("SpikePlatform1", 448.0, -10.0, width=4.0)
    b.add_spikes("SpikesCave1", 448.0, -9.5)

    b.add_platform("CaveLowFloating1", 456.0, -8.0, width=8.0)

    b.add_platform("SpikePlatform2", 464.0, -10.0, width=4.0)
    b.add_spikes("SpikesCave2", 464.0, -9.5)

    b.add_platform("CavePlatform2", 485.0, -7.0, width=25.0)
    b.add_enemy("EnemyCave1", 485.0, -6.0, speed=2.5)

    b.add_platform("CaveSpringPlatform", 506.0, -9.0, width=6.0)
    b.add_spring_vert("SpringCaveRecover", 506.0, -8.5, force=20.0)

    b.add_platform("CavePlatform3", 535.0, -6.0, width=35.0)
    b.add_ring("RingCave3_1", 525.0, -4.8)
    b.add_ring("RingCave3_2", 530.0, -4.8)
    b.add_ring("RingCave3_3", 535.0, -4.8)

    b.add_platform("CaveFloat1", 560.0, -2.0, width=10.0)
    b.add_platform("CaveFloat2", 575.0, 0.0, width=10.0)

    b.add_platform("CavePlatform4", 600.0, -4.0, width=40.0)

    b.add_platform("CavePlatform5", 655.0, -2.0, width=50.0)
    b.add_cactus("CactusCave2", 650.0, -1.0, speed=1.25)
    b.add_spring_vert("SpringCaveOut", 675.0, -1.5, force=24.0)

    # SECTION 2 (X = 700 to 1100)
    # Junction platform where paths meet
    b.add_platform("JunctionPlatform2", 700.0, 2.0, width=60.0)
    # Spring to Sky Sanctum
    b.add_spring_vert("SpringSkyLauncher", 720.0, 2.5, force=26.0)

    # Sky Sanctum (Upper Path)
    b.add_platform("SkyPlatform1", 760.0, 16.0, width=25.0)
    b.add_ring("RingSky1_1", 755.0, 17.2)
    b.add_ring("RingSky1_2", 760.0, 17.2)
    b.add_ring("RingSky1_3", 765.0, 17.2)

    b.add_platform("SkyPlatform2", 800.0, 18.0, width=25.0)
    b.add_cactus("CactusSky1", 800.0, 19.0, speed=1.25)

    b.add_platform("SkyPlatform3", 850.0, 17.0, width=35.0)
    b.add_dash_pad("DashPadSky1", 840.0, 17.5)

    b.add_platform("SkyPlatform4", 900.0, 19.0, width=30.0)
    b.add_ring("RingSky4_1", 895.0, 20.2)
    b.add_ring("RingSky4_2", 900.0, 20.2)
    b.add_ring("RingSky4_3", 905.0, 20.2)

    b.add_platform("SkyPlatform5", 960.0, 16.0, width=40.0)
    b.add_cactus("CactusSky2", 960.0, 17.0, speed=1.25)

    b.add_platform("SkyPlatform6", 1025.0, 14.0, width=30.0)
    b.add_spring_diag("SpringSkyOut", 1035.0, 14.5, force=24.0, dx=1.2, dy=1.5, lock=0.6)

    # Middle Path (Speed Track)
    b.add_platform("MiddlePlatform1", 760.0, 2.0, width=40.0)
    b.add_enemy("EnemyMid1", 760.0, 3.0, speed=3.0)
    b.add_ramp_up("MiddleRampUp", 780.0, 2.0, width=20.0, height=6.0, bottom=-2.0)

    b.add_platform("MiddlePlatform2", 830.0, 8.0, width=60.0)
    b.add_dash_pad("DashPadMid1", 810.0, 8.5)
    b.add_ring("RingMid2_1", 825.0, 9.2)
    b.add_ring("RingMid2_2", 830.0, 9.2)
    b.add_ring("RingMid2_3", 835.0, 9.2)

    b.add_ramp_down("MiddleRampDown", 860.0, 8.0, width=20.0, height=6.0, bottom_y=-3.0)

    b.add_platform("MiddlePlatform3", 910.0, 2.0, width=50.0)
    b.add_enemy("EnemyMid2", 910.0, 3.0, speed=3.5)

    b.add_platform("MiddlePlatform4", 980.0, 3.0, width=60.0)
    b.add_ring("RingMid4_1", 970.0, 4.2)
    b.add_ring("RingMid4_2", 975.0, 4.2)
    b.add_ring("RingMid4_3", 980.0, 4.2)

    b.add_platform("MiddlePlatform5", 1050.0, 2.0, width=40.0)

    # Lower Path (Water Hazard)
    b.add_platform("WaterPathPlatform1", 765.0, -4.0, width=30.0)
    b.add_spikes("SpikesWater1", 765.0, -3.5)

    b.add_platform("WaterPathPlatform2", 815.0, -5.0, width=20.0)
    b.add_ring("RingWater2_1", 810.0, -3.8)
    b.add_ring("RingWater2_2", 815.0, -3.8)
    b.add_ring("RingWater2_3", 820.0, -3.8)

    b.add_platform("WaterPathPlatform3", 865.0, -4.5, width=40.0)
    b.add_enemy("EnemyWater1", 865.0, -3.5, speed=2.0)

    b.add_platform("WaterPathPlatform4", 925.0, -5.0, width=30.0)
    b.add_spikes("SpikesWater2", 925.0, -4.5)

    b.add_platform("WaterPathPlatform5", 985.0, -3.0, width=50.0)
    b.add_cactus("CactusWater1", 980.0, -2.0, speed=1.25)

    b.add_platform("WaterPathPlatform6", 1045.0, -1.0, width=40.0)
    b.add_spring_vert("SpringWaterOut", 1055.0, -0.5, force=24.0)

    # SECTION 3 (X = 1100 to 1450)
    b.add_platform("WallClimbBase", 1085.0, 2.0, width=30.0)

    # The Wall Structure
    b.add_raw("""
[node name="VerticalWall" type="CSGBox3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1105.00, 10.00, 0)
size = Vector3(10, 30, 4)
material = ExtResource("1_GrassMat")

[node name="VerticalWallRock" type="CSGBox3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1105.00, 10.00, 0)
size = Vector3(10, 30, 3.8)
material = ExtResource("2_RockMat")
""")

    # Path A: Wall Climb (Springs and Ledges)
    b.add_spring_vert("WallSpringClimb1", 1085.0, 2.5, force=22.0)
    b.add_platform("WallLedge1", 1095.0, 12.0, width=10.0)
    b.add_spring_vert("WallSpringClimb2", 1095.0, 12.5, force=22.0)
    b.add_platform("WallLedge2", 1105.0, 20.0, width=10.0)
    b.add_ring("RingWallLedge2", 1105.0, 21.2)
    b.add_platform("WallTopPlatform", 1115.0, 25.0, width=10.0)

    # Path B: Underpass Tunnel (Requires Rolling)
    b.add_platform("UnderpassPlatform", 1115.0, -4.0, width=40.0)
    b.add_raw("""
[node name="UnderpassCeiling" type="CSGBox3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1115.00, -0.50, 0)
size = Vector3(40, 1, 4)
material = ExtResource("1_GrassMat")

[node name="UnderpassCeilingRock" type="CSGBox3D" parent="Level/TrackCSG"]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 1115.00, -2.50, 0)
size = Vector3(40, 4, 3.8)
material = ExtResource("2_RockMat")
""")
    b.add_dash_pad("DashPadUnderpass", 1090.0, 2.5)
    b.add_ring("RingTunnel1", 1100.0, -2.8)
    b.add_ring("RingTunnel2", 1110.0, -2.8)
    b.add_ring("RingTunnel3", 1120.0, -2.8)

    # Path C: Spin Dash Ramp (Steep climb)
    b.add_ramp_up("SpinDashRamp", 1055.0, 2.0, width=15.0, height=10.0, bottom=-2.0)
    b.add_platform("WallTopRampPlatform", 1075.0, 12.0, width=10.0)
    b.add_dash_pad("DashPadWallTop", 1075.0, 12.5)

    # Post-Wall Merge
    b.add_platform("PostWallPlatform", 1160.0, 6.0, width=60.0)

    # Post-Wall splits
    # Upper path: Floating Grass Climb
    b.add_platform("FloatStep1", 1210.0, 9.0, width=8.0)
    b.add_platform("FloatStep2", 1230.0, 12.0, width=8.0)
    b.add_platform("FloatStep3", 1250.0, 15.0, width=8.0)
    b.add_platform("FloatStep4", 1275.0, 14.0, width=12.0)
    b.add_ring("RingFloatStep4", 1275.0, 15.2)

    # Lower path: Speed Runway
    b.add_platform("LowerSpeedRunway", 1240.0, 2.0, width=100.0)
    b.add_dash_pad("DashPadLowerSpeed", 1210.0, 2.5)
    b.add_enemy("EnemyLowerSpeed", 1250.0, 3.0, speed=3.0)

    # SECTION 4 (X = 1290 to 1750)
    # Lower Path: Danger Runway
    b.add_platform("DangerRunway", 1350.0, 1.0, width=120.0)
    b.add_spikes("SpikesDanger1", 1320.0, 1.5)
    b.add_spikes("SpikesDanger2", 1360.0, 1.5)
    b.add_cactus("CactusDanger1", 1340.0, 2.0, speed=1.25)
    b.add_enemy("EnemyDanger1", 1380.0, 2.0, speed=3.0)

    b.add_platform("DangerPlatform2", 1480.0, 3.0, width=100.0)
    b.add_spikes("SpikesDanger3", 1460.0, 3.5)

    b.add_platform("DangerPlatform3", 1610.0, 4.0, width=120.0)
    b.add_cactus("CactusDanger2", 1600.0, 5.0, speed=1.25)

    # Upper Path: Sky Sanctuary
    b.add_platform("SkyBridge1", 1340.0, 18.0, width=60.0)
    b.add_ring("RingSkyBridge1_1", 1330.0, 19.2)
    b.add_ring("RingSkyBridge1_2", 1340.0, 19.2)
    b.add_ring("RingSkyBridge1_3", 1350.0, 19.2)

    b.add_platform("SkyBridge2", 1430.0, 20.0, width=80.0)
    b.add_dash_pad("DashPadSkyBridge2", 1410.0, 20.5)
    b.add_cactus("CactusSkyBridge1", 1450.0, 21.0, speed=1.25)

    b.add_platform("SkyBridge3", 1550.0, 17.0, width=100.0)
    b.add_ring("RingSkyBridge3_1", 1540.0, 18.2)
    b.add_ring("RingSkyBridge3_2", 1550.0, 18.2)
    b.add_ring("RingSkyBridge3_3", 1560.0, 18.2)

    b.add_platform("SkyBridge4", 1680.0, 15.0, width=100.0)
    b.add_cactus("CactusSkyBridge2", 1680.0, 16.0, speed=1.25)

    # SECTION 5 (X = 1730 to 2025)
    # Final Junction
    b.add_platform("FinalJunction", 1780.0, 4.0, width=80.0)
    b.add_dash_pad("DashPadFinal1", 1760.0, 4.5)
    b.add_dash_pad("DashPadFinal2", 1800.0, 4.5)

    # Final Runway
    b.add_platform("FinalRunway", 1890.0, 4.0, width=140.0)
    b.add_dash_pad("DashPadFinal3", 1850.0, 4.5)
    for i, ring_x in enumerate(range(1870, 1930, 10)):
        b.add_ring(f"RingFinalRunway_{i}", ring_x, 5.2)

    # Final Jump Ramp
    b.add_ramp_up("FinalJumpRamp", 1940.0, 4.0, width=20.0, height=6.0, bottom=-2.0)

    # Final Victory Ring Arc
    b.add_ring("VictoryRing1", 1965.0, 13.5)
    b.add_ring("VictoryRing2", 1970.0, 14.5)
    b.add_ring("VictoryRing3", 1975.0, 14.5)
    b.add_ring("VictoryRing4", 1980.0, 13.5)

    # New Goal Arena
    b.add_platform("GoalPlatformNew", 2005.0, 8.0, width=40.0)

    # Goal Coin
    b.add_level_finish("GoalCoin", 2005.0, 10.5)
