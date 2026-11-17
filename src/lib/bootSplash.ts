/**
 * THE LOADING SCREEN's driver (developer 2026-11-18). The screen itself is plain HTML + CSS in index.html (#boot-splash), painted before any script
 * arrives; this file only fills its bar with REAL progress (the first screen's pictures and fonts) and takes it away when they are ready.
 *
 * Rules: it never blocks the game (every wait has a time limit), it never touches saves, money or the SDK, and it is a no-op when the element is
 * missing (tests, other builds). `game_ready` is unchanged: the SDK still hears it when the Kitchen / Preparation is interactive.
 */

/** The longest the loading screen may wait for pictures: a slow phone sees the game rather than a stuck bar. */
export const BOOT_MAX_WAIT_MS = 9000;
/** The very latest the screen goes away, whatever else happens. */
export const BOOT_HARD_LIMIT_MS = 20000;

const splash = () =>
  typeof document === "undefined" ? null : document.getElementById("boot-splash");

let progress = 0.18;
let finished = false;

/** Moves the bar forward (never back): 0 to 1. */
export function setBootProgress(next: number): void {
  const el = splash();
  if (!el || finished) return;
  progress = Math.max(progress, Math.min(1, next));
  el.style.setProperty("--p", String(progress));
}

/** Shows or hides the "tap for music" line (browsers keep a page silent until the first tap). */
export function setBootHint(show: boolean): void {
  const hint = splash()?.querySelector<HTMLElement>(".bs-hint");
  if (hint) hint.hidden = !show;
}

/** The bar is full: the screen fades away and leaves the DOM. Safe to call twice. */
export function finishBoot(): void {
  if (finished) return;
  finished = true;
  const el = splash();
  document.documentElement.dataset["booted"] = "1";
  if (!el) return;
  el.style.setProperty("--p", "1");
  const calm =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.setTimeout(
    () => {
      el.classList.add("leaving");
      window.setTimeout(() => el.remove(), calm ? 0 : 450);
    },
    calm ? 0 : 140,
  );
}

/** A picture is "ready" once it is fetched and decoded (or failed: a missing file must never trap the player). */
function loadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const done = () => resolve();
      if (typeof img.decode === "function") img.decode().then(done, done);
      else done();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

/** The three typefaces the first screen draws with (they load on first use otherwise, a beat after the text appears). */
function loadFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return Promise.resolve();
  return Promise.all([
    document.fonts.load('800 16px "Fraunces"'),
    document.fonts.load('700 14px "Nunito"'),
    document.fonts.load('700 16px "Caveat"'),
  ]).then(
    () => undefined,
    () => undefined,
  );
}

/**
 * Waits for the given pictures and the fonts, moving the bar from `from` to `to` as each one arrives, but never longer than `maxMs`.
 * Resolves in every case.
 */
export function preloadCritical(
  urls: readonly string[],
  opts: { from?: number; to?: number; maxMs?: number } = {},
): Promise<void> {
  const from = opts.from ?? 0.35;
  const to = opts.to ?? 0.96;
  const maxMs = opts.maxMs ?? BOOT_MAX_WAIT_MS;
  const unique = [...new Set(urls.filter(Boolean))];
  const total = unique.length + 1; // + the fonts
  let done = 0;
  const tick = () => {
    done += 1;
    setBootProgress(from + ((to - from) * done) / total);
  };
  const all = Promise.all([
    loadFonts().then(tick),
    ...unique.map((u) => loadImage(u).then(tick)),
  ]).then(() => undefined);
  return Promise.race([all, new Promise<void>((resolve) => window.setTimeout(resolve, maxMs))]);
}

/** A safety net: whatever happens, the screen is gone after BOOT_HARD_LIMIT_MS. */
export function armBootFailsafe(): void {
  if (typeof window === "undefined") return;
  window.setTimeout(finishBoot, BOOT_HARD_LIMIT_MS);
}
