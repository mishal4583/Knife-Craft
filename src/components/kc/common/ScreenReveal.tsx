import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * SCREENS APPEAR WITH THEIR PICTURES (developer 2026-11-11: "sometimes the background images load a little slower than the things in that page and
 * players may start to see it is just images; when navigating from one section to another the contents should load at the perfect time").
 *
 * When the screen changes, any big picture that is on screen but not loaded yet (a backdrop, a banner, a map) keeps the whole screen hidden for a
 * moment; once those pictures are loaded and decoded the screen fades in as one piece. A screen whose pictures are already there (cached, or it
 * has none) is never hidden at all. It can never trap the player: the wait is capped (`MAX_WAIT_MS`), a failed picture counts as done, and a hidden
 * screen still takes taps. Small icons never hold a screen back (only pictures at least `BIG_W` x `BIG_H` and in view count).
 */
const BIG_W = 160;
const BIG_H = 100;
/** The longest a screen is held back for its pictures, from the moment it opened (or its pictures arrived late, from the Suspense chunk). */
const MAX_WAIT_MS = 1100;
/**
 * How long after the screen opened a picture that is added late can still hold it back. A lazy screen (its chunk is still loading, so a
 * "loading" fallback is showing) gets a long window: its content and pictures arrive when the chunk does. A screen that is already
 * on show gets a short one, so a picture the player scrolls to or opens later never hides a screen they are using.
 */
const LATE_WINDOW_LAZY_MS = 12000;
const LATE_WINDOW_MS = 600;
const FALLBACK = "[data-testid='restaurant-loading'], [data-lazy-fallback]";
const FADE_MS = 160;

/** The big pictures in view that are not loaded yet. */
function pendingPictures(root: HTMLElement): HTMLImageElement[] {
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  return Array.from(root.querySelectorAll("img")).filter((img) => {
    if (img.complete) return false;
    const r = img.getBoundingClientRect();
    if (r.width < BIG_W || r.height < BIG_H) return false;
    return !(r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw);
  });
}

const loaded = (img: HTMLImageElement) =>
  new Promise<void>((resolve) => {
    if (img.complete) return resolve();
    const done = () => {
      img.removeEventListener("load", done);
      img.removeEventListener("error", done);
      resolve();
    };
    img.addEventListener("load", done);
    img.addEventListener("error", done);
  });

const decoded = new WeakSet<HTMLImageElement>();
/** Waits for a loaded picture to be decoded too, so it paints with the page and not a frame after it (at most 250 ms). */
async function decodeBig(root: HTMLElement): Promise<void> {
  const vh = window.innerHeight;
  const big = Array.from(root.querySelectorAll("img")).filter((img) => {
    if (decoded.has(img) || !img.complete || img.naturalWidth === 0) return false;
    const r = img.getBoundingClientRect();
    return r.width >= BIG_W && r.height >= BIG_H && r.bottom >= 0 && r.top <= vh;
  });
  if (big.length === 0) return;
  await Promise.race([
    Promise.all(
      big.map((img) =>
        img
          .decode()
          .catch(() => undefined)
          .then(() => {
            decoded.add(img);
          }),
      ),
    ),
    new Promise<void>((r) => window.setTimeout(r, 250)),
  ]);
}

export function ScreenReveal({
  screenKey,
  children,
}: {
  /** Changes when the player goes to another screen. */
  screenKey: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    let cancelled = false;
    const opened = performance.now();
    const lateMs = root.querySelector(FALLBACK) ? LATE_WINDOW_LAZY_MS : LATE_WINDOW_MS;
    let waiting = false;
    let timer = 0;

    const reveal = () => {
      if (cancelled) return;
      waiting = false;
      setHidden(false);
    };
    const hold = (budget: number) => {
      if (cancelled || waiting) return;
      const pending = pendingPictures(root);
      if (pending.length === 0) return;
      waiting = true;
      setHidden(true);
      timer = window.setTimeout(reveal, budget);
      void Promise.all(pending.map(loaded))
        .then(() => decodeBig(root))
        .then(() => {
          window.clearTimeout(timer);
          // Pictures that appeared meanwhile (a lazy screen finishing its load) are waited for too, inside the same budget.
          const more = pendingPictures(root);
          if (more.length > 0 && performance.now() - opened < lateMs) {
            waiting = false;
            hold(Math.max(250, MAX_WAIT_MS));
          } else {
            reveal();
          }
        });
    };

    hold(MAX_WAIT_MS);
    // A lazy screen's own pictures arrive after the first render: watch the first moments for them.
    const mo = new MutationObserver(() => {
      if (!waiting && performance.now() - opened < lateMs) hold(MAX_WAIT_MS);
    });
    mo.observe(root, { childList: true, subtree: true });
    const stop = window.setTimeout(() => mo.disconnect(), lateMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(stop);
      mo.disconnect();
      setHidden(false);
    };
  }, [screenKey]);

  return (
    <div
      ref={ref}
      data-screen-reveal={hidden ? "waiting" : "ready"}
      className="relative h-full w-full"
      style={{
        opacity: hidden ? 0 : 1,
        transition: hidden ? "none" : `opacity ${FADE_MS}ms ease-out`,
      }}
    >
      {children}
    </div>
  );
}
