class_name VirtualControls
extends Control

## On-screen touch controls for the web/mobile build.
##
## Feeds the game's existing input actions (move_left/move_right/move_down,
## jump, dash, pause), so player.gd and everything else need NO changes.
##
## Layout: a floating analog joystick on the left half (movement) and JUMP /
## DASH / PAUSE buttons on the right. Everything is drawn in code and scales
## with the viewport, so it works across phone sizes and orientations.
##
## Only shown on touchscreen devices (DisplayServer.is_touchscreen_available()).
## Set `force_visible` in the inspector to preview/test with a mouse on desktop.

@export var force_visible := false

# Movement tuning ------------------------------------------------------------
const JOY_DEADZONE := 0.2      # stick travel below this = no move (0..1)
const DOWN_THRESHOLD := 0.55   # pushing the stick down past this presses move_down

# A finger (or the emulated mouse, index -1) currently owning a control.
enum Role { NONE, JOY, JUMP, DASH, PAUSE }

var _fingers: Dictionary = {}  # touch index -> Role
var _joy_index := -999         # which finger drives the joystick (-999 = none)
var _joy_origin := Vector2.ZERO
var _joy_knob := Vector2.ZERO
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
	if event is InputEventScreenDrag:
		var d := event as InputEventScreenDrag
		if d.index == _joy_index:
			_update_joystick(d.position)
		return

	# Mouse emulation for desktop testing (force_visible). Finger index -1.
	if force_visible:
		if event is InputEventMouseButton:
			var mb := event as InputEventMouseButton
			if mb.button_index == MOUSE_BUTTON_LEFT:
				if mb.pressed:
					_press(-1, mb.position)
				else:
					_release(-1)
		elif event is InputEventMouseMotion:
			var mm := event as InputEventMouseMotion
			if _joy_index == -1 and (mm.button_mask & MOUSE_BUTTON_MASK_LEFT):
				_update_joystick(mm.position)


func _press(index: int, pos: Vector2) -> void:
	if _fingers.has(index):
		return
	var role := _hit_test(pos)
	if role == Role.NONE:
		return
	_fingers[index] = role
	match role:
		Role.JUMP:
			Input.action_press("jump")
		Role.DASH:
			Input.action_press("dash")
		Role.PAUSE:
			_fire_pause()
		Role.JOY:
			_joy_index = index
			_joy_origin = _clamp_joy_origin(pos)
			_joy_knob = _joy_origin
			queue_redraw()


func _release(index: int) -> void:
	if not _fingers.has(index):
		return
	var role: int = _fingers[index]
	_fingers.erase(index)
	match role:
		Role.JUMP:
			Input.action_release("jump")
		Role.DASH:
			Input.action_release("dash")
		Role.JOY:
			_joy_index = -999
			Input.action_release("move_left")
			Input.action_release("move_right")
			Input.action_release("move_down")
			queue_redraw()


func _hit_test(pos: Vector2) -> int:
	if _in_circle(pos, _jump_center(), _r_big()):
		return Role.JUMP
	if _in_circle(pos, _dash_center(), _r_small()):
		return Role.DASH
	if _in_circle(pos, _pause_center(), _r_pause() * 1.4):
		return Role.PAUSE
	if pos.x < size.x * 0.5:
		return Role.JOY
	return Role.NONE


func _update_joystick(pos: Vector2) -> void:
	var jr := _joy_radius()
	var off := pos - _joy_origin
	if off.length() > jr:
		off = off.normalized() * jr
	_joy_knob = _joy_origin + off

	var nx := off.x / jr
	var ny := off.y / jr  # down is +y in screen space

	if absf(nx) < JOY_DEADZONE:
		Input.action_release("move_left")
		Input.action_release("move_right")
	else:
		var strength := (absf(nx) - JOY_DEADZONE) / (1.0 - JOY_DEADZONE)
		if nx > 0.0:
			Input.action_release("move_left")
			Input.action_press("move_right", strength)
		else:
			Input.action_release("move_right")
			Input.action_press("move_left", strength)

	if ny > DOWN_THRESHOLD:
		Input.action_press("move_down")
	else:
		Input.action_release("move_down")

	queue_redraw()


func _fire_pause() -> void:
	# Route through the real input system so PauseMenu's handler runs unchanged.
	var ev := InputEventAction.new()
	ev.action = "pause"
	ev.pressed = true
	Input.parse_input_event(ev)


