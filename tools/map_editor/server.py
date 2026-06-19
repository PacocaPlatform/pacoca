#!/usr/bin/env python3
"""Local dev server for the Paçoca Map Editor.

Serves the static visual editor AND exposes a small build endpoint so the
"Compile now" button can run the level pipeline directly:

    POST /api/compile  { "level": "04", "format": "txt"|"json", "content": "<map>" }

It writes the map into ``src/scripts/levels/level_<id>_map.<ext>`` and runs
``convert_map.py``, which generates the ``.tscn`` ready to open in Godot.

The build scripts (``convert_map.py`` / ``generate_level.py``) stay in
``src/scripts/`` so their ``__file__``-relative output paths keep working; this
server just orchestrates them.

Usage::

    python tools/map_editor/server.py        # then open http://localhost:8000
    PORT=9000 python tools/map_editor/server.py
"""
from __future__ import annotations

import http.server
import json
import os
import subprocess
import sys
import urllib.parse

# --------------------------------------------------------------------------- #
# Project layout
# --------------------------------------------------------------------------- #
EDITOR_DIR = os.path.dirname(os.path.abspath(__file__))           # tools/map_editor
REPO_ROOT = os.path.normpath(os.path.join(EDITOR_DIR, "..", ".."))  # repo root
GODOT_ROOT = os.path.join(REPO_ROOT, "src")                        # res:// root
SCRIPTS_DIR = os.path.join(GODOT_ROOT, "scripts")
CONVERTER = os.path.join(SCRIPTS_DIR, "convert_map.py")
# The editor owns its source maps (.txt/.json) under tools/map_editor/levels/.
# Compiling reads from here and writes the generated .py/.tscn into the Godot
# project (convert_map.py resolves those output paths from its own location).
MAPS_DIR = os.path.join(EDITOR_DIR, "levels")

# Godot binary used by the "Test Level" / "Run" buttons.
# Resolved at request time (see resolve_godot) so changes apply without a restart.
CONFIG_PATH = os.path.join(EDITOR_DIR, "editor_config.json")
DEFAULT_GODOT = r"D:\dev\Godot_v4.6.3-stable_mono_win64\Godot_v4.6.3-stable_mono_win64.exe"
# Candidate executable names to probe on the system PATH.
GODOT_PATH_NAMES = [
    "godot", "godot4", "Godot", "godot-mono", "Godot_mono",
    "Godot_console", "godot4-mono",
    "Godot_v4.6.3-stable_mono_win64",
]


def load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f) or {}
    except (OSError, ValueError):
        return {}


