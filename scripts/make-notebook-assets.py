"""Paige's notebook art: Codex's pictures (`Paige Notebook Assets/`, not in git) into public/business/notebook/ as small WebP.

Prompt: docs/planning/NOTEBOOK-CODEX-PROMPT-2026-11-28.md. Used by src/components/kc/assistant/notebookArt.ts, whose cap sizes are in the
pixels of the files written here (the script prints every size).

Changes made here, not asked of Codex:
- every picture is trimmed to its paint;
- row.png has an ornament in its middle (it would smear when the row stretches), a strap and a bookmark where the checkbox and the arrow
  stand, and a leather rim; the mock-up's slips are soft plain cream, so the slip is rebuilt from the same picture and only its cream
  face is kept;
- ring.png is mirrored: the gold loop hangs outside the page and its hole sits on the page, as in the mock-up;
- chef_hat.png and banner_plain.png are not used (title_banner.png carries its own hat).

Run: python scripts/make-notebook-assets.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Paige Notebook Assets"
OUT = ROOT / "public" / "business" / "notebook"


def load(name):
    return Image.open(SRC / f"{name}.png").convert("RGBA")


def trim(im):
    """To the paint: anything fainter than a whisper of shadow is empty."""
    return im.crop(im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox())


def save(im, name, scale=1.0):
    if scale != 1.0:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    path = OUT / f"{name}.webp"
    im.save(path, "WEBP", quality=88, method=6)
    print(f"{name:14s} {im.width:4d} x {im.height:<4d} {path.stat().st_size:7d} bytes")
    return path.stat().st_size


def bridge(im, x0, x1, top, bottom):
    """Paint over what hangs on an end of the slip between rows `top` and `bottom`: each column runs from the clean row above to the clean
    row below (that stretch of the slip's edge is nearly straight)."""
    px = im.load()
    for x in range(x0, x1):
        a, b = px[x, top], px[x, bottom]
        for y in range(top + 1, bottom):
            t = (y - top) / (bottom - top)
            px[x, y] = tuple(round(a[i] * (1 - t) + b[i] * t) for i in range(4))


def plain_row():
    im = load("row")
    bridge(im, 0, 130, 43, 73)  # the olive strap on the left end
    bridge(im, 826, 900, 44, 72)  # the orange bookmark on the right end
    left = im.crop((0, 0, 170, im.height))
    right = im.crop((730, 0, im.width, im.height))
    # the middle runs smoothly from the last column of the left end to the first of the right one: no ornament and no step in the tone
    ends = Image.new("RGBA", (2, im.height))
    ends.paste(im.crop((169, 0, 170, im.height)), (0, 0))
    ends.paste(im.crop((730, 0, 731, im.height)), (1, 0))
    middle = ends.resize((220, im.height), Image.BILINEAR, box=(0.5, 0, 1.5, im.height))
    out = Image.new("RGBA", (left.width + middle.width + right.width, im.height))
    out.paste(left, (0, 0))
    out.paste(middle, (left.width, 0))
    out.paste(right, (left.width + middle.width, 0))
    return cream_face(trim(out))


def cream_face(im, side=21, rim=7, radius=17):
    """Only the slip's cream face, with its own soft lit edge: cut inside the leather rim, with smooth round corners."""
    face = im.crop((side, rim, im.width - side, im.height - rim))
    big = Image.new("L", (face.width * 4, face.height * 4), 0)
    ImageDraw.Draw(big).rounded_rectangle((0, 0, big.width - 1, big.height - 1), radius * 4, fill=255)
    face.putalpha(ImageChops.multiply(face.getchannel("A"), big.resize(face.size, Image.LANCZOS)))
    return face


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    total = 0
    total += save(trim(load("page_upright")), "page-upright", 0.6)
    total += save(trim(load("page_wide")), "page-wide", 0.6)
    total += save(trim(load("title_banner")), "title-banner", 0.62)
    total += save(trim(load("close_x")), "close-x", 0.85)
    total += save(trim(load("ribbon_done")), "ribbon-done")
    total += save(trim(load("ribbon_todo")), "ribbon-todo")
    total += save(trim(load("panel_done")), "panel-done", 0.7)
    total += save(trim(load("panel_todo")), "panel-todo", 0.7)
    total += save(plain_row(), "row")
    total += save(trim(load("box_empty")), "box-empty")
    total += save(trim(load("box_ticked")), "box-ticked")
    total += save(trim(load("arrow")), "arrow")
    total += save(trim(load("tips_pill")), "tips-pill", 0.7)
    # the two switches keep their shared canvas, so the knob does not jump
    total += save(load("switch_on"), "switch-on", 0.8)
    total += save(load("switch_off"), "switch-off", 0.8)
    total += save(trim(load("button_close")), "button-close", 0.8)
    total += save(trim(load("ring").transpose(Image.FLIP_LEFT_RIGHT)), "ring")
    total += save(trim(load("sparks_left")), "sparks-left")
    total += save(trim(load("sparks_right")), "sparks-right")
    print(f"total {total / 1024:.0f} KB")


if __name__ == "__main__":
    main()
