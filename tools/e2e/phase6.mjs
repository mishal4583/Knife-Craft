// Phase 6 in the game (2026-10-21), on the restaurant dev server (KC_DEV_URL, default :8080 —
// `window.__kcSpecials` puts a chosen variant / special customer on the next order):
//   M. Level 13 with a low saved best, a Golden Tomato and the Mystery Guest: after the Knife
//      Report the serve card offers a quiet "📸" chip (special + best) — nothing opens by itself;
//      after Serve it also holds the customer's moment; the preview shows each card as a real
//      1080×1350 image (arrows between them), with Save image downloading a PNG; Share shows
//      only where an image file can be shared, a cancelled share is no error, an unavailable one
//      points to Save; closing and reopening adds no duplicates; ✕ puts the chip away and the
//      order goes on.
//   P. Level 13 cut with aimed swipes along the scene's guides: a Perfect Slice in a Clean ×5+
//      run earns the Perfect Cut moment.
//   O. an ordinary dish (no variant, no special customer, not a best) earns no moment.
//   Z. no console errors.
import fs from "node:fs";
import path from "node:path";
import {
  launch,
  seedSave,
  sleep,
  clickButton,
  shot,
  save,
  readSave,
  MOVED_IN_BUSINESS,
  SAVE_KEY,
  OUT,
} from "./harness.mjs";
import { playToReport } from "./solver.mjs";

const DEV = process.env.KC_DEV_URL || "http://localhost:8080/";
const ONLY = process.env.ONLY || "MPOZ";
const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
const DL = path.join(OUT, "out", "downloads-" + Date.now());
fs.mkdirSync(DL, { recursive: true });
const cdp = await page.createCDPSession();
await cdp.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: DL });

const levelSave = (n, extra = {}) =>
  seedSave({
    credits: 500,
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
    },
    story: { introDone: true, milestoneMask: 127, finaleSeen: false },
    business: {
      ...MOVED_IN_BUSINESS,
      restaurantStaff: { specialists: ["mexican-chef"] },
      inventory: Object.fromEntries(
        ["tomato", "zucchini", "basil", "onion"].map((id) => [
          id,
          { ingredientId: id, quantity: 12, unitCost: 0, purchaseDay: 1 },
        ]),
      ),
    },
    ...extra,
  });
async function bootAt(s) {
  await page.goto(DEV, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.bridge && document.body.innerText.length > 20, {
    timeout: 30000,
  });
  await page.evaluate(
    async (v, key) => {
      localStorage.clear();
      await window.bridge.storage.set([key], [JSON.stringify(v)]);
    },
    s,
    SAVE_KEY,
  );
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelectorAll("button").length > 3, {
    timeout: 30000,
  });
  await sleep(1000);
}
const recipeIds = (n) =>
  page.evaluate(async (num) => {
    const m = await import("/src/game/levels/levelDefinitions.ts");
    const l = m.LEVELS[num - 1];
    return l.recipePoolIds?.length
      ? l.recipePoolIds
      : l.batchGroupRecipeIds?.length
        ? l.batchGroupRecipeIds
        : [l.recipeId];
  }, n);
