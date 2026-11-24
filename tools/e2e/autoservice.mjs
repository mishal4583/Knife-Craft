// Prep Cook AUTO persistence and payment (developer 2026-11-24: "Prep Cook Auto Persistence and Payment Fix"), restaurant build, real gameplay.
// The same service played two ways: M = the Prep Cook's button with the player serving by hand (the reference), A = Auto on (the cook cuts, serves and moves on by himself).
// For equivalent orders and the same plate score the pay, the tip, the recipe progress, the chef record, the paid-order list and the stock must be IDENTICAL, and in every run
//   the wallet = the opening cash + the signed ledger, no ledger id twice, no order paid twice, no plate recorded twice.
//   S1  Level 32 (one order): M against A
//   S2  Level 33 (two consecutive orders): M against A
//   S3  Stop Auto on the first served card: the setting is saved OFF, stays off, and the service waits for the player
//   S4  reload DURING Auto (after the first order was served): nothing is lost or paid twice, Auto carries on, the level completes with both orders paid once
//   S5  reload AFTER a completed order served by hand: same
//   S6  an interrupted service: the plate is cut, the player reloads before serving; nothing is paid; serving afterwards pays once
//   S7  repeated serve attempts (three clicks in one tick, by hand): one payment
//   S8  a taken dare and Auto: the dare and the dares-won count end the same as by hand
//   S10 collecting the cash of a menu-guest service: one ledger entry per kind, nothing again after a reload
//   S9  a MENU GUEST (the optional guest after the level's own orders): by hand against Auto, then three Serve taps and a reload on the guest's card
// AUTO_BASELINE=1 (or KC_URL on the committed build) prints every comparison as INFO (the "before" numbers) and does not fail.
// Usage: node autoservice.mjs [S1 .. S10]   (default all). Exit 1 on any failed check.
import { MOVED_IN_BUSINESS, boot, launch, readSave, seedSave, shot, sleep } from "./harness.mjs";
import { driveService, serviceSave } from "./servicedrive.mjs";

