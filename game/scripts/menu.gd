class_name Menu
extends Control

var _start_button: Button
var _config_button: Button
var _exit_button: Button
var _credits_button: Button

var _trophy_button: Button
var _gear_button: Button

var _back_button: Button
var _map_button: Button
var _joy_option_button: OptionButton
var _map_instructions_label: Label

var _config_panel: PanelContainer
var _level_panel: PanelContainer
var _credits_panel: PanelContainer
var _achievements_panel: PanelContainer

var _level1_button: Button
var _level2_button: Button
var _level3_button: Button
var _level4_button: Button
var _level_back_button: Button


# Dynamic level list, built from scenes/levels/levels.json (written by the
# map pipeline) plus a directory scan, so user-created levels show up in
# the menu without touching this code. Builtin levels (shipped with the
# game) are listed under their theme; everything else goes to the
# "FASES CUSTOM" list. _level1_button is kept invisible and used only as
# the style template for the generated buttons.
class LevelEntry:
	var id := ""
	var name := ""
	var theme := "forest"
	var scene := ""
	# Builtin levels ship with the game and are listed under their theme.
	# Everything else (map-editor output, manifest entries without the
	# flag, dir-scanned scenes) is a custom level.
	var builtin := false

var _levels: Array[LevelEntry] = []
var _dynamic_level_buttons: Array[Button] = []
var _level_list_box: VBoxContainer
var _level_list_empty_label: Label

var _credits_back_button: Button
var _achievements_back_button: Button

# New theme panel and card buttons
var _theme_panel: PanelContainer
var _forest_button: Button
var _glacial_button: Button
var _city_button: Button
var _cave_button: Button
var _custom_levels_button: Button
var _theme_back_button: Button

# Language selector nodes
var _lang_option_button: OptionButton
var _lang_label: Label

# Dynamic sound effects theme selector
var _sfx_theme_label: Label
var _sfx_theme_option_button: OptionButton
var _sfx_wav_player: AudioStreamPlayer

var _selected_theme := "forest"
var _is_mapping_input := false

# Procedural sound effects player
var _audio_player: AudioStreamPlayer
var _audio_playback: AudioStreamGeneratorPlayback

# Background music player (title theme)
var _music_player: AudioStreamPlayer
var _music_volume_slider: HSlider

# Fade envelope constants (applied to the music player's volume_db)
const MUSIC_SILENT_DB := -40.0
const MUSIC_FADE_TIME := 1.0

# List of buttons to animate focus scale
var _animated_buttons: Array[Button] = []


