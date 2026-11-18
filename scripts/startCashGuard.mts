/**
 * Shared by the phase guards that pin SaveManager.ts to a base commit.
 *
 * SaveManager.ts may carry exactly three approved changes — and no field, type or migration:
 *  1. the new save's opening credits (`DEFAULT_SAVE.credits`): $1,240 → $0 (developer 2026-10-26)
 *     → $10.00 (developer 2026-10-30, "buy everything from your own money")
 *     → STARTING_CASH = $10.00 + the Server's and the Cashier's hiring fees (developer 2026-11-01, Phase 10,
 *     config/startingTeam.ts; its import line is allowed too);
 *  2. the serialized, coalescing write queue behind `save()` (2026-10-30; guarded by
 *     pending-cash-qa Q: never overlapping, never out of order, a burst is two writes).
 *  3. the optional `settings.autoService` flag (developer 2026-10-30, the hired Prep Cook's Auto service;
 *     guarded by prep-cook-auto-qa S: absent = off, survives a load).
 *  4. the read safety (audit 2026-11-18, developer "deep check ... fix it one by one"): a failed storage read is retried and never taken for an empty
 *     save (`readCloudWithRetry`, `readFailed`, no write over the real save), an unreadable save is copied first (`keepBackup`), a stored wallet that is
 *     negative / fractional / not a number is made whole cents >= 0. No field, type or migration; guarded by save-safety-qa A-D.
 * Returns every other changed line (empty = the guard holds).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ALLOWED =
  /^\s*(\/\*\*|\*\/|\*( .*)?|\/\/.*)$|^\s*autoService\?: boolean;$|^\s*\/\*\* `autoService` \(optional, developer 2026-10-30\).*\*\/$|^\s*credits: (0|STARTING_CASH|dollars\((10|1240)\)),$|^import \{ STARTING_CASH \} from "\.\/config\/startingTeam";$|^\s*\/\*\* \$1,240\.00 starting balance|^import \{ loadCloudSave, platformReady(, saveCloudBackup)?, saveCloudSave \} from "\.\/PlayablesSDK";$|^\s*$|^\s*\/\*\* `sound` and `reducedMotion` .*\*\/$|^\s*\/\*\* The cloud save could not be read at all .*\*\/$|^\s*private readFailed = false;$|^\s*const read = await readCloudWithRetry\(\);$|^\s*raw = read\.raw;$|^\s*this\.readFailed = read\.failed;$|^\s*raw = await loadCloudSave\(\)\.catch\(\(\) => null\);$|^\s*\} catch( \(error\))? \{$|^\s*credits: Math\.max\(0, Math\.round\(Number\(partial\.credits\) \|\| 0\)\),$|^\s*console\.error\("The saved game could not be read; a copy was kept\.", error\);$|^\s*await keepBackup\(raw\);$/;

/** The write path (old `save()` or the new queue) is compared by its own QA, not line by line. */
function withoutWritePath(text: string): string {
  const reads = "  /**\n   * Reads back what is ACTUALLY persisted";
  const cut = (from: string) => {
    const a = text.indexOf(from);
    const b = text.indexOf(reads, a);
    return a >= 0 && b > a ? text.slice(0, a) + text.slice(b) : text;
  };
  text = cut("  /** The write in flight");
  return withoutReadSafety(cut("  async save(data: SaveData): Promise<void> {"));
}

/** The two top-level helpers of the read safety (retry, backup) are compared by save-safety-qa, not line by line. */
function withoutReadSafety(text: string): string {
  for (const [from, header] of [
    ["/** Reads the cloud save, trying again", "async function readCloudWithRetry"],
    ["/** A copy of a save that could not be read", "async function keepBackup"],
  ] as const) {
    const a = text.indexOf(from);
    const h = text.indexOf(header, a);
    const end = h >= 0 ? text.indexOf("\n}\n", h) : -1;
    if (a >= 0 && end > a) text = text.slice(0, a) + text.slice(end + 3);
  }
  return text;
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
