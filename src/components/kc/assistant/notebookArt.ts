import { useArtFiles, warmArt } from "../artProbe";

/**
 * Paige's notebook, painted (developer 2026-11-28: Codex's pictures after the developer's mock-up; prompt
 * docs/planning/NOTEBOOK-CODEX-PROMPT-2026-11-28.md, built by scripts/make-notebook-assets.py into public/business/notebook/). The notebook
 * wears them only when ALL of them are here; until then it keeps the plain drawn look (notebook.css), so it is never half painted.
 */
export const NB_ART = [
  "page-upright",
  "page-wide",
  "title-banner",
  "close-x",
  "ribbon-done",
  "ribbon-todo",
  "panel-done",
  "panel-todo",
  "row",
  "box-empty",
  "box-ticked",
  "arrow",
  "tips-pill",
  "switch-on",
  "switch-off",
  "button-close",
  "ring",
  "sparks-left",
  "sparks-right",
] as const;
export type NbArt = (typeof NB_ART)[number];

export const nbUrl = (name: NbArt) => `${import.meta.env.BASE_URL}business/notebook/${name}.webp`;
export const nbImage = (name: NbArt) => `url(${nbUrl(name)})`;

const urls = () => NB_ART.map(nbUrl);

/** Fetch them ahead (once Paige is hired), so the notebook is painted the first time it opens. */
export function warmNotebookArt(): void {
  warmArt(urls());
}

export function useNotebookArt(): boolean {
  const files = urls();
  const here = useArtFiles(files);
  return files.every(here);
}

/**
 * The pieces that stretch BOTH ways (a page, a panel, a slip): the file's size and the corner kept whole, in file pixels. Drawn as four
 * corners, four edges and a middle, each overlapping its neighbour by a pixel (a CSS border-image left hairline seams once the game was
 * scaled).
 */
export const NB_SLICE9 = {
  "page-upright": { w: 524, h: 827, x: 66, y: 66 },
  "page-wide": { w: 885, h: 576, x: 66, y: 66 },
  "panel-done": { w: 619, h: 183, x: 66, y: 66 },
  "panel-todo": { w: 610, h: 181, x: 72, y: 72 },
  row: { w: 473, h: 50, x: 40, y: 22 },
} as const;

/** The pieces that only widen (the ribbons, the Tips pill, Close): the file's size and its left and right ends, in file pixels. */
export const NB_SLICE3 = {
  "ribbon-done": { w: 544, h: 79, left: 156, right: 100 },
  "ribbon-todo": { w: 544, h: 77, left: 130, right: 60 },
  "tips-pill": { w: 619, h: 66, left: 46, right: 46 },
  "button-close": { w: 588, h: 76, left: 52, right: 52 },
} as const;
