import { useArtFiles, warmArt } from "./artProbe";

/**
 * The Mini-games screen's painted art (developer 2026-11-18, repainted 2026-11-28 after the developer's mock-up of a fair stall; Codex pictures
 * built by scripts/make-minigame-assets.py into public/business/minigames/; prompt: docs/planning/MINIGAMES-SCREEN-CODEX-PROMPT-2026-11-28.md).
 * Each file is probed once and remembered (artProbe.ts), so a piece that is missing (or has not arrived yet) is drawn by a plain CSS look instead; the Kitchen
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

/** Starts fetching every file (the Kitchen calls this a moment after it opens, so the sheet's first tap already has its art). */
export function warmMiniGameArt(): void {
  warmArt(MG_ART.map(mgUrl));
}

/** Whether each named file is here: `has("icon-sauce")`. Re-renders the caller as files arrive. */
export function useMiniGameArt(names: readonly string[] = MG_ART): (name: string) => boolean {
  const here = useArtFiles(names.map(mgUrl));
  return (name: string) => here(mgUrl(name));
}
