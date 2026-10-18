/**
 * PLAYGAMA TELEMETRY QA — the game's own analytics events (Bridge
 * `analytics.send`, Playgama telemetry guide v1.1).
 *  A. Progression funnel: progression_started / _completed / _abandoned with
 *     { world, step_index, duration_sec, game_version }, one per level, never
 *     outside a level; the platform's level messages are unchanged.
 *  B. Event contract: stable snake_case names, flat data (string / number /
 *     boolean), no level number in a name; a Bridge without analytics (older
 *     than 2.3.0) or one that throws is a silent no-op.
 *  C. performance_sample: summarizeFrames gives every required field with
 *     the right values (percentiles, stutter counts, average FPS from active
 *     time); the window and gap constants follow the guide.
 *  D. Source scan: only PlayablesSDK touches the Bridge; no Page Visibility
 *     API; no external analytics (GA4 / gtag); one game_version source.
 *
 * Run: npx tsx scripts/playgama-telemetry-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

type Sent = [string, Record<string, unknown> | undefined];
const sent: Sent[] = [];
const messages: string[] = [];
let analyticsMode: "ok" | "missing" | "throws" = "ok";
const bridge = {
  initialize: async () => {},
  EVENT_NAME: {
    PAUSE_STATE_CHANGED: "pause_state_changed",
    AUDIO_STATE_CHANGED: "audio_state_changed",
    INTERSTITIAL_STATE_CHANGED: "interstitial_state_changed",
    REWARDED_STATE_CHANGED: "rewarded_state_changed",
  },
  platform: {
    id: "mock",
    language: "en",
    isAudioEnabled: true,
    sendMessage: (m: string) => void messages.push(m),
    on: () => {},
  },
  storage: { get: async (k: string[]) => k.map(() => null), set: async () => {} },
  advertisement: {
    isInterstitialSupported: false,
    isRewardedSupported: false,
    showInterstitial: () => {},
    showRewarded: () => {},
    on: () => {},
  },
  get analytics() {
    if (analyticsMode === "missing") return undefined;
    return {
      send: (name: string, data?: Record<string, unknown>) => {
        if (analyticsMode === "throws") throw new Error("no analytics");
        sent.push([name, data]);
      },
    };
  },
};
(globalThis as unknown as { window: { bridge: typeof bridge } }).window = { bridge };

import {
  levelAbandoned,
  levelCompleted,
  levelStarted,
  platformReady,
  sendAnalyticsEvent,
} from "../src/game/PlayablesSDK.ts";
import { BUILD_VERSION } from "../src/game/config/buildVersion.ts";
import {
  BACKGROUND_GAP_MS,
  MIN_ACTIVE_MS,
  SAMPLE_WINDOW_MS,
  TARGET_FPS,
  summarizeFrames,
} from "../src/game/telemetry/performanceSample.ts";

let failures = 0;
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${label}${ok || detail === undefined ? "" : " " + JSON.stringify(detail)}`,
  );
};
const flush = () => new Promise((r) => setTimeout(r, 10));

await platformReady();

/* ── A. progression funnel ── */
levelStarted({ world: "chapter-1", level: "3" });
await flush();
levelCompleted();
levelAbandoned(); // the exit after a finished level: nothing more
await flush();
levelStarted({ world: "chapter-1", level: "4" });
levelAbandoned();
levelAbandoned(); // twice: once only
levelCompleted(); // outside a level: nothing
await flush();
const names = sent.map(([n]) => n);
check(
  "A1 started → completed, then started → abandoned; never twice, never outside a level",
  names.join() ===
    "progression_started,progression_completed,progression_started,progression_abandoned",
  names,
);
const [, s0] = sent[0];
const [, c0] = sent[1];
const [, a0] = sent[3];
check(
  "A2 data: world, step_index (the level number), duration_sec on the end events, game_version",
  s0?.world === "chapter-1" &&
    s0?.step_index === 3 &&
    s0?.duration_sec === undefined &&
    c0?.step_index === 3 &&
    typeof c0?.duration_sec === "number" &&
    a0?.step_index === 4 &&
    typeof a0?.duration_sec === "number" &&
    sent.every(([, d]) => d?.game_version === BUILD_VERSION),
  sent,
);
check(
  "A3 the platform's level messages are unchanged (level_started / level_completed)",
  messages.join() === "level_started,level_completed,level_started",
  messages,
);
sent.length = 0;
levelStarted({ world: "business", level: "12" });
levelCompleted();
await flush();
check(
  "A4 a Business day: world business, step_index = the day",
  sent[0]?.[1]?.step_index === 12 && sent[0]?.[1]?.world === "business",
  sent,
);

/* ── B. contract ── */
sent.length = 0;
sendAnalyticsEvent("intro_completed", { skipped: true });
await flush();
check(
  "B1 intro_completed carries a boolean and game_version",
  sent.length === 1 && sent[0][1]?.skipped === true && sent[0][1]?.game_version === BUILD_VERSION,
  sent,
);
analyticsMode = "missing";
let threw = false;
try {
  sendAnalyticsEvent("intro_completed");
  await flush();
} catch {
  threw = true;
}
analyticsMode = "throws";
try {
  sendAnalyticsEvent("intro_completed");
  await flush();
} catch {
  threw = true;
}
analyticsMode = "ok";
check(
  "B2 a Bridge without analytics, or one that throws, is a silent no-op",
  !threw && sent.length === 1,
);

