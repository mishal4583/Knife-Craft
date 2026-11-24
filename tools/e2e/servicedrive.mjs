// Drives a REAL campaign service to its Level Complete card, like a player (Chef Pride audit remediation, Batch 2 follow-up): opens the service, answers the hires,
// starts cooking, plays every cutting step with the solver, continues past the Knife Report, serves, goes to the next customer and finishes the level.
// The Level Complete card closes itself within seconds (and when the screen changes), so `watchBanner` installs a page-side observer that records the card's text, its
// tiles and its box THE MOMENT it appears; `bannerSeen` reads it back.
import { sleep } from "./harness.mjs";
import { playToReport } from "./solver.mjs";

/** Call BEFORE boot(): records every Level Complete card that appears, with a screenshot-ready flag. */
export async function watchBanner(page) {
  await page.evaluateOnNewDocument(() => {
    window.__banners = [];
    const seen = new WeakSet();
    const look = () => {
      const stats = document.querySelector('[data-testid="banner-stats"]');
      if (!stats || seen.has(stats)) return;
      seen.add(stats);
      const card = stats.parentElement;
      const r = card.getBoundingClientRect();
      window.__banners.push({
        at: Date.now(),
        tiles: [...stats.children].map((d) => d.innerText.replace(/\s+/g, " ").trim()),
        tier: document.querySelector('[data-testid="banner-tier"]')?.innerText.trim() ?? null,
        notes: [...document.querySelectorAll('[data-testid="banner-notes"] li')].map((l) =>
          l.innerText.trim(),
        ),
        rows: [...document.querySelectorAll('[data-testid="banner-rows"] > div')].map((d) =>
          d.innerText.replace(/\s+/g, " ").trim(),
        ),
        box: [
          Math.round(r.top),
          Math.round(r.bottom),
          innerHeight,
          Math.round(r.left),
          Math.round(r.right),
          innerWidth,
        ],
        cutTile: [...stats.querySelectorAll("p")].some((p) => p.scrollWidth > p.clientWidth + 1),
        overflowX: document.documentElement.scrollWidth - innerWidth,
      });
    };
    // (the observer is attached to `document`: at document start `documentElement` does not exist yet)
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
  });
}

/** Call BEFORE boot(): records every analytics event the game sends through the Bridge into window.__events (name + data). */
export async function watchAnalytics(page) {
  await page.evaluateOnNewDocument(() => {
    window.__events = [];
    // `bridge.analytics` logs an error when read before the Bridge is initialized, so it is wrapped only AFTER initialize() has resolved.
    const wrap = (b) => {
      try {
        const a = b.analytics;
        if (!a || typeof a.send !== "function" || a.__wrapped) return;
        // The Bridge's `analytics` is a prototype getter and its `send` is a logging wrapper of its own, so neither can be replaced in place: the Bridge object gets its own
        // `analytics` property instead, a proxy that records each `send` and passes it on unchanged.
        const proxy = new Proxy(a, {
          get(target, key) {
            if (key === "__wrapped") return true;
            if (key === "send")
              return (name, data) => {
                window.__events.push({ name, data });
                return target.send(name, data);
              };
            const v = target[key];
            return typeof v === "function" ? v.bind(target) : v;
          },
        });
        Object.defineProperty(b, "analytics", { configurable: true, get: () => proxy });
      } catch {
        // no analytics: nothing to record
      }
    };
    let real;
    Object.defineProperty(window, "bridge", {
      configurable: true,
      get: () => real,
      set: (v) => {
        real = v;
        if (v && typeof v.initialize === "function") {
          const init = v.initialize.bind(v);
          v.initialize = (...a) =>
            Promise.resolve(init(...a)).then((r) => {
              wrap(v);
              return r;
            });
        }
      },
    });
  });
}

export const eventsSeen = (page) => page.evaluate(() => window.__events ?? []);

export const bannerSeen = (page) => page.evaluate(() => window.__banners ?? []);

const visibleButtons = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => !b.disabled && b.getBoundingClientRect().width > 0)
      .map((b) => b.textContent.trim().replace(/\s+/g, " "))
      .filter(Boolean),
  );

