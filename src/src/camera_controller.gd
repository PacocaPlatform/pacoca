class_name CameraController
extends Camera3D

@export var TargetPath: NodePath
@export var FollowSpeed := 6.0
@export var Offset := Vector2(2.0, 4.5) # Look slightly ahead of player

var _target: Node3D
var _original_z := 0.0
var _min_x := 0.0
var _target_y := 0.0
var _limits_initialized := false


func _ready() -> void:
	if not TargetPath.is_empty():
		_target = get_node_or_null(TargetPath)

	# Save initial Z distance
	_original_z = global_position.z


func reset_camera_limits() -> void:
	if _target == null:
		return
	_min_x = _target.global_position.x + Offset.x
	_target_y = _target.global_position.y + Offset.y
	_limits_initialized = true

	var target_camera_pos := Vector3(_min_x, _target_y, _original_z)
	if target_camera_pos.y < 2.0:
		target_camera_pos.y = 2.0
	global_position = target_camera_pos


func get_left_boundary_x() -> float:
	var fov_rad := deg_to_rad(fov)
	var distance := absf(global_position.z)
	var half_height := distance * tan(fov_rad / 2.0)

	var aspect := 16.0 / 9.0
	if get_viewport() != null:
		var rect := get_viewport().get_visible_rect()
		if rect.size.y > 0:
			aspect = rect.size.x / rect.size.y

	var half_width := half_height * aspect
	return global_position.x - half_width


func _physics_process(delta: float) -> void:
	if _target == null:
		return

	if not _limits_initialized:
		reset_camera_limits()

	var target_pos := _target.global_position

	# Smoothly interpolate the X and Y coordinates to track the player, plus offset
	# In Sonic, we offset the camera in the direction of the player's movement
	var player_vel := Vector3.ZERO
	var is_grounded := true
	if _target is Player:
		player_vel = _target.velocity
		is_grounded = _target.is_on_floor()

	# Calculate screen half-height in 3D units based on camera FOV and Z distance
	var fov_rad := deg_to_rad(fov)
	var distance := absf(global_position.z)
	var half_height := distance * tan(fov_rad / 2.0)

	if is_grounded:
		_target_y = target_pos.y + Offset.y
	else:
		# In the air (jumping/falling):
		# 1. If player passes 80% of the viewport height from bottom, push the camera target Y up.
		# 80% height corresponds to global_position.y + 0.6 * half_height
		var upper_threshold := global_position.y + 0.6 * half_height
		if target_pos.y > upper_threshold:
			_target_y = maxf(_target_y, target_pos.y - 0.6 * half_height)
		# 2. If player falls below 15% of the viewport height from bottom, pull the camera target Y down.
		# 15% height corresponds to global_position.y - 0.7 * half_height
		var lower_threshold := global_position.y - 0.7 * half_height
		if target_pos.y < lower_threshold:
			_target_y = minf(_target_y, target_pos.y + 0.7 * half_height)

	var lead_x := clampf(player_vel.x * 0.15, -3.0, 3.0)
	var target_camera_pos := Vector3(
		target_pos.x + Offset.x + lead_x,
		_target_y,
		_original_z
	)

	# Clamp the camera's target position to the left limit
	if target_camera_pos.x < _min_x:
		target_camera_pos.x = _min_x

	# Keep camera bound within level limits (optional, but prevents going below ground)
	if target_camera_pos.y < 2.0:
		target_camera_pos.y = 2.0

	global_position = global_position.lerp(target_camera_pos, FollowSpeed * delta)

	# Enforce limit strictly
	if global_position.x < _min_x:
		var current_pos := global_position
		current_pos.x = _min_x
		global_position = current_pos