func _ready() -> void:
	# Web: inherit the site's language (English site -> English game, etc.).
	# Must run before the custom-map jump below so community/editor levels that
	# skip the menu still pick up the right language.
	GameSettings.apply_web_language()

	# Web: the map editor can hand a level to the WASM build via localStorage
	# (opened as play/?custom=1). Jump straight into it, skipping the menu.
	if GameSettings.consume_web_custom_map():
		get_tree().change_scene_to_file("res://scenes/main.tscn")
		return

	# Setup WAV sound player
	_sfx_wav_player = AudioStreamPlayer.new()
	_sfx_wav_player.bus = "Master"
	add_child(_sfx_wav_player)

	# Setup procedural audio player
	_audio_player = AudioStreamPlayer.new()
	add_child(_audio_player)
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = 44100.0
	generator.buffer_length = 0.1
	_audio_player.stream = generator
	_audio_player.play()
	_audio_playback = _audio_player.get_stream_playback() as AudioStreamGeneratorPlayback

	# Setup background music (title theme), routed through the "Music" bus so the
	# volume slider controls it globally. The player's own volume_db is used purely
	# as a fade envelope.
	GameSettings.ensure_music_bus()
	_music_player = AudioStreamPlayer.new()
	_music_player.bus = "Music"
	# Force real-stream playback: on the Web export the default playback type is
	# "Sample", which only supports WAV. MP3 streams "cannot be sampled" and stay
	# silent, so decode/stream them instead.
	_music_player.playback_type = AudioServer.PLAYBACK_TYPE_STREAM
	add_child(_music_player)
	var menu_music := GameSettings.load_music("res://audio/menu.ogg")
	if menu_music is AudioStreamOggVorbis or menu_music is AudioStreamMP3:
		menu_music.loop = true
	_music_player.stream = menu_music
	_music_player.volume_db = MUSIC_SILENT_DB
	_music_player.play()
	_fade_music(0.0, MUSIC_FADE_TIME)

	# Main Menu references
	_start_button = get_node("MainMenuContainer/JogarButton")
	_config_button = get_node("MainMenuContainer/OpcoesButton")
	_credits_button = get_node("MainMenuContainer/CreditosButton")
	_exit_button = get_node("MainMenuContainer/SairButton")

	# Corner Button references
	_trophy_button = get_node("TopLeftContainer/TrophyButton")
	_gear_button = get_node("TopRightContainer/GearButton")

	# Config Menu references
	_back_button = get_node("ConfigPanel/MarginContainer/VBoxContainer/BackButton")
	_map_button = get_node("ConfigPanel/MarginContainer/VBoxContainer/MapButton")
	_joy_option_button = get_node("ConfigPanel/MarginContainer/VBoxContainer/JoyOptionButton")
	_map_instructions_label = get_node("ConfigPanel/MarginContainer/VBoxContainer/MapInstructionsLabel")
	_config_panel = get_node("ConfigPanel")
	_music_volume_slider = get_node("ConfigPanel/MarginContainer/VBoxContainer/MusicVolumeSlider")
	_music_volume_slider.value = GameSettings.music_volume
	_music_volume_slider.value_changed.connect(_on_music_volume_changed)

	# Language Option references
	_lang_option_button = get_node("ConfigPanel/MarginContainer/VBoxContainer/LangOptionButton")
	_lang_label = get_node("ConfigPanel/MarginContainer/VBoxContainer/LangLabel")

	# Dynamically instantiate and style SFX theme selector nodes
	var vbox: VBoxContainer = get_node("ConfigPanel/MarginContainer/VBoxContainer")

	_sfx_theme_label = Label.new()
	_sfx_theme_label.name = "SfxThemeLabel"
	_sfx_theme_label.label_settings = _lang_label.label_settings

	_sfx_theme_option_button = OptionButton.new()
	_sfx_theme_option_button.name = "SfxThemeOptionButton"
	_sfx_theme_option_button.custom_minimum_size = Vector2(0, 44)
	_sfx_theme_option_button.alignment = HORIZONTAL_ALIGNMENT_CENTER

	_sfx_theme_option_button.add_theme_font_override("font", _lang_option_button.get_theme_font("font"))
	_sfx_theme_option_button.add_theme_font_size_override("font_size", _lang_option_button.get_theme_font_size("font_size"))
	_sfx_theme_option_button.add_theme_stylebox_override("normal", _lang_option_button.get_theme_stylebox("normal"))
	_sfx_theme_option_button.add_theme_stylebox_override("hover", _lang_option_button.get_theme_stylebox("hover"))
	_sfx_theme_option_button.add_theme_stylebox_override("pressed", _lang_option_button.get_theme_stylebox("pressed"))
	_sfx_theme_option_button.add_theme_stylebox_override("focus", _lang_option_button.get_theme_stylebox("focus"))

	# Insert SFX theme options before LangLabel
	var lang_label_index := _lang_label.get_index()
	vbox.add_child(_sfx_theme_label)
	vbox.move_child(_sfx_theme_label, lang_label_index)
	vbox.add_child(_sfx_theme_option_button)
	vbox.move_child(_sfx_theme_option_button, lang_label_index + 1)

	_sfx_theme_option_button.item_selected.connect(_on_sfx_theme_selected)

	# Theme Panel references
	_theme_panel = get_node("ThemePanel")
	_forest_button = get_node("ThemePanel/MarginContainer/VBoxContainer/GridContainer/ForestButton")
	_glacial_button = get_node("ThemePanel/MarginContainer/VBoxContainer/GridContainer/GlacialButton")
	_city_button = get_node("ThemePanel/MarginContainer/VBoxContainer/GridContainer/CityButton")
	_cave_button = get_node("ThemePanel/MarginContainer/VBoxContainer/GridContainer/CaveButton")
	_theme_back_button = get_node("ThemePanel/MarginContainer/VBoxContainer/ThemeBackButton")

	# "Custom levels" button: levels compiled by the map editor (builtin=false
	# in the manifest) get their own list, separate from the shipped themes.
	# Cloned from ThemeBackButton so it inherits the panel's button style.
	_custom_levels_button = _theme_back_button.duplicate()
	_custom_levels_button.name = "CustomLevelsButton"
	var theme_vbox: VBoxContainer = get_node("ThemePanel/MarginContainer/VBoxContainer")
	theme_vbox.add_child(_custom_levels_button)
	theme_vbox.move_child(_custom_levels_button, _theme_back_button.get_index())

	# Level Panel references
	_level1_button = get_node("LevelPanel/MarginContainer/VBoxContainer/Level1Button")
	_level2_button = get_node("LevelPanel/MarginContainer/VBoxContainer/Level2Button")
	_level3_button = get_node("LevelPanel/MarginContainer/VBoxContainer/Level3Button")
	_level4_button = get_node("LevelPanel/MarginContainer/VBoxContainer/Level4Button")
	_level_back_button = get_node("LevelPanel/MarginContainer/VBoxContainer/LevelBackButton")
	_level_panel = get_node("LevelPanel")

	# Replace the four static level buttons with a scrollable dynamic list.
	# The static buttons stay in the scene (hidden) as style templates.
	var level_vbox: VBoxContainer = get_node("LevelPanel/MarginContainer/VBoxContainer")
	_level1_button.visible = false
	_level2_button.visible = false
	_level3_button.visible = false
	_level4_button.visible = false
	var level_scroll := ScrollContainer.new()
	level_scroll.name = "LevelScroll"
	level_scroll.custom_minimum_size = Vector2(340, 290)
	level_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	level_scroll.follow_focus = true
	_level_list_box = VBoxContainer.new()
	_level_list_box.name = "LevelList"
	_level_list_box.add_theme_constant_override("separation", 16)
	_level_list_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	level_scroll.add_child(_level_list_box)
	level_vbox.add_child(level_scroll)
	level_vbox.move_child(level_scroll, _level1_button.get_index())
	_load_level_manifest()

	# Credits Panel references
	_credits_panel = get_node("CreditsPanel")
	_credits_back_button = get_node("CreditsPanel/MarginContainer/VBoxContainer/CreditsBackButton")

	# Achievements Panel references
	_achievements_panel = get_node("AchievementsPanel")
	_achievements_back_button = get_node("AchievementsPanel/MarginContainer/VBoxContainer/AchievementsBackButton")

	# Populating animated button list
	_animated_buttons.append(_start_button)
	_animated_buttons.append(_config_button)
	_animated_buttons.append(_credits_button)
	_animated_buttons.append(_exit_button)
	_animated_buttons.append(_trophy_button)
	_animated_buttons.append(_gear_button)
	_animated_buttons.append(_back_button)
	_animated_buttons.append(_map_button)
	_animated_buttons.append(_forest_button)
	_animated_buttons.append(_glacial_button)
	_animated_buttons.append(_city_button)
	_animated_buttons.append(_cave_button)
	_animated_buttons.append(_custom_levels_button)
	_animated_buttons.append(_theme_back_button)
	_animated_buttons.append(_level_back_button)
	_animated_buttons.append(_credits_back_button)
	_animated_buttons.append(_achievements_back_button)
	_animated_buttons.append(_sfx_theme_option_button)

	for btn in _animated_buttons:
		# Set pivot offset to center for scale zoom
		btn.pivot_offset = btn.custom_minimum_size / 2.0

	# Toggle initial panel visibility
	_set_main_menu_visible(true)
	_config_panel.visible = false
	_theme_panel.visible = false
	_level_panel.visible = false
	_credits_panel.visible = false
	_achievements_panel.visible = false
	_map_instructions_label.visible = false

	# Grab focus on the start button for keyboard/joystick navigation immediately
	_start_button.grab_focus()

	# Connect button press events
	_start_button.pressed.connect(_on_start_pressed)
	_config_button.pressed.connect(_on_config_pressed)
	_credits_button.pressed.connect(_on_credits_pressed)
	_exit_button.pressed.connect(_on_exit_pressed)

	_trophy_button.pressed.connect(_on_trophy_pressed)
	_gear_button.pressed.connect(_on_gear_pressed)

	_back_button.pressed.connect(_on_back_pressed)
	_map_button.pressed.connect(_on_map_button_pressed)
	_joy_option_button.item_selected.connect(_on_joypad_selected)

	# Theme Selection Press handlers
	_forest_button.pressed.connect(func() -> void: _show_level_panel("forest"))
	_glacial_button.pressed.connect(func() -> void: _show_level_panel("glacial"))
	_city_button.pressed.connect(func() -> void: _show_level_panel("city"))
	_cave_button.pressed.connect(func() -> void: _show_level_panel("cave"))
	_custom_levels_button.pressed.connect(func() -> void: _show_level_panel("custom"))
	_theme_back_button.pressed.connect(_on_theme_back_pressed)

	_level_back_button.pressed.connect(_on_level_back_pressed)

	_credits_back_button.pressed.connect(_on_credits_back_pressed)
	_achievements_back_button.pressed.connect(_on_achievements_back_pressed)

	# Populate language dropdown
	_populate_language()
	_lang_option_button.item_selected.connect(_on_language_selected)

	# Populate joystick dropdown
	_populate_joypads()

	# Connect Joypad connection events dynamically
	Input.joy_connection_changed.connect(_on_joy_connection_changed)

	# Translate UI initially
	_translate_ui()

	# Connect procedural sound feedback recursively
	_connect_ui_feedback(self)


