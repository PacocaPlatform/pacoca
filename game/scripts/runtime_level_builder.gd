class_name RuntimeLevelBuilder
extends RefCounted
## Builds a playable level scene tree at runtime from a structured level
## Dictionary (the canonical JSON format documented in docs/map_syntax.md,
## "Option 2 — Structured JSON"). This is the in-engine equivalent of the
## Python pipeline (scripts/convert_map.py + scripts/generate_level.py): it
## reproduces the same node tree those tools bake into a level_XX.tscn, so a
## map created in the editor can be played directly in the browser without the
## offline compile step.
##
## Only consumes the *structured* format (absolute coordinates). ASCII-grid
## parsing stays in the editor, which exports this JSON.
##
## Usage:
##   var result := RuntimeLevelBuilder.build(level_dict)
##   if result.ok:
##       level_wrapper.add_child(result.root)   # root is a Node3D with a SpawnPoint

# --- Theme materials (mirrors THEMES in scripts/convert_map.py) ------------- #
const THEMES := {
	"forest": {"top": "res://materials/grass.tres", "rock": "res://materials/rock.tres"},
	"glacial": {"top": "res://materials/glacial_top.tres", "rock": "res://materials/glacial_rock.tres"},
	"cidade": {"top": "res://materials/cidade_top.tres", "rock": "res://materials/cidade_rock.tres"},
	"caverna": {"top": "res://materials/caverna_top.tres", "rock": "res://materials/caverna_rock.tres"},
}
const DEFAULT_THEME := "forest"
const WATER_MAT := "res://materials/water.tres"

# --- Object scenes ---------------------------------------------------------- #
const RING_SCENE := "res://scenes/ring.tscn"
const SPRING_SCENE := "res://scenes/spring.tscn"
const DASH_PAD_SCENE := "res://scenes/dash_pad.tscn"
const ENEMY_SCENE := "res://scenes/enemy.tscn"
const CACTUS_SCENE := "res://scenes/cactus_enemy.tscn"
const SPIKES_SCENE := "res://scenes/spikes.tscn"
const LEVEL_FINISH_SCENE := "res://scenes/level_finish.tscn"
const MOVING_PLATFORM_SCENE := "res://scenes/moving_platform.tscn"

# --- Safety limits for untrusted, user-generated maps ----------------------- #
# A shared/community map is just data (no code), so the only risk is a
# malformed or oversized payload hanging the browser. These caps keep the
# builder bounded; anything past them is a validation error.
const MAX_TERRAIN := 6000      # platforms + ramps
const MAX_OBJECTS := 12000     # rings + springs + pads + enemies + spikes + goals
const COORD_LIMIT := 1_000_000.0
const MAX_WIDTH := 100_000.0
const MAX_HEIGHT := 100_000.0

# 15-degree tilt applied to diagonal springs (matches generate_level.py).
const DIAG_SPRING_BASIS := Basis(
	Vector3(0.965926, 0.258819, 0),
	Vector3(-0.258819, 0.965926, 0),
	Vector3(0, 0, 1))

# Cache theme materials so identical platforms share one resource.
static var _mat_cache := {}


