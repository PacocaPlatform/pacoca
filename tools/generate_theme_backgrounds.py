#!/usr/bin/env python3
"""Generates the per-theme parallax background images for the game.

Source art is ``src/images/backgrounds/forest-background.png``. This script
makes it tile seamlessly on the X axis (crossfading the right edge into the
left) and derives a recolored variant per level theme:

    bg_forest.png   - seamless original
    bg_glacial.png  - desaturated, cold blue-white
    bg_cidade.png   - hazy warm dusk
    bg_caverna.png  - dark, low-saturation blue

The game loads them through ``src/materials/bg_<theme>.tres`` (see
``ParallaxBackground3D.cs``). Re-run after changing the source art:

    python tools/generate_theme_backgrounds.py
"""
from __future__ import annotations

import os

from PIL import Image, ImageEnhance

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG_DIR = os.path.join(REPO_ROOT, "src", "images", "backgrounds")
SOURCE = os.path.join(BG_DIR, "forest-background.png")

# Width in pixels of the crossfade strip used to make the image tileable.
BLEND = 260


def make_seamless(img: Image.Image, blend: int = BLEND) -> Image.Image:
    """Crossfade the right edge into the left so the image tiles on X."""
    w, h = img.size
    strip = img.crop((w - blend, 0, w, h))
    base = img.crop((0, 0, w - blend, h))
    # Alpha ramps 255 -> 0 across the blend strip: at x=0 the pixel is fully
    # the (old) right edge, so column 0 continues from the new right edge.
    mask = Image.new("L", (blend, h))
    mask.putdata(
        [round(255 * (1.0 - x / blend)) for _y in range(h) for x in range(blend)]
    )
    left = base.crop((0, 0, blend, h))
    base.paste(Image.composite(strip, left, mask), (0, 0))
    return base


def tint(img: Image.Image, color: tuple[int, int, int], amount: float,
         saturation: float = 1.0, brightness: float = 1.0) -> Image.Image:
    """Desaturate/brighten, then blend toward a flat color."""
    out = ImageEnhance.Color(img).enhance(saturation)
    out = ImageEnhance.Brightness(out).enhance(brightness)
    overlay = Image.new("RGB", img.size, color)
    return Image.blend(out, overlay, amount)


def main() -> int:
    img = Image.open(SOURCE).convert("RGB")
    seamless = make_seamless(img)

    variants = {
        "bg_forest.png": seamless,
        "bg_glacial.png": tint(seamless, (196, 220, 240), 0.30,
                               saturation=0.45, brightness=1.06),
        "bg_cidade.png": tint(seamless, (226, 186, 148), 0.22,
                              saturation=0.70, brightness=0.97),
        "bg_caverna.png": tint(seamless, (36, 44, 66), 0.42,
                               saturation=0.55, brightness=0.62),
    }
    for name, out in variants.items():
        path = os.path.join(BG_DIR, name)
        out.save(path, optimize=True)
        print(f"wrote {path} ({out.size[0]}x{out.size[1]})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
