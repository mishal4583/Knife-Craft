# NPC REALISM: CODEX PROMPTS (developer 2026-11-07)

Plan: `NPC-REALISM-PLAN-2026-11-07.md`. Put the generated PNGs in `D:\WORKS\GAMES\Knife Craft\NPC Assets\` (one file per
character: `<id>-a.png`, `<id>-b.png`, `<id>-bust.png`, `props.png`). Order: **Prompt 0 first**, then P1 (staff A + the 12 regulars A), then
P2, then P3. Attach to EVERY request: the style anchor made by Prompt 0 (and, for a staff member, their portrait from
`public/business/staff-portraits/`).

## How to use these

1. Run **Prompt 0** once. Keep the result as `style-anchor.png`. If the faces or proportions are not right, redo it before anything else:
   everything else copies it.
2. For each character, paste **STYLE LOCK** + **PROMPT A** (or B / BUST) and fill the `<<...>>` line from the tables. Attach
   `style-anchor.png` (and the portrait for staff).
3. If the tool cannot give a real transparent background, ask for a flat pure magenta `#FF00FF` background instead (the cutting script keys it).
4. Reject and redo a sheet when: the characters in the cells are different sizes, the feet are not on one line, a cell has a shadow, a label or
   a border, or the face changes between cells.

## STYLE LOCK (paste at the top of every prompt)

```
STYLE LOCK. Warm, hand-painted game art for a cozy restaurant game: soft painted shading, gentle warm rim light (golden evening
light from the upper left), clean readable shapes, rich but natural colours (copper, forest green, cream, walnut brown), slightly
stylised realistic proportions (about 5 heads tall, a slightly large head so the face reads at small size), no outlines thicker than a
thin soft dark-brown edge. Characters are ordinary, kind, believable people with clear faces: eyes, brows, nose, mouth, ears; natural
skin textures; no chibi, no mascot style, no photo-realism, no AI artefacts (no extra fingers, no melted hands, no gibberish text).
Camera: a 3/4 top-down view like a cozy restaurant map, looking slightly down at the people.
Output: a PNG with a TRANSPARENT background (if impossible: a flat pure magenta #FF00FF background, no gradient). No cast shadow, no
floor, no cell borders, no labels, no text, no logos, no watermarks.
```

## PROMPT 0: style anchor (run once)

```
<STYLE LOCK>
Create ONE image, 1536 x 1024, a "style anchor" line-up of 8 different people standing side by side on a transparent background, all
full body, front view, same scale, feet on one line, evenly spaced, none overlapping:
1 a young woman server (curly dark hair in a high updo, white blouse, brown vest, dark green bow tie, green waist apron),
2 a young man cashier (wavy dark hair, round wire glasses, white shirt, dark green bib apron),
3 an elderly head chef (white swept-back hair and moustache, white double-breasted chef tunic with copper buttons, tall white toque,
  dark green apron),
4 a woman line cook (curly hair tied back, white tunic, rust-orange apron),
5 a customer woman (long black wavy hair, teal blouse, long skirt),
6 a customer man (short beard, rust flannel shirt, jeans),
7 an elderly customer woman (grey hair in a bun, floral dress, shawl),
8 a boy about 8 years old (short brown hair, red t-shirt, shorts), drawn at 70% of an adult's height.
Faces must be clearly readable and different (age, skin tone, features). Men and women must be clearly different in silhouette
(hair, build, clothing), not only in colour. This image is the style, proportion and quality reference for every later request.
```

## PROMPT A: walk and sit sheet (one character per image)

```
<STYLE LOCK>
Reference: the attached style anchor (same style, proportions, face quality and rendering) <<and, for staff, the attached portrait: this
person must be recognisably the same person: face, hair, skin, glasses, uniform colours>>.
Create ONE sprite sheet of this character: <<CHARACTER LINE FROM THE TABLE>>.

Canvas 1536 x 1024, a grid of 6 columns x 4 rows, every cell exactly 256 x 256 px, the character centred in every cell, SAME scale in
every cell, feet on the SAME baseline (y = 218 of each cell), head top near y = 28. The character is about 190 px tall (a child about
133 px). Nothing may cross into a neighbouring cell.

Row 1 = FRONT view (facing the viewer): cells 1-4 a walking cycle (contact pose with the left foot forward, passing pose, contact pose with
  the right foot forward, passing pose; arms swing opposite to the legs), cell 5 standing idle, cell 6 SEATED (thighs forward, knees bent,
  hands resting on a table edge in front of them, no chair and no table drawn).
Row 2 = BACK view: the same six poses seen from behind.
Row 3 = SIDE view facing RIGHT: the same six poses in profile (the game mirrors it for left, so keep the costume symmetric: no one-sided
  text, logo or badge).
Row 4 = <<ROW 4 FROM THE TABLE>>.

The face, hair, costume, proportions and colours are identical in all 24 cells; only the pose changes. Natural believable walking: a
slight lean, relaxed shoulders, heel-to-toe steps. Costume details must stay readable at 60 px tall.
```

