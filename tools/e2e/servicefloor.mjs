// Transformation Phase B (2026-10-25) — the service floor, restaurant build, in a real browser:
//   F1 a service order opens on the dining room: the customer walks in, sits, and the bubble
//      shows the order's real dish; the figure stays inside the room.
//   F2 a double tap starts cooking once (the board, no second action).
//   F3 Serve pays once (one new settlement entry); the plate reaches the table and the face
//      shows; a second Serve does nothing.
//   F4 a menu guest: the previous customer walks out from the other seat as the guest walks in.
//   F5 the arrival fits 320×568, 390×844 and 768×1024 (no sideways scroll, bubble on screen).
//   F6 Finish Level completes the level normally (the guest paid once, as business revenue).
//   F7 Reduced Motion: the customer is already seated, nobody walks.
//   F8 no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  sweepCash,
  launch,
  boot,
  seedSave,
  MOVED_IN_BUSINESS,
  clickButton,
  sleep,
  readSave,
  shot,
  text,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const flat = async () => (await text(page)).replace(/\s+/g, " ");
const { browser, page, logs } = await launch();

const stocked = (ids) =>
  Object.fromEntries(
    ids.map((id) => [id, { ingredientId: id, quantity: 3, unitCost: 0, purchaseDay: 1 }]),
  );
const FOOD = stocked([
  "bread",
  "tomato",
  "garlic",
  "basil",
  "mozzarella",
  "mushroom",
  "cucumber",
  "carrot",
]);
const saveAt12 = (reducedMotion = false) => {
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      inventory: FOOD,
      restaurantStaff: { specialists: ["mexican-chef"] },
    },
    credits: 5000,
    levelProgress: {
      currentLevelId: "level-12",
      highestUnlockedLevelId: "level-12",
      completedLevelIds: Array.from({ length: 11 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
  });
  s.settings = { ...(s.settings ?? {}), reducedMotion };
  return s;
};
async function prepare(title) {
  await page.evaluate(() =>
    [...document.querySelectorAll("nav button")]
      .find((x) => x.textContent.includes("Kitchen"))
      ?.click(),
  );
  await sleep(500);
  await clickButton(page, /^See all orders/);
  await sleep(700);
  await page.evaluate((name) => {
    let n = [...document.querySelectorAll("p")].find((p) => p.textContent.trim() === name);
    for (let i = 0; i < 8 && n; i++) {
      n = n.parentElement;
      const b =
        n &&
        [...n.querySelectorAll("button")].find((x) =>
          /^(Prepare|Replay)$/.test(x.textContent.trim()),
        );
      if (b) return b.click();
    }
  }, title);
  await sleep(900);
  if (await page.evaluate(() => !!document.querySelector('[data-testid="pre-service-check"]'))) {
    await clickButton(
      page,
      /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/,
    );
    await sleep(800);
  }
}
const floor = () =>
  page.evaluate(() => {
    const f = document.querySelector('[data-testid="service-floor"]');
    if (!f) return null;
    const view = f.querySelector(".sf-view")?.getBoundingClientRect();
    const person = [...f.querySelectorAll(".sf-person")].at(-1)?.getBoundingClientRect();
    const bubble = f.querySelector('[data-testid="service-floor-order"]')?.getBoundingClientRect();
    return {
      mode: f.dataset.mode,
      state: f.dataset.state,
      seat: f.dataset.seat,
      bubble: f.querySelector('[data-testid="service-floor-order"]')?.textContent ?? null,
      face: f.querySelector('[data-testid="service-floor-face"]')?.textContent ?? null,
      leaving: !!f.querySelector('[data-testid="service-floor-leaving"]'),
      personIn: !!(
        view &&
        person &&
        person.left >= view.left - 2 &&
        person.right <= view.right + 2 &&
        person.top >= view.top - 2 &&
        person.bottom <= view.bottom + 2
      ),
      bubbleOnScreen: bubble
        ? bubble.left >= 0 && bubble.right <= innerWidth && bubble.top >= 0
        : null,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
const ledgerCount = (s, cat) => (s?.economyLedger ?? []).filter((e) => e.category === cat).length;

// ---------- F1 arrival ----------
await boot(page, saveAt12());
await prepare("Bruschetta for the House");
const walking = await floor();
await shot(page, "servicefloor-1-walking");
await sleep(3200);
const seated = await floor();
await shot(page, "servicefloor-2-seated-430");
check(
  "F1 the order opens on the dining room: the customer walks in, sits; the bubble shows the real dish; the figure stays in the room",
  walking?.mode === "arrive" &&
    walking.state === "walking" &&
    seated?.state === "seated" &&
    /Bruschetta for the House/.test(seated.bubble ?? "") &&
    seated.personIn,
  { walking, seated },
);

// ---------- F5 widths (on the seated arrival) ----------
const sizes = {};
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await sleep(500);
  sizes[w] = await floor();
  await shot(page, `servicefloor-arrive-${w}`);
}
await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 1 });
await sleep(500);
check(
  "F5 the arrival fits 320, 390 and 768 px: no sideways scroll, the bubble on screen, the customer in the room",
  Object.values(sizes).every(
    (f) => f && f.overflow <= 0 && f.bubbleOnScreen === true && f.personIn,
  ),
  sizes,
);

