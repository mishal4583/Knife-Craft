/**
 * BUSINESS_ART — the painted pictures of the Business pages (developer 2026-11-25, docs/planning/BUSINESS-UI-REDESIGN-PLAN-2026-11-25.md).
 *
 * A picture is named "<sheet>/<slug>" (scripts/business-sheets.json) and written "biz:<sheet>/<slug>" where the page draws it (the `Art` / `PIcon` components of
 * kc/progress/ProgressKit.tsx route that prefix here). It is drawn only when its file exists (businessArtFiles.ts, generated from the Codex sheets) and has not
 * failed to load; otherwise the page shows today's emoji or drawing, so a page never has a broken picture.
 */
import { BUSINESS_ART_FILES } from "./businessArtFiles";

const base = () => import.meta.env?.BASE_URL ?? "./";
const have = new Set<string>(BUSINESS_ART_FILES);
const failed = new Set<string>();

/** The prefix a page writes before a Business picture's name. */
export const BUSINESS_ART_PREFIX = "biz:";

/** True when this picture's file exists and has not failed to load. */
export function hasBusinessArt(name: string): boolean {
  return have.has(name) && !failed.has(name);
}

/** The picture's URL, or null when it is not available (draw the fallback). */
export function businessArtUrl(name: string): string | null {
  return hasBusinessArt(name) ? `${base()}business/art/${name}.webp` : null;
}

/** A picture that could not be loaded is remembered, so every later draw uses the fallback. */
export function markBusinessArtFailed(name: string): void {
  failed.add(name);
}