func _exit_tree() -> void:
	# Unsubscribe to avoid memory leaks
	if Input.joy_connection_changed.is_connected(_on_joy_connection_changed):
		Input.joy_connection_changed.disconnect(_on_joy_connection_changed)


func _set_main_menu_visible(vis: bool) -> void:
	var main_menu: Control = get_node("MainMenuContainer")
	main_menu.visible = vis
	var top_left: Control = get_node("TopLeftContainer")
	top_left.visible = vis
	var top_right: Control = get_node("TopRightContainer")
	top_right.visible = vis


func _connect_ui_feedback(node: Node) -> void:
	if node is Button:
		var btn: Button = node
		# Play short high-frequency tick when focused
		btn.focus_entered.connect(func() -> void: _play_menu_sound("hover", 880.0, 0.03, 0.1))

		# Hover automatically grabs focus for mouse navigation
		btn.mouse_entered.connect(func() -> void:
			if not _is_mapping_input and not btn.disabled and btn.visible:
				btn.grab_focus())
	elif node is OptionButton:
		var opt_btn: OptionButton = node
		opt_btn.focus_entered.connect(func() -> void: _play_menu_sound("hover", 880.0, 0.03, 0.1))
		opt_btn.mouse_entered.connect(func() -> void:
			if not _is_mapping_input and not opt_btn.disabled and opt_btn.visible:
				opt_btn.grab_focus())

	for child in node.get_children():
		_connect_ui_feedback(child)