const args = process.argv.slice(2);
const want = new Set(args.filter((a) => /^S\d+$/.test(a)));
const run = (id) => want.size === 0 || want.has(id);
const BASELINE = process.env.AUTO_BASELINE === "1";
const results = [];
const check = (id, ok, detail) => {
  if (BASELINE) {
    console.log(
      `INFO ${id}`,
      JSON.stringify({ holds: ok, ...(typeof detail === "object" ? detail : { detail }) }),
    );
    return;
  }
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const info = (id, detail) => console.log(`DATA ${id}`, JSON.stringify(detail));

const { browser, page, logs } = await launch();
// What the player sees of the plate: the grade words on the screen while the order is cooked and served (the plate's score as the player meets it).
await page.evaluateOnNewDocument(() => {
  window.__seen = [];
  setInterval(() => {
    const t = document.body?.innerText ?? "";
    const m = t.match(/\b(Masterful|Clean|Honest|Rough|Burnt)\b[^\n]{0,24}/);
    if (m && !window.__seen.includes(m[0])) window.__seen.push(m[0]);
  }, 150);
});

const L32 = { level: 32, ingredients: ["garlic", "ginger"] };
const L33 = { level: 33, ingredients: ["onion", "mango", "chilli"] };
const seedFor = (spec, auto, top = {}, business = {}) =>
  serviceSave({
    ...spec,
    business: {
      // Level 33 asks for a Line Cook on the team as well (the Pre-Service Check's "NEW THIS LEVEL"); Level 32 does not mind.
      staff: { hiredRoles: ["server", "cashier", "prep-cook", "line-cook"] },
      ...business,
    },
    top: { settings: { autoService: auto }, ...top },
    seedSave,
    MOVED_IN_BUSINESS,
  });

const sum = (a) => a.reduce((n, e) => n + e.amount, 0);
const stockOf = (s) =>
  Object.fromEntries(Object.entries(s.business.inventory ?? {}).map(([k, v]) => [k, v.quantity]));
/** Everything the comparison needs, from one save (and the one it started from). */
function facts(before, after, level) {
  const fresh = after.economyLedger.slice(before.economyLedger.length);
  const byCat = {};
  for (const e of fresh) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
  const sumCat = (c) => sum(fresh.filter((e) => e.category === c));
  const pend = after.business?.pendingCash ?? null;
  const ids = after.economyLedger.map((e) => e.id);
  const chef = after.business.chefRecord ?? null;
  return {
    creditsDelta: after.credits - before.credits,
    walletEqualsOpeningPlusLedger: before.credits + sum(fresh) === after.credits,
    duplicateLedgerIds: ids.length - new Set(ids).size,
    ledgerByCategory: byCat,
    ledgerSumByCategory: Object.fromEntries(Object.keys(byCat).map((c) => [c, sumCat(c)])),
    menuGuestsServed: after.levelProgress?.menuGuests?.[`level-${level}`] ?? 0,
    orderPayCents: sumCat("campaign-settlement") + (pend?.payCents ?? 0),
    tipCents: sumCat("customer-tip") + (pend?.tipCents ?? 0),
    cashOnTable: pend ? { pay: pend.payCents, tip: pend.tipCents } : null,
    // everything on the tables, piece by piece (a menu guest's cash waits in `more`)
    tableCash: pend
      ? [pend, ...(pend.more ?? [])].map((c) => ({
          category: c.category,
          pay: c.payCents,
          tip: c.tipCents,
        }))
      : [],
    paidOrders: after.levelProgress?.paidOrders?.[`level-${level}`] ?? [],
    recipeProgress: Object.fromEntries(
      Object.entries(after.recipeProgress ?? {}).map(([k, v]) => [k, v?.best ?? null]),
    ),
    chefRecord: chef && {
      plates: chef.plates,
      services: chef.services,
      perfectCuts: chef.perfectCuts,
      masterful: chef.masterful,
      runClean: chef.runClean,
      fastestMs: chef.fastestMs,
      bestServiceAccuracy: chef.bestServiceAccuracy,
      daresWon: chef.daresWon,
      challenge: chef.challenge,
    },
    stock: stockOf(after),
    autoService: after.settings?.autoService === true,
    completed: (after.levelProgress?.completedLevelIds ?? []).includes(`level-${level}`),
  };
}
/** One whole service (the page's own flow), returning the facts and what the player saw of the plate. */
async function play(name, seed, drive, level) {
  await boot(page, seed);
  await sleep(2500);
  await page.evaluate(() => (window.__seen = []));
  const before = await readSave(page);
  const r = await driveService(page, { maxMs: Number(process.env.AUTO_MAXMS ?? 420000), ...drive });
  await sleep(5000);
  const after = await readSave(page);
  const seen = await page.evaluate(() => window.__seen);
  const f = {
    ...facts(before, after, level),
    plateWords: seen,
    driveOk: r.ok,
    ...(r.stuck ? { stuck: r.stuck.slice(0, 10) } : {}),
  };
  info(name, f);
  return { before, after, f, steps: r.steps };
}
/** Polls the saved game until `pred(save)` holds. */
async function until(pred, maxMs = 120000, every = 500) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await readSave(page);
    if (s && pred(s)) return s;
    await sleep(every);
  }
  return null;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const comparable = (f) => ({
  orderPayCents: f.orderPayCents,
  tipCents: f.tipCents,
  paidOrders: f.paidOrders,
  recipeProgress: f.recipeProgress,
  chefRecord: f.chefRecord,
  stock: f.stock,
  completed: f.completed,
  creditsDelta: f.creditsDelta,
});
const clean = (f) => f.walletEqualsOpeningPlusLedger && f.duplicateLedgerIds === 0;

