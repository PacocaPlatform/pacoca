class_name PauseMenu
extends Control

var _resume_button: Button
var _main_menu_button: Button
var _exit_button: Button

# Procedural sound effects player
var _audio_player: AudioStreamPlayer
var _audio_playback: AudioStreamGeneratorPlayback
var _sfx_wav_player: AudioStreamPlayer


func _ready() -> void:
	# Set process mode to Always so this node runs even when the game is paused
	process_mode = Node.PROCESS_MODE_ALWAYS

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

	# Fetch button references
	_resume_button = get_node("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/ResumeButton")
	_main_menu_button = get_node("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/MainMenuButton")
	_exit_button = get_node("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/ExitButton")

	# Connect button signals
	_resume_button.pressed.connect(_on_resume_pressed)
	_main_menu_button.pressed.connect(_on_main_menu_pressed)
	_exit_button.pressed.connect(_on_exit_pressed)

	# Hide pause menu by default
	visible = false

	# Translate pause menu dynamically
	_translate_ui()

	# Connect procedural sound feedback recursively
	_connect_ui_feedback(self)


func _translate_ui() -> void:
	var is_pt := GameSettings.language == "pt"
	var title: Label = get_node("MarginContainer/PanelContainer/MarginContainer/VBoxContainer/Title")
	title.text = "JOGO PAUSADO" if is_pt else "GAME PAUSED"
	_resume_button.text = "Continuar" if is_pt else "Resume"
	
	if GameSettings.is_web_custom_map():
		_main_menu_button.visible = false
		_exit_button.text = "Voltar ao Editor" if is_pt else "Back to Editor"
	else:
		_main_menu_button.text = "Menu Principal" if is_pt else "Main Menu"
		_main_menu_button.visible = true
		_exit_button.text = "Sair" if is_pt else "Exit"


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


func _input(event: InputEvent) -> void:
	if event.is_action_pressed("pause"):
		# Consume input to prevent double triggering
		get_viewport().set_input_as_handled()

		if visible:
			_on_resume_pressed()
		else:
			_pause_game()


func _pause_game() -> void:
	# Pause the SceneTree (freezes physics, players, enemies, items)
	get_tree().paused = true
	visible = true

	# Focus the resume button immediately for joystick/keyboard navigation
	_resume_button.grab_focus()

	_play_menu_sound("pause", 523.25, 0.15, 0.4) # Pause chime (C5)


func _on_resume_pressed() -> void:
	# Resume/Unpause the SceneTree
	get_tree().paused = false
	visible = false

	_play_menu_sound("unpause", 783.99, 0.1, 0.4) # Resume chime (G5)


func _on_main_menu_pressed() -> void:
	_play_menu_sound("backward", 392.00, 0.1, 0.3) # Back chime (G4)

	# CRITICAL: Unpause the tree before changing scene, or else the target scene will start paused!
	get_tree().paused = false

	get_tree().change_scene_to_file("res://scenes/menu.tscn")


func _on_exit_pressed() -> void:
	_play_menu_sound("backward", 261.63, 0.2, 0.3) # Quit chime (C4)
	GameSettings.finalize_telemetry(self)
	# Web: return to the site page the player came from. Native: quit.
	get_tree().create_timer(0.25).timeout.connect(func() -> void:
		if not GameSettings.exit_to_site():
			get_tree().quit())


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