func _process(delta: float) -> void:
	# Handle focus scaling animation
	for btn in _animated_buttons:
		if btn.visible and btn.get_parent() is Control and (btn.get_parent() as Control).visible:
			var target_scale := 1.08 if (btn.has_focus() or btn.is_hovered()) else 1.0
			btn.scale = btn.scale.lerp(Vector2(target_scale, target_scale), delta * 12.0)
		else:
			btn.scale = Vector2.ONE


func _populate_language() -> void:
	_lang_option_button.clear()
	_lang_option_button.add_item("Português")
	_lang_option_button.set_item_metadata(0, "pt")
	_lang_option_button.add_item("English")
	_lang_option_button.set_item_metadata(1, "en")

	if GameSettings.language == "en":
		_lang_option_button.select(1)
	else:
		_lang_option_button.select(0)


func _populate_sfx_themes() -> void:
	_sfx_theme_option_button.clear()
	var themes := GameSettings.get_available_sound_themes()
	var is_pt := GameSettings.language == "pt"

	for i in themes.size():
		var theme := themes[i]
		var display_name := GameSettings.get_theme_display_name(theme, is_pt)
		_sfx_theme_option_button.add_item(display_name)
		_sfx_theme_option_button.set_item_metadata(i, theme)

		if theme == GameSettings.sound_theme:
			_sfx_theme_option_button.select(i)


func _on_sfx_theme_selected(index: int) -> void:
	var theme: String = _sfx_theme_option_button.get_item_metadata(index)
	GameSettings.sound_theme = theme
	_play_menu_sound("forward", 523.25, 0.1, 0.3)


func _on_language_selected(index: int) -> void:
	var lang: String = _lang_option_button.get_item_metadata(index)
	GameSettings.language = lang
	GameSettings.persist_web_language() # keep the website in sync (web only)
	_translate_ui()
	_play_menu_sound("forward", 587.33, 0.1, 0.3) # D5 note sound