# Validates a level Dictionary. Returns { "errors": Array[String],
# "warnings": Array[String] }. Errors are fatal (build refuses / clamps);
# warnings mirror the pipeline's non-fatal notices (missing spawn/goal).
static func validate(data: Dictionary) -> Dictionary:
	var errors: Array[String] = []
	var warnings: Array[String] = []

	var terrain_count := _arr(data, "platforms").size() + _arr(data, "ramps_up").size() + _arr(data, "ramps_down").size()
	var object_count := _arr(data, "rings").size() + _arr(data, "springs_vert").size() \
			+ _arr(data, "springs_diag").size() + _arr(data, "dash_pads").size() \
			+ _arr(data, "enemies").size() + _arr(data, "cactus_enemies").size() \
			+ _arr(data, "spikes").size() + _arr(data, "goals").size() \
			+ _arr(data, "moving_platforms").size()

	if terrain_count > MAX_TERRAIN:
		errors.append("too much terrain (%d pieces; limit %d)" % [terrain_count, MAX_TERRAIN])
	if object_count > MAX_OBJECTS:
		errors.append("too many objects (%d; limit %d)" % [object_count, MAX_OBJECTS])

	if _arr(data, "platforms").is_empty() and _arr(data, "ramps_up").is_empty() and _arr(data, "ramps_down").is_empty():
		warnings.append("the map has no solid ground: the player will fall into the void.")
	if _arr(data, "goals").is_empty():
		warnings.append("no goal in the map: the level cannot be completed.")
	if not (data.get("spawn") is Array and (data["spawn"] as Array).size() >= 2):
		warnings.append("no spawn in the map: using the default spawn.")

	return {"errors": errors, "warnings": warnings}


# Builds the level. Returns { "ok": bool, "root": Node3D, "errors": [],
# "warnings": [] }. On validation errors, ok is false and root is null.
# Malformed individual entries are skipped defensively rather than aborting.
static func build(data: Dictionary) -> Dictionary:
	var report := validate(data)
	if not (report["errors"] as Array).is_empty():
		return {"ok": false, "root": null, "errors": report["errors"], "warnings": report["warnings"]}

	var theme := str(data.get("theme", DEFAULT_THEME)).strip_edges().to_lower()
	if not THEMES.has(theme):
		theme = DEFAULT_THEME
	var top_mat := _load_material(THEMES[theme]["top"])
	var rock_mat := _load_material(THEMES[theme]["rock"])

	var root := Node3D.new()
	root.name = "RuntimeLevel"

	# SpawnPoint (Marker3D) — Main reads this to place the player.
	var spawn := _vec2_from(data.get("spawn", [-12.0, 1.5]), -12.0, 1.5)
	var spawn_point := Marker3D.new()
	spawn_point.name = "SpawnPoint"
	spawn_point.position = Vector3(spawn.x, spawn.y, 0)
	root.add_child(spawn_point)

	# Level / TrackCSG (collision terrain) + water.
	var level := Node3D.new()
	level.name = "Level"
	root.add_child(level)

	var track := CSGCombiner3D.new()
	track.name = "TrackCSG"
	track.use_collision = true
	level.add_child(track)

	_build_terrain(track, data, top_mat, rock_mat)

	var water := MeshInstance3D.new()
	water.name = "WaterPlane"
	var water_mesh := BoxMesh.new()
	water_mesh.size = Vector3(5000, 2, 8)
	water_mesh.material = _load_material(WATER_MAT)
	water.mesh = water_mesh
	water.position = Vector3(1000, -7.5, 0)
	level.add_child(water)

	# InteractiveObjects (Rings / Enemies groups + loose objects).
	var objects := Node3D.new()
	objects.name = "InteractiveObjects"
	root.add_child(objects)
	var rings_group := Node3D.new()
	rings_group.name = "Rings"
	objects.add_child(rings_group)
	var enemies_group := Node3D.new()
	enemies_group.name = "Enemies"
	objects.add_child(enemies_group)

	_build_objects(objects, rings_group, enemies_group, data, top_mat, rock_mat)

	return {"ok": true, "root": root, "errors": [], "warnings": report["warnings"]}


# --- Terrain --------------------------------------------------------------- #
static func _build_terrain(track: CSGCombiner3D, data: Dictionary, top_mat: Material, rock_mat: Material) -> void:
	var platforms := _arr(data, "platforms")
	var i := 0
	for plat in platforms:
		if not plat is Dictionary:
			continue
		var rock_height := _resolve_rock_height(plat, platforms)
		_add_platform(track, "Platform_%d" % i, plat, rock_height, top_mat, rock_mat)
		i += 1

	i = 0
	for ramp in _arr(data, "ramps_up"):
		if not ramp is Dictionary:
			continue
		_add_ramp_up(track, "RampUp_%d" % i, ramp, top_mat, rock_mat)
		i += 1

	i = 0
	for ramp in _arr(data, "ramps_down"):
		if not ramp is Dictionary:
			continue
		_add_ramp_down(track, "RampDown_%d" % i, ramp, top_mat, rock_mat)
		i += 1


