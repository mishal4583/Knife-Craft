"""
Builds public/nav/<screen id>.webp and src/game/navArt.ts from the Codex rail icons (developer 2026-11-21: the Kitchen home concept's left rail).

Sources (git-ignored): Nav Icons Assets/kitchen.png, market.png, restaurant.png, each a 512 x 512 transparent picture
(the prompts: docs/planning/KITCHEN-HOME-CODEX-PROMPTS-2026-11-21.md). A file that is not there yet is skipped: that place keeps its painted emoji icon.

Each picture is trimmed to its solid shape, centred on a square canvas with a 4 % margin and resized to 160 px. The file is named by the game's screen id
(kitchen -> kitchen, market -> shop, restaurant -> restaurant-map), the name the rail reads through `src/game/navArt.ts`.

Output: public/nav/<id>.webp and src/game/navArt.ts (the set of ids that have a picture).
Env: NAV_SRC (source folder), NAV_OUT (picture folder), NAV_TS (the .ts file): for tests.
Run:  python scripts/make-nav-assets.py   (needs Pillow, numpy)
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get("NAV_SRC", os.path.join(ROOT, "Nav Icons Assets"))
OUT = os.environ.get("NAV_OUT", os.path.join(ROOT, "public", "nav"))
TS = os.environ.get("NAV_TS", os.path.join(ROOT, "src", "game", "navArt.ts"))
SIZE = 160
MARGIN = 0.04
FILES = {"kitchen": "kitchen", "market": "shop", "restaurant": "restaurant-map"}

os.makedirs(OUT, exist_ok=True)
problems = []
skipped = []
total_kb = 0
for name, screen_id in FILES.items():
    path = os.path.join(SRC, name + ".png")
    if not os.path.exists(path):
        skipped.append(name)
        continue
    im = Image.open(path).convert("RGBA")
    if im.size != (512, 512):
        problems.append(f"{name}.png: size {im.size}, expected (512, 512)")
    alpha = np.asarray(im)[..., 3]
    ys, xs = np.nonzero(alpha > 20)
    if len(xs) < 5000:
        problems.append(f"{name}.png: no picture found")
        continue
    if alpha[0, 0] > 8 or alpha[-1, -1] > 8:
        problems.append(f"{name}.png: the corners are not transparent")
    icon = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    side = int(max(icon.width, icon.height) * (1 + 2 * MARGIN))
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(icon, ((side - icon.width) // 2, (side - icon.height) // 2), icon)
    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    out = os.path.join(OUT, screen_id + ".webp")
    canvas.save(out, "WEBP", quality=90, method=6, alpha_quality=95)
    total_kb += os.path.getsize(out) / 1024

have = sorted(f[:-5] for f in os.listdir(OUT) if f.endswith(".webp"))
lines = [
    "/**",
    " * The painted pictures of the left rail's three places (`public/nav/<id>.webp`, Codex, developer 2026-11-21: a chef's hat for the Kitchen, a crate of vegetables for the Market, a laid table for the Restaurant),",
    " * or none while a place has none (the rail then shows its icon). Written by `scripts/make-nav-assets.py`. Do not edit by hand.",
    " */",
    "export const NAV_ART_IDS: ReadonlySet<string> = new Set<string>([",
]
lines += [f'  "{h}",' for h in have]
lines += [
    "]);",
    "",
    "export function navArtUrl(id: string): string | null {",
    "  if (!NAV_ART_IDS.has(id)) return null;",
    '  return `${import.meta.env?.BASE_URL ?? "/"}nav/${id}.webp`;',
    "}",
    "",
]
open(TS, "w", encoding="utf8", newline="").write("\n".join(lines))
print(f"{len(have)} rail pictures ({total_kb:.0f} KB cut now); not delivered yet: {', '.join(skipped) or 'none'}")
for p in problems:
    print("PROBLEM", p)
sys.exit(1 if problems else 0)
