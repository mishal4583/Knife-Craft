// Technique realism (developer 2026-11-25: "sliced and diced beef: only one steak is present and it is only diced"; "it shows rock mince and while cutting it only requires slicing"), restaurant build, REAL gameplay:
//   R1  Level 32 (Garlic & Ginger Curry Paste): the garlic and the ginger are Rock Minced in 10 cuts (a fine grid, both ways), not the 12 parallel taps that played like Slice;
//   R2  Level 18, Sliced & Diced Steak: the steak is sliced in 12 cuts, then dicing starts on a FRESH whole steak (the board shows a whole steak again, not the sliced one), 6 dice cuts, and the
//       order card reads "Slice one steak, then dice a fresh one for the bowl";
//   R3  the steak is really used (the stock falls; that the dish counts TWO steaks is proven by technique-realism-qa E1);
//   R4  no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, boot, launch, seedSave, sleep, readSave } from "./harness.mjs";
import { driveService, serviceSave } from "./servicedrive.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();

/** Plays a real service by hand and records every change of what the cutting screen asks for. */
async function watch(level, ingredients, roles, maxMs, onChange) {
  await boot(
    page,
    serviceSave({
      level,
      ingredients,
      quantity: 30,
      business: { staff: { hiredRoles: roles } },
      top: { settings: { autoService: false } },
      seedSave,
      MOVED_IN_BUSINESS,
    }),
  );
  await sleep(2500);
  const before = await readSave(page);
  const seen = [];
  let last = "";
  const poll = setInterval(async () => {
    try {
      const t = await page.evaluate(() => {
        const body = document.body.innerText;
        const m = body.match(/([A-Za-z][A-Za-z ]*?)\s*·\s*(\d+)\/(\d+)\s+([a-z-]+)/i);
        const order = (body.match(/([A-Z][A-Z' ]+)'S ORDER\s*\n?\s*([^\n]+)/) || [])[2] ?? "";
        const text =
          [...document.querySelectorAll("p,div")]
            .map((e) => (e.children.length === 0 ? e.textContent : ""))
            .find((x) => /Slice one steak|Rock-mince/i.test(x)) ?? "";
        return m
          ? {
              ing: m[1].trim(),
              n: Number(m[2]),
              m: Number(m[3]),
              tech: m[4].toLowerCase(),
              order,
              text,
            }
          : null;
      });
      if (t) {
        const key = `${t.order}|${t.ing}|${t.m}|${t.tech}`;
        if (key !== last) {
          last = key;
          seen.push(t);
          if (onChange) await onChange(t, seen);
        }
      }
    } catch {
      /* page between screens */
    }
  }, 250);
  const r = await driveService(page, { maxMs });
  clearInterval(poll);
  const after = await readSave(page);
  return { seen, r, before, after };
}

// ---------- R1: rock mince is a fine grid, 10 cuts ----------
{
  const { seen } = await watch(
    32,
    ["garlic", "ginger"],
    ["server", "cashier", "line-cook", "prep-cook"],
    120000,
  );
  const rock = seen.filter((s) => s.tech === "rock");
  check(
    "R1 Level 32: Rock Mince takes 10 cuts on both the garlic and the ginger (a fine grid), not 12 parallel taps",
    rock.length >= 2 &&
      rock.every((s) => s.m === 10) &&
      rock.some((s) => s.ing === "Garlic") &&
      rock.some((s) => s.ing === "Ginger"),
    rock.map((s) => `${s.ing} ${s.m}`),
  );
}

// ---------- R2 + R3: sliced and diced steak ----------
{
  let shot = false;
  const { seen, before, after } = await watch(
    18,
    ["steak", "mushroom", "cabbage", "onion"],
    ["server", "cashier"],
    240000,
    async (t) => {
      if (!shot && t.tech === "dice" && t.n === 0) {
        shot = true;
        await page.screenshot({ path: "out/techniquerealism-fresh-steak.png" });
      }
    },
  );
  const dish = seen.filter((s) => /Sliced & Diced Steak/i.test(s.order));
  const slice = dish.find((s) => s.ing.includes("Steak") && s.tech === "slice");
  const dice = dish.find((s) => s.ing.includes("Steak") && s.tech === "dice");
  check(
    "R2 Sliced & Diced Steak: the steak is sliced in 12 cuts, then diced in 6 (a second steak step)",
    !!slice && slice.m === 12 && !!dice && dice.m === 6,
    { slice: slice && slice.m, dice: dice && dice.m },
  );
  const card = await page.evaluate(() =>
    /Slice one steak, then dice a fresh one/i.test(document.body.innerText),
  );
  check(
    "R2b the order card tells the player to slice one steak and dice a fresh one (checked on the card text seen during play)",
    dish.some((s) => /fresh/i.test(s.text)) || card,
    {
      sawText: dish
        .map((s) => s.text)
        .filter(Boolean)
        .slice(0, 1),
    },
  );
  const steakBefore = before.business.inventory?.steak?.quantity ?? 0;
  const steakAfter = after.business.inventory?.steak?.quantity ?? 0;
  check(
    "R3 the steak stock fell during the service (the dishes really used it)",
    steakBefore - steakAfter > 0,
    { steakBefore, steakAfter },
  );
}

const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("R4 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
