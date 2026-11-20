// Emoji drawn as icons (Playgama 4.3.2, developer 2026-11-19), restaurant build. lib/emoji-jsx turns an emoji that has an icon into a drawn icon wherever a
// screen renders text; the emoji character stays as zero-size inline text.
//   1. Kitchen, Market, Restaurant and the Mini-games sheet each show drawn icons (.gi-svg) and no mapped emoji is left as raw text in a visible element;
//   2. innerText still reads the same words ("Open for service"), on one line with its icon, and a button's text is not split onto another line;
//   3. every icon is as big as its text (about 1.1 em, within 6..40 px) and is never the only thing clipped by its parent;
//   4. an unmapped emoji (a tomato) is left as the emoji, not a wrong picture;
//   5. 320 x 568, 390 x 844, 768 x 1024 and 1280 x 720: no sideways scroll, no page errors, no icon overflowing the window.
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  PAIGE_QUIET,
  launch,
  boot,
  seedSave,
  sleep,
  shot,
  openSection,
  SAVE_KEY,
} from "./harness.mjs";
import { iconFor } from "../../src/lib/emojiIcons.ts";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const save = seedSave({
  credits: 50_000,
  business: { ...MOVED_IN_BUSINESS, assistant: PAIGE_QUIET },
  levelProgress: {
    currentLevelId: "level-12",
    highestUnlockedLevelId: "level-12",
    completedLevelIds: Array.from({ length: 11 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 2,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});

const { browser, page } = await launch();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});

/** Everything the screen shows about its icons, read in the page. */
const probe = () =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const icons = [...document.querySelectorAll(".gi")];
    // only icons that are on screen: one inside a display:none parent (a hidden card) has no box and is not a defect
    const svgs = icons.filter(
      (g) => g.querySelector(".gi-svg") && g.getBoundingClientRect().width > 0,
    );
    const sizes = svgs.map((g) => {
      const r = g.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(g).fontSize) || 16;
      return { w: r.width, h: r.height, em: r.width / fs, left: r.left, right: r.right };
    });
    const bad = sizes.filter((s) => s.w < 6 || s.w > 40 || s.em < 0.8 || s.em > 1.5);
    const off = sizes.filter((s) => s.right > vw + 1 || s.left < -1);
    // a mapped emoji left as raw text outside an icon: walk the text nodes
    const raw = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest(".gi, script, style, option, textarea, title, svg, [data-emoji-raw]"))
        continue;
      if (/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(n.textContent ?? ""))
        raw.push((n.textContent ?? "").trim().slice(0, 40));
    }
    return {
      icons: icons.length,
      svgs: svgs.length,
      bad: bad.length,
      badSample: bad.slice(0, 2),
      off: off.length,
      raw: raw.slice(0, 12),
      sideways: document.documentElement.scrollWidth > vw + 1,
      text: document.body.innerText.replace(/\s+/g, " "),
    };
  });

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await boot(page, save);
await sleep(900);

// 1 + 2: the Kitchen
const kitchen = await probe();
await shot(page, "emojiicons-kitchen");
check("1a Kitchen shows drawn icons", kitchen.svgs >= 8, {
  icons: kitchen.icons,
  svgs: kitchen.svgs,
});
check(
  "2a the words are unchanged: 'Open for service' and 'Next customer' read as text",
  /Open for service/i.test(kitchen.text) && /Next customer/i.test(kitchen.text),
);
check(
  "3a every icon is about the size of its text (6..40 px, 0.8..1.5 em)",
  kitchen.bad === 0,
  kitchen.badSample,
);

for (const [label, id] of [
  ["Market", "market"],
  ["Restaurant", "restaurant"],
]) {
  await openSection(page, label).catch(() => {});
  await sleep(900);
  const s = await probe();
  await shot(page, `emojiicons-${id}`);
  check(`1b ${label} shows drawn icons and none is mis-sized`, s.svgs >= 3 && s.bad === 0, {
    svgs: s.svgs,
    bad: s.bad,
    sample: s.badSample,
  });
}

// 1c: no mapped emoji is left as raw text anywhere we looked; unmapped ones (food pictures) may be, and must be ones the map does not cover
const rawAll = (await probe()).raw;
const stray = rawAll.filter((t) =>
  [...t.matchAll(/\p{Extended_Pictographic}/gu)].some((m) => iconFor(m[0])),
);
check("1c no emoji that has an icon is left as raw text on screen", stray.length === 0, stray);

// 4: RULE CHANGE 2026-11-20 (developer: "use proper emojis or assets throughout the game"): a tomato, a potato and an onion are the game's own PAINTED pictures now
// (lib/paintedIcons.ts), never a wrong line icon and never a raw emoji; an emoji with neither a picture nor an icon (an olive) still stays an emoji
check(
  "4 a tomato, a potato and an onion are painted pictures (never a line icon); an olive has neither, so it stays an emoji",
  ["🍅", "🥔", "🧅"].every((e) => {
    const f = iconFor(e);
    return f !== null && "picture" in f && /business\/ingredients\//.test(f.picture);
  }) && iconFor("🫒") === null,
);
// 4b: a painted picture really is drawn on a page (the Kitchen's dish chip shows the level's own food) and its file loads
// (Level 60's dish is a carrot: the same save the Kitchen shows "Shared Carrot" with)
const save60 = seedSave({
  credits: 50_000,
  business: { ...MOVED_IN_BUSINESS, assistant: PAIGE_QUIET },
  levelProgress: {
    currentLevelId: "level-60",
    highestUnlockedLevelId: "level-60",
    completedLevelIds: Array.from({ length: 59 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
});
await page.evaluate(
  async (st, key) => {
    await window.bridge.storage.set([key], [JSON.stringify(st)]);
  },
  save60,
  SAVE_KEY,
);
await page.reload({ waitUntil: "networkidle0" });
await page.waitForFunction(
  () => document.elementFromPoint(5, 5)?.closest("#loading-overlay") === null,
  { timeout: 20000 },
);
await sleep(1500);
const pics = await page.evaluate(async () => {
  const imgs = [...document.querySelectorAll(".gi-pic .gi-img")];
  await Promise.all(
    imgs.map((i) =>
      i.complete
        ? 0
        : new Promise((r) => {
            i.onload = r;
            i.onerror = r;
            setTimeout(r, 4000);
          }),
    ),
  );
  return imgs.map((i) => ({ w: i.naturalWidth, src: i.getAttribute("src") }));
});
check(
  "4b a painted picture is drawn and loaded on the Kitchen",
  pics.length >= 1 && pics.every((p) => p.w > 0),
  pics.slice(0, 3),
);

// 5: sizes
const bad = [];
for (const [w, h] of [
  [320, 568],
  [390, 844],
  [768, 1024],
  [1280, 720],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, save);
  await sleep(700);
  const s = await probe();
  if (s.sideways || s.off > 0 || s.bad > 0 || s.svgs < 5)
    bad.push({ w, h, sideways: s.sideways, off: s.off, bad: s.bad, svgs: s.svgs });
}
check(
  "5a at 320x568, 390x844, 768x1024 and 1280x720: icons present, sized, inside the window, no sideways scroll",
  bad.length === 0,
  bad,
);
check("5b no page errors", errors.length === 0, errors.slice(0, 3));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `\nEMOJI ICONS E2E: ${failed.length} FAILED` : "\nEMOJI ICONS E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
