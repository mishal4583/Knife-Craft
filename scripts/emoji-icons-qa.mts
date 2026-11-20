/**
 * EMOJI ICONS QA (developer 2026-11-19, Playgama 4.3.2: "the interface does not use emoji in place of icons"). The game's screens and data wrote an emoji
 * wherever an icon was wanted (about 2,250 uses). `lib/emoji-jsx` is the JSX runtime the build uses: wherever a screen renders text in an element, an emoji
 * that has an icon in `lib/emojiIcons.ts` is drawn as that icon, in the text's own colour; the character stays as hidden text.
 *
 *  A. The map: every entry is a real icon (or a colour dot), keys are plain emoji, and the weak ones (a peach is not a cherry) are not in it.
 *  B. The conversion: text with a mapped emoji becomes text and icons; text without one is returned untouched (same object); a skin tone, a variation selector
 *     and a ZWJ sequence all find their icon; nothing is lost from the text.
 *  C. The runtime: the build is told to use it, it never touches an element whose text must stay text (option, textarea, svg text, ...), the icon's hidden
 *     text is made without JSX (so it can never turn into an icon again: that loop hung the page once), and the type checker keeps React's own runtime.
 *  D. Coverage: at least 85 % of the emoji uses in src are drawn as icons; the rest are named (ingredient pictures with no icon).
 *
 * Run: npx tsx scripts/emoji-icons-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { isValidElement } from "react";
import * as Lucide from "lucide-react";
import { EMOJI_ICONS, iconFor, normalizeEmoji } from "../src/lib/emojiIcons.ts";
import { TEXT_SAFE, convertChildren, withIcons } from "../src/lib/emoji-jsx/convert.ts";

let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail).slice(0, 300));
  }
}
const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

console.log("A. The map");
{
  const bad: string[] = [];
  for (const [key, v] of Object.entries(EMOJI_ICONS)) {
    if (normalizeEmoji(key) !== key) bad.push(`${key}: not normalised`);
    if ("icon" in v) {
      const typeOfIcon = typeof v.icon;
      if (!(typeOfIcon === "function" || typeOfIcon === "object"))
        bad.push(`${key}: not a component`);
    } else if (!/^#[0-9a-f]{6}$/i.test(v.dot)) bad.push(`${key}: bad dot colour`);
  }
  assert(
    bad.length === 0 && Object.keys(EMOJI_ICONS).length >= 200,
    `A1: ${Object.keys(EMOJI_ICONS).length} emoji have a drawn icon, every one a real component or a colour dot`,
    bad,
  );
  // RULE CHANGE 2026-11-20 (developer: "use proper emojis or assets throughout the game"): these foods have a PAINTED picture now (lib/paintedIcons.ts, the game's own ingredient
  // paintings), so `iconFor` gives the picture; they still never get a wrong LINE icon.
  assert(
    ["🍑", "🍓", "🍐", "🧈", "🍅", "🥔", "🧅", "🍄"].every((e) => {
      const f = iconFor(e);
      return f !== null && "picture" in f && !(e in EMOJI_ICONS);
    }),
    "A2: a peach, a strawberry, a pear, butter, a tomato, a potato, an onion and a mushroom are drawn as the game's own painted ingredient pictures, never as a wrong line icon",
  );
  assert(
    typeof Lucide.Trophy === "object" || typeof Lucide.Trophy === "function",
    "A3: the icon library (lucide-react, ISC licence) is bundled",
  );
}

console.log("B. The conversion");
{
  const out = withIcons("🔒 Locked · 🏆 won")!;
  const elements = out.filter((n) => isValidElement(n));
  const text = out.filter((n) => typeof n === "string").join("");
  assert(
    out && elements.length === 2 && text === " Locked ·  won",
    "B1: '🔒 Locked · 🏆 won' becomes two icons and the same words",
    { n: out?.length, text },
  );
  // RULE CHANGE 2026-11-20: a tomato has a painted picture now, so the example of an emoji with neither picture nor icon is an olive
  const plain = "Locked, 12 left (olives 🫒)";
  assert(
    withIcons(plain) === null && convertChildren(plain) === plain,
    "B2: text with no mapped emoji is returned untouched, the very same string",
  );
  assert(
    withIcons("🍳️")!.length === 1 && withIcons("👩🏽")!.length === 1 && withIcons("🧑‍🍳")!.length === 1,
    "B3: a variation selector, a skin tone and a ZWJ sequence each find their icon",
  );
  const kids = convertChildren(["Open ", "🔥", " now"] as never) as unknown[];
  assert(
    Array.isArray(kids) && kids.length === 3,
    "B4: children given as pieces keep their pieces",
  );
  const el = (withIcons("✨")![0] as { props: { emoji: string } }).props.emoji;
  assert(
    el === "✨",
    "B5: the icon element carries the emoji it stands for (it is drawn from it, and kept as hidden text)",
  );
}

console.log("C. The runtime");
{
  const vite = read("vite.config.ts");
  const runtime = read("src/lib/emoji-jsx/jsx-runtime.ts");
  const dev = read("src/lib/emoji-jsx/jsx-dev-runtime.ts");
  const icon = read("src/components/kc/common/EmojiIcon.tsx");
  assert(
    /jsxImportSource: "emoji-jsx"/.test(vite) && /"emoji-jsx":/.test(vite),
    "C1: the build uses the game's own JSX runtime (jsxImportSource emoji-jsx, aliased to src/lib/emoji-jsx)",
  );
  assert(
    /react\/jsx-runtime/.test(runtime) && /react\/jsx-dev-runtime/.test(dev),
    "C2: it is React's own runtime plus the icons (both the build and the dev server)",
  );
  assert(
    !TEXT_SAFE("option") &&
      !TEXT_SAFE("textarea") &&
      !TEXT_SAFE("title") &&
      !TEXT_SAFE("text") &&
      TEXT_SAFE("span") &&
      TEXT_SAFE("button") &&
      !TEXT_SAFE(() => null),
    "C3: it leaves alone option, textarea, title, svg text and components; it converts span, button and the like",
  );
  assert(
    /createElement\("span", \{ className: "gi-txt"/.test(icon) && !/<span[^>]*gi-txt/.test(icon),
    "C4: the icon's hidden text is made with createElement, never JSX (a JSX child would be converted into the same icon again, forever)",
  );
  const tsconfig = read("tsconfig.json");
  assert(
    !/jsxImportSource/.test(tsconfig),
    "C5: the type checker and the QA scripts keep React's own runtime (the same, without the icons)",
  );
}

console.log("D. Coverage");
{
  const PICTURE = /\p{Extended_Pictographic}️?/gu;
  let total = 0;
  let drawn = 0;
  const left = new Map<string, number>();
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "ui") continue;
        walk(p);
      } else if (/\.tsx?$/.test(e.name)) {
        const code = fs
          .readFileSync(p, "utf8")
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        for (const m of code.matchAll(PICTURE)) {
          const key = normalizeEmoji(m[0]);
          if (["✓", "★", "✗", "✕", "✦", "☆", "✔", "✖"].includes(key)) continue; // typographic symbols the fonts draw, not emoji
          total++;
          if (iconFor(m[0])) drawn++;
          else left.set(key, (left.get(key) ?? 0) + 1);
        }
      }
    }
  };
  walk(path.join(ROOT, "src"));
  const top = [...left.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, v]) => `${k}${v}`)
    .join(" ");
  console.log(
    `     ${drawn} of ${total} emoji uses are drawn as icons (${Math.round((100 * drawn) / total)} %); left as emoji: ${top} ...`,
  );
  assert(
    total > 1500 && drawn / total >= 0.85,
    `D1: at least 85 % of the emoji in src are drawn as icons (${Math.round((100 * drawn) / total)} %); what is left is ingredient and dish pictures with no faithful icon`,
    { total, drawn },
  );
}

console.log(failures ? `\nEMOJI ICONS QA: ${failures} FAILED` : "\nEMOJI ICONS QA: ALL PASS");
process.exit(failures ? 1 : 0);
