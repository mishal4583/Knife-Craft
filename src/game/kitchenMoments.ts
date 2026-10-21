import { COMBO } from "./definitions";
import { bestVerdict } from "./bestVerdict";
import { VARIANTS, withArticle, type VariantId } from "./specialVariants";
import { TIER_INFO, type PresentationTier } from "./signatureDishes";
import { PERSONALITIES, type PersonalityId } from "./customers/personalities";
import type { QualityLabel } from "@/types/game";

/**
 * KITCHEN_MOMENTS — Phase 6 (developer 2026-10-21): the Kitchen Moment cards
 * a finished dish can earn — four kinds, each read from an event the game
 * already has. Nothing here scores, pays, saves or changes play; a moment is
 * a picture the player MAY look at and share.
 *
 * ELIGIBILITY (all existing signals, no new thresholds):
 * - "perfect": the run landed a Perfect Slice (the scene's own detection —
 *   a swipe within CutEvaluator's PERFECT_TOL of an ideal division) on an
 *   ingredient whose combo reached the first Clean milestone
 *   (COMBO.MILESTONES[0], ×5) — a perfect cut inside a clean run.
 * - "special": the dish was made with a special ingredient variant
 *   (specialVariants.ts — only when that order really had one), or it just
 *   reached Grandma's Signature (signatureDishes.tierMilestone).
 * - "best": bestVerdict() says "best" — a genuine improvement on the saved
 *   best for this recipe (a first plate or an equal score is not one).
 * - "customer": a special customer (customers/personalities.ts) reacted at
 *   Serve — the line they really said, about the dish's real grade.
 * An ordinary dish by an ordinary customer earns none.
 *
 * ONCE: moments are kept in memory by run (one run = one attempt at one
 * order: a Prepare Again is a new run, re-renders and re-opened screens are
 * not), one per kind per run. Nothing is saved; a reload forgets them.
 */
export type MomentKind = "perfect" | "special" | "best" | "customer";

export type KitchenMoment = {
  kind: MomentKind;
  /** The run this moment belongs to (Preparation's own counter). */
  runKey: string;
  dishName: string;
  /** The picture: the dish's (or the customer's) emoji. */
  emoji: string;
  heading: string;
  /** One or two short facts, all taken from the run. */
  lines: string[];
  /** The badge under the heading (a grade, a tier, a variant, a customer). */
  badge: string;
  shareText: string;
};

export const MOMENT_KIND_LABEL: Record<MomentKind, { icon: string; title: string }> = {
  perfect: { icon: "🔪", title: "Perfect Cut" },
  special: { icon: "✨", title: "Special Dish" },
  best: { icon: "🏆", title: "New Personal Best" },
  customer: { icon: "💬", title: "Customer Moment" },
};

export type RunFacts = {
  runKey: string;
  dishName: string;
  dishEmoji: string;
  score: number;
  grade: QualityLabel;
  /** The saved best BEFORE this run (0 = never prepared). */
  previousBest: number;
  /** Perfect Slices this run, and the combo on the ingredient each landed on. */
  perfects: { combo: number }[];
  bestCombo: number;
  variant: VariantId | null;
  tierReached: PresentationTier | null;
};

/** The moments a finished run earns, in a fixed order (perfect, special, best). */
export function momentsForRun(f: RunFacts): KitchenMoment[] {
  const out: KitchenMoment[] = [];
  const base = { runKey: f.runKey, dishName: f.dishName };
  const firstMilestone = COMBO.MILESTONES[0] ?? 5;
  const perfect = f.perfects.find((p) => p.combo >= firstMilestone);
  if (perfect) {
    out.push({
      ...base,
      kind: "perfect",
      emoji: f.dishEmoji,
      heading: "Perfect Slice",
      badge: f.grade,
      lines: [`A Perfect Slice in a Clean ×${perfect.combo} run`, `${f.dishName} · ${f.grade}`],
      shareText: "Just landed a perfect slice in KnifeCraft!",
    });
  }
  if (f.variant || f.tierReached === "grandmas-signature") {
    const v = f.variant ? VARIANTS[f.variant] : null;
    out.push({
      ...base,
      kind: "special",
      emoji: v ? v.emoji : f.dishEmoji,
      heading: v ? v.name : TIER_INFO["grandmas-signature"].name,
      badge: v ? "Special ingredient" : `${TIER_INFO["grandmas-signature"].icon} Signature dish`,
      lines: v
        ? [`${f.dishName}, made with ${withArticle(v.name)}`]
        : [`${f.dishName} — served Masterful, worthy of Grandma's own recipe book`],
      shareText: "My KnifeCraft kitchen just served a special dish!",
    });
  }
  const verdict = bestVerdict(f.score, f.previousBest);
  if (verdict.kind === "best") {
    out.push({
      ...base,
      kind: "best",
      emoji: f.dishEmoji,
      heading: "New Personal Best",
      badge: f.grade,
      lines: [`${f.dishName}`, `Best ${trim(f.previousBest)} → ${trim(f.score)}`],
      shareText: "New personal best in KnifeCraft!",
    });
  }
  return out;
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The customer moment at Serve: the special customer and what they really said. */
export function customerMoment(input: {
  runKey: string;
  dishName: string;
  personality: PersonalityId;
  line: string;
  reveal?: string;
}): KitchenMoment {
  const p = PERSONALITIES[input.personality];
  return {
    kind: "customer",
    runKey: input.runKey,
    dishName: input.dishName,
    emoji: p.avatarEmoji,
    heading: p.name,
    badge: input.reveal ? `It was ${input.reveal}!` : p.badge,
    lines: [input.line, `about ${input.dishName}`],
    shareText: "This customer moment in KnifeCraft was unforgettable!",
  };
}

// ── this page session's moments (memory only) ───────────────────────────
const store = new Map<string, KitchenMoment>();
const LIMIT = 24;

/** Records a moment once per (run, kind); returns true when it is new. */
export function recordMoment(m: KitchenMoment): boolean {
  const key = `${m.runKey}:${m.kind}`;
  if (store.has(key)) return false;
  store.set(key, m);
  if (store.size > LIMIT) store.delete(store.keys().next().value!);
  return true;
}

/** A run's moments, in kind order. */
export function momentsOf(runKey: string): KitchenMoment[] {
  const order: MomentKind[] = ["perfect", "special", "best", "customer"];
  return order.flatMap((k) => {
    const m = store.get(`${runKey}:${k}`);
    return m ? [m] : [];
  });
}

let runs = 0;
/** A new run's key (one per finished attempt; never reused in the page session). */
export function nextRunKey(recipeId: string): string {
  runs += 1;
  return `${recipeId}#${runs}`;
}

/** Test hook: a fresh page session. */
export function resetMomentsForTests(): void {
  store.clear();
}
