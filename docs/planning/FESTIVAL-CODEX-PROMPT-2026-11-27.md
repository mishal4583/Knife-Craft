# Festival competition: Codex prompt for the fixes and the Burger kit (2026-11-27)

**DELIVERED AND INTEGRATED 2026-11-27.** One miss: `station_fry_basket_golden.png` came without the handle (the game makes the golden basket from the raw one instead).

Paste everything in the block into Codex. It asks only for what the Burger Festival needs, plus 16 broken files. The other festivals' kits come after the Burger round has been played.

The 26 wrongly named dishes are **not** in this prompt: they only need renaming, which Claude does. Do not ask Codex to rename them.

```
KnifeCraft Festival: repairs and the BURGER FESTIVAL GAMEPLAY KIT.
Art only. Do not touch game code. Do not rename, move or delete any existing file.
Folder: D:\WORKS\GAMES\Knife Craft\Festival competition assets
STYLE: the same glossy 3D cartoon style as the existing assets and reference/burger_festival_reference.png.

RULES FOR EVERY FILE (earlier batches broke these; check each one):
1. Generate ONE picture per file. NEVER cut a file out of a grid or sheet.
2. After saving a file, open it and confirm the picture is what the file name says. If not, regenerate it.
3. Except backgrounds: PNG with a real transparent background. Every pixel within 16 px of the canvas edge must be fully transparent.
   No white or grey haze, no glow filling the canvas.
4. One object (plus a small soft contact shadow). No pieces of other pictures, no stray marks.
5. The whole object inside the canvas, filling about 80% of it.
6. No text, letters, numbers or logos.

CAMERA FOR THE KITCHEN KIT (parts B, C, D): every station, tray, plate and cooking food is seen from the SAME camera:
looking down at about 50 degrees, straight from the front (never turned left or right), soft light from the top left.
Pieces that sit inside another piece (a patty on the grill) must match its angle and scale.

A) REPAIR: regenerate these 16 files in 00_shared/ingredients with the same names (512x512), following rules 1-6
(each now has a grey-white haze over the whole canvas):
ingredient_basil_sprig, ingredient_bell_pepper_strips, ingredient_black_beans_bowl, ingredient_black_olive_rings,
ingredient_grilled_chicken_strips, ingredient_guacamole_bowl, ingredient_mozzarella, ingredient_mushroom_slices,
ingredient_nacho_chips, ingredient_pepperoni_slices, ingredient_pizza_dough, ingredient_salsa_bowl,
ingredient_sweetcorn, ingredient_taco_shell, ingredient_tomato_sauce_bowl, ingredient_tortilla

B) EMPTY STATIONS, into 01_burger_festival/equipment (1024x1024). NO food, NO smoke, NO steam in them:
station_grill_empty.png          flat grill, 4 clear round cooking places in a 2 x 2 grid, evenly spaced
station_fryer_empty.png          deep fryer with golden oil, no basket in it
station_fry_basket_empty.png     the basket for that fryer
station_fry_basket_raw.png       the SAME basket, same position and size, filled with pale raw fries
station_fry_basket_golden.png    the SAME basket with golden fries
station_fry_basket_burnt.png     the SAME basket with dark burnt fries
station_drink_dispenser.png      two taps (cola brown, lemonade yellow shown by colour only), an empty cup place under each
station_assembly_board.png       empty wooden board
station_serving_plate.png        one empty round plate
station_trash_bin.png            small kitchen bin with its lid open

C) FILLED TRAYS (the things the player taps), into 01_burger_festival/trays (768x768). All steel trays the SAME size and shape:
tray_buns.png, tray_patty_raw.png (RAW pink patties), tray_chicken_raw.png, tray_veggie_patty_raw.png, tray_fries_raw.png,
tray_lettuce.png, tray_tomato.png, tray_onion.png, tray_cheese.png, tray_pickles.png,
bottle_ketchup.png, bottle_mustard.png (squeeze bottles)

D) FOOD STATES, into 01_burger_festival/food (512x512). Within each group the SAME shape, size, angle and position:
patty_raw.png (pink, raw), patty_cooking.png (half browned), patty_cooked.png, patty_burnt.png (black, charred)
chicken_raw.png, chicken_cooking.png, chicken_cooked.png, chicken_burnt.png
veggie_patty_raw.png, veggie_patty_cooking.png, veggie_patty_cooked.png, veggie_patty_burnt.png
fries_box_empty.png, fries_box_full.png
cup_empty.png, cup_cola.png (full, with straw), cup_lemonade.png (full, with straw)

E) BURGER LAYER KIT, into 01_burger_festival/ingredients (each canvas exactly 512x512). The game stacks these pictures to build
any burger, so they must line up:
- seen from the front, slightly from above, ALL at the same angle;
- every layer is centred left-to-right and has the same width, about 400 px;
- every layer is centred top-to-bottom in its own canvas;
- each file shows ONLY that one layer.
layer_bun_bottom, layer_patty, layer_chicken, layer_veggie_patty, layer_cheese (slightly draped), layer_lettuce,
layer_tomato, layer_onion, layer_pickles, layer_ketchup, layer_mustard, layer_bun_top
Then make previews/burger_stack_test.png: stack bottom bun, patty, cheese, tomato, lettuce, ketchup, top bun by moving each
layer up by a fixed step, and check that it looks like one real burger. Adjust the layers until it does.

F) UPRIGHT BACKGROUND: 01_burger_festival/background/background_burger_festival_portrait.png, exactly 1080x1920, opaque.
The same festival as the existing landscape background. Top 12%: sky and string lights only (the score bar goes there).
12% to 45%: stalls and crowd, with a calm middle where three customers will stand. At about 45%: the front edge of the
wooden counter. Below it: a plain wooden counter top to the bottom, with nothing on it. No signs with text.

G) TWO MORE CUSTOMERS WITH MOODS, into 00_shared/customers (768x768). For customer_teen_girl and customer_family_dad,
use the existing picture as the identity reference. Make 4 files each: _happy, _waiting, _impatient, _excited.
It must be THE SAME PERSON in all four and as in the reference: same face, hair, glasses and clothes. Head and shoulders to
the waist, nothing cut at the top or sides, same scale in all files.

H) SMALL ICONS, into 00_shared/ui_icons (256x256):
ui_heart_full, ui_heart_empty, ui_trash, ui_ready_bell, ui_burnt_warning, ui_lock, ui_info, ui_close, ui_sound_on, ui_sound_off

FINISH:
1. Write and run a script that checks every new file: exact size; for transparent files, the 16 px edge band is fully transparent;
   only one main object (no separate pieces touching the edges).
2. Make previews/burger_kit_labelled.png: every new picture with its file name under it, on a dark checkerboard.
   Look at it and fix any picture that does not match its name.
3. Report the files made, the check results, and anything you could not do. Do not claim a file exists if it does not.
```