Row 4 for **guests**: `six front-view guest actions: 1 reading a menu card held in both hands, 2 raising one hand to call the
waiter, 3 seated eating (fork to the mouth), 4 seated drinking from a glass, 5 standing delighted (big smile, thumbs up), 6 standing
annoyed (arms crossed, frowning, one foot tapping)`.
Row 4 for **staff and floor crew**: `carrying: cells 1-4 a side-view (facing right) walking cycle carrying <<CARRY ITEM>> in both hands,
cell 5 standing front view carrying it, cell 6 standing side view carrying it`.
Carry items: server = a round tray with two covered plates; cashier = a paper takeaway bag; cleaner = a bucket and a mop; line cook = a
pan; prep cook = a crate of vegetables; head chef = a clipboard; manager = a tablet; specialists = a covered pot; floor server = a round
tray with a silver cloche; floor cleaner = a broom and a dustpan.

## PROMPT B: work-action sheet (first-floor staff only)

```
<STYLE LOCK>
Reference: the attached style anchor and the attached sprite sheet A of this same character (same person, same costume, same scale).
Create ONE sheet, 1536 x 512, 6 cells in one row, every cell 256 x 256, the character centred, feet on the same baseline (y = 218), same
scale as sheet A, 3/4 front view. Six work poses for <<ROLE>>: <<SIX ACTIONS FROM THE TABLE>>.
Each pose is one still frame at the most readable moment of the action, with the tool in hand (drawn, small and clean). Same face, costume
and colours as sheet A.
```

Six actions: **server** take an order (notepad and pen) / place a plate on a table / clear a plate / greet with a friendly nod / call
"order up" with a raised hand / small bow. **cashier** type at a till / hand over a takeaway bag / count banknotes / scan a receipt / greet
smiling / thumbs up. **cleaner** mop to the front / mop to the side / wipe a table with a cloth / spray a bottle / carry a bucket / polish a
rail. **line cook** stir a pot / flip a pan / chop with a knife / garnish a plate / taste from a spoon / wipe the brow. **prep cook** chop
vegetables / peel a carrot / wash in a basin / carry a crate / dice onions / wrap food in film. **head chef** taste from a spoon / point and
direct / inspect a plate / stir a big pot / proud arms crossed / wave. **manager** hold a clipboard / write / talk on a phone / read a tablet /
welcome with an open hand / arms crossed. **specialists** (same as the line cook, with the dish tool of their cuisine: wok, tandoor tray,
paella pan, comal).

## CHARACTER TABLE (fill `<<CHARACTER LINE>>`)

### P1: first-floor staff (sheet A, then B) (attach the portrait named in brackets)

| id | line |
|---|---|
| server | woman, 20s, warm medium-brown skin, curly dark hair in a high updo with a small clip, white blouse, brown vest, dark green bow tie, dark green waist apron, black trousers (server.webp) |
| cashier | young man, light-brown skin, short wavy dark hair, round wire glasses, white collared shirt with sleeves rolled up, dark green bib apron with copper buckles, dark trousers (cashier.webp) |
| cleaner | man, 40s, tan skin, short dark hair, thick dark moustache, white shirt, dark green bib apron with a cloth in the pocket, dark trousers, a small teal cap (cleaner.webp) |
| line-cook | young man, light skin, short black hair, white chef tunic with copper buttons, dark green apron, a white cook's cap (line-cook.webp) |
| prep-cook | woman, 30s, medium-brown skin, curly dark hair tied back, white chef tunic with copper buttons, rust-orange apron (prep-cook.webp) |
| head-chef | man, 60s, fair skin, white swept-back hair, white moustache, white double-breasted tunic with copper buttons, dark green apron, a tall white toque (head-chef.webp) |
| manager | woman, 40s, light-olive skin, short bobbed dark hair, round glasses, olive-green blazer over a cream blouse, dark trousers (manager.webp) |
| spec-asian | man, 30s, light skin, black hair swept back, white tunic with copper buttons, navy apron, a dark neckerchief (specialist-asian.webp) |
| spec-indian | woman, 30s, brown skin, dark hair in a bun, small gold earrings, white tunic, mustard-yellow apron (specialist-indian.webp) |
| spec-mediterranean | man, 50s, olive skin, dark hair greying at the sides, salt-and-pepper beard, white tunic, dark green apron (specialist-mediterranean.webp) |
| spec-mexican | woman, 30s, brown skin, curly dark hair, a red bandana headband, white tunic, dark green apron (specialist-mexican.webp) |

### P1: the 12 named regulars (sheet A, row 4 = guest actions; later a bust)

