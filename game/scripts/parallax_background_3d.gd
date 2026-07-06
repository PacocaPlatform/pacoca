class_name ParallaxBackground3D
extends MeshInstance3D
## Camera-following painted backdrop with horizontal UV parallax. Replaces the
## legacy static BG_Mountains quad at runtime (see Main.setup_parallax_background):
## the quad stays glued to the camera while the art pans at ScrollFactor of the
## camera's speed, so the horizon drifts like a distant landscape instead of a
## single image stretched across the whole level.

# Fraction of the camera's horizontal motion applied to the art.
# Small values read as "far away".
@export var ScrollFactor := 0.05

# How much of the camera's vertical motion the backdrop follows. 1.0 would
# pin the horizon to the screen; slightly less gives a subtle vertical
# parallax when jumping or riding springs.
@export var VerticalFollow := 0.85

# Level theme; resolves to res://materials/bg_<theme>.tres.
@export var LevelTheme := "forest"

const PLANE_Z := -48.0
const QUAD_HEIGHT := 110.0
const HORIZON_LIFT := 14.0

var _camera: Camera3D
var _material: StandardMaterial3D
var _quad_width := 1.0
var _base_camera_y := 0.0
var _base_y := 0.0


func _ready() -> void:
	var path := "res://materials/bg_%s.tres" % LevelTheme
	if not ResourceLoader.exists(path):
		path = "res://materials/bg_forest.tres"
	# Local copy: uv1_offset animates every frame and must not leak into
	# the shared .tres (whose uv1_scale is tuned for legacy level quads).
	_material = (load(path) as StandardMaterial3D).duplicate()
	_material.uv1_scale = Vector3.ONE

	# The art tiles seamlessly on X; size the quad so one copy of the
	# texture keeps its aspect ratio and horizontal panning wraps.
	var tex := _material.albedo_texture
	var aspect := 3.6
	if tex != null and tex.get_height() > 0:
		aspect = tex.get_width() / float(tex.get_height())
	_quad_width = QUAD_HEIGHT * aspect

	var quad := QuadMesh.new()
	quad.size = Vector2(_quad_width, QUAD_HEIGHT)
	quad.material = _material
	mesh = quad
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	_camera = get_viewport().get_camera_3d()
	if _camera != null:
		_base_camera_y = _camera.global_position.y
	_base_y = _base_camera_y + HORIZON_LIFT
	_update_transform()


func _process(_delta: float) -> void:
	_update_transform()


func _update_transform() -> void:
	if _camera == null or _material == null:
		return

	var cam := _camera.global_position
	var y := _base_y + (cam.y - _base_camera_y) * VerticalFollow
	global_position = Vector3(cam.x, y, PLANE_Z)

	# Pan the art opposite to travel; wraps thanks to the seamless texture.
	var offset := _material.uv1_offset
	offset.x = cam.x * ScrollFactor / _quad_width
	_material.uv1_offset = offset
