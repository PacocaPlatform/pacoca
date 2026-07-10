extends AnimatableBody3D

@export var direction: String = "horizontal"
@export var travel_range: float = 4.0
@export var speed: float = 2.0
@export var width: float = 2.0
@export var rock_height: float = 4.0
@export var top_material: Material
@export var rock_material: Material
@export var initial_direction: String = "default"
@export var invert_on_collision: bool = true
@export var use_range_limit: bool = false

var start_position: Vector3
var current_velocity: Vector3
var is_initialized: bool = false

func _ready() -> void:
	start_position = global_position
	
	# Determine speed multiplier based on initial direction
	var speed_multiplier = 1.0
	if initial_direction == "left" or initial_direction == "down":
		speed_multiplier = -1.0
		
	# Define velocity vector based on movement direction
	if direction == "horizontal":
		current_velocity = Vector3(speed * speed_multiplier, 0, 0)
	else:
		current_velocity = Vector3(0, speed * speed_multiplier, 0)
	
	# Enable mask=1 so we detect collision with static terrain (layer 1) only if invert_on_collision is true
	collision_mask = 1 if invert_on_collision else 0
	
	# Dynamically assemble collision shape and visual meshes
	_build_platform_nodes()

func setup_materials(p_top: Material, p_rock: Material) -> void:
	top_material = p_top
	rock_material = p_rock
	if is_initialized:
		_apply_materials()

func _build_platform_nodes() -> void:
	# Fallback to standard materials if none provided
	if top_material == null:
		top_material = load("res://materials/grass.tres")
	if rock_material == null:
		rock_material = load("res://materials/rock.tres")
		
	# 1. Setup collision shape size and offset
	var collision_shape = get_node_or_null("CollisionShape3D")
	if collision_shape == null:
		collision_shape = CollisionShape3D.new()
		collision_shape.name = "CollisionShape3D"
		add_child(collision_shape)
		
	var box_shape = BoxShape3D.new()
	# The top cap has height 1.0, sub-rock has height rock_height.
	# Total thickness of platform = 1.0 + rock_height.
	# Combined vertical center is at -rock_height / 2.0.
	box_shape.size = Vector3(width, 1.0 + rock_height, 4.0)
	collision_shape.shape = box_shape
	collision_shape.position = Vector3(0, -rock_height / 2.0, 0)
	
	# 2. Build Top Grass Cap Mesh
	var top_mesh_instance = MeshInstance3D.new()
	top_mesh_instance.name = "TopMesh"
	var top_mesh = BoxMesh.new()
	top_mesh.size = Vector3(width, 1.0, 4.0)
	top_mesh_instance.mesh = top_mesh
	top_mesh_instance.position = Vector3(0, 0, 0)
	add_child(top_mesh_instance)
	
	# 3. Build Sub Rock Mesh
	var rock_mesh_instance = MeshInstance3D.new()
	rock_mesh_instance.name = "RockMesh"
	var rock_mesh = BoxMesh.new()
	rock_mesh.size = Vector3(width, rock_height, 3.8)
	rock_mesh_instance.mesh = rock_mesh
	rock_mesh_instance.position = Vector3(0, -0.5 - (rock_height / 2.0), 0)
	add_child(rock_mesh_instance)
	
	is_initialized = true
	_apply_materials()

func _apply_materials() -> void:
	var top_mesh_instance = get_node_or_null("TopMesh")
	if top_mesh_instance and top_material:
		var mat_dup = top_material.duplicate()
		if "uv1_world_triplanar" in mat_dup:
			mat_dup.uv1_world_triplanar = false
		top_mesh_instance.set_material_override(mat_dup)
		
	var rock_mesh_instance = get_node_or_null("RockMesh")
	if rock_mesh_instance and rock_material:
		var mat_dup = rock_material.duplicate()
		if "uv1_world_triplanar" in mat_dup:
			mat_dup.uv1_world_triplanar = false
		rock_mesh_instance.set_material_override(mat_dup)

func _physics_process(delta: float) -> void:
	# Move the platform and detect collisions
	var collision := move_and_collide(current_velocity * delta)
	if collision != null and invert_on_collision:
		# Reverse direction on contact with terrain
		current_velocity = -current_velocity
		
	# Apply range limit rule if enabled (vertical only)
	if direction == "vertical" and use_range_limit:
		var current_offset = global_position.y - start_position.y
		var is_down = (initial_direction == "down")
		if is_down:
			if current_offset <= -travel_range:
				current_velocity.y = speed
			elif current_offset >= 0.0:
				current_velocity.y = -speed
		else:
			if current_offset >= travel_range:
				current_velocity.y = -speed
			elif current_offset <= 0.0:
				current_velocity.y = speed
