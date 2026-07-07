class_name Spring
extends Area3D

@export var LaunchForce := 44.0
@export var LaunchDirection := Vector3.UP
@export var ControlLockDuration := 0.5

var _mesh_node: Node3D
var _is_animating := false


func _ready() -> void:
	_mesh_node = get_node_or_null("Mesh")
	body_entered.connect(_on_body_entered)
	LaunchDirection = LaunchDirection.normalized()


func _on_body_entered(body: Node3D) -> void:
	if body is Player:
		# Project launch force
		var boost_vel := LaunchDirection * LaunchForce

		# Apply boost to player
		body.apply_boost(boost_vel, ControlLockDuration)

		# Play procedural spring bounce animation using Tween
		if _mesh_node != null and not _is_animating:
			_is_animating = true
			var original_scale := _mesh_node.scale
			var original_pos := _mesh_node.position

			var tween := create_tween().set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)

			# Compress spring mesh
			var compressed_scale := original_scale
			compressed_scale.y *= 0.3 # Squash vertically
			var compressed_pos := original_pos
			compressed_pos += LaunchDirection * -0.2 # Push down in opposite direction

			tween.tween_property(_mesh_node, "scale", compressed_scale, 0.05)
			tween.parallel().tween_property(_mesh_node, "position", compressed_pos, 0.05)

			# Bounce back and overshoot
			var bounce_scale := original_scale
			bounce_scale.y *= 1.4 # Stretch vertically
			var bounce_pos := original_pos
			bounce_pos += LaunchDirection * 0.3 # Jump out

			tween.tween_property(_mesh_node, "scale", bounce_scale, 0.1)
			tween.parallel().tween_property(_mesh_node, "position", bounce_pos, 0.1)

			# Settle back to original
			tween.tween_property(_mesh_node, "scale", original_scale, 0.15)
			tween.parallel().tween_property(_mesh_node, "position", original_pos, 0.15)

			tween.finished.connect(func() -> void: _is_animating = false)
