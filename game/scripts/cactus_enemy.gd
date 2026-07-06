class_name CactusEnemy
extends Enemy

enum State {
	WALKING,
	TURNING,
}

var _current_state := State.WALKING

var _walking_model: Node3D
var _turning_model: Node3D
var _walking_anim_player: AnimationPlayer
var _turning_anim_player: AnimationPlayer


func _ready() -> void:
	super._ready()

	_walking_model = get_node_or_null("Visuals/WalkingModel")
	_turning_model = get_node_or_null("Visuals/TurningModel")

	if _walking_model != null:
		_walking_anim_player = _walking_model.get_node_or_null("AnimationPlayer")
	if _turning_model != null:
		_turning_anim_player = _turning_model.get_node_or_null("AnimationPlayer")

	# Configure walking animation to loop
	if _walking_anim_player != null and _walking_anim_player.has_animation("mixamo_com"):
		var walk_anim := _walking_anim_player.get_animation("mixamo_com")
		walk_anim.loop_mode = Animation.LOOP_LINEAR
		_walking_anim_player.play("mixamo_com")

	# Hook up turning animation finished signal
	if _turning_anim_player != null:
		_turning_anim_player.animation_finished.connect(_on_turn_animation_finished)

	# Initial visual states
	if _walking_model != null:
		_walking_model.visible = true
	if _turning_model != null:
		_turning_model.visible = false

	_current_state = State.WALKING

	# Apply initial visual rotation based on starting Direction
	_update_visuals_rotation()


func _physics_process(delta: float) -> void:
	if _is_destroyed:
		return

	var vel := velocity

	# Apply gravity if not on floor
	if not is_on_floor():
		vel.y -= Gravity * delta
	else:
		vel.y = 0.0

	# Lock movement to XY plane
	var pos := global_position
	if absf(pos.z) > 0.01:
		pos.z = 0
		global_position = pos

	if _current_state == State.WALKING:
		# Check for wall collisions or cliff edges
		var must_turn := false

		# Wall collision
		if is_on_wall():
			must_turn = true
		# Wall raycast detection
		if _wall_ray_cast != null:
			_wall_ray_cast.target_position = Direction * 1.44
			_wall_ray_cast.force_raycast_update()
			if _wall_ray_cast.is_colliding():
				must_turn = true
		# Cliff edge detection
		if _floor_ray_cast != null:
			_floor_ray_cast.position = Direction * 1.08 + Vector3.UP * 0.1
			_floor_ray_cast.force_raycast_update()
			if not _floor_ray_cast.is_colliding():
				must_turn = true

		if must_turn:
			_start_turning()
			# We stop moving during transition
			vel.x = 0.0
		else:
			vel.x = Direction.x * Speed
	elif _current_state == State.TURNING:
		# Stand still while turning (gravity is still applied above)
		vel.x = 0.0

	vel.z = 0.0
	velocity = vel
	move_and_slide()


func _start_turning() -> void:
	_current_state = State.TURNING

	# Hide walking model, show turning model
	if _walking_model != null:
		_walking_model.visible = false
	if _turning_model != null:
		_turning_model.visible = true
		if _turning_anim_player != null and _turning_anim_player.has_animation("mixamo_com"):
			_turning_anim_player.play("mixamo_com")


func _on_turn_animation_finished(_anim_name: StringName) -> void:
	if _current_state == State.TURNING:
		# Change direction
		Direction = -Direction

		# Update visual node rotation based on new direction
		_update_visuals_rotation()

		# Swap models back
		if _turning_model != null:
			_turning_model.visible = false
		if _walking_model != null:
			_walking_model.visible = true
			if _walking_anim_player != null and _walking_anim_player.has_animation("mixamo_com"):
				_walking_anim_player.play("mixamo_com")

		_current_state = State.WALKING


func _update_visuals_rotation() -> void:
	if _visuals_node != null:
		var target_rot := PI / 2 if Direction.x > 0 else -PI / 2
		_visuals_node.rotation = Vector3(0, target_rot, 0)