async function startOrder() {
  if (
    await page.evaluate(() =>
      [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Later"),
    )
  )
    await clickButton(page, /^Later$/);
  await clickButton(page, /Prepare$/);
  await sleep(1200);
  await clickButton(
    page,
    /^((?:OPEN THE RESTAURANT|🚪 Open restaurant)|(?:START SERVICE|🔥 Start service))$/i,
  );
  await page.waitForFunction(
    () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
    { timeout: 30000 },
  );
}
const chip = () =>
  page.evaluate(() => {
    const c = document.querySelector('[data-testid="moment-chip"]');
    return c ? { count: Number(c.dataset.count), kinds: c.dataset.kinds } : null;
  });
const preview = () =>
  page.evaluate(() => {
    const p = document.querySelector('[data-testid="moment-preview"]');
    const img = document.querySelector('[data-testid="moment-card"]');
    return p
      ? {
          kind: p.dataset.kind,
          img: img
            ? {
                w: img.naturalWidth,
                h: img.naturalHeight,
                src: img.getAttribute("src")?.slice(0, 5),
              }
            : null,
          share: [...p.querySelectorAll("button")].some((b) => b.textContent.trim() === "Share"),
          status: p.querySelector('[data-testid="moment-status"]')?.textContent ?? null,
        }
      : null;
  });
const waitImg = () =>
  page
    .waitForFunction(
      () => document.querySelector('[data-testid="moment-card"]')?.naturalWidth > 0,
      { timeout: 15000 },
    )
    .catch(() => null);

// ================================================================== M
if (ONLY.includes("M")) {
  await bootAt(levelSave(13));
  const ids = await recipeIds(13);
  await bootAt(
    levelSave(13, {
      recipeProgress: Object.fromEntries(ids.map((id) => [id, { best: 1, done: true }])),
    }),
  );
  const s0 = await readSave(page);
  await page.evaluate(() => {
    window.__kcSpecials.variant("golden-tomato");
    window.__kcSpecials.customer("mystery-customer");
  });
  await startOrder();
  const played = await playToReport(page, { maxMs: 180000 });
  await sleep(700);
  check(
    "M0 the order plays to the Knife Report; no moment card is shown during cutting or over the report",
    played.ok && !(await chip()) && !(await preview()),
  );
  await clickButton(page, /^Continue$/);
  await page.waitForSelector('[data-testid="service-customer"]', { timeout: 15000 });
  await sleep(600);
  const c1 = await chip();
  check(
    "M1 the serve card offers a quiet chip for this dish's moments (Special Dish + New Personal Best) — nothing opened by itself",
    c1?.kinds === "special,best" && !(await preview()),
    c1,
  );
  await clickButton(page, /^Serve to /);
  await sleep(1300);
  const c2 = await chip();
  check(
    "M2 after Serve the special customer's reaction joins them (3 moments)",
    c2?.kinds === "special,best,customer" && c2.count === 3,
    c2,
  );
  // The preview, with a share that is cancelled, then one that isn't available.
  await page.evaluate(() => {
    window.__shareMode = "cancel";
    navigator.canShare = () => true;
    navigator.share = () =>
      window.__shareMode === "cancel"
        ? Promise.reject(new DOMException("cancelled", "AbortError"))
        : Promise.reject(new DOMException("blocked", "NotAllowedError"));
  });
  await page.click('[data-testid="moment-chip"] button');
  await waitImg();
  const p1 = await preview();
  check(
    "M3 the preview shows the card as a real 1080×1350 image (the exported PNG itself)",
    p1?.img?.w === 1080 && p1.img.h === 1350 && p1.img.src === "blob:",
    p1,
  );
  const kindsSeen = [p1?.kind];
  for (let i = 0; i < 2; i++) {
    await page.click('[aria-label="Next moment"]');
    await waitImg();
    await sleep(300);
    kindsSeen.push((await preview())?.kind);
  }
  check(
    "M4 arrows step through all three cards",
    kindsSeen.join() === "special,best,customer",
    kindsSeen,
  );
  await page.setViewport({ width: 320, height: 568 });
  await sleep(600);
  await shot(page, "phase6-preview-320");
  const fit = await page.evaluate(() => {
    const r = document
      .querySelector('[data-testid="moment-preview"] > div')
      .getBoundingClientRect();
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      vw: innerWidth,
      vh: innerHeight,
    };
  });
  check(
    "M5 the preview fits 320×568",
    fit.top >= 0 && fit.bottom <= fit.vh && fit.left >= 0 && fit.right <= fit.vw,
    fit,
  );
  await page.setViewport({ width: 430, height: 900 });
  await sleep(400);
  await clickButton(page, /^Share$/);
  await sleep(500);
  const pc = await preview();
  await page.evaluate(() => (window.__shareMode = "blocked"));
  await clickButton(page, /^Share$/);
  await sleep(500);
  const pb = await preview();
  check(
    "M6 Share (where available): a cancelled share is no error; an unavailable one keeps the preview and points to Save",
    pc?.status === null && pb && /Save the image instead/.test(pb.status ?? ""),
    { cancel: pc?.status, blocked: pb?.status },
  );
  await clickButton(page, /^Save image$/);
  await sleep(1500);
  const files = fs.readdirSync(DL).filter((f) => f.endsWith(".png"));
  const head = files[0]
    ? fs.readFileSync(path.join(DL, files[0])).subarray(0, 8).toString("hex")
    : null;
  check(
    "M7 Save image downloads the card as a PNG (knifecraft-<kind>-<dish>.png)",
    files.length === 1 && /^knifecraft-customer-/.test(files[0]) && head === "89504e470d0a1a0a",
    { files, head },
  );
  // Text sharing but no file sharing (detected separately): Share stays, for the line.
  await page.evaluate(() => {
    delete navigator.canShare;
    navigator.canShare = undefined;
  });
  await page.click('[aria-label="Previous moment"]');
  await waitImg();
  await sleep(300);
  check(
    "M8 where the browser shares text but not an image file, Share is still offered",
    (await preview())?.share === true,
  );
  // No share API at all: no Share button.
  await page.evaluate(() => {
    navigator.share = undefined;
  });
  await page.click('[aria-label="Next moment"]');
  await waitImg();
  await sleep(300);
  check(
    "M8b with no share API at all, only Save image is offered",
    (await preview())?.share === false,
  );
  await clickButton(page, /^Close$/);
  await sleep(400);
  const c3 = await chip();
  await page.click('[data-testid="moment-chip"] button');
  await waitImg();
  await clickButton(page, /^Close$/);
  await sleep(300);
  check(
    "M9 closing and reopening adds no duplicate moments",
    c3?.count === 3 && (await chip())?.count === 3,
    c3,
  );
  await page.click('[aria-label="Not now"]');
  await sleep(300);
  const s1 = await readSave(page);
  check(
    "M10 ✕ puts the chip away; the order carries on (Next Customer / Finish Level still there)",
    !(await chip()) &&
      (await page.evaluate(() =>
        [...document.querySelectorAll("button")].some((b) =>
          /^(Next Customer|Finish Level)$/.test(b.textContent.trim()),
        ),
      )),
  );
  const entries = (s1.economyLedger ?? []).filter(
    (e) => !(s0.economyLedger ?? []).some((o) => o.id === e.id),
  );
  check(
    "M11 moments and sharing cost or pay nothing: the only new ledger entry is the order's own settlement",
    entries.length === 1 && entries[0].category === "campaign-settlement",
    entries.map((e) => `${e.category} ${e.amount}`),
  );
}

