/**
 * PAIGE'S CHECKLIST QA (developer 2026-11-28: "the paige notebook should be like a check list for task to be done and let the old completed task
 * disappear after the day is completed and new task appear ... make sure paige doesnt show any wrong information"; game/restaurant/paigeTasks.ts):
 *   A  the reported bug: with every kitchen tier built, no line says to upgrade the kitchen
 *   B  TRUTH, for every level of the campaign and several kinds of player: no job to do is already done, no ticked job is still to do,
 *      every line has words and a real screen, and serving is always last
 *   C  a day: a listed job is ticked once the save proves it; the tick goes when the day closes, and the new day lists its own jobs
 *   D  never ticked without proof (a knife he can no longer afford just leaves the list)
 *   E  only job ids are saved; old and damaged saves; not hired = nothing written; no money, stock or ledger
 *   F  the wiring: one save path, the load, the arrows, the screen
 *   G  the painted pieces: every file there, the size the code slices it for, small, and never half painted
 *
 * Run: npx tsx scripts/paige-checklist-qa.mts
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
const A = await import("../src/game/restaurant/assistant.ts");
const T = await import("../src/game/restaurant/paigeTasks.ts");
const { LAST_CAMPAIGN_LEVEL } = await import("../src/game/restaurant/restaurantProgression.ts");
const { KITCHEN_UPGRADE_CATALOG } =
  await import("../src/game/kitchen/kitchenUpgradeDefinitions.ts");
const { purchaseKitchenUpgrade } = await import("../src/game/kitchen/KitchenUpgradeManager.ts");
const { KNIFE_CATALOG } = await import("../src/game/knives/knifeDefinitions.ts");
const { BOARD_CATALOG } = await import("../src/game/boards/boardDefinitions.ts");
const { REFRIGERATOR_CATALOG } = await import("../src/game/business/refrigeratorDefinitions.ts");

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

const at = (n: number, credits = 0): SaveData =>
  A.hireAssistant({
    ...structuredClone(DEFAULT_SAVE),
    credits,
    story: { ...DEFAULT_SAVE.story, introDone: true },
    levelProgress: {
      ...structuredClone(DEFAULT_SAVE.levelProgress),
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
  });
const nextDay = (s: SaveData): SaveData => ({
  ...s,
  business: {
    ...s.business,
    restaurantDay: {
      ...s.business.restaurantDay!,
      day: (s.business.restaurantDay?.day ?? 1) + 1,
    },
    calendar: { ...s.business.calendar, businessDay: s.business.calendar.businessDay + 1 },
  },
});
const tiers = KITCHEN_UPGRADE_CATALOG.map((k) => k.id);
const maxKitchen = (s: SaveData): SaveData => ({
  ...s,
  ownedKitchenUpgradeIds: tiers,
  equippedKitchenUpgradeId: tiers.at(-1)!,
});
const everything = (s: SaveData): SaveData => {
  const x = maxKitchen(s);
  return {
    ...x,
    ownedKnifeIds: KNIFE_CATALOG.map((k) => k.id),
    ownedBoardIds: BOARD_CATALOG.map((b) => b.id),
    business: {
      ...x.business,
      refrigerator: {
        ...x.business.refrigerator,
        refrigeratorId: REFRIGERATOR_CATALOG.at(-1)!.id,
      },
      staff: {
        ...x.business.staff,
        hiredRoles: [
          "server",
          "cashier",
          "prep-cook",
          "line-cook",
          "cleaner",
          "head-chef",
          "manager",
        ],
      },
    },
  };
};
const ids = (list: { id: string }[]) => list.map((t) => t.id);
const lines = (c: ReturnType<typeof T.paigeChecklist>) => [...c.todo, ...c.done].map((t) => t.text);

// ── A. The reported bug ───────────────────────────────────────────────
{
  const bad: string[] = [];
  for (let n = 1; n <= LAST_CAMPAIGN_LEVEL + 1; n++) {
    const s = T.trackPaigeTasks(maxKitchen(at(n, 90_000_000)));
    for (const t of lines(T.paigeChecklist(s)))
      if (/upgrade to the|upgrade your kitchen/i.test(t)) bad.push(`${n}: ${t}`);
  }
  check(
    "A1 with every kitchen tier built, no line says to upgrade the kitchen, at any level",
    bad.length === 0,
    bad,
  );
  const growing = T.paigeChecklist(at(20, 90_000_000));
  check(
    "A2 with a tier left that the wallet covers, the line names exactly that tier",
    growing.todo.some((t) => t.id === `kitchen:${tiers[1]}`) &&
      growing.todo.some((t) => t.text === `Upgrade to the ${KITCHEN_UPGRADE_CATALOG[1]!.name}.`),
    ids(growing.todo),
  );
  check(
    "A3 a tier the wallet cannot cover is not a job yet",
    !T.paigeChecklist(at(20, 1000)).todo.some((t) => t.id.startsWith("kitchen:")),
  );
}

// ── B. Truth at every level ───────────────────────────────────────────
{
  const screens = read("src/components/kc/data.ts");
  const bad: string[] = [];
  let seen = 0;
  for (let n = 1; n <= LAST_CAMPAIGN_LEVEL + 1; n++)
    for (const [who, save] of [
      ["poor", at(n, 0)],
      ["comfortable", at(n, 600_000)],
      ["rich", at(n, 90_000_000)],
      ["has it all", everything(at(n, 90_000_000))],
    ] as const) {
      const s = T.trackPaigeTasks(save);
      const c = T.paigeChecklist(s);
      if (c.todo.at(-1)?.id !== "serve") bad.push(`${n} ${who}: serve is not last`);
      for (const t of c.todo) {
        seen++;
        if (t.id !== "serve" && T.taskDone(s, t.id)) bad.push(`${n} ${who}: ${t.id} is done`);
      }
      for (const t of [...c.todo, ...c.done]) {
        if (!t.text || t.text.length > 90) bad.push(`${n} ${who}: bad line ${t.id}`);
        if (t.go !== "shop" && !new RegExp(`"${t.go}"`).test(screens))
          bad.push(`${n} ${who}: unknown screen ${t.go} (${t.id})`);
      }
      const open = T.openTaskIds(s);
      for (const t of c.done)
        if (open.includes(t.id)) bad.push(`${n} ${who}: ${t.id} ticked and open`);
      if (who === "has it all")
        for (const id of ids(c.todo))
          if (/^(kitchen|knife|board|fridge|staff:|prep-cook)/.test(id))
            bad.push(`${n} ${who}: told to get ${id}`);
    }
  check(
    `B1 ${seen} jobs over every level and four kinds of player: none to do is already done, none ticked is still open, all have words and a real screen, nothing he owns is asked for`,
    seen > 400 && bad.length === 0,
    bad.slice(0, 12),
  );
}

// ── C. A day ──────────────────────────────────────────────────────────
{
  const start = T.trackPaigeTasks(at(20, 90_000_000));
  const kitchen = `kitchen:${tiers[1]}`;
  check(
    "C1 the day's open jobs are written down (ids only), and writing them again changes nothing",
    !!A.assistantOf(start).list?.ids.includes(kitchen) && T.trackPaigeTasks(start) === start,
    A.assistantOf(start).list,
  );
  const bought = purchaseKitchenUpgrade(start, tiers[1]!);
  const after = bought.ok ? T.trackPaigeTasks(bought.save) : start;
  const c = T.paigeChecklist(after);
  check(
    "C2 once the kitchen is bought the job is ticked, and the open list does not hold it",
    bought.ok && ids(c.done).includes(kitchen) && !ids(c.todo).includes(kitchen),
    { done: ids(c.done), todo: ids(c.todo) },
  );
  const tomorrow = T.trackPaigeTasks(nextDay(after));
  const t = T.paigeChecklist(tomorrow);
  check(
    "C3 when the day closes the tick is gone, and the new day lists its own jobs",
    t.done.length === 0 &&
      A.assistantOf(tomorrow).list!.day > A.assistantOf(after).list!.day &&
      !A.assistantOf(tomorrow).list!.ids.includes(kitchen) &&
      ids(t.todo).includes(`kitchen:${tiers[2]}`),
    { done: ids(t.done), todo: ids(t.todo) },
  );
  check(
    "C4 yesterday's list shows no tick even before the next save",
    T.paigeChecklist(nextDay(after)).done.length === 0,
  );
}

// ── D. No tick without proof ──────────────────────────────────────────
{
  // (money for a knife, not for a kitchen tier or a machine, so the knife has a place among the goals)
  const rich = T.trackPaigeTasks(at(30, 40_000));
  const knife = T.openTaskIds(rich).find((id) => id.startsWith("knife:"));
  const poor = T.paigeChecklist({ ...rich, credits: 0 });
  check(
    "D1 a knife he can no longer afford leaves the list; it is not ticked",
    !!knife && !ids(poor.todo).includes(knife) && !ids(poor.done).includes(knife),
    { knife, done: ids(poor.done) },
  );
  check(
    "D2 an id the game does not know is never shown and never ticked",
    T.taskById("kitchen:gone") === null &&
      T.taskById("nonsense") === null &&
      !T.taskDone(rich, "nonsense") &&
      !T.taskDone(rich, "step:nonsense"),
  );
}

// ── E. The save ───────────────────────────────────────────────────────
{
  const before = at(20, 90_000_000);
  const after = T.trackPaigeTasks(before);
  const strip = (s: SaveData) => {
    const copy = structuredClone(s);
    delete copy.business.assistant!.list;
    return JSON.stringify(copy);
  };
  check(
    "E1 only business.assistant.list changes: no money, stock, ledger or anything else",
    strip(after) === strip(before) && after.credits === before.credits,
  );
  check(
    "E2 only ids are saved, no words",
    A.assistantOf(after).list!.ids.every((id) => /^[a-z0-9-]+(:[a-zA-Z0-9-]+){0,2}$/.test(id)),
    A.assistantOf(after).list,
  );
  const notHired = structuredClone(DEFAULT_SAVE);
  check("E3 before she is hired nothing is written", T.trackPaigeTasks(notHired) === notHired);
  const junk = {
    ...before,
    business: {
      ...before.business,
      assistant: { hired: true, seen: [], list: { day: "x", ids: "restock" } },
    },
  } as unknown as SaveData;
  const dup = {
    ...before,
    business: {
      ...before.business,
      assistant: { hired: true, seen: [], list: { day: 1, ids: ["restock", 4, "restock"] } },
    },
  } as unknown as SaveData;
  check(
    "E4 a damaged list is dropped or cleaned; an old save has none",
    A.assistantOf(junk).list === undefined &&
      A.assistantOf(dup).list!.ids.join() === "restock" &&
      A.assistantOf(before).list === undefined,
  );
  check(
    "E5 her other state changes keep the list",
    JSON.stringify(A.assistantOf(A.setAssistantTips(after, false)).list) ===
      JSON.stringify(A.assistantOf(after).list) &&
      JSON.stringify(A.assistantOf(A.markAssistantSeen(after, "restock")).list) ===
        JSON.stringify(A.assistantOf(after).list),
  );
  const src = read("src/game/restaurant/paigeTasks.ts").replace(/\/\*[\s\S]*?\*\//g, "");
  check(
    "E6 the checklist is pure: no wallet, ledger, clock or random",
    !/economy\/wallet|EconomyLedger|debitWallet|creditWallet|appendLedgerEntry|Math\.random|Date\.now|new Date|credits\s*[-+]=/.test(
      src,
    ),
  );
}

// ── F. The wiring ─────────────────────────────────────────────────────
{
  const app = read("src/App.tsx");
  const book = read("src/components/kc/assistant/PaigeNotebook.tsx");
  check(
    "F1 every save goes through the checklist, and so does the load",
    /const rewarded = RESTAURANT_MODE \? trackPaigeTasks\(paid\) : paid;[\s\S]{0,600}SaveManager\.save\(rewarded\)/.test(
      app,
    ) && /const opened = RESTAURANT_MODE \? trackPaigeTasks\(synced\) : synced;/.test(app),
  );
  check(
    "F2 an arrow closes the notebook and opens the job's place (the Market plan, a staff card, a supply card)",
    /onGo=\{openPaigeTask\}/.test(app) &&
      /const openPaigeTask[\s\S]{0,120}setPaigeNotebook\(false\);[\s\S]{0,420}go\(task\.go as ScreenId\)/.test(
        app,
      ),
  );
  check(
    "F3 the screen is the checklist: Recently Completed, Next to Do, the Tips switch, Close and the X, and no stored tips",
    /paigeChecklist\(save\)/.test(book) &&
      /Recently Completed/.test(book) &&
      /Next to Do/.test(book) &&
      /data-testid="paige-tips-switch"/.test(book) &&
      /data-testid="paige-close"/.test(book) &&
      /data-testid="paige-notebook-x"/.test(book) &&
      !/notebookEntries|Show again/.test(book + app),
  );
  const css = read("src/components/kc/assistant/notebook.css");
  check(
    "F4 every control is at least 48 px",
    [".pn-x", ".pn-switch", ".pn-go"].every((c) =>
      new RegExp(`\\${c} \\{[^}]*height: 48px;`).test(css),
    ) &&
      /\.pn-close \{[^}]*min-height: 48px;/.test(css) &&
      /\.pn-row \{[^}]*min-height: 48px;/.test(css),
  );
}

// ── G. The painted pieces ─────────────────────────────────────────────
{
  const { NB_ART, NB_SLICE3, NB_SLICE9 } =
    await import("../src/components/kc/assistant/notebookArt.ts");
  const dir = "public/business/notebook";
  /** A WebP file's width and height, read from its header. */
  const sizeOf = (name: string): { w: number; h: number; bytes: number } | null => {
    const file = path.join(dir, `${name}.webp`);
    if (!fs.existsSync(file)) return null;
    const b = fs.readFileSync(file);
    const kind = b.toString("ascii", 12, 16);
    const bytes = b.length;
    if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), bytes };
    if (kind === "VP8 ")
      return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff, bytes };
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1, bytes };
  };
  const missing = NB_ART.filter((n) => !sizeOf(n));
  check(
    "G1 every painted piece the notebook asks for is in the build",
    missing.length === 0,
    missing,
  );
  const kb = NB_ART.reduce((n, a) => n + (sizeOf(a)?.bytes ?? 0), 0) / 1024;
  check(`G2 together they weigh ${Math.round(kb)} KB (limit 300 KB)`, kb > 0 && kb <= 300);
  const wrong: unknown[] = [];
  for (const [name, s] of Object.entries(NB_SLICE9)) {
    const got = sizeOf(name);
    if (!got || got.w !== s.w || got.h !== s.h || 2 * s.x >= s.w || 2 * s.y >= s.h)
      wrong.push({ name, got, want: s });
  }
  for (const [name, s] of Object.entries(NB_SLICE3)) {
    const got = sizeOf(name);
    if (!got || got.w !== s.w || got.h !== s.h || s.left + s.right >= s.w)
      wrong.push({ name, got, want: s });
  }
  check(
    "G3 every stretched piece's file is the size the code slices it for, with a middle left to stretch",
    wrong.length === 0,
    wrong,
  );
  const art = read("src/components/kc/assistant/notebookArt.ts");
  const book = read("src/components/kc/assistant/PaigeNotebook.tsx");
  check(
    "G4 the notebook is painted only when every picture is here (plain until then), and they are fetched once her button shows",
    /return files\.every\(here\);/.test(art) &&
      /art && "pn-art"/.test(book) &&
      /warmNotebookArt/.test(read("src/components/kc/assistant/AskPaigeButton.tsx")),
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nPAIGE CHECKLIST QA: ALL PASS");
process.exit(failed ? 1 : 0);
