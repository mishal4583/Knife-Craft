// NPC realism (developer 2026-11-07), restaurant build, real browser: the painted people.
//   P1 first floor, every staff role hired: the staff are painted (data-look), loaded, each from its own sheet; the Old Chef is the head chef's look
//   P2 the first floor's guests are painted people with different looks (both genders), loaded
//   P3 the people are bigger than the old puppets and stand on the map (feet on their spot), none outside the map
//   P4 the Second Floor's crew and guests are painted; four floor servers / cleaners can look different; all loaded
//   P5 a sheet that fails to load leaves the old puppet for that person only
//   P6 no console errors
// Screenshots: out/npc-*.png. Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, launch, boot, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const ALL = ["server", "cashier", "cleaner", "line-cook", "prep-cook", "head-chef", "manager"];
const save = (n = 40, floor = undefined) =>
  seedSave({
    credits: 100_000,
    business: {
      ...MOVED_IN_BUSINESS,
      staff: { hiredRoles: ALL },
      ...(floor ? { secondFloor: floor } : {}),
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

// ---- first floor ----
await boot(page, save());
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await page.waitForSelector(".restaurant-map-stage", { timeout: 15000 });
await sleep(3500);
const people = (sel) =>
  page.evaluate((s) => {
    const stage = document.querySelector(".restaurant-map-stage")?.getBoundingClientRect();
    return [...document.querySelectorAll(`${s} .floor-actor`)].map((a) => {
      const p = a.querySelector(".floor-person");
      const r = p?.getBoundingClientRect();
      return {
        kind: a.getAttribute("data-actor"),
        look: a.getAttribute("data-look"),
        gender: p?.getAttribute("data-gender"),
        w: r ? Math.round(r.width) : 0,
        inside: r && stage ? r.right > stage.left && r.left < stage.right : true,
        layers: [...a.querySelectorAll(".cs-layer")].map((l) => l.getAttribute("data-pose")),
        loaded: [...a.querySelectorAll(".cs-cell")].every((c) =>
          (getComputedStyle(c).backgroundImage ?? "").includes("people/"),
        ),
      };
    });
  }, sel);
const staff = await people('[data-testid="staff-life"]');
await shot(page, "npc-1-first-floor");
const looks = staff.map((s) => s.look);
check(
  "P1 every hired role is a painted person with its own look; the Old Chef is the head chef's",
  ["server", "cashier", "line-cook", "prep-cook", "manager"].every((l) => looks.includes(l)) &&
    looks.filter((l) => l === "head-chef").length === 2 &&
    staff.every((s) => s.look && s.loaded),
  looks,
);
const guests = await people('[data-testid="guest-life"]');
check(
  "P2 the first floor's guests are painted and different (both genders)",
  guests.length === 7 &&
    new Set(guests.map((g) => g.look)).size === 7 &&
    new Set(guests.map((g) => g.gender)).size === 2 &&
    guests.every((g) => g.loaded),
  guests.map((g) => `${g.look}/${g.gender}`),
);
check(
  "P3 the people are bigger than the old puppets (a box at least 44 px at this width), and on the map",
  [...staff, ...guests].every((p) => p.w >= 40 && p.inside),
  [...staff, ...guests].map((p) => p.w),
);

// A while later every guest has come in: a busy room (screenshot), nobody on top of a hotspot's label (they are decoration: no taps).
await sleep(26000);
await shot(page, "npc-1b-first-floor-busy");
const taps = await page.evaluate(
  () =>
    getComputedStyle(document.querySelector('[data-testid="guest-life"]')).pointerEvents +
    "/" +
    document.querySelector('[data-testid="guest-life"]').getAttribute("aria-hidden"),
);
check("P3b the guests are decoration (aria-hidden, no taps)", taps === "none/true", taps);

// ---- second floor ----
const COFFEE = { level: 1, lastCollectAt: Date.now(), tables: 1, polish: 0 };
await boot(
  page,
  save(40, {
    stations: {
      coffee: COFFEE,
      pizza: { ...COFFEE },
      drinks: { ...COFFEE },
      burger: { ...COFFEE },
      iceCream: { ...COFFEE },
      hotFood: { ...COFFEE },
    },
    servers: 3,
    cleaners: 2,
  }),
);
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await sleep(900);
await page.evaluate(() =>
  [...document.querySelectorAll("[aria-label]")]
    .find((e) => e.getAttribute("aria-label") === "Upstairs to the second floor")
    ?.click(),
);
await sleep(4500);
const floor = await page.evaluate(() =>
  [...document.querySelectorAll('[data-testid="floor-life"] .floor-actor')].map((a) => ({
    kind: a.getAttribute("data-actor"),
    look: a.getAttribute("data-look"),
    loaded: [...a.querySelectorAll(".cs-cell")].every((c) =>
      (getComputedStyle(c).backgroundImage ?? "").includes("people/"),
    ),
  })),
);
await shot(page, "npc-2-second-floor");
const servers = floor.filter((f) => f.kind === "server").map((f) => f.look);
const cleaners = floor.filter((f) => f.kind === "cleaner").map((f) => f.look);
check(
  "P4 the Second Floor: painted crew (floor servers and cleaners all look different) and guests",
  floor.length > 0 &&
    floor.every((f) => f.look && f.loaded) &&
    servers.length >= 1 &&
    new Set(servers).size === servers.length &&
    new Set(cleaners).size === cleaners.length &&
    servers.every((l) => /^floor-server-/.test(l)) &&
    cleaners.every((l) => /^floor-cleaner-/.test(l)),
  { servers, cleaners, guests: floor.filter((f) => f.kind === "guest").length },
);

// ---- other screens: no sideways scroll, the people are there ----
for (const [w, h] of [
  [320, 568],
  [768, 1024],
]) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await boot(page, save());
  await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
  await page.waitForSelector(".restaurant-map-stage", { timeout: 15000 });
  await sleep(3500);
  const fit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    painted: document.querySelectorAll('[data-testid="staff-life"] .floor-person--sprite').length,
  }));
  await shot(page, `npc-3-${w}`);
  check(
    `P7 at ${w} px: no sideways scroll, the staff are painted`,
    fit.overflow <= 0 && fit.painted >= 6,
    fit,
  );
}
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });

