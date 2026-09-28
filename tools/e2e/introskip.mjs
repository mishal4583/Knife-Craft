// Live QA for the re-paced intro + Skip story, against the built game.
// Run: npx vite preview (port 4173) in the repo root, then: node tools/e2e/introskip.mjs
import { launch, sleep, shot, save, readSave, writeSave, GAME_URL as URL0 } from "./harness.mjs";
const OV = "div.absolute.inset-0.z-50.overflow-hidden";
const R = [];
let fails = 0;
const check = (ok, name, detail = "") => {
  if (!ok) fails++;
  R.push(`${ok ? "ok  " : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
  console.log(R.at(-1));
};
const { browser, page, logs } = await launch();
const net = [];
page.on("request", (q) => net.push(q.url()));
// Count every storage write that flips story.introDone false -> true (Bridge keeps its storage in localStorage locally).
await page.evaluateOnNewDocument(() => {
  window.__introDoneWrites = 0;
  const done = (v) => /introDone\\*"\s*:\s*true/.test(v || "");
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (done(v) && !done(this.getItem(k))) window.__introDoneWrites++;
    return orig.call(this, k, v);
  };
  // In-page clock for the intro: first appearance of the overlay -> gone.
  window.__intro = { start: null, end: null };
  new MutationObserver(() => {
    const o = document.querySelector("div.absolute.inset-0.z-50.overflow-hidden");
    if (o && window.__intro.start === null) window.__intro.start = performance.now();
    if (!o && window.__intro.start !== null && window.__intro.end === null)
      window.__intro.end = performance.now();
  }).observe(document, { childList: true, subtree: true });
});
async function fresh(w = 390, h = 844) {
  await page.setViewport({ width: w, height: h });
  await page.goto(URL0, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(OV, { timeout: 20000 });
}
const state = async () => {
  const saved = await readSave(page).catch(() => null);
  const ui = await page.evaluate((ov) => {
    const o = document.querySelector(ov);
    return {
      overlay: !!o,
      text:
        o?.innerText
          .replace(/\s+/g, " ")
          .replace(/Skip story →/i, "")
          .trim()
          .slice(0, 80) ?? null,
      skip: !![...document.querySelectorAll("button")].find((b) =>
        /Skip story/i.test(b.textContent),
      ),
      btn: o
        ? ([...o.querySelectorAll("button")]
            .map((b) => b.textContent.trim())
            .find((t) => !/Skip/i.test(t)) ?? null)
        : null,
      hud: /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText),
      writes: window.__introDoneWrites,
    };
  }, OV);
  return {
    ...ui,
    introDone: saved?.story?.introDone ?? null,
    completed: saved?.levelProgress?.completedLevelIds?.length ?? null,
    credits: saved?.credits ?? null,
    ledger: saved?.economyLedger?.length ?? null,
  };
};
const tapScreen = () =>
  page.evaluate(
    (ov) => document.querySelector(ov)?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
    OV,
  );
const clickBtn = (re) =>
  page.evaluate((src) => {
    const b = [...document.querySelectorAll("button")].find((x) =>
      new RegExp(src).test(x.textContent),
    );
    b?.click();
    return !!b;
  }, re.source);
/** Advances to the beat whose text matches `re`, tapping auto beats and pressing buttons. */
async function goTo(re) {
  for (let i = 0; i < 40; i++) {
    const s = await state();
    if (!s.overlay || re.test(s.text)) return s;
    await sleep(300);
    if (s.btn) await clickBtn(new RegExp("^" + s.btn + "$"));
    else await tapScreen();
  }
  return state();
}

// 1. Natural completion (player presses each button as soon as it appears).
await fresh();
let s0 = await state();
check(
  s0.overlay && s0.skip && s0.introDone !== true,
  "1a new player: intro + Skip story visible, introDone not set",
  `introDone=${s0.introDone}`,
);
const t0 = Date.now();
let btnWait = 0;
for (let i = 0; i < 400; i++) {
  const s = await state();
  if (!s.overlay) break;
  if (s.btn) {
    const tb = Date.now();
    await sleep(350);
    await clickBtn(new RegExp("^" + s.btn + "$"));
    btnWait += Date.now() - tb;
  }
  await sleep(100);
}
const natural = Date.now() - t0;
let s = await state();
check(
  !s.overlay && s.introDone === true && s.hud,
  "1b natural finish: overlay gone, introDone saved, Level 1 on screen",
  `${(natural / 1000).toFixed(1)} s total incl. ${(btnWait / 1000).toFixed(1)} s on the two buttons`,
);
const clock = await page.evaluate(() => window.__intro);
const inPage = clock.end - clock.start;
check(
  inPage <= 25000,
  "1c natural finish within 25 s (in-page clock, first beat → Level 1)",
  `${(inPage / 1000).toFixed(2)} s incl. ${(btnWait / 1000).toFixed(1)} s of test delay before the two buttons; wall clock ${(natural / 1000).toFixed(1)} s`,
);
check(s.writes === 1, "1d exactly one introDone write", `${s.writes}`);
await sleep(2000);
check(!(await state()).overlay, "1e nothing reopens afterwards");

// 2. Skip immediately.
await fresh();
const before = await state();
const ts = Date.now();
await clickBtn(/Skip story/);
await page
  .waitForFunction((ov) => !document.querySelector(ov), { timeout: 2000 }, OV)
  .catch(() => {});
const skipMs = Date.now() - ts;
s = await state();
check(
  !s.overlay && s.introDone === true,
  "2a Skip: overlay closed and introDone saved",
  `${skipMs} ms`,
);
// Skipping this early can beat the lazily-loaded Level 1 screen; the player
// lands on it as soon as it has loaded.
const tl = Date.now();
await page
  .waitForFunction(() => /·\s*\d+\/\d+\s+[a-z-]+/i.test(document.body.innerText), {
    timeout: 3000,
  })
  .catch(() => {});
s = await state();
check(s.hud, "2a' Level 1 on screen after an immediate Skip", `${Date.now() - tl} ms more`);
check(
  s.completed === 0 && s.credits === 124000 && s.ledger === 0,
  "2b Skip: no level completed, starting $1,240.00 untouched, no ledger entry",
  `completed ${s.completed}, credits ${s.credits}, ledger ${s.ledger}`,
);
check(s.writes === 1, "2c Skip: one introDone write", `${s.writes}`);
await sleep(3000);
check(!(await state()).overlay, "2d Skip: no timer reopens the story");
await page.reload({ waitUntil: "networkidle0" });
await sleep(1500);
s = await state();
check(
  !s.overlay && !s.skip && s.introDone === true,
  "2e reload after Skip: no intro, no Skip button",
);

// 3. Double tap on Skip.
await fresh();
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /Skip story/.test(x.textContent));
  b.click();
  b.click();
});
await sleep(400);
s = await state();
check(!s.overlay && s.writes === 1, "3 double-tap Skip: one completion, one write", `${s.writes}`);

// 4. Skip during a transition (right after a tap advanced the beat).
await fresh();
await sleep(400);
await tapScreen();
await sleep(30);
await clickBtn(/Skip story/);
await sleep(400);
s = await state();
check(
  !s.overlay && s.introDone && s.writes === 1,
  "4 Skip mid-transition: one completion",
  `${s.writes}`,
);

// 5. Skip while a button beat waits.
await fresh();
s = await goTo(/You never planned/);
check(s.btn === "OPEN THE RESTAURANT", "5a reached the OPEN THE RESTAURANT beat");
for (let i = 0; i < 5; i++) {
  await tapScreen();
  await sleep(120);
}
check(
  /You never planned/.test((await state()).text),
  "5b screen taps do not bypass the button beat",
);
await clickBtn(/Skip story/);
await sleep(400);
s = await state();
check(!s.overlay && s.introDone && s.writes === 1, "5c Skip on a button beat: one completion");

// 6. Skip exactly as the final beat's timer ends.
await fresh();
s = await goTo(/FIRST PREP/);
await sleep(1300 - 40);
await clickBtn(/Skip story/);
await sleep(600);
s = await state();
check(
  !s.overlay && s.introDone && s.writes === 1,
  "6 Skip racing the last timer: one completion",
  `${s.writes}`,
);

// 7. Button behavior: double-click OPEN THE RESTAURANT moves exactly one beat; READY works.
await fresh();
await goTo(/You never planned/);
await sleep(400);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find(
    (x) => x.textContent.trim() === "OPEN THE RESTAURANT",
  );
  b.click();
  b.click();
});
await sleep(200);
check(
  /A FRESH START/.test((await state()).text),
  "7a double-click OPEN THE RESTAURANT lands on A FRESH START (no skipped beat)",
  (await state()).text,
);
s = await goTo(/YOUR SAVINGS/);
check(s.btn === "READY", "7b reached READY");
await sleep(400);
await clickBtn(/^READY$/);
await sleep(200);
check(
  /You spent your savings on this\?/.test((await state()).text),
  "7c READY moves on to the chef",
  (await state()).text,
);
await sleep(150);
await tapScreen();
await tapScreen();
await sleep(150);
check(
  /Every last bit/.test((await state()).text),
  "7d two quick taps on an auto beat move one beat",
  (await state()).text,
);

// 8. Existing player (introDone=true, progress) never sees the intro, progress untouched.
await fresh();
await clickBtn(/Skip story/);
await sleep(400);
{
  const cur = await readSave(page);
  cur.levelProgress = {
    currentLevelId: "level-6",
    highestUnlockedLevelId: "level-6",
    completedLevelIds: ["level-1", "level-2", "level-3", "level-4", "level-5"],
  };
  cur.story = { introDone: true, milestoneMask: 0, finaleSeen: false };
  await writeSave(page, cur);
}
await page.reload({ waitUntil: "networkidle0" });
await sleep(1500);
s = await state();
check(
  !s.overlay && !s.skip && s.completed === 5,
  "8 existing introDone save: no intro, no Skip button, progress untouched",
  `completed ${s.completed}`,
);

// 9. Mobile sizes: every beat — Skip ≥48 px, inside the screen, never overlapping content; no clipping/scroll.
for (const [w, h] of [
  [320, 568],
  [360, 640],
  [388, 844],
  [390, 844],
  [430, 900],
  [768, 1024],
]) {
  await fresh(w, h);
  const issues = [];
  let beats = 0;
  let lastText = null;
  // Follow the story at its own pace: measure each new beat once, ~450 ms after
  // it appears (entrance done), press buttons, let timed beats advance on
  // their own — tapping here could race a short beat's timer.
  for (let i = 0; i < 400; i++) {
    const cur = await page.evaluate(
      (ov) => document.querySelector(ov)?.innerText.replace(/\s+/g, " ").slice(0, 60) ?? null,
      OV,
    );
    if (cur === null) break;
    if (cur === lastText) {
      await sleep(80);
      continue;
    }
    lastText = cur;
    await sleep(450);
    const m = await page.evaluate((ov) => {
      const o = document.querySelector(ov);
      if (!o) return null;
      const box = o.getBoundingClientRect();
      const skip = [...o.querySelectorAll("button")].find((b) => /Skip story/.test(b.textContent));
      const sr = skip.getBoundingClientRect();
      const content = o.children[2];
      const hit = [...content.querySelectorAll("p,svg,canvas,button,.rounded-full")]
        .map((e) => e.getBoundingClientRect())
        .filter(
          (r) =>
            r.width &&
            r.left < sr.right &&
            r.right > sr.left &&
            r.top < sr.bottom &&
            r.bottom > sr.top,
        ).length;
      return {
        text: o.innerText.replace(/\s+/g, " ").slice(0, 40),
        skip: {
          w: Math.round(sr.width),
          h: Math.round(sr.height),
          inside:
            sr.left >= box.left &&
            sr.right <= box.right &&
            sr.top >= box.top &&
            sr.bottom <= box.bottom,
        },
        overlapsContent: hit,
        clipped:
          content.scrollHeight > content.clientHeight + 1 ||
          content.scrollWidth > content.clientWidth + 1,
        pageScrollX: document.scrollingElement.scrollWidth > innerWidth,
        btn:
          [...content.querySelectorAll("button")].map((b) => {
            const r = b.getBoundingClientRect();
            return { t: b.textContent.trim(), h: Math.round(r.height) };
          })[0] ?? null,
      };
    }, OV);
    if (!m) break;
    beats++;
    if (m.skip.w < 48 || m.skip.h < 48) issues.push(`b${beats} skip ${m.skip.w}x${m.skip.h}`);
    if (!m.skip.inside) issues.push(`b${beats} skip outside`);
    if (m.overlapsContent) issues.push(`b${beats} skip overlaps content (${m.text})`);
    if (m.clipped) issues.push(`b${beats} content clipped (${m.text})`);
    if (m.pageScrollX) issues.push(`b${beats} horizontal scroll`);
    if (m.btn && m.btn.h < 48) issues.push(`b${beats} ${m.btn.t} ${m.btn.h}px`);
    if ([1, 3, 8, 13].includes(beats) && [320, 390].includes(w))
      await shot(page, `is-${w}-b${beats}`);
    if (m.btn) await clickBtn(new RegExp("^" + m.btn.t + "$"));
  }
  check(
    issues.length === 0 && beats === 14,
    `9 ${w}x${h}: all ${beats} beats — Skip ≥48 px, inside, no overlap, no clipping, no h-scroll`,
    issues.join("; "),
  );
}

// 10. Network + console.
const hosts = [...new Set(net.filter((u) => /^https?:/.test(u)).map((u) => new URL(u).host))];
check(
  hosts.every((h) => /^localhost:\d+$|^bridge\.playgama\.com$/.test(h)),
  "10a only the game server and the Playgama Bridge CDN are contacted",
  hosts.join(", "),
);
check(
  !net.some(
    (u) =>
      /\.(mp4|webm|png|jpe?g|webp|woff2?)$/i.test(u) &&
      !/assets\/(kitchen-bg|fraunces|nunito|caveat|skin-0\d|tomato)/.test(u),
  ),
  "10b no new asset downloads",
);
check(
  logs.filter((l) => !/ERR_CONNECTION/i.test(l)).length === 0,
  "10c no console errors",
  logs.join(" | "),
);
save("introskip-result.json", { R, fails, natural, btnWait, skipMs });
console.log(fails ? `\nINTRO SKIP E2E: ${fails} FAILURE(S)` : "\nINTRO SKIP E2E: ALL PASS");
await browser.close();
