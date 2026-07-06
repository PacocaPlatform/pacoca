@tool
class_name SlantedPanel
extends PanelContainer

@export var BgColor := Color(0.04, 0.06, 0.10, 0.7)
@export var BorderColor := Color(0.0, 0.83, 1.0, 0.9)
@export var BorderWidth := 2.5
@export var SkewAmount := 15.0

@export var DrawTopBorderOnly := false
@export var DrawBottomBorderOnly := false


func _ready() -> void:
	resized.connect(queue_redraw)
	# Apply an empty stylebox to override the default panel theme stylebox
	add_theme_stylebox_override("panel", StyleBoxEmpty.new())


func _draw() -> void:
	if size.x <= 0 or size.y <= 0:
		return

	# Points for the parallelogram (slanted to the right at the top like / /)
	# Top-left: (SkewAmount, 0)
	# Top-right: (width, 0)
	# Bottom-right: (width - SkewAmount, height)
	# Bottom-left: (0, height)
	var points := PackedVector2Array([
		Vector2(SkewAmount, 0),
		Vector2(size.x, 0),
		Vector2(size.x - SkewAmount, size.y),
		Vector2(0, size.y),
	])

	# Draw shadow (shifted down and right)
	var shadow_offset := Vector2(4.0, 4.0)
	var shadow_points := PackedVector2Array([
		points[0] + shadow_offset,
		points[1] + shadow_offset,
		points[2] + shadow_offset,
		points[3] + shadow_offset,
	])
	draw_polygon(shadow_points, PackedColorArray([Color(0, 0, 0, 0.35)]))

	# Draw fill background
	draw_polygon(points, PackedColorArray([BgColor]))

	# Draw borders
	if DrawTopBorderOnly:
		draw_line(points[0], points[1], BorderColor, BorderWidth, true)
	elif DrawBottomBorderOnly:
		draw_line(points[3], points[2], BorderColor, BorderWidth, true)
	else:
		# Full outline loop
		var outline := PackedVector2Array([
			points[0], points[1], points[2], points[3], points[0],
		])

		# Glow effect: Draw thicker, semi-transparent line first
		var glow_color := Color(BorderColor.r, BorderColor.g, BorderColor.b, 0.25)
		draw_polyline(outline, glow_color, BorderWidth + 4.0, true)

		# Core border line
		draw_polyline(outline, BorderColor, BorderWidth, true)
