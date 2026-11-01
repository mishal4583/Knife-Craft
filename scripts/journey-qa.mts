/**
 * JOURNEY QA (Phase 7A, developer 2026-10-31: hybrid — levels hidden, 100 milestones shown):
 *   J. The 100 milestones laid over the 148 hidden services (restaurant/journey.ts):
 *      - 100, numbered in order, contiguous, from service 1 to the last; every service in exactly one;
 *      - every real unlock event ends a milestone (nothing opens in the middle of one), so "next milestone"
 *        never lies about when something opens;
 *      - the finale and last-page services are Story milestones; the Practice ones fill the rest;
 *      - where the player is on the journey comes from the finished services only; it is pure, writes no
 *        save field, and touches no wallet or ledger;
 *      - the written table (docs/planning/LEVEL-DISPOSITION-2026-10-31.md) is exactly what the game says now.
 *
 * Run: npx tsx scripts/journey-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => void (store[k] = v),
  removeItem: (k: string) => void delete store[k],
  clear: () => void Object.keys(store).forEach((k) => delete store[k]),
  key: () => null,
  length: 0,
} as Storage;

const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
type SaveData = import("../src/game/SaveManager.ts").SaveData;
const { LEVELS } = await import("../src/game/levels/levelDefinitions.ts");
const J = await import("../src/game/restaurant/journey.ts");
const { LAST_CAMPAIGN_LEVEL } = await import("../src/game/restaurant/restaurantProgression.ts");
const { render, DOC_PATH } = await import("./level-disposition.mts");

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const read = (p: string) =>
  fs.readFileSync(path.join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const M = J.MILESTONES;

check(
  "J1 100 milestones, numbered 1..100 in order, contiguous, from service 1 to the last service",
  M.length === J.MILESTONE_COUNT &&
    J.MILESTONE_COUNT === 100 &&
    M.every((m, i) => m.no === i + 1 && m.from === (M[i - 1]?.to ?? 0) + 1 && m.to >= m.from) &&
    M[0]!.from === 1 &&
    M[M.length - 1]!.to === LAST_CAMPAIGN_LEVEL &&
    LAST_CAMPAIGN_LEVEL === LEVELS.length,
  { count: M.length, last: M[M.length - 1]?.to, levels: LEVELS.length },
);

{
  let ok = true;
  const bad: number[] = [];
  for (let n = 1; n <= LEVELS.length; n++) {
    const inside = M.filter((m) => n >= m.from && n <= m.to);
    if (inside.length !== 1 || J.milestoneOf(n) !== inside[0]) {
      ok = false;
      bad.push(n);
    }
  }
  check("J2 every one of the 148 services is in exactly one milestone (none dropped)", ok, bad);
}

{
  const events = J.unlockEvents();
  const mid = [...events.keys()].filter((n) => J.milestoneOf(n).to !== n);
  check(
    "J3 every real unlock event (system, staff, chef, kitchen rank, technique, menu, days, chapter, story) ends a milestone: nothing opens mid-milestone",
    events.size > 40 && mid.length === 0,
    { events: events.size, mid },
  );
}

{
  const story = M.filter((m) => m.kind === "Story").map((m) => m.to);
  const practice = M.filter((m) => m.kind === "Practice");
  check(
    "J4 the finale (75) and the last page (148) are Story milestones; Practice milestones fill the rest, are named after the dish they end on, and none runs long",
    story.includes(75) &&
      story.includes(148) &&
      practice.length === J.MILESTONE_COUNT - J.NATURAL_MILESTONES &&
      practice.every((m) => m.name === LEVELS[m.to - 1]!.title) &&
      Math.max(...M.map((m) => m.to - m.from + 1)) <= 3,
    { story, practice: practice.length, natural: J.NATURAL_MILESTONES },
  );
}

check(
  "J4b every milestone has its own name (no two read the same) and no name is empty",
  new Set(M.map((m) => m.name)).size === M.length && M.every((m) => m.name.trim().length > 2),
  M.map((m) => m.name).filter((n, i, all) => all.indexOf(n) !== i),
);

// ── where the player is ──────────────────────────────────────────────────
const saveWith = (completed: number[]): SaveData => ({
  ...structuredClone(DEFAULT_SAVE),
  levelProgress: {
    ...structuredClone(DEFAULT_SAVE.levelProgress),
    completedLevelIds: completed.map((n) => `level-${n}`),
  },
});
const upTo = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
{
  const start = J.journeyOf(saveWith([]));
  check(
    "J5 a new game: nothing done, milestone 1 is current with 1 service to go, milestone 2 is next, chapter 1",
    start.done === 0 &&
      start.total === 100 &&
      start.current?.no === 1 &&
      start.servicesLeft === 1 &&
      start.next?.no === 2 &&
      start.chapter.no === 1 &&
      start.chapter.done === 0,
    start,
  );
  const at30 = J.journeyOf(saveWith(upTo(30)));
  const doneBy30 = M.filter((m) => m.to <= 30).length;
  check(
    "J6 after 30 finished services: exactly the milestones that end by 30 are done, the next one is current",
    at30.done === doneBy30 &&
      at30.current?.from === 31 &&
      at30.servicesLeft === at30.current!.to - 30,
    { done: at30.done, expected: doneBy30, current: at30.current?.no },
  );
  const multi = M.find((m) => m.to - m.from >= 1)!;
  const half = J.journeyOf(saveWith(upTo(multi.from)));
  check(
    "J7 a milestone of 2 services is not done after its first service; 1 service is left in it",
    half.current?.no === multi.no && half.servicesLeft === multi.to - multi.from,
    { current: half.current?.no, left: half.servicesLeft, multi: multi.no },
  );
  const all = J.journeyOf(saveWith(upTo(LEVELS.length)));
  check(
    "J8 everything finished: 100 of 100, no current or next milestone (the Endless Restaurant is next)",
    all.done === 100 && all.current === null && all.next === null && all.servicesLeft === 0,
    all,
  );
  const odd = J.journeyOf({
    ...saveWith([1, 2]),
    levelProgress: {
      ...saveWith([1, 2]).levelProgress,
      completedLevelIds: ["level-1", "level-2", "endless-3", "garbage", "level-9999"],
    },
  });
  check(
    "J9 ids that are not campaign levels are ignored (old or odd saves still read)",
    odd.done === M.filter((m) => m.to <= 2).length && odd.current !== null,
    odd.done,
  );
}

// ── pure ─────────────────────────────────────────────────────────────────
{
  const s = saveWith(upTo(10));
  const before = JSON.stringify(s);
  J.journeyOf(s);
  J.milestoneOf(50);
  const src = read("src/game/restaurant/journey.ts");
  check(
    "J10 pure: reading the journey changes nothing, writes no save field, and the module touches no wallet, ledger or random",
    JSON.stringify(s) === before &&
      !/EconomyLedger|economy\/wallet|debitWallet|appendLedgerEntry|Math\.random/.test(src) &&
      !/journey/i.test(read("src/game/SaveManager.ts")),
  );
}

// ── the written table is what the game says ──────────────────────────────
{
  const cells = (text: string) =>
    text
      .split("\n")
      .filter((l) => l.startsWith("|") && !/^\|[-: |]+\|$/.test(l))
      .map((l) =>
        l
          .split("|")
          .map((c) => c.trim())
          .join("|"),
      );
  const now = cells(await render());
  const saved = cells(read(DOC_PATH));
  check(
    "J11 docs/planning/LEVEL-DISPOSITION-2026-10-31.md is exactly what the game says now (re-run scripts/level-disposition.mts after a change)",
    now.length === saved.length && now.every((l, i) => l === saved[i]),
    { rows: now.length, saved: saved.length, firstDiff: now.findIndex((l, i) => l !== saved[i]) },
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
