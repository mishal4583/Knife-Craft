/**
 * FULL SCREEN QA (developer 2026-11-16: "optimize these screens for all type of screen size and try to make it full screen without leaving any
 * space"). Source guards for the rule; the real-browser proof is tools/e2e/fullscreen.mjs.
 *
 *  F1 GameShell gives EVERY window the whole viewport (RULE CHANGE 2026-11-19, Playgama 1.6.1 / 1.6.8, YouTube Playables Design 1: no empty bars): an upright
 *     phone at its own size, anything else laid out by `fitLayout` and scaled to fill; no 9:16 frame, no border, no side tagline; the notch is padded
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
      /fitLayout\(box\.width, box\.height\)/.test(shell) &&
      !/Math\.min\(w \/ logicalW, h \/ logicalH\)/.test(shell) &&
      !/sm:rounded|sm:border|shadow-\[0_40px/.test(shell) &&
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
    "F3 the cleaning room fills the rest of the screen with its own painting behind it (no blur); the service floor does too, and on a wide stage continues its painting to the sides, mirrored",
    backdrop > 0 &&
      backdrop < stage &&
      /object-cover/.test(room.slice(backdrop - 400, backdrop)) &&
      !/blur\(/.test(room.slice(backdrop - 400, backdrop + 200)) &&
      /<FloorSides mapUrl=\{mapUrl\} \/>/.test(floor) &&
      /\.sf \.sf-sides \{/.test(css) &&
      /@container \(min-aspect-ratio: 5 \/ 6\)/.test(css) &&
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
console.log(failures === 0 ? "\nFULL SCREEN QA: ALL PASS" : `\nFULL SCREEN QA: ${failures} FAIL`);
process.exit(failures === 0 ? 0 : 1);
