"""
Builds the game's sound (developer 2026-11-19, Playgama 3.3.2: "sound is recorded or produced with audio tools and shipped as compressed audio files;
sound synthesized in code is not accepted") from RECORDED, CC0 sources into public/audio/*.mp3, and writes src/game/audio/audioFiles.ts.

    python scripts/fetch-audio-sources.py      (once: downloads the CC0 sources into scripts/.audio-src/)
    python scripts/make-audio-assets.py

What it does to a recording: cuts it out of its file, trims the silence, rounds the first and last few milliseconds (no click), sets the level, and
encodes mp3 (mono 96 kbps for effects, stereo 96 kbps for music). A tonal recording (a chime, a glass, a bell) is a VOICE: its real pitch is measured
and written down, so the game can play it at any note by changing its playback rate, like a sampler. The music is cut to a seamless loop: the end of
the loop is crossfaded into the material that came right before its start.
Sources and licences: docs/AUDIO-CREDITS.md.
"""

import json
import subprocess
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / ".audio-src"
OUT = ROOT / "public" / "audio"
TS = ROOT / "src" / "game" / "audio" / "audioFiles.ts"
SR = 44100
OUT.mkdir(parents=True, exist_ok=True)
TS.parent.mkdir(parents=True, exist_ok=True)


def find(folder: str, stem: str) -> Path:
    hits = [p for p in (SRC / folder).rglob("*") if p.stem == stem and not p.name.startswith("._") and p.suffix.lower() in (".wav", ".ogg", ".mp3", ".flac", ".aif")]
    if not hits:
        raise SystemExit(f"missing source {folder}/{stem}: run scripts/fetch-audio-sources.py")
    return hits[0]


def read(path: Path, channels: int = 1) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "quiet", "-i", str(path), "-ac", str(channels), "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).copy()
    return x if channels == 1 else x.reshape(-1, channels)


def write_mp3(x: np.ndarray, path: Path, kbps: int):
    ch = 1 if x.ndim == 1 else x.shape[1]
    subprocess.run(
        ["ffmpeg", "-v", "quiet", "-y", "-f", "f32le", "-ar", str(SR), "-ac", str(ch), "-i", "-", "-codec:a", "libmp3lame", "-b:a", f"{kbps}k", str(path)],
        input=np.clip(x, -1, 1).astype(np.float32).tobytes(),
        check=True,
    )


def env(x: np.ndarray, ms: float = 4.0) -> np.ndarray:
    m = x if x.ndim == 1 else np.abs(x).max(axis=1)
    w = max(1, int(SR * ms / 1000))
    return np.sqrt(np.convolve(m**2, np.ones(w) / w, "same"))


def trim(x: np.ndarray, lead_db: float = -42.0, tail_db: float = -48.0, pre_ms: float = 3.0) -> np.ndarray:
    e = env(x)
    pk = e.max()
    if pk <= 0:
        return x
    a = np.where(e > pk * 10 ** (lead_db / 20))[0]
    b = np.where(e > pk * 10 ** (tail_db / 20))[0]
    s = max(0, a[0] - int(SR * pre_ms / 1000))
    return x[s : b[-1] + 1]


