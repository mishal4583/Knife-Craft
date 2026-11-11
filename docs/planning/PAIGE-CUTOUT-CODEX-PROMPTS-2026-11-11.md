# Paige: standalone cutout, big speech bubble (developer 2026-11-11)

The popup is built (`components/kc/assistant/AssistantHost.tsx`, `PaigeArt.tsx`, `assistant.css`): Paige is a standalone cutout on the left, one large speech
bubble reaches to the right (a PAIGE nameplate on it, a Next arrow or the buttons at its foot), the screen behind is blurred and dimmed. It works with the OLD
half-body poses and a CSS bubble and nameplate. The new art below only makes her look like the reference picture; every file is optional (a missing
cutout falls back to the old pose, a missing nameplate to the CSS brass plate).

Reference: the developer's picture (green apron with two gold buttons and a bow, white blouse with rolled sleeves, brown hair in a loose bun with a gold
headband, warm smile, her left hand on her hip, her right hand open toward the speech bubble, a white sticker outline around her).

Folder (local, gitignored): `Paige Cutout Assets/`. Then `python scripts/make-paige-cutouts.py` writes `public/business/assistant/cutout-<pose>.webp` and `nameplate.webp`.

## Rules for every Paige cutout

- ONE character, exactly like the reference: same face, hair, headband, apron, shirt, belt pouch. Three-quarter figure from the head to the hips (a little below the apron bow).
- Transparent background, a clean white sticker outline about 6 px wide all around the figure, a soft warm shadow is NOT drawn (the game adds one).
- Canvas 768 x 1024 for EVERY pose, the figure at the same scale and the same place (her feet line / hip line on the same row, her body centred a little left), so switching pose never makes her jump.
- Her open hand (or pointing hand) gestures to the RIGHT side of the canvas, toward where the speech bubble is. No text, no speech bubble, no UI, no logo, no background.
- Painted storybook style like the other game art: warm light, soft shading, clean edges. No checkerboard pattern anywhere (draw real transparency).

## Prompt template (change only the POSE line)

> Game character cutout. The same woman as the reference picture: friendly assistant "Paige", brown hair in a loose bun with a gold headband, white blouse with
> rolled sleeves, dark green apron with two gold buttons and a gold bow, brown belt pouch. Three-quarter figure from head to hips, facing the viewer, a clean
> white sticker outline around her, transparent background, canvas 768 x 1024, figure centred slightly left, nothing else in the picture. POSE: <pose>. Her free
> hand gestures to the right, toward an empty space where a speech bubble will be. Painted storybook game-art style, warm light, soft shading.

## The 12 poses (file name, POSE line)

| File | POSE |
|---|---|
| `cutout-wave.png` | waving hello with her right hand, big smile, left hand on her hip |
| `cutout-explain.png` | explaining: right palm open toward the right, friendly and calm, left hand on her hip (the reference pose) |
| `cutout-point.png` | pointing with her right index finger to the right, eyebrows up, encouraging |
| `cutout-tip.png` | a helpful tip: right index finger raised near her cheek, a small knowing smile |
| `cutout-cheer.png` | cheering: both fists raised, a joyful open smile, eyes bright |
| `cutout-thumbs.png` | a big thumbs-up with her right hand, a proud smile |
| `cutout-oops.png` | oops: right hand to her cheek, a wince-smile, a little embarrassed |
| `cutout-surprised.png` | surprised: eyebrows high, mouth a small round O, right hand open toward the right |
| `cutout-think.png` | thinking: right hand on her chin, eyes looking up to the right, a curious half smile |
| `cutout-sorry.png` | sorry: both hands together in front, a soft apologetic look |
| `cutout-clap.png` | clapping happily, hands together at chest height, a big warm smile |
| `cutout-clipboard.png` | holding a clipboard in her left hand, her right hand open toward the right, a focused friendly look |

## The nameplate

`nameplate.png`, about 512 x 128, transparent: a BLANK small brass name plate with a soft curved shape, two tiny gold leaves at the ends and a thin darker rim,
warm gold-brown, painted like the game's wood-and-brass UI. NO letters (the game writes PAIGE on it so it stays crisp and translatable). No shadow.

> A blank small brass name plate for a game dialogue bubble, horizontal, soft rounded ends with two tiny gold leaves, thin dark-bronze rim, warm painted
> storybook style, transparent background, 512 x 128, no text.

## Optional

- A speech-bubble art (`bubble-wide.png`) is NOT needed: the bubble is drawn in CSS so it grows with the text on every phone.
- The Next arrow stays the existing `chevron-large.webp`.
