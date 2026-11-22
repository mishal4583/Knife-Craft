/**
 * AUDIO_MANAGER — the game's sound, played from RECORDED files (public/audio/*.mp3, built by scripts/make-audio-assets.py from CC0 recordings, credits in
 * docs/AUDIO-CREDITS.md).
 *
 * RULE CHANGE (developer 2026-11-19, Playgama 3.3.2): until now every sound and all the music were synthesized in code ("tiny Web Audio synthesis, no bundled
 * audio files"). Playgama does not accept that ("sound synthesized in code, such as procedural Web Audio tones, is not accepted"): sound must be recorded or
 * made with audio tools and shipped as compressed files. Nothing here makes a sound any more: no oscillator, no generated noise. The Web Audio API only
 * plays the files, through gain and filter nodes: a recording is played at a different speed to change its pitch (a sampler: the chimes and the pings
 * are one recorded note each, played at the note the game wants), and a few ingredients darken a cut with a low-pass filter.
 *
 * Respects the platform's audio state (Bridge `platform.isAudioEnabled` / AUDIO_STATE_CHANGED, via PlayablesSDK `isAudioEnabled` / `onAudioEnabledChange`) —
 * it never assumes browser audio state on its own. The Settings screen's Sound toggle feeds `setUserSoundEnabled`; both gates must be open for anything to
 * actually play. The files are small, fetched from the game's own folder (never from outside) and decoded once, after the first tap; a sound asked for before
 * its file is decoded is skipped, never queued.
 */
import { isAdActive, isAudioEnabled, onAdActiveChange, onAudioEnabledChange } from "./PlayablesSDK";
import { PauseManager } from "./PauseManager";
import { INGREDIENTS, PLATING, type IngredientId } from "./definitions";
import { CUT_FAMILY, CUT_FILES, STROKE_FAMILIES } from "./audio/cutSounds";
import { AUDIO_FILES, type AudioId } from "./audio/audioFiles";

type AudioContextCtor = typeof AudioContext;

