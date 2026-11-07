"""
Builds Paige's art and the male cleaner's portraits from the generated source sheets (developer 2026-11-07: "integrate the assistant
properly" and "add the cleaner's assets").

Run:  python scripts/make-assistant-assets.py        (needs Pillow, numpy and scipy; use `python`, not the MSYS `python3`)
      python scripts/make-assistant-assets.py --preview   also writes a contact sheet to $TEMP (for looking at the cuts)

Input (LOCAL ONLY, gitignored: about 15 MB of PNG):
  Assistant Assets/M02-poses-1.png, M03-poses-2.png   3 x 2 half-body poses
  Assistant Assets/M04-bubbles.png                    3 x 2 bubble kit (the last cell holds two chevron buttons)
  Assistant Assets/M05-paige-portrait.png             waist-up portrait, opaque
  Assistant Assets/M06-avatars.png                    4 x 1 round faces
  Assistant Assets/M07-ui-kit.png                     4 x 3 UI pieces
  Cleaner Assets/F01-floor-cleaner-male.png, F02-floor-cleaner-male-mop.png   opaque portraits

Output (small WebP files, committed):
  public/business/assistant/pose-*.webp  12 poses on ONE canvas size, aligned on the hips so switching pose never makes her jump
  public/business/assistant/avatar-*.webp, bubble-*.webp, ribbon.webp, chevron-*.webp, ui-*.webp
  public/business/staff-portraits/assistant.webp          320 x 320 like the other staff portraits
  public/business/staff-portraits/floor-cleaner-male.webp (F01: the second Floor Cleaner)
  public/business/staff-portraits/cleaner-today.webp      (F02: the Cleaner for today)

The sheets are RGBA but the generator left a soft warm glow around everything (alpha 1-200) and a little colour noise in the empty
areas. Solid pieces: alpha below LO becomes 0, above HI becomes 255, in between it ramps (soft edges stay soft). The two glow rings
of the UI kit keep their translucent alpha (it IS the glow) and only lose the specks. Islands under 2 % of a cell's biggest blob go.
"""

import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_A = os.path.join(ROOT, "Assistant Assets")
SRC_C = os.path.join(ROOT, "Cleaner Assets")
OUT = os.path.join(ROOT, "public", "business", "assistant")
PORTRAITS = os.path.join(ROOT, "public", "business", "staff-portraits")

LO, HI = 200, 250  # solid pieces: the glow (alpha < LO) goes, the piece (alpha > HI) is fully opaque

POSE_SCALE = 0.52  # one scale for every pose, so she keeps her size from pose to pose

POSES_1 = ["wave", "explain", "point", "tip", "cheer", "thumbs"]
POSES_2 = ["oops", "surprised", "think", "sorry", "clap", "clipboard"]
AVATARS = ["kind", "laugh", "worried", "wink"]
BUBBLES = ["normal", "warning", "success", "thought", "ribbon"]
UI = ["help", "notebook", "notebook-open", "bulb", "ring-round", "ring-rect", "arrow-down", "arrow-curve", "sparkle", "pencil", "sticky", "check"]
GLOW_UI = {"ring-round", "ring-rect"}


def solid_alpha(a: np.ndarray, lo: int = LO, hi: int = HI) -> np.ndarray:
    out = (a.astype(np.float32) - lo) * 255.0 / max(1, hi - lo)
    return np.clip(out, 0, 255).astype(np.uint8)