func _translate_ui() -> void:
	var is_pt := GameSettings.language == "pt"

	# Main Menu Buttons
	_start_button.text = "JOGAR" if is_pt else "PLAY"
	_config_button.text = "OPÇÕES" if is_pt else "OPTIONS"
	_credits_button.text = "CRÉDITOS" if is_pt else "CREDITS"
	_exit_button.text = "SAIR" if is_pt else "EXIT"

	# Config Menu
	(get_node("ConfigPanel/MarginContainer/VBoxContainer/Title") as Label).text = "CONFIGURAÇÕES" if is_pt else "SETTINGS"
	(get_node("ConfigPanel/MarginContainer/VBoxContainer/JoyLabel") as Label).text = "Selecione o Joystick:" if is_pt else "Select Controller:"
	(get_node("ConfigPanel/MarginContainer/VBoxContainer/MusicLabel") as Label).text = "Volume da Música:" if is_pt else "Music Volume:"
	_lang_label.text = "Idioma:" if is_pt else "Language:"
	_sfx_theme_label.text = "Efeitos Sonoros:" if is_pt else "Sound Effects:"
	_map_button.text = "Mapear Pulo/Ação" if is_pt else "Map Jump/Action"
	_back_button.text = "VOLTAR" if is_pt else "BACK"

	_populate_sfx_themes()

	# Map Instructions
	if _is_mapping_input:
		_map_instructions_label.text = "Aperte qualquer botão no seu controle..." if is_pt else "Press any button on your controller..."

	# Corner / Back buttons
	_credits_back_button.text = "VOLTAR" if is_pt else "BACK"
	_achievements_back_button.text = "VOLTAR" if is_pt else "BACK"
	_theme_back_button.text = "VOLTAR" if is_pt else "BACK"
	_level_back_button.text = "VOLTAR" if is_pt else "BACK"

	# Credits Panel
	(get_node("CreditsPanel/MarginContainer/VBoxContainer/Title") as Label).text = "CRÉDITOS" if is_pt else "CREDITS"
	(get_node("CreditsPanel/MarginContainer/VBoxContainer/CreditsText") as Label).text = (
			"DESENVOLVIMENTO\nRicardo Borges\n\nDESIGN ARTÍSTICO\nPixel Art Engine\n\nMOTOR GRÁFICO\nGodot Engine 4.6\n\nObrigado por jogar!"
			if is_pt else
			"DEVELOPMENT\nRicardo Borges\n\nART DESIGN\nPixel Art Engine\n\nGAME ENGINE\nGodot Engine 4.6\n\nThanks for playing!")

	# Achievements Panel
	(get_node("AchievementsPanel/MarginContainer/VBoxContainer/Title") as Label).text = "CONQUISTAS" if is_pt else "ACHIEVEMENTS"
	(get_node("AchievementsPanel/MarginContainer/VBoxContainer/Ach1/AchTitle") as Label).text = "[x] Primeiros Passos" if is_pt else "[x] First Steps"
	(get_node("AchievementsPanel/MarginContainer/VBoxContainer/Ach1/AchDesc") as Label).text = "Conclua a primeira fase de Paçoca." if is_pt else "Complete the first level of Paçoca."
	(get_node("AchievementsPanel/MarginContainer/VBoxContainer/Ach2/AchTitle") as Label).text = "[ ] Veloz e Furioso" if is_pt else "[ ] Fast & Furious"
	(get_node("AchievementsPanel/MarginContainer/VBoxContainer/Ach2/AchDesc") as Label).text = "Alcance uma velocidade de 50 km/h." if is_pt else "Reach a speed of 50 km/h."
	(get_node("AchievementsPanel/MarginContainer/VBoxContainer/Ach3/AchTitle") as Label).text = "[x] Colecionador" if is_pt else "[x] Collector"
	(get_node("AchievementsPanel/MarginContainer/VBoxContainer/Ach3/AchDesc") as Label).text = "Colete um total de 100 moedas." if is_pt else "Collect a total of 100 rings."

	# Theme Panel
	(get_node("ThemePanel/MarginContainer/VBoxContainer/Title") as Label).text = "SELECIONAR TEMA" if is_pt else "SELECT THEME"
	(_forest_button.get_node("Label") as Label).text = "FLORESTA" if is_pt else "FOREST"
	(_glacial_button.get_node("Label") as Label).text = "GLACIAL"
	(_city_button.get_node("Label") as Label).text = "CIDADE" if is_pt else "CITY"
	(_cave_button.get_node("Label") as Label).text = "CAVERNA" if is_pt else "CAVE"
	_custom_levels_button.text = "FASES CUSTOM" if is_pt else "CUSTOM LEVELS"

	# Level Panel Dynamic Title & buttons
	var theme_name := ""
	match _selected_theme:
		"glacial":
			theme_name = "GLACIAL"
		"city":
			theme_name = "CIDADE" if is_pt else "CITY"
		"cave":
			theme_name = "CAVERNA" if is_pt else "CAVE"
		_:
			theme_name = "FLORESTA" if is_pt else "FOREST"
	var level_title: Label = get_node("LevelPanel/MarginContainer/VBoxContainer/Title")
	if _selected_theme == "custom":
		level_title.text = "FASES CUSTOM" if is_pt else "CUSTOM LEVELS"
	else:
		level_title.text = ("TEMA: %s" % theme_name) if is_pt else ("THEME: %s" % theme_name)

	# Dynamic level buttons re-render their labels for the current language.
	if _dynamic_level_buttons.size() > 0 and _level_panel.visible:
		_populate_level_buttons()


func _populate_joypads() -> void:
	_joy_option_button.clear()

	# Item 0: Default Option
	_joy_option_button.add_item("Todos / Padrão (Auto)")
	_joy_option_button.set_item_metadata(0, -1)

	var joypads := Input.get_connected_joypads()
	var selected_index := 0

	for i in joypads.size():
		var joy_id := joypads[i]
		var joy_name := Input.get_joy_name(joy_id)
		var display_text := "Controle %d: %s" % [joy_id, joy_name]

		_joy_option_button.add_item(display_text)
		_joy_option_button.set_item_metadata(i + 1, joy_id)

		if joy_id == GameSettings.selected_joypad_id:
			selected_index = i + 1

	# Select currently active joypad in dropdown
	_joy_option_button.select(selected_index)


func _on_joy_connection_changed(_device: int, _connected: bool) -> void:
	# Re-populate dropdown when controllers are plugged in/out
	_populate_joypads()


