class_name GameOver
extends Control

var _audio_player: AudioStreamPlayer
var _audio_playback: AudioStreamGeneratorPlayback
var _sfx_wav_player: AudioStreamPlayer
var _timer := 0.0
const TOTAL_WAIT_TIME := 4.5
var _transitioning := false


func _ready() -> void:
	# Setup WAV sound player
	_sfx_wav_player = AudioStreamPlayer.new()
	_sfx_wav_player.bus = "Master"
	add_child(_sfx_wav_player)

	# Setup procedural audio player for the Game Over sound
	_audio_player = AudioStreamPlayer.new()
	add_child(_audio_player)
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = 44100.0
	generator.buffer_length = 0.1
	_audio_player.stream = generator
	_audio_player.play()
	_audio_playback = _audio_player.get_stream_playback() as AudioStreamGeneratorPlayback

	# Play the Game Over tune
	_play_game_over_tune()

	# Translate UI
	_translate_ui()

	# Connect theme/UI animations or elements
	var panel: PanelContainer = get_node_or_null("MarginContainer/PanelContainer")
	if panel != null:
		panel.pivot_offset = panel.size / 2
		panel.scale = Vector2(0.5, 0.5)
		panel.modulate = Color(1, 1, 1, 0)

		# Pop-in tween
		var tween := create_tween().set_parallel(true)
		tween.tween_property(panel, "scale", Vector2.ONE, 0.5) \
				.set_trans(Tween.TRANS_BACK) \
				.set_ease(Tween.EASE_OUT)
		tween.tween_property(panel, "modulate", Color(1, 1, 1, 1), 0.4)


func _translate_ui() -> void:
	var is_pt := GameSettings.language == "pt"
	var desc: Label = get_node("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/DescriptionLabel")
	desc.text = "Suas vidas acabaram!" if is_pt else "You ran out of lives!"
	var hint: Label = get_node("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/HintLabel")
	hint.text = "Pressione qualquer botão para voltar ao menu" if is_pt else "Press any button to return to the menu"


func _process(delta: float) -> void:
	_timer += delta

	# Automatically transition to the Main Menu after timer expires
	if _timer >= TOTAL_WAIT_TIME and not _transitioning:
		_go_to_main_menu()


func _input(event: InputEvent) -> void:
	# Pressing jump, ui_accept or mouse click goes to Main Menu instantly
	var mouse_pressed := event is InputEventMouseButton and (event as InputEventMouseButton).pressed
	var pressed := event.is_action_pressed("jump") or event.is_action_pressed("ui_accept") or mouse_pressed
	if pressed and not _transitioning and _timer > 0.5:
		_go_to_main_menu()


func _go_to_main_menu() -> void:
	_transitioning = true
	# Play simple click feedback
	_play_menu_sound("forward", 440.0, 0.15, 0.3)

	# Tween fade out before changing scene
	var panel: PanelContainer = get_node_or_null("MarginContainer/PanelContainer")
	if panel != null:
		var tween := create_tween()
		tween.tween_property(panel, "modulate", Color(1, 1, 1, 0), 0.3)
		tween.tween_callback(func() -> void:
			get_tree().change_scene_to_file("res://scenes/menu.tscn"))
	else:
		get_tree().change_scene_to_file("res://scenes/menu.tscn")


func _play_game_over_tune() -> void:
	# Sad retro descending jingle:
	# C5 (523.25Hz), B4 (493.88Hz), A4 (440.00Hz), G#4 (415.30Hz), G4 (392.00Hz), F4 (349.23Hz), E4 (329.63Hz)
	var notes := [523.25, 493.88, 440.00, 415.30, 392.00, 349.23, 329.63, 261.63]
	var durations := [0.2, 0.2, 0.2, 0.2, 0.3, 0.3, 0.4, 0.6]
	var volumes := [0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.4, 0.5]

	for i in notes.size():
		if _transitioning:
			break
		_play_sound(notes[i], durations[i], volumes[i])
		await get_tree().create_timer(durations[i] * 0.9).timeout


# Plays a menu sound based on the selected audio theme
func _play_menu_sound(event_name: String, fallback_freq: float, fallback_duration: float, fallback_volume := 0.5) -> void:
	if GameSettings.sound_theme == "procedural" or GameSettings.sound_theme.is_empty():
		_play_sound(fallback_freq, fallback_duration, fallback_volume)
	else:
		var path := "res://audio/effects/%s_%s.wav" % [GameSettings.sound_theme, event_name.to_upper()]
		var stream := GameSettings.load_sfx(path)
		if stream != null:
			_sfx_wav_player.stream = stream
			_sfx_wav_player.play()
		else:
			_play_sound(fallback_freq, fallback_duration, fallback_volume)


func _play_sound(frequency: float, duration: float, volume: float) -> void:
	if _audio_playback == null:
		return

	var sample_rate := 44100.0
	var num_samples := int(sample_rate * duration)
	var phase := 0.0
	var phase_increment := (2.0 * PI * frequency) / sample_rate

	for i in num_samples:
		if _audio_playback.get_frames_available() > 0:
			# Fade out envelope per note
			var envelope := float(num_samples - i) / num_samples
			var sample := sin(phase) * volume * envelope
			_audio_playback.push_frame(Vector2(sample, sample))
			phase += phase_increment
