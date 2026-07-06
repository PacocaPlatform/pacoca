extends SceneTree
## Headless validation for RuntimeLevelBuilder: builds a fixture map and dumps
## the resulting node tree (name/type/transform/size) so it can be compared
## against the Python pipeline's level_XX.tscn output.
##
##   godot --headless --path src --script res://../tools/runtime_builder_test.gd

func _init() -> void:
	var map: Variant = JSON.parse_string(FileAccess.open(_fixture_path(), FileAccess.READ).get_as_text())
	if not map is Dictionary:
		push_error("fixture is not a JSON object")
		quit(1)
		return

	var builder: GDScript = load("res://src/runtime_level_builder.gd")
	var result: Dictionary = builder.build(map)
	print("OK=%s ERRORS=%s WARNINGS=%s" % [result["ok"], result["errors"], result["warnings"]])
	if not result["ok"]:
		quit(1)
		return

	print("---TREE---")
	_dump(result["root"], 0)
	print("---END---")
	quit(0)


func _fixture_path() -> String:
	# Passed as the last plain user arg, or defaults to the scratchpad fixture.
	for a in OS.get_cmdline_user_args():
		if a.ends_with(".json"):
			return a
	return "fixture.json"


func _dump(node: Node, depth: int) -> void:
	var indent := "  ".repeat(depth)
	var line := "%s%s [%s]" % [indent, node.name, node.get_class()]
	if node is Node3D:
		var t: Transform3D = node.transform
		line += " pos=(%.2f,%.2f,%.2f)" % [t.origin.x, t.origin.y, t.origin.z]
	if node is CSGBox3D:
		line += " size=(%.2f,%.2f,%.2f)" % [node.size.x, node.size.y, node.size.z]
	if node is CSGPolygon3D:
		line += " depth=%.2f poly=%s" % [node.depth, node.polygon]
	for prop in ["LaunchForce", "LaunchDirection", "ControlLockDuration", "Speed"]:
		var v: Variant = node.get(prop)
		if v != null:
			line += " %s=%s" % [prop, v]
	print(line)
	for child in node.get_children():
		_dump(child, depth + 1)
