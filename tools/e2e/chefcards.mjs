// Chef Pride, Phase 6 (developer 2026-11-23: shareable chef cards), restaurant build:
//   1. a league promotion (a saved finished week) shows its celebration with a "Share this" button, and NOTHING is shared, saved, copied or opened until it is tapped;
//   2. the tap opens the preview of a real card (the exported PNG: 1080x1350), headed "Chef achievement", with Save image and Close, 48 px buttons;
//   3. Save image saves a file named after the card (knifecraft-league-silver-league.png) and only on that tap; Close returns to the celebration, which is still there;
//   4. the card is the game's own picture of the achievement (the PNG is saved for a look in tools/e2e/out/chefcard-league.png);
//   5. the preview fits 320x568, 390x844 and 1280x720; no sideways scroll; no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import fs from "node:fs";
import { MOVED_IN_BUSINESS, OUT, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const saveAt = (completed, chefRecord) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      chefRecord,
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: `level-${completed + 1}`,
      highestUnlockedLevelId: `level-${completed + 1}`,
      completedLevelIds: Array.from({ length: completed }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const PROMOTION = { league: { week: "2026-01-05", tier: 0, points: 500, last: null } };
const { browser, page, logs } = await launch();
// Spies: nothing may be shared, downloaded, copied or opened by itself.
await page.evaluateOnNewDocument(() => {
  window.__spy = { share: 0, download: [], clipboard: 0, open: 0 };
  if (navigator.share) {
    const orig = navigator.share.bind(navigator);
    navigator.share = (...a) => {
      window.__spy.share++;
      return orig(...a);
    };
  }
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (...a) {
    if (this.download) window.__spy.download.push(this.download);
    return click.apply(this, a);
  };
  const open = window.open;
  window.open = (...a) => {
    window.__spy.open++;
    return open?.apply(window, a);
  };
  if (navigator.clipboard) {
    const wt = navigator.clipboard.writeText?.bind(navigator.clipboard);
    if (wt)
      navigator.clipboard.writeText = (...a) => {
        window.__spy.clipboard++;
        return wt(...a);
      };
  }
});
const dismissGuide = () =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="guide-card"]');
    [...(g?.querySelectorAll("button") ?? [])]
      .find((b) => /^Later$/.test(b.textContent.trim()))
      ?.click();
  });
const waitCelebration = async () => {
  let cel = null;
  for (let i = 0; i < 14 && !cel; i++) {
    await sleep(700);
    await dismissGuide();
    cel = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="celebration"]');
      return c
        ? {
            kind: c.getAttribute("data-celebration"),
            share: !!c.querySelector('[data-testid="celebration-share"]'),
            h: Math.round(
              c.querySelector('[data-testid="celebration-share"]')?.getBoundingClientRect()
                .height ?? 0,
            ),
          }
        : null;
    });
  }
  return cel;
};
const spy = () => page.evaluate(() => ({ ...window.__spy, download: [...window.__spy.download] }));
const tap = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, saveAt(11, PROMOTION));
const cel = await waitCelebration();
await shot(page, "chefcards-celebration");
const s0 = await spy();
check(
  "1 a league promotion shows its celebration with a 48 px 'Share this' button, and nothing has been shared, saved, copied or opened",
  !!cel &&
    cel.kind === "league" &&
    cel.share &&
    cel.h >= 47 &&
    s0.share === 0 &&
    s0.download.length === 0 &&
    s0.clipboard === 0 &&
    s0.open === 0,
  { cel, s0 },
);

await tap('[data-testid="celebration-share"]');
let prev = null;
for (let i = 0; i < 15 && !prev?.ready; i++) {
  await sleep(500);
  prev = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="moment-preview"]');
    const img = document.querySelector('[data-testid="moment-card"]');
    if (!p) return null;
    return {
      kind: p.getAttribute("data-kind"),
      head: p.innerText.replace(/\s+/g, " ").slice(0, 120),
      ready: !!img && img.complete && img.naturalWidth > 0,
      w: img?.naturalWidth ?? 0,
      h: img?.naturalHeight ?? 0,
      buttons: [...p.querySelectorAll("button")].map((b) => ({
        t: b.textContent.trim() || b.getAttribute("aria-label"),
        h: Math.round(b.getBoundingClientRect().height),
      })),
    };
  });
}
await shot(page, "chefcards-preview");
check(
  "2 the tap opens a real card (a 1080x1350 PNG) headed 'Chef achievement', with Save image and Close at 48 px",
  !!prev &&
    prev.kind === "league" &&
    prev.ready &&
    prev.w === 1080 &&
    prev.h === 1350 &&
    /chef achievement/i.test(prev.head) &&
    prev.buttons.some((b) => b.t === "Save image" && b.h >= 47) &&
    prev.buttons.some((b) => b.t === "Close" && b.h >= 47),
  prev,
);
const s1 = await spy();
check(
  "2b opening the preview still saved, copied and opened nothing",
  s1.download.length === 0 && s1.clipboard === 0 && s1.open === 0,
  s1,
);

// the picture itself, for a look
const b64 = await page.evaluate(async () => {
  const src = document.querySelector('[data-testid="moment-card"]')?.getAttribute("src");
  if (!src) return null;
  const buf = await (await fetch(src)).arrayBuffer();
  let s = "";
  const a = new Uint8Array(buf);
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s);
});
if (b64) fs.writeFileSync(OUT + "out/chefcard-league.png", Buffer.from(b64, "base64"));
check(
  "4 the card's PNG was exported for a look",
  !!b64 && b64.length > 20000,
  b64 ? b64.length : 0,
);

await page.evaluate(() => {
  [...document.querySelectorAll('[data-testid="moment-preview"] button')]
    .find((b) => b.textContent.trim() === "Save image")
    ?.click();
});
await sleep(800);
const s2 = await spy();
check(
  "3a Save image saves one file named after the card, and only then",
  s2.download.length === 1 && s2.download[0] === "knifecraft-league-silver-league.png",
  s2,
);
await page.evaluate(() => {
  [...document.querySelectorAll('[data-testid="moment-preview"] button')]
    .find((b) => b.textContent.trim() === "Close")
    ?.click();
});
await sleep(600);
const back = await page.evaluate(() => ({
  preview: !!document.querySelector('[data-testid="moment-preview"]'),
  celebration: !!document.querySelector('[data-testid="celebration"]'),
}));
check(
  "3b Close returns to the celebration, which is still there",
  !back.preview && back.celebration,
  back,
);

// sizes
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [1280, 720],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, saveAt(11, PROMOTION));
  await waitCelebration();
  await tap('[data-testid="celebration-share"]');
  await sleep(2500);
  const f = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="moment-preview"] > div');
    const r = p?.getBoundingClientRect();
    const btns = [...document.querySelectorAll('[data-testid="moment-preview"] button')].map((b) =>
      b.getBoundingClientRect(),
    );
    return {
      inView:
        !!r && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1,
      buttonsOk:
        btns.length >= 2 && btns.every((b) => b.height >= 47 && b.bottom <= innerHeight + 1 + 200),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  await shot(page, `chefcards-fit-${w}`);
  check(
    `5 ${w}x${h}: the preview is in view with 48 px buttons, no sideways scroll`,
    f.inView && f.buttonsOk && f.overflow <= 0,
    f,
  );
}

const errs = logs.filter((x) => /error/i.test(x) && !/favicon|Failed to load resource/i.test(x));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
