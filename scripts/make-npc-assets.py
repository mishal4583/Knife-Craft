"""
Builds the restaurant's people from the generated sprite sheets (developer 2026-11-07: "the NPC assets are ready, start implementing it";
plan: docs/planning/NPC-REALISM-PLAN-2026-11-07.md, prompts: NPC-CODEX-PROMPTS-2026-11-07.md).

Run:  python scripts/make-npc-assets.py               (needs Pillow, numpy and scipy; use `python`, not the MSYS `python3`)
      python scripts/make-npc-assets.py --preview     also writes contact sheets to $TEMP (to look at the cuts)
      python scripts/make-npc-assets.py rosa server   only these ids
      python scripts/make-npc-assets.py --all         also the four specialists (not used on the map yet)

Input (LOCAL ONLY, gitignored): NPC Assets/<id>-a.png (1536 x 1024, 6 x 4 cells of 256), <id>-b.png (1536 x 512, 6 cells of 256 x 512),
<id>-bust.png (1536 x 1024, 3 x 2 cells of 512), props.png (6 x 4 cells of 256).

Output (small WebP files, committed), all lazy-loaded by the map:
  public/people/<id>/a.webp     960 x 640: 6 x 4 cells of 160 x 160, EVERY cell on one baseline (y = 148) and one scale, the torso on the
                                cell's centre line (so a walk cycle never jitters sideways).
                                Rows: 1 front walk x4, idle, seated | 2 back, the same | 3 side facing RIGHT, the same | 4 guests: menu, raise
                                hand, eating, drinking, delighted, annoyed (staff and the floor crew: carry-walk side x4, idle carrying front, side).
  public/people/<id>/b.webp     960 x 160: six work poses (first-floor staff), the same scale and baseline as a.webp.
  public/people/<id>/bust.webp  576 x 384: 3 x 2 busts of 192 (neutral, pleased, delighted, impatient, annoyed, enjoying).
  public/people/props.webp      768 x 512: 6 x 4 icons of 128 (only with --props: no screen draws them yet).

The sheets are RGBA but the generator left a soft glow around everything and, on a few sheets, a haze over the whole sheet. Solid pieces:
alpha below LO becomes 0, above HI 255, in between a ramp (a hazy sheet, with more than 40 % of its pixels in the glow range, uses
a higher LO). Every solid blob goes to the cell holding its centre (an arm reaching into the next cell stays with its body); islands under 2 %
of the cell's biggest blob go. The generated characters are all about 244 px tall (the child too): the manifest's `scale` (peopleLooks.ts) is
applied on screen, not here.
"""

import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "NPC Assets")
OUT = os.path.join(ROOT, "public", "people")

CELL = 160  # output cell
BASE = 148  # feet on this row of every cell
CHAR_H = 128  # the idle front figure is this tall in the cell (about 244 px in the source)
SRC_H = 244.0  # the generated figure's height in the source (the reference every sheet is scaled to)

# The specialists (spec-*) are not on the map yet and manager-b does not match manager-a (another outfit): built only with --all.
SPEC_IDS = "spec-asian spec-indian spec-mediterranean spec-mexican".split()
A_IDS = (
    "server cashier cleaner line-cook prep-cook head-chef manager spec-asian spec-indian spec-mediterranean spec-mexican "
    "mara tobias priya oscar lena diego yuki amir rosa felix sana noah "
    "office-f office-m student-f student-m tourist-f tourist-m sporty-m elder-f2 "
    "floor-server-1 floor-server-2 floor-server-3 floor-server-4 floor-cleaner-1 floor-cleaner-2 floor-cleaner-3 floor-cleaner-4 "
    "international-tourist-f international-tourist-m food-blogger-f food-blogger-m businessman affluent-diner-f family-mother family-father family-child"
).split()
B_IDS = "server cashier cleaner line-cook prep-cook head-chef".split()  # + SPEC_IDS with --all
GUEST_IDS = set(
    "mara tobias priya oscar lena diego yuki amir rosa felix sana noah office-f office-m student-f student-m tourist-f tourist-m sporty-m elder-f2 "
    "international-tourist-f international-tourist-m food-blogger-f food-blogger-m businessman affluent-diner-f family-mother family-father family-child".split()
)
BUST_IDS = "mara tobias priya oscar lena diego yuki amir rosa felix sana noah".split()