# Resolves a platform's rock base height, mirroring the JSON normalization in
# convert_map.py: an explicit rock_height wins; otherwise a platform above Y=0
# with no other platform supporting it within 5 m below is "floating" and gets a
# thin 1 m base, while grounded platforms get the full 4 m.
static func _resolve_rock_height(plat: Dictionary, platforms: Array) -> float:
	if plat.has("rock_height"):
		return clampf(_num(plat, "rock_height", 4.0), 0.1, MAX_HEIGHT)

	var y := _num(plat, "y", 0.0)
	var is_floating := y > 0.0
	if is_floating:
		var half := _num(plat, "width", 2.0) / 2.0
		var x_min := _num(plat, "x", 0.0) - half
		var x_max := _num(plat, "x", 0.0) + half
		for other in platforms:
			if not other is Dictionary or other == plat:
				continue
			var other_half := _num(other, "width", 2.0) / 2.0
			var other_min := _num(other, "x", 0.0) - other_half
			var other_max := _num(other, "x", 0.0) + other_half
			if not (x_max <= other_min or x_min >= other_max):
				var oy := _num(other, "y", 0.0)
				if oy < y and oy >= y - 5.0:
					is_floating = false
					break
	return 1.0 if is_floating else 4.0


static func _add_platform(track: CSGCombiner3D, name: String, plat: Dictionary, rock_height: float, top_mat: Material, rock_mat: Material) -> void:
	var x := _num(plat, "x", 0.0)
	var y := _num(plat, "y", 0.0)
	var width := clampf(_num(plat, "width", 2.0), 0.1, MAX_WIDTH)
	var grass := bool(plat.get("grass", true))
	if not _in_bounds(x, y):
		return

	# Top slab: grass for exposed (walkable) surfaces, rock for interior walls.
	var top := CSGBox3D.new()
	top.name = name
	top.size = Vector3(width, 1, 4)
	top.material = top_mat if grass else rock_mat
	top.position = Vector3(x, y, 0)
	track.add_child(top)

	# Sub rock structure.
	var rock := CSGBox3D.new()
	rock.name = name + "Rock"
	rock.size = Vector3(width, rock_height, 3.8)
	rock.material = rock_mat
	rock.position = Vector3(x, y - 0.5 - (rock_height / 2.0), 0)
	track.add_child(rock)


static func _add_ramp_up(track: CSGCombiner3D, name: String, ramp: Dictionary, top_mat: Material, rock_mat: Material) -> void:
	var x := _num(ramp, "x", 0.0)
	var y := _num(ramp, "y", 0.0)
	var width := clampf(_num(ramp, "width", 2.0), 0.1, MAX_WIDTH)
	var height := clampf(_num(ramp, "height", 3.0), 0.1, MAX_HEIGHT)
	var bottom := -2.0
	if not _in_bounds(x, y):
		return

	# Grass cap: 1.0m vertical thickness parallel slab
	var grass_poly := PackedVector2Array([
		Vector2(0, 0), Vector2(width, height), Vector2(width, height - 1.0), Vector2(0, -1.0)])

	# Sub rock base
	var rock_poly := PackedVector2Array([
		Vector2(0, -1.0), Vector2(width, height - 1.0), Vector2(width, bottom), Vector2(0, bottom)])

	var top := CSGPolygon3D.new()
	top.name = name
	top.polygon = grass_poly
	top.depth = 4.0
	top.material = top_mat
	top.position = Vector3(x, y, 2.0)
	track.add_child(top)

	var rock := CSGPolygon3D.new()
	rock.name = name + "SubRock"
	rock.polygon = rock_poly
	rock.depth = 3.8
	rock.material = rock_mat
	rock.position = Vector3(x, y, 1.9)
	track.add_child(rock)


