class_name GameSettings
extends RefCounted
## Global static state shared across scenes (level, joypad, language, audio).
## Ported from GameSettings.cs; stays a static class (no autoload needed).

static var selected_joypad_id := -1 # -1 means All/Auto
static var level_to_load := "res://scenes/levels/level_01.tscn"
# A structured level Dictionary (canonical JSON format) to build in-engine via
# RuntimeLevelBuilder instead of loading a packed level scene. Set by the
# custom-level flow (map editor / community levels); empty means "load a .tscn".
static var pending_custom_map: Dictionary = {}
# Theme of the level being loaded ("forest"/"glacial"/"cidade"/"caverna"),
# set by the menu from the level manifest; empty means "detect in Main".
static var level_theme := ""
static var language := "pt" # "pt" (default) or "en"

# Music volume (0..1 linear), routed through a dedicated "Music" audio bus.
static var music_volume := 0.6

# Sound theme selection: "procedural" or a theme name scanned from
# res://audio/effects/ (e.g., "Menu_Sounds_V2_Minimalistic")
static var sound_theme := "procedural"


# Key the web map editor writes the level-under-test into (window.localStorage).
# Mirrors TEST_MAP_KEY in tools/map_editor/app.js.
const WEB_TEST_MAP_KEY := "pacoca_test_map"


# Web only: if the game was opened by the map editor's "Testar" button
# (play/?custom=1), read the structured level it stashed in localStorage and load
# it via RuntimeLevelBuilder. Returns true if a custom map was consumed, in which
# case the caller should jump straight to main.tscn. No-op on native builds.
static func consume_web_custom_map() -> bool:
	if not OS.has_feature("web"):
		return false

	var search := str(JavaScriptBridge.eval("window.location.search || ''", true))
	if not search.contains("custom=1"):
		return false

	var raw: Variant = JavaScriptBridge.eval(
			"window.localStorage.getItem('%s')" % WEB_TEST_MAP_KEY, true)
	if raw == null or str(raw).is_empty():
		printerr("game_settings.gd: custom=1 but no '%s' in localStorage" % WEB_TEST_MAP_KEY)
		return false

	var parsed: Variant = JSON.parse_string(str(raw))
	if parsed is Dictionary:
		pending_custom_map = parsed
		print("game_settings.gd: loaded custom map from localStorage (web)")
		return true

	printerr("game_settings.gd: '%s' is not a JSON object" % WEB_TEST_MAP_KEY)
	return false


# Loads a sound effect. Prefers the imported resource, but falls back to reading
# the raw .wav file directly and parsing its PCM data.
static func load_sfx(path: String) -> AudioStream:
	if ResourceLoader.exists(path):
		var res := load(path) as AudioStream
		if res != null:
			return res

	if path.to_lower().ends_with(".wav") and FileAccess.file_exists(path):
		var f := FileAccess.open(path, FileAccess.READ)
		if f != null:
			var bytes := f.get_buffer(f.get_length())
			if bytes.size() > 44:
				var riff := bytes.slice(0, 4).get_string_from_ascii()
				var wave := bytes.slice(8, 12).get_string_from_ascii()
				if riff == "RIFF" and wave == "WAVE":
					var pos := 12
					var channels := 1
					var sample_rate := 44100
					var bits_per_sample := 16
					var data := PackedByteArray()

					while pos + 8 <= bytes.size():
						var chunk_id := bytes.slice(pos, pos + 4).get_string_from_ascii()
						var chunk_size := bytes.decode_u32(pos + 4)
						pos += 8

						if chunk_id == "fmt ":
							if pos + 16 <= bytes.size():
								channels = bytes.decode_u16(pos + 2)
								sample_rate = bytes.decode_u32(pos + 4)
								bits_per_sample = bytes.decode_u16(pos + 14)
						elif chunk_id == "data":
							var end := mini(pos + chunk_size, bytes.size())
							data = bytes.slice(pos, end)
							break
						pos += chunk_size

					if data.size() > 0:
						var wav_stream := AudioStreamWAV.new()
						wav_stream.data = data
						wav_stream.format = AudioStreamWAV.FORMAT_8_BITS if bits_per_sample == 8 else AudioStreamWAV.FORMAT_16_BITS
						wav_stream.loop_mode = AudioStreamWAV.LOOP_DISABLED
						wav_stream.mix_rate = sample_rate
						wav_stream.stereo = channels == 2
						return wav_stream

	printerr("[GameSettings] Could not load SFX: %s" % path)
	return null


# Scans res://audio/effects/ for wav files to detect sound themes dynamically.
static func get_available_sound_themes() -> Array[String]:
	var themes: Array[String] = ["procedural"]
	var dir := DirAccess.open("res://audio/effects/")
	if dir != null:
		dir.list_dir_begin()
		var file_name := dir.get_next()
		while file_name != "":
			if not dir.current_is_dir() and file_name.ends_with(".wav") and file_name.begins_with("Menu_Sounds_"):
				var last_underscore := file_name.rfind("_")
				if last_underscore > 12:
					var theme_prefix := file_name.substr(0, last_underscore)
					if not themes.has(theme_prefix):
						themes.append(theme_prefix)
			file_name = dir.get_next()
	return themes


