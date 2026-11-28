import { useEffect, useState } from "react";

/**
 * The Mini-games screen's painted art (developer 2026-11-18, repainted 2026-11-28 after the developer's mock-up of a fair stall; Codex pictures
 * built by scripts/make-minigame-assets.py into public/business/minigames/; prompt: docs/planning/MINIGAMES-SCREEN-CODEX-PROMPT-2026-11-28.md).
 * Each file is probed once and remembered, so a piece that is missing (or has not arrived yet) is drawn by a plain CSS look instead; the Kitchen
 * warms every file a moment after it opens, so the screen shows its art on the first tap and nothing paints in afterwards. Presentation only: it
 * never touches a save.
 */

export const mgUrl = (name: string) => `${import.meta.env.BASE_URL}business/minigames/${name}.webp`;

/** The eight game pictures, then the screen's pieces. */
export const MG_ART = [
  "icon-inspection",
  "icon-fridge-sort",
  "icon-sauce",
  "icon-stockroom",
  "icon-fridge-check",
  "icon-car-park",
  "icon-dessert-run",
  "icon-kitchen-dispatch",
  "card-red",
  "card-purple",
  "name-ribbon",
  "pill-ready",
  "pill-rest",
  "pill-locked",
  "lock-badge",
  "badge-ready",
  "title-plaque",
  "close-button",
  "tab-on",
  "tab-off",
  "icon-gamepad",
  "awning",
  "leaves-corner",
  "festival-scene-tall",
  "festival-scene-wide",
  "festival-frame-top",
  "festival-frame-mid",
  "festival-frame-bottom",
  "festival-trophy",
  "festival-ribbon",
  "button-green",
  "shortcut-icon",
] as const;
export type MgArt = (typeof MG_ART)[number];

/**
 * The pieces stretched between two painted ends (the name ribbon, the pills, the tabs, the green button): the file's size and the width of each end
 * in file pixels. Drawn as two ends and a middle that overlaps them by a pixel: a CSS border-image left hairline seams once the game was scaled.
 */
export const STRETCH = {
  "name-ribbon": { w: 440, h: 90, cap: 60 },
  "pill-ready": { w: 258, h: 50, cap: 28 },
  "pill-rest": { w: 258, h: 50, cap: 28 },
  "pill-locked": { w: 258, h: 50, cap: 28 },
  "tab-on": { w: 450, h: 70, cap: 38 },
  "tab-off": { w: 450, h: 70, cap: 38 },
  "button-green": { w: 320, h: 81, cap: 44 },
} as const;
export type StretchArt = keyof typeof STRETCH;

const known = new Map<string, boolean>();
const failedAt = new Map<string, number>();
const RETRY_MS = 8000;
const pending = new Set<string>();
const listeners = new Set<() => void>();

function probe(name: string) {
  if (pending.has(name) || typeof Image === "undefined") return;
  // a file that came back missing (a flaky connection at the warm-up) is tried again, but not on every render
  if (known.get(name) === true) return;
  if (known.has(name) && Date.now() - (failedAt.get(name) ?? 0) < RETRY_MS) return;
  pending.add(name);
  const img = new Image();
  img.decoding = "async";
  const done = (ok: boolean) => {
    pending.delete(name);
    known.set(name, ok);
    if (!ok) failedAt.set(name, Date.now());
    listeners.forEach((f) => f());
  };
  img.onload = () => done(true);
  img.onerror = () => done(false);
  img.src = mgUrl(name);
}

/** Starts fetching every file (the Kitchen calls this a moment after it opens, so the sheet's first tap already has its art). */
export function warmMiniGameArt(): void {
  MG_ART.forEach(probe);
}

/** Whether each named file is here: `has("icon-sauce")`. Re-renders the caller as files arrive. */
export function useMiniGameArt(names: readonly string[] = MG_ART): (name: string) => boolean {
  const [, tick] = useState(0);
  const key = names.join(",");
  useEffect(() => {
    const f = () => tick((n) => n + 1);
    listeners.add(f);
    names.forEach(probe);
    // a probe that finished between this render and this effect would otherwise go unheard
    if (names.some((n) => known.has(n))) f();
    return () => {
      listeners.delete(f);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (name: string) => known.get(name) === true;
}
