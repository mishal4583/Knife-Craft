/**
 * ASSISTANT QA (developer 2026-11-07: "integrate the assistant properly, without making any mistakes"; restaurant/assistant.ts,
 * components/kc/assistant, docs/planning/ASSISTANT-PAIGE-PLAN-2026-11-06.md):
 *   A  her introduction: a new game meets "meet", a player past the first service meets "meet-late"; until she is hired nothing else shows
 *   B  the hire is FREE: no credits, ledger, inventory or staff change; hiring twice is the same save; her state survives junk
 *   C  the beats: tied to real rules (first cash, a missing food, a system's unlock, the mini-games, milestones, the finale), windowed so an
 *      old save is not flooded, each shown once, one at a time, highest priority first
 *   D  Tips: Off stops every beat but keeps the notebook; a given tip is in the notebook
 *   E  copy rules: at most 90 characters a line, one or two lines, at most one emoji, English, known poses, known screens, real targets
 *   F  pure and free of money: no wallet, ledger, random or clock in the rule file
 *   G  the wiring: calm moments only, never over the guide card or Grandma's pointer, one per visit, her introduction before Grandma's pointer
 *   H  the art: every pose, avatar, bubble and UI piece the code draws exists; the weight stays small
 *
 * Run: npx tsx scripts/assistant-qa.mts
 */
import fs from "node:fs";
import path from "node:path";

const store: Record<string, string> = {};
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => void (store[k] = v),
  removeItem: (k: string) => void delete store[k],
  clear: () => void Object.keys(store).forEach((k) => delete store[k]),
  key: () => null,
  length: 0,
} as Storage;

const { DEFAULT_SAVE } = await import("../src/game/SaveManager.ts");
type SaveData = import("../src/game/SaveManager.ts").SaveData;
const A = await import("../src/game/restaurant/assistant.ts");
const { LAST_CAMPAIGN_LEVEL, restaurantSystem } =
  await import("../src/game/restaurant/restaurantProgression.ts");
const { SECTION_POINTER } = await import("../src/game/restaurant/firstLevels.ts");