let refS2 = null;
/** The manual two-order service on this build (the reference S4 and S5 compare their end state with). */
async function referenceS2() {
  refS2 ??= (await play("ref-S2-manual", seedFor(L33, false), { cook: true }, 33)).f;
  return refS2;
}
// ───────── S1 + S2: manual against Auto ─────────
for (const [id, spec, orders] of [
  ["S1", L32, 1],
  ["S2", L33, 2],
]) {
  if (!run(id)) continue;
  const m = await play(`${id}-manual`, seedFor(spec, false), { cook: true }, spec.level);
  const a = await play(`${id}-auto`, seedFor(spec, true), { auto: true }, spec.level);
  check(
    `${id}a manual: the level completed, ${orders} order(s) paid, wallet = opening + ledger, no duplicate id`,
    m.f.completed && m.f.orderPayCents > 0 && clean(m.f),
    m.f,
  );
  check(
    `${id}b Auto: the level completed, ${orders} order(s) paid, wallet = opening + ledger, no duplicate id`,
    a.f.completed && a.f.orderPayCents > 0 && clean(a.f),
    a.f,
  );
  check(
    `${id}c Auto = manual: pay, tip, paid orders, recipe progress, chef record, stock and wallet are identical`,
    same(comparable(m.f), comparable(a.f)),
    {
      manual: comparable(m.f),
      auto: comparable(a.f),
    },
  );
  check(
    `${id}d the plate is in the recipe book and the chef record exactly once per order (plates = ${orders}, services 1)`,
    a.f.chefRecord?.plates === orders &&
      a.f.chefRecord?.services === 1 &&
      Object.keys(a.f.recipeProgress).length >= 1,
    { plates: a.f.chefRecord?.plates, services: a.f.chefRecord?.services, rp: a.f.recipeProgress },
  );
  await shot(page, `autoservice-${id}`);
}

// ───────── S3: Stop Auto ─────────
if (run("S3")) {
  await boot(page, seedFor(L33, true));
  await sleep(2500);
  const r = driveService(page, { maxMs: 400000, auto: true });
  // the first order served: its card has the Stop Auto button
  const hit = await (async () => {
    const t0 = Date.now();
    while (Date.now() - t0 < 200000) {
      const ok = await page.evaluate(() => {
        const b = [...document.querySelectorAll("button")].find((x) =>
          /Stop Auto/.test(x.textContent),
        );
        if (b && b.getBoundingClientRect().width > 0) {
          b.click();
          return true;
        }
        return false;
      });
      if (ok) return true;
      await sleep(300);
    }
    return false;
  })();
  const stoppedAt = await readSave(page);
  await sleep(9000);
  const later = await readSave(page);
  const pending = await page.evaluate(() => ({
    serve: [...document.querySelectorAll("button")].some((b) =>
      /^Serve to|Next [Cc]ustomer/.test(b.textContent.trim()),
    ),
  }));
  void r.catch(() => {});
  check("S3a Stop Auto was found and pressed on a served card", hit);
  check(
    "S3b the setting is saved OFF, and 9 s later it is still OFF (nothing writes it back)",
    stoppedAt?.settings?.autoService === false && later?.settings?.autoService === false,
    {
      atStop: stoppedAt?.settings?.autoService,
      later: later?.settings?.autoService,
    },
  );
  check(
    "S3c with Auto off the game waits for the player: no further order was paid",
    later.economyLedger.length === stoppedAt.economyLedger.length &&
      (later.levelProgress.paidOrders?.["level-33"] ?? []).length ===
        (stoppedAt.levelProgress.paidOrders?.["level-33"] ?? []).length,
    {
      ledgerAtStop: stoppedAt.economyLedger.length,
      ledgerLater: later.economyLedger.length,
      controls: pending.serve,
    },
  );
}

