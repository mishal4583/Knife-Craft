/**
 * LAZY LOAD QA — the Restaurant screens are their own lazily loaded chunk
 * (task #24): the back office, Restaurant Service and Inventory (with the
 * fridge) load the first time the player opens one, never at startup or in
 * the campaign. Routes, props and behaviour are unchanged.
 *
 *  L1 ScreensRouter imports none of the three statically; each is
 *     React.lazy from ONE module (kc/restaurantScreens.ts), inside Suspense
 *     with the "Opening the restaurant…" state (never blank).
 *  L2 nothing outside the Restaurant UI imports the business/inventory screen
 *     components (which would pull them back into an earlier chunk).
 *  L3 the production build (dist/, when present): a restaurantScreens-*.js
 *     chunk exists, holds the back office / fridge UI, and index.html neither
 *     loads nor preloads it; the startup chunks don't contain that UI.
 *  Browser: tools/e2e/lazyload.mjs (start → campaign → Restaurant → Inventory,
 *  Staff, Suppliers, Market → campaign).
 *
 * Run: npx tsx scripts/lazy-load-qa.mts   (after `npm run build` for L3)
 */
import fs from "node:fs";
import path from "node:path";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
const read = (p: string) => fs.readFileSync(p, "utf8");

const router = read("src/ScreensRouter.tsx");
assert(
  !/^import \{[^}]*\b(BusinessDashboard|BusinessService|InventoryScreen)\b[^}]*\} from/m.test(
    router.replace(/import type[^;]+;/g, ""),
  ) &&
    /const loadRestaurantScreens = \(\) => import\("@\/components\/kc\/restaurantScreens"\)/.test(
      router,
    ) &&
    (router.match(/lazy\(\(\) =>\s*loadRestaurantScreens\(\)/g) ?? []).length === 3 &&
    (router.match(/<Suspense fallback=\{<RestaurantLoading/g) ?? []).length === 3 &&
    /Opening the restaurant…/.test(router),
  "L1: the three Restaurant screens are lazy from one module, each in Suspense with a loading state",
);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}
const SCREEN = /from ["'][^"']*\/(BusinessDashboard|BusinessService|InventoryScreen)["']/;
const offenders = walk("src").filter((f) => {
  const rel = f.split(path.sep).join("/");
  if (
    rel.startsWith("src/components/kc/business/") ||
    rel.startsWith("src/components/kc/inventory/")
  )
    return false;
  if (rel === "src/components/kc/restaurantScreens.ts") return false;
  const code = read(f).replace(/import type[^;]+;/g, "");
  return SCREEN.test(code);
});
assert(
  offenders.length === 0,
  `L2: nothing else imports the screens statically (${offenders.join(", ") || "none"})`,
);

if (fs.existsSync("dist/index.html")) {
  const html = read("dist/index.html");
  const assets = fs.readdirSync("dist/assets");
  const chunk = assets.find((f) => /^restaurantScreens-.*\.js$/.test(f));
  const startup = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.js)"/g)].map((m) => m[1]!);
  const chunkCode = chunk ? read(`dist/assets/${chunk}`) : "";
  assert(
    !!chunk &&
      /Today's supplier conditions/.test(chunkCode) &&
      /kcf-pager/.test(chunkCode) &&
      !startup.includes(chunk) &&
      !html.includes("restaurantScreens") &&
      startup.every((f) => !/Today's supplier conditions|kcf-pager/.test(read(`dist/assets/${f}`))),
    `L3: dist has ${chunk ?? "no restaurantScreens chunk"}; startup loads ${startup.join(", ")} — none of them carries the Restaurant UI`,
  );
} else console.log("  (L3 skipped: no dist/ — run npm run build first)");

console.log(failures ? `LAZY LOAD QA: ${failures} FAILURE(S)` : "LAZY LOAD QA: ALL PASS");
process.exit(failures ? 1 : 0);
