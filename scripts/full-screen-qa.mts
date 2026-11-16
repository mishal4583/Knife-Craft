/**
 * FULL SCREEN QA (developer 2026-11-16: "optimize these screens for all type of screen size and try to make it full screen without leaving any
 * space"). Source guards for the rule; the real-browser proof is tools/e2e/fullscreen.mjs.
 *
 *  F1 GameShell gives an upright phone (window under 640 px wide, no wider than 3:4) the whole viewport instead of the largest 540:960 box, keeps the
 *     contain-fit for wider windows, and pads for the notch (safe-area insets)
 *  F2 the Kitchen's top HUD stacks (wallet row on top, cards under it) and short screens drop only decorative bits
 *  F3 the painted scenes with a fixed shape (the cleaning room, the service floor) fill what they do not cover with the same painting, blurred
 *     and behind (never over the room: a live filter over the painting made it shiver on an iPhone)
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
  check(
    "F1 an upright phone fills the viewport; wider windows keep the contain-fit; the notch is padded",
    /const FILL_MAX_W = 640;/.test(shell) &&
      /const FILL_MAX_ASPECT = 0\.75;/.test(shell) &&
      /window\.innerWidth < FILL_MAX_W && w \/ h <= FILL_MAX_ASPECT[\s\S]{0,80}setSize\(\{ width: w, height: h \}\)/.test(
        shell,
      ) &&
      /const scale = Math\.min\(w \/ logicalW, h \/ logicalH\);/.test(shell) &&
      /pt-\[env\(safe-area-inset-top\)\]/.test(shell) &&
      /pb-\[env\(safe-area-inset-bottom\)\]/.test(shell),
  );
}
{
  const kitchen = read("src/components/kc/Kitchen.tsx");
  const gift = read("src/components/kc/DailyGiftCard.tsx");
  check(
    "F2 the Kitchen's HUD stacks (wallet row on top, cards under it, as wide as the shortcut column allows); short screens drop only the bar and the streak dots",
    /flex flex-col-reverse items-start gap-2 p-3[^"]*land:flex-row land:justify-between/.test(
      kitchen,
    ) &&
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
    "F3 the cleaning room and the service floor fill the rest of the screen with their own painting, blurred and behind",
    backdrop > 0 &&
      backdrop < stage &&
      /object-cover/.test(room.slice(backdrop - 400, backdrop)) &&
      /blur\(14px\)/.test(room.slice(backdrop - 400, backdrop + 200)) &&
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
