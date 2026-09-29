import { launch, freshPlayer, sleep, shot, readSave } from "./harness.mjs";
const { browser, page, logs } = await launch();
await freshPlayer(page);
const t0 = Date.now();
const seen = [];
let last = "";
const shots = new Set();
while (Date.now() - t0 < 30000) {
  const st = await page.evaluate(() => {
    const d = document.querySelector('[aria-label="Intro"]');
    if (!d) return null;
    const sub = d.querySelector('[aria-live] p:last-child')?.textContent ?? "";
    return { scene: d.getAttribute("data-intro-scene"), sub, skip: !!d.querySelector('[aria-label="Skip intro"]'), outro: d.className.includes("kc-cine-outro") };
  });
  const ms = Date.now() - t0;
  if (!st) { seen.push(`${ms} GONE`); break; }
  const key = `${st.scene}|${st.sub}|${st.skip}|${st.outro}`;
  if (key !== last) { seen.push(`${ms} ${key}`); last = key;
    const name = `cine-${st.scene}${st.outro ? "-outro" : ""}`;
    if (!shots.has(name)) { shots.add(name); await sleep(350); await shot(page, name); }
  }
  await sleep(40);
}
console.log(seen.join("\n"));
await sleep(600);
await shot(page, "cine-after");
const s = await readSave(page);
console.log("introDone", s?.story?.introDone, "hud", (await page.evaluate(() => document.body.innerText)).replace(/\s+/g," ").slice(0,90));
console.log("logs", JSON.stringify(logs));
await browser.close();