def solid_alpha(a: np.ndarray, lo: int, hi: int) -> np.ndarray:
    out = (a.astype(np.float32) - lo) * 255.0 / max(1, hi - lo)
    return np.clip(out, 0, 255).astype(np.uint8)


def thresholds(a: np.ndarray) -> tuple[int, int]:
    """Normal sheets: the glow is below alpha 200. One sheet (floor-server-1) has a haze up to 249 over everything: its figure is 250+."""
    if (a >= 250).mean() < 0.02 and ((a >= 200) & (a < 250)).mean() > 0.15:
        return (201, 235)  # family-mother: the whole figure is alpha 230-249 (no glow), figures touch across rows: cut by rectangles
    haze = ((a >= 200) & (a < 250)).mean()
    return (249, 250) if haze > 0.15 else (200, 250)


def cut_blobs(arr: np.ndarray, cols: int, rows: int, lo: int, hi: int, min_blob: int = 600) -> dict[int, np.ndarray]:
    """Every solid blob goes to the cell holding its centre; returns a full-size RGBA array per cell (cleaned, the rest transparent)."""
    a = arr
    cw, ch = a.shape[1] // cols, a.shape[0] // rows
    labels, n = ndimage.label(a[..., 3] >= lo)
    if n == 0:
        return {}
    idx = range(1, n + 1)
    sizes = ndimage.sum(np.ones_like(labels), labels, idx)
    centres = ndimage.center_of_mass(a[..., 3] >= lo, labels, idx)
    groups: dict[int, list[int]] = {}
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
        mask = ndimage.binary_dilation(mask, iterations=3)  # keep the soft edge
        b = a.copy()
        b[..., 3] = np.where(mask, solid_alpha(a[..., 3], lo, hi), 0)
        b[b[..., 3] == 0, :3] = 0
        out[cell] = b
    return out


def cut_rects(arr: np.ndarray, cols: int, rows: int, lo: int, hi: int, min_blob: int = 600) -> dict[int, np.ndarray]:
    """For a hazy sheet (its halo joins neighbours): every cell is cut as a rectangle; only its own blobs stay (islands under 2 % go)."""
    cw, ch = arr.shape[1] // cols, arr.shape[0] // rows
    out: dict[int, np.ndarray] = {}
    for r in range(rows):
        for c in range(cols):
            sub = arr[r * ch : (r + 1) * ch, c * cw : (c + 1) * cw]
            labels, n = ndimage.label(sub[..., 3] >= lo)
            if n == 0:
                continue
            sizes = ndimage.sum(np.ones_like(labels), labels, range(1, n + 1))
            keep = [i + 1 for i, z in enumerate(sizes) if z >= max(min_blob, 0.02 * sizes.max())]
            mask = ndimage.binary_dilation(np.isin(labels, keep), iterations=2)
            full = np.zeros_like(arr)
            b = sub.copy()
            b[..., 3] = np.where(mask, solid_alpha(sub[..., 3], lo, hi), 0)
            b[b[..., 3] == 0, :3] = 0
            full[r * ch : (r + 1) * ch, c * cw : (c + 1) * cw] = b
            out[r * cols + c] = full
    return out


