/**
 * CHEF PRIDE ANALYTICS QA (Phase 7, developer 2026-11-23: measure before building more).
 *
 *  A  every Chef Pride event in the code is listed in docs/planning/CHEF-PRIDE-MEASUREMENT-2026-11-23.md, and every event the document lists is sent by the code;
 *  B  every name is a stable snake_case name, the data is flat (strings, numbers, booleans), and no personal or free-text field is ever sent;
 *  C  every event goes through `sendAnalyticsEvent` (the one SDK function), never straight to the Bridge;
 *  D  the events are sent from the places the document says (a record on a plate or a service, a dare on offer / take / decline / win, a title, a rival pass);
 *  E  the document carries the baseline and the rule that no decision is made on a build with under 200 sessions.
 *
 * Run: npx tsx scripts/chef-pride-analytics-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(
    `  ${cond ? "ok " : "FAIL"} ${msg}${!cond && detail !== undefined ? ` ${JSON.stringify(detail).slice(0, 300)}` : ""}`,
  );
  if (!cond) failures++;
}
const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    return e.isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(e.name) ? [rel] : [];
  });
const sources = walk("src");
const DOC = read("docs/planning/CHEF-PRIDE-MEASUREMENT-2026-11-23.md");

/** Every `sendAnalyticsEvent("name", {...})` call in src: name and the object literal text. */
const calls: { name: string; data: string; file: string }[] = [];
for (const f of sources) {
  const src = read(f);
  for (const m of src.matchAll(
    /sendAnalyticsEvent\(\s*(?:\n\s*)?"([a-z0-9_]+)"\s*(?:,\s*(\{[\s\S]*?\}))?\s*\)/g,
  ))
    calls.push({ name: m[1]!, data: m[2] ?? "", file: f });
}
const PRIDE = [
  "record_broken",
  "rival_passed",
  "title_earned",
  "prestige_reached",
  "league_week_end",
  "dare_offered",
  "dare_taken",
  "dare_declined",
  "dare_completed",
];
const sentNames = new Set(calls.map((c) => c.name));

console.log("A. The code and the document list the same events");
{
  for (const n of PRIDE) assert(sentNames.has(n), `A1: ${n} is sent by the code`);
  const rows = [...DOC.matchAll(/^\|\s*`([a-z0-9_]+)`/gm)].map((m) => m[1]!);
  const documented = new Set(rows);
  for (const n of PRIDE) assert(documented.has(n), `A2: ${n} is in the measurement document`);
  const futureOnly = new Set(["moment_shared"]);
  const extra = [...documented].filter((n) => !sentNames.has(n) && !futureOnly.has(n));
  assert(
    extra.length === 0,
    "A3: the document lists nothing the code does not send (except the two marked as planned)",
    extra,
  );
  assert(
    documented.has("assistant_beat_shown") && sentNames.has("assistant_beat_shown"),
    "A4: Paige's rival message is measured through the existing assistant_beat_shown",
  );
}

console.log("B. Names and data");
{
  assert(
    calls.every((c) => /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(c.name)),
    "B1: every event name is snake_case",
  );
  const pride = calls.filter((c) => PRIDE.includes(c.name));
  const bad = pride.filter((c) =>
    /\b(name|email|text|message|player|user|restaurantName|score|credits|cents)\b\s*:/.test(c.data),
  );
  assert(bad.length === 0, "B2: no personal, free-text or money field in a Chef Pride event", bad);
  assert(
    pride.every((c) => !/[\[\]]/.test(c.data) && !/\{[^{}]*\{/.test(c.data)),
    "B3: the data is flat (no arrays, no nested objects)",
  );
  assert(
    pride.every((c) => c.name !== "record_broken" || /kind:/.test(c.data)),
    "B4: a record carries only its kind, never the number",
  );
}

console.log("C. One way out");
{
  const sdk = read("src/game/PlayablesSDK.ts");
  assert(
    /export async function sendAnalyticsEvent|export function sendAnalyticsEvent/.test(sdk),
    "C1: sendAnalyticsEvent is the SDK's one entry",
  );
  const offenders = sources.filter(
    (f) => f !== "src/game/PlayablesSDK.ts" && /bridge\.analytics|analytics\.send/.test(read(f)),
  );
  assert(
    offenders.length === 0,
    "C2: nothing outside the SDK calls the Bridge's analytics",
    offenders,
  );
}

console.log("D. Where they are sent");
{
  const where = (n: string) =>
    [...new Set(calls.filter((c) => c.name === n).map((c) => c.file))].sort();
  assert(
    where("record_broken").join() ===
      ["src/App.tsx", "src/components/kc/game/Preparation.tsx"].sort().join(),
    "D1: records are sent for a plate (Preparation) and for a service (App)",
    where("record_broken"),
  );
  assert(
    where("dare_offered").join() === "src/components/kc/Kitchen.tsx",
    "D2: an offered dare is counted where it is shown (Kitchen)",
    where("dare_offered"),
  );
  const app = read("src/App.tsx");
  assert(
    /sendAnalyticsEvent\("dare_taken"/.test(app) && /sendAnalyticsEvent\("dare_declined"/.test(app),
    "D3: take and decline are both measured",
  );
  assert(
    /sendAnalyticsEvent\("dare_completed"/.test(app) &&
      /sendAnalyticsEvent\("title_earned"/.test(app) &&
      /sendAnalyticsEvent\("rival_passed"/.test(app),
    "D4: a dare won, a title earned and a rival passed are measured in App",
  );
  const kit = read("src/components/kc/Kitchen.tsx");
  assert(
    /OFFERED_DARES_SENT\.has\(offeredKey\)/.test(kit),
    "D5: an offered dare is counted once per day and app run, not on every render",
  );
}

console.log("E. The document's rules");
{
  assert(
    /1\.4\.1/.test(DOC) && /Sessions \/ identified users/.test(DOC),
    "E1: the baseline (build, sessions, users) is in the document",
  );
  assert(/200 sessions/.test(DOC), "E2: no decision on a build with fewer than 200 sessions");
  assert(
    /None of Chef Pride is live/.test(DOC),
    "E3: it says plainly that nothing is measurable until a Chef Pride build is live",
  );
}

console.log(
  failures === 0
    ? "\nCHEF PRIDE ANALYTICS QA: ALL PASS"
    : `\nCHEF PRIDE ANALYTICS QA: ${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
