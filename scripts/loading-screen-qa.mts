/**
 * LOADING SCREEN QA (developer 2026-11-18: "do we actually need a loading screen? build one with these assets"). Source guards; the real-browser proof
 * (a slow phone connection, a new and a returning player, three screen sizes) is tools/e2e/loadingscreen.mjs.
 *
 * Why it exists (measured on Slow 4G, 1.6 Mbps / 150 ms): the page was WHITE for about 6 s, then a plain cream "warming the kitchen" screen, then the
 * Kitchen's art painted in piece by piece; a new player saw cream placeholders where the story's pictures were still arriving.
 *
 *  A. The pictures: every file is there at its size, WebP, light enough not to slow the game's own files; the tiny placeholder is in index.html.
 *  B. index.html: the screen is plain HTML + CSS painted before any script; relative paths only (preflight); the small, first-needed pictures are
 *     preloaded at high priority and the big ones at low; it never blocks taps; Reduced Motion turns its animation off.
 *  C. The driver (src/lib/bootSplash.ts): real progress only moves forward, every wait has a time limit, the screen always goes away, it never
 *     touches the save, the money or the SDK.
 *  D. The wiring: the bar moves when the game's code arrives and when the save loads; the first screen's pictures (the equipped kitchen's backdrop,
 *     Paige when hired; the first two story pictures for a new player) and the fonts are waited for; a render failure clears it.
 *
 * Run: npx tsx scripts/loading-screen-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const LOADING = path.join(ROOT, "public", "loading");

/** Width and height of a WebP (lossy VP8, lossless VP8L or extended VP8X). */
function webpSize(file: string): { w: number; h: number } | null {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  if (kind === "VP8L") {
    const bits = b.readUInt32LE(21);
    return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return null;
}

console.log("A. The pictures");
{
  const expected: Record<string, [number, number]> = {
    "bg.webp": [576, 1024],
    "logo.webp": [520, 243],
    "chef.webp": [420, 630],
    "board.webp": [640, 332],
    "bar-frame.webp": [560, 140],
  };
  const bad: unknown[] = [];
  let total = 0;
  for (const [name, [w, h]] of Object.entries(expected)) {
    const file = path.join(LOADING, name);
    if (!fs.existsSync(file)) {
      bad.push({ name, missing: true });
      continue;
    }
    total += fs.statSync(file).size;
    const s = webpSize(file);
    if (!s || s.w !== w || s.h !== h) bad.push({ name, got: s, want: [w, h] });
  }
  assert(
    bad.length === 0,
    "A1: the five pictures exist as WebP at their sizes (build them with scripts/make-loading-assets.py)",
    bad,
  );
  assert(
    total > 0 && total <= 340 * 1024,
    `A2: together they weigh ${Math.round(total / 1024)} KB (limit 340 KB): the loading screen must not slow the game's own files`,
    total,
  );
  const html = read("index.html");
  const tiny = /url\("data:image\/webp;base64,([A-Za-z0-9+/=]+)"\)/.exec(html);
  assert(
    !!tiny && tiny[1]!.length < 2000,
    "A3: a tiny blurred placeholder (under 2 KB) is inlined in index.html, painted before any picture arrives",
    tiny?.[1]?.length,
  );
  assert(
    fs.existsSync(path.join(ROOT, "scripts", "make-loading-assets.py")) &&
      /Loading Screen Assets/.test(read("scripts/make-loading-assets.py")),
    "A4: the pictures are built from the Codex folder by scripts/make-loading-assets.py",
  );
}

console.log("B. index.html");
{
  const html = read("index.html");
  assert(
    /<div id="boot-splash"[^>]*role="status"/.test(html) &&
      html.indexOf('id="boot-splash"') < html.indexOf('<div id="root">'),
    "B1: the screen is plain HTML in the page itself (before #root), with role=status: it paints before any script arrives",
  );
  assert(
    /<link rel="preload" as="image" href="\.\/loading\/logo\.webp" fetchpriority="high"/.test(
      html,
    ) &&
      /<link rel="preload" as="image" href="\.\/loading\/bar-frame\.webp" fetchpriority="high"/.test(
        html,
      ) &&
      /class="bs-bg"[^>]*fetchpriority="low"/.test(html) &&
      /class="bs-chef"[^>]*fetchpriority="low"/.test(html) &&
      /class="bs-board"[^>]*fetchpriority="low"/.test(html),
    "B2: the logo and the bar frame are fetched first (high priority); the big background, chef and board follow at low priority",
  );
  const srcs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((u) => u.includes("loading/"));
  assert(
    srcs.length >= 7 && srcs.every((u) => u.startsWith("./loading/")),
    "B3: every picture path is relative (./loading/...): the preflight forbids root-absolute paths",
    srcs,
  );
  assert(
    /#boot-splash \{[^}]*pointer-events: auto/.test(html) &&
      /#boot-splash\.leaving \{[^}]*pointer-events: none/.test(html) &&
      /max-width: calc\(100dvh \* 9 \/ 16\)/.test(html) &&
      /prefers-reduced-motion: reduce/.test(html),
    "B4: while it is up it swallows taps (the game may already be mounted under it; audit 2026-11-18), lets them through while it fades, keeps the 9:16 shape on wide windows, and Reduced Motion turns its animation off",
  );
  assert(
    /--p, 0\.18/.test(html) && /\.bs-fill::after/.test(html),
    "B5: before the game's code arrives the bar already shows a little life (a start value and a moving shine), then real progress takes over",
  );
  assert(
    /class="bs-text"/.test(html) && /class="bs-hint"\s+hidden/.test(html),
    "B6: the 'tap for music' hint (browsers keep a page silent until the first tap) sits on the bar's plank, hidden until the app asks for it",
  );
  assert(
    !/https?:\/\/(?!bridge\.playgama\.com)/.test(html.replace(/<meta[^>]*>/g, "")),
    "B7: no external address was added to index.html",
  );
}

console.log("C. The driver");
{
  const src = read("src/lib/bootSplash.ts");
  assert(
    /progress = Math\.max\(progress, Math\.min\(1, next\)\)/.test(src) &&
      /if \(!el \|\| finished\) return/.test(src),
    "C1: the bar only moves forward (never back, never past full) and stops once the screen is finished",
  );
  assert(
    /BOOT_MAX_WAIT_MS = 9000/.test(src) &&
      /BOOT_HARD_LIMIT_MS = 20000/.test(src) &&
      /Promise\.race\(\[/.test(src) &&
      /window\.setTimeout\(finishBoot, BOOT_HARD_LIMIT_MS\)/.test(src),
    "C2: every wait has a time limit (9 s for the pictures, 20 s at the very latest): a slow phone gets the game, not a stuck bar",
  );
  assert(
    /img\.onerror = \(\) => resolve\(\)/.test(src) && /decode\(\)/.test(src),
    "C3: a picture counts as ready once it is decoded, and a missing one never traps the player",
  );
  assert(
    /if \(finished\) return;\s*finished = true/.test(src) &&
      /el\.remove\(\)/.test(src) &&
      /dataset\["booted"\] = "1"/.test(src),
    "C4: finishing twice is safe; the element leaves the DOM; html[data-booted=1] marks it for tests",
  );
  assert(
    !/SaveManager|credits|PlayablesSDK|bridge|ledger/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "")),
    "C5: the driver never touches a save, the money, the ledger or the SDK",
  );
}

console.log("D. The wiring");
{
  const main = read("src/main.tsx");
  const app = read("src/App.tsx");
  assert(
    /setBootProgress\(0\.3\)/.test(main) && /armBootFailsafe\(\)/.test(main),
    "D1: when the game's code arrives the bar moves on, and the 20 s failsafe is armed",
  );
  assert(
    /componentDidCatch[\s\S]{0,400}finishBoot\(\)/.test(main),
    "D2: a render failure clears the loading screen, so it never covers the 'game hit a snag' screen",
  );
  assert(
    /setBootProgress\(0\.5\)/.test(app) &&
      /preloadCritical\(first, \{ from: 0\.5, also: \[loadScreensRouter\(\)\] \}\)\.then\(finishBoot\)/.test(
        app,
      ) &&
      /KITCHEN_SKIN_SRC\[kitchenUpgradeOrDefault\(synced\.equippedKitchenUpgradeId\)\.asset\]/.test(
        app,
      ) &&
      /paigeUrl\("cutout-point"\)/.test(app) &&
      /isFreshSave && shouldRunIntro\(synced\)\) first\.push\(intro1Url, intro2Url\)/.test(app),
    "D3: after the save loads, the screen waits for the first screen's pictures (the equipped kitchen's backdrop, Paige when hired; the first two story pictures for a new player) and the fonts",
  );
  assert(
    /setBootHint\(true\)/.test(app) && /setBootHint\(false\)/.test(app),
    "D4: 'tap for music' shows while the browser keeps the page silent and goes with the first tap",
  );
  assert(
    /\.catch\(\(error\) => \{[\s\S]{0,400}finishBoot\(\)/.test(app) &&
      /loaded\.settings\.sound && loaded\.settings\.music !== false/.test(app),
    "D6: a throw while the save is applied clears the screen; 'tap for music' only shows for a player who has sound and music on",
  );
  assert(
    /armBootFailsafe\(\);\s*startPlatform\(\)/.test(main) &&
      /STILL LOADING… TAP TO RELOAD/.test(read("index.html")) &&
      /25000/.test(read("index.html")),
    "D7: the failsafe is armed before the platform starts, and index.html has its own 25 s watchdog (a tap reloads) for the case where the game's code never arrives",
  );
  const harness = read("tools/e2e/harness.mjs");
  assert(
    /getElementById\("boot-splash"\)/.test(harness),
    "D5: the e2e harness's boot() waits for the loading screen to leave before a test looks at the page",
  );
}

console.log("W. The wide loading screen (developer 2026-11-22: use the supplied image)");
{
  const html = read("index.html");
  const file = path.join(LOADING, "wide.webp");
  const size = fs.existsSync(file) ? webpSize(file) : null;
  assert(
    !!size && size.w === 1920 && size.h === 1080 && fs.statSync(file).size <= 340 * 1024,
    "W1: public/loading/wide.webp is 1920 x 1080 and under 340 KB (scripts/make-loading-wide.py cuts it from Landscape Backdrops Assets/loading-screen-landscape-v2.png)",
    size,
  );
  assert(
    /<link\s+rel="preload"\s+as="image"\s+href="\.\/loading\/wide\.webp"[^>]*media="\(min-aspect-ratio: 13\/10\)"/.test(
      html,
    ) &&
      /class="bs-wpic"[^>]*src="\.\/loading\/wide\.webp"|src="\.\/loading\/wide\.webp"[^>]*class="bs-wpic"/.test(
        html.replace(/\s+/g, " "),
      ),
    "W2: a wide window preloads the picture (high priority, only for min-aspect-ratio 13/10) and the splash shows it",
  );
  assert(
    /class="bs-wtrack"><span class="bs-wfill">/.test(html) &&
      /width: calc\(var\(--p, 0\.18\) \* 100%\)/.test(html) &&
      /left: 27\.97%/.test(html) &&
      /top: 88\.06%/.test(html),
    "W3: the real progress fill (--p, driven by bootSplash.ts) is drawn over the picture's empty track at its box (x 537, y 951 of 1920 x 1080)",
  );
  assert(
    /querySelectorAll<HTMLElement>\("\.bs-hint"\)/.test(read("src/lib/bootSplash.ts")) &&
      /classList\.add\("stuck"\)/.test(html),
    "W4: the 'tap for music' hint and the 25 s 'still loading, tap to reload' message work in the wide layout too",
  );
}

console.log(failures ? `\nLOADING SCREEN QA: ${failures} FAILED` : "\nLOADING SCREEN QA: ALL PASS");
process.exit(failures ? 1 : 0);
