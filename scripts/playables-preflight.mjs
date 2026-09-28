#!/usr/bin/env node
/**
 * Local, best-effort preflight for the Playgama build (Bridge SDK v2).
 * This is NOT Playgama's QA tool — it only catches mechanical mistakes
 * (Bridge script + config present, no other external scripts, relative
 * paths, file names, sizes). Run after `npm run build`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";

const DIST = join(process.cwd(), "dist");
const YT_SDK_SRC = "https://bridge.playgama.com/v2/stable/playgama-bridge.js";
const KB = 1024;
const MB = KB * 1024;

/** @type {{name: string, pass: boolean, detail?: string}[]} */
const checks = [];
function check(name, pass, detail) {
  checks.push({ name, pass, detail });
}

function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

let indexHtml = "";
let files = [];
try {
  indexHtml = readFileSync(join(DIST, "index.html"), "utf8");
  check("dist/index.html exists at the build root", true);
} catch {
  check("dist/index.html exists at the build root", false, "run `npm run build` first");
}

if (indexHtml) {
  files = walk(DIST);

  // ── SDK ordering ──────────────────────────────────────────────
  const sdkIndex = indexHtml.indexOf(YT_SDK_SRC);
  check("Playgama Bridge SDK <script> tag present", sdkIndex !== -1, YT_SDK_SRC);
  let bridgeConfigOk = false;
  try {
    JSON.parse(readFileSync(join(DIST, "playgama-bridge-config.json"), "utf8"));
    bridgeConfigOk = true;
  } catch {}
  check("playgama-bridge-config.json next to index.html (valid JSON)", bridgeConfigOk);

  const scriptTagRe = /<script\b[^>]*>/gi;
  const scriptTags = [...indexHtml.matchAll(scriptTagRe)];
  const sdkTagPosition = scriptTags.findIndex((m) => m[0].includes(YT_SDK_SRC));
  check(
    "SDK is the first <script> tag in index.html",
    sdkTagPosition === 0,
    sdkTagPosition !== 0
      ? `SDK <script> tag is at position ${sdkTagPosition} of ${scriptTags.length}`
      : undefined,
  );

  // ── no other external <script src="http...">  ───────────────────
  const externalScriptSrcs = scriptTags
    .map((m) => /src=["']([^"']+)["']/.exec(m[0])?.[1])
    .filter((src) => src && /^https?:\/\//.test(src) && src !== YT_SDK_SRC);
  check(
    "No external <script> tags besides the Bridge SDK",
    externalScriptSrcs.length === 0,
    externalScriptSrcs.join(", "),
  );

  // ── no external <img>/<link> in the HTML shell ──────────────────
  const externalAssetRe = /<(?:img|link)\b[^>]*(?:src|href)=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
  const externalAssets = [...indexHtml.matchAll(externalAssetRe)]
    .map((m) => m[1])
    .filter((url) => url !== YT_SDK_SRC);
  check(
    "No external images/stylesheets referenced in index.html",
    externalAssets.length === 0,
    externalAssets.join(", "),
  );

  // ── no root-absolute asset paths ────────────────────────────────
  const absPathRe = /(?:src|href)=["'](\/(?!\/)[^"']*)["']/g;
  const absPaths = [...indexHtml.matchAll(absPathRe)].map((m) => m[1]);
  check("No root-absolute asset paths in index.html", absPaths.length === 0, absPaths.join(", "));

  // ── source-wide scans (index.html + every built .js/.css) ──────
  const scannable = files.filter((f) => [".js", ".css", ".html"].includes(extname(f)));
  const contents = scannable.map((f) => ({ f, text: readFileSync(f, "utf8") }));
  const grep = (re) =>
    contents.filter(({ text }) => re.test(text)).map(({ f }) => relative(DIST, f));

  check(
    "No `window.bridge = ...` override (Bridge is only read, never replaced)",
    grep(/window\.bridge\s*=[^=]|window\[["']bridge["']\]\s*=/).length === 0,
  );
  check("No Lovable URLs/references in the build output", grep(/lovable/i).length === 0);
  check("No localhost URLs in the build output", grep(/localhost/i).length === 0);
  check(
    "No dev-only Vite runtime left in the build (import.meta.hot)",
    grep(/import\.meta\.hot/).length === 0,
  );
  check(
    "No QA-mode markers left in the build (VITE_KNIFECRAFT_QA / QA MODE badge)",
    grep(/VITE_KNIFECRAFT_QA|QA MODE/).length === 0,
  );

  // Page Visibility API / orientation-lock: checked against OUR source
  // (src/**), not the built output. Phaser's own bundled code contains
  // `document.hidden`/`visibilitychange` internally (its built-in
  // auto-pause handler) even with that feature switched off via
  // `disableVisibilityChange: true` in GameBridge — the string survives
  // minification as dead code. Scanning dist/ would flag vetted
  // third-party code we don't control instead of catching a real
  // mistake in code we wrote.
  const srcDir = join(process.cwd(), "src");
  const srcFiles = walk(srcDir).filter((f) => [".ts", ".tsx"].includes(extname(f)));
  // Strip comments first — this file (and PauseManager.ts) documents
  // *why* those APIs are avoided, which would otherwise self-flag.
  const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const srcContents = srcFiles.map((f) => ({ f, text: stripComments(readFileSync(f, "utf8")) }));
  const grepSrc = (re) =>
    srcContents.filter(({ text }) => re.test(text)).map(({ f }) => relative(srcDir, f));

  check(
    "No Page Visibility API usage in our own source (document.hidden / visibilitychange)",
    grepSrc(/document\.hidden|visibilitychange|document\.visibilityState/).length === 0,
  );
  check(
    "No screen-orientation lock in our own source",
    grepSrc(/orientation\s*\.\s*lock\s*\(/).length === 0,
  );

  // ── asset filenames are ZIP/URL-safe ────────────────────────────
  const unsafeNames = files
    .map((f) => relative(DIST, f).split(/[\\/]/).join("/"))
    .filter((rel) => !/^[A-Za-z0-9._/-]+$/.test(rel));
  check(
    "All asset filenames are ZIP/URL-safe (no spaces or special characters)",
    unsafeNames.length === 0,
    unsafeNames.join(", "),
  );

  // ── size reporting (informational) ──────────────────────────────
  const sizes = files.map((f) => ({ rel: relative(DIST, f), bytes: statSync(f).size }));
  const totalBytes = sizes.reduce((sum, s) => sum + s.bytes, 0);
  const oversized = sizes.filter((s) => s.bytes > 512 * KB);

  console.log("\n── KnifeCraft Playables preflight ──────────────────────────\n");
  for (const c of checks) {
    console.log(`${c.pass ? "✔" : "✘"} ${c.name}${c.detail ? `\n   ${c.detail}` : ""}`);
  }

  console.log(`\nFiles: ${files.length}`);
  console.log(`Total bundle size: ${(totalBytes / MB).toFixed(2)} MiB (target: < 15 MiB)`);
  if (oversized.length) {
    console.log(`Files over 512 KiB (${oversized.length}):`);
    for (const s of oversized) console.log(`  - ${s.rel}: ${(s.bytes / KB).toFixed(0)} KiB`);
  } else {
    console.log("No individual file exceeds 512 KiB.");
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(
    `\n${failed.length === 0 ? "✔ All hard checks passed." : `✘ ${failed.length} check(s) failed.`} This is a local preflight only — use Playgama's QA tool for the real check.\n`,
  );
  process.exitCode = failed.length === 0 ? 0 : 1;
} else {
  process.exitCode = 1;
}