func _release_all() -> void:
	for action in ["move_left", "move_right", "move_down", "jump", "dash"]:
		Input.action_release(action)
	_fingers.clear()
	_joy_index = -999


# --- Geometry (recomputed from current size, so it stays responsive) --------

func _ui_scale() -> float:
	return clampf(size.y / 720.0, 0.75, 1.7)

func _margin() -> float: return 46.0 * _ui_scale()
func _gap() -> float: return 26.0 * _ui_scale()
func _r_big() -> float: return 72.0 * _ui_scale()
func _r_small() -> float: return 54.0 * _ui_scale()
func _r_pause() -> float: return 30.0 * _ui_scale()
func _joy_radius() -> float: return 96.0 * _ui_scale()

func _jump_center() -> Vector2:
	var r := _r_big()
	var m := _margin()
	return Vector2(size.x - m - r, size.y - m - r)

func _dash_center() -> Vector2:
	var jc := _jump_center()
	return Vector2(jc.x - _r_big() - _gap() - _r_small(), jc.y - _r_big() * 0.55)

func _pause_center() -> Vector2:
	var r := _r_pause()
	var m := _margin()
	return Vector2(size.x - m - r, m + r)

func _clamp_joy_origin(pos: Vector2) -> Vector2:
	var jr := _joy_radius() + 8.0
	return Vector2(
		clampf(pos.x, jr, size.x * 0.5),
		clampf(pos.y, jr, size.y - jr)
	)

func _in_circle(p: Vector2, center: Vector2, radius: float) -> bool:
	return p.distance_to(center) <= radius


# --- Drawing ---------------------------------------------------------------

const COL_FILL := Color(0.02, 0.05, 0.09, 0.4)
const COL_CYAN := Color(0.0, 0.831, 1.0, 0.85)
const COL_GREEN := Color(0.0, 1.0, 0.529, 0.9)
const COL_WHITE := Color(1.0, 1.0, 1.0, 0.7)

func _draw() -> void:
	if _is_blocked():
		return

	# Jump (cyan, up chevron)
	var jc := _jump_center()
	var rb := _r_big()
	_draw_button_bg(jc, rb, COL_CYAN)
	_draw_chevron_up(jc, rb, COL_CYAN.lightened(0.15))

	# Dash (green, double chevron right)
	var dc := _dash_center()
	var rs := _r_small()
	_draw_button_bg(dc, rs, COL_GREEN)
	_draw_chevron_right(dc, rs, COL_GREEN.lightened(0.15))

	# Pause (white, two bars)
	var pc := _pause_center()
	var rp := _r_pause()
	_draw_button_bg(pc, rp, COL_WHITE)
	_draw_pause_bars(pc, rp, COL_WHITE)

	# Joystick (only while a finger is on it)
	if _joy_index != -999:
		var jr := _joy_radius()
		draw_circle(_joy_origin, jr, Color(1, 1, 1, 0.06))
		draw_arc(_joy_origin, jr, 0.0, TAU, 48, Color(0, 0.831, 1, 0.5), 3.0, true)
		draw_circle(_joy_knob, jr * 0.42, Color(0, 0.831, 1, 0.55))
		draw_arc(_joy_knob, jr * 0.42, 0.0, TAU, 32, Color(1, 1, 1, 0.85), 3.0, true)


func _draw_button_bg(center: Vector2, r: float, ring: Color) -> void:
	draw_circle(center, r, COL_FILL)
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

func _draw_chevron_right(center: Vector2, r: float, col: Color) -> void:
	var w := r * 0.32
	var h := r * 0.42
	var tw := maxf(3.0, r * 0.1)
	for dx in [-r * 0.2, r * 0.2]:
		var c := center + Vector2(dx, 0)
		draw_polyline(PackedVector2Array([
			c + Vector2(-w, -h),
			c + Vector2(w, 0),
			c + Vector2(-w, h),
		]), col, tw, true)

func _draw_pause_bars(center: Vector2, r: float, col: Color) -> void:
	var bw := r * 0.22
	var bh := r * 0.7
	draw_rect(Rect2(center + Vector2(-r * 0.28 - bw * 0.5, -bh * 0.5), Vector2(bw, bh)), col)
	draw_rect(Rect2(center + Vector2(r * 0.28 - bw * 0.5, -bh * 0.5), Vector2(bw, bh)), col)
