// The cleaners' portraits (developer 2026-11-07: "add the cleaner's assets": Cleaner Assets/F01 and F02), restaurant build, real browser:
//   K1 Market -> Second Floor, no Floor Cleaner hired yet: the card shows the first one (the woman, floor-cleaner.webp)
//   K2 with one hired the card shows the NEXT person to hire: the man (floor-cleaner-male.webp); the Floor Server keeps its one portrait
//   K3 the Second Floor screen shows one face per hired Floor Cleaner (two when two are hired), the woman then the man
//   K4 Cleanliness: "A Cleaner for today" is the man with the mop (cleaner-today.webp); every picture loaded
//   K5 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

const COFFEE = { level: 1, lastCollectAt: Date.now(), tables: 1, polish: 0 };
const atLevel = (n, floor = {}) =>
  seedSave({
    credits: 1_000_000,
    business: {
      ...MOVED_IN_BUSINESS,
      secondFloor: { stations: { coffee: COFFEE }, ...floor },
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 3,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion: false, restaurantName: "Test Kitchen" },
  });

const { browser, page, logs } = await launch();
const openFloorTab = async () => {
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await sleep(900);
  await page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Shop categories"] button')]
      .find((b) => /Second Floor/.test(b.textContent ?? ""))
      ?.click(),
  );
  await page.waitForSelector('[data-testid="market-second-floor"]', { timeout: 15000 });
  await sleep(600);
};
const faces = () =>
  page.evaluate(() =>
    [...document.querySelectorAll("img[data-floor-staff-face]")].map((i) => ({
      role: i.dataset.floorStaffFace,
      index: Number(i.dataset.floorStaffIndex),
      file: (i.getAttribute("src") ?? "").split("/").pop(),
      ok: i.complete && i.naturalWidth > 0,
    })),
  );

try {
  // ---- K1 / K2: the Market's floor team card ----
  await boot(page, atLevel(40, { cleaners: 0, servers: 0 }));
  await openFloorTab();
  const none = await faces();
  await shot(page, "cleaners-1-market-none");
  check(
    "K1 with no Floor Cleaner yet the card shows the first one: the woman",
    none.some((f) => f.role === "cleaner" && f.file === "floor-cleaner.webp" && f.ok) &&
      none.some((f) => f.role === "server" && f.file === "floor-server.webp" && f.ok),
    none,
  );
  await boot(page, atLevel(40, { cleaners: 1, servers: 1 }));
  await openFloorTab();
  const one = await faces();
  await shot(page, "cleaners-2-market-one");
  check(
    "K2 with one Floor Cleaner hired the card shows the NEXT person to hire: the man; the Floor Server keeps one portrait",
    one.some((f) => f.role === "cleaner" && f.file === "floor-cleaner-male.webp" && f.ok) &&
      one.some((f) => f.role === "server" && f.file === "floor-server.webp" && f.ok),
    one,
  );

  // ---- K3: the Second Floor screen ----
  await boot(page, atLevel(40, { cleaners: 2, servers: 1 }));
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await sleep(900);
  await page.evaluate(() =>
    [...document.querySelectorAll("[aria-label]")]
      .find((e) => e.getAttribute("aria-label") === "Upstairs to the second floor")
      ?.click(),
  );
  await sleep(1500);
  // The floor team is listed in the Pickup Counter's sheet.
  await page.evaluate(() =>
    [...document.querySelectorAll("button, [role=button], [aria-label]")]
      .find((e) =>
        /Pickup Counter/i.test((e.getAttribute("aria-label") ?? e.textContent ?? "").trim()),
      )
      ?.click(),
  );
  await sleep(1200);
  const cleanerFaces = (await faces()).filter((f) => f.role === "cleaner");
  await shot(page, "cleaners-3-floor");
  check(
    "K3 the Second Floor screen shows one face per hired Floor Cleaner: the woman, then the man",
    cleanerFaces.length === 2 &&
      cleanerFaces[0].file === "floor-cleaner.webp" &&
      cleanerFaces[1].file === "floor-cleaner-male.webp" &&
      cleanerFaces.every((f) => f.ok),
    cleanerFaces,
  );

  // ---- K4: Cleanliness, "A Cleaner for today" ----
  await boot(
    page,
    seedSave({
      credits: 50_000,
      business: {
        ...MOVED_IN_BUSINESS,
        calendar: { businessDay: 40 },
        cleanliness: {
          tasks: [{ kind: "wipe-boards", count: 1, since: 1 }],
          open: {},
          counters: { sink: 0, paper: 0 },
          cleanerAreas: ["kitchen", "dining", "restroom"],
          introSeen: true,
          cupboardAt: 21,
          lastStart: null,
          cleaned: 0,
          byCleaner: 0,
        },
      },
      levelProgress: {
        currentLevelId: "level-40",
        highestUnlockedLevelId: "level-40",
        completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
        campaignVersion: 3,
      },
      story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
      settings: {
        sound: false,
        music: false,
        reducedMotion: false,
        restaurantName: "Test Kitchen",
      },
    }),
  );
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".map-hotspot-zone", { timeout: 15000 }).catch(() => null);
  await sleep(600);
  await page.evaluate(() =>
    [...document.querySelectorAll(".map-hotspot-zone")]
      .find((e) => /Manager \/ Office/.test(e.getAttribute("aria-label") ?? ""))
      ?.click(),
  );
  await sleep(900);
  await page.evaluate(() => {
    [...document.querySelectorAll('nav[aria-label="Business sections"] button')]
      .find((x) => x.textContent.includes("Cleanliness"))
      ?.click();
  });
  await sleep(1200);
  // The portrait is lazy-loaded below the fold: bring the card into view first, as a player scrolling would.
  await page.evaluate(() =>
    document.querySelector('[data-testid="day-cleaner"]')?.scrollIntoView({ block: "center" }),
  );
  await sleep(1500);
  const day = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="day-cleaner"]');
    const img = card?.querySelector("img[data-cleaner-face]");
    return card
      ? {
          file: (img?.getAttribute("src") ?? "").split("/").pop(),
          today: img?.getAttribute("data-cleaner-today"),
          ok: !!img && img.complete && img.naturalWidth > 0,
        }
      : null;
  });
  await shot(page, "cleaners-4-day-cleaner");
  check(
    "K4 'A Cleaner for today' is the man with the mop (cleaner-today.webp), loaded",
    !!day && day.file === "cleaner-today.webp" && day.today === "true" && day.ok,
    day,
  );

  const bad = logs.filter(
    (l) => !/favicon|bridge|playgama|Failed to load resource.*(404|net::)/i.test(l),
  );
  check("K5 no console errors", bad.length === 0, bad.slice(0, 5));
} catch (e) {
  check("run", false, String(e).slice(0, 500));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0 ? "\nCLEANERS E2E: ALL PASS" : `\nCLEANERS E2E: ${failed.length} FAIL`,
);
process.exit(failed.length === 0 ? 0 : 1);