# Translates the theme name for display in option button.
static func get_theme_display_name(theme: String, is_pt: bool) -> String:
	if theme == "procedural":
		return "Sintético (Retro)" if is_pt else "Synthetic (Retro)"
	if theme == "Menu_Sounds_V2_Minimalistic":
		return "Minimalista V2" if is_pt else "Minimalist V2"
	var display_name := theme
	if display_name.begins_with("Menu_Sounds_"):
		display_name = display_name.substr("Menu_Sounds_".length())
	return display_name.replace("_", " ")


# Loads a music track. Prefers the imported resource, but falls back to reading
# the raw file directly so it works even when the .ogg/.mp3 has no .import sidecar yet.
static func load_music(path: String) -> AudioStream:
	if ResourceLoader.exists(path):
		var res := load(path) as AudioStream
		if res != null:
			return res

	var lower := path.to_lower()
	if lower.ends_with(".ogg") and FileAccess.file_exists(path):
		var ogg := AudioStreamOggVorbis.load_from_file(path)
		if ogg != null:
			return ogg

	if lower.ends_with(".mp3") and FileAccess.file_exists(path):
		var f := FileAccess.open(path, FileAccess.READ)
		if f != null:
			var mp3 := AudioStreamMP3.new()
			mp3.data = f.get_buffer(f.get_length())
			return mp3

	printerr("[GameSettings] Could not load music: %s" % path)
	return null


# Creates the "Music" audio bus at runtime if it doesn't exist yet and applies
# the current music_volume. Music players should set bus = "Music".
static func ensure_music_bus() -> void:
	if AudioServer.get_bus_index("Music") == -1:
		AudioServer.add_bus()
		var idx := AudioServer.bus_count - 1
		AudioServer.set_bus_name(idx, "Music")
		AudioServer.set_bus_send(idx, "Master")
	apply_music_volume()


# Applies music_volume to the "Music" bus. Mutes the bus at (near) zero to avoid
# -inf dB artifacts.
static func apply_music_volume() -> void:
	var idx := AudioServer.get_bus_index("Music")
	if idx == -1:
		return

	if music_volume <= 0.0001:
		AudioServer.set_bus_mute(idx, true)
	else:
		AudioServer.set_bus_mute(idx, false)
		AudioServer.set_bus_volume_db(idx, linear_to_db(music_volume))


static func apply_joypad_settings() -> void:
	# Rebind every joypad event in the InputMap to the selected device.
	for action in InputMap.get_actions():
		for ev in InputMap.action_get_events(action):
			if ev is InputEventJoypadButton or ev is InputEventJoypadMotion:
				ev.device = selected_joypad_id

	# Also pre-map common buttons to ensure immediate out-of-the-box compatibility
	_pre_map_default_buttons()

	print("[GameSettings] Applied joypad device ID: %d" % selected_joypad_id)


static func _pre_map_default_buttons() -> void:
	# Add common joypad buttons (0=A/Cross, 1=B/Circle, 2=X/Square, 3=Y/Triangle,
	# 6=Start) to "ui_accept" and "jump" so standard USB gamepads work immediately.
	var common_buttons := [0, 1, 2, 3, 6]
	var actions := ["ui_accept", "jump"]

	for action in actions:
		if not InputMap.has_action(action):
			continue

		for btn_id in common_buttons:
			var exists := false
			for ev in InputMap.action_get_events(action):
				if ev is InputEventJoypadButton and int(ev.button_index) == btn_id and ev.device == selected_joypad_id:
					exists = true
					break

			if not exists:
				var new_event := InputEventJoypadButton.new()
				new_event.device = selected_joypad_id
				new_event.button_index = btn_id as JoyButton
				InputMap.action_add_event(action, new_event)


# Notifies the map editor's local server that the game is exiting (best effort;
# the callers quit ~0.25s later, enough for the request to leave).
static func finalize_telemetry(node: Node) -> void:
	var telemetry_url := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--telemetry="):
			telemetry_url = arg.substr("--telemetry=".length()).strip_edges().rstrip("/") + "/api/telemetry"
			break
		if arg == "--telemetry":
			telemetry_url = "http://127.0.0.1:8000/api/telemetry"
			break

	if telemetry_url.is_empty() or node == null or node.get_tree() == null:
		return

	print("[GameSettings] Finalizing telemetry at: %s" % telemetry_url)
	var req := HTTPRequest.new()
	node.get_tree().root.add_child(req)
	req.request(telemetry_url, ["Content-Type: application/json"], HTTPClient.METHOD_POST, "{\"exit\":true}")


# Leaving the game via a "Sair"/"Exit" button. On the web build the game is
# embedded at /play/ (opened by a full-page navigation from the site), so
# get_tree().quit() does nothing useful — instead send the browser back to the
# site page the player came from (history), falling back to the site root.
# Returns true if it handled the exit (web); false on native so the caller can
# fall back to get_tree().quit().
static func exit_to_site() -> bool:
	if not OS.has_feature("web"):
		return false
	JavaScriptBridge.eval(
		"(function(){ if (window.history.length > 1) { window.history.back(); }" +
		" else { window.location.href = '../'; } })();", true)
	return true
