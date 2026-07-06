class_name Ring
extends Area3D

# Exported names stay PascalCase for compatibility with existing .tscn files
# and the map pipeline output.
@export var RotateSpeed := 3.0
@export var GravityForce := 25.0
@export var BounceDampening := 0.7

var _is_scattered := false
var _velocity := Vector3.ZERO
var _collectible_timer := 0.0
var _lifetime_timer := 10.0 # Scattered rings disappear after 10s
var _spark_particles: CPUParticles3D
var _mesh_instance: MeshInstance3D
var _ray_cast: RayCast3D


func _ready() -> void:
	_spark_particles = get_node_or_null("SparkParticles")
	_mesh_instance = get_node_or_null("MeshInstance3D")
	_ray_cast = get_node_or_null("RayCast3D")

	body_entered.connect(_on_body_entered)


func _physics_process(delta: float) -> void:
	# Rotate the ring visual
	if _mesh_instance != null:
		_mesh_instance.rotate_y(RotateSpeed * delta)

	# Process physics if scattered
	if _is_scattered:
		_collectible_timer -= delta
		_lifetime_timer -= delta

		if _lifetime_timer <= 0.0:
			queue_free()
			return

		# Apply gravity and movement
		_velocity.y -= GravityForce * delta
		global_position += _velocity * delta

		# Zero Z position just in case
		var pos := global_position
		pos.z = 0
		global_position = pos

		# Bouncing on obstacles
		if _ray_cast != null:
			# Align raycast with movement direction
			_ray_cast.target_position = _velocity * delta * 1.5
			_ray_cast.force_raycast_update()

			if _ray_cast.is_colliding():
				var normal := _ray_cast.get_collision_normal()
				# Bounce velocity
				_velocity = _velocity.bounce(normal) * BounceDampening

				# Reposition slightly away from collision point
				global_position = _ray_cast.get_collision_point() + normal * 0.1


func scatter(velocity: Vector3) -> void:
	_is_scattered = true
	_velocity = velocity
	_collectible_timer = 0.5 # Prevent immediate collection
	_lifetime_timer = 8.0

	# Enable raycast for collision detection
	if _ray_cast != null:
		_ray_cast.enabled = true

	# Make it flash near expiration
	get_tree().create_timer(5.0).timeout.connect(func() -> void:
		if not is_instance_valid(self):
			return
		var flash_tween := create_tween().set_loops()
		flash_tween.tween_callback(func() -> void:
			if _mesh_instance != null:
				_mesh_instance.visible = not _mesh_instance.visible)
		flash_tween.tween_interval(0.15)
	)


func _on_body_entered(body: Node3D) -> void:
	if body is Player:
		# If scattered, make sure it is collectible
		if _is_scattered and _collectible_timer > 0.0:
			return

		# Collect ring!
		body.collect_ring()

		# Disable collision to prevent double pickup
		set_deferred("monitoring", false)

		# Hide mesh
		if _mesh_instance != null:
			_mesh_instance.visible = false

		# Trigger pickup particles if any
		if _spark_particles != null:
			_spark_particles.emitting = true
			# Wait for particles to finish before deleting
			get_tree().create_timer(_spark_particles.lifetime).timeout.connect(queue_free)
		else:
			queue_free()
