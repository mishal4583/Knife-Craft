// The ORIGINAL read-only reproduction of the Prep Cook Auto defect (release verification, 2026-11-24): kept as found. tools/e2e/autoservice.mjs is the full test (AUTO_BASELINE=1 prints the numbers without asserting).
// READ-ONLY reproduction for the Prep Cook Auto persistence investigation (release verification phase, 2026-11-24). It only plays the real game and reads the save.
// Same seed, same level (32), two ways: M = the Prep Cook's button (manual serve), A = Auto on. For each it prints the invariants a persistence bug would break.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, readSave, sleep } from "./harness.mjs";
import { driveService, serviceSave } from "./servicedrive.mjs";

const COOK = {
  level: 32,
  ingredients: ["garlic", "ginger"],
  business: { staff: { hiredRoles: ["server", "cashier", "prep-cook"] } },
  seedSave,
  MOVED_IN_BUSINESS,
};
const { browser, page } = await launch();
const sum = (a) => a.reduce((n, e) => n + e.amount, 0);
const stockOf = (s) =>
  Object.fromEntries(Object.entries(s.business.inventory ?? {}).map(([k, v]) => [k, v.quantity]));

async function run(name, auto) {
  const seed = serviceSave({ ...COOK, top: { settings: { autoService: auto } } });
  await boot(page, seed);
  await sleep(2500);
  const before = await readSave(page);
  const r = await driveService(page, {
    maxMs: 400000,
    ...(auto ? { auto: true } : { cook: true }),
  });
  await sleep(4000);
  const after = await readSave(page);
  const newEntries = after.economyLedger.slice(before.economyLedger.length);
  const byCat = {};
  for (const e of newEntries) byCat[e.category] = (byCat[e.category] ?? 0) + 1;
  const paidOrders = Object.values(after.levelProgress?.paidOrders ?? {}).flat().length;
  const delta = after.credits - before.credits;
  const invariantOk = before.credits + sum(newEntries) === after.credits;
  const ids = after.economyLedger.map((e) => e.id);
  const dup = ids.length - new Set(ids).size;
  const out = {
    name,
    driveOk: r.ok,
    creditsDeltaCents: delta,
    ledgerSumCents: sum(newEntries),
    walletEqualsOpeningPlusLedger: invariantOk,
    duplicateLedgerIds: dup,
    newLedgerByCategory: byCat,
    paidOrderRecords: paidOrders,
    recipeProgressKeys: Object.keys(after.recipeProgress ?? {}).length,
    chefRecordPlates: after.business.chefRecord?.plates ?? null,
    servicesRecorded: after.business.chefRecord?.services ?? null,
    stockBefore: stockOf(before),
    stockAfter: stockOf(after),
    autoServiceSetting: after.settings?.autoService,
    tableCashOwed: after.business?.pendingCash ?? null,
  };
  console.log("RESULT " + JSON.stringify(out));
  return out;
}
await run("M-button", false);
await run("A-auto", true);
await browser.close();
