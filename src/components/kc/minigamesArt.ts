import { useEffect, useState, type CSSProperties } from "react";

/**
 * The Mini-games sheet's painted art (developer 2026-11-18; Codex pictures built by scripts/make-minigame-assets.py into public/business/minigames/;
 * plan: docs/planning/MINIGAMES-SHEET-ART-PLAN-AND-CODEX-PROMPTS-2026-11-18.md). Each file is probed once and remembered, so a piece that is missing
 * (or has not arrived yet) is drawn by the earlier plain look instead; the Kitchen warms every file a moment after it opens, so the sheet shows
 * its art on the first tap and nothing paints in afterwards. Presentation only: it never touches a save.
 */

export const mgUrl = (name: string) => `${import.meta.env.BASE_URL}business/minigames/${name}.webp`;

/** Every file the sheet and the Kitchen's button use. */
export const MG_ART = [
  "icon-inspection",
  "icon-fridge-sort",
  "icon-sauce",
  "icon-stockroom",
  "icon-fridge-check",
  "icon-car-park",
  "icon-dessert-run",
  "icon-kitchen-dispatch",
  "card-ready",
  "card-resting",
  "card-locked",
  "ready-glow",
  "sheet-panel",
  "title-ribbon",
  "close-button",
  "pill-ready",
  "pill-rest",
  "pill-locked",
  "lock-badge",
  "badge-ready",
  "shortcut-icon",
  "header-sparkle",
] as const;
export type MgArt = (typeof MG_ART)[number];

/** The pieces drawn as stretchable frames (CSS border-image): the file's size in pixels, the slice and the width they are drawn at (css px). */
export const NINE_SLICE = {
  "card-ready": { w: 288, h: 288, slice: "72", width: "24px" },
  "card-resting": { w: 288, h: 267, slice: "48 72", width: "16px 24px" },
  "card-locked": { w: 288, h: 281, slice: "48 72", width: "16px 24px" },
  "ready-glow": { w: 288, h: 288, slice: "56", width: "18px" },
  "sheet-panel": { w: 384, h: 376, slice: "96", width: "32px" },
  "pill-ready": { w: 288, h: 84, slice: "0 42", width: "0 13px" },
  "pill-rest": { w: 288, h: 84, slice: "0 42", width: "0 13px" },
  "pill-locked": { w: 288, h: 84, slice: "0 42", width: "0 13px" },
} as const;
export type NineSliceArt = keyof typeof NINE_SLICE;

/** The CSS of one stretchable frame: put it on an empty, absolutely placed box (or, for a pill, on the label itself). `fill` paints the middle too. */
export function frameStyle(name: NineSliceArt, fill = true): CSSProperties {
  const n = NINE_SLICE[name];
  return {
    borderStyle: "solid",
    borderWidth: n.width,
    borderImage: `url(${mgUrl(name)}) ${n.slice}${fill ? " fill" : ""} / ${n.width} stretch`,
  };
}

const known = new Map<string, boolean>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

function probe(name: string) {
  if (known.has(name) || pending.has(name) || typeof Image === "undefined") return;
  pending.add(name);
  const img = new Image();
  img.decoding = "async";
  const done = (ok: boolean) => {
    pending.delete(name);
    known.set(name, ok);
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
    return () => {
      listeners.delete(f);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (name: string) => known.get(name) === true;
}
