# Paige: cutout popup, what art is (not) needed (developer 2026-11-11)

The developer's decision: **Paige's current look (the dark-teal vest, white blouse, pencil in her bun, the name tag: `Assistant Assets/M01-paige-sheet.png`) is enough.**
The green-apron picture was only a reference for HOW the popup works (cutout on the left rising from the bottom, one big speech bubble to the right, a PAIGE
nameplate, the screen blurred and dimmed). That is built (`AssistantHost.tsx`, `CelebrationCard.tsx`, `PaigeArt.tsx`, `assistant.css`).

## What needs NO art

- The speech bubble, its tail, the PAIGE nameplate, the glow behind her, the Next arrow: drawn in CSS / the existing `chevron-large.webp`.
- Her look: the 12 existing poses (`public/business/assistant/pose-<pose>.webp`) are used as they are.

## The one art gap: sharpness (optional but recommended)

The 12 poses are only **252 x 324 px**. In the popup she is shown about 230-300 CSS px wide, which is 460-900 device pixels on a phone, so she looks soft. The
fix is the SAME 12 poses redrawn at three times the size. Nothing about her design changes. Until then the game keeps working with the old files.

Folder (local, gitignored): `Paige Cutout Assets/`. Then `python scripts/make-paige-cutouts.py` writes `public/business/assistant/cutout-<pose>.webp`; the game
uses a `cutout-` file when it exists and the old `pose-` file when it does not, so any subset can be delivered one by one.

### Rules for every file

- **Reference image to attach to every prompt: `Assistant Assets/M01-paige-sheet.png` (and the matching old pose, e.g. `pose-point.webp`, for the pose itself).**
- The SAME Paige, unchanged: dark curly brown hair in an updo with a yellow pencil, dark-teal vest with copper buttons and a small copper name tag, white collared
  blouse with rolled sleeves, brown belt. No apron, no headband, no new outfit.
- Same pose as the matching old file, same framing: from the head to the hips (cut off at the hips, straight bottom edge: the screen's bottom edge hides it).
- Transparent background, **756 x 972 px**, the figure at the same scale and in the same place in EVERY file (her hip line on the same row), so switching pose never
  makes her jump. Clean, crisp edges (no glow, no halo, no checkerboard), the same painted storybook style and warm light as the sheet.
- No text, no speech bubble, no UI, no props except the one the pose needs (the clipboard).

### Prompt template (change only the POSE line)

> Game character cutout, exactly the same woman and the same painted storybook style as the attached reference sheet (M01): dark curly updo with a yellow
> pencil, dark-teal vest with copper buttons and a small copper name tag, white blouse with rolled sleeves, brown belt. Redraw the attached pose at high
> resolution and with crisp clean edges. Framing from the head to the hips, straight cut at the hips, facing the viewer, transparent background, canvas 756 x 972,
> figure centred slightly left, no outline, no glow, nothing else in the picture. POSE: <pose>.

### The 12 files (redraw each of the existing poses; the POSE line is just the old file's pose)

| File to make | The pose to keep (look at the old file) |
|---|---|
| `cutout-wave.png` | `pose-wave.webp`: waving hello |
| `cutout-explain.png` | `pose-explain.webp`: explaining, open hand |
| `cutout-point.png` | `pose-point.webp`: pointing to the right |
| `cutout-tip.png` | `pose-tip.webp`: a helpful tip |
| `cutout-cheer.png` | `pose-cheer.webp`: cheering, both fists up |
| `cutout-thumbs.png` | `pose-thumbs.webp`: thumbs up |
| `cutout-oops.png` | `pose-oops.webp`: oops |
| `cutout-surprised.png` | `pose-surprised.webp`: surprised |
| `cutout-think.png` | `pose-think.webp`: thinking |
| `cutout-sorry.png` | `pose-sorry.webp`: sorry |
| `cutout-clap.png` | `pose-clap.webp`: clapping |
| `cutout-clipboard.png` | `pose-clipboard.webp`: holding the clipboard |

Priority if you do not want all twelve: `wave`, `explain`, `cheer`, `point`, `tip`, `thumbs` (the ones used most).

## Not needed

No nameplate art, no bubble art, no new outfit, no new poses. (`nameplate.png` is still accepted by the script if you ever want a painted plate; the CSS plate is fine.)