func _on_joypad_selected(index: int) -> void:
	var joy_id: int = _joy_option_button.get_item_metadata(index)
	GameSettings.selected_joypad_id = joy_id
	GameSettings.apply_joypad_settings()
	_play_menu_sound("forward", 587.33, 0.1, 0.3) # D5 note sound


func _on_start_pressed() -> void:
	_play_menu_sound("forward", 523.25, 0.1, 0.3) # C5 note sound
	_set_main_menu_visible(false)
	_theme_panel.visible = true
	_forest_button.grab_focus()


func _show_level_panel(theme: String) -> void:
	_play_menu_sound("forward", 523.25, 0.1, 0.3)
	_selected_theme = theme
	_theme_panel.visible = false
	_level_panel.visible = true
	_translate_ui()
	_populate_level_buttons()
	if _dynamic_level_buttons.size() > 0:
		_dynamic_level_buttons[0].grab_focus()
	else:
		_level_back_button.grab_focus()


func _on_theme_back_pressed() -> void:
	_play_menu_sound("backward", 392.00, 0.1, 0.3) # G4 note back sound
	_set_main_menu_visible(true)
	_theme_panel.visible = false
	_start_button.grab_focus()


# Maps the theme panel's internal ids to the theme names used by the level
# manifest / map pipeline.
static func _manifest_theme(selected_theme: String) -> String:
	match selected_theme:
		"city":
			return "cidade"
		"cave":
			return "caverna"
		_:
			return selected_theme


func _load_level_manifest() -> void:
	_levels.clear()
	var seen_scenes := {}

	# 1. Manifest written by the map pipeline (id, name, theme, scene).
	const MANIFEST_PATH := "res://scenes/levels/levels.json"
	if FileAccess.file_exists(MANIFEST_PATH):
		var file := FileAccess.open(MANIFEST_PATH, FileAccess.READ)
		var parsed: Variant = JSON.parse_string(file.get_as_text())
		if parsed is Dictionary and parsed.has("levels"):
			for item in parsed["levels"]:
				if not item is Dictionary:
					continue
				var entry := LevelEntry.new()
				entry.id = str(item.get("id", ""))
				entry.name = str(item.get("name", ""))
				entry.theme = str(item.get("theme", "forest"))
				entry.scene = str(item.get("scene", ""))
				entry.builtin = bool(item.get("builtin", false))
				if entry.scene.length() == 0 or not ResourceLoader.exists(entry.scene):
					continue
				_levels.append(entry)
				seen_scenes[entry.scene] = true

	# 2. Directory scan picks up levels missing from the manifest (e.g.
	# hand-made scenes); they are treated as custom levels. In exported
	# builds scene files are listed with a ".remap" suffix, so strip it
	# before matching.
	var dir := DirAccess.open("res://scenes/levels")
	if dir != null:
		for file_name in dir.get_files():
			var name := file_name.trim_suffix(".remap") if file_name.ends_with(".remap") else file_name
			if not name.begins_with("level_") or not name.ends_with(".tscn"):
				continue

			var id := name.substr("level_".length(), name.length() - "level_".length() - ".tscn".length())
			var scene_path := "res://scenes/levels/%s" % name
			if seen_scenes.has(scene_path):
				continue

			var theme := "forest"
			for prefix in ["glacial", "cidade", "caverna"]:
				if id.begins_with(prefix + "_"):
					theme = prefix
					break
			var entry := LevelEntry.new()
			entry.id = id
			entry.name = ""
			entry.theme = theme
			entry.scene = scene_path
			_levels.append(entry)
			seen_scenes[scene_path] = true

	_levels.sort_custom(func(a: LevelEntry, b: LevelEntry) -> bool: return a.id < b.id)


static func _theme_display_name(theme: String, is_pt: bool) -> String:
	match theme:
		"glacial":
			return "Glacial"
		"cidade":
			return "Cidade" if is_pt else "City"
		"caverna":
			return "Caverna" if is_pt else "Cave"
		_:
			return "Floresta" if is_pt else "Forest"


func _level_button_text(entry: LevelEntry, is_pt: bool, custom_mode: bool) -> String:
	if custom_mode:
		# Custom levels are identified by name (the map editor derives the
		# internal id from it); the id is only a fallback for unnamed maps.
		var title := entry.name.to_upper() if entry.name.length() > 0 else ("FASE " if is_pt else "LEVEL ") + entry.id.to_upper()
		return "%s (%s)" % [title, _theme_display_name(entry.theme, is_pt)]

	var label := ("" if is_pt else "LEVEL ") + entry.id.to_upper()
	if entry.name.length() > 0:
		label += "-" + entry.name
	return label


