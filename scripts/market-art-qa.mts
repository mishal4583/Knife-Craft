/**
 * MARKET ART QA (developer 2026-11-03): the Market's supply emoji were replaced by painted icons and the Second Floor team got portraits
 * (scripts/make-market-assets.py builds them from local-only source PNGs).
 *   A  every supply has exactly one icon: public/business/supplies/<id>.webp, none extra, none missing
 *   B  each icon is a 160 x 160 WebP with an alpha channel, small (<= 12 KB), all together <= 400 KB
 *   C  the build script lists the supplies in the SAME order as SUPPLY_CATALOG (a swapped cell would show the wrong picture)
 *   D  the two Floor team portraits exist (320 x 320 WebP, <= 40 KB)
 *   E  the screens use the pictures and fall back to the emoji when one cannot load (nothing ever blank)
 *   F  the 59 MB of source PNGs stay out of git; only the optimized files are tracked
 * Prints PASS/FAIL per check and exits 1 on any failure.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { SUPPLY_CATALOG } from "../src/game/business/businessSupplies.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
let failures = 0;
function assert(cond: unknown, msg: string, detail?: unknown) {
  console.log(`  ${cond ? "ok " : "FAIL"} ${msg}`);
  if (!cond) {
    failures++;
    if (detail !== undefined) console.log("       ", JSON.stringify(detail));
  }
}
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/** Width, height and alpha flag of a WebP file (VP8X extended, or plain lossy VP8). */
function webpInfo(file: string): { w: number; h: number; alpha: boolean } | null {
  const b = fs.readFileSync(file);
  if (
    b.length < 30 ||
    b.toString("ascii", 0, 4) !== "RIFF" ||
    b.toString("ascii", 8, 12) !== "WEBP"
  )
    return null;
  const kind = b.toString("ascii", 12, 16);
  if (kind === "VP8X")
    return {
      alpha: (b[20]! & 0x10) !== 0,
      w: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)),
      h: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)),
    };
  if (kind === "VP8 ")
    return { alpha: false, w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return null;
}

const dir = path.join(ROOT, "public/business/supplies");
const ids = SUPPLY_CATALOG.map((s) => s.id as string);

console.log("A. One icon per supply");
{
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".webp"))
    .map((f) => f.replace(/\.webp$/, ""));
  const missing = ids.filter((id) => !files.includes(id));
  const extra = files.filter((f) => !ids.includes(f));
  assert(
    ids.length === 62 && missing.length === 0 && extra.length === 0,
    "A1: 62 supplies, 62 icons, none missing, none extra",
    { missing, extra },
  );
}

console.log("B. Format and budget");
{
  const bad: string[] = [];
  let total = 0;
  let biggest = 0;
  for (const id of ids) {
    const f = path.join(dir, `${id}.webp`);
    const info = webpInfo(f);
    const size = fs.statSync(f).size;
    total += size;
    biggest = Math.max(biggest, size);
    if (!info || info.w !== 160 || info.h !== 160 || !info.alpha || size > 12 * 1024) bad.push(id);
  }
  assert(bad.length === 0, "B1: every icon is a 160 x 160 WebP with alpha, at most 12 KB", bad);
  assert(total <= 400 * 1024, "B2: all 62 icons together stay under 400 KB", {
    kb: Math.round(total / 1024),
    biggest,
  });
}

console.log("C. The build script's order matches the catalog");
{
  const py = read("scripts/make-market-assets.py");
  const block = py.slice(py.indexOf("ATLASES = {"), py.indexOf("def clean"));
  const inScript = [...block.matchAll(/"([a-z][a-z-]*)"/g)]
    .map((m) => m[1]!)
    .filter((x) => !x.startsWith("s") || ids.includes(x));
  const ordered = inScript.filter((x) => ids.includes(x));
  assert(
    ordered.length === ids.length && ordered.every((x, i) => x === ids[i]),
    "C1: the atlas cells are listed in SUPPLY_CATALOG order (a swap would show the wrong picture)",
    ordered.filter((x, i) => x !== ids[i]).slice(0, 5),
  );
}

console.log("D. The Floor team portraits");
{
  const ok = ["floor-server", "floor-cleaner"].every((n) => {
    const f = path.join(ROOT, `public/business/staff-portraits/${n}.webp`);
    const info = fs.existsSync(f) ? webpInfo(f) : null;
    return !!info && info.w === 320 && info.h === 320 && fs.statSync(f).size <= 40 * 1024;
  });
  assert(ok, "D1: floor-server.webp and floor-cleaner.webp are 320 x 320 WebP, at most 40 KB");
}

console.log("E. The screens use them, with the emoji as the fallback");
{
  const icon = read("src/components/kc/common/SupplyIcon.tsx");
  const face = read("src/components/kc/common/FloorStaffFace.tsx");
  assert(
    /onError=\{\(\) => setFailed\(true\)\}/.test(icon) &&
      /if \(failed\) return <>\{fallback\}<\/>/.test(icon) &&
      /onError=\{\(\) => setFailed\(true\)\}/.test(face) &&
      /if \(failed\) return <>\{fallback\}<\/>/.test(face) &&
      !/https?:\/\//.test(icon + face),
    "E1: both components show the emoji if the picture fails, and load nothing from the network",
  );
  const sites = [
    "src/components/kc/MarketSupplies.tsx",
    "src/components/kc/inventory/InventorySupplies.tsx",
    "src/components/kc/business/BusinessCleanliness.tsx",
    "src/components/kc/restaurant/ParAuditCard.tsx",
    "src/components/kc/restaurant/PreServiceCheck.tsx",
    "src/components/kc/restaurant/SinkWash.tsx",
  ];
  const lacking = sites.filter((s) => !/<SupplyIcon /.test(read(s)));
  assert(
    lacking.length === 0,
    "E2: the Market, Inventory, Cleaning, Par Audit, Pre-Service Check and sink screens draw the icon",
    lacking,
  );
  assert(
    /<FloorStaffFace/.test(read("src/components/kc/MarketSecondFloor.tsx")) &&
      /<FloorStaffFace/.test(read("src/components/kc/restaurantMap/SecondFloorView.tsx")),
    "E3: the Second Floor team (Market and floor view) shows the portraits",
  );
}

console.log("F. Sources stay out of git");
{
  const tracked = execSync("git ls-files art-source public/business/supplies", {
    cwd: ROOT,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const pngs = tracked.filter(
    (f) => /\.png$/i.test(f) && /art-source\/(fridge-sort|market-supplies|staff)\//.test(f),
  );
  const ignore = read(".gitignore");
  assert(
    pngs.length === 0 &&
      [
        "art-source/fridge-sort/*.png",
        "art-source/market-supplies/*.png",
        "art-source/staff/*.png",
      ].every((p) => ignore.includes(p)),
    "F1: the generated source PNGs are gitignored and none is tracked",
    pngs,
  );
}

console.log(
  failures === 0 ? "\nMARKET ART QA: ALL PASS" : `\nMARKET ART QA: ${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
