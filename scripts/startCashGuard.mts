/**
 * Shared by the phase guards that pin SaveManager.ts to a base commit.
 *
 * Rule changed (developer 2026-10-26, "the game starts at 0 cash and the player earns from
 * it"): the one change SaveManager.ts may carry is the new save's opening credits
 * (`DEFAULT_SAVE.credits`, $1,240 → $0) and its doc comment — no field, type or migration.
 * Returns every other changed line (empty = the guard holds).
 */
import { execSync } from "node:child_process";

const ALLOWED =
  /^-\s*\/\*\* \$1,240\.00 starting balance|^-\s*credits: dollars\(1240\),$|^\+\s*credits: 0,$|^\+\s*(\/\*\*|\*\/|\*( .*)?)$/;

export function saveManagerChangesBeyondStartCash(base: string, root: string): string[] {
  return execSync(`git diff -U0 ${base} -- src/game/SaveManager.ts`, {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter((l) => /^[+-](?![+-])/.test(l))
    .filter((l) => !ALLOWED.test(l));
}
