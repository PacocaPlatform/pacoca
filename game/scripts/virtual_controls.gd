class_name VirtualControls
extends Control

## On-screen touch controls for the web/mobile build.
##
## Feeds the game's existing input actions (move_left/move_right/move_down,
## jump, dash, pause), so player.gd and everything else need NO changes.
##
## Layout: a directional d-pad on the LEFT (LEFT / RIGHT side by side, DOWN
## centered below) and JUMP / PAUSE buttons on the RIGHT. Everything is drawn
## in code and scales with the viewport, so it works across phone sizes and
## orientations.
##
## We use discrete arrow BUTTONS (not a floating analog joystick) because touch
## drag events are unreliable across mobile browsers — plain press/release
## touches are rock-solid.
##
## Only shown on touchscreen devices (DisplayServer.is_touchscreen_available()).
## Set `force_visible` in the inspector to preview/test with a mouse on desktop.

@export var force_visible := false

# A finger (or the emulated mouse, index -1) currently owning a control.
enum Role { NONE, LEFT, RIGHT, DOWN, JUMP, PAUSE }

var _fingers: Dictionary = {}  # touch index -> Role
var _was_hidden := false

var _finish_screen: Control


func _ready() -> void:
	if not (force_visible or DisplayServer.is_touchscreen_available()):
		# Desktop / no touch: this build has nothing to do here.
		queue_free()
		return

	# Full-screen overlay; never eat mouse/UI focus (we listen via _input).
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

	# Keep receiving input while the tree is paused so we can detect the pause
	# and release any held actions; _input() itself bails out when paused.
	process_mode = Node.PROCESS_MODE_ALWAYS

	# Hide the controls while the level-finish overlay is up (sibling in HUDLayer).
	var parent := get_parent()
	if parent != null:
		_finish_screen = parent.get_node_or_null("LevelFinishScreen") as Control

	get_viewport().size_changed.connect(queue_redraw)


func _process(_delta: float) -> void:
	# When a blocking UI (pause/finish) appears, drop any held inputs and hide.
	var hidden := _is_blocked()
	if hidden and not _was_hidden:
		_release_all()
		queue_redraw()
	elif not hidden and _was_hidden:
		queue_redraw()
	_was_hidden = hidden


func _is_blocked() -> bool:
	if get_tree().paused:
		return true
	return _finish_screen != null and _finish_screen.visible


# --- Input -----------------------------------------------------------------

func _input(event: InputEvent) -> void:
	if _is_blocked():
		return

	# Touch
	if event is InputEventScreenTouch:
		var t := event as InputEventScreenTouch
		if t.pressed:
			_press(t.index, t.position)
		else:
			_release(t.index)
		return

	# Mouse emulation for desktop testing (force_visible). Finger index -1.
	if force_visible and event is InputEventMouseButton:
		var mb := event as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				_press(-1, mb.position)
			else:
				_release(-1)


func _press(index: int, pos: Vector2) -> void:
	if _fingers.has(index):
		return
	var role := _hit_test(pos)
	if role == Role.NONE:
		return
	_fingers[index] = role
	match role:
		Role.LEFT:
			Input.action_press("move_left")
		Role.RIGHT:
			Input.action_press("move_right")
		Role.DOWN:
			Input.action_press("move_down")
		Role.JUMP:
			Input.action_press("jump")
		Role.PAUSE:
			_fire_pause()
	queue_redraw()


func _release(index: int) -> void:
	if not _fingers.has(index):
		return
	var role: int = _fingers[index]
	_fingers.erase(index)
	match role:
		Role.LEFT:
			Input.action_release("move_left")
		Role.RIGHT:
			Input.action_release("move_right")
		Role.DOWN:
			Input.action_release("move_down")
		Role.JUMP:
			Input.action_release("jump")
	queue_redraw()


func _hit_test(pos: Vector2) -> int:
	# Right-side action buttons first (they sit on the right half).
	if _in_circle(pos, _jump_center(), _r_big()):
		return Role.JUMP
	if _in_circle(pos, _pause_center(), _r_pause() * 1.4):
		return Role.PAUSE
	# Left-side direction pad.
	if _in_circle(pos, _left_center(), _r_dir()):
		return Role.LEFT
	if _in_circle(pos, _right_center(), _r_dir()):
		return Role.RIGHT
	if _in_circle(pos, _down_center(), _r_dir_small()):
		return Role.DOWN
	return Role.NONE


func _fire_pause() -> void:
	# Route through the real input system so PauseMenu's handler runs unchanged.
	var ev := InputEventAction.new()
	ev.action = "pause"
	ev.pressed = true
	Input.parse_input_event(ev)


func _release_all() -> void:
	for action in ["move_left", "move_right", "move_down", "jump"]:
		Input.action_release(action)
	_fingers.clear()


# --- Geometry (recomputed from current size, so it stays responsive) --------

func _ui_scale() -> float:
	return clampf(size.y / 720.0, 0.75, 1.7)

func _margin() -> float: return 46.0 * _ui_scale()
func _gap() -> float: return 26.0 * _ui_scale()
func _r_big() -> float: return 72.0 * _ui_scale()
func _r_pause() -> float: return 30.0 * _ui_scale()
func _r_dir() -> float: return 62.0 * _ui_scale()
func _r_dir_small() -> float: return 50.0 * _ui_scale()