const clickFirst = async (page, patterns) => {
  const hit = await page.evaluate(
    (srcs) => {
      const bs = [...document.querySelectorAll("button")].filter(
        (b) => !b.disabled && b.getBoundingClientRect().width > 0,
      );
      for (const src of srcs) {
        const re = new RegExp(src, "i");
        const b = bs.find((x) => re.test(x.textContent.trim().replace(/\s+/g, " ")));
        if (b) {
          const q = b.getBoundingClientRect();
          return {
            x: q.x + q.width / 2,
            y: q.y + q.height / 2,
            label: b.textContent.trim().replace(/\s+/g, " "),
          };
        }
      }
      return null;
    },
    patterns.map((p) => p.source),
  );
  // The Kitchen's own "Open for service" stays in the page UNDER an open sheet: a mouse click at its position would land on the sheet (and close it), so it is clicked in the DOM.
  if (hit && /^Open for service$/i.test(hit.label)) {
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find(
          (b) =>
            !b.disabled && /^Open for service$/i.test(b.textContent.trim().replace(/\s+/g, " ")),
        )
        ?.click(),
    );
  } else if (hit) await page.mouse.click(hit.x, hit.y);
  return hit?.label ?? null;
};

/**
 * Plays until a Level Complete card has been recorded (or `maxMs`). `cutting: false` leaves the cutting to the hired Prep Cook (Auto): the loop then only taps through.
 * Returns { ok, steps } where steps is the list of what it did (for debugging a stuck run).
 */
