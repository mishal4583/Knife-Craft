// Removes the throwaway Chrome profiles that a KILLED test run left behind in tools/e2e (the harness removes its own on close and on exit; only an outright kill skips that).
//   node tools/e2e/clean-profiles.mjs          removes the stale ones
//   node tools/e2e/clean-profiles.mjs --list   only lists them
// It only ever looks at folders of THIS directory named exactly `profile-<time>-<pid>-<n>` (the harness's own) or the old `profile-<time>`:
//   - a new-style folder is removed only when its process id is no longer running (a parallel test's profile is never touched);
//   - an old-style folder (no process id) is removed only when it has not been touched for an hour.
// Your own Chrome profile lives elsewhere and is never looked at.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const LIST_ONLY = process.argv.includes("--list");
const HOUR = 60 * 60 * 1000;

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM"; // exists, but not ours to signal
  }
};

let found = 0;
let removed = 0;
for (const entry of fs.readdirSync(DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const m = /^profile-(\d+)(?:-(\d+)-(\d+))?$/.exec(entry.name);
  if (!m) continue; // not ours: left alone
  const full = path.join(DIR, entry.name);
  const stale =
    m[2] !== undefined ? !alive(Number(m[2])) : Date.now() - fs.statSync(full).mtimeMs > HOUR;
  if (!stale) continue;
  found++;
  console.log(`${LIST_ONLY ? "stale " : "removing"} ${entry.name}`);
  if (LIST_ONLY) continue;
  try {
    fs.rmSync(full, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 });
    removed++;
  } catch (e) {
    console.log(`  could not remove: ${e.code ?? e.message}`);
  }
}
console.log(
  LIST_ONLY
    ? `${found} stale profile folder(s)`
    : `removed ${removed} of ${found} stale profile folder(s)`,
);
