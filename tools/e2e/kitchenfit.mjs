// Audit F3 (developer 2026-11-23): the Kitchen's open "Next customer" details with a dare on offer must stay inside the screen. Before the fix, at 320x568 and 740x360 the
// panel grew over the rank and Daily Gift cards and pushed the day strip and its own header off the top; at 360x640 it covered the Daily Gift. Restaurant build, Level 12.
// At every size, with the details open and a dare on offer (and again with no dare):
//   1. the panel's header ("Hide Details") is wholly inside the viewport, and so is the day strip;
//   2. the rank card is never covered by the day strip or the card (they start at or below its bottom edge);
//   3. the Daily Gift card is never covered either, except by at most 24 px of its bottom edge at 320x568 (the shortest phone: the dare's ask and its two 48 px buttons
//      need 96 px and only about 87 px are left; the gift's title, status and dots stay visible);
//   4. the dare is accessible: its two buttons are inside the details' scroll region, 48 px tall, and "See all orders" can be reached by scrolling it;
//   5. on windows tall enough the details do not scroll at all (no limit applied), and closing the details removes the limit;
//   6. no sideways scroll, no console errors.
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const now = new Date();
const TODAY = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
const saveFor = (declined) =>
  seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      chefRecord: declined
        ? { challenge: { day: TODAY, id: "zero-waste", state: "declined", progress: 0 } }
        : {},
    },
    credits: 500000,
    levelProgress: {
      currentLevelId: "level-12",
      highestUnlockedLevelId: "level-12",
      completedLevelIds: Array.from({ length: 11 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  });
const { browser, page, logs } = await launch();
const dismiss = () =>
  page.evaluate(() => {
    const g = document.querySelector('[data-testid="guide-card"]');
    [...(g?.querySelectorAll("button") ?? [])]
      .find((b) => /^Later$/.test(b.textContent.trim()))
      ?.click();
  });
const toggle = () =>
  page.evaluate(() => document.querySelector('[aria-controls="kitchen-order-details"]')?.click());
const geometry = () =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const R = (el) => {
      const r = el?.getBoundingClientRect();
      return r ? { t: r.top, b: r.bottom, l: r.left, r: r.right } : null;
    };
    const det = q("#kitchen-order-details");
    const dr = R(det);
    const btn = (id) => R(q(`[data-testid="${id}"]`));
    const take = btn("kitchen-dare-take");
    const no = btn("kitchen-dare-decline");
    const inside = (b) => !!b && !!dr && b.t >= dr.t - 1 && b.b <= dr.b + 1;
    return {
      vh: innerHeight,
      vw: innerWidth,
      header: R(q('[aria-controls="kitchen-order-details"]')),
      strip: R(q('[data-testid="day-strip"]')),
      card: R(det?.parentElement),
      rank: R(q('[data-testid="kitchen-rank"]')),
      gift: R(q('[data-testid="kitchen-gift"]')),
      scrolls: det?.getAttribute("data-scrolls") === "true",
      maxH: det?.style.maxHeight ?? "",
      dare: !!q('[data-testid="kitchen-dare"]'),
      takeH: take ? Math.round(take.b - take.t) : null,
      noH: no ? Math.round(no.b - no.t) : null,
      buttonsInside: inside(take) && inside(no),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

const SIZES = [
  [320, 568, 24],
  [360, 640, 0],
  [390, 844, 0],
  [740, 360, 0],
  [768, 1024, 0],
  [1280, 720, 0],
  [1815, 867, 0],
];
for (const [w, h, giftTol] of SIZES) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  for (const withDare of [true, false]) {
    await boot(page, saveFor(!withDare));
    await sleep(1500);
    await dismiss();
    await sleep(500);
    await toggle();
    await sleep(700);
    const g = await geometry();
    const tag = `${w}x${h} ${withDare ? "dare" : "no dare"}`;
    const inView = (b) => !!b && b.t >= 0 && b.b <= g.vh && b.l >= 0 && b.r <= g.vw;
    check(
      `1 ${tag}: the header and the day strip are inside the viewport`,
      inView(g.header) && inView(g.strip),
      { header: g.header, strip: g.strip },
    );
    const top = Math.min(g.strip?.t ?? 9999, g.card?.t ?? 9999);
    check(`2 ${tag}: the rank card is not covered`, top >= g.rank.b - 0.5, {
      top,
      rankBottom: g.rank.b,
    });
    check(
      `3 ${tag}: the Daily Gift card is not covered (tolerance ${giftTol}px)`,
      top >= g.gift.b - giftTol - 0.5,
      { top, giftBottom: g.gift.b },
    );
    if (withDare) {
      check(
        `4 ${tag}: the dare is shown, both buttons are 48 px and inside the details`,
        g.dare && g.takeH >= 47 && g.noH >= 47 && g.buttonsInside,
        { takeH: g.takeH, noH: g.noH, inside: g.buttonsInside },
      );
    }
    if (g.vh >= 720)
      check(`5 ${tag}: a tall window needs no scroll limit`, !g.scrolls && g.maxH === "", {
        scrolls: g.scrolls,
        maxH: g.maxH,
      });
    if (withDare && g.scrolls) {
      // the rest of the details can be reached by scrolling them
      const reach = await page.evaluate(async () => {
        const det = document.querySelector("#kitchen-order-details");
        det.scrollTop = det.scrollHeight;
        await new Promise((r) => setTimeout(r, 200));
        const b = [...det.querySelectorAll("button")].find((x) =>
          /See all orders/.test(x.textContent),
        );
        const r = b?.getBoundingClientRect();
        const d = det.getBoundingClientRect();
        return { reachable: !!r && r.top >= d.top - 1 && r.bottom <= d.bottom + 1 };
      });
      check(
        `4b ${tag}: "See all orders" can be reached by scrolling the details`,
        reach.reachable,
        reach,
      );
    }
    if (withDare && w === 390) {
      await toggle();
      await sleep(500);
      const closed = await geometry();
      check(
        `5b ${tag}: closing the details removes the limit`,
        !closed.scrolls && closed.maxH === "",
        { scrolls: closed.scrolls, maxH: closed.maxH },
      );
    }
    check(`6 ${tag}: no sideways scroll`, g.overflow <= 0, { overflow: g.overflow });
    if (withDare) await shot(page, `kitchenfit-${w}x${h}`);
  }
}
const errs = logs.filter((l) => /error/i.test(l) && !/favicon|Failed to load resource/i.test(l));
check("6 no console errors", errs.length === 0, errs.slice(0, 3));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