def fade(x: np.ndarray, in_ms: float = 2.0, out_ms: float = 25.0) -> np.ndarray:
    x = x.copy()
    n_in, n_out = int(SR * in_ms / 1000), int(SR * out_ms / 1000)
    n_out = min(n_out, len(x) // 2)
    n_in = min(n_in, len(x) // 2)
    if n_in:
        ramp = np.linspace(0, 1, n_in) if x.ndim == 1 else np.linspace(0, 1, n_in)[:, None]
        x[:n_in] *= ramp
    if n_out:
        ramp = np.linspace(1, 0, n_out) if x.ndim == 1 else np.linspace(1, 0, n_out)[:, None]
        x[-n_out:] *= ramp
    return x


def peak_to(x: np.ndarray, db: float) -> np.ndarray:
    pk = np.abs(x).max()
    return x * (10 ** (db / 20) / pk) if pk > 0 else x


def rms_to(x: np.ndarray, db: float, peak_cap_db: float = -1.0) -> np.ndarray:
    r = np.sqrt((x**2).mean())
    y = x * (10 ** (db / 20) / r)
    pk = np.abs(y).max()
    cap = 10 ** (peak_cap_db / 20)
    return y * (cap / pk) if pk > cap else y


def pitch_hz(x: np.ndarray) -> float:
    """The strongest partial between 150 Hz and 4 kHz in the first 250 ms, refined by parabolic interpolation: a voice's root note."""
    seg = x[: int(SR * 0.25)]
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), n=1 << 18))
    f = np.fft.rfftfreq(1 << 18, 1 / SR)
    lo, hi = np.searchsorted(f, 150), np.searchsorted(f, 4000)
    k = lo + int(spec[lo:hi].argmax())
    a, b, c = np.log(spec[k - 1] + 1e-12), np.log(spec[k] + 1e-12), np.log(spec[k + 1] + 1e-12)
    shift = 0.5 * (a - c) / (a - 2 * b + c)
    return float(f[k] + shift * (f[1] - f[0]))


def onset(x: np.ndarray, frac: float = 0.2) -> int:
    e = env(x, 3.0)
    return int(np.where(e > e.max() * frac)[0][0])


def loop_of(x: np.ndarray, start: float, length: float, xfade: float) -> np.ndarray:
    """A seamless loop: x[start : start+length], its last `xfade` seconds crossfaded (equal power) into the material that came just before `start`."""
    a, n, k = int(start * SR), int(length * SR), int(xfade * SR)
    if a < k:
        raise SystemExit("loop start must leave room for the crossfade")
    out = x[a : a + n].copy()
    t = np.linspace(0, np.pi / 2, k)
    fo, fi = np.cos(t), np.sin(t)
    if out.ndim == 2:
        fo, fi = fo[:, None], fi[:, None]
    out[-k:] = out[-k:] * fo + x[a - k : a] * fi
    return out


def band(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)


def highpass(x: np.ndarray, lo: float) -> np.ndarray:
    return sosfilt(butter(2, lo, btype="high", fs=SR, output="sos"), x)


def lowpass(x: np.ndarray, hi: float) -> np.ndarray:
    return sosfilt(butter(2, hi, btype="low", fs=SR, output="sos"), x)


files: dict[str, dict] = {}


def emit(name: str, x: np.ndarray, kbps: int, *, voice: bool = False, loop: bool = False):
    path = OUT / f"{name}.mp3"
    write_mp3(x, path, kbps)
    rec = {"file": f"audio/{name}.mp3", "bytes": path.stat().st_size, "seconds": round(len(x) / SR, 2)}
    if voice:
        rec["rootHz"] = round(pitch_hz(x), 1)
    if loop:
        rec["loop"] = True
    files[name] = rec
    print(f"{name:14s} {rec['seconds']:6.2f}s {rec['bytes'] / 1024:7.1f} KB" + (f"  root {rec['rootHz']} Hz" if voice else ""))


def sfx(name: str, folder: str, stem: str, *, peak: float = -3.0, start: float = 0.0, end: float | None = None, voice: bool = False, lead_db: float = -42.0):
    x = read(find(folder, stem))
    if end is not None or start:
        x = x[int(start * SR) : int(end * SR) if end is not None else None]
    x = trim(x, lead_db=lead_db)
    emit(name, fade(peak_to(x, peak)), 96, voice=voice)


KIF, RPG, FOLEY, WATER = "kif", "rpg", "foley", "water"

# ---- the tonal voices (played at any note by their playback rate) -------------------------------------------------------------------------
sfx("chime", KIF, "confirmation_001", voice=True)
sfx("chime2", KIF, "question_002", voice=True)
sfx("bell", KIF, "confirmation_004", voice=True)
sfx("glass", KIF, "glass_001", voice=True)
sfx("bong", KIF, "bong_001", voice=True)

