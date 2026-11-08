/**
 * MUSIC QA (developer 2026-11-08: "add music while loading the game and add background music, soothing or relaxing, that can engage the
 * player for longer hours, and make sure we don't face any copyright issue").
 *   C  copyright: no audio file anywhere in the game, no audio element, no downloaded sound; the score is made by src/game/music/
 *      relaxComposer.ts from plain scales and chord cycles and a seeded generator, with the reasons written in the file
 *   P  the piece: the same seed gives the same piece; it is slow and soft; every note is in range and in the key; it never repeats
 *      over a long session (key moves, new chord cycles, rests); the loudest moment is bounded
 *   L  loading: the loading mood exists and plays before the save is there; the loading screen says "tap for music" until the first tap
 * Run: npx tsx scripts/music-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { CYCLES, MOOD_SETTINGS, RelaxComposer } from "../src/game/music/relaxComposer.ts";
import type { MoodName } from "../src/game/music/relaxComposer.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail).slice(0, 300));
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "releases", "NPC Assets", "Covers"].includes(e.name))
      continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

console.log("C. No copyright risk: nothing recorded, nothing copied");
{
  const AUDIO = /\.(mp3|ogg|oga|wav|flac|aac|m4a|opus|mid|midi)$/i;
  const files = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "public"))].filter((f) =>
    AUDIO.test(f),
  );
  assert(files.length === 0, "C1: no sound file in src/ or public/ (the game ships none)", files);
  const code = walk(path.join(ROOT, "src"))
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => ({ f, t: fs.readFileSync(f, "utf8") }));
  const media = code.filter(({ t }) =>
    /new Audio\(|<audio[\s>]|decodeAudioData|createMediaElementSource/.test(t),
  );
  assert(
    media.length === 0,
    "C2: nothing loads or decodes a sound (no Audio element, no decodeAudioData)",
    media.map((m) => m.f),
  );
  const remote = code.filter(({ t }) =>
    /(soundcloud|freesound|youtube\.com\/watch|spotify|\.mp3)/i.test(t),
  );
  assert(
    remote.length === 0,
    "C3: no link to a music site or a track",
    remote.map((m) => m.f),
  );
  const src = read("src/game/music/relaxComposer.ts");
  assert(
    /COPYRIGHT/.test(src) &&
      /nothing here is recorded, sampled, downloaded or copied/i.test(src) &&
      /random walk/.test(src),
    "C4: the score's file says why it is original (made from scales, chord cycles and a random walk)",
  );
  assert(
    !/Math\.random/.test(src) && !/Date\.now|performance\.now/.test(src),
    "C5: the score uses no Math.random and no clock (seeded: the same piece every time)",
  );
  const am = read("src/game/AudioManager.ts");
  assert(
    !/fetch\(|XMLHttpRequest|<source/.test(am),
    "C6: AudioManager fetches nothing (the preflight's no-network rule)",
  );
}

console.log("P. The piece");
{
  const run = (n: number, mood: MoodName = "kitchen") => {
    const c = new RelaxComposer();
    return Array.from({ length: n }, () => c.nextBar(mood));
  };
  const a = run(64);
  const b = run(64);
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    "P1: the same seed gives the same piece, note for note",
  );
  assert(
    JSON.stringify(a) !==
      JSON.stringify(
        Array.from(
          { length: 64 },
          (
            (c) => () =>
              c.nextBar("kitchen")
          )(new RelaxComposer(7)),
        ),
      ),
    "P2: another seed gives another piece",
  );
  for (const mood of Object.keys(MOOD_SETTINGS) as MoodName[]) {
    const s = MOOD_SETTINGS[mood];
    assert(s.bpm >= 50 && s.bpm <= 66, `P3 ${mood}: slow (${s.bpm} beats a minute)`);
  }
  const bars = run(400);
  const bad = bars.flatMap((p) =>
    p.events.filter(
      (e) =>
        e.gain <= 0 ||
        e.gain > 0.09 ||
        e.dur <= 0 ||
        e.at < 0 ||
        e.at >= 6 ||
        (e.voice === "pluck" && (e.midi < 72 || e.midi > 91)) ||
        (e.voice === "pad" && (e.midi < 57 || e.midi > 76)) ||
        (e.voice === "bass" && (e.midi < 36 || e.midi > 47)) ||
        (e.voice === "bell" && (e.midi < 84 || e.midi > 91)),
    ),
  );
  assert(
    bad.length === 0,
    "P4: every note is soft, short enough and inside its voice's range",
    bad.slice(0, 3),
  );
  // Melody notes belong to the key's pentatonic scale.
  const out = bars.flatMap((p) =>
    p.events
      .filter((e) => e.voice === "pluck" || e.voice === "bell")
      .filter(
        (e) => !([0, 2, 4, 7, 9] as number[]).includes((((e.midi - (48 + p.key)) % 12) + 12) % 12),
      ),
  );
  assert(
    out.length === 0,
    "P5: every melody note and chime is in the key's pentatonic scale (nothing sour)",
    out.slice(0, 3),
  );
  // Loudness: the most that can sound at once (pads, bass, notes and their tails) stays under one half.
  let worst = 0;
  for (let i = 0; i < bars.length; i++) {
    // Voices of the bar before can still ring into this one.
    const here = [
      ...(bars[i - 1]?.events ?? []).map((e) => ({ ...e, at: e.at - 4 })),
      ...bars[i]!.events,
    ];
    for (let t = 0; t < 4; t += 0.25) {
      const sum = here
        // A struck note (pluck, chime) is loud only in its first beat and a half; a pad or the bass holds its level.
        .filter(
          (e) =>
            e.at <= t &&
            t < e.at + (e.voice === "pluck" || e.voice === "bell" ? Math.min(e.dur, 1.5) : e.dur),
        )
        .reduce((m, e) => m + e.gain, 0);
      worst = Math.max(worst, sum);
    }
  }
  assert(
    worst < 0.5,
    `P6: all voices together never exceed ${worst.toFixed(2)} (< 0.5, then the music fader and a limiter)`,
    worst,
  );
  const keys = new Set(bars.map((p) => p.key));
  const cyclesUsed = new Set(bars.map((p) => p.degree + ":" + (p.bar % 4)));
  assert(
    keys.size >= 4,
    `P7: over 400 bars (~${Math.round((400 * 4 * 60) / 64 / 60)} minutes) the key moves to ${keys.size} different keys`,
    [...keys],
  );
  assert(
    cyclesUsed.size >= 12,
    "P8: many chords and chord cycles are used, not one loop",
    cyclesUsed.size,
  );
  const bar16 = bars.slice(0, 16).map((p) => p.chord.join());
  const repeats = bars.slice(16).filter(
    (_, i) =>
      i % 16 === 0 &&
      bars
        .slice(i + 16, i + 32)
        .map((p) => p.chord.join())
        .join("|") === bar16.join("|"),
  );
  assert(repeats.length === 0, "P9: the first sixteen bars do not come back later");
  const melodyBars = bars.filter((p) => p.events.some((e) => e.voice === "pluck")).length;
  assert(
    melodyBars > 120 && melodyBars < 330,
    `P10: the melody rests: ${melodyBars} of 400 bars have notes (the start and every eighth bar are rests)`,
  );
  assert(
    bars[0]!.events.every((e) => e.voice !== "pluck") &&
      bars[1]!.events.every((e) => e.voice !== "pluck"),
    "P11: it opens with the pad alone (the first two bars)",
  );
  assert(
    JSON.stringify(CYCLES[0]) === "[0,4,5,3]" && bars[0]!.key === 0,
    "P12: it starts as I-V-vi-IV in C, every time (the loading music always opens the same way)",
  );
  const cut = run(200, "cutting");
  assert(
    !cut.some((p) => p.events.some((e) => e.voice === "bell")),
    "P13: no chimes while cutting",
  );
  const sparse = (m: MoodName) =>
    run(200, m)
      .flatMap((p) => p.events)
      .filter((e) => e.voice === "pluck").length;
  assert(
    sparse("cutting") < sparse("kitchen") && sparse("night") < sparse("kitchen"),
    "P14: cutting and Closing Time have fewer notes than the Kitchen",
  );
}

console.log("L. Loading music");
{
  const am = read("src/game/AudioManager.ts");
  const app = read("src/App.tsx");
  assert(
    /"loading"/.test(read("src/game/music/relaxComposer.ts")) && /loading: /.test(am),
    "L1: the loading mood exists with its own level",
  );
  assert(
    /!save\s*\?\s*"loading"/.test(app),
    "L2: App asks for the loading music while the save is not there yet",
  );
  assert(
    /userActivation\?\.hasBeenActive/.test(am) && /get unlocked\(\)/.test(am),
    "L3: if the page has already had a tap the loading music starts at once; otherwise at the first tap (never before: no autoplay warning)",
  );
  assert(
    /data-testid="loading-music-hint"/.test(app) && /tap for music/.test(app),
    "L4: until the first tap the loading screen says '🎵 tap for music'",
  );
}

console.log(failures ? `\nMUSIC QA: ${failures} FAILURE(S)` : "\nMUSIC QA: ALL PASS");
process.exit(failures ? 1 : 0);
