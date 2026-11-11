/**
 * WHAT A SECOND-FLOOR PURCHASE IS (developer 2026-11-11, "when purchasing and upgrading the player does not understand what is being done: what is
 * polishing? the only thing players understand is that money is spent"). Plain words for every purchase: what it is, what it does, what it adds
 * an hour, and the one-line result after the buy. Pure text, no state, no money moved (the purchase rules are secondFloor.ts, the goal is floorGoal.ts).
 */
import type { FloorGoal, FloorGoalKind } from "./floorGoal";
import { SHORT } from "./floorGoal";
import {
  MAX_POLISH,
  POLISH_PERMILLE,
  secondFloorOf,
  floorPerHour,
  type StationId,
} from "./secondFloor";
import type { SaveData } from "../SaveManager";

export type PurchaseKind = FloorGoalKind;

/** The icon, the name of the thing and what it does, one short line each (the long answer is behind the ⓘ). */
export const PURCHASE_INFO: Record<PurchaseKind, { icon: string; noun: string; does: string }> = {
  machine: {
    icon: "🏪",
    noun: "machine",
    does: "A new machine serves guests and earns money while you play.",
  },
  table: {
    icon: "🪑",
    noun: "table",
    does: "One more table: more guests are served at the same time, so the machine earns more.",
  },
  polish: {
    icon: "✨",
    noun: "polish",
    does: `Polishing keeps the machine shiny and the guests happy: each step makes it earn ${POLISH_PERMILLE / 10}% more. There are ${MAX_POLISH} steps.`,
  },
  tier: {
    icon: "⬆️",
    noun: "upgrade",
    does: "A better, faster machine: guests are served quicker and pay more.",
  },
};

/** The text under the ⓘ on the Second Floor: all four purchases in one place. */
export const PURCHASE_HELP: readonly string[] = [
  `${PURCHASE_INFO.machine.icon} Machine: ${PURCHASE_INFO.machine.does}`,
  `${PURCHASE_INFO.table.icon} Table: ${PURCHASE_INFO.table.does}`,
  `${PURCHASE_INFO.polish.icon} Polish: ${PURCHASE_INFO.polish.does}`,
  `${PURCHASE_INFO.tier.icon} Upgrade: ${PURCHASE_INFO.tier.does}`,
];

/** "Hot Food · polish step 7 of 10" for a goal (the label the strip shows). */
export function goalTitle(
  goal: FloorGoal,
  owned: { tables?: number; polish?: number; level?: number } | undefined,
): string {
  const name = SHORT[goal.id];
  switch (goal.kind) {
    case "machine":
      return `Buy the ${name} machine`;
    case "table":
      return `${name}: add table #${(owned?.tables ?? 1) + 1}`;
    case "polish":
      return `${name}: polish step ${(owned?.polish ?? 0) + 1} of ${MAX_POLISH}`;
    case "tier":
      return `${name}: upgrade to Tier ${(owned?.level ?? 1) + 1}`;
  }
}

/** "+$12.30 an hour": what a purchase adds; `fmt` formats the floor's money unit. */
export const gainText = (gain: number, fmt: (n: number) => string): string =>
  gain > 0 ? `+${fmt(gain)} an hour` : "Earns once a Floor Server runs it";

/** The one-line result after a buy, with the real numbers: "🪑 Hot Food table #3 added · +$4.10 an hour · the floor now earns $60.20 an hour". */
export function boughtText(
  kind: PurchaseKind,
  id: StationId,
  before: SaveData,
  after: SaveData,
  fmt: (n: number) => string,
): string {
  const was = floorPerHour(before);
  const now = floorPerHour(after);
  const f = secondFloorOf(after).stations[id];
  const name = SHORT[id];
  const what =
    kind === "machine"
      ? `${PURCHASE_INFO.machine.icon} ${name} machine bought`
      : kind === "table"
        ? `${PURCHASE_INFO.table.icon} ${name} table #${f?.tables ?? 1} added`
        : kind === "polish"
          ? `${PURCHASE_INFO.polish.icon} ${name} polished (${f?.polish ?? 0}/${MAX_POLISH})`
          : `${PURCHASE_INFO.tier.icon} ${name} is Tier ${f?.level ?? 1}`;
  return now > was
    ? `${what} · +${fmt(now - was)} an hour · the floor earns ${fmt(now)} an hour`
    : `${what} · hire a Floor Server to start earning`;
}
