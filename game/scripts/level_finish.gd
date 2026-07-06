class_name LevelFinish
extends Area3D

@export var NormalRotateSpeed := 3.0
@export var FastRotateSpeed := 40.0

var _coin_visual: Node3D
var _spark_particles: CPUParticles3D
var _audio_player: AudioStreamPlayer
var _audio_playback: AudioStreamGeneratorPlayback

var _triggered := false
var _captured_player: Player
var _current_rotate_speed := 0.0
var _timer := 0.0


func _ready() -> void:
	_coin_visual = get_node("CoinVisual")
	# Set a much larger base size for the giant coin
	_coin_visual.scale = Vector3(2.5, 2.5, 2.5)

	_spark_particles = get_node("SparkParticles")
	# Scale particles container so the effect scales with the coin
	_spark_particles.scale = Vector3(2.0, 2.0, 2.0)

	_current_rotate_speed = NormalRotateSpeed

	# Setup procedural audio player
	_audio_player = AudioStreamPlayer.new()
	add_child(_audio_player)
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = 44100.0
	generator.buffer_length = 0.1
	_audio_player.stream = generator
	_audio_player.play()
	_audio_playback = _audio_player.get_stream_playback() as AudioStreamGeneratorPlayback

	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	# Rotate the coin visual around Y
	_coin_visual.rotate_y(_current_rotate_speed * delta)

	if _triggered and _captured_player != null:
		# Smoothly Lerp player to the center of the coin on the XY plane
		var target_pos := global_position
		# Maintain player's Z at strictly 0
		target_pos.z = 0
		_captured_player.global_position = _captured_player.global_position.lerp(target_pos, 8.0 * delta)

		_timer += delta
		if _timer >= 2.0:
			# Stop physics process and show the level finish statistics screen
			var main := get_tree().current_scene
			if main != null and main.has_method("complete_level"):
				main.complete_level(_captured_player.rings, _captured_player.score, _captured_player.time_elapsed)
			set_physics_process(false)


func _on_body_entered(body: Node3D) -> void:
	if body is Player and not _triggered:
		_triggered = true
		_captured_player = body
		_captured_player.is_level_finished = true

		# Vanish the player so only the coin remains visible and spinning
		_captured_player.visible = false

		_current_rotate_speed = FastRotateSpeed

		# Dynamically scale the coin up even more when triggered
		var tween := create_tween()
		tween.tween_property(_coin_visual, "scale", Vector3(3.8, 3.8, 3.8), 0.8) \
				.set_trans(Tween.TRANS_BACK) \
				.set_ease(Tween.EASE_OUT)

		# Trigger particles emission
		_spark_particles.emitting = true

		# Play procedural victory audio
		_play_victory_jingle()


func _play_victory_jingle() -> void:
	# Happy retro arpeggio: E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz), E6 (1318.51Hz), G6 (1567.98Hz), C7 (2093.00Hz)
	var notes := [659.25, 783.99, 1046.50, 1318.51, 1567.98, 2093.00]
	var duration := 0.15

	for note in notes:
		_play_sound(note, duration, 0.35)
		await get_tree().create_timer(duration * 0.8).timeout

	# Final happy chord note
	_play_sound(2093.00, 0.6, 0.45)


func _play_sound(frequency: float, duration: float, volume: float) -> void:
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
