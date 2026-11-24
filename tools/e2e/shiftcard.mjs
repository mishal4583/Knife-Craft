// Chef Pride audit remediation, Batch 2 (developer 2026-11-23): the Level Complete SHIFT CARD, in a real browser.
// A full multi-order service cannot be finished by the cutting solver, so this renders the REAL MilestoneBanner with the REAL helpers (restaurant/shiftRecognition.ts) on a
// throwaway page (tools/e2e/shiftcard-page, served by its own `vite` dev server on port 8123, never part of the build) with saves whose fridge is built the way the game
// builds it. The wiring of completeCampaignLevel is proved by scripts/shift-recognition-qa.mts (F).
// Checked at 320x568, 360x640, 390x844, 740x360 and 1280x720:
//   1. every case fits the screen (nothing above, below or beside it), no sideways scroll, no tile label is cut;
//   2. genuine zero spoilage reads "0 WASTED" and "Zero waste"; it never appears for a spoiled fridge or when spoilage is not tracked;
//   3. spoiled ingredients are counted and NAMED; the freshness stage not being live shows three tiles and no waste line at all (not even a zero);
//   4. the tier line follows the accuracy: Masterful (96), "Excellent Work, Chef!" (91), Good (78), "Every Shift Teaches" (44);
//   5. the real improvements, the dare won, the title and the dare under way are all shown, each once;
//   6. no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { spawn, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep, OUT } from "./harness.mjs";

const PORT = 8123;
const BASE = `http://localhost:${PORT}/tools/e2e/shiftcard-page/index.html`;
const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const server = spawn(
  process.execPath,
  [
    path.join(ROOT, "node_modules", "vite", "bin", "vite.js"),
    "--port",
    String(PORT),
    "--strictPort",
  ],
  { cwd: ROOT, stdio: "ignore" },
);
const stopServer = () => {
  try {
    execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
  } catch {
    server.kill();
  }
};
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  await sleep(500);
  ready = await fetch(BASE)
    .then((r) => r.ok)
    .catch(() => false);
}
if (!ready) {
  console.log("FAIL 0 the test page's dev server did not start");
  stopServer();
  process.exit(1);
}

// Warm the dev server first (its first browser load re-bundles the dependencies, which can take minutes on a cold cache): the page and its main module are fetched once.
await fetch(BASE.replace("index.html", "main.tsx"))
  .then((r) => r.text())
  .catch(() => null);

const { browser, page, logs } = await launch();
const SIZES = [
  [320, 568],
  [360, 640],
  [390, 844],
  [740, 360],
  [1280, 720],
];
const read = async (v, w, h) => {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${BASE}?v=${v}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector('[data-testid="banner-stats"]', { timeout: 300000 });
  await sleep(600);
  return page.evaluate(() => {
    const stats = document.querySelector('[data-testid="banner-stats"]');
    const cardEl = stats.parentElement;
    const r = cardEl.getBoundingClientRect();
    const tiles = [...stats.children].map((d) => ({
      text: d.innerText.replace(/\s+/g, " ").trim(),
      cut: [...d.querySelectorAll("p")].some((p) => p.scrollWidth > p.clientWidth + 1),
    }));
    return {
      fits:
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        r.left >= 0 &&
        r.right <= innerWidth &&
        document.documentElement.scrollWidth <= innerWidth,
      box: [Math.round(r.top), Math.round(r.bottom), innerHeight],
      tier: document.querySelector('[data-testid="banner-tier"]')?.innerText.trim() ?? null,
      tiles,
      notes: [...document.querySelectorAll('[data-testid="banner-notes"] li')].map((l) =>
        l.innerText.trim(),
      ),
    };
  });
};

const CASES = {
  zero: "Excellent Work, Chef!",
  spoiled: "Good Shift, Chef",
  low: "Every Shift Teaches",
  untracked: "A Masterful Shift!",
  dare: "Excellent Work, Chef!",
};
for (const [v, tier] of Object.entries(CASES)) {
  for (const [w, h] of SIZES) {
    const m = await read(v, w, h);
    const tag = `${v} ${w}x${h}`;
    check(
      `1 ${tag}: the card fits the screen, no sideways scroll, no label cut`,
      m.fits && !m.tiles.some((t) => t.cut),
      { box: m.box, tiles: m.tiles },
    );
    if (w === 320 || (w === 740 && (v === "zero" || v === "dare")))
      await page.screenshot({ path: `${OUT}out/shiftcard-${v}-${w}x${h}.png` });
    if (w !== 390) continue; // the content checks are the same at every size
    check(`4 ${v}: the tier line reads "${tier}"`, (m.tier ?? "").includes(tier), m.tier);
    const labels = m.tiles.map((t) => t.text);
    const notes = m.notes.join(" | ");
    if (v === "zero" || v === "low") {
      check(
        `2 ${v}: a genuine zero reads '0 WASTED' and says Zero waste`,
        labels.includes("0 WASTED") && /Zero waste/.test(notes),
        { labels, notes },
      );
    }
    if (v === "spoiled") {
      check(
        "3 spoiled: five units over two ingredients, both NAMED, never 'Zero waste'",
        labels.includes("5 WASTED") &&
          /Spoiled: Basil, Tomato/.test(notes) &&
          !/Zero waste/.test(notes),
        { labels, notes },
      );
    }
    if (v === "untracked") {
      check(
        "3b not tracked (freshness stage not live, spoiled basil in the fridge): three tiles, no waste line, no zero",
        labels.length === 3 &&
          !labels.some((l) => /WASTED/.test(l)) &&
          !/waste|Spoiled/i.test(notes),
        { labels, notes },
      );
    }
    if (v === "zero") {
      check(
        "5 the real improvements are shown once each",
        /Accuracy up from 81% to 91%/.test(notes) &&
          /Most perfect cuts in a service: 7/.test(notes) &&
          m.notes.filter((n) => /Accuracy up/.test(n)).length === 1,
        { notes },
      );
    }
    if (v === "dare") {
      check(
        "5b a dare won, the title earned and the dare under way (with its progress) are all there once",
        m.notes.filter((n) => /Dare won: Perfect Chef/.test(n)).length === 1 &&
          m.notes.filter((n) => /Title earned: Precision Chef 2/.test(n)).length === 1 &&
          m.notes.filter((n) => /Dare: No Mercy Prep · 3 of 5 plates/.test(n)).length === 1 &&
          labels.includes("2 WASTED") &&
          /Spoiled: Basil/.test(notes),
        { notes, labels },
      );
    }
  }
}
const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
stopServer();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
