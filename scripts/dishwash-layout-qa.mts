/**
 * DISHWASH LAYOUT QA (developer 2026-11-09: "the list of utensils covers a large portion of the screen; the sink image needs to be full screen").
 * The pure parts of the full-screen sink (restaurant/sinkQueue.ts) and the guarantee that the washing RULES did not change:
 *   A  the "Up next" strip: the current kind, up to four next kinds, "+N", finished kinds drop out; the full list keeps every kind
 *   B  the layout: regions inside the screen, in order, with no overlap; the stage box is nearly the whole width
 *   C  the scene scale fits without cropping; the painted basin outline is inside its box
 *   D  the rules files are untouched by this change (dishDirt.ts, cleaningDirt.ts) and the screen keeps its test ids
 * Run: npx tsx scripts/dishwash-layout-qa.mts
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  BASIN,
  SINK_LAYOUT,
  SLOT_X,
  kindViews,
  sceneScale,
  stripView,
  type SinkKind,
} from "../src/game/restaurant/sinkQueue.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("      ", JSON.stringify(detail).slice(0, 300));
  }
}

const kinds: SinkKind[] = [
  ["saucepan", 1],
  ["stock-pot", 1],
  ["fry-pan", 1],
  ["plates", 1],
  ["cups", 1],
  ["bowl", 1],
  ["glasses", 2],
  ["pitcher", 1],
].map(([id, n]) => ({ id: String(id), n: Number(n), label: String(id), icon: "🍽️" }));
const queueOf = (ks: readonly SinkKind[]) =>
  ks.flatMap((k) => Array.from({ length: k.n }, () => ({ id: k.id })));

console.log("A. The Up-next strip");
{
  const queue = queueOf(kinds);
  const total = queue.length;
  const v0 = kindViews(kinds, queue, 0, "saucepan");
  const s0 = stripView(v0, total);
  assert(
    s0.current?.id === "saucepan" &&
      s0.next.map((v) => v.id).join() === "stock-pot,fry-pan,plates,cups" &&
      s0.more === 3 &&
      s0.piecesLeft === 9,
    "A1: the current kind, the next four, and '+3' for the rest",
    { current: s0.current?.id, next: s0.next.map((v) => v.id), more: s0.more },
  );
  // Wash the saucepan and the stock pot: they leave the strip, the next kind becomes current.
  const v2 = kindViews(kinds, queue, 2, "fry-pan");
  const s2 = stripView(v2, total - 2);
  assert(
    s2.current?.id === "fry-pan" &&
      !s2.next.some((v) => v.id === "saucepan" || v.id === "stock-pot") &&
      s2.more === 1,
    "A2: finished kinds drop out of the strip and the count of the rest follows",
    { current: s2.current?.id, more: s2.more },
  );
  // Two glasses: washing the first keeps the kind current with 1 left.
  const queueGlass = queue;
  const gIdx = queueGlass.findIndex((q) => q.id === "glasses");
  const vg = kindViews(kinds, queueGlass, gIdx + 1, "glasses");
  const glass = vg.find((v) => v.id === "glasses")!;
  assert(
    glass.washed === 1 && glass.left === 1 && glass.state === "current",
    "A3: a kind with two pieces shows 1 / 2 and stays current",
    glass,
  );
  const vAll = kindViews(kinds, queue, total, null, true);
  const sAll = stripView(vAll, 0);
  assert(
    sAll.current === null &&
      sAll.next.length === 0 &&
      sAll.more === 0 &&
      vAll.every((v) => v.state === "done"),
    "A4: everything washed: an empty strip, every kind done",
  );
  assert(
    v0.length === kinds.length && v0.reduce((n, v) => n + v.n, 0) === total,
    "A5: the full list (the sheet) always has every kind with its real count",
  );
  const small = stripView(
    kindViews(kinds.slice(0, 2), queueOf(kinds.slice(0, 2)), 0, "saucepan"),
    2,
  );
  assert(small.next.length === 1 && small.more === 0, "A6: two kinds: current + one next, no '+N'");
  assert(
    stripView(v0, total, 3).next.length === 3 && stripView(v0, total, 3).more === 4,
    "A7: the strip size can shrink for small screens (3 next, +4)",
  );
}

console.log("B. The layout");
{
  const L = SINK_LAYOUT;
  const regions = [L.hud, L.strip, L.stage, L.status, L.progress, L.rack, L.footer] as const;
  const inside = regions.every((r) => r.top >= 0 && r.top + r.height <= 1.0001);
  assert(inside, "B1: every region is inside the screen");
  const order = regions.map((r) => r.top);
  const tops = [...order].sort((a, b) => a - b);
  assert(
    JSON.stringify(order) === JSON.stringify(tops),
    "B2: from the top: HUD, strip, stage, status, progress, rack, footer",
  );
  let overlap = "";
  for (let i = 1; i < regions.length; i++) {
    const prev = regions[i - 1]!;
    if (regions[i]!.top < prev.top + prev.height - 1e-6) overlap += ` ${i}`;
  }
  assert(overlap === "", "B3: no two regions overlap", overlap);
  assert(
    L.stage.width >= 0.9,
    "B4: the stage is at least 90% of the screen's width",
    L.stage.width,
  );
  assert(
    L.hud.height + L.strip.height <= 0.2,
    "B5: the HUD and the closed list together are under 20% of the height (the old list alone was ~62% of its card)",
    L.hud.height + L.strip.height,
  );
  assert(L.stage.height >= 0.38, "B6: the sink gets at least 38% of the height", L.stage.height);
  assert(
    SLOT_X.length === 6 && SLOT_X.every((x, i) => i === 0 || x > SLOT_X[i - 1]!),
    "B7: six tray slots, left to right",
  );
}

console.log("C. The scene and the basin");
{
  assert(
    Math.abs(sceneScale(500, 389) - 500 / 360) < 1e-9,
    "C1: a box as wide as the scene's ratio scales by its width",
  );
  assert(
    Math.abs(sceneScale(500, 300) - 300 / 280) < 1e-9,
    "C2: a flatter box scales by its height (the scene is never cropped)",
  );
  assert(sceneScale(0, 0) === 1, "C3: an unmeasured box scales by 1");
  const w = BASIN.box.w;
  const h = BASIN.box.h;
  assert(
    BASIN.polygon.every(
      ([x, y]) =>
        x >= BASIN.box.x && x <= BASIN.box.x + w && y >= BASIN.box.y && y <= BASIN.box.y + h,
    ),
    "C4: the basin's outline is inside its box",
  );
  const L = SINK_LAYOUT;
  const stageTop = L.stage.top * 960;
  const stageBottom = stageTop + L.stage.height * 960;
  assert(
    stageTop <= BASIN.box.y + 80 && stageBottom >= BASIN.box.y + BASIN.box.h - 80,
    "C5: the stage sits over the basin (within 80 px of its box top and bottom)",
    { stageTop, stageBottom },
  );
}

console.log("D. The rules are untouched");
{
  let diff = "";
  try {
    diff = execSync(
      "git diff HEAD --stat -- src/game/restaurant/dishDirt.ts src/game/restaurant/cleaningDirt.ts",
      { cwd: ROOT, encoding: "utf8" },
    );
  } catch {
    diff = "";
  }
  assert(diff.trim() === "", "D1: dishDirt.ts and cleaningDirt.ts have no changes", diff);
  const sink =
    read("src/components/kc/restaurant/WashUpSink.tsx") +
    read("src/components/kc/restaurant/wash/SinkQueue.tsx") +
    read("src/components/kc/restaurant/wash/SinkRack.tsx");
  assert(
    [
      "wash-up-sink",
      "wash-up-surface",
      "wash-up-status",
      "wash-up-rack",
      "wash-up-stage",
      "wash-up-queue",
    ].every((id) => sink.includes(`data-testid="${id}"`)),
    "D2: the screen keeps its test ids (the sheet holds wash-up-lines)",
  );
  assert(
    /onWash/.test(sink) && /onBuySoap/.test(sink) && /noSoapAtStart/.test(sink),
    "D3: the screen's props (wash, buy soap, no soap) are unchanged",
  );
  assert(
    !/Math\.random/.test(read("src/game/restaurant/sinkQueue.ts")),
    "D4: the pure helpers use no unseeded randomness",
  );
}

console.log("E. Keys (developer 2026-11-11: pieces piled up on the sink)");
{
  const sink = read("src/components/kc/restaurant/WashUpSink.tsx");
  assert(
    !/key=\{(activeItemIndex|streak)\}/.test(sink),
    "E1: no sibling in the scene is keyed by a bare number (the piece by its index and the Combo chip by the streak collided at 2, and React duplicated the piece)",
  );
  assert(
    /key=\{`piece-\$\{activeItemIndex\}`\}/.test(sink) && /key=\{`combo-\$\{streak\}`\}/.test(sink),
    "E2: the piece and the Combo chip have their own key prefixes",
  );
  assert(
    /right-2 top-2 z-20/.test(
      sink.slice(sink.indexOf("wash-up-combo") - 400, sink.indexOf("wash-up-combo")),
    ),
    "E3: the Combo chip is on the right, clear of the soap bottle",
  );
}

console.log(
  failures ? `\nDISHWASH LAYOUT QA: ${failures} FAILURE(S)` : "\nDISHWASH LAYOUT QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
