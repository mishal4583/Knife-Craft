"""Rebuild the festival art's asset list from the files that are really there.

Run from the repository root with:  py scripts/make-festival-manifest.py   (again after every Codex delivery)

Source and output: Festival competition assets/ (the developer's local art folder, gitignored)
  manifests/master_asset_manifest.json, manifests/<festival>_manifest.json, documentation/ASSET_CATALOG.md
It only reads the pictures: nothing is renamed, edited or deleted.
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "Festival competition assets"
SKIP = {"sprite_sheets", "previews", "reference", "manifests", "documentation"}
USE = {
    "background": "full-screen festival backdrop",
    "food": "finished dish or food state",
    "ingredients": "ingredient or burger layer",
    "equipment": "kitchen station",
    "cooking_equipment": "kitchen equipment (several have food painted in)",
    "trays": "filled tray the player taps",
    "trays_containers": "empty tray or container",
    "customers": "festival customer",
    "rival_chefs": "extra chef art (the game's 49 rival chefs are used for rivals)",
    "player_staff": "player-side staff",
    "ui_icons": "interface icon",
    "powerups": "power-up icon",
    "effects": "static effect",
    "environment_props": "decoration",
    "celebration": "result and reward art",
    "pointers_tutorial": "tutorial pointer",
    "decorations": "festival decoration",
    "event_ui": "festival interface art",
}


def entry(path: Path) -> dict:
    rel = path.relative_to(ROOT).as_posix()
    parts = rel.split("/")
    with Image.open(path) as image:
        width, height = image.size
        transparent = "A" in image.getbands() and image.getchannel("A").getextrema()[0] < 8
    return {
        "asset_id": path.stem,
        "filename": path.name,
        "category": parts[1],
        "festival": None if parts[0] == "00_shared" else parts[0],
        "shared": parts[0] == "00_shared",
        "relative_path": rel,
        "dimensions": {"width": width, "height": height},
        "transparent": transparent,
        "intended_use": USE.get(parts[1], parts[1]),
    }


def main() -> int:
    if not ROOT.is_dir():
        print(f"Missing source folder: {ROOT}", file=sys.stderr)
        return 1
    files = sorted(p for p in ROOT.rglob("*.png") if p.relative_to(ROOT).parts[0] not in SKIP)
    assets = [entry(p) for p in files]
    festivals = sorted(d.name for d in ROOT.iterdir() if d.is_dir() and d.name[:2].isdigit() and d.name != "00_shared")
    manifests = ROOT / "manifests"
    manifests.mkdir(exist_ok=True)
    for festival in festivals:
        own = [a for a in assets if a["festival"] == festival]
        (manifests / f"{festival}_manifest.json").write_text(json.dumps({"festival": festival, "assets": own}, indent=1), encoding="utf-8")
    (manifests / "master_asset_manifest.json").write_text(
        json.dumps(
            {
                "project": "KnifeCraft Festival Fast Food Competition",
                "built_by": "scripts/make-festival-manifest.py (from the files themselves)",
                "festivals": festivals,
                "count": len(assets),
                "assets": assets,
            },
            indent=1,
        ),
        encoding="utf-8",
    )
    shared = Counter(a["category"] for a in assets if a["shared"])
    per = {f: Counter(a["category"] for a in assets if a["festival"] == f) for f in festivals}
    lines = [
        "# Festival competition asset catalog",
        "",
        "Built from the files by `scripts/make-festival-manifest.py`; do not edit by hand. Full list: `manifests/master_asset_manifest.json`.",
        "26 dish files were renamed on 2026-11-27 so each name matches its picture: `manifests/rename_log.json`.",
        "Known gaps and defects: `docs/planning/FESTIVAL-COMPETITION-PHASE0-2026-11-27.md`.",
        "",
        f"**{len(assets)} pictures.**",
        "",
        "## Shared (`00_shared/`)",
        "",
        "| Folder | Pictures | Use |",
        "|---|---:|---|",
        *[f"| `{k}` | {n} | {USE.get(k, k)} |" for k, n in sorted(shared.items())],
        "",
        "## Festivals",
        "",
        "| Festival | Pictures | By folder |",
        "|---|---:|---|",
        *[f"| `{f}` | {sum(c.values())} | {', '.join(f'{k} {n}' for k, n in sorted(c.items()))} |" for f, c in per.items()],
        "",
    ]
    (ROOT / "documentation").mkdir(exist_ok=True)
    (ROOT / "documentation" / "ASSET_CATALOG.md").write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(assets)} pictures listed: {sum(shared.values())} shared, {len(assets) - sum(shared.values())} in {len(festivals)} festival folders")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
