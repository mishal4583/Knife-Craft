// Self-test of the harness's profile cleanup (Batch 5, developer 2026-11-24). No game needed: it only launches Chrome on a blank page.
//   1. a launch gets its own profile folder named profile-<time>-<pid>-<n>, and two launches in one process get different ones;
//   2. closing browser A removes A's folder and ONLY A's: B's folder is still there and B still works (a parallel test is not disturbed);
//   3. after B closes, both are gone;
//   4. a process that FAILS (throws after launching) leaves no folder behind;
//   5. a process killed by an exit with the browser still open leaves no folder behind either;
//   6. a decoy folder that does not match the harness's name pattern, and a decoy "user" folder, are never touched;
//   7. clean-profiles.mjs removes a stale folder of a dead process, keeps a folder of a live process, and ignores everything else.
// Prints PASS/FAIL per check and exits 1 on any failure.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { OUT, launch, sleep } from "./harness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const results = [];
const check = (id, ok, detail) => {
  results.push({ id, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id}`, detail === undefined ? "" : JSON.stringify(detail));
};
const mine = () => fs.readdirSync(OUT).filter((n) => /^profile-\d+-\d+-\d+$/.test(n));

// The child modes (used by checks 4, 5 and 8 to 11)
const MODE = process.argv[2];
if (["child-throw", "child-exit", "child-ok", "child-launchfail", "child-hold"].includes(MODE)) {
  if (MODE === "child-launchfail") {
    // Chrome cannot start: launch() must throw AND leave no folder behind.
    process.env.CHROME_PATH = "C:/no/such/chrome.exe";
    try {
      await launch();
      console.log("LAUNCHED");
    } catch {
      console.log(
        "LAUNCHFAILED " + JSON.stringify(mine().filter((n) => n.includes(`-${process.pid}-`))),
      );
    }
    process.exit(0);
  }
  const { browser } = await launch();
  console.log("PROFILE " + mine().find((n) => n.includes(`-${process.pid}-`)));
  if (MODE === "child-throw") throw new Error("a test that fails after launching");
  if (MODE === "child-hold") {
    await sleep(6000);
    await browser.close();
    process.exit(0);
  }
  if (MODE === "child-ok") {
    await browser.close();
    process.exit(0);
  }
  void browser; // child-exit: leave the browser open and exit
  process.exit(3);
}

const before = new Set(mine());
const decoyUser = path.join(OUT, "profile-my-own-chrome-profile"); // does not match the pattern
const decoyOld = path.join(OUT, "profile-123"); // old style, fresh: not stale
fs.mkdirSync(decoyUser, { recursive: true });
fs.writeFileSync(path.join(decoyUser, "keep.txt"), "mine");
fs.mkdirSync(decoyOld, { recursive: true });

const a = await launch();
const dirA = mine().filter((n) => !before.has(n))[0];
const b = await launch();
const nowDirs = mine().filter((n) => !before.has(n));
const dirB = nowDirs.find((n) => n !== dirA);
check(
  "1 each launch has its own profile folder, named with the time, the process id and a counter",
  nowDirs.length === 2 &&
    new Set(nowDirs).size === 2 &&
    nowDirs.every((n) => n.includes(`-${process.pid}-`)),
  nowDirs,
);

await a.browser.close();
const afterA = mine().filter((n) => !before.has(n));
const bAlive = await b.page.evaluate(() => 1 + 1).catch(() => null);
check(
  "2 closing A removed A's folder only; B's folder is still there and B still works",
  !!dirA && !!dirB && afterA.length === 1 && afterA[0] === dirB && bAlive === 2,
  { dirA, dirB, afterA, bAlive },
);

await b.browser.close();
check(
  "3 after B closes, neither folder is left",
  mine().filter((n) => !before.has(n)).length === 0,
  mine().filter((n) => !before.has(n)),
);

for (const mode of ["child-throw", "child-exit"]) {
  const r = spawnSync(process.execPath, [path.join(HERE, "harness-cleanup.mjs"), mode], {
    encoding: "utf8",
    timeout: 120000,
  });
  const dir = /PROFILE (\S+)/.exec(r.stdout ?? "")?.[1];
  await sleep(500);
  check(
    mode === "child-throw"
      ? "4 a test that throws after launching leaves no folder"
      : "5 a process that exits with the browser still open leaves no folder",
    !!dir && !fs.existsSync(path.join(OUT, dir)) && r.status !== 0,
    { dir, status: r.status, stderr: (r.stderr ?? "").split("\n")[0]?.slice(0, 80) },
  );
}

check(
  "6 the decoy folders (a user-style name, an old-style fresh one) were not touched",
  fs.existsSync(path.join(decoyUser, "keep.txt")) && fs.existsSync(decoyOld),
  { user: fs.existsSync(decoyUser), old: fs.existsSync(decoyOld) },
);

// 7 the sweeper: a folder of a dead pid goes, a folder of a live pid stays
const deadPid = 2_000_000_000; // no such process
const stale = path.join(OUT, `profile-${Date.now()}-${deadPid}-1`);
const live = path.join(OUT, `profile-${Date.now()}-${process.pid}-999`);
fs.mkdirSync(stale);
fs.mkdirSync(live);
const sweep = spawnSync(process.execPath, [path.join(HERE, "clean-profiles.mjs")], {
  encoding: "utf8",
});
check(
  "7 clean-profiles removes a dead process's folder and keeps a live process's and every unrelated folder",
  !fs.existsSync(stale) &&
    fs.existsSync(live) &&
    fs.existsSync(decoyUser) &&
    fs.existsSync(decoyOld),
  { out: sweep.stdout.split("\n").slice(0, 3) },
);
fs.rmSync(live, { recursive: true, force: true });
fs.rmSync(decoyUser, { recursive: true, force: true });
fs.rmSync(decoyOld, { recursive: true, force: true });

// 8 a launch that fails leaves no folder
{
  const r = spawnSync(
    process.execPath,
    [path.join(HERE, "harness-cleanup.mjs"), "child-launchfail"],
    { encoding: "utf8", timeout: 60000 },
  );
  const m = /LAUNCHFAILED (\[.*\])/.exec(r.stdout ?? "");
  check(
    "8 a browser that cannot start throws and leaves no profile folder",
    !!m && JSON.parse(m[1]).length === 0 && !/LAUNCHED/.test(r.stdout ?? ""),
    { out: (r.stdout ?? "").trim().slice(0, 120) },
  );
}

// 9 repeated sequential runs leave nothing
{
  const dirs = [];
  for (let i = 0; i < 3; i++) {
    const r = spawnSync(process.execPath, [path.join(HERE, "harness-cleanup.mjs"), "child-ok"], {
      encoding: "utf8",
      timeout: 90000,
    });
    dirs.push(/PROFILE (\S+)/.exec(r.stdout ?? "")?.[1]);
  }
  await sleep(300);
  check(
    "9 three sequential runs each used their own folder and none is left",
    dirs.every(Boolean) &&
      new Set(dirs).size === 3 &&
      dirs.every((d) => !fs.existsSync(path.join(OUT, d))),
    dirs,
  );
}

// 10 two Node processes at the same time: each keeps its own folder while both run, neither touches the other's, both clean up, and a decoy survives
{
  const decoy = path.join(OUT, "profile-parallel-decoy");
  fs.mkdirSync(decoy, { recursive: true });
  const run = () =>
    new Promise((resolve) => {
      let out = "";
      const c = spawn(process.execPath, [path.join(HERE, "harness-cleanup.mjs"), "child-hold"], {
        stdio: ["ignore", "pipe", "ignore"],
      });
      c.stdout.on("data", (d) => (out += d));
      c.on("close", (code) => resolve({ code, dir: /PROFILE (\S+)/.exec(out)?.[1] }));
    });
  const pa = run();
  const pb = run();
  await sleep(4500); // both are holding their browsers open now
  const live = mine().filter((n) => !before.has(n));
  const bothAlive = live.length >= 2;
  const [ra, rb] = await Promise.all([pa, pb]);
  await sleep(500);
  const gone = [ra.dir, rb.dir].every((d) => d && !fs.existsSync(path.join(OUT, d)));
  check(
    "10 two parallel Node test processes: both folders existed together, they were different, both exited 0 and both were removed, a decoy was untouched",
    bothAlive &&
      ra.dir !== rb.dir &&
      ra.code === 0 &&
      rb.code === 0 &&
      gone &&
      fs.existsSync(decoy),
    { live, ra, rb },
  );
  fs.rmSync(decoy, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} FAILED` : "\nALL PASS");
process.exit(failed.length ? 1 : 0);