export async function driveService(
  page,
  {
    maxMs = 420000,
    wantBanners = 1,
    log = () => {},
    onStep = async () => {},
    stopAfter = null,
    auto = false,
    closeDay = false,
    cook = false,
    // Stops (returning `heldAtServe: true`) the moment the "Serve to ..." card is up, BEFORE the tap that serves, so a test can interrupt or repeat the serve itself (autoservice.mjs).
    holdAtServe = false,
    // Presses the served card's "Menu guest n/m" / "Walk-in n/m" button (the optional guest after the level's own orders) instead of going straight to Next Customer.
    guests = false,
  } = {},
) {
  const t0 = Date.now();
  const steps = [];
  let idle = 0;
  while (Date.now() - t0 < maxMs) {
    if (!closeDay && (await bannerSeen(page)).length >= wantBanners) return { ok: true, steps };
    // A celebration card (a climb in the city ranking, a prestige tier…) covers the screen until it is closed: a tap on it closes it.
    if (await page.evaluate(() => !!document.querySelector('[data-testid="celebration"]'))) {
      await page.evaluate(() => {
        const c = document.querySelector('[data-testid="celebration"]');
        (c?.querySelector(".paige-btn") ?? c)?.click();
      });
      steps.push("celebration");
      await sleep(900);
      continue;
    }
    if (
      holdAtServe &&
      (await page.evaluate(() =>
        [...document.querySelectorAll("button")].some(
          (b) =>
            b.getBoundingClientRect().width > 0 &&
            (/^Serve to/.test(b.textContent.trim()) ||
              /^Serve to/.test(b.textContent.trim().replace(/^\S+\s/, ""))),
        ),
      ))
    )
      return { ok: true, steps, heldAtServe: true };
    const text = await page.evaluate(() => document.body.innerText);
    if (/KNIFE REPORT/.test(text)) {
      const label = await clickFirst(page, [/^Continue$/]);
      steps.push(label ?? "report?");
      await sleep(900);
      continue;
    }
    // The Prep Cook cuts it (his button, not Auto): the player only taps through the rest, serving by hand.
    if (cook) {
      let tapped = await clickFirst(page, [/Prep Cook cuts it/]);
      // the button comes with the customer sitting down: while the order is arriving, wait for it rather than cutting by hand
      for (
        let w = 0;
        !tapped &&
        w < 14 &&
        /(arriv|is coming|walking|waiting)/i.test("") === false &&
        (await page.evaluate(
          () =>
            !!document.querySelector('[data-testid="service-floor"]') ||
            /Start cooking/.test(document.body.innerText),
        ));
        w++
      ) {
        await sleep(600);
        tapped = await clickFirst(page, [/Prep Cook cuts it/]);
      }
      if (tapped) {
        steps.push("prep-cook");
        log("prep-cook");
        await sleep(2600);
        continue;
      }
    }
    // Cutting: the canvas and a step line are up and no after-plate button is (the finished plate's screen keeps the canvas and its step line).
    const prep = await page.evaluate(
      () =>
        !!document.querySelector("[data-game-viewport] canvas") &&
        /STEP \d+ OF \d+|peeled|\d+\/\d+/.test(document.body.innerText) &&
        ![...document.querySelectorAll("button")].some(
          (b) =>
            /^(Serve to|Prepare Again|Back to Kitchen|Continue)/.test(
              b.textContent.trim().replace(/^\S+\s/, ""),
            ) || /^(Serve to|Prepare Again|Back to Kitchen|Continue)/.test(b.textContent.trim()),
        ),
    );
    // Auto (the hired Prep Cook): the player does NOT cut and does not tap the floor (that would skip the arrival the Prep Cook waits for); the game cuts, serves and moves on.
    if (prep && !auto) {
      steps.push("cut");
      log("cut");
      const r = await playToReport(page, { maxMs: 100000 });
      if (!r.ok) steps.push("cut-failed");
      await sleep(500);
      continue;
    }
    // The Fridge Check game (the night's "Throw out spoiled food" / "Wrap and label" chores): skipped from its pause card (one tap: no stars, nothing else changes).
    if (
      closeDay &&
      (await page.evaluate(() => !!document.querySelector('[data-testid="fridge-check"]')))
    ) {
      await page.evaluate(() => {
        const q = (id) => document.querySelector(`[data-testid="${id}"]`);
        if (q("fc-guide-skip")) q("fc-guide-skip").click();
      });
      await sleep(500);
      await page.evaluate(() => document.querySelector('[data-testid="fc-pause"]')?.click());
      await sleep(500);
      await page.evaluate(() => document.querySelector('[data-testid="fc-skip"]')?.click());
      steps.push("fridge-check-skipped");
      log("fridge-check-skipped");
      await sleep(900);
      continue;
    }
    // Closing Time (the day's last service is done): collect the tables' cash, hire the Cleaner for the night (he does the chores), close.
    if (
      closeDay &&
      (await page.evaluate(() => /CLOSING TIME|Time to close up/i.test(document.body.innerText)))
    ) {
      // (DOM clicks here: the sheet scrolls and its buttons sit under a sticky footer)
      const c = await page.evaluate(
        (srcs) => {
          for (const src of srcs) {
            const re = new RegExp(src, "i");
            const b = [...document.querySelectorAll("button")].find(
              (x) =>
                !x.disabled &&
                x.getBoundingClientRect().width > 0 &&
                re.test(x.textContent.trim().replace(/\s+/g, " ")),
            );
            if (b) {
              b.click();
              return b.textContent.trim().replace(/\s+/g, " ");
            }
          }
          return null;
        },
        [
          String.raw`Collect \$[\d,.]+ from the tables`,
          "Tonight",
          "^Do it$",
          "Close for the night",
        ],
      );
      if (c) {
        steps.push(c);
        log(c);
        await sleep(1200);
        if (/Close for the night/i.test(c)) return { ok: true, steps, closed: true };
        continue;
      }
    }
    const label = await clickFirst(
      page,
      auto
        ? [
            /^Later$/,
            /(Buy the fridge to start)/,
            /(Hire Server|Hire Cashier|Hire .*&|Open restaurant)/,
            // (no Back to Kitchen: it is on the cutting screen all the time; the Prep Cook's Auto serves and moves on by itself)
            /^Open for service$/,
          ]
        : [
            /^Later$/,
            /(Hire Server|Hire Cashier|Hire .*&|Open restaurant)/,
            /(Buy the fridge to start)/,
            /(Restock to start)/,
            /(Start cooking|Start service|Let him in)/,
            /^Continue$/,
            /^Serve to /,
            ...(guests ? [/(Menu guest|Walk-in) \d+\/\d+:/] : []),
            /^(Next customer|Next Customer)/,
            /^(Back to Kitchen|Finish level|Finish Level|Done)/,
            // last: the Kitchen's own button stays in the page UNDER the Pre-Service Check, so anything on the sheet must be tried first
            /^Open for service$/,
          ],
    );
    if (label) {
      steps.push(label);
      log(label);
      idle = 0;
      await sleep(400);
      await onStep(label);
      if (stopAfter && stopAfter.test(label)) return { ok: true, steps, stoppedAfter: label };
      await sleep(700);
    } else {
      idle++;
      if (idle % 8 === 0) log(`idle: ${(await visibleButtons(page)).slice(0, 8).join(" | ")}`);
      if (idle > 60) return { ok: false, steps, stuck: await visibleButtons(page) };
      await sleep(900);
    }
  }
  return { ok: false, steps, timeout: true, stuck: await visibleButtons(page) };
}

