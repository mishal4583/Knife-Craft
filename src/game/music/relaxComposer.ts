/**
 * THE RELAXING SCORE (developer 2026-11-08: "add soothing or relaxing music that can engage the player for longer hours and make sure that we
 * don't face any copyright issue").
 *
 * COPYRIGHT: nothing here is recorded, sampled, downloaded or copied. The score is made by this file, note by note, from a seeded random
 * number generator and the plain building blocks of music that nobody owns: the major scale, the five-note (pentatonic) scale, stacked-third
 * chords on the scale's own degrees and the common four-chord cycles (I-V-vi-IV and its relatives). There is no tune in it that
 * anybody could recognise: the melody is a random walk over the pentatonic scale. The sound is then built by AudioManager from plain
 * sine / triangle waves and filtered noise (no sample files in the game at all). The result is original to this game.
 *
 * LONG SESSIONS: the piece never repeats. Four-chord cycles are picked again every eight bars, the key moves to a neighbouring key every
 * sixteen bars, a slow "breath" (about four minutes) raises and lowers how many melody notes play, every eighth bar is a bar of rest for the
 * melody, and a high chime now and then. It is slow (52-64 beats a minute), soft and without drums, so it can sit under hours of play.
 *
 * Pure and seeded: the same seed always gives the same piece; no unseeded randomness, no clock, no Web Audio here (the sound is AudioManager's).
 */

export type MoodName = "loading" | "kitchen" | "cutting" | "night";
export type Voice = "pad" | "pluck" | "bell" | "bass" | "breath";

/** One sound in a bar: `at` and `dur` are in beats from the bar's start, `gain` is the voice's own loudness before the music bus. */
export type MusicEvent = { voice: Voice; midi: number; at: number; dur: number; gain: number };

export type BarPlan = {
  bar: number;
  bpm: number;
  /** Beats in the bar (always 4). */
  beats: number;
  /** The key's tonic as a pitch class 0-11 (0 = C). */
  key: number;
  /** The chord's degree (0 = I … 6 = vii) and its notes as MIDI numbers. */
  degree: number;
  chord: number[];
  events: MusicEvent[];
};

type MoodSettings = {
  bpm: number;
  /** Chance scale for a melody note on each eighth. */
  density: number;
  /** Pad loudness scale. */
  pad: number;
  /** Chance of a high chime on the first beat of a four-bar group. */
  bells: number;
  /** A low root note under each bar. */
  bass: boolean;
};

