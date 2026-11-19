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

# ---- cutting and peeling: real knife-and-pumpkin recordings (one cut per file) ---------------------------------------------------------------
for i, stem in enumerate(["cut_pumpkin_01", "cut_pumpkin_02", "cut_pumpkin_03"], start=1):
    x = read(find(FOLEY, stem))
    s = max(0, onset(x, 0.15) - int(SR * 0.02))
    emit(f"slice{i}", fade(peak_to(trim(x[s : s + int(SR * 0.9)]), -3), 2, 60), 96)
for i in range(1, 6):
    x = trim(read(find(FOLEY, f"peel_pumpkin_0{i}")), lead_db=-40, tail_db=-42)
    emit(f"peel{i}", fade(peak_to(x, -9), 4, 40), 96)  # recorded very quietly: brought up to level

# ---- two continuous washing beds (looped): soapy rubbing and running water ------------------------------------------------------------------
def bed(stems: list[str], peak: float, seconds: float, xfade: float = 0.25) -> np.ndarray:
    parts = [peak_to(trim(read(find(WATER, s)), lead_db=-50, tail_db=-50), -6) for s in stems]
    out = np.concatenate(parts)
    while len(out) < int((seconds + xfade) * SR):
        out = np.concatenate([out, out])
    return peak_to(loop_of(out, xfade, seconds, xfade), peak)


emit("wash-scrub", bed(["water_splash-03", "water_splash-06"], -14, 2.0), 80, loop=True)
emit("wash-rinse", bed(["water_splash-01", "water_splash-04"], -12, 2.4), 80, loop=True)

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