/* ── C. performance_sample ── */
const frames = [
  ...Array.from({ length: 90 }, () => 16),
  ...Array.from({ length: 8 }, () => 33),
  60,
  1200,
];
const active = frames.reduce((t, f) => t + f, 0);
const p = summarizeFrames(frames, 30_500, active);
const required = [
  "target_fps",
  "window_ms",
  "active_ms",
  "frame_count",
  "fps_avg",
  "fps_p10",
  "frame_time_p50_ms",
  "frame_time_p95_ms",
  "frame_time_p99_ms",
  "frame_time_max_ms",
  "frames_over_50ms",
  "frames_over_100ms",
  "frames_over_250ms",
  "frames_over_500ms",
  "frames_over_1000ms",
];
check(
  "C1 every required field is present and a number",
  required.every((k) => typeof p[k] === "number"),
  required.filter((k) => typeof p[k] !== "number"),
);
check(
  "C2 the values: frame times p50 16 / p95 33 / p99 60 / max 1200; stutters 2/1/1/1/1; fps_avg from active time",
  p.frame_count === 100 &&
    p.frame_time_p50_ms === 16 &&
    p.frame_time_p95_ms === 33 &&
    p.frame_time_p99_ms === 60 &&
    p.frame_time_max_ms === 1200 &&
    p.frames_over_50ms === 2 &&
    p.frames_over_100ms === 1 &&
    p.frames_over_250ms === 1 &&
    p.frames_over_500ms === 1 &&
    p.frames_over_1000ms === 1 &&
    p.fps_avg === Math.round((100_000 / active) * 10) / 10 &&
    p.fps_p10 === Math.round((1000 / 33) * 10) / 10 &&
    p.window_ms === 30_500 &&
    p.active_ms === active &&
    p.target_fps === 60,
  p,
);
const empty = summarizeFrames([], 30_000, 0);
check(
  "C3 an empty window gives zeros, never NaN",
  Object.values(empty).every((v) => Number.isFinite(v)),
  empty,
);
check(
  "C4 one sample per 30 s, background gaps over 2 s excluded, short windows dropped, target 60",
  SAMPLE_WINDOW_MS === 30_000 &&
    BACKGROUND_GAP_MS === 2_000 &&
    MIN_ACTIVE_MS === 5_000 &&
    TARGET_FPS === 60,
);

/* ── D. source scan ── */
const src = path.resolve("src");
const files: string[] = [];
const walk = (d: string) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p2 = path.join(d, e.name);
    if (e.isDirectory()) walk(p2);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p2);
  }
};
walk(src);
const read = (f: string) => fs.readFileSync(f, "utf8");
const bridgeUsers = files.filter((f) => /window\.bridge|\bbridge\.analytics\b/.test(read(f)));
check(
  "D1 only PlayablesSDK.ts touches window.bridge / bridge.analytics",
  bridgeUsers.length === 1 && bridgeUsers[0].endsWith(path.join("game", "PlayablesSDK.ts")),
  bridgeUsers.map((f) => path.relative(src, f)),
);
const sampler = read(path.join(src, "game/telemetry/performanceSample.ts"));
check(
  "D2 the sampler uses no Page Visibility API and sends through sendAnalyticsEvent",
  !/document\.hidden|visibilitychange|visibilityState/.test(sampler) &&
    /sendAnalyticsEvent\(\s*"performance_sample"/.test(sampler),
);
const external = files.filter((f) =>
  /gtag\(|googletagmanager|google-analytics|dataLayer\.push/.test(read(f)),
);
const html = fs.readFileSync("index.html", "utf8");
check(
  "D3 no external analytics (GA4 / gtag) in the source or index.html",
  external.length === 0 && !/gtag|googletagmanager|google-analytics/.test(html),
  external,
);
const eventNames = new Set<string>();
for (const f of files) {
  for (const m of read(f).matchAll(/sendAnalyticsEvent\(\s*"([^"]+)"/g)) eventNames.add(m[1]);
  for (const m of read(f).matchAll(/progressionEvent\(\s*"([^"]+)"/g)) eventNames.add(m[1]);
}
check(
  "D4 every event name is stable snake_case with no digits",
  [...eventNames].every((n) => /^[a-z]+(_[a-z]+)*$/.test(n)) && eventNames.size >= 5,
  [...eventNames],
);
const versions = files.filter((f) => /BUILD_VERSION\s*=/.test(read(f)));
check(
  "D5 one game_version source (config/buildVersion.ts), a semver",
  versions.length === 1 && /^\d+\.\d+\.\d+$/.test(BUILD_VERSION),
  versions.map((f) => path.relative(src, f)),
);

console.log(
  failures ? `PLAYGAMA TELEMETRY QA: ${failures} FAILURE(S)` : "PLAYGAMA TELEMETRY QA: ALL PASS",
);
process.exit(failures ? 1 : 0);