export const MOOD_SETTINGS: Readonly<Record<MoodName, MoodSettings>> = {
  // While the game loads: open, slow and gentle, a little brighter with its chimes.
  loading: { bpm: 58, density: 0.2, pad: 1, bells: 0.8, bass: true },
  // The Kitchen and the menus: the main piece.
  kitchen: { bpm: 64, density: 0.3, pad: 1, bells: 0.5, bass: true },
  // While cutting: quieter and sparse, nothing that pulls the eye off the knife.
  cutting: { bpm: 64, density: 0.12, pad: 0.85, bells: 0, bass: true },
  // Closing Time: the slowest, nearly only the pad and a rare note.
  night: { bpm: 52, density: 0.09, pad: 1.1, bells: 0.3, bass: true },
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
const PENTATONIC = [0, 2, 4, 7, 9] as const;

/** Four-chord cycles as scale degrees (0 = I): the ones heard in countless songs; nobody owns a chord cycle. */
export const CYCLES: readonly (readonly number[])[] = [
  [0, 4, 5, 3],
  [5, 3, 0, 4],
  [0, 5, 3, 4],
  [3, 0, 4, 5],
  [0, 2, 3, 0],
  [0, 3, 0, 4],
  [3, 4, 2, 5],
  [0, 4, 3, 4],
];

/** Where the key may go next (semitones up): a fifth, a fourth, a second, a sixth. */
const KEY_MOVES = [7, 5, 7, 5, 2, 9] as const;

/** Eighth-note weights: strong places get more notes than weak ones. */
const SLOT_WEIGHT = [1.3, 0.4, 0.9, 0.5, 1.2, 0.4, 0.9, 0.5] as const;

const PAD_LOW = 57;
const PAD_HIGH = 76;
const MELODY_LOW = 72;
const MELODY_HIGH = 91;

/** A small seeded generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The MIDI note `idx` steps up the major scale from the tonic (idx may go past seven: the next octave). */
const degreeNote = (tonic: number, idx: number): number =>
  tonic + MAJOR[((idx % 7) + 7) % 7]! + 12 * Math.floor(idx / 7);

const fold = (m: number, lo: number, hi: number): number => {
  let n = m;
  while (n > hi) n -= 12;
  while (n < lo) n += 12;
  return n;
};

export class RelaxComposer {
  private rand: () => number;
  private bar = 0;
  private key = 0;
  private cycle = 0;
  private melodyAt = 0;
  private lastStep = 0;

  constructor(seed = 20261108) {
    this.rand = seeded(seed);
  }

  /** The next bar of the piece for this mood. */
  nextBar(mood: MoodName): BarPlan {
    const rand = this.rand;
    const set = MOOD_SETTINGS[mood];
    const bar = this.bar++;
    const inCycle = bar % 4;
    // A new four-chord cycle every eight bars (the first is I-V-vi-IV in C, always); a new key every sixteen.
    if (bar > 0 && bar % 8 === 0) this.cycle = Math.floor(rand() * CYCLES.length);
    if (bar > 0 && bar % 16 === 0)
      this.key = (this.key + KEY_MOVES[Math.floor(rand() * KEY_MOVES.length)]!) % 12;
    const degree = CYCLES[this.cycle]![inCycle]!;
    const tonic = 48 + this.key;
    const chord = [0, 2, 4, 6].map((i) => fold(degreeNote(tonic, degree + i), PAD_LOW, PAD_HIGH));
    const events: MusicEvent[] = [];

    // The pad: the chord's four notes, slow in and slow out, overlapping into the next bar.
    for (const m of chord)
      events.push({ voice: "pad", midi: m, at: 0, dur: 4.7, gain: 0.028 * set.pad });
    if (set.bass)
      events.push({
        voice: "bass",
        midi: fold(degreeNote(tonic, degree), 36, 47),
        at: 0,
        dur: 3.9,
        gain: 0.06,
      });
    // The room's breath: a soft swell of filtered noise under every bar.
    events.push({ voice: "breath", midi: 0, at: 0, dur: 4, gain: 0.018 + rand() * 0.006 });

    // Melody: a random walk on the key's pentatonic scale. Bar 0-1 are the pad alone; every eighth bar is a rest.
    const pool: number[] = [];
    for (let m = MELODY_LOW; m <= MELODY_HIGH; m++)
      if ((PENTATONIC as readonly number[]).includes((((m - tonic) % 12) + 12) % 12)) pool.push(m);
    const chordClasses = new Set(chord.map((m) => m % 12));
    const rest = bar < 2 || bar % 8 === 7 || (bar % 4 === 3 && rand() < 0.25);
    // The slow breath of the piece: about 4 minutes from fewer notes to more and back.
    const energy = 0.5 + 0.5 * Math.sin(bar / 11);
    const density = set.density * (0.6 + 0.8 * energy);
    if (!rest) {
      if (this.melodyAt === 0) this.melodyAt = Math.floor(pool.length / 2);
      let last = -2;
      let played = 0;
      for (let slot = 0; slot < 8 && played < 4; slot++) {
        if (slot - last < 2) continue;
        if (rand() >= density * SLOT_WEIGHT[slot]!) continue;
        if (played === 0 && rand() < 0.6) {
          // Land the first note of the bar on a note of the chord, near where the tune is.
          let best = this.melodyAt;
          let bestDist = Infinity;
          pool.forEach((m, i) => {
            if (!chordClasses.has(m % 12)) return;
            const d = Math.abs(i - this.melodyAt);
            if (d < bestDist) {
              best = i;
              bestDist = d;
            }
          });
          this.melodyAt = best;
        } else {
          const steps = [-2, -1, -1, 0, 1, 1, 2];
          let step = steps[Math.floor(rand() * steps.length)]!;
          // Never the same note three times running, and turn back at the ends of the range.
          if (step === 0 && this.lastStep === 0) step = rand() < 0.5 ? -1 : 1;
          this.lastStep = step;
          this.melodyAt = Math.min(pool.length - 1, Math.max(0, this.melodyAt + step));
          if (this.melodyAt === 0 || this.melodyAt === pool.length - 1)
            this.melodyAt = Math.min(pool.length - 2, Math.max(1, this.melodyAt));
        }
        const midi = pool[this.melodyAt]!;
        const gain = 0.045 + rand() * 0.015;
        const at = slot * 0.5;
        events.push({ voice: "pluck", midi, at, dur: 3.2 + rand(), gain });
        // Now and then a soft echo of the same note a beat and a half later.
        if (rand() < 0.4)
          events.push({ voice: "pluck", midi, at: at + 1.5, dur: 2.6, gain: gain * 0.35 });
        last = slot;
        played++;
      }
    }

    // A high chime at the start of some four-bar groups (never while cutting).
    if (inCycle === 0 && set.bells > 0 && rand() < set.bells * 0.5) {
      const high = pool.filter((m) => m >= 84);
      const m = high[Math.floor(rand() * high.length)];
      if (m !== undefined)
        events.push({ voice: "bell", midi: m, at: rand() < 0.5 ? 0 : 0.5, dur: 5, gain: 0.03 });
    }

    return { bar, bpm: set.bpm, beats: 4, key: this.key, degree, chord, events };
  }
}