let failed = 0;
function check(id: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${id}`,
    ok || detail === undefined ? "" : JSON.stringify(detail),
  );
}
const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const at = (n: number): SaveData => ({
  ...structuredClone(DEFAULT_SAVE),
  story: { ...DEFAULT_SAVE.story, introDone: true },
  levelProgress: {
    ...structuredClone(DEFAULT_SAVE.levelProgress),
    currentLevelId: `level-${n}`,
    highestUnlockedLevelId: `level-${n}`,
    completedLevelIds: Array.from({ length: n - 1 }, (_, i) => `level-${i + 1}`),
  },
});
const hired = (s: SaveData) => A.hireAssistant(s);

// ── A. Her introduction ────────────────────────────────────────────────
{
  const fresh = at(1);
  check(
    "A1 a new game meets 'meet' (hire), and only that, until she is hired",
    A.assistantBeatFor(fresh)?.id === "meet" &&
      A.assistantBeatFor(fresh)?.hire === true &&
      !A.assistantHired(fresh),
    A.assistantBeatFor(fresh)?.id,
  );
  const late = at(9);
  check(
    "A2 a player already past the first service meets 'meet-late' (a catch-up introduction), and only that",
    A.assistantBeatFor(late)?.id === "meet-late" && A.introBeatFor(late)?.id === "meet-late",
  );
  check(
    "A3 once hired, the introduction never shows again",
    A.introBeatFor(hired(fresh)) === null && A.assistantBeatFor(hired(fresh)) === null,
    A.assistantBeatFor(hired(fresh))?.id,
  );
  check(
    "A4 her name is Paige and her introduction says it",
    A.ASSISTANT_NAME === "Paige" && /Paige/.test(A.beatById("meet")!.lines[0]!.text),
  );
}

// ── B. The hire is free ────────────────────────────────────────────────
{
  const s0 = at(5);
  const s1 = A.hireAssistant(s0);
  check(
    "B1 hiring moves no money, no ledger entry, no stock and no staff",
    s1.credits === s0.credits &&
      JSON.stringify(s1.economyLedger) === JSON.stringify(s0.economyLedger) &&
      JSON.stringify(s1.business.inventory) === JSON.stringify(s0.business.inventory) &&
      JSON.stringify(s1.business.staff) === JSON.stringify(s0.business.staff) &&
      A.assistantHired(s1),
  );
  check("B2 hiring twice is the same save back", A.hireAssistant(s1) === s1);
  const junk = {
    ...s0,
    business: {
      ...s0.business,
      assistant: { hired: "yes", seen: [1, "a", "a", null, "b"], tipsOff: 3 },
    },
  } as unknown as SaveData;
  const j = A.assistantOf(junk);
  check(
    "B3 a bad saved state is cleaned: not hired, only unique text ids kept, tips on",
    j.hired === false && j.seen.join() === "a,b" && j.tipsOff === undefined,
    j,
  );
  check(
    "B4 an old save with no field is 'not hired, nothing seen'",
    JSON.stringify(A.assistantOf(at(3))) === JSON.stringify({ hired: false, seen: [] }),
  );
}

// ── C. The beats ───────────────────────────────────────────────────────
{
  const l1 = hired(at(1));
  check(
    "C1 first run (nothing finished yet): no tip (the first-run hand and Grandma do that)",
    A.assistantBeatFor(l1) === null,
  );
  const l2 = hired(at(2));
  check(
    "C2 after the first service: the first-cash tip, pointing at the Market tab",
    A.assistantBeatFor(l2)?.id === "first-pay" &&
      A.assistantBeatFor(l2)?.target === '[data-nav="shop"]',
    A.assistantBeatFor(l2)?.id,
  );
  const seenFirst = A.markAssistantSeen(l2, "first-pay");
  check(
    "C3 a tip given is not given again, and marking twice is the same save",
    A.assistantBeatFor(seenFirst)?.id !== "first-pay" &&
      A.markAssistantSeen(seenFirst, "first-pay") === seenFirst,
    A.assistantBeatFor(seenFirst)?.id,
  );
  // A system's tip is given from its unlock level, for BEAT_WINDOW_LEVELS levels, then never (an old save is not flooded).
  const menuFrom = restaurantSystem("menu").firstLevel;
  const inWindow = (n: number, id: string) => {
    const s = A.markAssistantSeen(A.markAssistantSeen(hired(at(n)), "first-pay"), "restock");
    return A.ASSISTANT_BEATS.find((b) => b.id === id)!.when(s, n);
  };
  check(
    "C4 a system tip shows from its unlock level for 3 levels and not before or after",
    !inWindow(menuFrom - 1, "system:menu") &&
      inWindow(menuFrom, "system:menu") &&
      inWindow(menuFrom + A.BEAT_WINDOW_LEVELS - 1, "system:menu") &&
      !inWindow(menuFrom + A.BEAT_WINDOW_LEVELS, "system:menu"),
  );
  const old = hired(at(60));
  const oldBeat = A.assistantBeatFor(old);
  check(
    "C5 a player at Level 60 who just met her gets only what is current, never the early game again",
    !oldBeat ||
      !/^(first-pay|fridge-sort|cleaning|stockroom-sort|system:(menu|fridge-freshness|dine-in|staff|cuisines|takeaway))$/.test(
        oldBeat.id,
      ),
    oldBeat?.id,
  );
  const ids = A.ASSISTANT_BEATS.map((b) => b.id);
  check("C6 every beat id is unique", new Set(ids).size === ids.length);
  // Highest priority first: at the Fridge Sort and Cleaning unlock (Level 3) both apply and the higher one comes first.
  const l3 = A.markAssistantSeen(hired(at(3)), "first-pay");
  const applicable = A.ASSISTANT_BEATS.filter(
    (b) => !b.hire && b.when(l3, 3) && !A.assistantOf(l3).seen.includes(b.id),
  );
  const top = A.assistantBeatFor(l3);
  check(
    "C7 when several apply the highest priority is offered",
    !!top && applicable.every((b) => b.priority <= top.priority),
    { top: top?.id, applicable: applicable.map((b) => `${b.id}:${b.priority}`) },
  );
  const fin = hired(at(LAST_CAMPAIGN_LEVEL));
  check(
    "C8 the finale is for the last levels only",
    A.assistantBeatFor(fin)?.id === "finale" && !A.beatById("finale")!.when(at(40), 40),
    A.assistantBeatFor(fin)?.id,
  );
  const ms = A.ASSISTANT_BEATS.filter((b) => b.id.startsWith("milestone:"));
  check(
    "C9 a cheer every ten services ('Service N'), none on the last ones",
    ms.length >= 8 && // one every ten services below the last: 8 in the 91-level campaign (12+ in the 148-level one)
      ms.every(
        (b) =>
          Number(b.id.split(":")[1]) % 10 === 0 &&
          Number(b.id.split(":")[1]) < LAST_CAMPAIGN_LEVEL - 1,
      ),
    ms.length,
  );
}

// ── D. Tips: Off and the notebook ──────────────────────────────────────
{
  const l2 = hired(at(2));
  const off = A.setAssistantTips(l2, false);
  check(
    "D1 Tips Off: no beat at all, her hire stays, and switching back on brings the beats back",
    A.assistantBeatFor(off) === null &&
      A.assistantHired(off) &&
      A.assistantOf(off).tipsOff === true &&
      A.assistantBeatFor(A.setAssistantTips(off, true))?.id === "first-pay" &&
      A.setAssistantTips(l2, true) === l2,
  );
  const given = A.markAssistantSeen(A.markAssistantSeen(l2, "first-pay"), "restock");
  const book = A.notebookEntries(given);
  check(
    "D2 the notebook lists the tips she gave (not her introduction), each with its first line",
    book.map((e) => e.id).join() === "first-pay,restock" && book.every((e) => e.text.length > 0),
    book.map((e) => e.id),
  );
  check(
    "D3 Tips Off keeps the notebook",
    A.notebookEntries(A.setAssistantTips(given, false)).length === 2,
  );
  check(
    "D4 the notebook holds at most SEEN_KEPT tips",
    (() => {
      let s = l2;
      for (let i = 0; i < A.SEEN_KEPT + 30; i++) s = A.markAssistantSeen(s, `x${i}`);
      return A.assistantOf(s).seen.length === A.SEEN_KEPT;
    })(),
  );
}

// ── E. Copy rules ──────────────────────────────────────────────────────
{
  const screens = read("src/components/kc/data.ts");
  const nav = read("src/components/kc/Kitchen.tsx");
  const emoji = /\p{Extended_Pictographic}/gu;
  const bad: string[] = [];
  for (const b of A.ASSISTANT_BEATS) {
    if (b.lines.length < 1 || b.lines.length > 2) bad.push(`${b.id}: ${b.lines.length} lines`);
    for (const l of b.lines) {
      if (l.text.length > A.MAX_LINE_CHARS) bad.push(`${b.id}: ${l.text.length} chars`);
      if ((l.text.match(emoji) ?? []).length > 1) bad.push(`${b.id}: emoji`);
      if (!/^[\x20-\x7e’]+$/.test(l.text)) bad.push(`${b.id}: not plain English`);
      if (!A.PAIGE_POSES.includes(l.pose)) bad.push(`${b.id}: pose ${l.pose}`);
    }
    if (b.go && !new RegExp(`"${b.go}"`).test(screens)) bad.push(`${b.id}: unknown screen ${b.go}`);
    if (b.target) {
      const m = /^\[data-nav="([a-z-]+)"\]$/.exec(b.target);
      if (!m || !new RegExp(`id: "${m[1]}"`).test(nav)) bad.push(`${b.id}: target ${b.target}`);
    }
  }
  check(
    "E1 every line fits the copy rules, every pose, screen and ring target is real",
    bad.length === 0,
    bad,
  );
  const all = A.ASSISTANT_BEATS.flatMap((b) => b.lines.map((l) => l.text)).join(" ");
  check(
    "E2 nothing she says promises money or says an ad is needed",
    !/\$\d|free money|you must|need to watch|required/i.test(all) && /optional/i.test(all),
  );
  check(
    "E3 the Market's pointer no longer tells a new player to hire first (the hires are in the service)",
    !/hire/i.test(SECTION_POINTER.shop.line),
    SECTION_POINTER.shop.line,
  );
}

// ── F. Pure and free of money ──────────────────────────────────────────
{
  // The code only: the file's own comments say "no Math.random", which is not a use of it.
  const src = read("src/game/restaurant/assistant.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  check(
    "F1 the rule file imports no wallet, ledger or clock and uses no random",
    !/economy\/wallet|EconomyLedger|debitWallet|creditWallet|appendLedgerEntry/.test(src) &&
      !/Math\.random|Date\.now|new Date/.test(src),
  );
  check(
    "F2 the save field is nested in `business` (no new top-level field)",
    /assistant\?: AssistantState/.test(read("src/game/business/businessTypes.ts")) &&
      !/assistant\??:/.test(read("src/game/SaveManager.ts")),
  );
}

// ── G. The wiring ──────────────────────────────────────────────────────
{
  const app = read("src/App.tsx");
  check(
    "G1 she shows only at a calm moment on the two home screens, never over the guide card or Grandma's pointer or her notebook",
    /const paigeCalm =[\s\S]{0,260}homeCalm &&[\s\S]{0,40}!guideStep &&[\s\S]{0,40}!pointedTab &&[\s\S]{0,40}!paigeNotebook &&[\s\S]{0,120}screen === "kitchen" \|\| screen === "restaurant-map"/.test(
      app,
    ),
  );
  check(
    "G2 her introduction comes BEFORE Grandma's pointer: the pointer waits while she is not hired (and calm does not wait for a pointer that is waiting)",
    /const meetPending =[\s\S]{0,120}!assistantHired\(save\)/.test(app) &&
      (app.match(/!meetPending/g) ?? []).length >= 2,
  );
  check(
    "G3 one beat per screen visit: the host is told the screen as its visit",
    /<AssistantHost[\s\S]{0,200}visit=\{screen\}/.test(app) &&
      /shownIn\.current === visit/.test(read("src/components/kc/assistant/AssistantHost.tsx")),
  );
  check(
    "G4 hiring, the seen mark, Tips and the screens she opens all go through the app's one save path",
    /persist\(hireAssistant\(cur\)\)/.test(app) &&
      /persist\(next\)/.test(app) &&
      /markAssistantSeen\(cur, id\)/.test(app) &&
      /setAssistantTips\(cur, on\)/.test(app),
  );
  check(
    "G5 'Ask Paige' is in the Kitchen and the Market, her card on the Staff screen, the guide card and Grandma's pointer speak in her voice once she is hired",
    /AskPaigeButton/.test(read("src/components/kc/Kitchen.tsx")) &&
      /AskPaigeButton/.test(read("src/components/kc/Shop.tsx")) &&
      /<AssistantCard \/>/.test(read("src/components/kc/business/BusinessStaff.tsx")) &&
      /paige \?/.test(read("src/components/kc/restaurant/GuideCard.tsx")) &&
      /paige\?\.hired/.test(read("src/components/kc/Kitchen.tsx")),
  );
  const host = read("src/components/kc/assistant/AssistantHost.tsx");
  check(
    "G6 (popup, developer 2026-11-08) the popup dims and blurs the screen with a scrim that closes the tip, the ring follows the real button and leaves it bright, the beat on screen is latched, and Reduced Motion turns the animation off",
    /data-testid="assistant-scrim"/.test(host) &&
      /backdrop-blur/.test(host) &&
      /shadow-\[0_0_0_200vmax_rgba/.test(host) &&
      /querySelector\(target\)/.test(host) &&
      /setActive\(\{ beat: candidate, replay: false \}\)/.test(host) &&
      /\.kc-reduced-motion \.paige-in/.test(read("src/components/kc/assistant/assistant.css")),
  );
}

// ── H. The art ─────────────────────────────────────────────────────────
{
  const dir = path.join(ROOT, "public/business/assistant");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const have = (n: string) => files.includes(`${n}.webp`);
  const poses = A.PAIGE_POSES.filter((p) => !have(`pose-${p}`));
  check("H1 all 12 poses exist", poses.length === 0, poses);
  const used = new Set<string>();
  for (const f of [
    "AssistantHost.tsx",
    "PaigeNotebook.tsx",
    "AskPaigeButton.tsx",
    "PaigeArt.tsx",
    "AssistantCard.tsx",
  ]) {
    for (const m of read(`src/components/kc/assistant/${f}`).matchAll(/name="([a-z-]+)"/g))
      used.add(m[1]!);
  }
  for (const m of read("src/components/kc/assistant/AssistantHost.tsx").matchAll(/"(ui-[a-z-]+)"/g))
    used.add(m[1]!);
  for (const t of ["normal", "success", "warning"]) used.add(`bubble-${t}`);
  for (const f of ["kind", "laugh", "worried", "wink"])
    if (have(`avatar-${f}`)) used.add(`avatar-${f}`);
  const missing = [...used].filter((n) => !have(n));
  check(
    "H2 every picture the code draws exists (ring, arrow, bubble frames, ribbon, chevrons, notebook pieces)",
    missing.length === 0,
    missing,
  );
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
  check(
    `H3 the whole set stays small (${Math.round(bytes / 1024)} KB, at most 600 KB)`,
    bytes > 0 && bytes <= 600_000,
  );
  const portrait = path.join(ROOT, "public/business/staff-portraits/assistant.webp");
  check(
    "H4 her staff-card portrait exists",
    fs.existsSync(portrait) && fs.statSync(portrait).size < 40_000,
  );
  check(
    "H5 (popup, developer 2026-11-08) the popup is the shared ivory card with Paige's round portrait, no speech-bubble stand-in",
    /rounded-\[22px\] border-2 bg-ivory/.test(
      read("src/components/kc/assistant/AssistantHost.tsx"),
    ) && !/borderImageSource/.test(read("src/components/kc/assistant/AssistantHost.tsx")),
  );
}

console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
process.exit(failed ? 1 : 0);
