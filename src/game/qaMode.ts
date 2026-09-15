/**
 * QA_MODE — Pre-Phase-8: a development-only bypass that lets every
 * currently-defined campaign level be opened directly from Kitchen,
 * without touching the real unlock graph, SaveManager, or LevelManager.
 *
 * Gated on BOTH `import.meta.env.DEV` (always false in a real `vite
 * build`, so Vite's static replacement dead-code-eliminates every branch
 * guarded by it — confirmed against this repo's `npm run build`/`vite
 * build` output) AND an explicit opt-in var, so a plain `npm run dev`
 * session doesn't turn it on by accident. Set it locally via a
 * gitignored `.env.local` (see `.env.local.example`):
 *
 *   VITE_KNIFECRAFT_QA=true
 *
 * QA_MODE only ever affects Kitchen's own render (see Kitchen.tsx) —
 * `isUnlocked`/`LevelProgress`/`SaveData`/`completeLevel` are all
 * untouched, so completing a QA-opened level still only records THAT
 * level (no fabricated prior completions), replay-pays-zero still holds,
 * and "Reset Progress" is unaffected since QA mode never writes to
 * SaveManager at all.
 */
export const QA_MODE = import.meta.env.DEV && import.meta.env["VITE_KNIFECRAFT_QA"] === "true";
