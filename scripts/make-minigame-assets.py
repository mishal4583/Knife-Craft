"""
Builds the Mini-games screen's pictures into public/business/minigames/ as small WebP files.

    python scripts/make-minigame-assets.py

Sources, both in 'Mini-games Sheet Assets' (Codex art, never committed):
  - v2/ (developer 2026-11-28, the fair-stall screen; prompt docs/planning/MINIGAMES-SCREEN-CODEX-PROMPT-2026-11-28.md, painted after the
    developer's mock-up): the eight game pictures, cards, ribbons, pills, tabs, badges, header, awning, leaves and the Festival panel;
  - MG-*.png (2026-11-18): only the Kitchen button's controller is still used.
Sizes are about 2-3x the largest a phone shows them at. The stretchable pieces' slices live in src/components/kc/minigamesArt.ts;
scripts/mini-games-qa.mts checks that the two agree.

Some pieces are made here rather than copied:
  - the awning: Codex's tile has finished ends, so it cannot be repeated; two whole stripe pairs from its middle repeat without a seam;
  - the unselected tab and the resting pill: the purple tab and the brown pill with only their inside recoloured cream (Codex's cream tab came
    out grey with a rough inner edge, and the mock-up has no resting pill);
  - the Festival frame in three parts (top, one run of side bulbs, bottom), cut between bulbs, so its bulbs stay round at every panel height.
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Mini-games Sheet Assets"
V2 = SRC / "v2"
OUT = ROOT / "public" / "business" / "minigames"
OUT.mkdir(parents=True, exist_ok=True)

total = 0
made = []


def save(name, im, quality=82):
    global total
    path = OUT / (name + ".webp")
    im.save(path, "WEBP", quality=quality, method=6, alpha_quality=100)
    total += path.stat().st_size
    made.append(name)
    print(f"{name:22s} {im.size[0]:4d}x{im.size[1]:<4d} {path.stat().st_size / 1024:6.1f} KB")


def load(path):
    return Image.open(path).convert("RGBA")


def put(name, source, size=None, crop=None, quality=82):
    """Crop (left, top, right, bottom in source pixels), resize to `size` (w, h) or keep, save as WebP."""
    im = load(source)
    if crop:
        im = im.crop(crop)
    if size:
        im = im.resize(size, Image.LANCZOS)
    save(name, im, quality)


def cream_inside(source, inset, top, bottom):
    """The pill or bar with its coloured inside made cream: the capsule `inset` (left/right, top, bottom, in source pixels) inside the gold rim is
    repainted, a soft shade at its upper and lower edge; the rim stays as painted."""
    im = load(source)
    w, h = im.size
    side, upper, lower = inset
    over = 4
    box = (side * over, upper * over, (w - side) * over - 1, (h - lower) * over - 1)
    mask = Image.new("L", (w * over, h * over), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=(box[3] - box[1]) // 2, fill=255)
    mask = mask.resize((w, h), Image.LANCZOS)
    t = np.linspace(0, 1, h - upper - lower)[:, None]
    shade = np.clip(np.array(top) * (1 - t) + np.array(bottom) * t, 0, 255)
    # a thin shadow just under the rim, so the face sits inside it
    shade[:3] *= np.array([0.78, 0.86, 0.93])[:, None]
    shade[-2:] *= np.array([0.94, 0.88])[:, None]
    column = np.zeros((h, 3))
    column[upper : h - lower] = shade
    column[:upper] = shade[0]
    column[h - lower :] = shade[-1]
    paper = np.repeat(column[:, None, :], w, axis=1).round().astype("uint8")
    face = Image.fromarray(paper, "RGB").convert("RGBA")
    face.putalpha(im.getchannel("A"))
    return Image.composite(face, im, mask)


# the eight game pictures (named by the game's id)
for game in ("inspection", "fridge-sort", "sauce", "stockroom", "fridge-check", "car-park", "dessert-run"):
    put(f"icon-{game}", V2 / f"art_{game.replace('-', '_')}.png", (480, 315), quality=80)
# Unload the Van: the repaint (one van, nothing before its open doors); the first art_kitchen_dispatch.png stood a second car there
put("icon-kitchen-dispatch", V2 / "art_kitchen_dispatch_v2.png", (480, 315), quality=80)

# the cards: nine-slice
put("card-red", V2 / "card_red.png", (360, 346), crop=(20, 12, 620, 588))
put("card-purple", V2 / "card_purple.png", (360, 346), crop=(20, 12, 620, 588))

# name ribbon and pills: stretched between their ends (each cut to its painting, inside Codex's 12 px margin)
def painted(path):
    im = load(path)
    return (12, 12, im.width - 12, im.height - 12)


put("name-ribbon", V2 / "ribbon_name.png", (440, 90), crop=painted(V2 / "ribbon_name.png"))
put("pill-ready", V2 / "pill_green.png", (258, 50), crop=painted(V2 / "pill_green.png"))
put("pill-locked", V2 / "pill_brown.png", (258, 50), crop=painted(V2 / "pill_brown.png"))
resting = cream_inside(V2 / "pill_brown.png", (20, 20, 20), (255, 245, 219), (240, 214, 164))
save("pill-rest", resting.crop(painted(V2 / "pill_brown.png")).resize((258, 50), Image.LANCZOS))

# badges
put("lock-badge", V2 / "badge_lock.png", (120, 144), crop=(20, 12, 200, 228))
put("badge-ready", V2 / "badge_star.png", (120, 123), crop=(14, 12, 205, 208))

# header
put("title-plaque", V2 / "title_ribbon.png", (480, 151), crop=(72, 12, 888, 268))
put("close-button", V2 / "button_close.png", (144, 145), crop=(12, 12, 207, 208))
put("tab-on", V2 / "tab_purple.png", (450, 70), crop=painted(V2 / "tab_purple.png"))
unselected = cream_inside(V2 / "tab_purple.png", (32, 28, 28), (255, 246, 221), (238, 211, 160))
save("tab-off", unselected.crop(painted(V2 / "tab_purple.png")).resize((450, 70), Image.LANCZOS))
put("icon-gamepad", V2 / "icon_gamepad.png", (120, 80), crop=(12, 21, 188, 138))
# two red-and-cream pairs from the awning's middle (a pair is 87 px wide)
put("awning", V2 / "awning_tile.png", (116, 92), crop=(175, 0, 349, 138), quality=86)
put("leaves-corner", V2 / "leaves_corner.png", (220, 283), crop=(0, 0, 340, 437))

# the Festival panel
put("festival-scene-tall", V2 / "festival_scene_tall.png", (432, 792), quality=68)
put("festival-scene-wide", V2 / "festival_scene_wide.png", (864, 336), quality=70)
# cut between bulbs (their centres: 261, 325 ... 707, 771 ... 1092, 1155): the middle is three bulbs
put("festival-frame-top", V2 / "festival_frame.png", (360, 146), crop=(0, 0, 720, 292))
put("festival-frame-mid", V2 / "festival_frame.png", (360, 96), crop=(0, 739, 720, 931))
put("festival-frame-bottom", V2 / "festival_frame.png", (360, 99), crop=(0, 1122, 720, 1320))
put("festival-trophy", V2 / "festival_trophy.png", (240, 240))
put("festival-ribbon", V2 / "festival_ribbon.png", (480, 218), crop=painted(V2 / "festival_ribbon.png"))
put("button-green", V2 / "button_green.png", (320, 81), crop=painted(V2 / "button_green.png"))

# kept from the first set: the Kitchen's button
put("shortcut-icon", SRC / "MG-shortcut-icon.png", (192, 192))

# anything this script no longer makes is not shipped
for old in OUT.glob("*.webp"):
    if old.stem not in made:
        old.unlink()
        print(f"removed {old.name}")

print(f"total {total / 1024:.0f} KB in {len(made)} files")
