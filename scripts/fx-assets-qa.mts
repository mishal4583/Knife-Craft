/**
 * FX ASSETS QA (developer 2026-11-26): the painted effect sprites cut from the Codex sheets FX-1..5 by `scripts/make-fx-assets.py`.
 *  A1 every expected file exists and is small (a steam wisp / mist <= 30 KB, anything else <= 60 KB; the whole set under 700 KB)
 *  A2 every sprite is a WebP with an alpha channel
 *  A3 the celebration card's starburst and confetti are the files that exist, and the layer is decoration only (aria-hidden, transform/opacity, Reduced motion hides it)
 * Run: npx tsx scripts/fx-assets-qa.mts
 */
import { existsSync, readFileSync, statSync } from "node:fs";
let failures = 0;
function assert(cond: unknown, label: string, detail?: unknown) {
  if (!cond) {
    failures++;
    console.log(`FAIL: ${label}`, detail === undefined ? "" : JSON.stringify(detail));
  } else console.log(`  ok   ${label}`);
}
const url = (p: string) => new URL(`../${p}`, import.meta.url);
const range = (n: number, p: string) => Array.from({ length: n }, (_, i) => `${p}-${i + 1}`);
// RULE CHANGE (developer 2026-11-27, "make it exactly like this"): the six steam ribbons are replaced by the kitchen's steam film
// (`kitchen-fx/plume.webp`, checked by kitchen-ambient-qa C5b)
const expected = [
  ...range(2, "kitchen-fx/mist"),
  ...range(6, "fx/flame-fire"),
  ...range(6, "fx/flame-burner"),
  ...range(6, "fx/flame-candle"),
  ...range(4, "fx/glint"),
  ...range(4, "fx/glow"),
  ...range(6, "fx/petal"),
  ...range(6, "fx/leaf"),
  ...range(6, "fx/bit"),
  ...range(8, "fx/confetti"),
  ...range(4, "fx/coin"),
  ...range(4, "fx/burst"),
].map((n) => `public/${n}.webp`);

console.log("A. The sprites");
{
  const missing = expected.filter((p) => !existsSync(url(p)));
  assert(missing.length === 0, `A1: all ${expected.length} sprites exist`, missing);
  const sizes = expected
    .filter((p) => existsSync(url(p)))
    .map((p) => [p, statSync(url(p)).size] as const);
  const big = sizes.filter(([p, s]) => s > (/kitchen-fx/.test(p) ? 30 : 60) * 1024);
  assert(big.length === 0, "A1: each sprite is small", big);
  const total = sizes.reduce((a, [, s]) => a + s, 0);
  assert(total < 700 * 1024, "A1: the whole set is under 700 KB", Math.round(total / 1024));
  const notWebp = sizes.filter(([p]) => {
    const b = readFileSync(url(p));
    return !(b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP");
  });
  assert(
    notWebp.length === 0,
    "A2: every file is a WebP",
    notWebp.map(([p]) => p),
  );
  // VP8X (with the alpha flag, bit 4 of the flags byte) or VP8L (lossless always carries alpha); plain lossy VP8 has none
  const noAlpha = sizes.filter(([p]) => {
    const b = readFileSync(url(p));
    const kind = b.toString("ascii", 12, 16);
    return !(kind === "VP8L" || (kind === "VP8X" && (b[20] & 0x10) !== 0));
  });
  assert(
    noAlpha.length === 0,
    "A2: every sprite keeps its alpha",
    noAlpha.map(([p]) => p),
  );
}

console.log("B. The celebration card");
{
  const tsx = readFileSync(url("src/components/kc/common/CelebrationFx.tsx"), "utf8");
  const css = readFileSync(url("src/components/kc/common/celebrationFx.css"), "utf8");
  const card = readFileSync(url("src/components/kc/common/CelebrationCard.tsx"), "utf8");
  assert(
    /fx\/burst-4\.webp/.test(tsx) &&
      /fx\/confetti-\$\{\(i % 8\) \+ 1\}\.webp/.test(tsx) &&
      existsSync(url("public/fx/burst-4.webp")) &&
      existsSync(url("public/fx/confetti-8.webp")),
    "B1: the starburst and the 8 confetti pieces are real files",
  );
  assert(/<CelebrationFx \/>/.test(card), "B2: the card shows it");
  assert(
    /aria-hidden="true"/.test(tsx) && /pointer-events: none/.test(css),
    "B3: decoration only (aria-hidden, no pointer events)",
  );
  const props = [...css.matchAll(/animation:\s*([a-z-]+)/g)].map((m) => m[1]);
  const kf = [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)].map((m) => m[1]).join("\n");
  const used = [...kf.matchAll(/^\s*(?:[a-z-]+):/gm)].map((m) => m[0].trim().replace(":", ""));
  assert(
    props.length === 2 && used.every((p) => p === "opacity" || p === "transform"),
    "B4: only transform and opacity are animated",
    [...new Set(used)],
  );
  assert(
    /\.kc-reduced-motion \.cfx/.test(css) && /prefers-reduced-motion: reduce/.test(css),
    "B5: Reduced motion hides it",
  );
}
console.log(failures ? `\nFX ASSETS QA: ${failures} FAILED` : "\nFX ASSETS QA: ALL PASS");
process.exit(failures ? 1 : 0);
