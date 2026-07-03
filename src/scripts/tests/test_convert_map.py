"""Unit tests for the map converter (convert_map.py).

Run from the Godot project root (src/):

    python3 -m unittest discover -s scripts/tests
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from convert_map import parse_ascii_grid, generate_python_module  # noqa: E402


def parse(text: str) -> dict:
    return parse_ascii_grid(text.splitlines(keepends=True))


class TestPlatforms(unittest.TestCase):
    def test_merge_and_floating(self):
        data = parse(
            "level: 07\n"
            "\n"
            "[grid]\n"
            "###\n"
            "\n"
            "#####\n"
        )
        # One floating 3-cell platform (empty row below), one anchored ground run
        self.assertEqual(len(data["platforms"]), 2)
        ground = next(p for p in data["platforms"] if p["y"] == 0.0)
        floating = next(p for p in data["platforms"] if p["y"] > 0.0)
        self.assertEqual(ground["rock_height"], 4.0)
        self.assertEqual(ground["width"], 10.0)
        self.assertEqual(floating["rock_height"], 1.0)
        self.assertEqual(floating["width"], 6.0)
        self.assertEqual(floating["y"], 6.0)  # two rows up at ystep 3.0

    def test_wall_split_marks_interior_blocks_without_grass(self):
        data = parse(
            "[grid]\n"
            "  #\n"
            "  #\n"
            "#####\n"
        )
        # Ground splits around the covered column; stacked cells above are
        # interior (grass=False) except the topmost one.
        by_y = sorted(data["platforms"], key=lambda p: (p["y"], p["x"]))
        ground = [p for p in by_y if p["y"] == 0.0]
        self.assertEqual([p.get("grass", True) for p in ground], [True, False, True])
        middle = next(p for p in by_y if p["y"] == 3.0)
        top = next(p for p in by_y if p["y"] == 6.0)
        self.assertFalse(middle.get("grass", True))
        self.assertTrue(top.get("grass", True))


class TestRamps(unittest.TestCase):
    def test_horizontal_run_is_one_gentle_ramp(self):
        data = parse(
            "[grid]\n"
            "///\n"
            "#####\n"
        )
        self.assertEqual(len(data["ramps_up"]), 1)
        ramp = data["ramps_up"][0]
        self.assertEqual(ramp["width"], 6.0)
        self.assertEqual(ramp["height"], 3.0)  # rises exactly one row
        self.assertEqual(ramp["y"], 0.5)       # starts at the ground surface

    def test_diagonal_chain_is_one_steep_ramp(self):
        data = parse(
            "[grid]\n"
            "  /\n"
            " /\n"
            "/\n"
            "###\n"
        )
        self.assertEqual(len(data["ramps_up"]), 1)
        ramp = data["ramps_up"][0]
        self.assertEqual(ramp["width"], 6.0)
        self.assertEqual(ramp["height"], 9.0)  # rises one row per column

    def test_horizontal_ramp_down(self):
        data = parse(
            "[grid]\n"
            "\\\\\n"
            "#####\n"
        )
        self.assertEqual(len(data["ramps_down"]), 1)
        ramp = data["ramps_down"][0]
        self.assertEqual(ramp["width"], 4.0)
        self.assertEqual(ramp["height"], 3.0)

    def test_ystep_header_scales_ramps(self):
        data = parse(
            "ystep: 1.0\n"
            "\n"
            "[grid]\n"
            "///\n"
            "#####\n"
        )
        self.assertEqual(data["ramps_up"][0]["height"], 1.0)


class TestItemsAndHeader(unittest.TestCase):
    def test_items_anchor_to_row_below(self):
        data = parse(
            "level: 05\n"
            "name: Test\n"
            "theme: glacial\n"
            "\n"
            "[grid]\n"
            " o G\n"
            "P####\n"
            "#####\n"
        )
        self.assertEqual(data["level"], "05")
        self.assertEqual(data["theme"], "glacial")
        # Row 1 anchors: spawn at (0, 1.5); row 2 anchors: ring at y 4.2, goal 5.0
        self.assertEqual(data["spawn"], [0.0, 1.5])
        self.assertEqual(data["rings"], [[2.0, 4.2]])
        self.assertEqual(data["goals"], [[6.0, 5.0]])

    def test_theme_defaults_to_forest(self):
        data = parse("[grid]\n#\n")
        self.assertEqual(data["theme"], "forest")


class TestWarnings(unittest.TestCase):
    def test_missing_spawn_and_goal(self):
        data = parse("[grid]\n#####\n")
        joined = " ".join(data["warnings"])
        self.assertIn("'P'", joined)
        self.assertIn("'G'", joined)

    def test_object_on_bottom_row(self):
        data = parse(
            "[grid]\n"
            "P####\n"
            "o####\n"
        )
        self.assertTrue(any("bottom row" in w for w in data["warnings"]))

    def test_no_ground(self):
        data = parse("[grid]\no\n")
        self.assertTrue(any("no solid ground" in w for w in data["warnings"]))

    def test_complete_map_has_no_warnings(self):
        data = parse(
            "[grid]\n"
            "P   G\n"
            "#####\n"
        )
        self.assertEqual(data["warnings"], [])


class TestModuleGeneration(unittest.TestCase):
    def test_generated_module_carries_grass_flag_and_theme(self):
        data = parse(
            "theme: cidade\n"
            "\n"
            "[grid]\n"
            "#\n"
            "#\n"
        )
        code = generate_python_module(data, "test_map.txt")
        self.assertIn("grass=False", code)
        self.assertIn("cidade_top.tres", code)
        self.assertIn("cidade_rock.tres", code)


if __name__ == "__main__":
    unittest.main()
