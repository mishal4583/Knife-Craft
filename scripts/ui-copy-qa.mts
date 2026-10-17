/**
 * UI COPY QA (developer 2026-10-16: "find all the sections with big sentences,
 * make them concise … emojis or small points … if long sentences are necessary
 * add a small 'i' information symbol and only when it is clicked let the
 * information display; make the UI proper according to a game").
 *
 *  W  No visible text in the game's screens (src/components/kc, App.tsx) runs
 *     longer than MAX_WORDS words — except inside an <InfoTip> (shown only when
 *     its ⓘ is tapped) and screen-reader text (aria-label, alt, title, an
 *     InfoTip's label). Data copy the screens show in full (knife, board,
 *     station, staff and helper descriptions, staff and tool reasons) is only
 *     shown inside an InfoTip.
 *  I  InfoTip: a 48 px ⓘ button around a 22 px coin, aria-expanded, one bubble at a time, closes on a tap outside /
 *     Escape, follows a scroll (closing once its ⓘ is off screen), portalled
 *     to <body> at the GameShell's scale.
 *
 * Copy that stays long on purpose (the story's frozen lines, the cinematic
 * intro) is listed in ALLOWED with the reason.
 *
 * Run: npx tsx scripts/ui-copy-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.join(import.meta.dirname, "..");
const MAX_WORDS = 14;

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail, null, 1));
  }
}

/** Files whose long copy is deliberate. */
const ALLOWED: Record<string, string> = {
  "src/components/kc/story/StoryOverlay.tsx": "the story's frozen narration",
  "src/components/kc/story/CinematicIntro.tsx": "the intro's narration",
  "src/components/kc/story/MilestoneBanner.tsx": "story milestone lines",
  "src/components/kc/business/AreaCleaningPrototype.tsx": "mini-game instructions (short)",
};
const SCREEN_READER_ATTRS = new Set(["aria-label", "alt", "title", "label", "aria-description"]);
const NON_TEXT_ATTRS =
  /^(className|class|d|style|key|id|href|src|type|role|data-.*|viewBox|points|transform|fill|stroke.*)$/;

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.tsx$/.test(e.name) ? [p] : [];
  });
}

const words = (t: string) =>
  t
    .replace(/\$\{[^}]*\}/g, "X")
    .split(/\s+/)
    .filter((w) => /[A-Za-z]/.test(w)).length;

/** Looks like a CSS class list / path / animation shorthand, not words for players. */
const looksTechnical = (t: string) =>
  /(^|\s)(rounded|px-|py-|mt-|font-|text-\[|bg-|border|flex|grid|absolute|M\d|kc-)/.test(t) ||
  /rgba\(|linear-gradient|translate|@keyframes|cubic-bezier/.test(t);

type Hit = { file: string; line: number; words: number; text: string };

function longCopy(file: string): Hit[] {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hits: Hit[] = [];
  const insideInfoTip = (n: ts.Node) => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent)
      if (ts.isJsxElement(p) && p.openingElement.tagName.getText(sf) === "InfoTip") return true;
    return false;
  };
  const inAttr = (n: ts.Node) => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isJsxAttribute(p)) {
        const name = p.name.getText(sf);
        return SCREEN_READER_ATTRS.has(name) || NON_TEXT_ATTRS.test(name) ? name : null;
      }
      if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) return null;
    }
    return null;
  };
  const visit = (n: ts.Node) => {
    let text: string | null = null;
    if (ts.isJsxText(n)) text = n.text;
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      if (!ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent)) text = n.text;
    } else if (ts.isTemplateExpression(n)) text = n.getText(sf).slice(1, -1);
    // Data copy written for a ⓘ bubble (forgeCopy.detail, …): checked by W2–W4 instead.
    const prop = n.parent && ts.isPropertyAssignment(n.parent) ? n.parent.name.getText(sf) : null;
    if (text !== null && prop && /^(detail|description|blurb|why|intro)$/.test(prop)) text = null;
    if (text !== null) {
      const t = text.replace(/\s+/g, " ").trim();
      const w = words(t);
      if (w > MAX_WORDS && !looksTechnical(t) && !insideInfoTip(n) && !inAttr(n)) {
        hits.push({
          file: path.relative(ROOT, file),
          line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          words: w,
          text: t.slice(0, 90),
        });
      }
      if (ts.isTemplateExpression(n)) return; // its spans are part of this text
    }
    n.forEachChild(visit);
  };
  visit(sf);
  return hits;
}

