class_name Main
extends Node3D

@export var LevelToLoad := "res://scenes/levels/level_01.tscn"

var _level_wrapper: Node3D
var _player: Player
var _camera: CameraController
var _finish_screen: LevelFinishScreen

# Background music player (gameplay theme)
var _music_player: AudioStreamPlayer


func _ready() -> void:
	_apply_cmdline_level_override()

	_level_wrapper = get_node("LevelWrapper")
	_player = get_node("Player")
	_camera = get_node("Camera3D")
	_finish_screen = get_node("HUDLayer/LevelFinishScreen")

	# Setup background music (gameplay theme), routed through the shared "Music" bus
	# controlled by the options volume slider. volume_db is used as a fade envelope.
	GameSettings.ensure_music_bus()
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = "Music"
	# Force real-stream playback: on the Web export the default playback type is
	# "Sample", which only supports WAV. MP3 streams "cannot be sampled" and stay
	# silent, so decode/stream them instead.
	_music_player.playback_type = AudioServer.PLAYBACK_TYPE_STREAM
	add_child(_music_player)
	var gameplay_music := GameSettings.load_music("res://audio/game-play-01.mp3")
	if gameplay_music is AudioStreamMP3:
		gameplay_music.loop = true
	_music_player.stream = gameplay_music
	_music_player.volume_db = -40.0
	_music_player.play()
	var fade := create_tween()
	fade.tween_property(_music_player, "volume_db", 0.0, 1.0)

	_load_level()


# Lets the map editor's "Testar fase" button launch straight into a level:
#   Godot --path src scenes/main.tscn -- --level=04
#   Godot --path src scenes/main.tscn -- --level=res://scenes/levels/level_04.tscn
func _apply_cmdline_level_override() -> void:
	for arg in OS.get_cmdline_user_args():
		# --custom-map=<path.json>: build a structured JSON map at runtime (used
		# by the map editor's "test custom level" flow and for validation).
		if arg.begins_with("--custom-map="):
			var map_path := arg.substr("--custom-map=".length()).strip_edges()
			if map_path.is_empty() or not FileAccess.file_exists(map_path):
				printerr("main.gd: --custom-map file not found: %s" % map_path)
				continue
			var parsed: Variant = JSON.parse_string(FileAccess.open(map_path, FileAccess.READ).get_as_text())
			if parsed is Dictionary:
				GameSettings.pending_custom_map = parsed
				print("main.gd: custom map override from cmdline -> %s" % map_path)
			else:
				printerr("main.gd: --custom-map is not a JSON object: %s" % map_path)
			continue

		if not arg.begins_with("--level="):
			continue

		var val := arg.substr("--level=".length()).strip_edges()
		if val.is_empty():
			continue

		var path := val if val.begins_with("res://") else "res://scenes/levels/level_%s.tscn" % val
		GameSettings.level_to_load = path
		# The menu didn't run, so its theme choice (if any) is stale.
		GameSettings.level_theme = ""
		print("main.gd: Level override from cmdline -> %s" % path)


func _load_level() -> void:
	# Custom maps (map editor / community levels) are built in-engine from the
	# structured JSON; builtin levels load a packed .tscn.
	var level_instance: Node3D
	var level_path := ""
	if not GameSettings.pending_custom_map.is_empty():
		level_instance = _build_custom_level()
		if level_instance == null:
			return
	else:
		level_path = GameSettings.level_to_load
		if level_path.is_empty():
			level_path = LevelToLoad
		if level_path.is_empty():
			printerr("main.gd: Level path is not set.")
			return

		# Clean up any existing level inside the wrapper
		for child in _level_wrapper.get_children():
			child.queue_free()

		# Load and instance the new level scene
		var level_scene := load(level_path) as PackedScene
		if level_scene == null:
			printerr("main.gd: Failed to load level scene at path '%s'" % level_path)
			return

		level_instance = level_scene.instantiate() as Node3D
		_level_wrapper.add_child(level_instance)

	# Find SpawnPoint (Marker3D) inside the loaded level
	var spawn_point: Marker3D = level_instance.get_node_or_null("SpawnPoint")
	if spawn_point != null:
		# Set Player position to spawn point
		_player.global_position = spawn_point.global_position
		_player.SpawnPosition = spawn_point.global_position
	else:
		print("main.gd: SpawnPoint not found in level scene. Using default spawn position.")

	# Reset camera limits and immediately snap the camera
	_camera.reset_camera_limits()

	# After the camera snapped: the backdrop anchors to its rest height.
	_setup_parallax_background(level_instance, level_path)


# Builds a custom level from GameSettings.pending_custom_map via the runtime
# builder. Returns the level root (already parented under LevelWrapper), or null
# if the map is invalid.
func _build_custom_level() -> Node3D:
	var map := GameSettings.pending_custom_map
	# The map's own theme drives the parallax backdrop (menu selection is stale
	# for custom levels).
	GameSettings.level_theme = str(map.get("theme", "forest"))

	var result := RuntimeLevelBuilder.build(map)
	for w in result["warnings"]:
		print("main.gd: custom level warning: %s" % w)
	if not result["ok"]:
		for e in result["errors"]:
			printerr("main.gd: custom level error: %s" % e)
		return null

	for child in _level_wrapper.get_children():
		child.queue_free()
	var root: Node3D = result["root"]
	_level_wrapper.add_child(root)
	return root


# Swaps the legacy stretched BG_Mountains quad for the camera-following
# parallax backdrop, themed after the level. Runs on every level (old,
# hand-made, or map-editor output) without requiring a recompile.
func _setup_parallax_background(level_instance: Node3D, level_path: String) -> void:
	var old_bg: MeshInstance3D = level_instance.get_node_or_null("Level/BG_Mountains")
	if old_bg != null:
		old_bg.visible = false

	var backdrop := ParallaxBackground3D.new()
	backdrop.name = "ParallaxBackdrop"
	backdrop.LevelTheme = _detect_level_theme(level_path)
	level_instance.add_child(backdrop)


# Theme priority: menu selection > levels.json manifest (map-editor test
# runs bypass the menu) > filename convention > forest.
static func _detect_level_theme(level_path: String) -> String:
	if not GameSettings.level_theme.is_empty():
		return GameSettings.level_theme

	const MANIFEST_PATH := "res://scenes/levels/levels.json"
	if FileAccess.file_exists(MANIFEST_PATH):
		var file := FileAccess.open(MANIFEST_PATH, FileAccess.READ)
		var parsed: Variant = JSON.parse_string(file.get_as_text())
		if parsed is Dictionary and parsed.has("levels"):
			for item in parsed["levels"]:
				if item is Dictionary and item.get("scene", "") == level_path and item.has("theme"):
					return str(item["theme"])

	var file_name := level_path.get_file()
	for t in ["glacial", "cidade", "caverna"]:
		if file_name.begins_with("level_%s_" % t):
			return t
	return "forest"


func restart_stage() -> void:
	_load_level()


func complete_level(rings: int, score: int, time_elapsed: float) -> void:
	# Stop background gameplay music with fade out
	if _music_player != null and _music_player.playing:
		var fade := create_tween()
		fade.tween_property(_music_player, "volume_db", -40.0, 0.8)
		fade.tween_callback(_music_player.stop)

	# Display completion statistics overlay screen
	_finish_screen.show_screen(rings, score, time_elapsed)