# ---- named effects -------------------------------------------------------------------------------------------------------------------------
sfx("tap", KIF, "tick_004", peak=-6)
sfx("tick", KIF, "click_005", peak=-8)
sfx("squeak", KIF, "toggle_003", peak=-9)
sfx("coin", RPG, "coin3", peak=-5)
sfx("till", RPG, "coin2", peak=-5, end=0.75)
sfx("plate", KIF, "drop_003", peak=-5)
sfx("thud", KIF, "drop_002", peak=-4)
sfx("wrong", KIF, "error_005", peak=-5)
sfx("lights", KIF, "switch_004", peak=-6)
sfx("pluck", KIF, "pluck_001", peak=-5, voice=True)
sfx("story", RPG, "magic1", peak=-8)
sfx("horn", FOLEY, "bicycle-horn-1", peak=-4)
sfx("knock", RPG, "wood-small", peak=-6)
sfx("shing", RPG, "metal-ringing", peak=-8)
sfx("scrape", KIF, "scratch_005", peak=-6)
sfx("scrub-wet", RPG, "cloth", peak=-5)
sfx("scrub-dry", RPG, "cloth-heavy", peak=-5)
sfx("scrub-brush", KIF, "scratch_004", peak=-6)
sfx("bubble", RPG, "bubble", peak=-8)

# ---- the mini-games' own sounds (developer 2026-11-22: sound effects for Unload the Van and the other mini-games), all from the CC0 packs already used above ----------------
sfx("whoosh", RPG, "swing2", peak=-6)  # a booster launching a crate, a waiter setting off
sfx("clank", RPG, "metal-small2", peak=-5)  # the hammer smashing a block
sfx("door", RPG, "door", peak=-6, end=0.5)  # a crate going out through its door
sfx("pop", RPG, "bubble2", peak=-8)  # a cube picked off the dessert, a pantry jar
sfx("beads", RPG, "beads", peak=-9)  # cubes landing on the serving cart, a shaker of spice
sfx("slide", KIF, "scroll_002", peak=-9, end=0.3)  # a crate gliding over the floor
sfx("back", KIF, "back_002", peak=-7)  # Undo
sfx("bottle", RPG, "bottle", peak=-7)  # liquids poured into the bowl, the bottle being filled

# ---- cutting and peeling: real knife-and-pumpkin recordings (one cut per file) ---------------------------------------------------------------
for i, stem in enumerate(["cut_pumpkin_01", "cut_pumpkin_02", "cut_pumpkin_03"], start=1):
    x = read(find(FOLEY, stem))
    s = max(0, onset(x, 0.15) - int(SR * 0.02))
    emit(f"slice{i}", fade(peak_to(trim(x[s : s + int(SR * 0.9)]), -3), 2, 60), 96)
for i in range(1, 6):
    x = trim(read(find(FOLEY, f"peel_pumpkin_0{i}")), lead_db=-40, tail_db=-42)
    emit(f"peel{i}", fade(peak_to(x, -9), 4, 40), 96)  # recorded very quietly: brought up to level

# ---- knife on a wooden board, one family per kind of ingredient (developer 2026-11-22: "realistic cutting sounds ... different for different ingredients") ----------------
# Real recordings of knives going through food on a board (Freesound CC0, see fetch-audio-sources.py). Each family is a few single cuts (id, start s, length s):
# a chop keeps its own board thud and a little of its ring; the longer ones (bread, melon, meat, cheese, citrus) are a stroke of the blade through the food.
CUTS = {
    "crunch": [(163275, 0.462, 0.125), (764468, 2.355, 0.097), (755233, 0.072, 0.132), (755234, 4.617, 0.352)],  # carrot, cucumber, apple, celery ...
    "juicy": [(87508, 33.369, 0.096), (812387, 6.875, 0.119), (812387, 13.781, 0.094), (87508, 49.698, 0.116)],  # tomato, strawberry, peach ...
    "leaf": [(760374, 8.525, 0.076), (125521, 8.65, 0.496), (125521, 7.18, 0.488)],  # lettuce, cabbage, herbs
    "bulb": [(718595, 0.141, 0.512), (766124, 12.453, 0.078), (766124, 1.871, 0.082), (826735, 19.226, 0.083)],  # onion, garlic, ginger
    "bread": [(87506, 18.393, 0.55), (87506, 19.707, 0.55), (487030, 23.0, 0.55), (487030, 4.282, 0.55)],  # a bread knife through a crust
    "melon": [(752214, 12.108, 0.55), (752214, 6.955, 0.55)],  # watermelon, pineapple
    "citrus": [(703058, 1.209, 0.55), (703058, 4.34, 0.55)],  # lemon, orange, lime
    "mushroom": [(828969, 12.432, 0.071), (360795, 1.016, 0.493), (828969, 12.707, 0.071), (360795, 4.159, 0.473)],  # mushroom, tofu, eggplant
    "cheese": [(87507, 4.997, 0.55), (87507, 2.414, 0.55)],  # mozzarella, cheddar, butter
    "meat": [(593682, 0.08, 0.55), (593682, 4.5, 0.55)],  # chicken, steak, salmon
}
cut_src: dict[int, np.ndarray] = {}


