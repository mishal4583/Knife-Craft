# Paige: sharp art for phone screens (developer 2026-11-11; redone 2026-11-13 "the quality of Paige's images is low")

## Where it stands

- **Done without new art (2026-11-13):** the 12 poses were being shrunk to 52 % of the painted sheets (252 x 324 px). They are now exported at
  the sheets' full size (**482 x 624 px**, `POSE_SCALE = 1.0` in `scripts/make-assistant-assets.py`), about twice as sharp, 399 KB in all.
- **Still soft on a good phone:** she is shown up to 520 CSS px tall, which is 1,000 to 1,500 real pixels. The sheets have no more detail than
  624 px, so only new, larger art closes the gap. That is what the prompts below are for.
- Her look does NOT change (the developer's decision of 2026-11-11): dark-teal vest, white blouse, pencil in her bun, the copper name tag.

## How the new art gets into the game

1. Save each picture as `Paige Cutout Assets/cutout-<pose>.png` (the folder is local and gitignored).
2. Run `python scripts/make-paige-cutouts.py`. It writes `public/business/assistant/cutout-<pose>.webp`.
3. The game uses a `cutout-` file when it exists and the `pose-` file when it does not, so the poses can be delivered one at a time.

The script forgives the art: it trims the border, clears soft glow, makes her the SAME size in every pose (measured from the top of her hair to
the hip cut, so the pictures may come out at different scales) and lines her hips up, so she never jumps between poses. It refuses a picture
with no transparent background and warns when one is too small.

## Rules for every picture

- **Attach two reference images to every prompt:** `Assistant Assets/M01-paige-sheet.png` (who she is) and the matching sheet
  `Assistant Assets/M02-poses-1.png` or `M03-poses-2.png` (the pose).
- **Size: 1024 x 1536 px, portrait, transparent background (PNG with alpha).** One figure per picture.
- Framing: from the top of her hair to her hips, cut straight across at the hips (the screen's bottom edge hides the cut). Her body fills
  about 85 % of the picture's height. Leave empty space above her head only when a hand is raised.
- Crisp, clean edges. No glow, no halo, no drop shadow, no white sticker outline, no checkerboard, no background at all.
- No text anywhere (her name tag stays blank copper), no speech bubble, no UI, no props except the clipboard in the clipboard pose.

## The prompt (change only the last line)

> Game character art for a mobile game, one figure, portrait 1024 x 1536, transparent background (PNG with alpha).
> Draw EXACTLY the woman of the attached reference sheet, in the same warm painted storybook style and the same soft kitchen light: a friendly
> young woman with dark curly brown hair in a loose updo with a yellow pencil pushed through the bun, small copper earrings, a dark-teal buttoned
> vest with four copper buttons and a small blank copper name tag, a cream-white collared blouse with the sleeves rolled to the elbows, a brown
> leather belt with a brass buckle, dark grey-brown trousers. Same face, same proportions, same colours as the reference: do not redesign her.
> Framing: from the top of her hair down to her hips, cut straight across at the hips; her body fills about 85 % of the height; she faces the
> viewer, turned very slightly to her left, standing in the middle of the picture.
> High detail for a phone screen: sharp eyes and eyelashes, clean readable hands with five fingers, visible fabric weave and stitching, crisp
> clean silhouette edges. No glow, no halo, no outline, no drop shadow, no background, no text, no speech bubble, nothing else in the picture.
> POSE: <the pose line from the table>

## The 12 pictures

| File to save | POSE line |
|---|---|
| `cutout-wave.png` | waving hello with her right hand raised beside her head, open palm, big open smile, left hand on her hip |
| `cutout-explain.png` | explaining: her left hand held out to the side, palm up, as if presenting something; calm closed-mouth smile; other hand on her hip |
| `cutout-point.png` | pointing to her left (the viewer's right) with a straight arm and index finger at shoulder height, looking where she points, excited open smile |
| `cutout-tip.png` | a helpful tip: right index finger raised beside her face, knowing smile, eyebrows slightly up, left hand on her hip |
| `cutout-cheer.png` | cheering: both fists raised at shoulder height, eyes closed with joy, laughing |
| `cutout-thumbs.png` | a thumbs up with her right hand in front of her chest, warm proud smile, left hand on her hip |
| `cutout-oops.png` | oops: a small wince, teeth showing in an awkward smile, shoulders up, one hand raised near her cheek |
| `cutout-surprised.png` | surprised: eyes wide, mouth a small "o", both hands raised open at chest height |
| `cutout-think.png` | thinking: one finger on her chin, eyes looking up and to the side, the other arm folded under her elbow |
| `cutout-sorry.png` | sorry: a gentle apologetic smile, eyebrows tilted, both palms pressed together in front of her chest |
| `cutout-clap.png` | clapping happily, hands together in front of her chest, delighted smile |
| `cutout-clipboard.png` | holding a wooden clipboard against her chest with one arm and a pencil in the other hand, friendly attentive smile; the clipboard's paper is blank |

**If you only do six:** `wave`, `explain`, `point`, `tip`, `cheer`, `thumbs` (the ones the game shows most).

## Checking a picture before saving it

- It is the same woman (hair, pencil, vest, name tag, belt), not a new character.
- The background is really transparent (not white, not a painted checkerboard).
- Hands have five fingers; the name tag has no letters.
- She is cut at the hips, not at the knees or the chest.

## Not needed

No nameplate art, no bubble art, no new outfit, no new poses. (`nameplate.png` is still accepted by the script if a painted plate is ever
wanted; the CSS plate is fine.)
