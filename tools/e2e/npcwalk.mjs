// NPC doors, facing and dishes (developer 2026-11-26: "the customers are not walking out through the proper door, some are walking out sideways", "let the waiter staffs deliver real dish with dish image
// ... properly place it in their hands", "find and fix all other issues regarding NPCs", "check the second floor also"), restaurant build, real browser, all six kitchen maps in a tall and a wide window.
// The map's animations are paused and stepped through a whole lap (every 0.5 s), so the walk is read exactly, not waited for:
//   W1 first floor, every stage tall and wide: whenever a guest is in the street doorway (below the front wall) they are inside the gap between the door leaves
//   W2 ... and the painted pose is facing the camera or away from it (walk-down / walk-up), never a side pose
//   W3 the Server carries a REAL dish: while a carrying pose shows, a dish picture (public/dishes/<id>.webp) is shown on it; while empty-handed none is
//   W4 the Second Floor's Servers carry a painted food icon the same way; their poses are carry poses
//   W5 no console errors
// Screenshots: out/npcwalk-*.png (the Server holding a dish, each stage). Prints PASS/FAIL per check and exits 1 on any failure.
import { MOVED_IN_BUSINESS, boot, launch, seedSave, sleep, shot } from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const STAGES = [
  "humble-kitchen",
  "growing-kitchen",
  "established-kitchen",
  "neighborhood-cafe",
  "flourishing-cafe",
  "grand-kitchen",
];
const GAP_TALL = [47.6, 53.0];
const GAP_WIDE = {
  "humble-kitchen": [47.4, 51.1],
  "growing-kitchen": [47.95, 51.75],
  "established-kitchen": [47.5, 53.0],
  "neighborhood-cafe": [47.3, 51.1],
  "flourishing-cafe": [47.2, 53.1],
  "grand-kitchen": [47.7, 52.5],
};
const ALL = ["server", "cashier", "cleaner", "line-cook", "prep-cook", "head-chef", "manager"];
const save = (id, extra = {}) => {
  const s = seedSave({
    credits: 100_000,
    business: { ...MOVED_IN_BUSINESS, staff: { hiredRoles: ALL }, ...extra },
    levelProgress: {
      currentLevelId: "level-40",
      highestUnlockedLevelId: "level-40",
      completedLevelIds: Array.from({ length: 39 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    ownedKitchenUpgradeIds: STAGES.slice(0, STAGES.indexOf(id) + 1),
    equippedKitchenUpgradeId: id,
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion: false, restaurantName: "Test Kitchen" },
  });
  s.version = 3;
  return s;
};
const { browser, page, logs } = await launch();

/** Pause every animation of a map layer and sample the cast at the given times (seconds). `rootSel` is the layer (guest-life, staff-life, floor-life). */
const sample = (rootSel, times) =>
  page.evaluate(
    (sel, ts) => {
      const root = document.querySelector(sel);
      if (!root) return null;
      // the layout box (the map is drawn inside a CSS scale, and a translate's percent is of the unscaled box)
      const box = { width: root.offsetWidth, height: root.offsetHeight };
      const anims = root.getAnimations({ subtree: true });
      anims.forEach((a) => a.pause());
      const out = [];
      for (const t of ts) {
        anims.forEach((a) => {
          a.currentTime = t * 1000;
        });
        for (const actor of root.querySelectorAll(".floor-actor")) {
          const m = new DOMMatrixReadOnly(getComputedStyle(actor).transform);
          const x = (m.m41 / box.width) * 100 || 0;
          const y = (m.m42 / box.height) * 100 || 0;
          const here = getComputedStyle(actor).opacity !== "0";
          const layer = [...actor.querySelectorAll(".cs-layer")].find(
            (l) => getComputedStyle(l).opacity === "1",
          );
          const dishes = [...actor.querySelectorAll('[data-testid="floor-dish"]')]
            // visible only when its own keyframes show it AND the pose layer it sits in is the one showing
            .filter(
              (d) =>
                getComputedStyle(d).opacity === "1" &&
                (!d.closest(".cs-layer") ||
                  getComputedStyle(d.closest(".cs-layer")).opacity === "1"),
            )
            .map((d) => d.getAttribute("data-dish"));
          out.push({
            id: actor.getAttribute("data-actor") + ":" + (actor.getAttribute("data-look") ?? ""),
            kind: actor.getAttribute("data-actor"),
            t,
            x,
            y,
            here,
            pose: layer?.getAttribute("data-pose") ?? null,
            dishes,
          });
        }
      }
      return out;
    },
    rootSel,
    times,
  );
const frames = (n, step) => Array.from({ length: n }, (_, i) => 20 + i * step);

try {
  for (const layout of [
    ["wide", 1815, 867],
    ["tall", 390, 844],
  ]) {
    const [name, w, h] = layout;
    for (const id of STAGES) {
      await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
      await boot(page, save(id));
      await page.evaluate(() => document.querySelector('[data-nav="restaurant-map"]')?.click());
      await page.waitForSelector(".restaurant-map-stage", { timeout: 15000 });
      await sleep(3500);
      const gap = name === "wide" ? GAP_WIDE[id] : GAP_TALL;
      // a whole lap of the longest guest (the family: about 100 s) at half-second steps
      const g = await sample('[data-testid="guest-life"]', frames(240, 0.5));
      const inDoor = (g ?? []).filter((s) => s.here && s.y >= 84 && s.y <= 90);
      const outOfGap = inDoor.filter((s) => s.x < gap[0] || s.x > gap[1]);
      const sideways = inDoor.filter((s) => s.pose && !/^walk-(down|up)$/.test(s.pose));
      check(
        `W1 ${name} ${id}: in the street door every guest is between the door leaves (${inDoor.length} samples)`,
        inDoor.length > 0 && outOfGap.length === 0,
        { gap, bad: outOfGap.slice(0, 3).map((s) => [s.id, s.t, s.x.toFixed(1), s.y.toFixed(1)]) },
      );
      check(
        `W2 ${name} ${id}: ... and drawn facing the camera or away, never sideways`,
        sideways.length === 0,
        sideways.slice(0, 3).map((s) => [s.id, s.t, s.pose]),
      );
      // the Server: a real dish while a carrying pose shows
      const st = await sample('[data-testid="staff-life"]', frames(80, 0.5));
      const srv = (st ?? []).filter((s) => s.id.startsWith("server:") && s.here);
      const carrying = srv.filter((s) => s.pose && s.pose.startsWith("carry-"));
      const withDish = carrying.filter((s) => s.dishes.length > 0);
      const emptyHanded = srv.filter(
        (s) => !(s.pose && s.pose.startsWith("carry-")) && s.dishes.length > 0,
      );
      check(
        `W3 ${name} ${id}: the Server carries a real dish on the tray (${withDish.length} of ${carrying.length} carrying samples), none when empty-handed`,
        carrying.length > 0 && withDish.length === carrying.length && emptyHanded.length === 0,
        {
          carrying: carrying.length,
          withDish: withDish.length,
          empty: emptyHanded.length,
          dish: withDish[0]?.dishes,
        },
      );
      if (withDish[0] && (id === "grand-kitchen" || id === "humble-kitchen")) {
        await sample('[data-testid="staff-life"]', [withDish[0].t]);
        await shot(page, `npcwalk-${name}-${id}-server`);
      }
    }
  }
  // the Second Floor
  const floor = {
    stations: Object.fromEntries(
      ["pizza", "coffee", "drinks", "burger", "iceCream", "hotFood"].map((s) => [
        s,
        { level: 1, lastCollectAt: Date.now() },
      ]),
    ),
    servers: 3,
    cleaners: 2,
  };
  for (const [name, w, h] of [
    ["wide", 1815, 867],
    ["tall", 390, 844],
  ]) {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await boot(page, save("grand-kitchen", { secondFloor: floor }));
    const opened = await page.evaluate(() => {
      const b = document.querySelector('[data-nav="restaurant-map"]');
      b?.click();
      return !!b;
    });
    await page.waitForSelector(".restaurant-map-stage", { timeout: 15000 });
    await sleep(1200);
    // open the Second Floor (the Upstairs button)
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) =>
          /upstairs|2nd floor|second floor/i.test(
            b.textContent + (b.getAttribute("aria-label") ?? ""),
          ),
        )
        ?.click(),
    );
    await sleep(3500);
    const f = await sample('[data-testid="floor-life"]', frames(120, 0.5));
    const servers = (f ?? []).filter((s) => s.kind === "server" && s.here);
    const carry = servers.filter((s) => s.pose && s.pose.startsWith("carry-"));
    const dishes = carry.filter((s) => s.dishes.length > 0);
    check(
      `W4 ${name} second floor: the Servers carry a painted food icon on a carrying pose (${dishes.length} of ${carry.length})`,
      !!f && opened && servers.length > 0 && carry.length > 0 && dishes.length === carry.length,
      {
        servers: servers.length,
        carry: carry.length,
        dishes: dishes.length,
        noDish: carry
          .filter((x) => x.dishes.length === 0)
          .slice(0, 4)
          .map((x) => [x.id, x.t, x.x.toFixed(1), x.y.toFixed(1), x.pose]),
      },
    );
    if (dishes[0]) {
      await sample('[data-testid="floor-life"]', [dishes[0].t]);
      await shot(page, `npcwalk-${name}-second-floor`);
    }
  }
} catch (e) {
  console.log("FAIL harness", String(e).slice(0, 300));
  await shot(page, "npcwalk-fail").catch(() => {});
  results.push({ id: "harness", ok: false });
}
const errors = logs.filter((l) => /pageerror|error:/.test(l) && !/favicon/.test(l));
check("W5 no console errors", errors.length === 0, errors.slice(0, 3));
await browser.close();
const failed = results.filter((x) => !x.ok).length;
console.log(failed ? `NPC WALK E2E: ${failed} FAILURE(S)` : "NPC WALK E2E: ALL PASS");
process.exit(failed ? 1 : 0);