# Right side ---------------------------------------------------------------

func _jump_center() -> Vector2:
	var r := _r_big()
	var m := _margin()
	return Vector2(size.x - m - r, size.y - m - r)

func _pause_center() -> Vector2:
	var r := _r_pause()
	var m := _margin()
	return Vector2(size.x - m - r, m + r)

# Left side: d-pad — LEFT / RIGHT side by side, DOWN centered below them. ---

func _down_center() -> Vector2:
	var r := _r_dir_small()
	var m := _margin()
	var lc := _left_center()
	var rc := _right_center()
	return Vector2((lc.x + rc.x) * 0.5, size.y - m - r)

func _left_center() -> Vector2:
	var r := _r_dir()
	var m := _margin()
	# Sit above the DOWN button so the trio forms a d-pad cross.
	var y := size.y - m - _r_dir_small() * 2.0 - _gap() - r
	return Vector2(m + r, y)

func _right_center() -> Vector2:
	var lc := _left_center()
	return Vector2(lc.x + _r_dir() * 2.0 + _gap(), lc.y)


func _in_circle(p: Vector2, center: Vector2, radius: float) -> bool:
	return p.distance_to(center) <= radius


# --- Drawing ---------------------------------------------------------------

const COL_FILL := Color(0.02, 0.05, 0.09, 0.4)
const COL_FILL_ON := Color(0.0, 0.831, 1.0, 0.28)
const COL_CYAN := Color(0.0, 0.831, 1.0, 0.85)
const COL_WHITE := Color(1.0, 1.0, 1.0, 0.7)

func _draw() -> void:
	if _is_blocked():
		return

	# Direction pad (left): LEFT / RIGHT / DOWN arrows.
	var lc := _left_center()
	var rc := _right_center()
	var dc := _down_center()
	var rd := _r_dir()
	var rds := _r_dir_small()
	_draw_button_bg(lc, rd, COL_WHITE, _is_pressed(Role.LEFT))
	_draw_chevron_left(lc, rd, COL_WHITE.lightened(0.2))
	_draw_button_bg(rc, rd, COL_WHITE, _is_pressed(Role.RIGHT))
	_draw_chevron_right(rc, rd, COL_WHITE.lightened(0.2))
	_draw_button_bg(dc, rds, COL_WHITE, _is_pressed(Role.DOWN))
	_draw_chevron_down(dc, rds, COL_WHITE.lightened(0.2))

	# Jump (cyan, up chevron)
	var jc := _jump_center()
	var rb := _r_big()
	_draw_button_bg(jc, rb, COL_CYAN, _is_pressed(Role.JUMP))
	_draw_chevron_up(jc, rb, COL_CYAN.lightened(0.15))

	# Pause (white, two bars)
	var pc := _pause_center()
	var rp := _r_pause()
	_draw_button_bg(pc, rp, COL_WHITE, false)
	_draw_pause_bars(pc, rp, COL_WHITE)


func _is_pressed(role: int) -> bool:
	return _fingers.values().has(role)


func _draw_button_bg(center: Vector2, r: float, ring: Color, pressed: bool) -> void:
	draw_circle(center, r, COL_FILL_ON if pressed else COL_FILL)
	draw_arc(center, r, 0.0, TAU, 48, ring, maxf(2.5, r * 0.06), true)

func _draw_chevron_up(center: Vector2, r: float, col: Color) -> void:
	var w := r * 0.5
	var h := r * 0.42
	var pts := PackedVector2Array([
		center + Vector2(-w, h * 0.6),
		center + Vector2(0, -h),
		center + Vector2(w, h * 0.6),
	])
	draw_polyline(pts, col, maxf(3.0, r * 0.1), true)

func _draw_chevron_down(center: Vector2, r: float, col: Color) -> void:
	var w := r * 0.5
	var h := r * 0.42
	var pts := PackedVector2Array([
		center + Vector2(-w, -h * 0.6),
		center + Vector2(0, h),
		center + Vector2(w, -h * 0.6),
	])
	draw_polyline(pts, col, maxf(3.0, r * 0.1), true)

func _draw_chevron_left(center: Vector2, r: float, col: Color) -> void:
	var w := r * 0.42
	var h := r * 0.5
	var pts := PackedVector2Array([
		center + Vector2(w * 0.6, -h),
		center + Vector2(-w, 0),
		center + Vector2(w * 0.6, h),
	])
	draw_polyline(pts, col, maxf(3.0, r * 0.1), true)

func _draw_chevron_right(center: Vector2, r: float, col: Color) -> void:
	var w := r * 0.42
	var h := r * 0.5
	var pts := PackedVector2Array([
		center + Vector2(-w * 0.6, -h),
		center + Vector2(w, 0),
		center + Vector2(-w * 0.6, h),
	])
	draw_polyline(pts, col, maxf(3.0, r * 0.1), true)

func _draw_pause_bars(center: Vector2, r: float, col: Color) -> void:
	var bw := r * 0.22
	var bh := r * 0.7
	draw_rect(Rect2(center + Vector2(-r * 0.28 - bw * 0.5, -bh * 0.5), Vector2(bw, bh)), col)
	draw_rect(Rect2(center + Vector2(r * 0.28 - bw * 0.5, -bh * 0.5), Vector2(bw, bh)), col)