static func _add_ramp_down(track: CSGCombiner3D, name: String, ramp: Dictionary, top_mat: Material, rock_mat: Material) -> void:
	var x := _num(ramp, "x", 0.0)
	var start_y := _num(ramp, "y", 0.0)
	var width := clampf(_num(ramp, "width", 2.0), 0.1, MAX_WIDTH)
	var height := clampf(_num(ramp, "height", 3.0), 0.1, MAX_HEIGHT)
	var bottom := -3.0
	if not _in_bounds(x, start_y):
		return

	var end_y := start_y - height

	# Grass cap: 1.0m vertical thickness parallel slab
	var grass_poly := PackedVector2Array([
		Vector2(0, height), Vector2(width, 0), Vector2(width, -1.0), Vector2(0, height - 1.0)])

	# Sub rock base
	var rock_poly := PackedVector2Array([
		Vector2(0, height - 1.0), Vector2(width, -1.0), Vector2(width, bottom), Vector2(0, bottom)])

	var top := CSGPolygon3D.new()
	top.name = name
	top.polygon = grass_poly
	top.depth = 4.0
	top.material = top_mat
	top.position = Vector3(x, end_y, 2.0)
	track.add_child(top)

	var rock := CSGPolygon3D.new()
	rock.name = name + "SubRock"
	rock.polygon = rock_poly
	rock.depth = 3.8
	rock.material = rock_mat
	rock.position = Vector3(x, end_y, 1.9)
	track.add_child(rock)


# --- Interactive objects --------------------------------------------------- #
static func _build_objects(objects: Node3D, rings_group: Node3D, enemies_group: Node3D, data: Dictionary, top_mat: Material, rock_mat: Material) -> void:
	var ring_scene := _load_scene(RING_SCENE)
	var spring_scene := _load_scene(SPRING_SCENE)
	var dash_scene := _load_scene(DASH_PAD_SCENE)
	var enemy_scene := _load_scene(ENEMY_SCENE)
	var cactus_scene := _load_scene(CACTUS_SCENE)
	var spikes_scene := _load_scene(SPIKES_SCENE)
	var finish_scene := _load_scene(LEVEL_FINISH_SCENE)

	var i := 0
	for r in _arr(data, "rings"):
		var p: Variant = _pair(r)
		if p != null and ring_scene != null:
			_place(ring_scene, rings_group, "Ring_%d" % i, p as Vector2)
		i += 1

	i = 0
	for s in _arr(data, "springs_vert"):
		if s is Dictionary and spring_scene != null:
			var inst := _place(spring_scene, objects, "SpringV_%d" % i, Vector2(_num(s, "x", 0.0), _num(s, "y", 0.0)))
		i += 1

	i = 0
	for s in _arr(data, "springs_diag"):
		if s is Dictionary and spring_scene != null:
			var pos := Vector2(_num(s, "x", 0.0), _num(s, "y", 0.0))
			if _in_bounds(pos.x, pos.y):
				var inst := spring_scene.instantiate()
				inst.name = "SpringD_%d" % i
				inst.set("LaunchDirection", Vector3(_num(s, "dx", 1.2), _num(s, "dy", 1.5), 0))
				inst.set("ControlLockDuration", _num(s, "lock", 0.6))
				inst.transform = Transform3D(DIAG_SPRING_BASIS, Vector3(pos.x, pos.y, 0))
				objects.add_child(inst)
		i += 1

	i = 0
	for d in _arr(data, "dash_pads"):
		var p: Variant = _pair(d)
		if p != null and dash_scene != null:
			_place(dash_scene, objects, "DashPad_%d" % i, p as Vector2)
		i += 1

	i = 0
	for e in _arr(data, "enemies"):
		if e is Dictionary and enemy_scene != null:
			var inst := _place(enemy_scene, enemies_group, "Enemy_%d" % i, Vector2(_num(e, "x", 0.0), _num(e, "y", 0.0)))
			if inst != null:
				inst.set("Speed", _num(e, "speed", 3.0))
		i += 1

	i = 0
	for e in _arr(data, "cactus_enemies"):
		if e is Dictionary and cactus_scene != null:
			var inst := _place(cactus_scene, enemies_group, "Cactus_%d" % i, Vector2(_num(e, "x", 0.0), _num(e, "y", 0.0)))
			if inst != null:
				inst.set("Speed", _num(e, "speed", 1.25))
		i += 1

	i = 0
	for s in _arr(data, "spikes"):
		var p: Variant = _pair(s)
		if p != null and spikes_scene != null:
			_place(spikes_scene, objects, "Spikes_%d" % i, p as Vector2)
		i += 1

	i = 0
	for g in _arr(data, "goals"):
		var p: Variant = _pair(g)
		if p != null and finish_scene != null:
			_place(finish_scene, objects, "Goal_%d" % i, p as Vector2)
		i += 1

	var moving_platform_scene := _load_scene(MOVING_PLATFORM_SCENE)
	i = 0
	for mp in _arr(data, "moving_platforms"):
		if mp is Dictionary and moving_platform_scene != null:
			var pos := Vector2(_num(mp, "x", 0.0), _num(mp, "y", 0.0))
			var inst := _place(moving_platform_scene, objects, "MovingPlatform_%d" % i, pos)
			if inst != null:
				inst.set("direction", str(mp.get("direction", "horizontal")))
				inst.set("travel_range", _num(mp, "range", 4.0))
				inst.set("speed", _num(mp, "speed", 2.0))
				inst.set("width", _num(mp, "width", 2.0))
				inst.set("rock_height", _num(mp, "rock_height", 4.0))
				if inst.has_method("setup_materials"):
					inst.call("setup_materials", top_mat, rock_mat)
		i += 1


