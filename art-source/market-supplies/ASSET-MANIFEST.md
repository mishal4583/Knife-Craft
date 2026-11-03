# Market supplies art set

Source PNG atlases for replacing the supply emojis in Market, Inventory, Cleaning, and the Second Floor team. Style matches the current warm, polished KnifeCraft illustration system and existing staff portraits. The PNGs are source art, not yet cropped, optimized, or wired into the app.

Each atlas is a 4 × 3 grid, read left-to-right then top-to-bottom. The last atlas has two populated cells and ten empty cells. The 62 item order below matches `SUPPLY_CATALOG` in `src/game/business/businessSupplies.ts`.

## Cell mapping

### S1 — `S1-culinary-tools.png`

1. stock-pot — Stock pot  
2. saucepans — Saucepan  
3. frying-pans — Fry pan  
4. saute-pans — Sauté pan  
5. tongs — Utility tongs  
6. spatulas — High-heat turner  
7. ladles — Ladle  
8. whisks — Piano whisk  
9. peelers — Vegetable peeler  
10. graters — Box grater  
11. skimmers — Fine mesh skimmers  
12. sheet-pans — Sheet pan  

### S2 — `S2-culinary-tableware.png`

1. mixing-bowls — Mixing bowl  
2. storage-containers — Lidded storage container  
3. measuring-cups — Measuring cup set  
4. kitchen-scales — Digital portion scale  
5. thermometers — Probe thermometer  
6. oven-mitts — Oven mitts  
7. dinner-forks — Dinner fork  
8. dessert-forks — Salad / dessert fork  
9. dinner-knives — Dinner knife  
10. steak-knives — Serrated steak knife  
11. teaspoons — Teaspoon  
12. soup-spoons — Soup spoon  

### S3 — `S3-tableware-packaging.png`

1. dinner-plates — Dinner plate  
2. side-plates — Side plate  
3. soup-bowls — Soup / pasta bowl  
4. dessert-plates — Dessert plate  
5. water-glasses — Water tumbler  
6. highball-glasses — Highball glass  
7. coffee-tea-set — Coffee cup and saucer  
8. water-jugs — Water pitcher  
9. salt-pepper — Salt and pepper shakers  
10. napkin-holders — Napkin dispenser  
11. menu-stands — Blank menu/card holder  
12. microwave-containers — Lidded microwave-safe container  

### S4 — `S4-packaging.png`

1. foil-containers — Foil meal container  
2. thali-containers — Three-compartment thali tray  
3. kraft-boxes — Kraft takeout box  
4. burger-boxes — Burger clamshell  
5. food-wrap — Deli wrap sheet  
6. deli-sheets — Stack of kraft deli sheets  
7. paper-bags — Handled kraft paper bag  
8. carry-bags — Plastic carry-out bag  
9. tissues — Tissue cube  
10. paper-napkins — Folded paper napkins  
11. wet-wipes — Moist towelette sachet  
12. cutlery-packs — Wrapped cutlery kit  

### S5 — `S5-cleaning.png`

1. toothpicks — Wrapped toothpicks  
2. tamper-labels — Tamper-evident labels  
3. dish-soap — Dish soap bottle  
4. cleaning-liquid — All-purpose cleaner bottle  
5. floor-cleaner — Floor-cleaner jug  
6. disinfectant — Disinfectant spray bottle  
7. hand-soap — Hand-soap pump refill  
8. toilet-paper — Jumbo toilet-paper roll  
9. paper-towels — Folded paper hand towels  
10. sponges-cloths — Microfiber cloths  
11. bin-liners — Bin-liner roll  
12. mop-bucket — Mop bucket and wringer  

### S6 — `S6-cleaning-tools.png`

1. brooms — Lobby broom and dustpan  
2. toilet-brushes — Toilet brush and caddy  
3–12. Empty  

## Separate portraits

- `../staff/floor-server.png` — waiter/server in a service uniform carrying a tray (not a chef)
- `../staff/floor-cleaner.png` — cleaner in a housekeeping apron with broom and dustpan

## Ingredient corrections

The existing A7–A11 sheets contain the full ingredient set. Two individual source sprites correct details from the original prompts:

- `../fridge-sort/ingredient-green-chili.png` — green chili, replacing the original red chili prompt
- `../fridge-sort/ingredient-chicken-breast.png` — raw chicken breast, replacing the original chicken-leg prompt

The other listed ingredient mismatches are represented by distinct items in A7–A11: separate zucchini/celery/asparagus/fennel/artichoke, cauliflower, radish/beetroot/turnip, pomegranate, tofu, lime, scallion, green beans, herb bunches, mushroom, pumpkin, salmon fillet, and separate cheddar wedge / mozzarella ball.

## Remaining art integration

Crop atlases by exact cell coordinates, clean residual low-alpha background haze where needed, export individual WebP icons, and map each `SupplyId` / `IngredientId` to its sprite. Resize and optimize portraits to the app's 320 × 320 portrait convention. Keep these source PNGs out of runtime bundles.
