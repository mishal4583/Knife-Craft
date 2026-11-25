/**
 * PROGRESS_ART — the painted pictures of the Restaurant Progress page (developer 2026-11-25, docs/planning/RESTAURANT-PROGRESS-REDESIGN-PLAN-2026-11-25.md).
 *
 * A picture is named "<sheet>/<slug>" (scripts/progress-sheets.json). It is drawn only when its file exists (progressArtFiles.ts, generated from the Codex sheets)
 * and has not failed to load; otherwise the page shows today's icon, so the page never has a broken picture.
 */
import { PROGRESS_ART_FILES } from "./progressArtFiles";

const base = () => import.meta.env?.BASE_URL ?? "./";
const have = new Set<string>(PROGRESS_ART_FILES);
const failed = new Set<string>();

/** True when this picture's file exists and has not failed to load. */
export function hasProgressArt(name: string): boolean {
  return have.has(name) && !failed.has(name);
}

/** The picture's URL, or null when it is not available (draw the fallback). */
export function progressArtUrl(name: string): string | null {
  return hasProgressArt(name) ? `${base()}progress/${name}.webp` : null;
}

/** A picture that could not be loaded is remembered, so every later draw uses the fallback. */
export function markProgressArtFailed(name: string): void {
  failed.add(name);
}