func _populate_level_buttons() -> void:
	for btn in _dynamic_level_buttons:
		_animated_buttons.erase(btn)
		btn.queue_free()
	_dynamic_level_buttons.clear()
	if _level_list_empty_label != null:
		_level_list_empty_label.queue_free()
		_level_list_empty_label = null

	var is_pt := GameSettings.language == "pt"
	# The custom list mixes every theme (anything not builtin); the theme
	# lists show only the builtin levels shipped with the game.
	var custom_mode := _selected_theme == "custom"
	var theme := _manifest_theme(_selected_theme)
	for entry in _levels:
		var include := (not entry.builtin) if custom_mode else (entry.builtin and entry.theme == theme)
		if not include:
			continue

		var btn: Button = _level1_button.duplicate()
		btn.name = "Level_" + entry.id
		btn.visible = true
		btn.text = _level_button_text(entry, is_pt, custom_mode)
		btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		btn.pivot_offset = btn.custom_minimum_size / 2.0
		var scene_path := entry.scene
		var entry_theme := entry.theme
		btn.pressed.connect(func() -> void: _on_dynamic_level_pressed(scene_path, entry_theme))
		_level_list_box.add_child(btn)
		_connect_ui_feedback(btn)
		_animated_buttons.append(btn)
		_dynamic_level_buttons.append(btn)

	if custom_mode and _dynamic_level_buttons.size() == 0:
		_level_list_empty_label = Label.new()
		_level_list_empty_label.text = (
				"Nenhuma fase custom ainda.\nUse o Map Editor para criar uma!"
				if is_pt else
				"No custom levels yet.\nUse the Map Editor to create one!")
		_level_list_empty_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_level_list_empty_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		_level_list_box.add_child(_level_list_empty_label)


func _on_dynamic_level_pressed(scene_path: String, theme: String) -> void:
	_play_menu_sound("forward", 1046.50, 0.15, 0.4) # C6 note confirm sound
	GameSettings.level_to_load = scene_path
	GameSettings.level_theme = theme
	_change_scene_with_fade("res://scenes/main.tscn")


func _on_level_back_pressed() -> void:
	_play_menu_sound("backward", 392.00, 0.1, 0.3) # G4 note back sound
	_theme_panel.visible = true
	_level_panel.visible = false

	match _selected_theme:
		"glacial":
			_glacial_button.grab_focus()
		"city":
			_city_button.grab_focus()
		"cave":
			_cave_button.grab_focus()
		"custom":
			_custom_levels_button.grab_focus()
		_:
			_forest_button.grab_focus()


func _on_config_pressed() -> void:
	_play_menu_sound("forward", 523.25, 0.1, 0.3) # C5 note sound
	_set_main_menu_visible(false)
	_config_panel.visible = true
	_joy_option_button.grab_focus()


func _on_gear_pressed() -> void:
	_on_config_pressed()


func _on_back_pressed() -> void:
	_play_menu_sound("backward", 392.00, 0.1, 0.3) # G4 note back sound
	_set_main_menu_visible(true)
	_config_panel.visible = false
	_config_button.grab_focus()


func _on_credits_pressed() -> void:
	_play_menu_sound("forward", 523.25, 0.1, 0.3) # C5 note sound
	_set_main_menu_visible(false)
	_credits_panel.visible = true
	_credits_back_button.grab_focus()


func _on_credits_back_pressed() -> void:
	_play_menu_sound("backward", 392.00, 0.1, 0.3) # G4 note back sound
	_set_main_menu_visible(true)
	_credits_panel.visible = false
	_credits_button.grab_focus()


func _on_trophy_pressed() -> void:
	_play_menu_sound("forward", 523.25, 0.1, 0.3) # C5 note sound
	_set_main_menu_visible(false)
	_achievements_panel.visible = true
	_achievements_back_button.grab_focus()


func _on_achievements_back_pressed() -> void:
	_play_menu_sound("backward", 392.00, 0.1, 0.3) # G4 note back sound
	_set_main_menu_visible(true)
	_achievements_panel.visible = false
	_trophy_button.grab_focus()


func _on_map_button_pressed() -> void:
	_play_menu_sound("forward", 523.25, 0.1, 0.3) # C5 note sound
	_is_mapping_input = true

	_translate_ui()
	_map_instructions_label.visible = true

	# Disable UI interactions during learning mode
	_toggle_buttons_disabled(true)


