/**
 * AUDIO_MANAGER — tiny Web Audio synthesis, no bundled audio files.
 *
 * Respects the platform's audio state (Bridge `platform.isAudioEnabled` /
 * AUDIO_STATE_CHANGED, via PlayablesSDK `isAudioEnabled` / `onAudioEnabledChange`) —
 * it never assumes browser audio state on its own. The Settings screen's
 * Sound toggle feeds `setUserSoundEnabled`; both gates must be open for
 * anything to actually play.
 */
import { isAdActive, isAudioEnabled, onAdActiveChange, onAudioEnabledChange } from "./PlayablesSDK";
import { PauseManager } from "./PauseManager";
import { INGREDIENTS, PLATING, type IngredientId } from "./definitions";

type AudioContextCtor = typeof AudioContext;

function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

class AudioManagerImpl {
  private ctx: AudioContext | null = null;
  private contextResumePending: Promise<void> | null = null;
  private platformEnabled = true;
  private userSoundEnabled = true;
  private initialized = false;

  private init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.platformEnabled = isAudioEnabled();
    onAudioEnabledChange((enabled) => {
      this.platformEnabled = enabled;
      this.updateMusic();
    });
    PauseManager.subscribe(() => this.updateMusic());
    onAdActiveChange(() => this.updateMusic());
    if (typeof window !== "undefined") {
      const onGesture = () => {
        this.gestured = true;
        window.removeEventListener("pointerdown", onGesture, true);
        window.removeEventListener("keydown", onGesture, true);
        this.updateMusic();
      };
      window.addEventListener("pointerdown", onGesture, true);
      window.addEventListener("keydown", onGesture, true);
    }
  }

  setUserSoundEnabled(enabled: boolean): void {
    this.userSoundEnabled = enabled;
  }

  /** Whether sound may play right now (platform audio, the Sound setting, not paused, no ad). Media elements outside Web Audio — the cooking clip — follow the same rule. */
  get soundAllowed(): boolean {
    return this.enabled;
  }

  private get enabled(): boolean {
    this.init();
    // The platform's audio state AND the player's Sound toggle must both allow
    // it, and nothing plays while the game is paused (in-game or by the
    // platform — a hidden page is the platform's pause), or while an ad is on screen.
    return this.userSoundEnabled && this.audible;
  }

  /** Everything but the player's own toggles: the platform's audio, its pause, an ad. */
  private get audible(): boolean {
    this.init();
    return this.platformEnabled && !PauseManager.isPaused() && !isAdActive();
  }

  // ── Buses (W3, developer 2026-10-12): every effect goes through sfxGain and the
  // music through musicGain, so both can fade as a whole. ──────────────────
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxOut(ctx: AudioContext): GainNode {
    if (!this.sfxGain) {
      this.sfxGain = ctx.createGain();
      this.sfxGain.connect(ctx.destination);
    }
    return this.sfxGain;
  }

  /**
   * A short named game-world sound (synthesized, no files). Same gate as the
   * cutting sounds: platform audio, the Sound toggle, not paused, no ad, page
   * visible. At most one of each name per SFX_MIN_GAP_MS.
   */
  playSfx(name: SfxName): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (nowMs - (this.lastSfxAt[name] ?? -Infinity) < SFX_MIN_GAP_MS) return;
    this.lastSfxAt[name] = nowMs;
    this.sfxCount++;
    const t = ctx.currentTime;
    const out = this.sfxOut(ctx);
    for (const n of SFX[name]) {
      const start = t + (n.at ?? 0);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(n.gain, start + (n.attack ?? 0.01));
      g.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
      const lp = ctx.createBiquadFilter();
      lp.type = n.noise ? "bandpass" : "lowpass";
      lp.frequency.value = n.filter ?? 2400;
      if (n.noise) {
        const src = this.noiseSource(ctx);
        src.connect(lp).connect(g).connect(out);
        src.start(start);
        src.stop(start + n.dur + 0.02);
      } else {
        const osc = ctx.createOscillator();
        osc.type = n.wave ?? "sine";
        osc.frequency.setValueAtTime(n.freq, start);
        if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, start + n.dur);
        osc.connect(lp).connect(g).connect(out);
        osc.start(start);
        osc.stop(start + n.dur + 0.02);
      }
    }
  }
  private lastSfxAt: Partial<Record<SfxName, number>> = {};
  /** Effects played so far (tests read it to check a sound is wired). */
  sfxCount = 0;

  // ── Music: a warm kitchen-jazz loop, scheduled Web Audio notes, seeded ──
  private userMusicEnabled = true;
  private mood: MusicMood = "off";
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextBarAt = 0;
  private bar = 0;
  private musicRand = seededRand(20261012);
  /** A user gesture has happened (browsers block audio before one; music never starts before it). */
  private gestured = false;
  /** Music loops started (one at most is ever running — tests read it). */
  musicLoopsStarted = 0;

  setUserMusicEnabled(enabled: boolean): void {
    this.userMusicEnabled = enabled;
    this.updateMusic();
  }

  /** What the music should be now: the Kitchen and menus, ducked while cutting, calmer at night, or off. */
  setMusicMood(mood: MusicMood): void {
    if (this.mood === mood) return;
    this.mood = mood;
    this.updateMusic();
  }

  get musicPlaying(): boolean {
    return this.musicTimer !== null;
  }

  private musicWanted(): boolean {
    return this.gestured && this.userMusicEnabled && this.mood !== "off" && this.audible;
  }

  /** Starts the one loop, fades the bus to the mood's level, or fades out and stops. */
  private updateMusic(): void {
    if (typeof window === "undefined") return;
    const ctx = this.musicWanted() ? this.ensureContext() : this.ctx;
    if (!ctx) return;
    if (!this.musicGain) {
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = 0.0001;
      this.musicGain.connect(ctx.destination);
    }
    const t = ctx.currentTime;
    const level = this.musicWanted() ? MUSIC_LEVEL[this.mood] : 0.0001;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(level, t, 0.35);
    if (this.musicWanted() && !this.musicTimer) {
      this.musicLoopsStarted++;
      this.nextBarAt = t + 0.1;
      this.musicTimer = setInterval(() => this.scheduleMusic(), 200);
    } else if (!this.musicWanted() && this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** Schedules the bars that start within the next ~0.6 s (one interval, never two). */
  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    if (!this.musicWanted()) return this.updateMusic();
    while (this.nextBarAt < ctx.currentTime + 0.6) {
      this.playBar(ctx, this.nextBarAt);
      const bpm = this.mood === "night" ? 72 : 92;
      this.nextBarAt += (60 / bpm) * 4;
      this.bar++;
    }
  }

  private playBar(ctx: AudioContext, t: number): void {
    const out = this.musicGain!;
    const night = this.mood === "night";
    const beat = 60 / (night ? 72 : 92);
    const prog = PROGRESSIONS[Math.floor(this.bar / 4) % PROGRESSIONS.length]!;
    const chord = prog[this.bar % 4]!;
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    // Electric-piano chord: soft sines with a slow fade, on 1 (and a push on the "and" of 2).
    const hits = night ? [0] : [0, 1.5 + (this.musicRand() < 0.5 ? 0 : 1)];
    for (const at of hits) {
      for (const m of chord.slice(1)) {
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = hz(m) * (1 + (this.musicRand() - 0.5) * 0.002);
        const g = ctx.createGain();
        const s0 = t + at * beat;
        g.gain.setValueAtTime(0.0001, s0);
        g.gain.exponentialRampToValueAtTime(0.05, s0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s0 + beat * (night ? 3.6 : 1.8));
        osc.connect(g).connect(out);
        osc.start(s0);
        osc.stop(s0 + beat * (night ? 3.7 : 1.9));
      }
    }
    // Walking bass: a chord tone on each beat (half notes at night).
    const steps = night ? [0, 2] : [0, 1, 2, 3];
    for (const b of steps) {
      const tones = [chord[0]!, chord[0]! + 7, chord[1]! - 12, chord[0]! + 5];
      const m = b === 0 ? chord[0]! : tones[Math.floor(this.musicRand() * tones.length)]!;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = hz(m - 12);
      const g = ctx.createGain();
      const s0 = t + b * beat;
      g.gain.setValueAtTime(0.0001, s0);
      g.gain.exponentialRampToValueAtTime(0.09, s0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s0 + beat * (night ? 1.9 : 0.9));
      osc.connect(g).connect(out);
      osc.start(s0);
      osc.stop(s0 + beat * (night ? 2 : 1));
    }
    // Brushes on 2 and 4 (not at night).
    if (!night) {
      for (const b of [1, 3]) {
        const src = this.noiseSource(ctx);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 5200;
        const g = ctx.createGain();
        const s0 = t + b * beat;
        g.gain.setValueAtTime(0.0001, s0);
        g.gain.exponentialRampToValueAtTime(0.02, s0 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, s0 + 0.22);
        src.connect(bp).connect(g).connect(out);
        src.start(s0);
        src.stop(s0 + 0.25);
      }
    }
  }

  private ensureContext(): AudioContext | null {
    // Effects can be requested by React effects while the game is mounting.
    // Don't even construct an AudioContext until a real player gesture has
    // unlocked browser audio; browsers otherwise log autoplay-policy errors.
    if (!this.gestured) return null;

    const Ctor = resolveAudioContextCtor();
    if (!Ctor) return null;

    try {
      if (this.ctx?.state === "closed") {
        this.ctx = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.sharedNoise = null;
      }
      if (!this.ctx) this.ctx = new Ctor();

      const ctx = this.ctx;
      if (ctx.state === "suspended") {
        // resume() is asynchronous. Wait for it before scheduling nodes, and
        // share the request so overlapping SFX/music updates don't spam it.
        if (!this.contextResumePending) {
          this.contextResumePending = ctx
            .resume()
            .then(() => {
              this.contextResumePending = null;
              if (this.ctx === ctx && ctx.state === "running") this.updateMusic();
            })
            .catch(() => {
              this.contextResumePending = null;
            });
        }
        return null;
      }
      if (ctx.state !== "running") return null;
    } catch {
      // Audio is optional. A missing or unavailable audio device must not
      // break the game screen.
      return null;
    }
    return this.ctx;
  }

  /** One shared raw-noise buffer, reused as the source for every noise-based voice below (knifecraft.html's `noise()`). */
  private sharedNoise: AudioBuffer | null = null;
  private noiseSource(ctx: AudioContext): AudioBufferSourceNode {
    if (!this.sharedNoise) {
      const length = Math.max(1, Math.floor(ctx.sampleRate * 0.6));
      this.sharedNoise = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = this.sharedNoise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.sharedNoise;
    return src;
  }

  /** ±3% pitch/gain jitter so repeated cuts never sound cloned (knifecraft.html AUDIO_JITTER). */
  private jitter(): number {
    return 1 + (Math.random() * 2 - 1) * 0.03;
  }

  /**
   * The active ingredient's cutting sound — ported three-voice synthesis
   * from the Phase 1 reference (knifecraft.html sliceCut(), driven by
   * whichever CONFIG.INGREDIENTS.<id>.audio profile is active): a
   * bandpass noise transient (the break), a filtered noise swell over the
   * cut's duration (the body), and a pitch-dropping sine at the board
   * contact (the thunk). `vel` is 0..1 stroke speed; `durMs` is the
   * reveal duration this cut is playing out over.
   *
   * `pitchMult`/`gainMult` (Phase 8, default 1) are the EQUIPPED KNIFE's
   * own subtle audio identity (KnifeAudioProfile) — layered ON TOP of the
   * ingredient's own profile (`A` below), never replacing it: think
   * "ingredient sound x knife sound", not a second competing voice. Kept
   * close to 1.0 by every knife definition so the difference stays subtle.
   */
  playIngredientSlice(
    ingredientId: IngredientId,
    vel: number,
    durMs: number,
    pitchMult = 1,
    gainMult = 1,
  ): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const A = INGREDIENTS[ingredientId].audio;
    const v = Math.max(0, Math.min(1, vel));
    const t0 = ctx.currentTime;

    {
      // the break: skin, snap or crack — brighter and sharper when fast
      const src = this.noiseSource(ctx);
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value =
        (A.filterMin + (A.filterMax - A.filterMin) * v) * this.jitter() * pitchMult;
      bp.Q.value = A.transQ;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(
        (A.transPeak + A.transVel * v) * this.jitter() * gainMult,
        t0 + (v > 0.5 ? A.atkFast : A.atkSlow),
      );
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + A.transDecay);
      src.connect(bp).connect(g).connect(this.sfxOut(ctx));
      src.start(t0);
      src.stop(t0 + A.transDecay + 0.02);
    }
    {
      // the body: a swell over the cut — lowpass reads wet, the tail carries the moisture
      const tail = (A.tailMs * (1.5 - A.tailVel * v)) / 1000;
      const dur = durMs / 1000 + tail;
      const src = this.noiseSource(ctx);
      const f = ctx.createBiquadFilter();
      f.type = A.glideType;
      f.frequency.value = (A.glideMin + A.glideSpan * v) * this.jitter() * pitchMult;
      f.Q.value = A.glideQ;
      const g = ctx.createGain();
      const peak = (A.glidePeak + A.glideVel * (1 - v)) * this.jitter() * gainMult;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
      g.gain.setValueAtTime(peak, t0 + Math.max(0.02, (durMs / 1000) * 0.7));
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(this.sfxOut(ctx));
      src.start(t0);
      src.stop(t0 + dur + 0.02);
    }
    {
      // board contact at reveal completion: pitch + volume by impact speed
      const tb = t0 + durMs / 1000;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(A.thunkHz * this.jitter() * (0.92 + 0.16 * v) * pitchMult, tb);
      o.frequency.exponentialRampToValueAtTime(A.thunkDrop * pitchMult, tb + 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(A.thunkGain * (0.45 + A.thunkVel * v) * this.jitter() * gainMult, tb);
      g.gain.exponentialRampToValueAtTime(0.001, tb + 0.09);
      o.connect(g).connect(this.sfxOut(ctx));
      o.start(tb);
      o.stop(tb + 0.1);
    }
  }

  /** When the last plate sound started (ms, performance clock) — the throttle. */
  private lastPlateChimeAt = -Infinity;

  /**
   * A piece settling on the plate (developer 2026-10-09: the old bright,
   * climbing chime with a ceramic tick was "very annoying" — make it
   * soothing). Now a soft, low sine note with a gentle swell and a long,
   * warm fade (low-passed), plus a muffled low "set down" instead of the
   * high click; quiet, and at most one every CHIME_MIN_GAP_MS however many
   * pieces land. The notes walk a calm pentatonic phrase and repeat
   * (`index` is the piece's position in the plating order).
   */
  playPlateChime(index: number): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (nowMs - this.lastPlateChimeAt < PLATING.CHIME_MIN_GAP_MS) return;
    this.lastPlateChimeAt = nowMs;
    const t = ctx.currentTime;
    const ladder = PLATING.CHIME_LADDER;
    const freq = ladder[index % ladder.length]! * (0.995 + Math.random() * 0.01);
    const gain = 0.055;

    // the note: a pure tone, soft swell, slow warm fade
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(lp).connect(g).connect(this.sfxOut(ctx));
    osc.start(t);
    osc.stop(t + 0.75);

    // the plate meeting the counter: a muffled, low touch — no high tick
    const src = this.noiseSource(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "lowpass";
    bp.frequency.value = 650;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(gain * 0.35, t + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(bp).connect(ng).connect(this.sfxOut(ctx));
    src.start(t);
    src.stop(t + 0.08);
  }

  /** Warm two-note chime — recipe / order complete. */
  playChime(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const start = now + i * 0.11;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.22, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);

      osc.connect(gain).connect(this.sfxOut(ctx));
      osc.start(start);
      osc.stop(start + 0.42);
    }
  }

  /**
   * Phase 2 (A2) — the bench scraper going across the board: steel on wood.
   * A band of noise whose centre slides down as the blade travels (the
   * "shhhk" of a scrape), a quick attack, a short tail. `durMs` is clamped
   * to the shared noise buffer (0.6 s). Gated on the Sound setting like
   * every other effect.
   */
  playScrape(durMs: number): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const dur = Math.max(0.12, Math.min(0.55, durMs / 1000));
    const src = this.noiseSource(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(3200, t0);
    bp.frequency.exponentialRampToValueAtTime(1300, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.03);
    g.gain.setValueAtTime(0.09, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(this.sfxOut(ctx));
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /**
   * Cleaning (developer 2026-10-21): one stroke of a cleaning tool — a short
   * band of noise shaped by the tool: "wet" (sponge, cloth, mop) low and soft,
   * "dry" (broom) a high swish, "brush" (toilet brush, scraper) a gritty mid.
   * At most one per 85 ms. Gated on the Sound setting.
   */
  playScrub(texture: "wet" | "dry" | "brush"): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (nowMs - this.lastScrubAt < 85) return;
    this.lastScrubAt = nowMs;
    const t0 = ctx.currentTime;
    const dur = texture === "dry" ? 0.09 : 0.12;
    const [from, to, peak] =
      texture === "dry"
        ? [5200, 3800, 0.03]
        : texture === "brush"
          ? [2400, 3300, 0.04]
          : [800, 1400, 0.05];
    const src = this.noiseSource(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = texture === "wet" ? 0.9 : 1.4;
    bp.frequency.setValueAtTime(from, t0);
    bp.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(g).connect(this.sfxOut(ctx));
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }
  private lastScrubAt = -Infinity;

  /**
   * Cleaning: a stain wiped away — a glassy ping that climbs a pentatonic
   * scale with the streak (`step` 1, 2, 3…), so a run of clears rises. Gated
   * on the Sound setting.
   */
  playSparkle(step: number): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const PENTA = [1047, 1175, 1319, 1568, 1760];
    const i = Math.max(0, step - 1);
    const freq = PENTA[i % 5]! * 2 ** Math.min(1, Math.floor(i / 5));
    const t0 = ctx.currentTime;
    for (const [mult, gain, dur] of [
      [1, 0.045, 0.28],
      [2, 0.012, 0.18],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = mult === 1 ? "sine" : "triangle";
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.sfxOut(ctx));
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    }
  }

  /** Cleaning: the room is spotless — a quick rising sparkle run and a soft bell. Gated on the Sound setting. */
  playSpotless(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [1047, 1319, 1568, 2093, 2637].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t0 + i * 0.055;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.045, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      osc.connect(g).connect(this.sfxOut(ctx));
      osc.start(start);
      osc.stop(start + 0.32);
    });
    const bell = ctx.createOscillator();
    bell.type = "sine";
    bell.frequency.value = 3136;
    const bg = ctx.createGain();
    const bs = t0 + 0.3;
    bg.gain.setValueAtTime(0.0001, bs);
    bg.gain.exponentialRampToValueAtTime(0.03, bs + 0.01);
    bg.gain.exponentialRampToValueAtTime(0.0001, bs + 1);
    bell.connect(bg).connect(this.sfxOut(ctx));
    bell.start(bs);
    bell.stop(bs + 1.05);
  }

  /**
   * Phase 2 (C3) — a customer tip: a quiet rising triad (C6 E6 G6), set
   * apart from the coin and till sounds. Its own method like the other
   * Phase 1/2 sounds, so the named SFX table stays the ten effects
   * audio-qa S1 describes. Gated on the Sound setting.
   */
  playTip(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (const [i, freq] of [1047, 1319, 1568].entries()) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t0 + i * 0.08;
      const dur = i === 2 ? 0.32 : 0.16;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(i === 2 ? 0.04 : 0.035, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(g).connect(this.sfxOut(ctx));
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
  }

  /**
   * Phase 3 (A) — Fever lights: a quick rising run of four warm notes and a
   * soft shimmer under them. Quieter than the perfect-slice chime's peak;
   * gated on the Sound setting.
   */
  playFeverStart(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t0 + i * 0.06;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.08, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.26);
      osc.connect(g).connect(this.sfxOut(ctx));
      osc.start(start);
      osc.stop(start + 0.28);
    });
    const src = this.noiseSource(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 6000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.025, t0 + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
    src.connect(bp).connect(g).connect(this.sfxOut(ctx));
    src.start(t0);
    src.stop(t0 + 0.47);
  }

  /** Phase 3 (A) — Fever ends: the same notes falling, softer — "well done", not "stop". */
  playFeverEnd(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    [1047, 784, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      const start = t0 + i * 0.07;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.06, start + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.32);
      osc.connect(g).connect(this.sfxOut(ctx));
      osc.start(start);
      osc.stop(start + 0.34);
    });
  }

  /**
   * Phase 1 — a combo milestone ("Clean x5!"). A short two-note rise
   * whose root steps up with the milestone index, so the 10th reads as
   * better earned than the 5th. `index` is 0-based and clamped, so the
   * ramp can never climb into a harsh register however many milestones
   * COMBO.MILESTONES grows to. Quieter than playChime() on purpose:
   * this fires several times per ingredient, the perfect-slice chime
   * fires at most once.
   */
  playComboMilestone(index: number): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const step = Math.max(0, Math.min(4, Math.floor(index)));
    const root = 523 * Math.pow(2, step / 12); // up one semitone per milestone, 4 max
    const now = ctx.currentTime;
    for (const [i, freq] of [root, root * 1.5].entries()) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = now + i * 0.07;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.1, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(this.sfxOut(ctx));
      osc.start(start);
      osc.stop(start + 0.24);
    }
  }

  /**
   * Phase 1 — an ingredient's required cuts are all done. A soft settled
   * major third, warmer and lower than playChime()'s perfect-slice
   * sparkle so the two never read as the same event: this one says
   * "that's prepped", not "that was a great cut".
   */
  playIngredientComplete(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const [i, freq] of [440, 554, 659].entries()) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      const start = now + i * 0.05;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(this.sfxOut(ctx));
      osc.start(start);
      osc.stop(start + 0.52);
    }
  }
}

