// Captures every intro beat into playgama/screenshots/intro/. Run against `npx vite preview` (port 4173).
import { launch, sleep, GAME_URL } from "./harness.mjs";
const OUTDIR = new URL("../../playgama/screenshots/intro/", import.meta.url).pathname.replace(
  /^\/([A-Z]:)/,
  "$1",
);
const OV = "div.absolute.inset-0.z-50.overflow-hidden";
const NAMES = [
  "01-opening-family-restaurant",
  "02-opening-decline",
  "03-opening-last-wish",
  "04-opening-open-the-restaurant",
  "05-fresh-start",
  "06-fresh-clean",
  "07-fresh-small-repairs",
  "08-fresh-your-savings-ready",
  "09-chef-you-spent-your-savings",
  "10-you-every-last-bit",
  "11-chef-better-not-waste-it",
  "12-chef-cooking-and-prep",
  "13-chef-bring-this-place-back",
  "14-level-1-first-prep",
];
const { browser, page } = await launch();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await page.goto(GAME_URL, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle0" });
await page.waitForSelector(OV);
for (let i = 0; i < NAMES.length; i++) {
  const hasBtn = await page.evaluate(
    (ov) =>
      [...document.querySelector(ov).querySelectorAll("button")].some(
        (b) => !/Skip/.test(b.textContent),
      ),
    OV,
  );
  await sleep(hasBtn ? 1000 : [0, 0, 0, 0, 0, 0, 0, 0, 0, 650, 0, 0, 0, 0][i] || 800);
  await page.screenshot({ path: OUTDIR + NAMES[i] + ".png" });
  const txt = await page.evaluate(
    (ov) => document.querySelector(ov)?.innerText.replace(/\s+/g, " ").slice(0, 60),
    OV,
  );
  console.log(NAMES[i], "|", txt);
  await page.evaluate((ov) => {
    const o = document.querySelector(ov);
    const b = [...o.querySelectorAll("button")].find((x) => !/Skip/.test(x.textContent));
    if (b) b.click();
    else o.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, OV);
  await sleep(80);
}
await sleep(600);
await page.screenshot({ path: OUTDIR + "15-level-1-after-intro.png" });
await browser.close();