func _input(event: InputEvent) -> void:
	if _is_mapping_input and event is InputEventJoypadButton and event.pressed:
		# Consume the input event to prevent triggering other actions
		get_viewport().set_input_as_handled()

		var device_id := event.device
		var button_id := int(event.button_index)

		# Lock settings to this specific controller device ID if it was on Auto/All (-1)
		if GameSettings.selected_joypad_id == -1:
			GameSettings.selected_joypad_id = device_id
			_populate_joypads() # Refresh dropdown to show locked device

		# Remap jump and ui_accept dynamically
		_rebind_action_joystick_button("ui_accept", button_id)
		_rebind_action_joystick_button("jump", button_id)

		# Re-apply settings
		GameSettings.apply_joypad_settings()

		# Success feedback
		var is_pt := GameSettings.language == "pt"
		_map_instructions_label.text = (
				"Botão %d configurado para Ação/Pulo!" % button_id
				if is_pt else
				"Button %d bound to Action/Jump!" % button_id)
		_play_menu_sound("forward", 880.0, 0.25, 0.4) # High confirmation beep

		# Wait 1.5 seconds and return UI control
		var timer := get_tree().create_timer(1.5)
		timer.timeout.connect(func() -> void:
			_map_instructions_label.visible = false
			_is_mapping_input = false
			_toggle_buttons_disabled(false)
			_map_button.grab_focus())


func _rebind_action_joystick_button(action: String, button_id: int) -> void:
	if not InputMap.has_action(action):
		return

	# Remove existing joystick button mappings for this action
	for ev in InputMap.action_get_events(action):
		if ev is InputEventJoypadButton:
			InputMap.action_erase_event(action, ev)

	# Add the new button mapping
	var new_event := InputEventJoypadButton.new()
	new_event.device = GameSettings.selected_joypad_id
	new_event.button_index = button_id as JoyButton
	InputMap.action_add_event(action, new_event)


func _toggle_buttons_disabled(disabled: bool) -> void:
	_start_button.disabled = disabled
	_config_button.disabled = disabled
	_exit_button.disabled = disabled
	_credits_button.disabled = disabled
	_trophy_button.disabled = disabled
	_gear_button.disabled = disabled

	_back_button.disabled = disabled
	_joy_option_button.disabled = disabled
	_lang_option_button.disabled = disabled
	_sfx_theme_option_button.disabled = disabled
	_map_button.disabled = disabled

	_forest_button.disabled = disabled
	_glacial_button.disabled = disabled
	_city_button.disabled = disabled
	_cave_button.disabled = disabled
	_custom_levels_button.disabled = disabled
	_theme_back_button.disabled = disabled

	_level1_button.disabled = disabled
	_level2_button.disabled = disabled
	_level3_button.disabled = disabled
	_level4_button.disabled = disabled
	_level_back_button.disabled = disabled

	_credits_back_button.disabled = disabled
	_achievements_back_button.disabled = disabled


func _on_exit_pressed() -> void:
	_play_menu_sound("backward", 261.63, 0.2, 0.3) # C4 note quit sound
	GameSettings.finalize_telemetry(self)
	# Web: return to the site page the player came from. Native: quit.
	get_tree().create_timer(0.25).timeout.connect(func() -> void:
		if not GameSettings.exit_to_site():
			get_tree().quit())


func _on_music_volume_changed(value: float) -> void:
	GameSettings.music_volume = value
	GameSettings.apply_music_volume()


# Tweens the music player's volume_db (fade envelope) toward target_db.
func _fade_music(target_db: float, duration: float) -> void:
	var tween := create_tween()
	tween.tween_property(_music_player, "volume_db", target_db, duration)


# Fades the title music out, then switches scenes.
func _change_scene_with_fade(scene_path: String) -> void:
	var tween := create_tween()
	tween.tween_property(_music_player, "volume_db", MUSIC_SILENT_DB, 0.6)
	await tween.finished
	get_tree().change_scene_to_file(scene_path)


# Plays a menu sound based on the selected audio theme
func _play_menu_sound(event_name: String, fallback_freq: float, fallback_duration: float, fallback_volume := 0.5) -> void:
	if GameSettings.sound_theme == "procedural" or GameSettings.sound_theme.is_empty():
		play_sound(fallback_freq, fallback_duration, fallback_volume)
	else:
		var path := "res://audio/effects/%s_%s.wav" % [GameSettings.sound_theme, event_name.to_upper()]
		var stream := GameSettings.load_sfx(path)
		if stream != null:
			_sfx_wav_player.stream = stream
			_sfx_wav_player.play()
		else:
			play_sound(fallback_freq, fallback_duration, fallback_volume)


# Procedural sound helper
func play_sound(frequency: float, duration: float, volume := 0.5) -> void:
	if _audio_playback == null:
		return

	var sample_rate := 44100.0
	var num_samples := int(sample_rate * duration)
	var phase := 0.0
	var phase_increment := (2.0 * PI * frequency) / sample_rate

	for i in num_samples:
		if _audio_playback.get_frames_available() > 0:
			var envelope := float(num_samples - i) / num_samples
			var sample := sin(phase) * volume * envelope
			_audio_playback.push_frame(Vector2(sample, sample))
			phase += phase_increment
