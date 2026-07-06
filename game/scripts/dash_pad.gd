class_name DashPad
extends Area3D

@export var BoostForce := 32.0
@export var BoostDirection := Vector3.RIGHT
@export var ControlLockDuration := 0.4

var _mesh_instance: MeshInstance3D
var _boost_particles: CPUParticles3D
var _is_animating := false


func _ready() -> void:
	_mesh_instance = get_node_or_null("MeshInstance3D")
	_boost_particles = get_node_or_null("BoostParticles")
	body_entered.connect(_on_body_entered)
	BoostDirection = BoostDirection.normalized()


func _on_body_entered(body: Node3D) -> void:
	if body is Player:
		# Calculate and apply boost
		var boost_vel := BoostDirection * BoostForce
		body.apply_boost(boost_vel, ControlLockDuration)
		body.is_rolling = true # Force into roll ball form

		# Particle effect
		if _boost_particles != null:
			_boost_particles.restart()
			_boost_particles.emitting = true

		# Pulsing Material emission for visual feedback
		if _mesh_instance != null and not _is_animating:
			_is_animating = true

			# Fetch the material (we assume the mesh has a StandardMaterial3D at index 0)
			var mat := _mesh_instance.get_active_material(0)
			if mat is StandardMaterial3D:
				# Enable emission if not already
				mat.emission_enabled = true
				var original_energy: float = mat.emission_energy_multiplier

				var tween := create_tween()
				# Flash emission energy bright
				tween.tween_property(mat, "emission_energy_multiplier", original_energy + 5.0, 0.05)
				# Fade back to normal
				tween.tween_property(mat, "emission_energy_multiplier", original_energy, 0.3)
				tween.finished.connect(func() -> void: _is_animating = false)
			else:
				_is_animating = false
