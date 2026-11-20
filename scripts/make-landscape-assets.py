"""
Builds public/landscape-art/{games,kitchen,map,story,loading} from the Codex pictures (developer 2026-11-19/20: "integrate all the assets properly").

Source: D:\\WORKS\\GAMES\\Knife Craft\\Landscape Backdrops Assets\\LS-*.png (1920 x 1080, git-ignored; the prompts are in
docs/planning/LANDSCAPE-BACKDROPS-CODEX-PROMPTS-2026-11-19.md and LANDSCAPE-PART3-...). Output: 1440 x 810 webp, loaded only in a wide window.

Each picture is the portrait picture in the CENTRE (9:16: 608 px wide of 1920) with the same room painted to both sides. The two blends Codex made at the seams are
stretched sideways for about 30 px. How that is hidden depends on how the picture is used:
  * "stage"  (the mini-game rooms, the dishwashing sink, the loading screen): the game's own 9:16 stage sits over the centre. The centre column is dimmed to a
             dark well and the 80 px beside it ramp up to full brightness, so the seams and the smear sit in a soft shadow beside the stage.
  * "map"    (the restaurant maps, the Second Floor): the live map is drawn over the centre, so the copy of the map in the picture must not show round it: the centre
             is blurred and dimmed, with the same ramp.
  * "seam"   (OLD, no longer built: the Kitchen skins of the first Codex set, replaced 2026-11-20 by the true pictures below)
  * "plain"  (the story scenes): the seams are already clean; used as they are.

TRUE LANDSCAPE PICTURES (developer 2026-11-20, `docs/planning/LANDSCAPE-TRUE-PICTURES-CODEX-PROMPTS-2026-11-20.md`): `Landscape Backdrops Assets/true-landscape/TL-*.png`
(1920 x 1080, composed wide from scratch, no portrait picture inside) are used as they are, only resized and compressed, into public/landscape-art/true/
(kitchen-0N.webp, map-<stage>.webp, second-floor.webp). The Kitchen ones are 1600 x 900; the maps 1920 x 1080 (the player zooms them).

Run:  python scripts/make-landscape-assets.py   (needs Pillow and numpy)
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("LS_SRC", os.path.join(ROOT, "Landscape Backdrops Assets"))
OUT = os.path.join(ROOT, "public", "landscape-art")
W, H = 1440, 810
WELL = 0.36  # brightness at the seam and in the centre of a stage picture
RAMP = 80  # px (at 1440 wide) from full brightness down to WELL


def centre_of(cw_1920):
    cw = round(cw_1920 * 0.75)
    return (W - cw) // 2, cw


def well_mask(x0, cw, ramp=RAMP, low=WELL):
    xs = np.arange(W, dtype=np.float32)
    d = np.maximum(np.maximum(x0 - xs, xs - (x0 + cw - 1)), 0)  # distance outside the centre column
    t = np.clip(d / ramp, 0, 1)
    t = t * t * (3 - 2 * t)  # smoothstep
    return low + (1 - low) * t  # low inside, 1 far outside


def stage(im, cw_1920=608):
    x0, cw = centre_of(cw_1920)
    a = np.asarray(im, dtype=np.float32)
    a *= well_mask(x0, cw)[None, :, None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def mapify(im, cw_1920):
    x0, cw = centre_of(cw_1920)
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(26)), dtype=np.float32)
    a = np.asarray(im, dtype=np.float32)
    # 1 inside the centre column, fading out over 40 px: the blurred copy replaces the sharp map copy there
    m = well_mask(x0, cw, ramp=40, low=1.0)  # all ones: build the blur weight separately
    xs = np.arange(W, dtype=np.float32)
    d = np.maximum(np.maximum(x0 - xs, xs - (x0 + cw - 1)), 0)
    wblur = 1 - np.clip(d / 40, 0, 1)
    a = a * (1 - wblur[None, :, None]) + blur * wblur[None, :, None]
    a *= well_mask(x0, cw, low=0.42)[None, :, None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def seam(im, cw_1920=608):
    x0, cw = centre_of(cw_1920)
    a = np.asarray(im, dtype=np.float32)
    xs = np.arange(W, dtype=np.float32)
    dip = np.ones(W, dtype=np.float32)
    for c in (x0, x0 + cw):
        dip *= 1 - 0.24 * np.exp(-((xs - c) ** 2) / (2 * 22.0**2))
    a *= dip[None, :, None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


STAGES = ["humble", "growing", "established", "neighborhood-cafe", "flourishing-cafe", "grand"]
JOBS = []  # (source name, output path, kind, centre width at 1920)
for n in ["dessert-run", "unload-the-van", "car-park", "sauce-mix", "sauce-bottle", "fridge-check", "dishwashing", "delivery-inspection", "stockroom", "fridge-sort"]:
    JOBS.append((f"LS-{n}.png", f"games/{n}.webp", "stage", 608))
JOBS.append(("LS-loading-screen.png", "loading.webp", "stage", 608))
TRUE = []  # (source in true-landscape, output, size)
for i, s in enumerate(STAGES):
    TRUE.append((f"TL-kitchen-0{i + 1}-{s}.png", f"true/kitchen-0{i + 1}.webp", (1600, 900)))
    TRUE.append((f"TL-restaurant-0{i + 1}-{s}.png", f"true/map-{s}.webp", (1920, 1080)))
TRUE.append(("TL-second-floor.png", "true/second-floor.webp", (1920, 1080)))
for src, dst in [
    ("story-1-key", "scene1"),
    ("story-2-kitchen", "scene2"),
    ("story-3a-clean", "scene3A"),
    ("story-3b-repair", "scene3B"),
    ("story-3c-restore", "scene3C"),
    ("story-4-chef", "scene4"),
    ("story-5-first-order", "scene5"),
]:
    JOBS.append((f"LS-{src}.png", f"story/{dst}.webp", "plain", 608))

total = 0
for src, dst, kind, cw in JOBS:
    p = os.path.join(SRC, src)
    if not os.path.exists(p):
        sys.exit(f"missing {p}")
    im = Image.open(p).convert("RGB").resize((W, H), Image.LANCZOS)
    if kind == "stage":
        im = stage(im, cw)
    elif kind == "seam":
        im = seam(im, cw)
    elif kind == "map":
        im = mapify(im, cw)
    out = os.path.join(OUT, dst)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, "WEBP", quality=80, method=6)
    size = os.path.getsize(out)
    total += size
    print(f"{dst:40s} {kind:6s} {size // 1024:4d} KB")
for src, dst, size in TRUE:
    p = os.path.join(SRC, "true-landscape", src)
    if not os.path.exists(p):
        sys.exit(f"missing {p}")
    im = Image.open(p).convert("RGB").resize(size, Image.LANCZOS)
    out = os.path.join(OUT, dst)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, "WEBP", quality=80, method=6)
    kb = os.path.getsize(out)
    total += kb
    print(f"{dst:40s} true   {kb // 1024:4d} KB")
print(f"{len(JOBS) + len(TRUE)} pictures, {total // 1024} KB in all")
