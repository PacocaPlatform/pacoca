class_name Player
extends CharacterBody3D

# Movement configuration (Sonic style)
# Exported names stay PascalCase for compatibility with existing .tscn files.
@export var MaxSpeed := 24.0
# Absolute horizontal speed cap (70 km/h = 19.44 m/s). Caps spin dash, slopes and boosts.
@export var MaxSpeedCap := 19.44
@export var Acceleration := 18.0
@export var Deceleration := 45.0
@export var Friction := 30.0
@export var Gravity := 35.0
@export var JumpVelocity := 21.0
@export var AirControl := 0.7
@export var SlopeAccelerationMultiplier := 15.0
# Steepest surface still treated as floor. Editor ramps drawn at the default
# grid scale (2m wide x 3m tall cells) are ~56.3 degrees, so this must stay
# above that or every generated ramp behaves as a wall (Godot default is 45).
@export var FloorMaxAngleDegrees := 60.0
# Game-feel forgiveness windows: jump still works this long after running
# off a ledge (coyote), and a jump pressed this long before landing fires
# on touchdown (buffer).
@export var CoyoteTime := 0.1
@export var JumpBufferTime := 0.12
# Longer than Godot's 0.1 default so the sphere collider stays glued to
# ramps when running downhill at speed instead of skipping into the air.
@export var FloorSnapLen := 0.5

# Air dash (second jump) parameters
@export var AirDashSpeed := 18.0           # upward launch of the second jump
@export var AirDashHorizontalSpeed := 6.0  # sideways nudge when a direction is held

# Spin Dash parameters
@export var SpinDashMinCharge := 18.0
@export var SpinDashMaxCharge := 38.0

# State variables
@export var Lives := 3
@export var SpawnPosition := Vector3(-12.0, 1.5, 0.0)
var is_rolling := false
var was_rolling := false
var is_spin_dashing := false
var spin_dash_charge := 0.0
var rings := 0
var score := 0
var time_elapsed := 0.0
var is_level_finished := false

var _is_invincible := false
var _invincibility_timer := 0.0
var _boost_timer := 0.0
var _custom_boost_velocity := Vector3.ZERO
var _ground_normal := Vector3.UP
var _animation_time := 0.0
var _facing_direction := 1 # 1 = right, -1 = left
var _current_z_rotation := 0.0
var _current_y_rotation := PI / 2 # Default to facing right
var _has_air_dashed := false
var _air_dash_gravity_delay := 0.0
var _coyote_timer := 0.0
var _jump_buffer_timer := 0.0
var _was_on_floor := true
var _camera: Node3D # CameraController (duck-typed to avoid a class cycle with Main)

# Live telemetry to the map editor (enabled only when launched with --telemetry=<url>,
# which the editor's "Test Level" button passes). Throttled so HTTP never stalls physics.
var _telemetry_enabled := false
var _telemetry_url := ""
var _telemetry_level := ""
var _telemetry_timer := 0.0
const TELEMETRY_INTERVAL := 0.06 # ~15 Hz
var _telemetry_http: HTTPRequest

# Node references
var _visuals_node: Node3D
var _body_node: Node3D
var _idle_model: Node3D
var _running_model: Node3D
var _jumping_model: Node3D
var _idle_anim_player: AnimationPlayer
var _running_anim_player: AnimationPlayer
var _jumping_anim_player: AnimationPlayer
var _dust_particles: CPUParticles3D
var _speed_wind_particles: CPUParticles3D

# Audio Player for procedural sounds
var _audio_player: AudioStreamPlayer
var _audio_playback: AudioStreamGeneratorPlayback

# Signal for UI
signal player_stats_changed(rings: int, score: int, speed: float, lives: int)