def cut_clip(x: np.ndarray, start: float, length: float) -> np.ndarray:
    """One cut out of a recording: it starts right at the blade's attack (the first strong rise after `start`, so there is no lead-in to feel late), the low
    rumble of handling the board is filtered off (below 120 Hz a knife has nothing to say), and the end rings out and fades."""
    a = int(start * SR)
    n_len = int((min(0.34, length + 0.10) if length < 0.2 else length) * SR)
    seg = highpass(x[max(0, a - int(0.004 * SR)) : a + n_len + int(0.6 * SR)], 120)
    e = env(seg, 3.0)
    first = int(np.argmax(e > e.max() * 0.35))
    s0 = max(0, first - int(0.006 * SR))
    return seg[s0 : s0 + n_len]


for fam, clips in CUTS.items():
    for n, (sid, start, length) in enumerate(clips, start=1):
        if sid not in cut_src:
            cut_src[sid] = read(SRC / "cuts" / f"{sid}.mp3")
        emit(f"cut-{fam}{n}", fade(rms_to(cut_clip(cut_src[sid], start, length), -24.0, peak_cap_db=-3.0), 2, 70), 96)
# the board itself: the thud of a blade meeting a wooden board, from a recording of a knife on a board
board = read(SRC / "cuts" / "847873.mp3")
a = int(22.4636 * SR)
emit("boardtap", fade(peak_to(board[a - int(0.004 * SR) : a + int(0.16 * SR)], -6.0), 2, 60), 96)

# ---- the washing and wiping beds (looped): one continuous, soft voice that follows the sponge or the cloth ------------------------------------------------
# developer 2026-11-22: "remove the current sound effects while wiping the board or doing dishes and add a more soothing sound, or a real wiping sound,
# that gives the player satisfaction". The old beds were bare water splashes with glassy pings and bubbles on top. The new ones are the real friction of a
# peel being worked over a surface (the pumpkin peels) and real running water, each softened (the harsh top cut away, the low body kept) and levelled by
# loudness, so a wipe is a smooth, dry-to-damp "shhh" and a rinse is a steady, gentle flow. Filtering a recording is still a recording.


def joined(parts: list[np.ndarray], seconds: float, xfade: float = 0.12) -> np.ndarray:
    """The pieces laid end to end, each crossfaded into the next (equal power), repeated until `seconds` long."""
    k = int(xfade * SR)
    t = np.linspace(0, np.pi / 2, k)
    out = parts[0].copy()
    i = 1
    while len(out) < int((seconds + 0.6) * SR):
        nxt = parts[i % len(parts)]
        out = np.concatenate([out[:-k], out[-k:] * np.cos(t) + nxt[:k] * np.sin(t), nxt[k:]])
        i += 1
    return out


