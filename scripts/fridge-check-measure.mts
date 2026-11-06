/**
 * FRIDGE CHECK MEASUREMENT (developer 2026-11-06; plan §3.4: "measure before locking the tiers").
 * ANALYSIS ONLY: runs the real restaurant campaign simulator (the one the economy QA uses) and, at every night where closing is due
 * (the night the player would face the two chores), reads the real stock the way Fridge Check does: how many cards, how many need a
 * Bin or a Use first, and whether the game would open. It changes nothing.
 *
 *   npx tsx scripts/fridge-check-measure.mts
 */
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

const sim = await import("./restaurantCampaignSim.mts");
const { restaurantLevelOf } = await import("../src/game/restaurant/restaurantMenu.ts");
const { restaurantDayOf } = await import("../src/game/restaurant/restaurantDay.ts");
const fc = await import("../src/game/restaurant/fridgeCheck.ts");
const { restaurantSystem } = await import("../src/game/restaurant/restaurantProgression.ts");

type Row = {
  level: number;
  tier: number;
  cards: number;
  bin: number;
  useFirst: number;
  sortOpen: boolean;
  wrapOpen: boolean;
  wrapItems: number;
};

const profiles: Record<string, import("./restaurantCampaignSim.mts").SimOptions> = {
  diligent: { profile: "diligent" },
  completionist: { profile: "completionist" },
  "diligent + day stock": { profile: "diligent", dayStock: true },
};

const FROM = restaurantSystem("fridge-freshness").firstLevel;
console.log(
  `Freshness is live from Level ${FROM}; tiers start at ${fc
    .checkTiers()
    .map((t) => t.from)
    .join(" / ")}.\n`,
);

for (const [name, opts] of Object.entries(profiles)) {
  const rows: Row[] = [];
  sim.run(
    name,
    sim.freshRestaurantSave(),
    1,
    {
      ...opts,
      onLevel(_n, s) {
        const level = restaurantLevelOf(s.levelProgress);
        if (level < FROM || !restaurantDayOf(s).closingDue) return;
        const all = fc.allCards(s, level);
        rows.push({
          level,
          tier: fc.tierNumberAt(level),
          cards: all.length,
          bin: all.filter((c) => c.verdict === "bin").length,
          useFirst: all.filter((c) => c.verdict === "use-first").length,
          sortOpen: fc.isSortOpen(s, level),
          wrapOpen: fc.isWrapOpen(s, level),
          wrapItems: fc.wrapItems(s, level).length,
        });
      },
    },
    false,
  );
  console.log(`== ${name}: ${rows.length} closing nights from Level ${FROM}`);
  if (rows.length === 0) continue;
  const pct = (n: number) => `${Math.round((100 * n) / rows.length)}%`;
  const avg = (f: (r: Row) => number) =>
    (rows.reduce((a, r) => a + f(r), 0) / rows.length).toFixed(1);
  console.log(
    `   sort opens ${rows.filter((r) => r.sortOpen).length} (${pct(rows.filter((r) => r.sortOpen).length)}) · wrap opens ${rows.filter((r) => r.wrapOpen).length} (${pct(rows.filter((r) => r.wrapOpen).length)})`,
  );
  console.log(
    `   avg cards ${avg((r) => r.cards)} · avg to bin ${avg((r) => r.bin)} · avg use-first ${avg((r) => r.useFirst)} · avg wrap items ${avg((r) => r.wrapItems)}`,
  );
  for (let t = 1; t <= 5; t++) {
    const rs = rows.filter((r) => r.tier === t);
    if (rs.length === 0) continue;
    const open = rs.filter((r) => r.sortOpen).length;
    const cards = (rs.reduce((a, r) => a + r.cards, 0) / rs.length).toFixed(1);
    console.log(
      `   tier ${t}: ${rs.length} nights, sort opens ${open} (${Math.round((100 * open) / rs.length)}%), avg cards ${cards}, wrap opens ${rs.filter((r) => r.wrapOpen).length}`,
    );
  }
  console.log("");
}