func _ready() -> void:
	# Get references to nodes
	_visuals_node = get_node("Visuals")
	_body_node = get_node("Visuals/Body")
	_idle_model = get_node("Visuals/Body/IdleModel")
	_running_model = get_node("Visuals/Body/RunningModel")
	_jumping_model = get_node("Visuals/Body/JumpingModel")
	_idle_anim_player = get_node("Visuals/Body/IdleModel/AnimationPlayer")
	_running_anim_player = get_node("Visuals/Body/RunningModel/AnimationPlayer")
	_jumping_anim_player = get_node("Visuals/Body/JumpingModel/AnimationPlayer")

	# Set up animations to loop and play
	if _idle_anim_player.has_animation("mixamo_com"):
		_idle_anim_player.get_animation("mixamo_com").loop_mode = Animation.LOOP_LINEAR
		_idle_anim_player.play("mixamo_com")
	if _running_anim_player.has_animation("mixamo_com"):
		_running_anim_player.get_animation("mixamo_com").loop_mode = Animation.LOOP_LINEAR
		_running_anim_player.play("mixamo_com")
	if _jumping_anim_player.has_animation("mixamo_com"):
		var anim := _jumping_anim_player.get_animation("mixamo_com")
		# Remove root/hips translation tracks to prevent visual offset (in-place jump animation)
		for i in range(anim.get_track_count() - 1, -1, -1):
			var track_path := anim.track_get_path(i)
			var track_type := anim.track_get_type(i)
			if track_type == Animation.TYPE_POSITION_3D and String(track_path).contains("mixamorig_Hips"):
				anim.remove_track(i)
		anim.loop_mode = Animation.LOOP_LINEAR
		_jumping_anim_player.play("mixamo_com")

	_dust_particles = get_node("DustParticles")
	_speed_wind_particles = get_node("SpeedWindParticles")

	# Setup procedural audio player
	_audio_player = AudioStreamPlayer.new()
	add_child(_audio_player)
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = 44100.0
	generator.buffer_length = 0.1
	_audio_player.stream = generator
	_audio_player.play()
	_audio_playback = _audio_player.get_stream_playback() as AudioStreamGeneratorPlayback

	floor_max_angle = deg_to_rad(FloorMaxAngleDegrees)
	floor_snap_length = FloorSnapLen

	_configure_telemetry()

	_emit_stats()


# Reads --telemetry=<baseurl> / --level=<id> from the cmdline user args (passed by the
# map editor). When present, the player streams its position to the editor for the live map.
func _configure_telemetry() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--telemetry="):
			_telemetry_url = arg.substr("--telemetry=".length()).strip_edges().rstrip("/") + "/api/telemetry"
			_telemetry_enabled = not _telemetry_url.is_empty()
		elif arg == "--telemetry":
			_telemetry_url = "http://127.0.0.1:8000/api/telemetry"
			_telemetry_enabled = true
		elif arg.begins_with("--level="):
			_telemetry_level = arg.substr("--level=".length()).strip_edges()
	if _telemetry_enabled:
		_telemetry_http = HTTPRequest.new()
		add_child(_telemetry_http)
		print("player.gd: live telemetry -> %s" % _telemetry_url)


func _send_telemetry() -> void:
	# Fire-and-forget; skip when the previous request is still in flight so
	# telemetry never interferes with gameplay.
	if _telemetry_http == null or _telemetry_http.get_http_client_status() != HTTPClient.STATUS_DISCONNECTED:
		return
	var p := global_position
	var json := JSON.stringify({
		"level": _telemetry_level,
		"x": snappedf(p.x, 0.001),
		"y": snappedf(p.y, 0.001),
		"on_floor": is_on_floor(),
		"speed": snappedf(velocity.length(), 0.001),
	})
	_telemetry_http.request(_telemetry_url, ["Content-Type: application/json"], HTTPClient.METHOD_POST, json)


