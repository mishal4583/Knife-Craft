/**
 * THE BRANCH LOOKS (developer 2026-11-25; the Second Floor spec says "new branches get a new look: the cosmetic that makes it feel like progress"). Each branch of the Franchise
 * (`business.secondFloor.branch`, 0 to MAX_BRANCH finished) puts its own colour on the Second Floor: a plain CSS colour filter over the one painted picture, an accent for the
 * branch plaque, and a name. Presentation only: no money, no state, no new picture to load (the painted emblems of the branches, when Codex has made them, are separate:
 * `progress/branches/branch-<n>.webp`, see `branchEmblemPath`).
 */
export type BranchLook = {
  /** The branch's name on its plaque. */
  name: string;
  /** A CSS `filter` over the Second Floor picture ("none" for the original look). Plain colour functions only. */
  filter: string;
  /** The plaque's accent colour. */
  accent: string;
};

export const BRANCH_LOOKS: readonly BranchLook[] = [
  { name: "Original", filter: "none", accent: "#c58a2e" },
  { name: "Copper", filter: "sepia(0.28) saturate(1.12) hue-rotate(-6deg)", accent: "#b4602a" },
  { name: "Garden", filter: "hue-rotate(28deg) saturate(1.06)", accent: "#5f8f3a" },
  {
    name: "Harbour",
    filter: "hue-rotate(150deg) saturate(0.95) brightness(1.04)",
    accent: "#3f87a6",
  },
  { name: "Royal", filter: "hue-rotate(250deg) saturate(1.08)", accent: "#7a4bb0" },
  { name: "Golden", filter: "sepia(0.55) saturate(1.5) brightness(1.06)", accent: "#d9a021" },
];

/** The look of a floor with `branch` branches finished: out-of-range and bad numbers read as the nearest valid one. */
export function branchLook(branch: number): BranchLook {
  const n = Number.isFinite(branch) ? Math.floor(branch) : 0;
  return BRANCH_LOOKS[Math.min(BRANCH_LOOKS.length - 1, Math.max(0, n))]!;
}

/** The painted emblem of a branch (Codex, when delivered), or null for the original floor. */
export function branchEmblemPath(branch: number): string | null {
  const n = Number.isFinite(branch) ? Math.floor(branch) : 0;
  return n >= 1 && n < BRANCH_LOOKS.length ? `progress/branches/branch-${n}.webp` : null;
}