console.log(`W. No visible sentence over ${MAX_WORDS} words outside an InfoTip`);
{
  const files = [...walk(path.join(ROOT, "src/components/kc")), path.join(ROOT, "src/App.tsx")];
  const hits = files.filter((f) => !ALLOWED[path.relative(ROOT, f)]).flatMap(longCopy);
  assert(
    hits.length === 0,
    `W1: ${files.length} screen files — every longer explanation sits behind a ⓘ`,
    hits.slice(0, 12),
  );
  const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
  const shop = read("src/components/kc/Shop.tsx");
  const floor = read("src/components/kc/MarketSecondFloor.tsx");
  const staff = read("src/components/kc/business/BusinessStaff.tsx");
  const psc = read("src/components/kc/restaurant/PreServiceCheck.tsx");
  const daily = read("src/components/kc/DailyMaintenance.tsx");
  assert(
    /<InfoTip label=\{`About \$\{card\.name\}`\}>\{card\.description\}<\/InfoTip>/.test(shop) &&
      !/line-clamp-3[^>]*>\s*\{card\.description\}/.test(shop),
    "W2: Market cards (knives, boards) show the description only behind ⓘ",
  );
  assert(
    /<InfoTip label=\{`About the \$\{d\.name\}`\}>\{d\.blurb\}<\/InfoTip>/.test(floor) &&
      /<InfoTip label=\{`About the \$\{def\.name\}`\}>\{def\.blurb\}<\/InfoTip>/.test(floor) &&
      /<StatChip/.test(floor),
    "W3: Second Floor machines and team: blurbs behind ⓘ, earnings and payback as chips",
  );
  assert(
    /\{def\.description\}/.test(
      staff.split("<InfoTip label={`About the ${def.name}`}>")[1] ?? "",
    ) &&
      /<InfoTip label=\{`Why a \$\{r\.title\}`\}>\{r\.why\}<\/InfoTip>/.test(psc) &&
      /<InfoTip label=\{`Why a \$\{person\.title\}`\}>\{person\.why\}<\/InfoTip>/.test(daily),
    "W4: staff descriptions and the reasons a role or tool is needed sit behind ⓘ",
  );
}

console.log("I. The InfoTip itself");
{
  const tip = fs.readFileSync(path.join(ROOT, "src/components/kc/common/InfoTip.tsx"), "utf8");
  assert(
    /-m-\[13px\] inline-grid h-12 w-12/.test(tip) && /h-\[22px\] w-\[22px\]/.test(tip),
    "I1: the ⓘ is a 48 px button around a 22 px coin (a negative margin keeps lines tight)",
  );
  assert(
    /aria-expanded=\{open\}/.test(tip) &&
      /OPEN_EVENT/.test(tip) &&
      /"pointerdown"/.test(tip) &&
      /"Escape"/.test(tip) &&
      /"scroll", onScroll, true/.test(tip) &&
      /r\.bottom < 0 \|\| r\.top > window\.innerHeight\) close\(\)/.test(tip),
    "I2: aria-expanded; one bubble at a time; closes on a tap outside and Escape; follows a scroll, closing once its ⓘ is off screen",
  );
  assert(
    /createPortal\(/.test(tip) && /document\.body/.test(tip) && /scale\(\$\{pos\?\.scale/.test(tip),
    "I3: the bubble is portalled to <body> and drawn at the GameShell's scale (never clipped)",
  );
}

console.log(failures ? `\nUI COPY QA: ${failures} FAILURE(S)` : "\nUI COPY QA: ALL PASS");
process.exit(failures ? 1 : 0);