func _physics_process(delta: float) -> void:
	if _telemetry_enabled:
		_telemetry_timer -= delta
		if _telemetry_timer <= 0.0:
			_telemetry_timer = TELEMETRY_INTERVAL
			_send_telemetry()

	if is_level_finished:
		velocity = Vector3.ZERO
		is_rolling = true
		_update_visuals(delta)
		return

	was_rolling = is_rolling
	time_elapsed += delta

	# Pit detection (falling below the level)
	if global_position.y < -15.0:
		respawn()
		return

	# Locked to XY plane - ensure Z position is strictly 0
	var pos := global_position
	if absf(pos.z) > 0.01:
		pos.z = 0
		global_position = pos

	# Manage timers
	if _boost_timer > 0.0:
		_boost_timer -= delta
	if _is_invincible:
		_invincibility_timer -= delta
		if _invincibility_timer <= 0.0:
			_is_invincible = false
		# Flash character visually
		_visuals_node.visible = wrapi(int(_invincibility_timer * 20), 0, 2) == 0
	else:
		_visuals_node.visible = true

	# Jump-buffer window: remember a jump press briefly so it fires on landing
	if Input.is_action_just_pressed("jump"):
		_jump_buffer_timer = JumpBufferTime
	elif _jump_buffer_timer > 0.0:
		_jump_buffer_timer -= delta

	# Calculate custom gravity/physics
	var vel := velocity

	# Ground detection and normal alignment
	if is_on_floor():
		_has_air_dashed = false
		_air_dash_gravity_delay = 0.0
		_coyote_timer = CoyoteTime
		_ground_normal = get_floor_normal()

		# Apply horizontal slope physics (gravity pulls you down slopes)
		if absf(_ground_normal.x) > 0.05 and not is_spin_dashing:
			# Friction is reduced on slopes
			var slope_force := -_ground_normal.x * SlopeAccelerationMultiplier * delta
			vel.x += slope_force
	else:
		if _coyote_timer > 0.0:
			_coyote_timer -= delta

		# Smoothly align back to upright in air
		_ground_normal = _ground_normal.lerp(Vector3.UP, 10.0 * delta)

		# Air gravity
		if _air_dash_gravity_delay > 0.0:
			_air_dash_gravity_delay -= delta
		else:
			vel.y -= Gravity * delta

	# Process inputs if not locked by boost/dash
	if _boost_timer <= 0.0:
		vel = _handle_inputs(delta, vel)
	else:
		# Apply dash/spring lock velocity override
		vel.x = _custom_boost_velocity.x
		if absf(_custom_boost_velocity.y) > 0.01:
			vel.y = _custom_boost_velocity.y
		# Slowly decay custom boost force
		_custom_boost_velocity = _custom_boost_velocity.lerp(Vector3.ZERO, 2.0 * delta)

	# Clamp horizontal speed to the cap (80 km/h) regardless of source (spin dash, slopes, boost)
	if absf(vel.x) > MaxSpeedCap:
		vel.x = signf(vel.x) * MaxSpeedCap

	# Apply velocities
	var was_airborne_before_move := not is_on_floor()
	var pre_move_vel_x := vel.x
	velocity = vel
	move_and_slide()

	# Prevent wall/corner collisions from injecting extra horizontal speed while airborne.
	# The spherical collider can roll over a wall's top edge during the air dash, where the
	# diagonal corner normal makes move_and_slide convert the (gravity-suspended) upward launch
	# into an uncontrollable horizontal fling. A collision must never speed us up sideways.
	if was_airborne_before_move and not is_on_floor():
		var slid_vel := velocity
		if absf(slid_vel.x) > absf(pre_move_vel_x) + 0.01:
			slid_vel.x = signf(slid_vel.x) * absf(pre_move_vel_x)
			velocity = slid_vel

	# Landing logic: reset rolling state on landing to restore full ground control / braking
	var on_floor := is_on_floor()
	if on_floor and not _was_on_floor:
		is_rolling = false
	_was_on_floor = on_floor

	# Strict 2D Lock: prevent Z drift
	vel = velocity
	vel.z = 0.0
	velocity = vel

	# Screen boundary clamp (left edge)
	if _camera == null:
		_camera = get_parent().get_node_or_null("Camera3D")
	if _camera != null:
		var left_boundary_x: float = _camera.get_left_boundary_x()
		var player_radius := 0.55
		if global_position.x < left_boundary_x + player_radius:
			var clamped_pos := global_position
			clamped_pos.x = left_boundary_x + player_radius
			global_position = clamped_pos

			# Zero horizontal leftward velocity if moving left
			if velocity.x < 0:
				var p_vel := velocity
				p_vel.x = 0
				velocity = p_vel

	# Visual orientation & procedural animations
	_update_visuals(delta)

	# Speed particles
	var speed := absf(velocity.x)
	_speed_wind_particles.emitting = speed > MaxSpeed * 0.8

	_emit_stats()


