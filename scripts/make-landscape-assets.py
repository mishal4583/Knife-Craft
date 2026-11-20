"""
Builds public/landscape-art/true/ from the TRUE landscape pictures Codex made (developer 2026-11-20: composed wide from scratch, no portrait picture inside).

Sources (git-ignored): Landscape Backdrops Assets/true-landscape/TL-*.png and part2/TL-*.png (1920 x 1080). The prompts: docs/planning/LANDSCAPE-TRUE-PICTURES-CODEX-PROMPTS-2026-11-20.md
(Kitchen, restaurant maps, Second Floor) and LANDSCAPE-PART2-REMAINING-PORTRAIT-AREAS-CODEX-PROMPTS-2026-11-20.md (mini-game rooms, dining rooms, intro story, loading
screen, film backgrounds). They are used as they are, only resized and compressed (webp), and loaded only in a wide window (a phone never downloads them).

Output (public/landscape-art/true/):
  kitchen-0N.webp           1600 x  900   Kitchen home + cutting scene, per kitchen skin
  map-<stage>.webp          1920 x 1080   restaurant floor plan, per stage
  second-floor.webp         1920 x 1080
  game-<id>.webp            1600 x  900   the ten mini-game rooms (the sink, Fridge Check, ...)
  dining-0N.webp            1920 x 1080   the dining room while a customer is served, per stage
  story-<scene>.webp        1600 x  900   the seven intro scenes
  loading.webp              1600 x  900   the loading screen's room
  clip-<film>.webp          1920 x 1080   one matching background for each cooking film (the film's frame sits in its middle)

Run:  python scripts/make-landscape-assets.py   (needs Pillow)
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("LS_SRC", os.path.join(ROOT, "Landscape Backdrops Assets", "true-landscape"))
OUT = os.path.join(ROOT, "public", "landscape-art", "true")

STAGES = ["humble", "growing", "established", "neighborhood-cafe", "flourishing-cafe", "grand"]
GAMES = [
    "dessert-run",
    "unload-the-van",
    "car-park",
    "sauce-station-mix",
    "sauce-station-bottle",
    "fridge-check",
    "dishwashing",
    "delivery-inspection",
    "stockroom",
    "fridge-sort",
]
STORY = [
    ("story-1-key", "scene1"),
    ("story-2-kitchen", "scene2"),
    ("story-3a-clean", "scene3A"),
    ("story-3b-repair", "scene3B"),
    ("story-3c-restore", "scene3C"),
    ("story-4-chef", "scene4"),
    ("story-5-first-order", "scene5"),
]
CLIPS = ["chef-cooking", "chef-salad", "chef-fruit", "chef-plating", "chef-curry", "chef-bread", "oven-bread"]

JOBS = []  # (source path, output name, size)
for i, s in enumerate(STAGES):
    JOBS.append((f"TL-kitchen-0{i + 1}-{s}.png", f"kitchen-0{i + 1}.webp", (1600, 900)))
    JOBS.append((f"TL-restaurant-0{i + 1}-{s}.png", f"map-{s}.webp", (1920, 1080)))
    JOBS.append((os.path.join("part2", f"TL-dining-0{i + 1}-{s}.png"), f"dining-0{i + 1}.webp", (1920, 1080)))
JOBS.append(("TL-second-floor.png", "second-floor.webp", (1920, 1080)))
for g in GAMES:
    JOBS.append((os.path.join("part2", f"TL-game-{g}.png"), f"game-{g}.webp", (1600, 900)))
for src, dst in STORY:
    JOBS.append((os.path.join("part2", f"TL-{src}.png"), f"story-{dst}.webp", (1600, 900)))
JOBS.append((os.path.join("part2", "TL-loading.png"), "loading.webp", (1600, 900)))
for c in CLIPS:
    JOBS.append((os.path.join("part2", f"TL-clip-{c}.png"), f"clip-{c}.webp", (1920, 1080)))

total = 0
for src, dst, size in JOBS:
    p = os.path.join(SRC, src)
    if not os.path.exists(p):
        sys.exit(f"missing {p}")
    im = Image.open(p).convert("RGB").resize(size, Image.LANCZOS)
    out = os.path.join(OUT, dst)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    # the restaurant maps and the Second Floor are smooth painted gradients (developer 2026-11-21, the smoothed Codex set): a higher quality keeps them free of blocks and banding
    q = 88 if dst.startswith("map-") or dst.startswith("second-floor") else 80
    im.save(out, "WEBP", quality=q, method=6)
    kb = os.path.getsize(out)
    total += kb
    print(f"{dst:40s} {kb // 1024:4d} KB")
print(f"{len(JOBS)} pictures, {total // 1024} KB in all")
