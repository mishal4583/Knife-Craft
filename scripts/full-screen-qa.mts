/**
 * FULL SCREEN QA (developer 2026-11-16: "optimize these screens for all type of screen size and try to make it full screen without leaving any
 * space"). Source guards for the rule; the real-browser proof is tools/e2e/fullscreen.mjs.
 *
 *  F1 GameShell gives EVERY window the whole viewport (RULE CHANGE 2026-11-19, Playgama 1.6.1 / 1.6.8, YouTube Playables Design 1: no empty bars): an upright
 *     phone at its own size, anything else laid out by `fitLayout` and scaled to fill; the 9:16 frame is only for portrait-only screens (RULE CHANGE 2026-11-19); the notch is padded
 *  F2 the Kitchen's top HUD stacks (wallet row on top, cards under it) and short screens drop only decorative bits
 *  F3 the painted scenes with a fixed shape (the cleaning room, the service floor) fill what they do not cover with the same painting, behind (never over
 *     the room: a live filter over the painting made it shiver on an iPhone); on a WIDE stage the service floor continues its painting to the sides, mirrored
 *     (RULE CHANGE 2026-11-19: no blurred side areas, YouTube Playables Design 1)
 *  F4 the Sauce Station's pantry tiles stay full touch targets (>= 48 px) and its short-screen layout is compact
 *
 * Run: npx tsx scripts/full-screen-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string) => fs.readFileSync(path.join(ROOT, f), "utf8");
let failures = 0;
function check(id: string, ok: unknown) {
  if (ok) console.log(`  ok  ${id}`);
  else {
    failures++;
    console.log(`  FAIL ${id}`);
  }
}

{
  const shell = read("src/components/kc/game/GameShell.tsx");
  const fit = read("src/components/kc/game/layoutMode.ts");
  check(
    "F1 every window is filled edge to edge by fitLayout (no contain-fit frame, no bezel, no side tagline); an upright phone keeps its own size; the notch is padded",
    /export const FILL_MAX_W = 640;/.test(fit) &&
      /export const FILL_MAX_ASPECT = 0\.75;/.test(fit) &&
      /export function fitLayout/.test(fit) &&
      // RULE CHANGE 2026-11-19 (developer: screens with only portrait art go back to their original size): the shell asks `fitLayout` with `portraitOnly`; the 9:16
      // box exists ONLY for those screens (`fit.frame`), never as the window's default frame
      /fitLayout\(box\.width, box\.height, portraitOnly, wideOnly\)/.test(shell) &&
      /usePortraitOnly\(\)/.test(shell) &&
      !/Math\.min\(w \/ logicalW, h \/ logicalH\)/.test(shell) &&
      !/sm:rounded|sm:border/.test(shell) &&
      /pt-\[env\(safe-area-inset-top\)\]/.test(shell) &&
      /pb-\[env\(safe-area-inset-bottom\)\]/.test(shell),
  );
}
{
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const gift = read("src/components/kc/DailyGiftCard.tsx");
  check(
    // 2026-11-17 (developer: "move the ranking container to top and the assistant and settings icons down"): on a tall portrait screen the city
    // ranking is on top with the wallet beside it and Settings / Paige sit in the shortcut column; short screens (max-height 660) and phone
    // landscape keep the earlier arrangement (wallet row with Paige and Settings, cards under it).
    "F2 the Kitchen's HUD: ranking on top beside the wallet, Settings and Paige in the shortcut column; a short screen or landscape keeps the wallet row on top; the cards are as wide as the shortcut column allows; short screens drop only the bar and the streak dots",
    /"absolute inset-x-0 top-0 z-20 flex items-start gap-2 p-3[^"]*land:flex-row land:justify-between"/.test(
      kitchen,
    ) &&
      /stacked \? "flex-col-reverse" : "flex-col"/.test(kitchen) &&
      /data-testid="kitchen-top-row"/.test(kitchen) &&
      /\(max-height: 660px\)/.test(kitchen) &&
      /\{stacked \? null : settingsButton\}/.test(kitchen) &&
      /\{stacked \? null : <AskPaigeButton \/>\}/.test(kitchen) &&
      /max-w-\[calc\(100%-84px\)\]/.test(kitchen) &&
      /h-\[4px\] w-24 overflow-hidden rounded-full bg-ivory\/25 \[@media\(max-height:600px\)\]:hidden/.test(
        kitchen,
      ) &&
      /gap-\[3px\] \[@media\(max-height:600px\)\]:hidden/.test(gift) &&
      !/next-kitchen-strip[\s\S]{0,400}max-height:600px\)\]:hidden/.test(kitchen),
  );
}
{
  const room = read("src/components/kc/business/AreaCleaningPrototype.tsx");
  const floor = read("src/components/kc/game/ServiceFloor.tsx");
  const css = read("src/components/kc/game/serviceFloor.css");
  const backdrop = room.indexOf('data-testid="cleaning-backdrop"');
  const stage = room.indexOf('data-testid="cleaning-stage"');
  check(
    // RULE CHANGE 2026-11-19 (developer: portrait-only art goes back to its original size): the service floor has no landscape painting, so it is back to its
    // original look, the blurred crop behind it, and no longer continues the painting mirrored to the sides
    "F3 the cleaning room fills the rest of the screen with its own painting behind it (no blur); the service floor is back to its blurred backdrop (no mirrored sides)",
    backdrop > 0 &&
      backdrop < stage &&
      /object-cover/.test(room.slice(backdrop - 400, backdrop)) &&
      !/blur\(/.test(room.slice(backdrop - 400, backdrop + 200)) &&
      !/FloorSides/.test(floor) &&
      !/sf-sides/.test(css) &&
      /className="sf-backdrop"/.test(floor) &&
      floor.indexOf('className="sf-backdrop"') < floor.indexOf('className="sf-view"') &&
      /\.sf \.sf-backdrop \{[\s\S]{0,300}blur\(12px\)/.test(css) &&
      /@container \(max-aspect-ratio: 0\.8\)[\s\S]{0,200}mask-image/.test(css),
  );
}
{
  const sauce = read("src/components/kc/sauce/SauceStationGame.tsx");
  check(
    "F4 the Sauce Station's pantry tiles are at least 48 px tall and its short-screen layout is compact",
    /h-\[clamp\(48px,9vh,84px\)\] flex-col/.test(sauce) &&
      /\[@media\(max-height:620px\)\]:h-10/.test(sauce) &&
      /\[@media\(max-height:620px\)\]:h-\[56px\]/.test(sauce),
  );
}
{
  // RULE CHANGE 2026-11-19 (developer: "find all the areas that can't be converted to landscape because there are no landscape assets and make them back to the
  // original size"): every screen painted only as a portrait stage marks itself `<PortraitOnly />`, so the shell keeps it at its original 9:16 size in a wide window.
  // RULE CHANGE 2026-11-20: the tag now carries the screen's landscape room (`art`), checked by landscape-art-qa; the intro story has its own landscape scenes and is no longer tagged.
  // A screen with a landscape painting or none (Kitchen, Market, Business, Inventory, the cleaning rooms, the cutting scene) must NOT carry it.
  const tagged = [
    "src/components/kc/inventory/DessertRunGame.tsx",
    "src/components/kc/inventory/KitchenDispatchGame.tsx",
    "src/components/kc/inventory/CarParkGame.tsx",
    "src/components/kc/inventory/FridgeSortGame.tsx",
    "src/components/kc/inventory/DeliveryInspectionGame.tsx",
    "src/components/kc/inventory/StockroomSortGame.tsx",
    "src/components/kc/sauce/SauceStationGame.tsx",
    "src/components/kc/restaurant/FridgeCheckGame.tsx",
    "src/components/kc/restaurant/WashUpSink.tsx",
  ];
  // RULE CHANGE 2026-11-20 (twice). First (developer: "why is the old portrait layout still in the centre?"): the first Codex pictures kept the portrait picture in their
  // middle, so for a while the Kitchen, the map and the Second Floor were tagged `<PortraitOnly wideOnly />`. Then the TRUE landscape pictures arrived
  // (docs/planning/LANDSCAPE-TRUE-PICTURES-CODEX-PROMPTS-2026-11-20.md) and those three screens are real landscape screens again: no tag.
  const landscapeOk = [
    "src/components/kc/Kitchen.tsx",
    "src/ScreensRouter.tsx",
    "src/components/kc/restaurantMap/SecondFloorView.tsx",
    "src/components/kc/Shop.tsx",
    "src/components/kc/business/BusinessDashboard.tsx",
    "src/components/kc/inventory/InventoryScreen.tsx",
    "src/components/kc/business/AreaCleaningPrototype.tsx",
    "src/components/kc/game/Preparation.tsx",
    "src/components/kc/restaurantMap/RestaurantMapView.tsx",
  ];
  check(
    "F5 the nine screens with a portrait stage (eight games and the sink) carry <PortraitOnly />; the screens with landscape art or none (the Kitchen, the maps, the Second Floor) do not",
    tagged.every((f) => /<PortraitOnly\b/.test(read(f))) &&
      landscapeOk.every((f) => !/<PortraitOnly\b/.test(read(f))) &&
      !fs.existsSync(path.join(ROOT, "src/components/kc/game/FloorSides.tsx")),
  );
}
{
  // RULE CHANGE 2026-11-19 (developer: "every page feels so wide and not optimized"): in landscape the list screens are ONE centred reading column (--kc-col), the
  // full-bleed screens opt out with `data-kc-wide`, and the section banners are real banners in a window at least 520 px tall.
  const css = read("src/styles.css");
  const router = read("src/ScreensRouter.tsx");
  const kitchen = read("src/components/kc/Kitchen.tsx");
  check(
    "F6 landscape list screens are one centred column; the Kitchen home and the maps keep the whole window; the banners and the Mini-games sheet fit a laptop window",
    /--kc-col: 1040px;/.test(css) &&
      /:has\(> nav\[data-bottom-nav\]\):not\(\[data-kc-wide\]\)/.test(css) &&
      /max-width: var\(--kc-col\)/.test(css) &&
      (router.match(/data-kc-wide/g) ?? []).length === 2 &&
      /<div data-kc-wide className="relative h-full w-full overflow-hidden bg-cream">/.test(
        kitchen,
      ) &&
      /land:!max-w-\[760px\]/.test(kitchen) &&
      // RULE CHANGE 2026-11-20 (developer: "images are not properly integrated, only a random portion is visible"): a banner keeps its picture's own shape
      // (`.kc-banner`, aspect-ratio from `--kc-ratio`) instead of a fixed 120 / 168 px strip; no Tailwind `land:!h-[..]` is left on a banner (its `!important`
      // would beat the stylesheet)
      /\.kc-banner \{[\s\S]{0,260}aspect-ratio: var\(--kc-ratio\)/.test(css) &&
      /clamp\(170px, 26vh, 280px\)/.test(css) &&
      [
        "src/components/kc/business/BusinessSectionBanner.tsx",
        "src/components/kc/business/BusinessRefrigerator.tsx",
        "src/components/kc/inventory/InventoryScreen.tsx",
        "src/components/kc/Shop.tsx",
      ].every((f) => /kc-banner/.test(read(f)) && !/land:!h-\[/.test(read(f))) &&
      !/land:items-center/.test(read("src/components/kc/MiniGamesSheet.tsx").slice(0, 3200)),
  );
}
console.log(failures === 0 ? "\nFULL SCREEN QA: ALL PASS" : `\nFULL SCREEN QA: ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
