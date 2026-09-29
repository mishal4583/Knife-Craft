import { launch, sleep, text, GAME_URL } from "./harness.mjs";
const r = [];
const check = (ok, l) => r.push(`${ok ? "ok  " : "FAIL"} ${l}`);
const { browser, page, logs } = await launch();
await page.setViewport({ width: 390, height: 844 });
const external = [];
page.on("request", (q) => {
  const u = q.url();
  if (!u.startsWith("http://localhost") && !u.startsWith("data:") && !u.startsWith("blob:"))
    external.push(u);
});
await page.evaluateOnNewDocument(() => {
  // Spy on sendMessage without touching the SDK before it is initialized:
  // wrap initialize() when the Bridge script assigns window.bridge.
  window.__msgs = [];
  let real;
  Object.defineProperty(window, "bridge", {
    configurable: true,
    get() {
      return real;
    },
    set(b) {
      real = b;
      const init = b.initialize.bind(b);
      b.initialize = (...args) =>
        init(...args).then((r) => {
          // b.platform is a fresh object per access — patch its prototype.
          const proto = Object.getPrototypeOf(b.platform);
          const send = proto.sendMessage;
          proto.sendMessage = function (m, ...rest) {
            window.__msgs.push(m);
            return send.call(this, m, ...rest);
          };
          return r;
        });
    },
  });
});
await page.goto(GAME_URL, { waitUntil: "networkidle0", timeout: 90000 });
await sleep(3000);
const info = await page.evaluate(() => ({
  hasBridge: !!window.bridge,
  platform: window.bridge?.platform?.id,
  lang: window.bridge?.platform?.language,
  msgs: window.__msgs,
  canvas: !!document.querySelector("canvas"),
  ls: Object.keys(localStorage),
}));
check(
  info.hasBridge && typeof info.platform === "string",
  `Bridge loaded from Playgama's CDN and initialized (platform "${info.platform}", language "${info.lang}")`,
);
check(
  info.msgs.includes("game_ready") && info.msgs.filter((m) => m === "game_ready").length === 1,
  `game_ready sent exactly once when playable (messages: ${JSON.stringify(info.msgs)})`,
);
check(info.canvas, "New player lands in the first level (cutting canvas up)");
check(
  !info.ls.includes("knifecraft.save.v1"),
  `The game never writes its own localStorage key (keys now: ${JSON.stringify(info.ls)})`,
);
// Save through Bridge: skip to Kitchen by giving a save via bridge storage, reload, verify it loads
await page.evaluate(async () => {
  const save = {
    version: 2,
    credits: 123400,
    story: { introDone: true, milestoneMask: 0, finaleSeen: false },
    // Its one reached milestone (First dish served) was already paid — so loading adds nothing.
    economyLedger: [
      {
        id: "seed-first-dish",
        timestamp: 0,
        category: "milestone-reward",
        amount: 10000,
        description: "first-dish",
      },
    ],
    levelProgress: {
      currentLevelId: "level-10",
      highestUnlockedLevelId: "level-10",
      completedLevelIds: [
        "level-1",
        "level-2",
        "level-3",
        "level-4",
        "level-5",
        "level-6",
        "level-7",
        "level-8",
        "level-9",
      ],
    },
  };
  await window.bridge.storage.set(["knifecraft_save"], [JSON.stringify(save)]);
});
await page.reload({ waitUntil: "networkidle0" });
await sleep(2500);
let t = await text(page);
check(
  /\$1,234\.00/.test(t) && /Today's Order/i.test(t),
  "A save written to Bridge storage loads on reload ($1,234.00 on the Kitchen)",
);
// buy a knife → persisted via Bridge storage
await page.evaluate(() =>
  [...document.querySelectorAll("nav button")]
    .find((b) => b.textContent.includes("Market"))
    ?.click(),
);
await sleep(900);
const before = await page.evaluate(
  async () =>
    ((v) => (typeof v === "string" ? JSON.parse(v) : v))(
      (await window.bridge.storage.get(["knifecraft_save"]))[0],
    ).credits,
);
await page.evaluate(() => {
  const c = [...document.querySelectorAll("article.product-card")].find((a) =>
    /Santoku/.test(a.textContent),
  );
  [...(c?.querySelectorAll("button") ?? [])]
    .find((x) => /^Buy$/.test(x.textContent.trim()))
    ?.click();
});
await sleep(900);
const after = await page.evaluate(async () =>
  ((v) => (typeof v === "string" ? JSON.parse(v) : v))(
    (await window.bridge.storage.get(["knifecraft_save"]))[0],
  ),
);
// Economy V2.5: the $350 Santoku also pays its one-time $100 "Santoku in your kit" milestone.
const santokuMilestone = after.economyLedger.filter((e) => e.description === "knife-santoku");
check(
  before - after.credits === 35000 - 10000 &&
    after.ownedKnifeIds.includes("santoku") &&
    santokuMilestone.length === 1 &&
    santokuMilestone[0].amount === 10000,
  `Buying the Santoku saves through Bridge storage (${before} → ${after.credits} cents: −$350 + $100 milestone)`,
);
await page.reload({ waitUntil: "networkidle0" });
await sleep(2000);
t = await text(page);
check(/\$984\.00/.test(t), "Reload keeps the purchase ($984.00)");
// pause/audio events reach the game
const paused = await page.evaluate(async () => {
  const b = window.bridge;
  const ev = b.EVENT_NAME;
  const fire = (name, v) => {
    const h = b.platform._events?.[name] ?? b.platform.__proto__;
  };
  return {
    pauseEvent: ev.PAUSE_STATE_CHANGED,
    audioEvent: ev.AUDIO_STATE_CHANGED,
    interstitial: b.advertisement.isInterstitialSupported,
    rewarded: b.advertisement.isRewardedSupported,
  };
});
check(
  !!paused.pauseEvent && !!paused.audioEvent,
  `Bridge exposes the pause/audio events the game subscribes to (${paused.pauseEvent}, ${paused.audioEvent}); ads on this mock: interstitial ${paused.interstitial}, rewarded ${paused.rewarded}`,
);
const ext = [...new Set(external.map((u) => new URL(u).host))];
check(
  ext.every((h) => /playgama\.com$/.test(h)),
  `Only Playgama's own hosts contacted: ${JSON.stringify(ext)}`,
);
await browser.close();
console.log(r.join("\n"));
console.log("console:", logs);