/**
 * A restaurant save about to serve campaign level `level`, for the real-service tests: server and cashier on the team, a big fridge, `ingredients` stocked fresh (bought the
 * business day the calendar says, so nothing in it is expired), today's sauce and car park already done (the delivery routine would otherwise stop the solver), the guide quiet.
 * `business` / `top` merge over the defaults (e.g. expired stock, a Prep Cook, chefRecord). Version 3, like the other restaurant seeds.
 */
export function serviceSave({
  level,
  ingredients,
  quantity = 24,
  business = {},
  top = {},
  seedSave,
  MOVED_IN_BUSINESS,
}) {
  const DAY = 7;
  const inventory = Object.fromEntries(
    ingredients.map((id) => [id, { ingredientId: id, quantity, unitCost: 100, purchaseDay: DAY }]),
  );
  const s = seedSave({
    business: {
      ...MOVED_IN_BUSINESS,
      assistant: { hired: true, seen: [], tipsOff: true },
      sectionsSeen: ["shop", "inventory", "rack", "business"],
      staff: { hiredRoles: ["server", "cashier"] },
      calendar: { businessDay: DAY },
      sauceStation: { doneDay: DAY },
      carPark: { doneDay: DAY },
      refrigerator: { refrigeratorId: "professional-refrigerator" },
      inventory,
      // EVERY service supply (the Pre-Service Check wants tableware, napkins, jugs, side plates… before it lets a service start), 400 of each, plus full dish soap and cleaning liquid bottles
      supplies: {
        ...MOVED_IN_BUSINESS.supplies,
        stock: {
          ...MOVED_IN_BUSINESS.supplies.stock,
          ...Object.fromEntries(
            [
              "stock-pot",
              "saucepans",
              "frying-pans",
              "saute-pans",
              "tongs",
              "spatulas",
              "ladles",
              "whisks",
              "peelers",
              "graters",
              "skimmers",
              "sheet-pans",
              "mixing-bowls",
              "storage-containers",
              "measuring-cups",
              "kitchen-scales",
              "thermometers",
              "oven-mitts",
              "dinner-forks",
              "dessert-forks",
              "dinner-knives",
              "steak-knives",
              "teaspoons",
              "soup-spoons",
              "dinner-plates",
              "side-plates",
              "soup-bowls",
              "dessert-plates",
              "water-glasses",
              "highball-glasses",
              "coffee-tea-set",
              "water-jugs",
              "salt-pepper",
              "napkin-holders",
              "menu-stands",
              "microwave-containers",
              "foil-containers",
              "thali-containers",
              "kraft-boxes",
              "burger-boxes",
              "food-wrap",
              "deli-sheets",
              "paper-bags",
              "carry-bags",
              "tissues",
              "paper-napkins",
              "wet-wipes",
              "cutlery-packs",
              "toothpicks",
              "tamper-labels",
              "dish-soap",
              "cleaning-liquid",
              "floor-cleaner",
              "disinfectant",
              "hand-soap",
              "toilet-paper",
              "paper-towels",
              "sponges-cloths",
              "bin-liners",
              "mop-bucket",
              "brooms",
              "toilet-brushes",
            ].map((id) => [id, { units: 400, costBasis: 4000 }]),
          ),
        },
      },
      restaurantSupplies: { soapPct: 100, cleanerPct: 100 },
      restaurantStaff: {
        specialists: ["indian-chef", "mediterranean-chef", "mexican-chef", "asian-chef"],
      },
      ...business,
    },
    credits: 5_000_000,
    levelProgress: {
      currentLevelId: `level-${level}`,
      highestUnlockedLevelId: `level-${level}`,
      completedLevelIds: Array.from({ length: level - 1 }, (_, i) => `level-${i + 1}`),
      campaignVersion: 4,
    },
    story: { introDone: true, milestoneMask: 0xffff, finaleSeen: true },
    ...top,
  });
  s.version = 3;
  return s;
}