// ───────── S4: reload during Auto ─────────
if (run("S4")) {
  const seed = seedFor(L33, true);
  await boot(page, seed);
  await sleep(2500);
  const before = await readSave(page);
  const r = driveService(page, { maxMs: 400000, auto: true });
  const mid = await until(
    (s) => (s.levelProgress.paidOrders?.["level-33"] ?? []).length >= 1,
    200000,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(3000);
  const afterReload = await readSave(page);
  void r.catch(() => {});
  info("S4-mid", facts(before, afterReload, 33));
  check(
    "S4a reload mid-Auto: the paid order and the plate record are still there, nothing is paid twice",
    !!mid &&
      (afterReload.levelProgress.paidOrders?.["level-33"] ?? []).length === 1 &&
      facts(before, afterReload, 33).walletEqualsOpeningPlusLedger &&
      facts(before, afterReload, 33).duplicateLedgerIds === 0,
    facts(before, afterReload, 33),
  );
  // After a reload the service is not running any more: the player is back at the Pre-Service Check and presses "Start service" (Auto never presses it: it stops at the check, by design).
  for (let i = 0; i < 40; i++) {
    const tapped = await page.evaluate(() => {
      const b = [...document.querySelectorAll("button")].find(
        (x) =>
          /Start service/.test(x.textContent) && !x.disabled && x.getBoundingClientRect().width > 0,
      );
      b?.click();
      return !!b;
    });
    if (tapped) break;
    await sleep(500);
  }
  const done = await (async () => {
    const d = driveService(page, { maxMs: 360000, auto: true });
    const s = await until(
      (x) => (x.levelProgress.completedLevelIds ?? []).includes("level-33"),
      360000,
    );
    void d.catch(() => {});
    return s;
  })();
  const end = done ?? (await readSave(page));
  const f = facts(before, end, 33);
  info("S4-end", f);
  const ref = await referenceS2();
  check(
    "S4b after the reload Auto carries on: the level completes and pays EXACTLY what the manual service pays (both orders once, same tips and records), wallet = opening + ledger",
    f.completed &&
      clean(f) &&
      f.orderPayCents === ref.orderPayCents &&
      f.tipCents === ref.tipCents &&
      same(f.recipeProgress, ref.recipeProgress),
    { end: comparable(f), ref: comparable(ref) },
  );
}

// ───────── S5: reload after a completed order served by hand ─────────
if (run("S5")) {
  const seed = seedFor(L33, false);
  await boot(page, seed);
  await sleep(2500);
  const before = await readSave(page);
  const first = await driveService(page, { maxMs: 300000, cook: true, stopAfter: /^Serve to / });
  await sleep(2500);
  const afterServe = await readSave(page);
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(3000);
  const afterReload = await readSave(page);
  const f1 = facts(before, afterReload, 33);
  info("S5-mid", f1);
  check(
    "S5a reload after the first order was served: exactly one order paid, wallet = opening + ledger, same as before the reload",
    first.ok !== false &&
      (afterReload.levelProgress.paidOrders?.["level-33"] ?? []).length === 1 &&
      same(comparable(facts(before, afterServe, 33)), comparable(f1)) &&
      clean(f1),
    f1,
  );
  const rest = await driveService(page, { maxMs: 360000, cook: true });
  await sleep(4000);
  const end = await readSave(page);
  const f2 = facts(before, end, 33);
  info("S5-end", f2);
  const ref5 = await referenceS2();
  check(
    "S5b continuing finishes the level and pays EXACTLY what an uninterrupted manual service pays (both orders once)",
    f2.completed &&
      clean(f2) &&
      f2.orderPayCents === ref5.orderPayCents &&
      f2.tipCents === ref5.tipCents &&
      rest.ok !== undefined,
    { end: comparable(f2), ref: comparable(ref5) },
  );
}

/** Plays a manual Level 32 service up to the Serve card: the Prep Cook has cut the plate and it is recorded, but not served yet. Returns true when the card is there. */
async function toServeCard() {
  const r = await driveService(page, { maxMs: 200000, cook: true, holdAtServe: true });
  return r.heldAtServe === true;
}

// ───────── S6: interrupted service ─────────
if (run("S6")) {
  await boot(page, seedFor(L32, false));
  await sleep(2500);
  const before = await readSave(page);
  const atCard = await toServeCard();
  await sleep(1200);
  const saved = await readSave(page);
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(3000);
  const mid = await readSave(page);
  const fm = facts(before, mid, 32);
  info("S6-mid", fm);
  check(
    "S6a the plate is cut and recorded (recipe book, chef record) before serving",
    atCard &&
      Object.keys(saved.recipeProgress ?? {}).length === 1 &&
      saved.business.chefRecord?.plates === 1,
    { atCard, rp: saved.recipeProgress, plates: saved.business.chefRecord?.plates },
  );
  check(
    "S6b reload before serving: nothing was paid, no money moved, the stock is untouched, the plate stays recorded",
    fm.orderPayCents === 0 &&
      fm.creditsDelta === 0 &&
      fm.cashOnTable === null &&
      clean(fm) &&
      mid.business.chefRecord?.plates === 1,
    fm,
  );
  await driveService(page, { maxMs: 400000, cook: true });
  await sleep(4000);
  const end = await readSave(page);
  const f = facts(before, end, 32);
  info("S6-end", f);
  check(
    "S6c serving afterwards pays the one order once (same as an uninterrupted service) and the chef record counts the service once",
    f.completed &&
      f.orderPayCents === 24000 &&
      f.tipCents === 1500 &&
      clean(f) &&
      f.chefRecord?.services === 1,
    f,
  );
}

// ───────── S7: repeated serve attempts ─────────
if (run("S7")) {
  await boot(page, seedFor(L32, false));
  await sleep(2500);
  const before = await readSave(page);
  const atCard = await toServeCard();
  // three clicks land in the same tick: the screen's latch lets ONE through
  const clicks = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        /^Serve to/.test(x.textContent.trim().replace(/^\S+\s/, "")) ||
        /^Serve to/.test(x.textContent.trim()),
    );
    if (!b) return 0;
    b.click();
    b.click();
    b.click();
    return 3;
  });
  await sleep(3500);
  const mid = await readSave(page);
  const fm = facts(before, mid, 32);
  info("S7-mid", fm);
  check(
    "S7a three Serve clicks in one tick pay the order ONCE (one settlement and one tip on the table, the order recorded once)",
    atCard &&
      clicks === 3 &&
      fm.orderPayCents === 24000 &&
      fm.tipCents === 1500 &&
      (mid.levelProgress.paidOrders?.["level-32"] ?? []).length === 1 &&
      clean(fm),
    fm,
  );
  await driveService(page, { maxMs: 300000, cook: true });
  await sleep(4000);
  const f = facts(before, await readSave(page), 32);
  info("S7-end", f);
  check(
    "S7b finishing the level afterwards pays nothing extra (still one order's pay and tip)",
    f.completed && f.orderPayCents === 24000 && f.tipCents === 1500 && clean(f),
    f,
  );
}

