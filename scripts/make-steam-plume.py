"""THE KITCHEN'S STEAM, SIMULATED (developer 2026-11-27, with a reference picture: soft billowing steam rising off the whole lid, "make it exactly
like this"). A small fluid simulation (stable fluids on a staggered grid: hot air rising off a lid-shaped source, swirls kept alive by vorticity
confinement and drifting curl noise) is run offline, its steam saved as a LOOPING film of soft, see-through frames in one picture:

    public/kitchen-fx/plume.webp   COLS x ROWS frames of FRAME_W x FRAME_H (drawn by components/kc/KitchenAmbient.tsx, transform/opacity only)

The loop is seamless (the last frames are cross-faded into the first ones). Seeded, so the same picture comes out every time.

    python scripts/make-steam-plume.py             writes the picture
    python scripts/make-steam-plume.py --preview D  also writes preview frames on a dark kitchen colour into folder D
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.fft import dctn, idctn
from scipy.ndimage import gaussian_filter, map_coordinates, zoom

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "kitchen-fx" / "plume.webp"

# the film (also in game/kitchen/kitchenAmbient.ts: STEAM_PLUME; kitchen-ambient-qa checks the two agree)
COLS, ROWS = 10, 6
FRAME_W, FRAME_H = 160, 260
# where the lid sits in a frame, as fractions: the middle of the lid's rim line, and the lid's width
RIM_X, RIM_Y, LID_W = 0.5, 0.91, 0.56
DOME = 0.07  # the lid's height above its rim line, in lid widths

# the simulation (the frame is cut out of a larger box, so its walls are never seen)
VW, VH = 128, 208  # the frame's velocity cells
PAD_X, PAD_TOP, PAD_BOT = 32, 48, 4
NX, NY = VW + 2 * PAD_X, VH + PAD_TOP + PAD_BOT
SS = 2  # the steam is carried on a grid this much finer than the air
DT = 1.0
WARM_UP = 340  # steps before the first frame
EVERY = 3  # steps between frames
BLEND = 18  # frames cross-faded to close the loop
SEED = 7

rng = np.random.default_rng(SEED)


def smooth_noise(shape, sigma) -> np.ndarray:
    n = gaussian_filter(rng.standard_normal(shape), sigma, mode="wrap")
    return n / (np.abs(n).max() + 1e-9)


class Drift:
    """Smooth noise that changes slowly: a new field every `period` steps, blended between."""

    def __init__(self, shape, sigma, period):
        self.shape, self.sigma, self.period = shape, sigma, period
        self.a, self.b = smooth_noise(shape, sigma), smooth_noise(shape, sigma)

    def at(self, step: int) -> np.ndarray:
        t = (step % self.period) / self.period
        if step % self.period == 0 and step:
            self.a, self.b = self.b, smooth_noise(self.shape, self.sigma)
        t = t * t * (3 - 2 * t)
        return self.a * (1 - t) + self.b * t


def sample(field, y, x):
    return map_coordinates(field, [y, x], order=1, mode="nearest")


# --- the air: u on the left/right faces (NY, NX+1), v on the top/bottom faces (NY+1, NX); y points down ---
u = np.zeros((NY, NX + 1))
v = np.zeros((NY + 1, NX))
heat = np.zeros((NY, NX))
steam = np.zeros((NY * SS, NX * SS))

yy, xx = np.mgrid[0:NY, 0:NX].astype(float)
uy, ux = np.mgrid[0:NY, 0:NX + 1].astype(float)
vy, vx = np.mgrid[0:NY + 1, 0:NX].astype(float)
sy, sx = np.mgrid[0:NY * SS, 0:NX * SS].astype(float)

# Neumann Poisson solve on the cells (walls all round), by cosine transform
ky = 2 - 2 * np.cos(np.pi * np.arange(NY) / NY)
kx = 2 - 2 * np.cos(np.pi * np.arange(NX) / NX)
lap = ky[:, None] + kx[None, :]
lap[0, 0] = 1.0


def project():
    u[:, 0] = u[:, -1] = 0
    v[0, :] = v[-1, :] = 0
    div = (u[:, 1:] - u[:, :-1]) + (v[1:, :] - v[:-1, :])
    p = idctn(dctn(div, norm="ortho") / -lap, norm="ortho")
    p -= p.mean()
    u[:, 1:-1] -= p[:, 1:] - p[:, :-1]
    v[1:-1, :] -= p[1:, :] - p[:-1, :]


def u_at(y, x):  # u at cell-centre coordinates
    return sample(u, y, x + 0.5)


def v_at(y, x):
    return sample(v, y + 0.5, x)


def advect():
    global u, v, heat, steam
    # air carries itself
    bu = u_at(uy, ux - 0.5), v_at(uy, ux - 0.5)
    new_u = sample(u, uy - DT * bu[1], ux - DT * bu[0])
    bv = u_at(vy - 0.5, vx), v_at(vy - 0.5, vx)
    new_v = sample(v, vy - DT * bv[1], vx - DT * bv[0])
    # heat and steam
    cu, cv = u_at(yy, xx), v_at(yy, xx)
    heat = sample(heat, yy - DT * cv, xx - DT * cu)
    fy, fx = (sy + 0.5) / SS - 0.5, (sx + 0.5) / SS - 0.5
    su, sv = u_at(fy, fx), v_at(fy, fx)
    steam = sample(steam, sy - DT * sv * SS, sx - DT * su * SS)
    u, v = new_u, new_v


def vorticity(strength):
    cu = 0.5 * (u[:, 1:] + u[:, :-1])
    cv = 0.5 * (v[1:, :] + v[:-1, :])
    w = np.gradient(cv, axis=1) - np.gradient(cu, axis=0)
    mag = np.abs(w)
    gy, gx = np.gradient(mag)
    length = np.hypot(gx, gy) + 1e-6
    gx, gy = gx / length, gy / length
    fx, fy = gy * w * strength, -gx * w * strength
    u[:, 1:-1] += DT * 0.5 * (fx[:, 1:] + fx[:, :-1])
    v[1:-1, :] += DT * 0.5 * (fy[1:, :] + fy[:-1, :])


# the lid: its rim line and width, in the simulation's own cells
rim_x = PAD_X + RIM_X * VW
rim_y = PAD_TOP + RIM_Y * VH
half = 0.5 * LID_W * VW
dome = DOME * LID_W * VW

# the source, on the fine grid: a band lying on the lid's dome, strongest over its top and at its rim
sxr = (sx / SS - rim_x) / half
arc = rim_y - dome * np.clip(1 - sxr**2, 0, 1)
band = np.exp(-(((sy / SS - arc + 1.2) / 1.9) ** 2)) * np.clip((1.04 - np.abs(sxr)) / 0.16, 0, 1)
# and a low cloud hanging over the whole lid, so the plume leaves it broad, not pinched
cloud = np.exp(-(((sy / SS - (rim_y - 0.17 * LID_W * VW)) / (0.16 * LID_W * VW)) ** 2)) * np.exp(-((sxr / 0.84) ** 4))
mottle = Drift((NY // 3, NX // 3), 1.3, 11)
puffs = Drift((1, NX * SS), (0, 7), 16)
puffs2 = Drift((1, NX * SS), (0, 3), 9)
swirl = Drift((NY // 4, NX // 4), 2.0, 22)
fine = Drift((NY // 2, NX // 2), 1.6, 12)
breeze = Drift((1, 1), 0, 90)

cell_band = zoom(band, 1 / SS, order=1)[:NY, :NX]
height_above = np.clip((rim_y - yy) / VH, 0, 1)


def step(i: int):
    global heat, steam
    # puffs of steam from the lid, more here and less there, changing all the time
    p = puffs.at(i)[0]
    q = puffs2.at(i)[0]
    amount = np.clip(0.42 + 1.1 * p + 0.5 * q, 0, None)[None, :]
    steam += DT * 0.085 * band * (0.6 + 0.4 * np.clip(1 - sxr**2, 0, 1)) * amount
    m = mottle.at(i)
    lumps = np.clip(0.35 + 1.5 * zoom(m, (NY * SS / m.shape[0], NX * SS / m.shape[1]), order=1), 0, None)
    steam += DT * 0.052 * cloud * lumps
    cells = zoom(amount, (1, 1 / SS), order=1)[:, :NX]
    heat += DT * 0.16 * cell_band * cells
    # at the rim it slips out sideways before it rises
    side = np.clip((xx - rim_x) / half, -1.2, 1.2)
    out = 0.03 * side**3 * cell_band
    u[:, 1:-1] += 0.5 * (out[:, 1:] + out[:, :-1])
    # warm air rises
    lift = 0.09 * heat
    v[1:-1, :] -= DT * 0.5 * (lift[1:, :] + lift[:-1, :])
    # billows: slowly drifting swirls, stronger as the steam climbs
    for field, strength, factor in ((swirl.at(i), 0.42, 4), (fine.at(i), 0.19, 2)):
        psi = zoom(field, factor, order=3)[:NY, :NX]
        gy, gx = np.gradient(psi)
        alive = np.clip(gaussian_filter(heat, 3) * 3.0, 0, 1) * (0.45 + height_above)
        fu, fv = gy * alive * strength, -gx * alive * strength
        u[:, 1:-1] += 0.5 * (fu[:, 1:] + fu[:, :-1])
        v[1:-1, :] += 0.5 * (fv[1:, :] + fv[:-1, :])
    # the kitchen's draught: a gentle lean to the left higher up
    wind = (-0.0045 + 0.003 * breeze.at(i)[0, 0]) * height_above * np.clip(heat * 4, 0, 1)
    u[:, 1:-1] += 0.5 * (wind[:, 1:] + wind[:, :-1])
    vorticity(0.11)
    u[:] *= 0.992
    v[:] *= 0.992
    project()
    advect()
    heat *= 0.9875
    steam *= 0.9928
    # steam spreads as it rises: soft billows, not threads
    steam = gaussian_filter(steam, 0.45)
    # nothing gathers at the box's walls
    heat[:6, :] *= 0.8
    steam[: 6 * SS, :] *= 0.8


# --- the film ---
crop_y = slice(PAD_TOP * SS, (PAD_TOP + VH) * SS)
crop_x = slice(PAD_X * SS, (PAD_X + VW) * SS)
total = COLS * ROWS
shots: list[np.ndarray] = []
for i in range(WARM_UP + (total + BLEND) * EVERY):
    step(i)
    if i >= WARM_UP and (i - WARM_UP) % EVERY == 0:
        shot = Image.fromarray(steam[crop_y, crop_x].astype(np.float32), mode="F")
        shots.append(np.asarray(shot.resize((FRAME_W, FRAME_H), Image.LANCZOS)).clip(0))
assert len(shots) >= total + BLEND

frames = []
for i in range(total):
    if i < BLEND:
        t = (i + 0.5) / BLEND
        t = t * t * (3 - 2 * t)
        frames.append(shots[total + i] * (1 - t) + shots[i] * t)
    else:
        frames.append(shots[i])

# soft edges, so nothing is ever cut: fade at the top and the sides, and nothing hangs below the lid
fy, fx = np.mgrid[0:FRAME_H, 0:FRAME_W].astype(float)
fx_n, fy_n = (fx + 0.5) / FRAME_W, (fy + 0.5) / FRAME_H


def ramp(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


edges = ramp((fy_n - 0.008) / 0.2) * ramp(fx_n / 0.14) * ramp((1 - fx_n) / 0.14)
under = 1 - ramp((fy_n - (RIM_Y + 0.012)) / 0.045)
peak = 1.0


def paint(density: np.ndarray) -> Image.Image:
    d = density / peak
    alpha = (1 - np.exp(-2.45 * d**1.12)) * 0.92 * edges * under
    # warm steam, lit by the kitchen's lamps: creamy where it is thick, a little browner where it is thin
    thick = ramp(d * 1.15)[..., None]
    thin_colour = np.array([230.0, 200.0, 172.0])
    thick_colour = np.array([255.0, 241.0, 220.0])
    rgb = thin_colour * (1 - thick) + thick_colour * thick
    # a touch of shading from the steam's own shape, so the billows read as round
    lit = gaussian_filter(density, 2.5)
    gx = np.gradient(lit, axis=1) + 0.6 * np.gradient(lit, axis=0)
    shade = 1 + np.clip(gx / (peak * 0.05), -1, 1)[..., None] * 0.1
    rgb = np.clip(rgb * shade, 0, 255)
    return Image.fromarray(np.dstack([rgb, alpha * 255]).round().astype(np.uint8), "RGBA")




def soften(density: np.ndarray) -> np.ndarray:
    # a body of fine mist around the swirls, as in a lit kitchen
    return 0.9 * gaussian_filter(density, 0.55) + 0.34 * gaussian_filter(density, 5.5)


frames = [soften(f) for f in frames]
peak = np.percentile(np.stack(frames), 99.0)
pictures = [paint(f) for f in frames]
atlas = Image.new("RGBA", (COLS * FRAME_W, ROWS * FRAME_H), (230, 212, 192, 0))
for i, picture in enumerate(pictures):
    atlas.paste(picture, ((i % COLS) * FRAME_W, (i // COLS) * FRAME_H))
OUT.parent.mkdir(parents=True, exist_ok=True)
atlas.save(OUT, "WEBP", quality=66, alpha_quality=72, method=6)
print(f"{OUT.name}: {atlas.width}x{atlas.height}, {total} frames, {OUT.stat().st_size / 1024:.0f} KB")

if "--preview" in sys.argv:
    folder = Path(sys.argv[sys.argv.index("--preview") + 1])
    folder.mkdir(parents=True, exist_ok=True)
    for k in range(0, total, 5):
        bg = Image.new("RGBA", (FRAME_W, FRAME_H), (58, 36, 22, 255))
        bg.alpha_composite(pictures[k])
        bg.save(folder / f"f{k:02d}.png")
