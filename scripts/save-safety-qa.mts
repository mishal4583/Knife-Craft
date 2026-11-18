/**
 * SAVE SAFETY QA (audit 2026-11-18). A storage error must never turn a real save into a new game, and an unreadable save must never be only overwritten.
 *
 *  A. A read that fails (Bridge storage rejects) is tried three times; if it still fails the session plays on defaults IN MEMORY and nothing is
 *     written over the real save.
 *  B. A read that works and finds nothing is a new player: the first save is written as before.
 *  C. A save string that cannot be understood is copied to `knifecraft_save_backup` before the defaults take its place.
 *  D. A stored wallet that is negative, fractional or not a number is made whole cents >= 0, so the wallet invariant never refuses every later write.
 *
 * Each scenario runs in its own process (the platform layer remembers the first bridge it sees): this file starts itself with a mode.
 * Run: npx tsx scripts/save-safety-qa.mts
 */
import { spawnSync } from "node:child_process";

type Calls = { get: number; set: { keys: string[]; values: string[] }[] };
const mode = process.argv[2];

if (!mode) {
  let failures = 0;
  const run = (m: string): { ok: boolean; out: string } => {
    const r = spawnSync("npx", ["tsx", `"${process.argv[1]!}"`, m], {
      shell: true,
      encoding: "utf8",
    });
    const lines = r.stdout.split("\n").filter((l) => l.startsWith("RESULT "));
    return {
      ok: r.status === 0 && lines.length > 0 && lines.every((l) => l.includes(" ok ")),
      out: lines.join("\n"),
    };
  };
  for (const [id, text, m] of [
    [
      "A",
      "a failing read is retried three times and the real save is left untouched (no write)",
      "readfail",
    ],
    ["B", "an empty read is a new player: the first save is written", "empty"],
    ["C", "an unreadable save is backed up before the defaults replace it", "malformed"],
    [
      "D",
      "a negative / fractional / non-numeric stored wallet is made whole cents >= 0",
      "credits",
    ],
  ] as const) {
    const r = run(m);
    console.log(`  ${r.ok ? "ok " : "FAIL"} ${id}: ${text}`);
    if (!r.ok) {
      failures++;
      console.log(r.out);
    }
  }
  console.log(failures ? `\nSAVE SAFETY QA: ${failures} FAILED` : "\nSAVE SAFETY QA: ALL PASS");
  process.exit(failures ? 1 : 0);
}

// ── the child: a stub Bridge whose storage behaves as the mode says ──
const calls: Calls = { get: 0, set: [] };
const stored: Record<string, unknown> = {
  readfail: undefined,
  empty: null,
  malformed: "{ this is not json",
  credits: JSON.stringify({ version: 5, credits: -500.4 }),
}[mode] as never;
const bridge = {
  EVENT_NAME: {
    PAUSE_STATE_CHANGED: "p",
    AUDIO_STATE_CHANGED: "a",
    INTERSTITIAL_STATE_CHANGED: "i",
    REWARDED_STATE_CHANGED: "r",
  },
  initialize: () => Promise.resolve(),
  platform: { language: "en", isAudioEnabled: true, on() {}, sendMessage() {} },
  storage: {
    get: (keys: string[]) => {
      calls.get++;
      if (mode === "readfail") return Promise.reject(new Error("storage unavailable"));
      return Promise.resolve(keys.map(() => stored));
    },
    set: (keys: string[], values: string[]) => {
      calls.set.push({ keys, values });
      return Promise.resolve();
    },
  },
  advertisement: {
    isInterstitialSupported: false,
    isRewardedSupported: false,
    on() {},
    off() {},
    showInterstitial() {},
    showRewarded() {},
  },
  analytics: { send: () => Promise.resolve() },
};
(globalThis as unknown as { window: unknown }).window = {
  bridge,
  addEventListener() {},
  removeEventListener() {},
};
const quiet = console.error;
console.error = () => {};
console.warn = () => {};

const { SaveManager, DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
const out = (ok: boolean, what: string, detail?: unknown) =>
  console.log(`RESULT ${ok ? "ok " : "FAIL"} ${what}${ok ? "" : " " + JSON.stringify(detail)}`);

const save = await SaveManager.load();
if (mode === "readfail") {
  await SaveManager.save({ ...save, credits: save.credits + 100 });
  out(calls.get === 3, "three read attempts", calls.get);
  out(save.credits === DEFAULT_SAVE.credits, "plays on defaults in memory", save.credits);
  out(calls.set.length === 0, "nothing was written over the real save", calls.set.length);
} else if (mode === "empty") {
  await SaveManager.save({ ...save, credits: save.credits + 100 });
  out(calls.get === 1, "one read", calls.get);
  out(
    calls.set.some((c) => c.keys.includes("knifecraft_save")),
    "the new player's first save is written",
    calls.set,
  );
} else if (mode === "malformed") {
  out(save.credits === DEFAULT_SAVE.credits, "falls back to defaults", save.credits);
  const backup = calls.set.find((c) => c.keys.includes("knifecraft_save_backup"));
  out(
    !!backup && backup.values[0] === "{ this is not json",
    "the raw string was copied to knifecraft_save_backup",
    calls.set,
  );
  out(
    !calls.set.some((c) => c.keys.includes("knifecraft_save")),
    "the real key was not overwritten at load",
    calls.set,
  );
} else if (mode === "credits") {
  out(
    Number.isInteger(save.credits) && save.credits >= 0,
    "wallet is whole cents >= 0",
    save.credits,
  );
  let refused = false;
  try {
    await SaveManager.save(save);
  } catch {
    refused = true;
  }
  out(!refused, "the wallet invariant accepts the loaded save", save.credits);
}
console.error = quiet;
process.exit(0);