// ───────── S8: a dare and Auto ─────────
if (run("S8")) {
  const day = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const dared = {
    business: {
      chefRecord: { challenge: { day, id: "no-mercy", state: "accepted", progress: 3 } },
    },
  };
  const m = await play("S8-manual", seedFor(L32, false, {}, dared.business), { cook: true }, 32);
  const a = await play("S8-auto", seedFor(L32, true, {}, dared.business), { auto: true }, 32);
  check(
    "S8 the same taken dare ends the same by hand and on Auto (a plain Honest plate breaks a No Mercy run in both), and the record counts the plate once",
    same(m.f.chefRecord, a.f.chefRecord) &&
      same(m.f.chefRecord?.challenge, a.f.chefRecord?.challenge),
    {
      manual: m.f.chefRecord,
      auto: a.f.chefRecord,
    },
  );
}

// ───────── S9: a MENU GUEST (the optional guest after the level's own orders), by hand and on Auto ─────────
if (run("S9")) {
  // Level 32's two menu guests order Caprese Skewers and Tomato Basil Toast (menuGuestQueue): they are only offered when their food is in the fridge ("Menu guest wants X: not in stock" is a disabled button otherwise).
  const G32 = {
    level: 32,
    ingredients: ["garlic", "ginger", "tomato", "mozzarella", "basil", "bread"],
    quantity: 40,
  };
  const guestFacts = (f) => ({
    creditsDelta: f.creditsDelta,
    ledgerByCategory: f.ledgerByCategory,
    ledgerSumByCategory: f.ledgerSumByCategory,
    menuGuestsServed: f.menuGuestsServed,
    orderPayCents: f.orderPayCents,
    tipCents: f.tipCents,
    tableCash: f.tableCash,
    recipeProgress: f.recipeProgress,
    chefRecord: f.chefRecord,
    stock: f.stock,
  });
  // by hand: the required order (Serve), then the guest button, the cook, Serve on the guest
  await boot(page, seedFor(G32, false));
  await sleep(2500);
  const b1 = await readSave(page);
  let nServe = 0;
  const m1 = await driveService(page, {
    maxMs: 300000,
    cook: true,
    guests: true,
    stopAfter: { test: (l) => /^Serve to /.test(l) && ++nServe === 2 },
  });
  await sleep(3500);
  const fm = facts(b1, await readSave(page), 32);
  info("S9-manual", fm);
  check(
    "S9a by hand: a menu guest was offered, cooked and served; it paid once (one revenue entry), wallet = opening + ledger, no duplicate id",
    !!m1.stoppedAfter && fm.menuGuestsServed === 1 && clean(fm),
    { stoppedAfter: m1.stoppedAfter ?? null, ...guestFacts(fm) },
  );

  // on Auto: the game presses the guest button itself; read the save the moment the first guest is paid
  await boot(page, seedFor(G32, true));
  await sleep(2500);
  const b2 = await readSave(page);
  const d2 = driveService(page, { maxMs: 300000, auto: true });
  d2.catch(() => {});
  const mid = await until((s) => (s.levelProgress.menuGuests?.["level-32"] ?? 0) >= 1, 280000, 250);
  const fa = mid ? facts(b2, mid, 32) : null;
  info("S9-auto", fa);
  await page.goto("about:blank");
  check(
    "S9b on Auto: the menu guest was served by the game itself and paid once, wallet = opening + ledger, no duplicate id",
    !!fa && fa.menuGuestsServed === 1 && clean(fa),
    fa && guestFacts(fa),
  );
  check(
    "S9c Auto = by hand for the guest: pay, ledger entries and sums, plate records, recipe progress, stock and wallet are identical",
    !!fa && same(guestFacts(fm), guestFacts(fa)),
    { manual: guestFacts(fm), auto: fa && guestFacts(fa) },
  );

  // repeated serving and a reload on the guest's card
  await boot(page, seedFor(G32, false));
  await sleep(2500);
  const b3 = await readSave(page);
  let n3 = 0;
  await driveService(page, {
    maxMs: 300000,
    cook: true,
    guests: true,
    stopAfter: { test: (l) => /^Serve to /.test(l) && ++n3 === 1 },
  });
  const hold = await driveService(page, {
    maxMs: 300000,
    cook: true,
    guests: true,
    holdAtServe: true,
  });
  const clicks = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        x.getBoundingClientRect().width > 0 &&
        (/^Serve to/.test(x.textContent.trim()) ||
          /^Serve to/.test(x.textContent.trim().replace(/^\S+\s/, ""))),
    );
    if (!b) return 0;
    b.click();
    b.click();
    b.click();
    return 3;
  });
  await sleep(3500);
  const fc = facts(b3, await readSave(page), 32);
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(3500);
  const fr = facts(b3, await readSave(page), 32);
  info("S9-repeat", { fc, fr });
  check(
    "S9d three Serve clicks on the guest's card pay the guest ONCE, and the result equals the single serve by hand",
    hold.heldAtServe === true &&
      clicks === 3 &&
      fc.menuGuestsServed === 1 &&
      clean(fc) &&
      same(guestFacts(fc), guestFacts(fm)),
    { held: hold.heldAtServe, clicks, repeat: guestFacts(fc), single: guestFacts(fm) },
  );
  // Reloading on the guest's card (every required order and the guest are paid) lets the game complete the level on load: the completion reward is paid ONCE and the guest counter
  // resets, while nothing already paid is paid again and the cash on the tables is exactly as it was.
  const rewards = fr.ledgerByCategory["completion-reward"] ?? 0;
  check(
    "S9e reload after the guest was paid: nothing is paid again (same table cash piece by piece, same recipe book and records), the level's completion reward is paid at most once (the game completes the level on load; whether it already has when the save is read is a matter of seconds), wallet = opening + ledger",
    same(fr.tableCash, fc.tableCash) &&
      same(fr.recipeProgress, fc.recipeProgress) &&
      same(fr.chefRecord?.plates, fc.chefRecord?.plates) &&
      same(fr.stock, fc.stock) &&
      rewards <= 1 &&
      Object.keys(fr.ledgerByCategory).every((k) => k === "completion-reward") &&
      clean(fr),
    { tableCashBefore: fc.tableCash, tableCashAfter: fr.tableCash, ledger: fr.ledgerByCategory },
  );
}

