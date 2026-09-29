/**
 * INTRO CINEMATIC — the opening intro as one short film (≈21.4 s) over the
 * seven painted scenes in `src/assets/story/`. DATA ONLY: which image each
 * scene shows, how long it lasts, its crossfade, its camera move and its
 * subtitle lines. `CinematicIntro.tsx` plays it; `introTimeline()` below
 * turns it into the one clock the controller runs on.
 *
 *   SCENE 1  key from the grandparents   3.5 s
 *   SCENE 2  the forgotten kitchen       3.0 s
 *   SCENE 3A clean   ┐
 *   SCENE 3B repair  ├ montage          3 × 1.5 s, fast crossfades
 *   SCENE 3C restore ┘
 *   SCENE 4  the chef                    6.0 s
 *   SCENE 5  the first order             3.5 s + 0.9 s outro
 *   → the camera pushes into the tomato and the film fades into the real
 *     Level 1 underneath (never a Scene 6 image, never a loading screen).
 *
 * Roles (the core loop): the CHEF cooks and runs the orders; YOU prep/cut.
 * Times are ms from the scene's own start. Subtitles end before their
 * scene's crossfade, except the last line, which rides the outro fade.
 */

export type IntroSceneId =
  "scene1" | "scene2" | "scene3A" | "scene3B" | "scene3C" | "scene4" | "scene5";

export type CinematicSpeaker = "CHEF" | "YOU";

/** One subtitle: narration when `speaker` is absent. Visible from `at` to `until`. */
export type CinematicLine = {
  speaker?: CinematicSpeaker;
  text: string;
  at: number;
  until: number;
};

/** Scale `from` → `to` over `ms` (then hold) around `origin` (a CSS transform-origin). */
export type CinematicCamera = {
  from: number;
  to: number;
  ms: number;
  origin: string;
};

export type IntroScene = {
  id: IntroSceneId;
  /** Alt text for the painted scene. */
  alt: string;
  duration: number;
  /** Crossfade in over the previous scene (the first scene fades in from the plate). */
  crossfadeMs: number;
  camera: CinematicCamera;
  /** A faint warm light rising at the end of the shot (Scene 3B). */
  lightUp?: boolean;
  lines: CinematicLine[];
};

/** Where the tomato sits in Scene 5 (fraction of the image), measured on the artwork. */
const TOMATO_ORIGIN = "44.7% 67.8%";

export const INTRO_SCENES: IntroScene[] = [
  {
    id: "scene1",
    alt: "Your grandparents place the restaurant's key in your hand.",
    duration: 3500,
    crossfadeMs: 400,
    camera: { from: 1, to: 1.04, ms: 2500, origin: "50% 40%" },
    lines: [
      { text: "They placed the keys in your hand.", at: 300, until: 1800 },
      { text: "“Keep it alive.”", at: 1950, until: 3250 },
    ],
  },
  {
    id: "scene2",
    alt: "You step into the old, forgotten kitchen.",
    duration: 3000,
    crossfadeMs: 300,
    camera: { from: 1.03, to: 1, ms: 3000, origin: "50% 45%" },
    lines: [{ text: "The kitchen had grown quiet.", at: 400, until: 2700 }],
  },
  {
    id: "scene3A",
    alt: "You clean the dusty counters.",
    duration: 1500,
    crossfadeMs: 300,
    camera: { from: 1, to: 1.03, ms: 1500, origin: "50% 50%" },
    lines: [],
  },
  {
    id: "scene3B",
    alt: "You open the windows and repair the kitchen.",
    duration: 1500,
    crossfadeMs: 180,
    camera: { from: 1.045, to: 1, ms: 1500, origin: "40% 40%" },
    lightUp: true,
    lines: [],
  },
  {
    id: "scene3C",
    alt: "The restored kitchen, warm and ready.",
    duration: 1500,
    crossfadeMs: 180,
    // Moves for 1.1 s, then holds its final frame ~0.4 s before Scene 4.
    camera: { from: 1.03, to: 1, ms: 1100, origin: "50% 50%" },
    lines: [],
  },
  {
    id: "scene4",
    alt: "The old chef greets you across the counter.",
    duration: 6000,
    crossfadeMs: 300,
    // Starts wide and creeps toward the chef's face.
    camera: { from: 1, to: 1.03, ms: 6000, origin: "31% 35%" },
    lines: [
      { speaker: "CHEF", text: "You spent your savings on this?", at: 700, until: 2000 },
      { speaker: "YOU", text: "Every last bit.", at: 2400, until: 3100 },
      { speaker: "CHEF", text: "Then we’d better make it count.", at: 3500, until: 5500 },
    ],
  },
  {
    id: "scene5",
    alt: "The chef sets a tomato on your cutting board: your first order.",
    duration: 3500,
    crossfadeMs: 300,
    camera: { from: 1, to: 1.02, ms: 3500, origin: TOMATO_ORIGIN },
    // Each line holds until the next one replaces it (easier to read than
    // blank gaps at this pace); the last one rides the outro fade.
    lines: [
      { speaker: "CHEF", text: "I’ll handle the cooking.", at: 500, until: 1500 },
      { speaker: "CHEF", text: "You handle the prep.", at: 1500, until: 2500 },
      { speaker: "CHEF", text: "Your first order.", at: 2500, until: 3200 },
      { speaker: "CHEF", text: "Let’s get to work.", at: 3200, until: 3500 },
    ],
  },
];

