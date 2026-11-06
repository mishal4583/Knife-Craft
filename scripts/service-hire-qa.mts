/**
 * SERVICE HIRE QA (developer 2026-11-07: "the cashier is the billing person... hire the Server when the food is ready and there is no
 * server, and a Cashier when the guest has eaten and there is no one to bill; make them both permanent and give the starting money to
 * hire them permanently"; restaurant/serviceHire.ts):
 *   A  the prompts: both while nobody is hired, one once the other is hired, none when both are; the fee is the hire fee
 *   B  the opening cash pays both fees plus the $10.00 for food, so the first service can always hire them
 *   C  the hire is the ordinary permanent paid hire: one wallet debit, one "staff-purchase" entry, kept on the team; a short wallet
 *      puts a required hire on supplier credit instead of leaving the player stuck
 *   D  the requirement: Level 1 does not stop for them (they are offered inside the service); from Level 2 the check requires both
 *   E  the wiring: the plate-ready moment asks for the Server, the finished meal asks for the Cashier, with ONE button (Hire) and no skip,
 *      App hires through one paid path, the Market card waits until Level 2, and the first-run walk has no Hire step
 *
 * Run: npx tsx scripts/service-hire-qa.mts
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
const H = await import("../src/game/restaurant/serviceHire.ts");
const SR = await import("../src/game/restaurant/staffRequirements.ts");
const ST = await import("../src/game/config/startingTeam.ts");
const { dollars } = await import("../src/game/money.ts");

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

const fresh = (): SaveData => ({
  ...structuredClone(DEFAULT_SAVE),
  story: { ...DEFAULT_SAVE.story, introDone: true },
});
const withRoles = (s: SaveData, roles: string[]): SaveData =>
  ({
    ...s,
    business: { ...s.business, staff: { ...s.business.staff, hiredRoles: roles } },
  }) as unknown as SaveData;

// ── A. The prompts ─────────────────────────────────────────────────────
{
  const s = fresh();
  const p = H.serviceHirePrompts(s, 1);
  check(
    "A1 a new game: both prompts, Server first in the team, each with its fee and a title, and no skip option",
    Object.keys(p).sort().join() === "cashier,server" &&
      p.server!.fee === SR.staffHireFee("server") &&
      p.cashier!.fee === SR.staffHireFee("cashier") &&
      /carry/i.test(p.server!.title) &&
      /till/i.test(p.cashier!.title) &&
      !("skip" in p.server!) &&
      !("skip" in p.cashier!),
    p,
  );
  const one = H.serviceHirePrompts(withRoles(s, ["server"]), 1);
  check(
    "A2 with the Server hired only the Cashier is asked for",
    Object.keys(one).join() === "cashier",
    one,
  );
  check(
    "A3 with both hired nothing is asked",
    Object.keys(H.serviceHirePrompts(withRoles(s, ["server", "cashier"]), 1)).length === 0,
  );
  check(
    "A4 both prompts are affordable from the opening cash",
    p.server!.affordable && p.cashier!.affordable,
  );
}

// ── B. The opening cash ────────────────────────────────────────────────
{
  const fees = ST.STARTING_TEAM_FEES;
  check(
    "B1 a new game starts with $10.00 for food plus both fees, so the hires are paid for from the start",
    DEFAULT_SAVE.credits === dollars(10) + fees &&
      DEFAULT_SAVE.credits - dollars(10) >=
        SR.staffHireFee("server")! + SR.staffHireFee("cashier")!,
    { credits: DEFAULT_SAVE.credits, fees },
  );
}

// ── C. The hire is the ordinary permanent paid hire ────────────────────
{
  const s0 = fresh();
  const server = SR.hireRestaurantStaff(s0, "server", 1, { required: true });
  const both = server.ok
    ? SR.hireRestaurantStaff(server.save, "cashier", 1, { required: true })
    : null;
  const entries = (s: SaveData) => s.economyLedger.filter((e) => e.category === "staff-purchase");
  check(
    "C1 hiring both in the first service: two staff-purchase entries, the fees leave the wallet, $10.00 is left for food",
    !!both &&
      both.ok &&
      entries(both.save).length === 2 &&
      both.save.credits === dollars(10) &&
      both.save.business.staff.hiredRoles.includes("server") &&
      both.save.business.staff.hiredRoles.includes("cashier"),
    both && both.ok ? { credits: both.save.credits } : both,
  );
  const broke = { ...fresh(), credits: 0 };
  const credit = SR.hireRestaurantStaff(broke, "server", 1, { required: true });
  check(
    "C2 a wallet that is short puts the hire on supplier credit: the player is hired, never stuck",
    credit.ok && credit.save.business.staff.hiredRoles.includes("server"),
    credit.ok ? { onCredit: (credit as { onCredit?: boolean }).onCredit } : credit,
  );
  check(
    "C3 hired for good: the role has no expiry (no day or hour field is set on the team)",
    both !== null &&
      both.ok &&
      JSON.stringify(both.save.business.staff).indexOf("expires") === -1 &&
      JSON.stringify(both.save.business.staff).indexOf("until") === -1,
  );
}

// ── D. The requirement ─────────────────────────────────────────────────
{
  const shape = { orders: 1, dineIn: 1, specialists: [], specialistCuisines: 0 };
  const need = (n: number) =>
    SR.staffRequirementsFor(fresh(), n, shape)
      .map((r) => r.id)
      .join();
  check(
    "D1 Level 1 does not stop for them; from Level 2 the check requires the Server and the Cashier",
    need(1) === "" && need(2) === "server,cashier" && need(9) === "server,cashier",
    { l1: need(1), l2: need(2) },
  );
}

// ── E. The wiring ──────────────────────────────────────────────────────
{
  const prep = read("src/components/kc/game/Preparation.tsx");
  const app = read("src/App.tsx");
  const sheet = read("src/components/kc/game/ServiceHireSheet.tsx");
  check(
    "E1 the plate-ready moment asks for the Server before it goes out; the finished meal asks for the Cashier",
    /askToHire\("server", \(\) => setFloorMode\("deliver"\)\)/.test(prep) &&
      /askToHire\("cashier"/.test(prep) &&
      /guestAte/.test(prep),
  );
  check(
    "E2 hiring is the only way on (the answer runs what was waiting), nothing offers a skip, and a role is asked once per customer",
    /const answerHire = \(\) =>/.test(prep) &&
      /hireAfter\.current = null;\s*next\?\.\(\)/.test(prep) &&
      /hireAsked\.current\.has\(role\)/.test(prep),
  );
  check(
    "E3 the card shows the person's portrait, the price and the hand on Hire; there is no skip button",
    /staffPortraitFile\(prompt\.role\)/.test(sheet) &&
      /formatUsd\(prompt\.fee\)/.test(sheet) &&
      /first-run-hand/.test(sheet) &&
      !/onSkip|prompt\.skip|Not now|I'll carry/.test(sheet) &&
      !/onSkip|Not now|I'll carry/.test(prep),
  );
  check(
    "E4 App hires through ONE paid path (hireRestaurantStaff, one wallet debit) and only offers it in a campaign service",
    /function hireInService/.test(app) &&
      /hireRestaurantStaff\(save, role, restaurantLevelOf\(save\.levelProgress\), \{\s*required: true,?\s*\}\)/.test(
        app,
      ) &&
      /RESTAURANT_MODE && isCampaignService && Object\.keys\(servicePrompts\)\.length > 0/.test(
        app,
      ),
  );
  const card = read("src/components/kc/restaurant/TeamHireCard.tsx");
  check(
    "E5 the Market's Hire card waits until Level 2 and has no first-run hand",
    /level < TEAM_CARD_FROM/.test(card) && H.TEAM_CARD_FROM === 2 && !/firstRunHand/.test(card),
  );
  const guide = read("src/game/restaurant/firstRunGuide.ts");
  check(
    "E6 the first-run walk has no Hire step",
    !/"hire"/.test(guide.replace(/\/\*[\s\S]*?\*\//g, "")) && !/teamOffers/.test(guide),
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
