class_name LevelFinishScreen
extends Control

var _score_label: Label
var _rings_label: Label
var _time_label: Label
var _continue_button: Button

# Procedural sound effects player
var _audio_player: AudioStreamPlayer
var _audio_playback: AudioStreamGeneratorPlayback
var _sfx_wav_player: AudioStreamPlayer

var _transitioning := false


func _ready() -> void:
	# Fetch label and button references using scene unique names
	_score_label = get_node("%ScoreValueLabel")
	_rings_label = get_node("%RingsValueLabel")
	_time_label = get_node("%TimeValueLabel")
	_continue_button = get_node("%ContinueButton")

	# Connect button signal
	_continue_button.pressed.connect(_on_continue_pressed)

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

	# Hide screen by default
	visible = false

	# Connect procedural sound feedback recursively
	_connect_ui_feedback(self)


func _connect_ui_feedback(node: Node) -> void:
	if node is Button:
		var btn: Button = node
		# Play short tick when focused
		btn.focus_entered.connect(func() -> void: _play_menu_sound("hover", 880.0, 0.03, 0.1))

		# Hover automatically grabs focus
		btn.mouse_entered.connect(func() -> void:
			if visible and not btn.disabled:
				btn.grab_focus())

	for child in node.get_children():
		_connect_ui_feedback(child)


func show_screen(rings: int, score: int, time_elapsed: float) -> void:
	visible = true

	# Translate UI elements dynamically
	_translate_ui()

	# Format stats
	_rings_label.text = "%03d" % rings
	_score_label.text = "%09d" % score

	var minutes := int(time_elapsed / 60)
	var seconds := int(time_elapsed) % 60
	var centiseconds := int(time_elapsed * 100) % 100
	_time_label.text = "%d' %02d\" %02d" % [minutes, seconds, centiseconds]

	# Focus the continue button for keyboard/gamepad navigation
	_continue_button.grab_focus()

	# Pop-in animation for the panel
	var panel: PanelContainer = get_node_or_null("MarginContainer/PanelContainer")
	if panel != null:
		panel.pivot_offset = panel.size / 2
		panel.scale = Vector2(0.8, 0.8)
		panel.modulate = Color(1, 1, 1, 0)

		var tween := create_tween().set_parallel(true)
		tween.tween_property(panel, "scale", Vector2.ONE, 0.4) \
				.set_trans(Tween.TRANS_BACK) \
				.set_ease(Tween.EASE_OUT)
		tween.tween_property(panel, "modulate", Color(1, 1, 1, 1), 0.35)


func _translate_ui() -> void:
	var is_pt := GameSettings.language == "pt"
	var title: Label = get_node("MarginContainer/PanelContainer/Margin/VBox/Title")
	title.text = "NÍVEL CONCLUÍDO!" if is_pt else "LEVEL COMPLETED!"
	var score_name: Label = get_node("MarginContainer/PanelContainer/Margin/VBox/StatsGrid/ScoreName")
	score_name.text = "PONTOS" if is_pt else "SCORE"
	var rings_name: Label = get_node("MarginContainer/PanelContainer/Margin/VBox/StatsGrid/RingsName")
	rings_name.text = "MOEDAS" if is_pt else "RINGS"
	var time_name: Label = get_node("MarginContainer/PanelContainer/Margin/VBox/StatsGrid/TimeName")
	time_name.text = "TEMPO" if is_pt else "TIME"
	_continue_button.text = "CONTINUAR" if is_pt else "CONTINUE"


func _on_continue_pressed() -> void:
	if _transitioning:
		return
	_transitioning = true

	_play_menu_sound("forward", 1046.50, 0.15, 0.4) # Victory confirm chime

	if GameSettings.is_web_custom_map():
		get_tree().create_timer(0.2).timeout.connect(func() -> void:
			if not GameSettings.exit_to_site():
				get_tree().change_scene_to_file("res://scenes/menu.tscn"))
		return

	# Detach statistics and load next scene
	var current_level := GameSettings.level_to_load
	var next_level := "res://scenes/menu.tscn"

	if current_level.contains("_01.tscn"):
		next_level = current_level.replace("_01.tscn", "_02.tscn")
	elif current_level.contains("_02.tscn"):
		next_level = current_level.replace("_02.tscn", "_03.tscn")
	elif current_level.contains("_03.tscn"):
		next_level = current_level.replace("_03.tscn", "_04.tscn")

	# Wait brief moment for the click sound before changing scene
	get_tree().create_timer(0.2).timeout.connect(func() -> void:
		if next_level == "res://scenes/menu.tscn":
			get_tree().change_scene_to_file("res://scenes/menu.tscn")
		else:
			GameSettings.level_to_load = next_level
			get_tree().change_scene_to_file("res://scenes/main.tscn"))


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
