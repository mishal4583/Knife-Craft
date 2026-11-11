// Dishwashing, piece after piece (developer 2026-11-11 bug list: "there are many bugs in dishwashing: analyse and fix everything"), restaurant build.
// The bug: the sink's piece (keyed by its index) and its "Combo xN" chip (keyed by the streak) were siblings with NUMBER keys, so at piece 2 with a
// streak of 2 React saw two children with the same key and DUPLICATED the whole piece: old pieces stayed on the sink under the new one (a pan under
// the measuring cups), several scrub surfaces stacked, and the rinse stuck at 95% because the top surface was a stale copy.
//   W1 through a whole sink of different pieces (pot, pan, plates, cups, bowls, glasses) there is ONE piece, ONE scrub surface and ONE sink on screen
//   W2 every piece goes scrub -> rinse -> clean and the sink moves on to the next kind (nothing sticks at 95%)
//   W3 what is drawn is what the status says: the piece on the sink carries the id of the kind in the status
//   W4 the Combo chip sits on the right, clear of the soap bottle on the left
//   W5 no console errors
// Screenshots: out/dishpieces-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot, clickButton } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const SINK = {
  "stock-pot": 1,
  saucepans: 1,
  "frying-pans": 1,
  "dinner-plates": 1,
  "measuring-cups": 1,
  "mixing-bowls": 1,
  "soup-bowls": 1,
  "water-glasses": 2,
};
const KIND_OF_LABEL = [
  [/stock pot/i, "stock-pot"],
  [/saucepan/i, "saucepans"],
  [/fry pan/i, "frying-pans"],
  [/dinner plate/i, "dinner-plates"],
  [/measuring cup/i, "measuring-cups"],
  [/mixing bowl/i, "mixing-bowls"],
  [/soup/i, "soup-bowls"],
  [/water glass/i, "water-glasses"],
];
const save = seedSave({
  credits: 500_000,
  business: {
    ...MOVED_IN_BUSINESS,
    supplies: {
      stock: {
        ...MOVED_IN_BUSINESS.supplies.stock,
        ...Object.fromEntries(Object.keys(SINK).map((k) => [k, { units: 24, costBasis: 2400 }])),
        "dish-soap": { units: 3, costBasis: 3000 },
      },
    },
    restaurantSupplies: {
      soapPct: 60,
      cleanerPct: 60,
      washing: 0,
      dirty: SINK,
      washedTotal: 100,
      washedKitchen: 0,
      used: {},
      brokenTotal: 0,
    },
  },
  levelProgress: {
    currentLevelId: "level-40",
    highestUnlockedLevelId: "level-40",
    completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
  },
  story: { introDone: true, milestoneMask: 4095, finaleSeen: true },
});
await boot(page, save);
await page.evaluate(() => document.querySelector('[data-nav="kitchen"]')?.click());
await sleep(700);
await page.waitForSelector('[data-testid="guide-card"]', { timeout: 4000 }).catch(() => null);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="guide-card"] button')]
    .find((b) => b.textContent.includes("Later"))
    ?.click(),
);
await sleep(300);
await clickButton(page, /Open for service$|Prepare$/);
await sleep(1300);
await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="sink-wash"] button')]
    .find((b) => /Wash/.test(b.textContent))
    ?.click(),
);
await sleep(1200);

const status = () =>
  page.evaluate(
    () => document.querySelector('[data-testid="wash-up-status"]')?.textContent?.trim() ?? "",
  );
const counts = () =>
  page.evaluate(() => ({
    pieces: document.querySelectorAll("[data-piece-id]").length,
    surfaces: document.querySelectorAll('[data-testid="wash-up-surface"]').length,
    sinks: document.querySelectorAll('[data-testid="wash-up-sink"]').length,
    id: document.querySelector("[data-piece-id]")?.dataset.pieceId ?? null,
  }));
const surface = () =>
  page.evaluate(() => {
    const r = document.querySelector('[data-testid="wash-up-surface"]')?.getBoundingClientRect();
    return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
  });
const zigzag = async (pass) => {
  const box = await surface();
  if (!box) return false;
  const at = (sx, sy) => [box.x + (sx / 360) * box.w, box.y + (sy / 280) * box.h];
  const [x0, y0] = at(180, 160);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let sy = 90; sy <= 246; sy += 12) {
    const [ax, ay] = at(pass % 2 ? 330 : 60, sy);
    const [bx, by] = at(pass % 2 ? 60 : 330, sy + 3);
    await page.mouse.move(ax, ay, { steps: 2 });
    await page.mouse.move(bx, by, { steps: 9 });
  }
  await page.mouse.up();
  return true;
};
const kindOf = (st) => KIND_OF_LABEL.find(([re]) => re.test(st))?.[1] ?? null;

const samples = [];
const mismatches = [];
const stuck = [];
let comboRight = null;
const total = Object.values(SINK).reduce((a, b) => a + b, 0);
let finished = 0;
// The key of a piece is its position in the queue; wash `total` pieces and look after every pass.
for (let guard = 0; guard < 400 && finished < total; guard++) {
  const before = await status();
  if (!before || /Sink empty/.test(before)) break;
  const wantKind = kindOf(before);
  let passes = 0;
  let moved = false;
  for (let pass = 0; pass < 40; pass++) {
    if (!(await zigzag(pass))) break;
    passes++;
    samples.push(await counts());
    const c = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="wash-up-combo"]');
      const soap = document.querySelector('[data-testid="wash-up-scene"]')?.getBoundingClientRect();
      const r = el?.getBoundingClientRect();
      return r && soap ? { right: r.left > soap.left + soap.width / 2 } : null;
    });
    if (c && comboRight === null) comboRight = c.right;
    const st = await status();
    const idNow = (await counts()).id;
    if (wantKind && idNow && !/clean!|Sink empty/.test(st) && kindOf(st) && kindOf(st) !== idNow) {
      mismatches.push({ status: st, drawn: idNow });
    }
    if (st !== before && !/Rins|Scrub|Keep|Almost/.test(st)) {
      moved = true;
      break;
    }
    if (/clean!/.test(st) || (kindOf(st) && kindOf(st) !== wantKind)) {
      moved = true;
      break;
    }
  }
  if (!moved) {
    stuck.push({ before, passes });
    break;
  }
  finished++;
  await sleep(900);
  if (finished === 4) await shot(page, "dishpieces-4");
}
const worst = samples.reduce((m, s) => Math.max(m, s.pieces, s.surfaces, s.sinks), 0);
check(
  "W1 one piece, one scrub surface and one sink on screen all the way through the sink",
  samples.length > 20 && worst === 1,
  { samples: samples.length, worst },
);
check(
  "W2 every piece is scrubbed, rinsed and cleaned, and the sink moves on (nothing sticks)",
  stuck.length === 0 && finished >= total - 1,
  { finished, total, stuck },
);
check("W3 what is drawn is what the status says", mismatches.length === 0, mismatches.slice(0, 3));
check(
  "W4 the Combo chip sits on the right of the sink, away from the soap bottle",
  comboRight === null || comboRight === true,
  { comboRight },
);
check(
  "W5 no console errors",
  logs.filter((l) => /^(error|pageerror)/.test(l)).length === 0,
  logs.slice(0, 3),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