export type MusicMood = "off" | "kitchen" | "cutting" | "night";
/** The music bus level per mood (quiet; ducked while cutting). */
const MUSIC_LEVEL: Record<MusicMood, number> = {
  off: 0.0001,
  kitchen: 0.5,
  cutting: 0.18,
  night: 0.4,
};

/** ii–V–I kitchen-jazz progressions (MIDI: [bass root, chord tones…]), four bars each. */
const PROGRESSIONS: readonly (readonly (readonly number[])[])[] = [
  [
    [50, 65, 69, 72, 76],
    [43, 65, 69, 71, 74],
    [48, 64, 67, 71, 74],
    [48, 64, 67, 71, 74],
  ],
  [
    [45, 64, 67, 72, 76],
    [50, 65, 69, 72, 74],
    [43, 65, 67, 71, 74],
    [48, 64, 67, 72, 76],
  ],
  [
    [53, 64, 69, 72, 76],
    [52, 62, 67, 71, 74],
    [50, 65, 69, 72, 77],
    [43, 65, 67, 71, 74],
  ],
  [
    [48, 64, 67, 71, 76],
    [45, 64, 67, 72, 76],
    [50, 65, 69, 72, 76],
    [43, 62, 65, 71, 74],
  ],
];

/** A small seeded generator (Park–Miller) — the music's choices are reproducible. */
function seededRand(seed: number): () => number {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export type SfxName =
  | "tap"
  | "coin"
  | "till"
  | "bell"
  | "plate"
  | "delivery"
  | "lightsOff"
  | "squeak"
  | "levelComplete"
  | "story";

type SfxNote = {
  freq: number;
  to?: number;
  dur: number;
  gain: number;
  at?: number;
  attack?: number;
  wave?: OscillatorType;
  noise?: boolean;
  filter?: number;
};

/** The named sounds: short, quiet, warm (W3, developer 2026-10-12). */
export const SFX: Record<SfxName, readonly SfxNote[]> = {
  tap: [{ freq: 0, dur: 0.05, gain: 0.05, noise: true, filter: 1800, attack: 0.003 }],
  coin: [
    { freq: 1318, dur: 0.18, gain: 0.05, wave: "triangle" },
    { freq: 1760, dur: 0.3, gain: 0.05, at: 0.07, wave: "triangle" },
  ],
  till: [
    { freq: 0, dur: 0.06, gain: 0.05, noise: true, filter: 3000, attack: 0.003 },
    { freq: 2093, dur: 0.45, gain: 0.04, at: 0.05, wave: "sine", filter: 5000 },
  ],
  bell: [
    { freq: 1568, dur: 0.9, gain: 0.05, wave: "sine", filter: 6000 },
    { freq: 3136, dur: 0.5, gain: 0.015, wave: "sine", filter: 7000 },
  ],
  plate: [{ freq: 0, dur: 0.08, gain: 0.05, noise: true, filter: 650, attack: 0.006 }],
  delivery: [
    { freq: 0, dur: 0.08, gain: 0.07, noise: true, filter: 420, attack: 0.004 },
    { freq: 0, dur: 0.08, gain: 0.07, noise: true, filter: 420, attack: 0.004, at: 0.18 },
  ],
  lightsOff: [
    { freq: 0, dur: 0.04, gain: 0.06, noise: true, filter: 2500, attack: 0.002 },
    { freq: 196, to: 98, dur: 0.6, gain: 0.04, at: 0.06, wave: "sine", filter: 800 },
  ],
  squeak: [{ freq: 1800, to: 2600, dur: 0.12, gain: 0.025, wave: "triangle", filter: 4000 }],
  levelComplete: [
    { freq: 523, dur: 0.25, gain: 0.06, wave: "triangle" },
    { freq: 659, dur: 0.25, gain: 0.06, at: 0.12, wave: "triangle" },
    { freq: 784, dur: 0.55, gain: 0.07, at: 0.24, wave: "triangle" },
  ],
  story: [
    { freq: 392, dur: 1.6, gain: 0.04, attack: 0.4, wave: "sine", filter: 1500 },
    { freq: 494, dur: 1.6, gain: 0.03, attack: 0.5, at: 0.1, wave: "sine", filter: 1500 },
    { freq: 587, dur: 1.8, gain: 0.03, attack: 0.6, at: 0.2, wave: "sine", filter: 1500 },
  ],
};
const SFX_MIN_GAP_MS = 60;

/** Single shared instance — import this, never instantiate the class yourself. */
export const AudioManager = new AudioManagerImpl();