func _handle_inputs(delta: float, vel: Vector3) -> Vector3:
	var move_input := Input.get_axis("move_left", "move_right")
	var is_down_pressed := Input.is_action_pressed("move_down")
	var is_jump_pressed := Input.is_action_just_pressed("jump")

	# Set facing direction
	if move_input > 0.05 and not is_spin_dashing:
		_facing_direction = 1
	elif move_input < -0.05 and not is_spin_dashing:
		_facing_direction = -1

	if is_on_floor():
		# Reset rolling if moving very slowly
		if is_rolling and absf(vel.x) < 1.0:
			is_rolling = false

		# Check for Spin Dash activation
		if is_down_pressed and absf(vel.x) < 1.0:
			if not is_spin_dashing:
				is_spin_dashing = true
				spin_dash_charge = 0.0
				play_sound(440.0, 0.1, 0.4) # Procedural spin dash start

			vel.x = move_toward(vel.x, 0, Friction * 2.0 * delta)

			if is_jump_pressed:
				spin_dash_charge = minf(spin_dash_charge + 6.0, SpinDashMaxCharge)
				play_sound(440.0 + spin_dash_charge * 15.0, 0.1, 0.5) # Higher pitch as charged
				# Add jump spin particle burst
				_dust_particles.restart()

			# Slow decay of charge
			spin_dash_charge = move_toward(spin_dash_charge, SpinDashMinCharge, 4.0 * delta)
		else:
			# Release Spin Dash
			if is_spin_dashing:
				is_spin_dashing = false
				is_rolling = true
				vel.x = _facing_direction * (SpinDashMinCharge + spin_dash_charge)
				play_sound(600.0, 0.25, 0.6) # Launch sound
				_dust_particles.restart()
				# Charging presses jump repeatedly; don't let the last press
				# buffer into an accidental hop right after launching.
				_jump_buffer_timer = 0.0

			# Standard movement
			if move_input != 0:
				if is_rolling:
					# Rolling movement - slower acceleration/deceleration on player inputs
					vel.x = move_toward(vel.x, move_input * MaxSpeed, Acceleration * 0.4 * delta)
				else:
					# Standard running movement
					var target_speed := move_input * MaxSpeed
					# Decelerate (brake) faster than accelerating
					var is_braking := (move_input > 0 and vel.x < 0) or (move_input < 0 and vel.x > 0)
					var rate := Deceleration if is_braking else Acceleration
					vel.x = move_toward(vel.x, target_speed, rate * delta)

					# Dust emission when turning rapidly (skidding)
					_dust_particles.emitting = is_braking and absf(vel.x) > 5.0
			else:
				# Apply Friction
				var decel_rate := Friction * 0.25 if is_rolling else Friction
				vel.x = move_toward(vel.x, 0, decel_rate * delta)
				_dust_particles.emitting = false

			# Initiate Roll by pressing down while running
			if is_down_pressed and absf(vel.x) > 4.0 and not is_rolling:
				is_rolling = true
				play_sound(350.0, 0.1, 0.3)

			# Jump (a press buffered just before landing also fires here)
			if (is_jump_pressed or _jump_buffer_timer > 0.0) and not is_down_pressed:
				vel.y = JumpVelocity
				is_rolling = true
				_jump_buffer_timer = 0.0
				_coyote_timer = 0.0
				play_sound(523.25, 0.15, 0.5) # C5 note jump sound
				_dust_particles.restart()
	else:
		# Air movement control
		_dust_particles.emitting = false

		# Coyote jump: still allow a normal jump briefly after walking off a
		# ledge (only while not ascending, so it never doubles a real jump).
		if is_jump_pressed and _coyote_timer > 0.0 and vel.y <= 0.1:
			vel.y = JumpVelocity
			is_rolling = true
			_coyote_timer = 0.0
			_jump_buffer_timer = 0.0
			play_sound(523.25, 0.15, 0.5) # C5 note jump sound
			_dust_particles.restart()
		elif is_jump_pressed and not _has_air_dashed:
			_has_air_dashed = true
			_jump_buffer_timer = 0.0

			var move_input_x := Input.get_axis("move_left", "move_right")

			# The second jump is primarily a vertical launch. Holding a direction adds only a
			# modest sideways nudge (AirDashHorizontalSpeed) instead of a full 45 degree dash,
			# so dashing toward a side no longer flings the player with uncontrollable speed.
			var horizontal := 0.0
			if move_input_x > 0.1:
				horizontal = AirDashHorizontalSpeed
			elif move_input_x < -0.1:
				horizontal = -AirDashHorizontalSpeed

			vel = Vector3(horizontal, AirDashSpeed, 0.0)

			# State updates
			is_rolling = true
			_air_dash_gravity_delay = 0.15 # suspend gravity briefly for sharp upward feel

			# Play double tone sound (procedural beep)
			play_sound(660.0, 0.07, 0.5)
			play_sound(880.0, 0.07, 0.5)

			# Dust particles burst
			_dust_particles.restart()
		else:
			if move_input != 0:
				vel.x = move_toward(vel.x, move_input * MaxSpeed, Acceleration * AirControl * delta)

			# Adjust height if jump released early (variable jump height)
			if not _has_air_dashed and vel.y > 0 and not Input.is_action_pressed("jump"):
				vel.y = move_toward(vel.y, 0, Gravity * 1.5 * delta)

	return vel