// ---------- F2 double tap ----------
await page.evaluate(() => {
  const f = document.querySelector('[data-testid="service-floor"]');
  f?.click();
  f?.click();
});
await sleep(600);
const afterTap = await page.evaluate(() => ({
  floor: !!document.querySelector('[data-testid="service-floor"]'),
  board: /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
  report: /KNIFE REPORT/i.test(document.body.innerText),
}));
check(
  "F2 a double tap starts cooking once: the board, no skipped step",
  !afterTap.floor && afterTap.board && !afterTap.report,
  afterTap,
);

// ---------- F3 serve ----------
const played = await playToReport(page, { maxMs: 150000 });
await clickButton(page, /^Continue$/);
await sleep(900);
const before = await readSave(page);
await clickButton(page, /^Serve to /);
await sleep(300);
const delivering = await floor();
await sleep(1200);
const reacting = await floor();
await shot(page, "servicefloor-3-served");
await sleep(1200);
await clickButton(page, /^Serve to /); // a second Serve, if any button is left
await sleep(500);
// The cash lies on the table: the player sweeps it into the wallet (it enters only then).
await sweepCash(page);
const after = await readSave(page);
check(
  "F3 Serve pays once (one settlement entry); the plate reaches the table; the face shows; a second Serve adds nothing",
  played.ok &&
    delivering?.mode === "deliver" &&
    !!reacting?.face &&
    ledgerCount(after, "campaign-settlement") === ledgerCount(before, "campaign-settlement") + 1 &&
    after.economyLedger.length - before.economyLedger.length >= 1,
  {
    delivering,
    reacting,
    settlements: [
      ledgerCount(before, "campaign-settlement"),
      ledgerCount(after, "campaign-settlement"),
    ],
  },
);

// ---------- F4 menu guest: one leaves as the next arrives ----------
const firstSeat = seated?.seat;
await clickButton(page, /Menu guest 1\/1/);
await sleep(700);
const guestArrive = await floor();
await shot(page, "servicefloor-4-next-arrives");
check(
  "F4 the menu guest arrives (joining the seated party, or walking in as the previous party leaves from the other seat)",
  // Since parties (v1.5) a guest may take a free place at the seated party's table (nobody leaves);
  // when a party does leave it walks out from the other seat.
  guestArrive?.mode === "arrive" && (!guestArrive.leaving || guestArrive.seat !== firstSeat),
  { firstSeat, guestArrive },
);

// ---------- F6 guest served, Finish Level ----------
const g0 = await readSave(page);
await playToReport(page, { maxMs: 150000 });
await clickButton(page, /^Continue$/);
await sleep(900);
await clickButton(page, /^Serve to /);
await sleep(2500);
await sweepCash(page);
const g1 = await readSave(page);
await clickButton(page, /^Finish Level$/);
await sleep(2000);
const done = await readSave(page);
check(
  "F6 the guest pays once (business revenue); Finish Level completes Level 12 normally",
  ledgerCount(g1, "business-revenue") === ledgerCount(g0, "business-revenue") + 1 &&
    // The seeded (older-numbering) Level 12 is level-10 of the 148-level campaign.
    done.levelProgress.completedLevelIds.includes("level-10") &&
    !(await page.evaluate(() => !!document.querySelector('[data-testid="service-floor"]'))),
  {
    revenue: [ledgerCount(g0, "business-revenue"), ledgerCount(g1, "business-revenue")],
    text: (await flat()).slice(0, 120),
  },
);

// ---------- F7 Reduced Motion ----------
await boot(page, saveAt12(true));
await prepare("Bruschetta for the House");
const rm = await floor();
check(
  "F7 Reduced Motion: the customer is already seated, nobody walks",
  rm?.state === "seated" && !rm.leaving,
  rm,
);

// ---------- F8 ----------
const errors = logs.filter((l) => /^(error|pageerror)/.test(l) && !/bridge|favicon|ERR_/.test(l));
check("F8 no console errors", errors.length === 0, errors.slice(0, 5));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\nSERVICE FLOOR E2E: ${failed.length} FAILURE(S)`
    : "\nSERVICE FLOOR E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