def bbox(arr: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(arr[..., 3] > 40)
    if ys.size == 0:
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def torso_x(arr: np.ndarray, box: tuple[int, int, int, int]) -> float:
    """The x of the body's centre line: the weighted middle of the opaque pixels in the rows 20-55 % down the figure."""
    x0, y0, x1, y1 = box
    h = y1 - y0
    band = arr[y0 + int(h * 0.20) : y0 + int(h * 0.55), x0:x1, 3].astype(np.float32)
    w = band.sum(axis=0)
    if w.sum() <= 0:
        return (x0 + x1) / 2
    return x0 + float((w * np.arange(band.shape[1])).sum() / w.sum())


def place(arr: np.ndarray, scale: float, cell: int = CELL, base: int = BASE, top: int | None = None) -> tuple[Image.Image, int]:
    """One cell: scaled, torso on the centre line, feet on the baseline. Returns the cell and the number of clipped pixels."""
    box = bbox(arr)
    canvas = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
    if box is None:
        return canvas, 0
    ax = torso_x(arr, box)
    crop = Image.fromarray(arr[box[1] : box[3], box[0] : box[2]], "RGBA")
    w, h = max(1, round(crop.width * scale)), max(1, round(crop.height * scale))
    crop = crop.resize((w, h), Image.LANCZOS)
    left = int(round(cell / 2 - (ax - box[0]) * scale))
    top = (base - h) if top is None else top
    big = Image.new("RGBA", (cell + 2 * w, cell + 2 * h), (0, 0, 0, 0))
    big.paste(crop, (left + w, top + h), crop)
    cut = big.crop((w, h, w + cell, h + cell))
    lost = int((np.array(big)[..., 3] > 40).sum() - (np.array(cut)[..., 3] > 40).sum())
    return cut, lost


def save(img: Image.Image, path: str, quality: int = 74) -> int:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6, alpha_quality=88)
    return os.path.getsize(path)


def load(path: str) -> np.ndarray:
    return np.array(Image.open(path).convert("RGBA"))


def head_width(arr: np.ndarray, box: tuple[int, int, int, int], band: float) -> float:
    """Width of the opaque pixels in the first `band` source rows from the top of the figure (the head and hair)."""
    y0 = box[1]
    sub = arr[y0 : y0 + int(band), box[0] : box[2], 3] > 100
    cols = np.nonzero(sub.any(axis=0))[0]
    return float(cols.max() - cols.min() + 1) if cols.size else 1.0


SEATED = {5, 11, 17}  # the seated cell of each row; guests also have eating (20) and drinking (21), drawn seated too


