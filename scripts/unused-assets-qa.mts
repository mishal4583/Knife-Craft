/**
 * UNUSED ASSETS QA — the asset cleanup (task #25). Every image/video/font
 * tracked under src/assets must be reachable from the code: imported by
 * path, matched by an import.meta.glob pattern, or referenced from CSS /
 * index.html — except the documented source originals (src/assets/shop/,
 * the full-size art the shop-mobile/ copies are made from, never bundled).
 *
 *  A1 every tracked asset is referenced (or a documented original).
 *  A2 the two removed files stay gone and nothing refers to them:
 *     src/assets/kitchen$f (a byte-identical copy of kitchen/skin-06.webp,
 *     never imported) and src/assets/tomato.webp (never imported).
 *
 * Run: npx tsx scripts/unused-assets-qa.mts
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

let failures = 0;
function assert(cond: unknown, msg: string) {
  if (cond) console.log(`  ok  ${msg}`);
  else {
    failures++;
    console.log(`  FAIL ${msg}`);
  }
}
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|css|js)$/.test(e.name)) out.push(p);
  }
  return out;
}
const code =
  walk("src")
    .map((f) => fs.readFileSync(f, "utf8"))
    .join("\n") +
  fs.readFileSync("index.html", "utf8") +
  fs.readFileSync("vite.config.ts", "utf8");
const globs = [...code.matchAll(/import\.meta\.glob\(\s*"([^"]+)"/g)].map((m) => m[1]!);
const globDirs = globs.map((g) => g.replace(/^\//, "").replace(/\/[^/]*$/, "/"));
const SOURCE_ORIGINALS = ["src/assets/shop/"];

const tracked = execSync("git ls-files src/assets", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const unreferenced = tracked.filter((f) => {
  const rel = f.slice("src/".length);
  if (globDirs.some((d) => f.startsWith(d))) return false;
  if (SOURCE_ORIGINALS.some((d) => f.startsWith(d))) return false;
  return !(code.includes(`@/${rel}`) || code.includes(`./${rel}`) || code.includes(rel));
});
assert(
  unreferenced.length === 0,
  `A1: all ${tracked.length} tracked assets are referenced (or documented originals) ${unreferenced.join(", ")}`,
);
const gone = ["src/assets/kitchen$f", "src/assets/tomato.webp"];
assert(
  gone.every((f) => !fs.existsSync(f) && !tracked.includes(f)) &&
    !/kitchen\$f|tomato\.webp/.test(code),
  "A2: kitchen$f and tomato.webp are removed and nothing refers to them",
);

console.log(failures ? `UNUSED ASSETS QA: ${failures} FAILURE(S)` : "UNUSED ASSETS QA: ALL PASS");
process.exit(failures ? 1 : 0);
