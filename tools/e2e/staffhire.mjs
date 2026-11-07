// Hiring flows use the people's own portraits and open on THEIR card (developer 2026-11-06: "the cashier doesn't use the generated avatar, and
// Hire should show the cashier's card directly, not just the Staff page").
//   T1 Inventory -> Needs attention: the missing Cashier tile shows the Cashier's painted portrait, not an emoji
//   T2 tapping that tile opens Business -> Staff scrolled to the Cashier's card, marked "Needed now", and it is inside the visible screen
//   T3 with BOTH the Server and the Cashier missing, each tile opens the Staff screen on its own card
//   T4 the Market's "Hire your team" card (Level 2 on; the first service offers the hires inside it) shows both portraits
//   T5 no console errors
// Prints PASS/FAIL per check and exits 1 on any failure.
import {
  MOVED_IN_BUSINESS,
  launch,
  boot,
  seedSave,
  sleep,
  readSave,
  shot,
  openShortcut,
} from "./harness.mjs";

const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};

// With campaignVersion 3 the seed's level number IS the game level (restaurantLevelOf).
const saveAt = (n, hired) =>
  seedSave({
    credits: 2_400_000,
    business: {
      ...MOVED_IN_BUSINESS,
      staff: { hiredRoles: hired },
    },
    levelProgress: {
      currentLevelId: `level-${n}`,
      highestUnlockedLevelId: `level-${n}`,
      completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    settings: { sound: false, music: false, reducedMotion: false, restaurantName: "Test Kitchen" },
  });

const { browser, page, logs } = await launch();
const click = async (sel, wait = 400) => {
  await page.evaluate((s) => document.querySelector(s)?.click(), sel);
  await sleep(wait);
};

const attentionTile = (role) =>
  page.evaluate((r) => {
    const li = document.querySelector(`[data-attention="staff:${r}"]`);
    if (!li) return null;
    const img = li.querySelector("img");
    return {
      img: !!img,
      loaded: !!img && img.complete && img.naturalWidth > 0,
      src: img?.getAttribute("src") ?? null,
      alt: img?.getAttribute("alt") ?? null,
      text: li.textContent.trim().replace(/\s+/g, " ").slice(0, 60),
    };
  }, role);

const cardState = (role) =>
  page.evaluate((r) => {
    const card = document.querySelector(`[data-staff-role="${r}"]`);
    if (!card) return null;
    const rect = card.getBoundingClientRect();
    return {
      needed: card.getAttribute("data-staff-needed") === "true",
      label: /Needed now/.test(card.textContent),
      visible: rect.top >= 0 && rect.bottom <= window.innerHeight && rect.height > 40,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
    };
  }, role);

try {
  // ---- T1, T2: the Cashier alone is missing ----
  await boot(page, saveAt(11, ["server"])); // L11 (2 ingredients): the panel shows six tiles, so a level with fewer stock needs keeps the staff tile in view
  await openShortcut(page, "inventory");
  await sleep(600);
  const tile = await attentionTile("cashier");
  await shot(page, "staffhire-attention");
  check(
    "T1 the missing Cashier's tile shows the Cashier's painted portrait (not an emoji)",
    !!tile && tile.img && tile.loaded && /staff-portraits\/cashier\.webp/.test(tile.src ?? ""),
    tile,
  );
  await page.evaluate(() =>
    document.querySelector('[data-attention="staff:cashier"] button')?.click(),
  );
  await sleep(1200);
  const card = await cardState("cashier");
  await shot(page, "staffhire-card");
  check(
    "T2 tapping it opens Staff on the Cashier's card, marked Needed now and inside the screen",
    !!card && card.needed && card.label && card.visible,
    card,
  );

  // ---- T3: both missing, each tile goes to its own card ----
  await boot(page, saveAt(11, []));
  await openShortcut(page, "inventory");
  await sleep(600);
  const both = {
    server: await attentionTile("server"),
    cashier: await attentionTile("cashier"),
  };
  await page.evaluate(() =>
    document.querySelector('[data-attention="staff:server"] button')?.click(),
  );
  await sleep(1200);
  const serverCard = await cardState("server");
  check(
    "T3 with both missing, the Server's tile opens the Server's card (and both tiles have portraits)",
    !!both.server?.loaded &&
      !!both.cashier?.loaded &&
      !!serverCard &&
      serverCard.needed &&
      serverCard.visible,
    { both, serverCard },
  );

  // ---- T4: the Market's Hire your team card ----
  await boot(page, saveAt(2, []));
  await page.evaluate(() => document.querySelector('[data-nav="shop"]')?.click());
  await sleep(900);
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => /^\s*\S*\s*Ingredients/.test(b.textContent) && b.textContent.length < 30)
      ?.click(),
  );
  await sleep(1200);
  const team = await page.evaluate(() => {
    const out = {};
    for (const r of ["server", "cashier"]) {
      const li = document.querySelector(`[data-team-offer="${r}"]`);
      const img = li?.querySelector("img[data-team-portrait], [data-team-portrait] img");
      out[r] = li
        ? {
            img: !!img,
            loaded: !!img && img.complete && img.naturalWidth > 0,
            src: img?.getAttribute("src") ?? null,
          }
        : null;
    }
    return out;
  });
  await shot(page, "staffhire-market");
  check(
    "T4 the Market's Hire your team card shows the Server's and the Cashier's portraits",
    !!team.server?.loaded &&
      !!team.cashier?.loaded &&
      /staff-portraits\/server\.webp/.test(team.server.src ?? "") &&
      /staff-portraits\/cashier\.webp/.test(team.cashier.src ?? ""),
    team,
  );

  // ---- T5: console ----
  const bad = logs.filter(
    (l) => !/favicon|bridge|playgama|Failed to load resource.*(404|net::)/i.test(l),
  );
  check("T5 no console errors", bad.length === 0, bad.slice(0, 5));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0 ? "\nSTAFF HIRE E2E: ALL PASS" : `\nSTAFF HIRE E2E: ${failed.length} FAIL`,
);
process.exit(failed.length === 0 ? 0 : 1);