def sheet_a(pid: str, preview: list) -> tuple[int, int, float]:  # (bytes, clipped pixels, scale)
    a = load(os.path.join(SRC, f"{pid}-a.png"))
    lo, hi = thresholds(a[..., 3])
    cells = cut_rects(a, 6, 4, lo, hi) if lo > 200 else cut_blobs(a, 6, 4, lo, hi)
    if len(cells) != 24:
        print(f"  !! {pid}-a: {len(cells)} cells found, expected 24")
    idle = cells.get(4)
    box = bbox(idle) if idle is not None else None
    height = (box[3] - box[1]) if box else SRC_H
    scale = CHAR_H / height  # every figure's idle front pose ends up CHAR_H tall; one scale for every cell of the sheet
    band = 0.14 * height
    guest = pid in GUEST_IDS
    seated_cells = set(SEATED) | ({20, 21} if guest else set())
    zoomable = set(seated_cells) | ({18, 19, 22, 23} if guest else set())
    sheet = Image.new("RGBA", (CELL * 6, CELL * 4), (0, 0, 0, 0))
    lost = 0
    ratios: dict[int, float] = {}
    for i in sorted(zoomable):
        # Several figures draw these poses as a half-body behind a table or counter, bigger than life: the HEAD tells the zoom.
        ref_cell = cells.get((i // 6) * 6 + 4 if i < 18 else 4)
        src = 18 if i == 19 else i  # a raised hand sticks out above the head: measure the menu pose instead
        ref_box = bbox(ref_cell) if ref_cell is not None else None
        cell_box = bbox(cells[src]) if src in cells else None
        if ref_box and cell_box:
            ratios[i] = head_width(ref_cell, ref_box, band) / head_width(cells[src], cell_box, band)
    for i in range(24):
        if i not in cells:
            continue
        s_i, top = scale, None
        r = ratios.get(i)
        if r is not None and r < 0.85:  # zoomed in: scale the head back and hang it from its own line
            s_i = scale * max(0.4, r)
            top = int(round(BASE - CHAR_H * (0.80 if i in seated_cells else 1.0)))
        img, l = place(cells[i], s_i, top=top)
        lost += l
        sheet.paste(img, ((i % 6) * CELL, (i // 6) * CELL))
    size = save(sheet, os.path.join(OUT, pid, "a.webp"))
    preview.append(sheet)
    return size, lost, scale


def sheet_b(pid: str, preview: list) -> tuple[int, int]:
    """Six work poses, 256 x 512 cells in the source; the same figure size as sheet A (the figure is drawn ~2x bigger there)."""
    b = load(os.path.join(SRC, f"{pid}-b.png"))
    lo, hi = thresholds(b[..., 3])
    cells = cut_blobs(b, 6, 1, lo, hi, min_blob=900)
    heights = []
    for i in range(6):
        if i in cells:
            box = bbox(cells[i])
            if box:
                heights.append(box[3] - box[1])
    ref = float(np.median(heights)) if heights else SRC_H * 2
    scale = CHAR_H / ref
    sheet = Image.new("RGBA", (CELL * 6, CELL), (0, 0, 0, 0))
    lost = 0
    for i in range(6):
        if i not in cells:
            continue
        img, l = place(cells[i], scale)
        lost += l
        sheet.paste(img, (i * CELL, 0))
    size = save(sheet, os.path.join(OUT, pid, "b.webp"))
    preview.append(sheet)
    return size, lost


def sheet_bust(pid: str, preview: list) -> int:
    a = load(os.path.join(SRC, f"{pid}-bust.png"))
    lo, hi = thresholds(a[..., 3])
    a[..., 3] = solid_alpha(a[..., 3], lo, hi)
    a[a[..., 3] == 0, :3] = 0
    img = Image.fromarray(a, "RGBA").resize((576, 384), Image.LANCZOS)
    preview.append(img)
    return save(img, os.path.join(OUT, pid, "bust.webp"), quality=78)


def sheet_props(preview: list) -> int:
    a = load(os.path.join(SRC, "props.png"))
    lo, hi = thresholds(a[..., 3])
    a[..., 3] = solid_alpha(a[..., 3], lo, hi)
    a[a[..., 3] == 0, :3] = 0
    img = Image.fromarray(a, "RGBA").resize((768, 512), Image.LANCZOS)
    preview.append(img)
    return save(img, os.path.join(OUT, "props.webp"), quality=80)


def main() -> int:
    args = [x for x in sys.argv[1:] if not x.startswith("--")]
    want_preview = "--preview" in sys.argv
    only = set(args)
    everything = "--all" in sys.argv
    total = 0
    preview: list = []
    clipped_report = []
    for pid in A_IDS:
        if only and pid not in only:
            continue
        if pid in SPEC_IDS and not everything and not only:
            continue
        size, lost, scale = sheet_a(pid, preview)
        total += size
        extra = ""
        if pid in B_IDS or (everything and pid in SPEC_IDS):
            bs, bl = sheet_b(pid, preview)
            total += bs
            lost += bl
            extra = f" + b {bs / 1024:.0f} KB"
        if pid in BUST_IDS:
            bu = sheet_bust(pid, preview)
            total += bu
            extra += f" + bust {bu / 1024:.0f} KB"
        print(f"{pid:24s} a {size / 1024:5.0f} KB{extra}   scale {scale:.3f}   clipped px {lost}")
        if lost > 400:
            clipped_report.append((pid, lost))
    if "--props" in sys.argv:
        total += sheet_props(preview)  # not used by the game yet: 100 KB for icons nothing draws
    print(f"total {total / 1024 / 1024:.2f} MB")
    if clipped_report:
        print("cells that lose pixels at the cell edge:", clipped_report)
    if want_preview:
        tmp = os.environ.get("TEMP", ".")
        for i, im in enumerate(preview[:12]):
            bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
            bg.alpha_composite(im)
            bg.convert("RGB").save(os.path.join(tmp, f"npc-preview-{i}.png"))
        print("previews in", tmp)
    return 0


if __name__ == "__main__":
    sys.exit(main())
