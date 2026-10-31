/**
 * TABLE CASH QA (developer 2026-10-31: "make the cash lay there and players collect it whenever they
 * feel like, or let it pile up ... collected before the night closing chores, before counting money ...
 * if it is not collected let it show on the main restaurant map near the tables"):
 *   P. the pile model: orders pile up, nothing is collected for the player (pending-cash-qa has the money);
 *   V. the picture: how many bundles for an amount, where they lie (both tables, inside the painting);
 *   W. the wiring: the dining room, the restaurant map and the Kitchen show it and collect it in one tap,
 *      Auto leaves it, and the closing chores and the count wait for it.
 *
 * Run: npx tsx scripts/table-cash-qa.mts
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
const { pendingCashTotal, settlePendingCash, withPendingCash } =
  await import("../src/game/economy/pendingCash.ts");
const { MAX_BUNDLES, bundleCount, tablePiles } =
  await import("../src/game/restaurant/tableCash.ts");
const { FLOOR_SEATS } = await import("../src/game/restaurant/serviceFloor.ts");

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

// ── P. the pile model ────────────────────────────────────────────────────
{
  let s: SaveData = { ...DEFAULT_SAVE, credits: 1000, economyLedger: [] };
  const cash = (amount: number, tip = 0) => ({
    amount,
    tip,
    category: "campaign-settlement" as const,
    description: "r",
  });
  for (let i = 0; i < 25; i++) s = withPendingCash(s, cash(1_200, 100));
  check(
    "P1 25 orders in a row pile up on the table: nothing collected, the wallet and ledger untouched",
    s.credits === 1000 && s.economyLedger.length === 0 && pendingCashTotal(s) === 25 * 1_300,
    { credits: s.credits, owed: pendingCashTotal(s) },
  );
  const taken = settlePendingCash(JSON.parse(JSON.stringify(s)) as SaveData);
  check(
    "P2 one tap takes the whole pile (also after a reload) as one pay entry and one tip entry",
    taken.credits === 1000 + 25 * 1_300 &&
      taken.economyLedger.length === 2 &&
      pendingCashTotal(taken) === 0,
    taken.economyLedger.map((e) => [e.category, e.amount]),
  );
  const mod = read("src/game/economy/pendingCash.ts");
  const body = mod.slice(mod.indexOf("export function withPendingCash"));
  check(
    "P3 withPendingCash never settles (collects) cash on its own",
    !/settlePendingCash\(/.test(
      body.slice(0, body.indexOf("export function collectPendingCashPiece")),
    ),
  );
}

// ── V. the picture ───────────────────────────────────────────────────────
{
  const sizes = [0, 1, 1_999, 2_000, 5_000, 10_000, 20_000, 40_000, 80_000, 150_000, 300_000, 9e9];
  const n = sizes.map(bundleCount);
  check(
    "V1 nothing owed draws nothing; any cash draws at least one bundle; a bigger pile never looks smaller",
    n[0] === 0 && n[1]! >= 1 && n.every((v, i) => i === 0 || v >= n[i - 1]!),
    n,
  );
  const stages = Object.keys(FLOOR_SEATS) as (keyof typeof FLOOR_SEATS)[];
  let ok = true;
  const seen: unknown[] = [];
  for (const stage of stages)
    for (const first of [0, 1] as const)
      for (const cents of [100, 5_000, 50_000, 5_000_000]) {
        const piles = tablePiles(stage, cents, first);
        const total = piles.reduce((t, p) => t + p.bundles, 0);
        const good =
          piles.length >= 1 &&
          piles.length <= 2 &&
          total >= 1 &&
          total <= MAX_BUNDLES * 2 &&
          piles.every((p) => p.bundles <= MAX_BUNDLES) &&
          piles.every((p) => p.at.x > 0 && p.at.x < 100 && p.at.y > 0 && p.at.y < 100) &&
          Math.abs(piles[0]!.at.y - FLOOR_SEATS[stage][first].table.y) < 0.01;
        if (!good) {
          ok = false;
          seen.push({ stage, first, cents, piles });
        }
      }
  check("V2 on every kitchen stage the piles lie on the tables, inside the painting", ok, seen[0]);
  check(
    "V3 the pile fills the chosen table first; the dining room can leave the guest's table free",
    tablePiles("humble", 500, 1)[0]!.at.x > tablePiles("humble", 500, 0)[0]!.at.x,
  );
}

// ── W. the wiring ────────────────────────────────────────────────────────
{
  const floor = read("src/components/kc/game/ServiceFloor.tsx");
  const prep = read("src/components/kc/game/Preparation.tsx");
  const app = read("src/App.tsx");
  const router = read("src/ScreensRouter.tsx");
  const map = read("src/components/kc/restaurantMap/RestaurantMapView.tsx");
  const tc = read("src/components/kc/common/TableCash.tsx");
  const closing = read("src/components/kc/restaurant/ClosingTime.tsx");
  const card = read("src/components/kc/game/ServiceOrderComplete.tsx");
  check(
    "W1 the dining room draws the piles (first on the free table) and collecting does not skip the arrival",
    /<TableCash[\s\S]{0,200}stage=\{stage\}[\s\S]{0,300}first=\{party\.table === 0 \? 1 : 0\}/.test(
      floor,
    ) &&
      /e\.stopPropagation\(\);\s*onCollect\(\);/.test(tc) &&
      /tableCashCents: pendingCashTotal\(save\)/.test(app) &&
      /service\.tableCashCents && service\.onCollectTableCash/.test(prep),
  );
  check(
    "W2 the restaurant map draws the piles near the tables, from the saved cash, and a tap collects it",
    /pendingCashTotal\(save\) > 0 && onCollectTableCash/.test(router) &&
      /onCollect: onCollectTableCash/.test(router) &&
      /<TableCash stage=\{tableCash\.stage\}/.test(map),
  );
  check(
    "W3 Auto never collects the cash (it piles up for the player)",
    !/onCollectCash!/.test(card) && /window\.setTimeout\(\s*guest \?\? nextOnce,/.test(card),
  );
  check(
    "W4 closing: the Collect button comes first, every chore (and the count) waits for it, Close waits too",
    /closing-table-cash/.test(closing) &&
      closing.indexOf("closing-table-cash") < closing.indexOf('data-testid="closing-chores"') &&
      /locked=\{tableCash > 0\}/.test(closing) &&
      /\) : locked \? \(/.test(closing) &&
      /disabled=\{left > 0 \|\| tableCash > 0\}/.test(closing),
  );
  check(
    "W5 the pile is a real button with a name, in the touch target size (48 px area)",
    // Generalised 2026-10-31 (idle phase 5B): the same pile also lies on the Second Floor's Pickup Counter.
    /aria-label=\{`Collect \$\{owed\} from \$\{where\}`\}/.test(tc) &&
      /where = "the tables"/.test(tc) &&
      /width: 52px;\s*height: 52px;/.test(read("src/components/kc/common/tableCash.css")),
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