# Instantiates scene, names it, positions it (skipping out-of-bounds), and
# parents it. Returns the instance, or null if skipped.
static func _place(scene: PackedScene, parent: Node, name: String, pos: Vector2) -> Node:
	if not _in_bounds(pos.x, pos.y):
		return null
	var inst := scene.instantiate()
	inst.name = name
	inst.set("position", Vector3(pos.x, pos.y, 0))
	parent.add_child(inst)
	return inst


# --- Helpers --------------------------------------------------------------- #
static func _arr(data: Dictionary, key: String) -> Array:
	var v: Variant = data.get(key, [])
	return v if v is Array else []


static func _num(d: Dictionary, key: String, default: float) -> float:
	var v: Variant = d.get(key, default)
	return float(v) if (v is float or v is int) else default


# Reads a [x, y] pair; returns Vector2 or null when malformed.
static func _pair(v: Variant) -> Variant:
	if v is Array and (v as Array).size() >= 2:
		var a := v as Array
		if (a[0] is float or a[0] is int) and (a[1] is float or a[1] is int):
			return Vector2(float(a[0]), float(a[1]))
	return null


static func _vec2_from(v: Variant, dx: float, dy: float) -> Vector2:
	var p: Variant = _pair(v)
	if p != null:
		return p as Vector2
	return Vector2(dx, dy)


static func _in_bounds(x: float, y: float) -> bool:
	return absf(x) <= COORD_LIMIT and absf(y) <= COORD_LIMIT


static func _load_material(path: String) -> Material:
	if _mat_cache.has(path):
		return _mat_cache[path]
	var mat: Material = load(path) if ResourceLoader.exists(path) else null
	_mat_cache[path] = mat
	return mat


static func _load_scene(path: String) -> PackedScene:
	return load(path) if ResourceLoader.exists(path) else null