// ================================================================== P — a Perfect Slice by aimed swipes
if (ONLY.includes("P")) {
  // Level 13 with a high saved best (so this is not a "best"), no variant, no special customer.
  await bootAt(levelSave(13));
  const pids = await recipeIds(13);
  await bootAt(
    levelSave(13, {
      recipeProgress: Object.fromEntries(pids.map((id) => [id, { best: 100, done: true }])),
    }),
  );
  await startOrder();
  await sleep(1200);
  // Swipe straight down each next guide line, through the food (a swipe on a guide = a Perfect Slice candidate).
  for (let i = 0; i < 40; i++) {
    const g = await page.evaluate(() => {
      const root = document.getElementById("root");
      const key = Object.keys(root).find((k) => k.startsWith("__reactContainer$"));
      const stack = [root[key]];
      let game = null;
      while (stack.length && !game) {
        const f = stack.pop();
        if (!f) continue;
        for (let st = f.memoizedState; st && typeof st === "object"; st = st.next) {
          const cur = st.memoizedState && st.memoizedState.current;
          if (cur && cur.game && cur.game.scene && cur.game.scene.getScene) game = cur.game;
        }
        if (f.child) stack.push(f.child);
        if (f.sibling) stack.push(f.sibling);
      }
      const sc = game?.scene.getScene("Preparation");
      if (!sc || sc.technique?.interactionMode !== "cut") return null;
      const done = sc.cuts.slice(sc.stepCutsAtStart);
      const gs = sc.guides?.v ?? [];
      const half = gs.length > 1 ? Math.abs(gs[1] - gs[0]) / 2 : 1e9;
      const open = gs.filter((x) => !done.some((c) => c.axis === "v" && Math.abs(c.c - x) < half));
      if (!open.length) return null;
      const r = game.canvas.getBoundingClientRect();
      const k = r.width / game.scale.width;
      return {
        x: r.left + Math.max(...open) * k,
        y0: r.top + (sc.ingCy - sc.ingRy * 1.6) * k,
        y1: r.top + (sc.ingCy + sc.ingRy * 1.6) * k,
      };
    });
    if (!g) break;
    await page.mouse.move(g.x, g.y0);
    await page.mouse.down();
    for (let s = 1; s <= 14; s++) await page.mouse.move(g.x, g.y0 + ((g.y1 - g.y0) * s) / 14);
    await page.mouse.up();
    await sleep(420);
  }
  const rest = await playToReport(page, { maxMs: 120000 });
  await sleep(700);
  await clickButton(page, /^Continue$/);
  await page
    .waitForSelector('[data-testid="service-customer"]', { timeout: 15000 })
    .catch(() => null);
  await sleep(600);
  const cp = await chip();
  check(
    "P1 aimed swipes along the guides land a Perfect Slice in a Clean ×5+ run → the Perfect Cut moment",
    rest.ok && !!cp && cp.kinds.split(",").includes("perfect"),
    cp,
  );
  if (cp) {
    await page.click('[data-testid="moment-chip"] button');
    await waitImg();
    await sleep(300);
    await shot(page, "phase6-perfect-preview");
    check("P2 its card renders", (await preview())?.img?.w === 1080);
    await clickButton(page, /^Close$/);
  }
}

// ================================================================== O — an ordinary dish
if (ONLY.includes("O")) {
  await bootAt(levelSave(13));
  const ids = await recipeIds(13);
  await bootAt(
    levelSave(13, {
      recipeProgress: Object.fromEntries(ids.map((id) => [id, { best: 100, done: true }])),
    }),
  );
  await startOrder();
  const played = await playToReport(page, { maxMs: 180000 });
  await sleep(600);
  await clickButton(page, /^Continue$/);
  await page.waitForSelector('[data-testid="service-customer"]', { timeout: 15000 });
  await clickButton(page, /^Serve to /);
  await sleep(1200);
  const special = await page.$('[data-testid="special-customer"]');
  check(
    "O1 an ordinary dish (no variant, no special customer, not a best) earns no moment and shows no chip",
    played.ok && !special && !(await chip()),
    await chip(),
  );
}

if (ONLY.includes("Z")) {
  const errors = logs.filter((l) => /^(error|pageerror)/.test(l));
  check("Z1 no console errors", errors.length === 0, errors.slice(0, 5));
}
save("phase6", { results, logs });
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