func _update_visuals(delta: float) -> void:
	# Calculate ground angle based on the normal vector on the XY plane
	var target_angle := atan2(_ground_normal.x, _ground_normal.y)

	# Smoothly interpolate Z-rotation (slope) and Y-rotation (facing direction)
	var target_y_rotation := PI / 2 if _facing_direction == 1 else -PI / 2

	_current_z_rotation = lerp_angle(_current_z_rotation, -target_angle, 15.0 * delta)
	_current_y_rotation = lerp_angle(_current_y_rotation, target_y_rotation, 20.0 * delta)

	# Apply Z-rotation globally (tilt along screen plane) and Y-rotation locally (turning left/right)
	_visuals_node.basis = Basis.from_euler(Vector3(0, 0, _current_z_rotation)) * \
			Basis.from_euler(Vector3(0, _current_y_rotation, 0))

	# Animate parts depending on status
	if is_rolling:
		# Reset body position & local rotation
		_body_node.position = _body_node.position.lerp(Vector3.ZERO, 10.0 * delta)
		_body_node.rotation = _body_node.rotation.lerp(Vector3.ZERO, 10.0 * delta)

		# Show jumping model and hide others
		_idle_model.visible = false
		_running_model.visible = false
		_jumping_model.visible = true
		_jumping_anim_player.speed_scale = 1.0
	elif is_spin_dashing:
		# Shaking body effect
		_animation_time += delta * 50.0
		var shake := sin(_animation_time) * 0.1
		_body_node.position = Vector3(0, shake, 0)

		# Show jumping model for spin dash charging
		_idle_model.visible = false
		_running_model.visible = false
		_jumping_model.visible = true
		_jumping_anim_player.speed_scale = 3.0
		_body_node.rotation = Vector3(0, 0, -PI / 6)
	else:
		# Reset body position & local rotation
		_body_node.position = _body_node.position.lerp(Vector3.ZERO, 10.0 * delta)
		_body_node.rotation = _body_node.rotation.lerp(Vector3.ZERO, 10.0 * delta)
		_body_node.scale = Vector3.ONE

		var speed := absf(velocity.x)
		if is_on_floor():
			if speed > 0.1:
				# Show running model
				_idle_model.visible = false
				_running_model.visible = true
				_jumping_model.visible = false

				# Adjust animation speed based on velocity
				_running_anim_player.speed_scale = maxf(0.5, speed / MaxSpeed * 1.8)
			else:
				# Show idle model
				_idle_model.visible = true
				_running_model.visible = false
				_jumping_model.visible = false
				_idle_anim_player.speed_scale = 1.0
		else:
			# In air but not rolling (e.g. falling)
			_idle_model.visible = false
			_running_model.visible = false
			_jumping_model.visible = true
			_jumping_anim_player.speed_scale = 1.0


