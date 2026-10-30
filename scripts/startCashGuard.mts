/**
 * Shared by the phase guards that pin SaveManager.ts to a base commit.
 *
 * SaveManager.ts may carry exactly two approved changes — and no field, type or migration:
 *  1. the new save's opening credits (`DEFAULT_SAVE.credits`): $1,240 → $0 (developer 2026-10-26)
 *     → $10.00 (developer 2026-10-30, "buy everything from your own money");
 *  2. the serialized, coalescing write queue behind `save()` (2026-10-30; guarded by
 *     pending-cash-qa Q: never overlapping, never out of order, a burst is two writes).
 * Returns every other changed line (empty = the guard holds).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ALLOWED =
  /^\s*(\/\*\*|\*\/|\*( .*)?|\/\/.*)$|^\s*credits: (0|dollars\((10|1240)\)),$|^\s*\/\*\* \$1,240\.00 starting balance/;

/** The write path (old `save()` or the new queue) is compared by its own QA, not line by line. */
function withoutWritePath(text: string): string {
  const reads = "  /**\n   * Reads back what is ACTUALLY persisted";
  const cut = (from: string) => {
    const a = text.indexOf(from);
    const b = text.indexOf(reads, a);
    return a >= 0 && b > a ? text.slice(0, a) + text.slice(b) : text;
  };
  text = cut("  /** The write in flight");
  return cut("  async save(data: SaveData): Promise<void> {");
}

export function saveManagerChangesBeyondStartCash(base: string, root: string): string[] {
  const file = "src/game/SaveManager.ts";
  const norm = (t: string) => withoutWritePath(t.replace(/\r\n/g, "\n")).split("\n");
  const was = norm(
    execSync(`git show ${base}:${file}`, { cwd: root, encoding: "utf8", maxBuffer: 1 << 26 }),
  );
  const now = norm(fs.readFileSync(path.join(root, file), "utf8"));
  const count = (xs: string[]) => {
    const m = new Map<string, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return m;
  };
  const a = count(was);
  const b = count(now);
  const out: string[] = [];
  for (const [line, n] of b) for (let i = 0; i < n - (a.get(line) ?? 0); i++) out.push(`+${line}`);
  for (const [line, n] of a) for (let i = 0; i < n - (b.get(line) ?? 0); i++) out.push(`-${line}`);
  return out.filter((l) => !ALLOWED.test(l.slice(1)));
}