def cut_cells(sheet: Image.Image, cols: int, rows: int, glow: bool = False, min_blob: int = 900) -> dict[int, np.ndarray]:
    """Every solid blob goes to the cell holding its centre; a cell is the union of its blobs (an arm that reaches into the next cell
    stays with its body). Returns a full-size RGBA array per cell: cleaned alpha, everything else transparent, RGB zeroed outside."""
    a = np.array(sheet.convert("RGBA"))
    cw, ch = a.shape[1] // cols, a.shape[0] // rows
    thr = 30 if glow else LO
    labels, n = ndimage.label(a[..., 3] > thr)
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    groups: dict[int, list[int]] = {}
    centres = ndimage.center_of_mass(a[..., 3] > thr, labels, range(1, n + 1))
    for i, (cy, cx) in enumerate(centres, start=1):
        if sizes[i - 1] < min_blob:
            continue
        cell = min(rows - 1, int(cy // ch)) * cols + min(cols - 1, int(cx // cw))
        groups.setdefault(cell, []).append(i)
    out: dict[int, np.ndarray] = {}
    for cell, ids in groups.items():
        biggest = max(sizes[i - 1] for i in ids)
        keep = [i for i in ids if sizes[i - 1] >= 0.02 * biggest]
        mask = np.isin(labels, keep)
        mask = ndimage.binary_dilation(mask, iterations=6)  # keep the soft edge
        b = a.copy()
        if glow:
            b[..., 3] = np.where(mask & (a[..., 3] > 30), a[..., 3], 0)
        else:
            b[..., 3] = np.where(mask, solid_alpha(a[..., 3]), 0)
        b[b[..., 3] == 0, :3] = 0
        out[cell] = b
    return out


def trim(arr: np.ndarray) -> Image.Image:
    img = Image.fromarray(arr, "RGBA")
    box = img.getbbox()
    return img.crop(box) if box else img


def scaled(img: Image.Image, s: float) -> Image.Image:
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def save(img: Image.Image, name: str, folder: str = OUT, quality: int = 84) -> int:
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, name + ".webp")
    img.save(path, "WEBP", quality=quality, method=6, alpha_quality=90)
    return os.path.getsize(path)


def build_poses(preview: list[Image.Image]) -> int:
    """Twelve poses on ONE canvas: every pose scaled the same, bottom-aligned, and shifted so the hips (the bottom rows of the cut) sit on
    the same x, so changing pose never makes her jump sideways."""
    arrays: list[tuple[str, np.ndarray]] = []
    for sheet_name, names in (("M02-poses-1.png", POSES_1), ("M03-poses-2.png", POSES_2)):
        cells = cut_cells(Image.open(os.path.join(SRC_A, sheet_name)), 3, 2)
        if len(cells) != 6:
            print("pose sheet", sheet_name, "has", len(cells), "cells, expected 6")
            return 1
        for i, name in enumerate(names):
            arrays.append((name, cells[i]))
    trimmed: list[tuple[str, Image.Image, float]] = []
    for name, arr in arrays:
        im = scaled(trim(arr), POSE_SCALE)
        a = np.array(im)[..., 3]
        band = a[max(0, im.height - 14) :, :]
        xs = np.nonzero(band > 128)[1]
        anchor = float(xs.mean()) if xs.size else im.width / 2
        trimmed.append((name, im, anchor))
    left = max(anchor for _, _, anchor in trimmed)
    right = max(im.width - anchor for _, im, anchor in trimmed)
    half = int(round(max(left, right))) + 2
    height = max(im.height for _, im, _ in trimmed)
    total = 0
    for name, im, anchor in trimmed:
        canvas = Image.new("RGBA", (half * 2, height), (0, 0, 0, 0))
        canvas.paste(im, (int(round(half - anchor)), height - im.height), im)
        total += save(canvas, f"pose-{name}")
        preview.append(canvas)
    print(f"12 poses on {half * 2} x {height}, {total / 1024:.0f} KB total")
    return 0


def build_avatars(preview: list[Image.Image]) -> int:
    cells = cut_cells(Image.open(os.path.join(SRC_A, "M06-avatars.png")), 4, 1)
    if len(cells) != 4:
        print("avatars: expected 4 cells, found", len(cells))
        return 1
    total = 0
    for i, name in enumerate(AVATARS):
        # The generator drew the cameos as ovals (about 1.4 : 1), not circles; they are kept as drawn (no stretching).
        im = trim(cells[i])
        im = scaled(im, 128 / im.width)
        total += save(im, f"avatar-{name}")
        preview.append(im)
    print(f"4 avatars, {total / 1024:.0f} KB total")
    return 0


def build_bubbles(preview: list[Image.Image]) -> int:
    sheet = Image.open(os.path.join(SRC_A, "M04-bubbles.png"))
    cells = cut_cells(sheet, 3, 2)
    if len(cells) != 6:
        print("bubbles: expected 6 cells, found", len(cells))
        return 1
    total = 0
    for i, name in enumerate(BUBBLES):
        im = trim(cells[i])
        s = 0.75 if name != "ribbon" else 0.6
        total += save(scaled(im, s), f"bubble-{name}" if name != "ribbon" else "ribbon", quality=86)
        preview.append(scaled(im, 0.4))
    # The last cell holds two chevron buttons: the big one on the left, the small one on the right.
    arr = cells[5]
    labels, n = ndimage.label(arr[..., 3] > LO)
    sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
    big = [i + 1 for i in np.argsort(sizes)[::-1][:2]]
    parts = []
    for lab in big:
        m = ndimage.binary_dilation(labels == lab, iterations=6)
        b = arr.copy()
        b[..., 3] = np.where(m, arr[..., 3], 0)
        parts.append((ndimage.center_of_mass(m)[1], trim(b)))
    parts.sort(key=lambda p: p[0])
    if len(parts) != 2:
        print("chevrons: expected 2 buttons")
        return 1
    for (_, im), name in zip(parts, ("chevron-large", "chevron-small")):
        s = 112 / max(im.size) if name == "chevron-large" else 72 / max(im.size)
        total += save(scaled(im, s), name)
        preview.append(scaled(im, s))
    print(f"bubble kit (5 + 2 chevrons), {total / 1024:.0f} KB total")
    return 0


def build_ui(preview: list[Image.Image]) -> int:
    sheet = Image.open(os.path.join(SRC_A, "M07-ui-kit.png"))
    solid = cut_cells(sheet, 4, 3)
    glow = cut_cells(sheet, 4, 3, glow=True, min_blob=2500)
    total = 0
    for i, name in enumerate(UI):
        arr = (glow if name in GLOW_UI else solid).get(i)
        if arr is None:
            print("ui kit: missing cell", i, name)
            return 1
        im = trim(arr)
        im = scaled(im, 128 / max(im.size) if max(im.size) > 128 else 1.0)
        total += save(im, f"ui-{name}")
        preview.append(im)
    print(f"12 ui pieces, {total / 1024:.0f} KB total")
    return 0


def square_portrait(path: str, name: str) -> int:
    im = Image.open(path).convert("RGB")
    side = min(im.size)
    left, top = (im.width - side) // 2, (im.height - side) // 2
    im = im.crop((left, top, left + side, top + side)).resize((320, 320), Image.LANCZOS)
    size = save(im, name, PORTRAITS, quality=82)
    print(f"{name}.webp {size / 1024:.1f} KB")
    return 0


def main() -> int:
    preview: list[Image.Image] = []
    todo = [
        ("poses", lambda: build_poses(preview)),
        ("avatars", lambda: build_avatars(preview)),
        ("bubbles", lambda: build_bubbles(preview)),
        ("ui", lambda: build_ui(preview)),
    ]
    needed = [
        os.path.join(SRC_A, f)
        for f in ("M02-poses-1.png", "M03-poses-2.png", "M04-bubbles.png", "M05-paige-portrait.png", "M06-avatars.png", "M07-ui-kit.png")
    ] + [os.path.join(SRC_C, f) for f in ("F01-floor-cleaner-male.png", "F02-floor-cleaner-male-mop.png")]
    missing = [p for p in needed if not os.path.exists(p)]
    if missing:
        print("missing source art (it is local-only, gitignored):", missing)
        return 1
    for _, run in todo:
        if run() != 0:
            return 1
    if square_portrait(os.path.join(SRC_A, "M05-paige-portrait.png"), "assistant") != 0:
        return 1
    if square_portrait(os.path.join(SRC_C, "F01-floor-cleaner-male.png"), "floor-cleaner-male") != 0:
        return 1
    if square_portrait(os.path.join(SRC_C, "F02-floor-cleaner-male-mop.png"), "cleaner-today") != 0:
        return 1
    if "--preview" in sys.argv:
        w = 1800
        sheet = Image.new("RGB", (w, 1400), (245, 236, 215))
        x = y = row = 0
        for im in preview:
            if x + im.width > w:
                x, y, row = 0, y + row + 8, 0
            bg = Image.new("RGBA", im.size, (245, 236, 215, 255))
            bg.alpha_composite(im)
            sheet.paste(bg.convert("RGB"), (x, y))
            x += im.width + 8
            row = max(row, im.height)
        path = os.path.join(os.environ.get("TEMP", "."), "assistant_preview.png")
        sheet.save(path)
        print("preview:", path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
