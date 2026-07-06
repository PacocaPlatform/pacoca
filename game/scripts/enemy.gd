class_name Enemy
extends CharacterBody3D

@export var Speed := 3.0
@export var Gravity := 35.0
@export var Direction := Vector3.RIGHT

var _wall_ray_cast: RayCast3D
var _floor_ray_cast: RayCast3D
var _visuals_node: Node3D
var _explosion_particles: CPUParticles3D
var _collision_shape: CollisionShape3D
var _is_destroyed := false


func _ready() -> void:
	_wall_ray_cast = get_node_or_null("WallRayCast")
	_floor_ray_cast = get_node_or_null("FloorRayCast")
	_visuals_node = get_node_or_null("Visuals")
	_explosion_particles = get_node_or_null("ExplosionParticles")
	_collision_shape = get_node_or_null("CollisionShape3D")

	# Set direction normalized
	Direction = Direction.normalized()

	# Setup player detection area
	var detection_area: Area3D = get_node_or_null("DetectionArea")
	if detection_area != null:
		detection_area.body_entered.connect(_on_player_entered)


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

	# Check for wall collisions or cliff edges
	var must_turn := false

	# Wall collision
	if is_on_wall():
		must_turn = true
	# Wall raycast detection
	if _wall_ray_cast != null:
		_wall_ray_cast.target_position = Direction * 0.8
		_wall_ray_cast.force_raycast_update()
		if _wall_ray_cast.is_colliding():
			must_turn = true
	# Cliff edge detection
	if _floor_ray_cast != null:
		# Position the raycast slightly in front of the enemy
		_floor_ray_cast.position = Direction * 0.6 + Vector3.UP * 0.1
		_floor_ray_cast.force_raycast_update()
		if not _floor_ray_cast.is_colliding():
			must_turn = true

	if must_turn:
		Direction = -Direction
		if _visuals_node != null:
			# Flip visual mesh (rotate 180 degrees around Y axis)
			var target_rot := 0.0 if Direction.x > 0 else PI
			_visuals_node.rotation = Vector3(0, target_rot, 0)

	# Move the enemy
	vel.x = Direction.x * Speed
	vel.z = 0.0
	velocity = vel
	move_and_slide()


func get_collision_height() -> float:
	if _collision_shape != null and _collision_shape.shape != null:
		var shape := _collision_shape.shape
		if shape is CylinderShape3D:
			return shape.height
		elif shape is BoxShape3D:
			return shape.size.y
		elif shape is SphereShape3D:
			return shape.radius * 2.0
	return 1.0


func _on_player_entered(body: Node3D) -> void:
	if _is_destroyed:
		return

	if body is Player:
		var player: Player = body
		# Determine enemy midpoint Y in global coordinates
		var enemy_mid_y := global_position.y + (_collision_shape.position.y if _collision_shape != null else 0.0)
		# Player's bottom Y (sphere shape radius is 0.55 at offset 0.05, so bottom is Y - 0.5)
		var player_bottom_y := player.global_position.y - 0.5

		# Player is landing on top if they are above the midpoint and not moving upwards
		var is_landing_on_top := player.velocity.y <= 0.1 and player_bottom_y > enemy_mid_y

		# If the player is rolling (spin dash/jump/roll state), was rolling, or landing on top of the enemy
		var is_player_attacking := player.is_rolling or player.was_rolling or is_landing_on_top

		if is_player_attacking:
			_destroy_enemy(player)
		else:
			player.hurt(global_position)


func _destroy_enemy(player: Player) -> void:
	_is_destroyed = true

	# Give player a little jump bounce
	var player_vel := player.velocity
	player_vel.y = maxf(player_vel.y, 10.0) # bounce up
	player.velocity = player_vel

	player.score += 200 # Defeat enemy score bonus
	player.play_sound(880.0, 0.1, 0.4) # Play high pitch explosion beep

	# Disable collision shapes
	if _collision_shape != null:
		_collision_shape.set_deferred("disabled", true)

	var area: Area3D = get_node_or_null("DetectionArea")
	if area != null:
		area.set_deferred("monitoring", false)
		area.set_deferred("monitorable", false)

	# Hide visual mesh
	if _visuals_node != null:
		_visuals_node.visible = false

	# Play explosion particles
	if _explosion_particles != null:
		_explosion_particles.restart()
		_explosion_particles.emitting = true
		# Delete enemy after particles finish
		get_tree().create_timer(_explosion_particles.lifetime).timeout.connect(queue_free)
	else:
		queue_free()