// ───────── S10: collecting the cash of a menu-guest service: one ledger entry per kind ─────────
if (run("S10")) {
  const G32 = {
    level: 32,
    ingredients: ["garlic", "ginger", "tomato", "mozzarella", "basil", "bread"],
    quantity: 40,
  };
  await boot(page, seedFor(G32, false));
  await sleep(2500);
  const b4 = await readSave(page);
  let n4 = 0;
  await driveService(page, {
    maxMs: 300000,
    cook: true,
    guests: true,
    stopAfter: { test: (l) => /^Serve to /.test(l) && ++n4 === 1 },
  });
  await driveService(page, { maxMs: 300000, cook: true, guests: true, holdAtServe: true });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find(
      (x) =>
        /^Serve to/.test(x.textContent.trim()) ||
        /^Serve to/.test(x.textContent.trim().replace(/^\S+\s/, "")),
    );
    if (b) {
      b.click();
      b.click();
      b.click();
    }
  });
  await sleep(3500);
  await page.reload({ waitUntil: "networkidle0" });
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("button")].some(
          (x) =>
            x.getBoundingClientRect().width > 0 &&
            /on the table/.test(x.textContent) &&
            /Collect/.test(x.textContent),
        ),
      { timeout: 30000 },
    )
    .catch(() => {});
  const collected = await page.evaluate(() => {
    const x = [...document.querySelectorAll("button")].find(
      (y) =>
        y.getBoundingClientRect().width > 0 &&
        /on the table/.test(y.textContent) &&
        /Collect/.test(y.textContent),
    );
    x?.click();
    return !!x;
  });
  await sleep(2500);
  const fc = facts(b4, await readSave(page), 32);
  await page.reload({ waitUntil: "networkidle0" });
  await sleep(3500);
  const fc2 = facts(b4, await readSave(page), 32);
  info("S10", { fc, fc2 });
  const sm = fc.ledgerSumByCategory;
  const lc = fc.ledgerByCategory;
  check(
    "S10a collecting the table cash of the guest service: the order's pay ($240.00), its tip ($15.00) and the guest's revenue each become exactly ONE ledger entry, nothing is left on the tables, wallet = opening + ledger, no duplicate id",
    collected &&
      lc["campaign-settlement"] === 1 &&
      lc["customer-tip"] === 1 &&
      lc["business-revenue"] === 1 &&
      sm["campaign-settlement"] === 24000 &&
      sm["customer-tip"] === 1500 &&
      sm["business-revenue"] > 0 &&
      fc.tableCash.length === 0 &&
      clean(fc),
    { collected, ledger: lc, sums: sm, creditsDelta: fc.creditsDelta, tableCash: fc.tableCash },
  );
  check(
    "S10b the level's completion reward is paid at most once, and a reload after collecting changes nothing (same ledger, same wallet)",
    (lc["completion-reward"] ?? 0) <= 1 &&
      same(fc2.ledgerByCategory, fc.ledgerByCategory) &&
      fc2.creditsDelta === fc.creditsDelta &&
      clean(fc2),
    { before: fc.ledgerByCategory, after: fc2.ledgerByCategory },
  );
}

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("0 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\n${failed.length} FAILED`
    : BASELINE
      ? "\nBASELINE (nothing asserted)"
      : "\nALL PASS",
);
process.exit(failed.length ? 1 : 0);
