/**
 * CELEBRATIONS (developer 2026-11-08: "when the popularity and the ranking increase add a congratulations ... and an appreciation from
 * Paige for maintaining the restaurant properly"). Pure rules: what a finished service or a closed night earned in a way the player
 * should FEEL - a climb in the city ranking, rising popularity, a spotless run. It only reads numbers the game already has and moves no
 * money. The card that shows it is `components/kc/common/CelebrationCard.tsx`.
 */
import type { PaigePose } from "./assistant";

/** Popularity must rise by at least this much (0-100) for a night to be worth a card. */
export const POPULARITY_CARD_DELTA = 3;
/** A spotless run this long earns Paige's thanks. */
export const SPOTLESS_RUN_FOR_THANKS = 2;

export type Celebration = {
  /** Stable id of the kind: "rank", "popularity" or "spotless" (the card's data attribute). */
  kind: "rank" | "popularity" | "spotless";
  emoji: string;
  title: string;
  /** The facts, one short line each. */
  lines: string[];
  /** Paige's words (appreciation), always one short line. */
  paige: string;
  pose: PaigePose;
};

export type CelebrationInput = {
  /** The city ranking climbed (rankChange), or null. */
  rank: { from: number; to: number; passed: string } | null;
  /** Popularity (0-100) before and after, or null when it was not measured this time. */
  popularity: { before: number; after: number } | null;
  /** The spotless streak after this service (serviceReport), 0 when it was not spotless or not measured. */
  spotlessStreak: number;
};

export function celebrationFor(input: CelebrationInput): Celebration | null {
  const popUp =
    input.popularity && input.popularity.after - input.popularity.before >= POPULARITY_CARD_DELTA
      ? input.popularity
      : null;
  const thanks = input.spotlessStreak >= SPOTLESS_RUN_FOR_THANKS;
  if (!input.rank && !popUp && !thanks) return null;

  const lines: string[] = [];
  if (input.rank) {
    lines.push(`#${input.rank.from} → #${input.rank.to} in the city`);
    if (input.rank.passed) lines.push(`You passed ${input.rank.passed}`);
  }
  if (popUp) lines.push(`⭐ Popularity ${popUp.before} → ${popUp.after}`);
  if (thanks) lines.push(`✨ ${input.spotlessStreak} spotless services in a row`);

  const paige = thanks
    ? "You keep this place spotless. Guests notice, and so do I!"
    : input.rank
      ? "Look at you climb! Your hard work is paying off."
      : "Word is getting around. Guests are talking about you!";
  const kind: Celebration["kind"] = input.rank ? "rank" : popUp ? "popularity" : "spotless";
  return {
    kind,
    emoji: input.rank ? "🏆" : popUp ? "⭐" : "✨",
    title: input.rank
      ? `You climbed to #${input.rank.to}!`
      : popUp
        ? "Your restaurant is getting popular!"
        : "Spotless work!",
    lines,
    paige,
    pose: input.rank || thanks ? "cheer" : "clap",
  };
}