def save_config(cfg: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def detect_godot_on_path() -> str | None:
    import shutil
    for name in GODOT_PATH_NAMES:
        found = shutil.which(name)
        if found:
            return found
    return None


def resolve_godot() -> tuple[str, str]:
    """Return (path, source) where source is saved|env|path|default."""
    saved = (load_config().get("godot_bin") or "").strip()
    if saved:
        return saved, "saved"
    env = (os.environ.get("GODOT_BIN") or "").strip()
    if env:
        return env, "env"
    on_path = detect_godot_on_path()
    if on_path:
        return on_path, "path"
    return DEFAULT_GODOT, "default"


# --------------------------------------------------------------------------- #
# Saved maps (persistence)
# --------------------------------------------------------------------------- #
def sanitize_level(level: str) -> str:
    lvl = "".join(ch for ch in str(level or "") if ch.isalnum())
    if not lvl:
        return ""
    return lvl.zfill(2) if len(lvl) < 2 else lvl


def resolve_map_path(level: str, fmt: str, *, for_save: bool):
    """Return the path for a level's map file.

    On save, always uses the canonical ``level_<id>_map.<ext>``. On read/delete,
    also accepts the legacy ``level_<id>.<ext>`` name; returns None if missing.
    """
    ext = "json" if fmt == "json" else "txt"
    candidates = [f"level_{level}_map.{ext}"]
    if not for_save:
        candidates.append(f"level_{level}.{ext}")
    if for_save:
        return os.path.join(MAPS_DIR, candidates[0])
    for name in candidates:
        path = os.path.join(MAPS_DIR, name)
        if os.path.isfile(path):
            return path
    return None


def parse_map_meta(path: str, filename: str) -> dict:
    fmt = "json" if filename.endswith(".json") else "txt"
    base = filename.rsplit(".", 1)[0]
    if base.endswith("_map"):
        base = base[:-4]
    level = base[len("level_"):] if base.startswith("level_") else base
    name = ""
    try:
        if fmt == "json":
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            name = str(data.get("name", "") or "")
            level = str(data.get("level", level) or level)
        else:
            with open(path, "r", encoding="utf-8") as f:
                for _ in range(15):
                    line = f.readline()
                    if not line or line.strip() == "[grid]":
                        break
                    if ":" in line:
                        key, val = line.split(":", 1)
                        key = key.strip().lower()
                        if key == "name":
                            name = val.strip()
                        elif key == "level":
                            level = val.strip()
    except (OSError, ValueError):
        pass
    return {"level": level, "name": name, "format": fmt, "file": filename}


def list_map_files() -> list:
    out = []
    if not os.path.isdir(MAPS_DIR):
        return out
    for fn in os.listdir(MAPS_DIR):
        if not fn.startswith("level_") or not (fn.endswith(".txt") or fn.endswith(".json")):
            continue
        path = os.path.join(MAPS_DIR, fn)
        if not os.path.isfile(path):
            continue
        meta = parse_map_meta(path, fn)
        meta["mtime"] = os.path.getmtime(path)
        out.append(meta)
    out.sort(key=lambda m: m["mtime"], reverse=True)
    return out


class Handler(http.server.SimpleHTTPRequestHandler):
    """Static file server for the editor + JSON API (compile / run / config / maps)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=EDITOR_DIR, **kwargs)

    # -- routing ------------------------------------------------------------ #
    def do_GET(self):
        route = self.path.split("?", 1)[0]
        if route == "/api/config":
            self._handle_get_config()
        elif route == "/api/maps":
            self._handle_list_maps()
        elif route == "/api/maps/item":
            self._handle_get_map()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/compile":
            self._handle_compile()
        elif self.path == "/api/run":
            self._handle_run()
        elif self.path == "/api/config":
            self._handle_set_config()
        elif self.path == "/api/maps":
            self._handle_save_map()
        elif self.path == "/api/maps/delete":
            self._handle_delete_map()
        else:
            self._json(404, {"ok": False, "error": "route not found"})

    # -- saved maps endpoints ----------------------------------------------- #
    def _read_json_body(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        return json.loads(self.rfile.read(length) or b"{}")

    def _handle_list_maps(self):
        self._json(200, {"ok": True, "maps": list_map_files()})

    def _handle_get_map(self):
        qs = urllib.parse.parse_qs(self.path.split("?", 1)[1] if "?" in self.path else "")
        level = sanitize_level(qs.get("level", [""])[0])
        fmt = qs.get("format", ["txt"])[0]
        if not level:
            self._json(400, {"ok": False, "error": "invalid level"})
            return
        path = resolve_map_path(level, fmt, for_save=False)
        if not path:
            self._json(404, {"ok": False, "error": "map not found"})
            return
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()
        self._json(200, {
            "ok": True,
            "level": level,
            "format": "json" if path.endswith(".json") else "txt",
            "file": os.path.basename(path),
            "content": content,
        })

    def _handle_save_map(self):
        try:
            payload = self._read_json_body()
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "invalid JSON body"})
            return

        level = sanitize_level(payload.get("level", ""))
        fmt = payload.get("format", "txt")
        content = payload.get("content", "")
        if not level:
            self._json(400, {"ok": False, "error": "invalid level ID"})
            return
        if not str(content).strip():
            self._json(400, {"ok": False, "error": "empty map"})
            return

        os.makedirs(MAPS_DIR, exist_ok=True)
        path = resolve_map_path(level, fmt, for_save=True)
        try:
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(content)
        except OSError as exc:
            self._json(500, {"ok": False, "error": f"could not save: {exc}"})
            return

        self._json(200, {
            "ok": True,
            "level": level,
            "format": "json" if fmt == "json" else "txt",
            "file": os.path.basename(path),
        })

    def _handle_delete_map(self):
        try:
            payload = self._read_json_body()
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "invalid JSON body"})
            return

        level = sanitize_level(payload.get("level", ""))
        fmt = payload.get("format", "txt")
        if not level:
            self._json(400, {"ok": False, "error": "invalid level"})
            return
        path = resolve_map_path(level, fmt, for_save=False)
        if not path:
            self._json(404, {"ok": False, "error": "map not found"})
            return
        try:
            os.remove(path)
        except OSError as exc:
            self._json(500, {"ok": False, "error": f"could not delete: {exc}"})
            return
        self._json(200, {"ok": True, "level": level})

    # -- config endpoints --------------------------------------------------- #
    def _config_payload(self) -> dict:
        path, source = resolve_godot()
        return {
            "ok": True,
            "godot_bin": path,
            "exists": bool(path) and os.path.exists(path),
            "source": source,  # saved | env | path | default
        }

    def _handle_get_config(self):
        self._json(200, self._config_payload())

    def _handle_set_config(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}") if length else {}
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "invalid JSON body"})
            return

        cfg = load_config()
        # Empty/missing value clears the override and reverts to auto-detection.
        new_val = str(payload.get("godot_bin", "")).strip()
        if new_val:
            cfg["godot_bin"] = new_val
        else:
            cfg.pop("godot_bin", None)
        try:
            save_config(cfg)
        except OSError as exc:
            self._json(500, {"ok": False, "error": f"could not save: {exc}"})
            return

        self._json(200, self._config_payload())

    # -- run endpoint ------------------------------------------------------- #
    def _handle_run(self):
        # Optional body: { "level": "04" } -> launches straight into that level.
        level = None
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length:
                payload = json.loads(self.rfile.read(length) or b"{}")
                level = payload.get("level")
        except (ValueError, json.JSONDecodeError):
            level = None

        godot_bin, _source = resolve_godot()
        if not godot_bin or not os.path.exists(godot_bin):
            self._json(500, {
                "ok": False,
                "error": f"Godot not found at '{godot_bin}'. Configure the path in the editor (gear icon) or set GODOT_BIN.",
            })
            return

        build_warning = None
        if level:
            safe_level = "".join(ch for ch in str(level) if ch.isalnum())
            if not safe_level:
                self._json(400, {"ok": False, "error": "invalid level ID"})
                return
            if len(safe_level) < 2:
                safe_level = safe_level.zfill(2)

            # Best-effort C# refresh so the --level cmdline override is compiled in.
            # Never blocks the run: a stale-but-working assembly is fine.
            status, log = self._dotnet_build()
            if status == "fail":
                build_warning = "dotnet build failed (assembly may be locked by the editor); using existing build."
            elif status == "skip":
                build_warning = "dotnet not found: if the level does not open, compile C# once in the Godot editor."

            # Run main.tscn directly and pass the level as a user arg (after --).
            cmd = [godot_bin, "--path", GODOT_ROOT, "res://scenes/main.tscn", "--", f"--level={safe_level}"]
        else:
            # No level: run the project (no -e) -> plays the game's main scene (menu).
            cmd = [godot_bin, "--path", GODOT_ROOT]

        kwargs = {"cwd": REPO_ROOT}
        if os.name == "nt":
            # Detach so the game keeps running independently of this server.
            DETACHED_PROCESS = 0x00000008
            CREATE_NEW_PROCESS_GROUP = 0x00000200
            kwargs["creationflags"] = DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP
        try:
            subprocess.Popen(cmd, **kwargs)
        except Exception as exc:  # pragma: no cover - environment failure
            self._json(500, {"ok": False, "error": f"failed to launch Godot: {exc}"})
            return

        resp = {"ok": True, "godot": godot_bin, "path": GODOT_ROOT}
        if level:
            resp["level"] = safe_level
        if build_warning:
            resp["build_warning"] = build_warning
        self._json(200, resp)

    def _dotnet_build(self):
        """Incremental `dotnet build` of the Godot C# project. Best-effort.

        Returns one of: ("ok", log) | ("fail", log) | ("skip", "").
        """
        import shutil
        dotnet = shutil.which("dotnet")
        if not dotnet:
            return "skip", ""
        try:
            proc = subprocess.run([dotnet, "build"], cwd=GODOT_ROOT, capture_output=True, text=True)
        except Exception as exc:  # pragma: no cover - environment failure
            return "fail", str(exc)
        log = (proc.stdout or "") + "\n" + (proc.stderr or "")
        return ("ok" if proc.returncode == 0 else "fail"), log

    # -- build endpoint ----------------------------------------------------- #
    def _handle_compile(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"ok": False, "error": "invalid JSON body"})
            return

        level = str(payload.get("level", "")).strip()
        fmt = payload.get("format", "txt")
        content = payload.get("content", "")

        # Sanitize the level id so it can only ever be a filename-safe token.
        safe_level = "".join(ch for ch in level if ch.isalnum())
        if not safe_level:
            self._json(400, {"ok": False, "error": "invalid level ID"})
            return
        if len(safe_level) < 2:
            safe_level = safe_level.zfill(2)

        if not str(content).strip():
            self._json(400, {"ok": False, "error": "empty map"})
            return

        ext = "json" if fmt == "json" else "txt"
        map_name = f"level_{safe_level}_map.{ext}"
        map_path = os.path.join(MAPS_DIR, map_name)

        os.makedirs(MAPS_DIR, exist_ok=True)
        with open(map_path, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)

        if not os.path.exists(CONVERTER):
            self._json(500, {"ok": False, "error": f"converter not found at {CONVERTER}"})
            return

        cmd = [sys.executable, CONVERTER, "--input", map_path, "--level", safe_level]
        try:
            proc = subprocess.run(cmd, cwd=GODOT_ROOT, capture_output=True, text=True)
        except Exception as exc:  # pragma: no cover - environment failure
            self._json(500, {"ok": False, "error": f"failed to run converter: {exc}"})
            return

        scene_rel = f"src/scenes/levels/level_{safe_level}.tscn"
        map_rel = os.path.relpath(map_path, REPO_ROOT).replace("\\", "/")
        ok = proc.returncode == 0
        self._json(200 if ok else 500, {
            "ok": ok,
            "level": safe_level,
            "map_file": map_rel,
            "scene_file": scene_rel,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
        })

    # -- helpers ------------------------------------------------------------ #
    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # quieter, single-line logging
        sys.stderr.write("[map-editor] %s\n" % (fmt % args))


def main() -> int:
    port = int(os.environ.get("PORT", "8000"))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print("Paçoca Map Editor")
    print(f"  Editor:    http://127.0.0.1:{port}")
    print(f"  Serving:   {EDITOR_DIR}")
    print(f"  Compile to: {GODOT_ROOT}")
    godot_bin, godot_src = resolve_godot()
    godot_ok = "ok" if godot_bin and os.path.exists(godot_bin) else "NOT FOUND — configure in editor"
    print(f"  Godot:     {godot_bin} [{godot_src}] ({godot_ok})")
    print("  Ctrl+C to terminate.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nTerminating.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