func collect_ring() -> void:
	rings += 1
	score += 100
	_play_ring_sound()
	_emit_stats()


func apply_boost(velocity_boost: Vector3, lock_duration: float) -> void:
	_boost_timer = lock_duration
	_custom_boost_velocity = velocity_boost
	velocity = velocity_boost
	is_rolling = true
	play_sound(783.99, 0.15, 0.6) # G5 note boost sound


func hurt(hazard_source: Vector3) -> void:
	if _is_invincible:
		return

	if rings > 0:
		_scatter_rings()
		rings = 0
		_is_invincible = true
		_invincibility_timer = 2.0

		# Bounce player away
		var push_dir := (global_position - hazard_source).normalized()
		push_dir.z = 0.0
		velocity = Vector3(push_dir.x * 12.0, 10.0, 0)
		is_rolling = false

		play_sound(150.0, 0.4, 0.8) # Low frequency thud/hurt sound
		_emit_stats()
	else:
		# Game Over / Respawn
		respawn()


func _scatter_rings() -> void:
	var count := mini(rings, 20) # Limit scattered rings to avoid lag
	var ring_scene := load("res://scenes/ring.tscn") as PackedScene

	for i in count:
		var ring_instance := ring_scene.instantiate() as Ring
		get_parent().add_child(ring_instance)

		# Spawn slightly offset from player
		ring_instance.global_position = global_position + Vector3(0, 0.5, 0)

		# Scatter in an arc
		var angle := PI * (i / float(count)) + randf_range(-0.2, 0.2)
		var speed := randf_range(6.0, 12.0)
		var scatter_velocity := Vector3(cos(angle) * speed, sin(angle) * speed + 3.0, 0.0)

		ring_instance.scatter(scatter_velocity)


func respawn() -> void:
	rings = 0
	velocity = Vector3.ZERO
	_boost_timer = 0.0
	is_rolling = false
	is_spin_dashing = false
	_is_invincible = true
	_invincibility_timer = 3.0
	time_elapsed = 0.0

	Lives -= 1
	if Lives <= 0:
		# Game Over: reset lives and return to Game Over screen
		Lives = 3
		score = 0
		time_elapsed = 0
		get_tree().change_scene_to_file("res://scenes/game_over.tscn")
	else:
		play_sound(220.0, 0.5, 0.5)

		# Restart the stage (reload the level scene)
		var main := get_tree().current_scene
		if main != null and main.has_method("restart_stage"):
			main.restart_stage()
		else:
			global_position = SpawnPosition

	_emit_stats()


func _emit_stats() -> void:
	player_stats_changed.emit(rings, score, velocity.length(), Lives)


# Procedural Audio Helper for retro sound effects
func play_sound(frequency: float, duration: float, volume := 0.5) -> void:
	if _audio_playback == null:
		return

	var sample_rate := 44100.0
	var num_samples := int(sample_rate * duration)
	var phase := 0.0
	var phase_increment := (2.0 * PI * frequency) / sample_rate

	for i in num_samples:
		if _audio_playback.get_frames_available() > 0:
			# Envelope: Linear fade out
			var envelope := float(num_samples - i) / num_samples
			var sample := sin(phase) * volume * envelope
			_audio_playback.push_frame(Vector2(sample, sample))
			phase += phase_increment


func _play_ring_sound() -> void:
	# Sonic-like chime sound: a sequence of two rapid high tones
	if _audio_playback == null:
		return

	var sample_rate := 44100.0
	var duration := 0.25
	var num_samples := int(sample_rate * duration)
	var phase := 0.0

	for i in num_samples:
		if _audio_playback.get_frames_available() > 0:
			# Sequence pitch: 1800Hz for first half, 2300Hz for second half
			var current_freq := 1800.0 if i < num_samples / 2.0 else 2300.0
			var phase_increment := (2.0 * PI * current_freq) / sample_rate
			var envelope := float(num_samples - i) / num_samples
			var sample := sin(phase) * 0.3 * envelope

			_audio_playback.push_frame(Vector2(sample, sample))
			phase += phase_increment
