/**
 * BUSINESS UI REDESIGN QA (developer 2026-11-25: "make the Business UI pages exactly like this in the document";
 * docs/planning/BUSINESS-UI-REDESIGN-PLAN-2026-11-25.md, docs/planning/BUSINESS-UI-CODEX-PROMPTS-2026-11-25.md).
 *
 *  A  every "biz:<sheet>/<slug>" picture the pages name is a real picture of scripts/business-sheets.json (the Codex sheets), and the sheet list is complete and consistent;
 *  B  the Business art loader draws a picture only when its file exists and never when it is missing or failed (the pages fall back to today's emoji and drawings);
 *  C  the developer's two notes: each kitchen card prints its own description; the Menu uses the game's own dish pictures (public/dishes) with the emoji as the fallback;
 *  D  nothing the pages showed is lost: the test ids the old tests read are all still there, the supplier events list moved behind an info tip, the Business tabs keep their six pages;
 *  E  the pages are display only: no wallet, ledger, random or clock in the kit, and the Pace card still says shift hour / real clock;
 *  F  the delivered pictures (when there are any) stay inside the image budget (whole folder under 2 MB, each file under 90 KB).
 *
 * Run: npx tsx scripts/business-ui-redesign-qa.mts
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { BUSINESS_ART_FILES } from "../src/game/businessArtFiles.ts";
import {
  BUSINESS_ART_PREFIX,
  businessArtUrl,
  hasBusinessArt,
  markBusinessArtFailed,
} from "../src/game/businessArt.ts";
import { KITCHEN_UPGRADE_CATALOG } from "../src/game/kitchen/kitchenUpgradeDefinitions.ts";

let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const read = (p: string) => readFileSync(p, "utf8");
const sheets = JSON.parse(read("scripts/business-sheets.json")).sheets as Record<
  string,
  { cols: number; rows: number; cell: [number, number]; slugs: string[]; square?: boolean }
>;
const dir = "src/components/kc";
const files = {
  pace: read(`${dir}/business/PaceCard.tsx`),
  dash: read(`${dir}/business/BusinessDashboard.tsx`),
  fridge: read(`${dir}/business/BusinessRefrigerator.tsx`),
  suppliers: read(`${dir}/business/BusinessSuppliers.tsx`),
  menu: read(`${dir}/business/BusinessMenu.tsx`),
  finance: read(`${dir}/business/BusinessFinance.tsx`),
  history: read(`${dir}/business/BusinessHistory.tsx`),
  analytics: read(`${dir}/business/BusinessAnalytics.tsx`),
  inspections: read(`${dir}/business/BusinessInspections.tsx`),
  upgrades: read(`${dir}/KitchenUpgrades.tsx`),
  picker: read(`${dir}/restaurant/IngredientSupplier.tsx`),
  deliveries: read(`${dir}/restaurant/Deliveries.tsx`),
  kit: read(`${dir}/business/BizKit.tsx`),
};

console.log("A. The pictures the pages name exist in the sheet list");
{
  const known = new Set<string>();
  for (const [id, s] of Object.entries(sheets))
    for (const slug of s.slugs) known.add(`${id}/${slug}`);
  const named = new Set<string>();
  const unknown: string[] = [];
  for (const [file, src] of Object.entries(files)) {
    for (const m of src.matchAll(
      /"biz:((?:icons-a|icons-b|icons-c|fridges|pieces|decor-a|decor-b|decor-c|banners)\/[a-z0-9-]+)"/g,
    )) {
      named.add(m[1]!);
      if (!known.has(m[1]!)) unknown.push(`${file}: ${m[1]}`);
    }
  }
  assert(
    named.size >= 40,
    `A1: the pages name a good set of Business pictures (${named.size})`,
    named.size,
  );
  assert(
    unknown.length === 0,
    "A2: every named picture is in scripts/business-sheets.json",
    unknown,
  );
  // the pictures built from a template
  const templated: [string, string[]][] = [
    ["biz:fridges/", ["basic", "commercial", "professional"]],
    ["biz:icons-c/", ["salad", "appetizer", "entree", "side", "curry", "dessert", "stir-fry"]],
  ];
  const missing = templated.flatMap(([prefix, tails]) =>
    tails
      .filter((t) => !known.has(prefix.slice(BUSINESS_ART_PREFIX.length) + t))
      .map((t) => prefix + t),
  );
  assert(
    missing.length === 0,
    "A3: the templated pictures (the three fridges, the seven dish categories) all have a slot",
    missing,
  );
  // the seven categories are the game's own seven
  const dishFile = read("src/game/business/businessDishCatalog.ts");
  const cats = [...new Set([...dishFile.matchAll(/category: "([A-Za-z-]+)"/g)].map((m) => m[1]!))];
  assert(
    cats.length === 7 && cats.every((c) => known.has(`icons-c/${c.toLowerCase()}`)),
    "A4: every dish category the game has (Salad, Appetizer, Entree, Side, Curry, Dessert, Stir-Fry) has its painted icon slot",
    cats,
  );
  // the seven inspection checks
  const insp = files.inspections;
  assert(
    ["snowflake", "hourglass", "ice-cube", "wrench", "broom", "shield"].every((s) =>
      insp.includes(s),
    ) &&
      /STAFF_COMPLIANCE: "icons-b\/people"/.test(insp) &&
      /badge-ok/.test(insp) &&
      /badge-warn/.test(insp) &&
      /badge-bad/.test(insp),
    "A5: the seven inspection checks and their three status badges have pictures",
  );
  // sheets fit their grids and the sheet list matches the prompts file
  const bad = Object.entries(sheets).filter(([, s]) => s.slugs.length > s.cols * s.rows);
  assert(
    bad.length === 0,
    "A6: every sheet's pictures fit its grid",
    bad.map(([k]) => k),
  );
  const prompts = read("docs/planning/BUSINESS-UI-CODEX-PROMPTS-2026-11-25.md");
  const promptMismatch: string[] = [];
  for (const [id, s] of Object.entries(sheets)) {
    const sec = prompts.split(`## RB-${id}:`)[1]?.split("\n---")[0] ?? "";
    const names = [...sec.matchAll(/^\d+\. ([A-Z][A-Z0-9-]+)/gm)].map((m) => m[1]!);
    if (names.join() !== s.slugs.map((x) => x.toUpperCase()).join()) promptMismatch.push(id);
  }
  assert(
    promptMismatch.length === 0,
    "A7: the Codex prompts list every sheet's pictures in the same order as the sheet list",
    promptMismatch,
  );
  assert(
    Object.values(sheets).reduce((n, s) => n + s.slugs.length, 0) === 79 &&
      Object.keys(sheets).length === 9,
    "A8: 9 sheets, 79 pictures (the plan's count)",
  );
}

console.log("B. The loader never draws a picture that is not there");
{
  const first = BUSINESS_ART_FILES[0];
  assert(
    !hasBusinessArt("icons-a/definitely-not-a-picture") &&
      businessArtUrl("icons-a/definitely-not-a-picture") === null,
    "B1: an unknown picture is not drawn",
  );
  if (first) {
    assert(
      hasBusinessArt(first) && businessArtUrl(first)!.endsWith(`business/art/${first}.webp`),
      "B2: a listed picture has its URL",
    );
    markBusinessArtFailed(first);
    assert(
      !hasBusinessArt(first) && businessArtUrl(first) === null,
      "B3: a picture that failed to load is not drawn again",
    );
  } else assert(true, "B2/B3: no picture delivered yet: every slot shows today's emoji or drawing");
  assert(
    /startsWith\(BUSINESS_ART_PREFIX\)/.test(read(`${dir}/progress/ProgressKit.tsx`)) &&
      /onError/.test(read(`${dir}/progress/ProgressKit.tsx`)),
    "B4: the shared Art component routes the biz: prefix to this loader and falls back on a load error",
  );
  const noEmptyFallback = Object.entries(files)
    .filter(([, s]) => /fallback=""/.test(s))
    .map(([k]) => k);
  assert(
    noEmptyFallback.length === 0,
    "B5: no icon slot is left blank while its picture is missing (every PIcon has a fallback)",
    noEmptyFallback,
  );
}

console.log("C. The developer's two notes");
{
  assert(
    /data-testid="kitchen-description"/.test(files.upgrades) &&
      /\{u\.description\}/.test(files.upgrades) &&
      /\{selected\.description\}/.test(files.upgrades),
    "C1: every kitchen card and the header print the upgrade's own description",
  );
  assert(
    KITCHEN_UPGRADE_CATALOG.length === 6 &&
      KITCHEN_UPGRADE_CATALOG.every(
        (u) => u.description.trim().length > 20 && u.tagline.trim().length > 3,
      ),
    "C2: all six kitchens have a description and a tagline to show",
  );
  assert(
    /dishArtUrl\(recipeId\)/.test(files.menu) &&
      /import \{ dishArtUrl \} from "@\/game\/dishArt"/.test(files.menu) &&
      /data-dish-photo=/.test(files.menu) &&
      /recipe\?\.emoji/.test(files.menu),
    "C3: the Menu shows the game's own dish picture and keeps the emoji for a dish without one",
  );
  const dishes = readdirSync("public/dishes").filter((f) => f.endsWith(".webp"));
  assert(
    dishes.length >= 200,
    `C4: the dish pictures exist (${dishes.length} in public/dishes)`,
    dishes.length,
  );
}

console.log("D. Nothing the pages showed is lost");
{
  const ids: [string, string[]][] = [
    [
      "pace",
      [
        'data-testid="pace-card"',
        'data-testid="pace-guests"',
        'data-testid="pace-guests-parts"',
        'data-testid="pace-last-stars"',
        'data-testid="pace-floor"',
        'data-testid="pace-empty"',
      ],
    ],
    [
      "dash",
      [
        'data-testid="rank-card"',
        'data-testid="one-restaurant-note"',
        'data-testid="needs-attention"',
        'data-testid="alert-glance"',
        "View Restaurant Progress",
        "Open Service",
        "End Business Day",
      ],
    ],
    [
      "fridge",
      [
        'data-testid="your-refrigerator"',
        "data-fridge=",
        "Manage in the Market",
        "Kitchen equipment",
        "equipment-banner.webp",
        "Working well",
      ],
    ],
    [
      "suppliers",
      ["data-contract=", "Today's supplier conditions", "Sign contract", "Cancel contract"],
    ],
    [
      "picker",
      ['data-testid="ingredient-supplier"', "data-supplier=", 'data-testid="supplier-extras"'],
    ],
    ["deliveries", ['data-testid="standing-orders"', "data-standing-order=", "Turn on"]],
    [
      "menu",
      [
        'data-testid="menu-active-count"',
        'data-testid="menu-price"',
        'data-testid="menu-price-cap"',
        'data-testid="menu-locked"',
        "data-menu-dish=",
        "data-menu-switch=",
        'role="switch"',
        "data-dish-hot=",
      ],
    ],
    [
      "inspections",
      [
        'data-testid="inspection-summary"',
        'data-testid="inspection-open"',
        'data-testid="inspection-icons"',
      ],
    ],
    [
      "finance",
      [
        "Today so far",
        "Last business day",
        "Full all-time breakdown",
        "Full day breakdown",
        "Cash vs costs",
        "Orders served",
      ],
    ],
    ["history", ['data-testid="business-history"', "data-history-day=", "aria-expanded"]],
    [
      "analytics",
      [
        'data-testid="best-sellers"',
        'data-testid="purchasing"',
        'data-testid="most-used"',
        'data-testid="supplies-analytics"',
        "supplySectionSummary",
      ],
    ],
    [
      "upgrades",
      [
        'data-testid="kitchen-benefit"',
        "Current Kitchen",
        "Already upgraded past this",
        "Upgraded ✓",
        "kitchenTierPrice(selected, save)",
      ],
    ],
  ];
  const lost = ids.flatMap(([k, list]) =>
    list.filter((s) => !files[k as keyof typeof files].includes(s)).map((s) => `${k}: ${s}`),
  );
  assert(
    lost.length === 0,
    "D1: every test id and phrase the old tests and browser tests read is still on its page",
    lost,
  );
  assert(
    !/Possible supplier events/.test(
      files.suppliers.replace(
        /label="Possible supplier events"|Possible supplier events<\/span>/g,
        "",
      ),
    ),
    "D2: the supplier events list is not printed on the page any more: it is behind the info tip of Today's supplier conditions",
  );
  assert(
    /label="Possible supplier events"/.test(files.suppliers) &&
      /SUPPLIER_EVENT_CATALOG/.test(files.suppliers),
    "D3: ...and it is still there (inside the info tip)",
  );
  const tabs = read(`${dir}/business/BusinessDashboard.tsx`);
  assert(
    ["overview", "equipment", "development", "staff", "suppliers", "menu", "operations"].every(
      (t) => new RegExp(`id: "${t}"`).test(tabs),
    ),
    "D4: the Business tabs are the same seven (Staff keeps its look)",
  );
  assert(
    /BusinessSectionBanner image="staff-banner\.webp"/.test(
      read(`${dir}/business/BusinessStaff.tsx`),
    ),
    "D5: the Staff tab (not in the developer's document) is untouched",
  );
}

console.log("E. Display only");
{
  assert(
    !/credits|spendCents|ledger|Math\.random|Date\.now|new Date|localStorage|window\.bridge/.test(
      files.kit,
    ),
    "E1: the Business kit touches no wallet, ledger, random, clock or storage",
  );
  assert(
    /shift hour/.test(files.pace) && /real clock/.test(files.pace),
    "E2: the Pace card still says the restaurant is per shift hour and the floor per real clock",
  );
  assert(
    !/purchase|buyKitchen|signSupplier|setMenuPrice\(/.test(files.kit),
    "E3: the kit has no purchase logic (every action stays in the page's own handlers)",
  );
}

console.log("F. Image budget");
{
  const root = "public/business/art";
  let total = 0;
  let biggest = 0;
  let count = 0;
  if (existsSync(root)) {
    for (const sheet of readdirSync(root)) {
      const d = join(root, sheet);
      if (!statSync(d).isDirectory()) continue;
      for (const f of readdirSync(d)) {
        const sz = statSync(join(d, f)).size;
        total += sz;
        biggest = Math.max(biggest, sz);
        count++;
      }
    }
  }
  assert(
    total <= 2048 * 1024 && biggest <= 90 * 1024,
    `F1: ${count} pictures, ${Math.round(total / 1024)} KB in total, biggest ${Math.round(biggest / 1024)} KB (limits 2048 KB / 90 KB)`,
  );
  assert(
    count === BUSINESS_ART_FILES.length,
    `F2: the generated list matches the files (${BUSINESS_ART_FILES.length} listed, ${count} on disk)`,
  );
}

// ---------- G. Card backgrounds (developer 2026-11-25: a blurred photo behind the City ranking and Opening briefing wood cards) ----------
{
  const names = ["ranking", "briefing"] as const;
  for (const n of names)
    for (const v of ["wide", "tall"]) {
      const f = `public/business/bg/${n}-${v}.webp`;
      assert(
        existsSync(f) && statSync(f).size <= 90 * 1024,
        `G1: ${f} exists and is at most 90 KB`,
      );
    }
  const kit = read("src/components/kc/progress/ProgressKit.tsx");
  assert(
    /export function CardBackdrop/.test(kit) && /onError=\{\(\) => setBad\(true\)\}/.test(kit),
    "G2: CardBackdrop hides itself when a picture fails (the card keeps its wood)",
  );
  assert(
    /<CardBackdrop name="ranking" \/>/.test(read("src/components/kc/CityRanking.tsx")) &&
      /wood/.test(read("src/components/kc/CityRanking.tsx")),
    "G3: the City ranking hero has the backdrop and keeps its wood",
  );
  const dm = read("src/components/kc/DailyMaintenance.tsx");
  assert(
    /<CardBackdrop name="briefing" \/>/.test(dm) && /data-testid="opening-briefing"/.test(dm),
    "G4: the Opening briefing card has the backdrop",
  );
}

console.log(
  failures === 0
    ? "\nBUSINESS UI REDESIGN QA: ALL PASS"
    : `\nBUSINESS UI REDESIGN QA: ${failures} FAIL`,
);
process.exit(failures === 0 ? 0 : 1);
