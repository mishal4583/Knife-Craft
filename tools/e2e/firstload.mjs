// First load (finishing plan W2, developer 2026-10-12), restaurant build, a brand-new player:
//   1. the intro is on screen before the cutting engine (Preparation chunk) is even requested,
//      and game_ready is sent while the intro plays — once;
//   2. nothing runs under the intro: no Phaser canvas, no Level 1 HUD; Level 1's kitchen plate
//      is laid underneath once the film is up;
//   3. SKIP → Level 1 is playable; game_ready was still sent only once;
//   4. a returning player: game_ready once, from the Kitchen.
// Prints the measured bytes / timings and PASS/FAIL per check; exits 1 on any failure.
import { launch, boot, seedSave, sleep } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const URL = process.env.KC_URL || "http://127.0.0.1:4173/";
const { browser, page, logs } = await launch();
await page.evaluateOnNewDocument(() => {
  window.__ready = [];
  let real;
  Object.defineProperty(window, "bridge", {
    configurable: true,
    get: () => real,
    set(b) {
      real = b;
      const proto = Object.getPrototypeOf(b.platform);
      const send = proto.sendMessage;
      proto.sendMessage = function (m, ...rest) {
        if (m === "game_ready") window.__ready.push(performance.now());
        return send.call(this, m, ...rest);
      };
    },
  });
});
const net = [];
let t0 = 0;
page.on("request", (r) => net.push({ u: r.url(), t: Date.now() - t0 }));

// ---------- a brand-new player ----------
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
net.length = 0;
t0 = Date.now();
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => !!document.querySelector("[data-intro-scene]"), {
  timeout: 30000,
});
const introAt = Date.now() - t0;
await sleep(2500);
const during = await page.evaluate(() => ({
  ready: window.__ready.length,
  readyAt: window.__ready[0] ?? null,
  canvas: !!document.querySelector("canvas"),
  hud: /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
  plate: !!document.querySelector('[data-testid="kitchen-plate"]'),
}));
const prepReq = net.find((r) => /Preparation-[^/]*\.js/.test(r.u));
check(
  "1 the intro is up before the cutting engine is requested; game_ready is sent during the intro",
  !!prepReq && prepReq.t > introAt && during.ready === 1,
  { introAt, preparationRequestedAt: prepReq?.t ?? null, gameReady: during.ready },
);
check(
  "2 nothing runs under the intro (no canvas, no HUD); Level 1's kitchen plate lies underneath",
  !during.canvas && !during.hud && during.plate,
  during,
);
await page.waitForFunction(() => !!document.querySelector('[aria-label="Skip intro"]'), {
  timeout: 20000,
});
await page.evaluate(() => document.querySelector('[aria-label="Skip intro"]').click());
await page.waitForFunction(
  () => /·\s*(?:\d+\/\d+\s+[a-z-]+|\d+% peeled)/i.test(document.body.innerText),
  { timeout: 30000 },
);
const playableAt = Date.now() - t0;
await sleep(1500);
const after = await page.evaluate(() => ({
  ready: window.__ready.length,
  canvas: !!document.querySelector("canvas"),
}));
check(
  "3 SKIP → Level 1 is playable (canvas, HUD); game_ready still sent once",
  after.canvas && after.ready === 1,
  {
    playableAt,
    ...after,
  },
);

// ---------- a returning player ----------
await boot(page, seedSave());
await sleep(2500);
const ret = await page.evaluate(() => window.__ready.length);
check("4 a returning player: game_ready once", ret === 1, { ready: ret });

const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("5 no page errors", errors.length === 0, errors.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length ? `FIRST LOAD E2E: ${failed.length} FAILURE(S)` : "FIRST LOAD E2E: ALL PASS",
);
process.exit(failed.length ? 1 : 0);