/**
 * The match cut into gameplay: after Scene 5 the camera pushes into the
 * tomato and slides it to where Level 1's real tomato is (centre of the
 * frame) while the whole film fades out over the already-running level.
 */
export const INTRO_OUTRO = {
  /** Total outro length; the cinematic ends (onDone) when it's over. */
  ms: 900,
  /** The fade starts this long into the outro and runs to its end. */
  fadeDelayMs: 300,
  origin: TOMATO_ORIGIN,
  /** Final transform of Scene 5: tomato (44.7%, 67.8%) → Level 1's tomato (50%, 50.2%). */
  transform: "translate(5.3%, -17.6%) scale(2.4)",
} as const;

/** The SKIP control appears this long after the film starts. */
export const INTRO_SKIP_AFTER_MS = 1000;

/** One step of the clock: a subtitle, or the gap between subtitles. */
export type IntroStep = {
  scene: number;
  /** Index into that scene's `lines`, or null for a gap. */
  line: number | null;
  /** Absolute ms from the start of the film. */
  start: number;
  end: number;
};

export type IntroTimeline = {
  steps: IntroStep[];
  /** Absolute start of each scene. */
  sceneStarts: number[];
  /** When the outro begins (end of the last scene). */
  outroAt: number;
  /** When the film ends. */
  total: number;
};

/** Flattens the scenes into one gap/line step list on a single clock. */
export function introTimeline(scenes: IntroScene[] = INTRO_SCENES): IntroTimeline {
  const steps: IntroStep[] = [];
  const sceneStarts: number[] = [];
  let t = 0;
  scenes.forEach((scene, s) => {
    sceneStarts.push(t);
    let cursor = 0;
    scene.lines.forEach((line, l) => {
      if (line.at > cursor)
        steps.push({ scene: s, line: null, start: t + cursor, end: t + line.at });
      steps.push({ scene: s, line: l, start: t + line.at, end: t + line.until });
      cursor = line.until;
    });
    if (cursor < scene.duration)
      steps.push({ scene: s, line: null, start: t + cursor, end: t + scene.duration });
    t += scene.duration;
  });
  return { steps, sceneStarts, outroAt: t, total: t + INTRO_OUTRO.ms };
}

/** The scene showing at `elapsed` ms (the last scene during the outro). */
export function sceneAt(timeline: IntroTimeline, elapsed: number): number {
  let s = 0;
  timeline.sceneStarts.forEach((start, i) => {
    if (elapsed >= start) s = i;
  });
  return s;
}

/** The step showing at `elapsed` ms (the last step once the clock is past the scenes). */
export function stepAt(timeline: IntroTimeline, elapsed: number): number {
  const i = timeline.steps.findIndex((st) => elapsed < st.end);
  return i === -1 ? timeline.steps.length - 1 : i;
}

/**
 * Where a tap moves the clock: the start of the next subtitle or the next
 * scene, whichever comes first — one step per tap, never past the last
 * scene (only SKIP ends the film early). Returns null when there is nothing
 * later to jump to.
 */
export function tapTarget(timeline: IntroTimeline, elapsed: number): number | null {
  const current = timeline.steps[stepAt(timeline, elapsed)];
  if (!current || elapsed >= timeline.outroAt) return null;
  const next = timeline.steps.find(
    (st) => st.start > elapsed && (st.line !== null || st.scene !== current.scene),
  );
  return next ? next.start : timeline.outroAt;
}