def level_out(x: np.ndarray, win: float = 0.2, amount: float = 1.0) -> np.ndarray:
    """Evens out a recording's loudness (its silences and its single loud splashes) with a slow gain: a continuous bed has no gaps and no bangs."""
    e = np.sqrt(np.convolve(x**2, np.ones(int(win * SR)) / int(win * SR), "same"))
    ref = np.median(e[e > 0]) if (e > 0).any() else 1.0
    gain = (ref / np.maximum(e, ref * 0.03)) ** amount
    return x * lowpass(gain, 12.0)


def soft_bed(layers: list[tuple[np.ndarray, float]], seconds: float, level_db: float) -> np.ndarray:
    """Layers (a sound, its gain in dB) summed, looped seamlessly, set to a loudness (RMS) that the game's own fader then scales."""
    n = int((seconds + 0.3) * SR)
    mix = level_out(sum(x[:n] * 10 ** (g / 20) for x, g in layers))
    return rms_to(loop_of(mix, 0.3, seconds - 0.3, 0.3), level_db, peak_cap_db=-3.0)


def friction(order: list[int], lo: float = 250, hi: float = 3400) -> list[np.ndarray]:
    """The peel recordings (a real, dry friction), each levelled and softened: 250 Hz to 3.4 kHz unless told otherwise."""
    out = []
    for i in order:
        x = trim(read(find(FOLEY, f"peel_pumpkin_0{i}")), lead_db=-45, tail_db=-45)
        out.append(fade(band(peak_to(x, -6), lo, hi), 40, 40))
    return out


def scratch(stems: list[str], lo: float, hi: float) -> list[np.ndarray]:
    """Kenney's scratch recordings, band-limited: the gritty scrape of a scraper or a brush."""
    return [fade(band(peak_to(trim(read(find(KIF, s)), lead_db=-45, tail_db=-45), -6), lo, hi), 30, 30) for s in stems]


def water(stems: list[str], top_hz: float) -> list[np.ndarray]:
    return [fade(band(peak_to(trim(read(find(WATER, s)), lead_db=-50, tail_db=-50), -6), 120, top_hz), 40, 40) for s in stems]


cloth = lowpass(read(find(RPG, "cloth-heavy")), 1100)  # the soft body of a cloth being drawn over wood
rub = joined(friction([1, 3, 2, 5, 4]), 4.0)
emit("wash-wipe", soft_bed([(rub, 0.0), (joined([cloth], 4.0, 0.08), -9.0)], 4.0, -21.0), 64, loop=True)  # the cutting board's cloth
emit("wash-scrub", soft_bed([(rub, 0.0), (joined(water(["water_splash-03", "water_splash-06"], 3000), 4.0), -7.0)], 4.0, -21.0), 64, loop=True)  # the soapy sponge
emit(
    "wash-rinse",
    soft_bed([(joined(water(["water_splash-03", "water_splash-06"], 3400), 4.0), 0.0), (joined(water(["water_splash-04", "water_splash-01"], 2400), 4.0), -10.0)], 4.0, -22.0),
    64,
    loop=True,
)  # running water

# The other cleaning tools (developer 2026-11-22: "better sounds for mopping and all other cleaning tasks"): each tool is one looped bed that follows the hand.
cloth_body = fade(lowpass(trim(read(find(RPG, "cloth-heavy")), lead_db=-40, tail_db=-40), 700), 30, 30)
emit("wash-mop", soft_bed([(joined(water(["water_splash-04", "water_splash-03", "water_splash-06"], 2600), 4.0), 0.0), (joined([cloth_body], 4.0, 0.08), -8.0)], 4.0, -21.0), 64, loop=True)  # a wet mop dragged over a floor
emit("wash-sweep", soft_bed([(joined(friction([5, 1, 4, 2, 3], 900, 5500), 4.0), 0.0), (joined([cloth_body], 4.0, 0.08), -14.0)], 4.0, -22.0), 64, loop=True)  # dry bristles of a broom
emit("wash-scrape", soft_bed([(joined(scratch(["scratch_004", "scratch_005"], 500, 4200), 4.0), 0.0), (joined(friction([3, 4], 300, 2500), 4.0), -6.0)], 4.0, -22.0), 64, loop=True)  # a scraper lifting baked-on food
emit("wash-brush", soft_bed([(joined(friction([2, 1, 3], 300, 3000), 4.0), 0.0), (joined(scratch(["scratch_004"], 400, 3000), 4.0), -7.0), (joined(water(["water_splash-03", "water_splash-06"], 2600), 4.0), -9.0)], 4.0, -21.0), 64, loop=True)  # a toilet brush in the bowl
emit("wash-glass", soft_bed([(joined(friction([4, 5, 3], 1500, 6500), 4.0), 0.0), (joined(scratch(["scratch_005"], 2000, 6000), 4.0), -9.0)], 4.0, -24.0), 64, loop=True)  # a cloth over the mirror

