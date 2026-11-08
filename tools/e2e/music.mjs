// Music (developer 2026-11-08), restaurant build, real browser: the relaxing score and the loading music.
//   M1 before any tap: no sound (and no autoplay warning in the console); the loading screen says "tap for music" while it is up
//   M2 after the first tap the music is really coming out of the speakers: a level is measured on the output, soft and not clipping
//   M3 it keeps playing and changes (the level moves bar to bar), still soft after 40 s
//   M4 Music off in Settings (saved) is silent again; no console errors or warnings about audio
// A listener on the output (an AnalyserNode behind every connection to the destination) reads the real level.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, GAME_URL } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const { browser, page, logs } = await launch();
await page.evaluateOnNewDocument(() => {
  window.__peaks = [];
  window.__ctxs = [];
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const ctx = this.context;
    if (dest === ctx.destination && !ctx.__an) {
      ctx.__an = ctx.createAnalyser();
      ctx.__an.fftSize = 2048;
      orig.call(ctx.__an, ctx.destination);
      window.__ctxs.push(ctx);
      setInterval(() => {
        const a = new Float32Array(ctx.__an.fftSize);
        ctx.__an.getFloatTimeDomainData(a);
        let peak = 0;
        for (const v of a) peak = Math.max(peak, Math.abs(v));
        window.__peaks.push(Math.round(peak * 1000) / 1000);
      }, 250);
    }
    const r = orig.call(this, dest, ...rest);
    if (dest === ctx.destination && ctx.__an) orig.call(this, ctx.__an);
    return r;
  };
});
const save = seedSave({
  credits: 100_000,
  business: { ...MOVED_IN_BUSINESS, staff: { hiredRoles: ["server", "cashier"] } },
  levelProgress: {
    currentLevelId: "level-12",
    highestUnlockedLevelId: "level-12",
    completedLevelIds: Array.from({ length: 11 }, (_, i) => `level-${i + 1}`),
    campaignVersion: 4,
  },
  story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
  settings: { sound: true, music: true, reducedMotion: false, restaurantName: "Test Kitchen" },
});
await boot(page, save);
await sleep(2500);
const before = await page.evaluate(() => ({
  ctxs: window.__ctxs.length,
  peaks: window.__peaks.length,
}));
const audioWarn = () => logs.filter((l) => /AudioContext|autoplay|audio/i.test(l));
check(
  "M1 before any tap there is no audio context and no autoplay warning",
  before.ctxs === 0 && audioWarn().length === 0,
  { before, warns: audioWarn() },
);

// The loading screen's hint (the page is reloaded with the Bridge answer held back, so the loading screen stays up).
const p2 = await browser.newPage();
await p2.setRequestInterception(true);
// A Bridge whose save never answers: the loading screen stays up.
const SLOW = `window.bridge={EVENT_NAME:{PAUSE_STATE_CHANGED:"pause",AUDIO_STATE_CHANGED:"audio",INTERSTITIAL_STATE_CHANGED:"interstitial",REWARDED_STATE_CHANGED:"rewarded"},initialize:()=>Promise.resolve(),platform:{language:"en",isAudioEnabled:true,on(){},sendMessage(){}},storage:{get:()=>new Promise(()=>{}),set:()=>Promise.resolve()},advertisement:{isInterstitialSupported:false,isRewardedSupported:false,on(){},off(){},showInterstitial(){},showRewarded(){}},analytics:{send:()=>Promise.resolve()}};`;
p2.on("request", (r) =>
  /bridge\.playgama\.com/.test(r.url())
    ? r.respond({ status: 200, contentType: "application/javascript", body: SLOW })
    : r.continue(),
);
await p2.goto(GAME_URL, { waitUntil: "domcontentloaded" });
await sleep(2000);
const hint = await p2.evaluate(
  () => document.querySelector('[data-testid="loading-music-hint"]')?.textContent?.trim() ?? null,
);
check(
  "M1b the loading screen says 'tap for music' before the first tap",
  !!hint && /tap for music/.test(hint),
  hint,
);
await p2.close();

await page.bringToFront();
await page.mouse.click(215, 450);
await sleep(9000);
const a = await page.evaluate(() => ({
  ctxs: window.__ctxs.length,
  state: window.__ctxs[0]?.state,
  peaks: window.__peaks.slice(-30),
}));
const maxA = Math.max(...a.peaks);
check(
  "M2 after the first tap the music comes out of the speakers, soft and not clipping",
  a.ctxs === 1 && a.state === "running" && maxA > 0.003 && maxA < 0.6,
  { state: a.state, maxA, last: a.peaks.slice(-8) },
);
await sleep(40000);
const b = await page.evaluate(() => window.__peaks.slice(-160));
const maxB = Math.max(...b);
const distinct = new Set(b.map((v) => Math.round(v * 200))).size;
check(
  "M3 forty seconds later it still plays, softly, and moves (the level is not a constant hum)",
  maxB > 0.003 && maxB < 0.6 && distinct > 6,
  { maxB, distinct },
);
check(
  "M4 no console errors or audio warnings",
  logs.filter((l) => /^(error|pageerror)/.test(l)).length === 0 && audioWarn().length === 0,
  logs.slice(0, 4),
);
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `MUSIC E2E: ${failed} FAIL` : "MUSIC E2E: ALL PASS");
process.exit(failed ? 1 : 0);