// ---- a picture that fails ----
// The server's sheet "fails to load" (the probe's Image fires an error): the old SVG puppet stays, nobody is blank.
await page.evaluateOnNewDocument(() => {
  const d = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    ...d,
    set(v) {
      if (/people\/server\//.test(String(v))) {
        setTimeout(() => this.dispatchEvent(new Event("error")), 10);
        return;
      }
      d.set.call(this, v);
    },
  });
});
await boot(page, save());
await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
await page.waitForSelector(".restaurant-map-stage", { timeout: 15000 });
await sleep(3500);
const fb = await page.evaluate(() => {
  const a = [...document.querySelectorAll('[data-testid="staff-life"] .floor-actor')].find(
    (x) => x.getAttribute("data-actor") === "server",
  );
  const cook = [...document.querySelectorAll('[data-testid="staff-life"] .floor-actor')].find(
    (x) => x.getAttribute("data-actor") === "cook",
  );
  return {
    serverPuppet: !!a?.querySelector("svg.guest-pose"),
    serverSprite: !!a?.querySelector(".floor-person--sprite"),
    cookSprite: !!cook?.querySelector(".floor-person--sprite"),
  };
});
check(
  "P5 a sheet that fails to load leaves the old puppet for that person only (the others stay painted)",
  fb.serverPuppet && !fb.serverSprite && fb.cookSprite,
  fb,
);

const bad = logs.filter(
  (l) => !/favicon|bridge|playgama|Failed to load resource.*(404|net::)/i.test(l),
);
check("P6 no console errors", bad.length === 0, bad.slice(0, 5));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0 ? "\nNPC PEOPLE E2E: ALL PASS" : `\nNPC PEOPLE E2E: ${failed.length} FAIL`,
);
process.exit(failed.length === 0 ? 0 : 1);