# Stirring the Sauce Station's bowl (developer 2026-11-22: "while stirring add a satisfying stirring sound"): one looped bed that follows the spoon or the whisk.
bubbles = lowpass(read(find(RPG, "bubble")), 1400)
emit("wash-stir", soft_bed([(joined(water(["water_splash-04", "water_splash-01"], 1800), 4.0), 0.0), (joined(friction([3, 4, 2], 300, 2000), 4.0), -7.0), (joined([fade(trim(bubbles), 20, 40)], 4.0, 0.1), -9.0)], 4.0, -21.0), 64, loop=True)  # a wooden spoon turning thick sauce
emit("wash-whisk", soft_bed([(joined(water(["water_splash-02", "water_splash-04", "water_splash-01"], 5200), 4.0), 0.0), (joined(friction([5, 1], 1500, 5200), 4.0), -9.0)], 4.0, -22.0), 64, loop=True)  # a whisk beating a thin dressing

# ---- the music: four calm moods, each a seamless loop --------------------------------------------------------------------------------------
LEVEL = -21.0  # RMS of every track; the game's own faders set how loud each mood is
mp = lambda s: next((SRC / "music").glob(s))
m = read(mp("morning_sky.*"), 2)
emit("music-loading", rms_to(loop_of(m, 4.0, 96.0, 4.0), LEVEL), 96, loop=True)
m = read(mp("etirwer.*"), 2)
emit("music-kitchen", rms_to(fade(m, 30, 30), LEVEL), 96, loop=True)  # recorded as a loop: wraps on its own
m = read(mp("jrpg_piano.*"), 2)
emit("music-cutting", rms_to(loop_of(m, 1.5, 21.0, 1.5), LEVEL), 96, loop=True)
m = read(mp("sunset_plains.*"), 2)
emit("music-night", rms_to(loop_of(m, 6.0, 110.0, 6.0), LEVEL), 96, loop=True)

# ---- the manifest the game reads --------------------------------------------------------------------------------------------------------------
total = sum(r["bytes"] for r in files.values())
body = ",\n".join(
    f'  "{k}": {{ file: "{v["file"]}"' + (f', rootHz: {v["rootHz"]}' if "rootHz" in v else "") + (", loop: true" if v.get("loop") else "") + f", seconds: {v['seconds']} }}"
    for k, v in files.items()
)
TS.write_text(
    "/**\n"
    " * The game's recorded sound (generated by scripts/make-audio-assets.py from CC0 recordings: docs/AUDIO-CREDITS.md). Do not edit by hand.\n"
    " * `rootHz` is the measured pitch of a tonal recording (a voice): the game plays it at any note by its playback rate.\n"
    f" * {len(files)} files, {total / 1024 / 1024:.1f} MB in all.\n"
    " */\n"
    "export const AUDIO_FILES = {\n" + body + ",\n} as const;\n"
    "export type AudioId = keyof typeof AUDIO_FILES;\n"
    "/** The tonal recordings, by the pitch each was recorded at. */\n"
    "export const VOICES = (Object.entries(AUDIO_FILES) as [AudioId, { rootHz?: number }][])\n"
    "  .filter(([, v]) => v.rootHz)\n"
    "  .map(([id, v]) => ({ id, rootHz: v.rootHz as number }));\n",
    encoding="utf8",
)
print(f"\n{len(files)} files, {total / 1024 / 1024:.2f} MB -> {OUT}")
