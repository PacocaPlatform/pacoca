class_name HUD
extends Control

var _score_label: Label
var _time_label: Label
var _rings_label: Label
var _lives_label: Label
var _speed_label: Label

var _player: Player
var _blink_timer := 0.0
var _rings_blink_red := false


func _ready() -> void:
	# Bind to nodes using Scene Unique Names (%) to prevent path breakage
	_score_label = get_node("%ScoreValueLabel")
	_time_label = get_node("%TimeValueLabel")
	_rings_label = get_node("%RingsLabel")
	_lives_label = get_node("%LivesLabel")
	_speed_label = get_node("%SpeedLabel")

	# Find the player node in the scene
	_player = get_tree().root.find_child("Player", true, false) as Player
	if _player != null:
		# Connect to stats signal
		_player.player_stats_changed.connect(_on_player_stats_changed)

		# Initial call to setup stats
		_on_player_stats_changed(_player.rings, _player.score, _player.velocity.length(), _player.Lives)


func _process(delta: float) -> void:
	# Update time directly
	if _player != null:
		var elapsed := _player.time_elapsed
		var minutes := int(elapsed / 60)
		var seconds := int(elapsed) % 60
		var centiseconds := int(elapsed * 100) % 100

		# Format time as 0' 13" 71 like Sonic games
		_time_label.text = "%d' %02d\" %02d" % [minutes, seconds, centiseconds]

	# Blinking Rings label when rings are zero
	if _player != null and _player.rings == 0:
		_blink_timer += delta
		if _blink_timer >= 0.25:
			_blink_timer = 0.0
			_rings_blink_red = not _rings_blink_red
			# Alternate between bright red and a warning yellow
			_rings_label.add_theme_color_override("font_color",
					Color(1.0, 0.15, 0.15) if _rings_blink_red else Color(1.0, 0.85, 0.0))
	else:
		_rings_label.add_theme_color_override("font_color", Color(1.0, 0.85, 0.0)) # Golden color when has rings


func _on_player_stats_changed(rings: int, score: int, speed: float, lives: int) -> void:
	# Sonic score uses 9 digits (e.g. 000000300)
	_score_label.text = "%09d" % score
	_rings_label.text = "%03d" % rings
	_lives_label.text = "x %02d" % lives

	# Speed in km/h
	var speed_kmh := speed * 3.6
	_speed_label.text = "%.1f km/h" % speed_kmh

	# Bounce effect on ring collect
	if rings > 0:
		var tween := create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		# Animate scale to draw attention
		tween.tween_property(_rings_label, "scale", Vector2(1.25, 1.25), 0.05)
		tween.tween_property(_rings_label, "scale", Vector2.ONE, 0.15)