| id | line |
|---|---|
| mara | woman, 30s, warm light-brown skin, straight shoulder-length brown hair, cream cardigan over a light-blue blouse, jeans |
| tobias | young man, 20s, fair skin, messy sandy hair, denim jacket over a grey t-shirt, backpack strap on one shoulder, jeans |
| priya | woman, 30s, deep-brown skin, long curly black hair, teal blouse, long dark skirt, small gold earrings |
| oscar | elderly man, 70s, fair skin, white hair and a short white beard, round glasses, burgundy cardigan, grey trousers, a walking cane |
| lena | woman, 20s, fair skin, blonde hair in a high ponytail, yellow sundress, white sneakers |
| diego | man, 30s, tan skin, short dark hair and a full dark beard, rust-red flannel shirt, jeans, boots |
| yuki | woman, 20s, light skin, auburn-dyed chin-length bob, navy blazer, light blouse, grey skirt |
| amir | man, 30s, brown skin, dark curly hair, trimmed stubble, white open-collar shirt under a dark vest, beige chinos |
| rosa | elderly woman, 70s, warm skin, grey hair in a bun, floral dress, a cream shawl, a handbag |
| felix | man, 40s, fair skin, short brown hair, light-blue business shirt with a loosened tie, grey trousers, a messenger bag |
| sana | woman, 20s, light-brown skin, a dusty-pink hijab, a long cream tunic and trousers (an ordinary, elegant guest) |
| noah | boy about 8, fair skin, short brown hair, red t-shirt, blue shorts, sneakers; drawn at 70% of an adult's height |

### P2: generic guests (sheet A, row 4 = guest actions)

| id | line |
|---|---|
| office-f | woman, 30s, dark-brown skin, low bun, grey blazer and skirt, a lanyard, a tote bag |
| office-m | man, 30s, Black, short hair, navy suit, tie, a briefcase |
| student-f | young woman, 20s, East-Asian features, two dark braids, oversized hoodie, backpack |
| student-m | young man, 20s, curly dark hair, varsity jacket, headphones around the neck, jeans |
| tourist-f | woman, 40s, fair skin, a sun hat, a floral top, a camera on a strap, linen trousers |
| tourist-m | man, 50s, fair skin, a baseball cap, a Hawaiian shirt, shorts, a small backpack |
| sporty-m | man, 30s, mixed heritage, a headband, a tracksuit, a towel around the neck |
| elder-f2 | elderly woman, 70s, brown skin, short grey hair, glasses, a lilac cardigan, a walking cane |

### P3: second-floor crew (sheet A only, row 4 = carrying)

| id | line |
|---|---|
| floor-server-1 | young man, bow tie, brown vest, white shirt, black trousers, silver cloche tray (floor-server.webp) |
| floor-server-2 | woman, 20s, black hair in a ponytail, cream blouse, brown vest, bow tie, black trousers |
| floor-server-3 | woman, 30s, short curly hair, glasses, cream blouse, brown vest, bow tie |
| floor-server-4 | man, 40s, curly dark hair, short beard, white shirt, brown vest, bow tie |
| floor-cleaner-1 | woman, curly hair half up, white blouse, dark green apron, broom and dustpan (floor-cleaner.webp) |
| floor-cleaner-2 | young man, short hair, teal cap, white shirt, dark green apron, mop |
| floor-cleaner-3 | woman, 50s, hair in a bun, a patterned headscarf, dark green apron, a cleaning cloth and a spray bottle |
| floor-cleaner-4 | young man, short curly hair, headphones around the neck, dark green apron, a dustpan |

## PROMPT BUST: expression sheet for a named regular (P3)

```
<STYLE LOCK>
Reference: the attached style anchor and the attached sprite sheet A of this same person (same face, hair, skin, clothes).
Create ONE image, 1536 x 1024, 3 columns x 2 rows, every cell exactly 512 x 512, a head-and-shoulders bust of <<NAME>> centred in each
cell, the same size and position in every cell, facing the viewer, transparent background, no frame. Six expressions, the SAME face in all:
1 neutral and polite, 2 pleased (a small smile), 3 delighted (a big smile, bright eyes), 4 impatient (looking aside, tense mouth),
5 annoyed (frown, narrowed eyes), 6 chewing and enjoying (cheek slightly full, eyes closed happily).
Expressive, believable, kind faces; clear eyes, brows, nose and mouth; natural skin; the costume top as in sheet A.
```

## PROMPT PROPS: props and icons sheet (P3)

```
<STYLE LOCK>
Create ONE image, 1536 x 1024, 6 columns x 4 rows, each cell 256 x 256, one small object per cell, centred, same warm painted style, no
people, transparent background, no shadows, no text: 1 round serving tray with two covered plates (side view), 2 silver cloche on a plate,
3 white plate of pasta, 4 bowl of soup, 5 glass of water, 6 coffee cup, 7 paper takeaway bag with a handle, 8 mop and a bucket, 9 broom and
dustpan, 10 spray bottle and cloth, 11 clipboard, 12 receipt slip, 13 menu card, 14 gold coin, 15 red heart, 16 grey anger cloud, 17 clock, 18 red
exclamation mark, 19 blue question mark, 20 empty speech bubble, 21 empty thought bubble, 22 golden star, 23 thumbs-up badge, 24 wine glass.
```

## Checklist

- [ ] Prompt 0 style anchor accepted
- [ ] P1 staff A (11)   - [ ] P1 regulars A (12)
- [ ] P2 staff B (11)   - [ ] P2 generic guests (8)
- [ ] P3 floor crew (8) - [ ] P3 busts (12) - [ ] P3 props (1)