function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** The game's own folder, relative like every other file (the build's base is "./"). */
function baseUrl(): string {
  try {
    return (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "./";
  } catch {
    return "./";
  }
}

export type MoodName = "loading" | "kitchen" | "cutting" | "night";

/** The recorded note a tonal sound is played from: each is one recording, played faster or slower to reach the note the game wants. */
const MELODIC_VOICES = ["chime", "chime2", "bell", "glass"] as const;

/** One part of a named sound: a recording (`id`) or a note (`hz`, played from the nearest recorded voice), `at` seconds in, at `gain`. */
export type Part =
  | { id: AudioId; at?: number; gain?: number; rate?: number }
  | { hz: number; at?: number; gain?: number };

const note = (hz: number, at: number, gain: number): Part => ({ hz, at, gain });

/** The looped, recorded beds that follow a cleaning hand (`wash-<kind>`), and how loud each gets at full speed (all soft: it is a background of the touch). */
export type WashKind = "wipe" | "scrub" | "rinse" | "mop" | "sweep" | "scrape" | "brush" | "glass";
const WASH_PEAK: Record<WashKind, number> = {
  wipe: 0.5,
  scrub: 0.45,
  rinse: 0.4,
  mop: 0.5,
  sweep: 0.5,
  scrape: 0.42,
  brush: 0.45,
  glass: 0.5,
};

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
    // The page may already have had a tap (the portal's Play button, a tap while loading): then the browser lets audio start now, so the
    // loading music can play. Without it nothing starts before the first real tap (and no autoplay warning is ever logged).
    try {
      if (typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive)
        this.gestured = true;
    } catch {
      /* optional */
    }
    onAudioEnabledChange((enabled) => {
      this.platformEnabled = enabled;
      this.updateMusic();
    });
    PauseManager.subscribe(() => this.updateMusic());
    onAdActiveChange(() => this.updateMusic());
    if (typeof window !== "undefined") {
      // iPhone Safari only lets audio start (or restart after a call, a lock
      // or a tab switch) from a touchend / click, so the listeners stay on for
      // the whole session: every tap re-unlocks the context if it was stopped.
      // Not the Page Visibility API (preflight) — pageshow / focus only.
      const onGesture = (e?: Event) => this.unlockFromGesture(e?.type);
      for (const type of ["pointerdown", "pointerup", "touchstart", "touchend", "click", "keydown"])
        window.addEventListener(type, onGesture, true);
      for (const type of ["pageshow", "focus"])
        window.addEventListener(type, () => this.recoverContext(), true);
    }
    try {
      // Safari 16.4+: play as media, so the iPhone's silent switch doesn't mute Web Audio.
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
    } catch {
      /* optional */
    }
  }

  /** A real tap: unlock, create or resume the context inside the gesture (iOS needs that), then the music. */
  private unlockFromGesture(eventType?: string): void {
    this.gestured = true;
    const was = this.ctx?.state;
    // iPhone Safari (developer 2026-11-11: "no sounds in Safari mobile except the videos"): it counts only touchend / click / keydown as the tap that may start audio.
    // A resume() asked from a pointerdown / touchstart never settles there, and the shared pending promise then blocked every later, valid ask. So a real
    // activation drops a stale pending ask, asks again itself, and plays one silent sample (the classic unlock) so the output really opens.
    const real =
      eventType === "touchend" ||
      eventType === "click" ||
      eventType === "keydown" ||
      eventType === "pointerup";
    if (real && this.ctx && this.ctx.state !== "running") this.contextResumePending = null;
    const ctx = this.ensureContext() ?? this.ctx;
    if (real && ctx) this.primeOutput(ctx);
    if (was !== "running") this.updateMusic();
  }

  /** One silent sample through the output, started inside a real tap: iOS opens the audio output on it. */
  private primed: AudioContext | null = null;
  private primeOutput(ctx: AudioContext): void {
    if (this.primed === ctx) return;
    try {
      if (ctx.state !== "running") void ctx.resume().catch(() => undefined);
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
      this.primed = ctx;
    } catch {
      /* optional */
    }
  }

  /** The page came back: try to wake a stopped context (a tap does it if the browser refuses here). */
  private recoverContext(): void {
    if (!this.gestured || !this.ctx || this.ctx.state === "running") return;
    this.ensureContext();
  }

  setUserSoundEnabled(enabled: boolean): void {
    this.userSoundEnabled = enabled;
    // Turning Sound on is a tap: it also wakes a context the system stopped.
    if (enabled && this.gestured) this.unlockFromGesture();
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

  // ── The recordings: fetched from the game's own folder, decoded once, kept ──
  private buffers = new Map<AudioId, AudioBuffer>();
  private loading = new Map<AudioId, Promise<AudioBuffer | null>>();

  /** Fetches and decodes one recording (once). Resolves null when it cannot be read: a missing sound never breaks the game. */
  private load(id: AudioId): Promise<AudioBuffer | null> {
    const have = this.buffers.get(id);
    if (have) return Promise.resolve(have);
    const pending = this.loading.get(id);
    if (pending) return pending;
    const ctx = this.ctx;
    if (!ctx || typeof fetch !== "function") return Promise.resolve(null);
    const url = `${baseUrl()}${AUDIO_FILES[id].file}`;
    const job = fetch(url)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`))))
      .then(
        (bytes) =>
          // the callback form: older Safari has no promise-returning decodeAudioData
          new Promise<AudioBuffer | null>((resolve) => {
            try {
              const done = ctx.decodeAudioData(bytes, resolve, () => resolve(null));
              if (done && typeof (done as Promise<AudioBuffer>).then === "function")
                (done as Promise<AudioBuffer>).then(resolve, () => resolve(null));
            } catch {
              resolve(null);
            }
          }),
      )
      .catch(() => null)
      .then((buffer) => {
        this.loading.delete(id);
        if (buffer) this.buffers.set(id, buffer);
        return buffer;
      });
    this.loading.set(id, job);
    return job;
  }

  /** Every effect (not the music, not the washing beds) is small: all of them are fetched right after the first tap. */
  private preloaded = false;
  private preloadEffects(): void {
    if (this.preloaded) return;
    this.preloaded = true;
    for (const id of Object.keys(AUDIO_FILES) as AudioId[]) {
      if (id.startsWith("music-") || id.startsWith("wash-")) continue;
      void this.load(id);
    }
  }

  /**
   * Plays a recording: `rate` changes its speed (and so its pitch), `at` delays it, `filter` darkens it, `dur` fades it out early. Returns the source
   * (or null when the file is not decoded yet: it is asked for and this sound is skipped).
   */
  private play(
    id: AudioId,
    o: {
      gain?: number | undefined;
      rate?: number | undefined;
      at?: number | undefined;
      dur?: number | undefined;
      loop?: boolean | undefined;
      out?: AudioNode | undefined;
      filter?: { type: BiquadFilterType; freq: number; q?: number } | undefined;
    } = {},
  ): { src: AudioBufferSourceNode; gain: GainNode } | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const buffer = this.buffers.get(id);
    if (!buffer) {
      void this.load(id);
      return null;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    if (o.rate && o.rate !== 1) src.playbackRate.value = o.rate;
    if (o.loop) src.loop = true;
    let tail: AudioNode = src;
    if (o.filter) {
      const f = ctx.createBiquadFilter();
      f.type = o.filter.type;
      f.frequency.value = o.filter.freq;
      f.Q.value = o.filter.q ?? 0.7;
      tail.connect(f);
      tail = f;
    }
    const g = ctx.createGain();
    g.gain.value = o.gain ?? 1;
    tail.connect(g);
    g.connect(o.out ?? this.sfxOut(ctx));
    const t = ctx.currentTime + (o.at ?? 0);
    src.start(t);
    if (o.dur) {
      g.gain.setValueAtTime(o.gain ?? 1, t + Math.max(0, o.dur - 0.04));
      g.gain.linearRampToValueAtTime(0.0001, t + o.dur);
      src.stop(t + o.dur + 0.02);
    }
    return { src, gain: g };
  }

  /** Plays the parts of a sound together. A note is played from the recorded voice whose pitch is nearest to it. */
  private playParts(parts: readonly Part[]): void {
    for (const p of parts) {
      if ("id" in p) {
        this.play(p.id, { gain: p.gain, rate: p.rate, at: p.at });
        continue;
      }
      let best: AudioId = MELODIC_VOICES[0];
      let bestDist = Infinity;
      for (const v of MELODIC_VOICES) {
        const root = (AUDIO_FILES[v] as { rootHz?: number }).rootHz ?? 1000;
        const d = Math.abs(Math.log2(p.hz / root));
        if (d < bestDist) {
          bestDist = d;
          best = v;
        }
      }
      const root = (AUDIO_FILES[best] as { rootHz?: number }).rootHz ?? 1000;
      this.play(best, { gain: p.gain, rate: p.hz / root, at: p.at });
    }
  }

  /**
   * A short named game-world sound (a recording). Same gate as the cutting sounds: platform audio, the Sound toggle, not paused, no ad, page
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
    this.playParts(SFX[name]);
  }
  private lastSfxAt: Partial<Record<SfxName, number>> = {};
  /** Effects played so far (tests read it to check a sound is wired). */
  sfxCount = 0;

  // ── Music (developer 2026-11-19): four recorded, seamless loops, one per mood (CC0 recordings, docs/AUDIO-CREDITS.md). One loop plays at a time;
  // a new mood is crossfaded in. The earlier score was synthesized note by note in code (Playgama 3.3.2 does not accept that). ──
  private userMusicEnabled = true;
  private mood: MusicMood = "off";
  /** The track now playing (null = silence) and the one that is fading out. */
  private track: { id: AudioId; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  /** A user gesture has happened (browsers block audio before one; music never starts before it). */
  private gestured = false;
  /** Music loops started from silence (one at most is ever running — tests read it). */
  musicLoopsStarted = 0;

  setUserMusicEnabled(enabled: boolean): void {
    this.userMusicEnabled = enabled;
    this.updateMusic();
  }

  /** What the music should be now: loading, the Kitchen and menus, ducked while cutting, calmer at night, or off. */
  setMusicMood(mood: MusicMood): void {
    if (this.mood === mood) return;
    this.mood = mood;
    this.updateMusic();
  }

  get musicPlaying(): boolean {
    return this.track !== null;
  }

  /** Whether the browser has let audio start (a tap has happened): the loading screen shows its "tap for music" hint until then. */
  get unlocked(): boolean {
    this.init();
    return this.gestured;
  }

  private musicWanted(): boolean {
    return this.gestured && this.userMusicEnabled && this.mood !== "off" && this.audible;
  }

  /** The music's own fader (`musicGain`), built once per context. */
  private buildMusicChain(ctx: AudioContext): void {
    const fader = ctx.createGain();
    fader.gain.value = 0.0001;
    fader.connect(ctx.destination);
    this.musicGain = fader;
  }

  /** Starts the mood's loop (crossfading from another), fades the fader to the mood's level, or fades out and stops. */
  private updateMusic(): void {
    if (typeof window === "undefined") return;
    const wanted = this.musicWanted();
    const ctx = wanted ? this.ensureContext() : this.ctx;
    if (!ctx) return;
    if (!this.musicGain) this.buildMusicChain(ctx);
    const t = ctx.currentTime;
    const level = wanted ? MUSIC_LEVEL[this.mood] : 0.0001;
    this.musicGain!.gain.cancelScheduledValues(t);
    // A slow fade in and out: the music arrives and leaves like a breath, never with a click.
    this.musicGain!.gain.setTargetAtTime(level, t, wanted ? 0.9 : 0.35);
    if (wanted && this.mood !== "off") {
      const id = MUSIC_TRACK[this.mood];
      if (this.track?.id === id) return;
      const buffer = this.buffers.get(id);
      if (!buffer) {
        void this.load(id).then((b) => b && this.updateMusic());
        return;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(1, t + (this.track ? 2.5 : 0.05));
      src.connect(gain);
      gain.connect(this.musicGain!);
      src.start(t);
      if (!this.track) this.musicLoopsStarted++;
      else this.fadeOutTrack(this.track, 2.5);
      this.track = { id, src, gain };
    } else if (!wanted && this.track) {
      this.fadeOutTrack(this.track, 0.4);
      this.track = null;
    }
  }

  private fadeOutTrack(
    track: { src: AudioBufferSourceNode; gain: GainNode },
    seconds: number,
  ): void {
    const ctx = this.ctx;
    try {
      if (ctx) {
        track.gain.gain.cancelScheduledValues(ctx.currentTime);
        track.gain.gain.setValueAtTime(track.gain.gain.value, ctx.currentTime);
        track.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + seconds);
        track.src.stop(ctx.currentTime + seconds + 0.05);
      } else track.src.stop();
    } catch {
      /* already stopped */
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
        this.track = null;
        this.washVoice = null;
      }
      if (!this.ctx) {
        this.ctx = new Ctor();
        const fresh = this.ctx;
        try {
          // Safari 14+ reports "interrupted" / "running" changes here: wake the music the moment the output opens.
          fresh.addEventListener?.("statechange", () => {
            if (this.ctx === fresh && fresh.state === "running") {
              this.contextResumePending = null;
              this.updateMusic();
            }
          });
        } catch {
          /* optional */
        }
        this.preloadEffects();
      }

      const ctx = this.ctx;
      // "suspended", or iOS's own "interrupted" (a call, a lock, a tab switch).
      if (ctx.state !== "running") {
        // resume() is asynchronous. Wait for it before scheduling nodes, and
        // share the request so overlapping SFX/music updates don't spam it.
        if (!this.contextResumePending) {
          const ask = ctx
            .resume()
            .then(() => {
              this.contextResumePending = null;
              if (this.ctx === ctx && ctx.state === "running") this.updateMusic();
            })
            .catch(() => {
              this.contextResumePending = null;
              // A context the system won't wake is replaced on the next tap.
              if (this.ctx === ctx) {
                this.ctx = null;
                this.sfxGain = null;
                this.musicGain = null;
                // The new context's clock restarts, so the music loop starts over with it.
                this.track = null;
                this.washVoice = null;
                try {
                  void ctx.close();
                } catch {
                  /* already closed */
                }
              }
            });
          this.contextResumePending = ask;
          // A resume that never settles (iOS, when asked outside a real tap) must not block the next ask.
          setTimeout(() => {
            if (this.contextResumePending === ask) this.contextResumePending = null;
          }, 1200);
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

  /** ±3% speed/gain jitter so repeated cuts never sound cloned (knifecraft.html AUDIO_JITTER). */
  private jitter(): number {
    return 1 + (Math.random() * 2 - 1) * 0.03;
  }

  private sliceNext = 0;

  /**
   * The active ingredient's cutting sound (developer 2026-11-22): a RECORDED knife cut on a wooden board, of the family that belongs to this food
   * (`audio/cutSounds.ts`: crunchy vegetables, juicy fruit, leaves, bulbs, bread, melon, citrus, mushrooms, cheese, meat, dense roots), a different
   * recording each time. A stroke through the food (bread, melon, meat ...) ends with a real board tap when the blade lands. The ingredient's own audio
   * profile (definitions.ts `audio`) still sets how loud. `vel` is 0..1 stroke speed; `durMs` is the reveal duration this cut is playing out over.
   *
   * `pitchMult`/`gainMult` (Phase 8, default 1) are the EQUIPPED KNIFE's own subtle audio identity (KnifeAudioProfile) — layered ON TOP of the
   * ingredient's own profile, never replacing it: think "ingredient sound x knife sound", not a second competing voice.
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
    // A real recording of a knife through THIS kind of food (developer 2026-11-22), a different one each time, nearly at its own pitch: the knife's own
    // identity (`pitchMult`) and the swing's speed only lean it a little.
    const family = CUT_FAMILY[ingredientId] ?? "dense";
    const files = CUT_FILES[family];
    const id = files[this.sliceNext++ % files.length]!;
    const rate = Math.max(0.9, Math.min(1.12, (0.97 + 0.06 * v) * pitchMult * this.jitter()));
    const gain =
      Math.max(0.25, Math.min(0.85, (0.45 + 0.8 * (A.transPeak + A.transVel * v)) * 0.8)) *
      gainMult *
      this.jitter();
    this.play(id, { gain, rate });
    // A stroke through the food (bread, melon, meat ...) ends with the blade meeting the board: a real board tap, by the swing's speed.
    if (STROKE_FAMILIES.has(family)) {
      this.play("boardtap", {
        at: durMs / 1000,
        gain: Math.min(0.7, A.thunkGain * (0.45 + A.thunkVel * v) * 1.3) * gainMult,
        rate: Math.max(0.85, Math.min(1.15, (0.95 + 0.1 * v) * pitchMult)),
      });
    }
  }

  /** When the last plate sound started (ms, performance clock) — the throttle. */
  private lastPlateChimeAt = -Infinity;

  /**
   * A piece settling on the plate (developer 2026-10-09: the old bright, climbing chime with a ceramic tick was "very annoying" — make it soothing):
   * one soft, low note and a muffled set-down; quiet, and at most one every CHIME_MIN_GAP_MS however many pieces land. The notes walk a calm
   * pentatonic phrase and repeat (`index` is the piece's position in the plating order).
   */
  playPlateChime(index: number): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (nowMs - this.lastPlateChimeAt < PLATING.CHIME_MIN_GAP_MS) return;
    this.lastPlateChimeAt = nowMs;
    const ladder = PLATING.CHIME_LADDER;
    const hz = ladder[index % ladder.length]! * (0.995 + Math.random() * 0.01);
    this.playParts([note(hz, 0, 0.3), { id: "plate", gain: 0.16 }]);
  }

  /** Warm two-note chime — recipe / order complete. */
  playChime(): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    this.playParts([note(660, 0, 0.45), note(880, 0.11, 0.45)]);
  }

  /**
   * Phase 2 (A2) — the bench scraper going across the board: steel on wood, a recorded scrape. `durMs` shortens it.
   */
  playScrape(durMs: number): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    const dur = Math.max(0.12, Math.min(0.55, durMs / 1000));
    this.play("scrape", { gain: 0.5, dur, rate: 0.95 + Math.random() * 0.1 });
  }

  /**
   * Peeling (developer 2026-11-07, "slow and satisfying"): a recorded strip of skin coming off, one of five recordings, quicker for a narrow
   * strip. The scene rate-limits it (PEEL.SOUND_EVERY_MS); `size` (0..1) is the strip's width. Gated on the Sound setting.
   */
  playPeelRustle(size = 0.5): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    const id = `peel${1 + Math.floor(Math.random() * 5)}` as AudioId;
    this.play(id, {
      gain: 0.3 + size * 0.2,
      rate: (1.08 - size * 0.16) * this.jitter(),
      dur: 0.2 + size * 0.1,
    });
  }

  /**
   * Cleaning (developer 2026-10-21): one stroke of a cleaning tool — a short recording shaped by the tool: "wet" (sponge, cloth, mop) a cloth wipe, "dry"
   * (broom) a heavier swish, "brush" (toilet brush, scraper) a gritty scrape. At most one per 85 ms. Gated on the Sound setting.
   */
  playScrub(texture: "wet" | "dry" | "brush"): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (nowMs - this.lastScrubAt < 85) return;
    this.lastScrubAt = nowMs;
    const id = texture === "dry" ? "scrub-dry" : texture === "brush" ? "scrub-brush" : "scrub-wet";
    this.play(id, {
      gain: texture === "dry" ? 0.3 : 0.4,
      rate: this.jitter(),
      dur: texture === "dry" ? 0.2 : 0.28,
    });
  }
  private lastScrubAt = -Infinity;

  /**
   * Wiping and washing (developer 2026-11-16: the "tak tak" of `playScrub` is replaced by a smooth wipe; developer 2026-11-22: no pings, no bubbles, no
   * splash loop: "a more soothing sound, or a real wiping sound, that gives the player satisfaction"). While the cloth or sponge moves, ONE continuous
   * voice runs: a recorded, softened bed looped, whose loudness and speed follow the stroke. Call it on every move; it fades out by itself 170 ms after
   * the last call, so there is no tick and no stop to wire. `kind`: "wipe" is the dry-to-damp cloth over the cutting board, "scrub" the close, soapy
   * rub of the sponge, "rinse" running water; for the cleaning tools (developer 2026-11-22): "mop" a wet floor mop, "sweep" a broom's dry bristles, "scrape" a
   * scraper, "brush" the toilet brush, "glass" the cloth on the mirror. `speed` is 0..1. Gated on the Sound setting.
   */
  washStroke(kind: WashKind, speed: number): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const level = Math.max(0, Math.min(1, speed));
    let voice = this.washVoice;
    if (!voice || voice.kind !== kind) {
      this.stopWashVoice(true);
      const started = this.play(`wash-${kind}`, { gain: 0.0001, loop: true });
      if (!started) return; // the bed is still being fetched: the next stroke starts it
      voice = { kind, src: started.src, gain: started.gain, timer: 0 };
      this.washVoice = voice;
    }
    // A slow stroke is a hush, a quick one a firmer rub; the pitch leans a little with the speed, so the sound breathes with the hand.
    const peak = WASH_PEAK[kind];
    voice.gain.gain.setTargetAtTime(0.05 + peak * level, now, 0.07);
    voice.src.playbackRate.setTargetAtTime(0.94 + level * 0.14, now, 0.12);
    if (voice.timer) clearTimeout(voice.timer);
    voice.timer = setTimeout(() => this.stopWashVoice(false), 170) as unknown as number;
  }

  /** Fade the wash voice out (or cut it at once when another kind takes over) and release its nodes. */
  private stopWashVoice(now: boolean): void {
    const voice = this.washVoice;
    if (!voice) return;
    this.washVoice = null;
    if (voice.timer) clearTimeout(voice.timer);
    const ctx = this.ctx;
    const end = () => {
      try {
        voice.src.stop();
        voice.src.disconnect();
        voice.gain.disconnect();
      } catch {
        /* already stopped */
      }
    };
    if (!ctx || now) {
      end();
      return;
    }
    voice.gain.gain.cancelScheduledValues(ctx.currentTime);
    voice.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    setTimeout(end, 320);
  }
  private washVoice: {
    kind: WashKind;
    src: AudioBufferSourceNode;
    gain: GainNode;
    timer: number;
  } | null = null;

  /** Cleaning: a stain wiped away — a glassy ping that climbs a pentatonic scale with the streak (`step` 1, 2, 3…), so a run of clears rises. */
  playSparkle(step: number): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    const PENTA = [1047, 1175, 1319, 1568, 1760];
    const i = Math.max(0, step - 1);
    this.playParts([note(PENTA[i % 5]! * 2 ** Math.min(1, Math.floor(i / 5)), 0, 0.4)]);
  }

  /** Cleaning: the room is spotless — a quick rising sparkle run and a soft bell. */
  playSpotless(): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    this.playParts([
      ...[1047, 1319, 1568, 2093, 2637].map((hz, i) => note(hz, i * 0.055, 0.4)),
      note(3136, 0.3, 0.3),
    ]);
  }

  /** Phase 2 (C3) — a customer tip: a quiet rising triad (C6 E6 G6), set apart from the coin and till sounds. */
  playTip(): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    this.playParts([1047, 1319, 1568].map((hz, i) => note(hz, i * 0.08, i === 2 ? 0.4 : 0.34)));
  }

  /** Phase 3 (A) — Fever lights: a quick rising run of four warm notes and a soft shimmer over them. */
  playFeverStart(): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    this.playParts([
      ...[523, 659, 784, 1047].map((hz, i) => note(hz, i * 0.06, 0.5)),
      note(3520, 0.05, 0.12),
    ]);
  }

  /** Phase 3 (A) — Fever ends: the same notes falling, softer — "well done", not "stop". */
  playFeverEnd(): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    this.playParts([1047, 784, 659].map((hz, i) => note(hz, i * 0.07, 0.4)));
  }

  /**
   * Phase 1 — a combo milestone ("Clean x5!"). A short two-note rise whose root steps up with the milestone index, so the 10th reads as better
   * earned than the 5th. `index` is 0-based and clamped, so the ramp can never climb into a harsh register. Quieter than playChime() on purpose.
   */
  playComboMilestone(index: number): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    const step = Math.max(0, Math.min(4, Math.floor(index)));
    const root = 523 * Math.pow(2, step / 12); // up one semitone per milestone, 4 max
    this.playParts([note(root, 0, 0.45), note(root * 1.5, 0.07, 0.45)]);
  }

  /** The knife's "shing" (knifeFeel.ts, developer 2026-10-24): steel ringing after the ingredient's last cut, a recorded blade ring. Quiet, under the chord. */
  playBladeRing(): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    this.playParts([{ id: "shing", at: 0.02, gain: 0.32 }]);
  }

  /** Phase 1 — an ingredient's required cuts are all done: a soft settled major third, warmer and lower than playChime()'s sparkle. */
  playIngredientComplete(): void {
    if (!this.enabled) return;
    if (!this.ensureContext()) return;
    this.playParts([440, 554, 659].map((hz, i) => note(hz, i * 0.05, 0.32)));
  }
}

export type MusicMood = "off" | MoodName;
/** The music fader level per mood (quiet; ducked while cutting). */
const MUSIC_LEVEL: Record<MusicMood, number> = {
  off: 0.0001,
  loading: 0.8,
  kitchen: 0.9,
  cutting: 0.33,
  night: 0.75,
};
/** The recorded loop of each mood. */
const MUSIC_TRACK: Record<MoodName, AudioId> = {
  loading: "music-loading",
  kitchen: "music-kitchen",
  cutting: "music-cutting",
  night: "music-night",
};

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
  | "story"
  // Fridge Sort (developer 2026-11-03): picking a token up, the right shelf, the wrong one, a combo, the last seconds.
  | "sortPick"
  | "sortPlace"
  | "sortWrong"
  | "sortCombo"
  | "sortTick"
  | "carHorn"
  // Unload the Van (developer 2026-11-22): a crate lifted, gliding, out through its door, the rocket, the hammer, the frozen clock, Undo, a clean board, the clock running out.
  | "crateGrab"
  | "crateSlide"
  | "crateOut"
  | "crateRocket"
  | "crateSmash"
  | "crateFreeze"
  | "crateUndo"
  // Dessert Run: a waiter sent off, a cube picked off the dessert, dropped on the cart, a guest served, all five spots busy.
  | "runSend"
  | "runPick"
  | "runDrop"
  | "runServe"
  // Sauce Station: a liquid, a spice, a jar and a chopped heap going into the bowl, the whisk turning, the bottle filling.
  | "sauceLiquid"
  | "sauceSpice"
  | "sauceJar"
  | "sauceProduce"
  | "sauceWhisk"
  | "sauceBottle"
  // the end of a mini-game round (Car Park, Dessert Run, Unload the Van): cleared, or lost.
  | "gameWin"
  | "gameLose";

/** The named sounds: short, quiet, warm (W3, developer 2026-10-12); each is recorded audio from public/audio (the notes are played from recorded voices). */
export const SFX: Record<SfxName, readonly Part[]> = {
  tap: [{ id: "tap", gain: 0.3 }],
  coin: [{ id: "coin", gain: 0.4 }],
  till: [
    { id: "tick", gain: 0.25 },
    { id: "till", at: 0.05, gain: 0.4 },
  ],
  bell: [note(1568, 0, 0.5), note(3136, 0, 0.1)],
  plate: [{ id: "plate", gain: 0.45 }],
  delivery: [
    { id: "thud", gain: 0.55 },
    { id: "plate", at: 0.18, gain: 0.55 },
  ],
  lightsOff: [
    { id: "lights", gain: 0.4 },
    { id: "bong", at: 0.06, gain: 0.5, rate: 0.7 },
  ],
  squeak: [{ id: "squeak", gain: 0.3 }],
  levelComplete: [note(523, 0, 0.5), note(659, 0.12, 0.5), note(784, 0.24, 0.6)],
  story: [{ id: "story", gain: 0.5 }],
  sortPick: [{ id: "pluck", gain: 0.35 }],
  sortPlace: [{ id: "plate", gain: 0.3 }, note(880, 0.03, 0.4)],
  sortWrong: [{ id: "wrong", gain: 0.5 }],
  sortCombo: [note(784, 0, 0.45), note(988, 0.07, 0.45), note(1319, 0.14, 0.5)],
  sortTick: [{ id: "tick", gain: 0.3 }],
  carHorn: [
    { id: "horn", gain: 0.5, rate: 0.85 },
    { id: "horn", at: 0.19, gain: 0.5, rate: 0.72 },
  ],
  // ── Unload the Van ──
  crateGrab: [{ id: "knock", gain: 0.4, rate: 0.9 }],
  crateSlide: [{ id: "slide", gain: 0.35 }],
  crateOut: [{ id: "door", gain: 0.5 }, note(988, 0.1, 0.35), note(1319, 0.17, 0.35)],
  crateRocket: [
    { id: "whoosh", gain: 0.6 },
    { id: "bell", at: 0.08, gain: 0.3, rate: 1.4 },
  ],
  crateSmash: [
    { id: "clank", gain: 0.6 },
    { id: "thud", at: 0.03, gain: 0.45, rate: 0.8 },
  ],
  crateFreeze: [note(1760, 0, 0.35), note(2349, 0.08, 0.3), note(2794, 0.16, 0.25)],
  crateUndo: [{ id: "back", gain: 0.5 }],
  // ── Dessert Run ──
  runSend: [{ id: "whoosh", gain: 0.3, rate: 0.9 }],
  runPick: [{ id: "pop", gain: 0.3, rate: 1.15 }],
  runDrop: [{ id: "beads", gain: 0.7 }],
  runServe: [{ id: "coin", gain: 0.3, rate: 1.1 }],
  // ── Sauce Station ──
  sauceLiquid: [{ id: "bottle", gain: 0.45 }],
  sauceSpice: [{ id: "beads", gain: 0.7, rate: 1.15 }],
  sauceJar: [
    { id: "pop", gain: 0.45, rate: 0.8 },
    { id: "plate", at: 0.05, gain: 0.25, rate: 0.9 },
  ],
  sauceProduce: [{ id: "plate", gain: 0.35, rate: 1.2 }],
  sauceWhisk: [{ id: "slide", gain: 0.3, rate: 1.1 }],
  sauceBottle: [{ id: "bottle", gain: 0.5, rate: 0.9 }],
  // ── a round ends ──
  gameWin: [note(523, 0, 0.5), note(659, 0.12, 0.5), note(784, 0.24, 0.5), note(1047, 0.36, 0.55)],
  gameLose: [
    { id: "wrong", gain: 0.5 },
    { id: "bong", at: 0.12, gain: 0.45, rate: 0.7 },
  ],
};
const SFX_MIN_GAP_MS = 60;

/** Single shared instance — import this, never instantiate the class yourself. */
export const AudioManager = new AudioManagerImpl();
