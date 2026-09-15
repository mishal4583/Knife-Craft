# KNIFECRAFT — SOURCE MAP
**Authoritative source: `knifecraft.html` (11301 lines, single file, no build step).**
Line numbers are anchors at freeze time. Always `grep` for the named symbol — never trust a number after an edit.

## Global architecture anchors
| Item | Symbol | Line |
|---|---|---|
| Root config object | `const CONFIG` | 336 |
| Ingredient profiles | `CONFIG.INGREDIENTS` | 346 |
| Recipe list (71) | `CONFIG.recipes.RECIPES` | 1412 |
| Real-world sizes | `const REAL_CM` | 3506 |
| Scale constants | `PX_PER_CM / SIZE_REF_CM / SIZE_GAMMA` | 3526 |
| Silhouette families | `const SILS` | 3124 |
| Base paint table | `const PAINT` | 5883 |
| Skin (shell) paint table | `const SKIN` | 8396 |
| Permanent-skin set | `const SKIN_KEEP` | 5641 |
| Wall-to-wall skin set | `const SKIN_WHOLE` | 5645 |
| Peel shred colours | `const PEEL_TONE` | 5646 |
| Peelability (derived) | `const peelable` | 5649 |
| Shell opacity — single source of truth | `skinAlpha(id)` | 5679 |
| Peel step start | `peelStart()` | 5652 |
| Peel rub accumulator | `peelRub(prev,p)` | 5658 |
| Peel overlay + flecks | `drawPeel(gnow)` | 4732 |
| Fillet family (proteins) | `SILS.fillet` | 3370 |
| Protein thickness wall | `drawDepthWall` | 5417 |
| Protein piece fan-out | `spreadPieces()` | 4230 |
| Per-piece cut-edge shading | `shadeCutEdges()` | 5027 |
| Board quad (perspective) | `boardQuad()` | 4894 |
| Test/QA hooks | `window.__kcTest` | 9489 |

## Shape families (`SILS`)
| Family | Line | Used by |
|---|---|---|
| `ellipse` | 3129 | tomato, lemon, peach, cabbage, watermelon, mango, kiwi, pomegranate, coconut, fennel, pumpkin, turnip |
| `capsule` | 3176 | cucumber, baguette, pineapple |
| `taper` | 3190 | carrot, avocado, eggplant, pear, corn, celery, mozzarella, radish, beetroot, sweetpotato, peapod |
| `cluster` | 3232 | basil, parsley, broccoli, lettuce, cauliflower, spinach, asparagus, greenbean, grapes, artichoke |
| `wedge` | 3266 | — |
| `block` | 3299 | cheddar, butter, tofu |
| `fillet` | 3370 | chicken, steak, salmon |
| `ellipse` (default, no `shape:` key) | 3129 | — |

## Story layer
| Item | Symbol | Line |
|---|---|---|
| Story IIFE storage keys | `const KEY` | 10774 |
| Story art table (7 SVGs) | `const ART` | 10778 |
| Grandparent bedside scene | `ART.bedside` | 10779 |
| Key prop | `ART.keys` | 10843 |
| Chef portrait (bust) | `ART.chef` | 10858 |
| Player portrait | `ART.you` | 10889 |
| Dining room (finale) | `ART.dining` | 10901 |
| Cutting-board card | `ART.board` | 10923 |
| Knife card | `ART.knife` | 10932 |
| Opening beats (4) | `const OPENING` | 10944 |
| Fresh-start beats (4) | `const FRESH` | 10957 |
| Chef beats (5) | `const CHEF` | 10969 |
| Finale beats (4) | `const FINALE` | 10977 |
| Milestones (4) | `const MILES` | 10997 |
| Purchase cards | `const CARDS` | 11005 |
| Real-ingredient card paint | `paintIng(cv)` | 11011 |
| Dialogue markup | `dlgHTML(d)` | 11030 |
| Milestone banner | `banner(kicker,line,ms)` | 11139 |
| New game / full opening | `newGame()` | 11148 |
| Chapter list | `const CH` | 11157 |
| Boot decision | `boot()` | 11186 |
| **Milestone + finale gate** | `flush()` | 11197 |
| Story state report | `report()` | 11212 |
| Plate counter the story reads | `Save.played()` | 1914 |

## Per-ingredient source map
`profile` = record in `CONFIG.INGREDIENTS`; `paint` = `PAINT[id]`; `skin` = `SKIN[id]` (blank = no shell).

| Ingredient | id | profile | paint | skin |
|---|---|---|---|---|
| Tomato | `tomato` | 347 | 5884 | — |
| Cucumber | `cucumber` | 362 | 5911 | — |
| Carrot | `carrot` | 378 | 5938 | — |
| Basil | `basil` | 398 | 5963 | — |
| Parsley | `parsley` | 431 | 6017 | — |
| Lemon | `lemon` | 479 | 6071 | — |
| Avocado | `avocado` | 500 | 6120 | — |
| Eggplant | `eggplant` | 518 | 6195 | — |
| Cheddar | `cheddar` | 536 | 6248 | — |
| Baguette | `baguette` | 556 | 6309 | — |
| Broccoli | `broccoli` | 579 | 7981 | — |
| Pear | `pear` | 624 | 6354 | — |
| Peach | `peach` | 643 | 6417 | — |
| Corn | `corn` | 665 | 6518 | — |
| Celery | `celery` | 686 | 6576 | — |
| Mozzarella | `mozzarella` | 707 | 6705 | — |
| Butter | `butter` | 731 | 6802 | — |
| Tofu | `tofu` | 749 | 6840 | — |
| Lettuce | `lettuce` | 770 | 6880 | — |
| Cabbage | `cabbage` | 807 | 6942 | — |
| Cauliflower | `cauliflower` | 826 | 7035 | — |
| Spinach | `spinach` | 868 | 7114 | — |
| Pineapple | `pineapple` | 908 | 7198 | 9026 |
| Asparagus | `asparagus` | 931 | 7240 | — |
| Radish | `radish` | 961 | 7307 | — |
| Beetroot | `beetroot` | 987 | 7374 | 8763 |
| Sweet Potato | `sweetpotato` | 1009 | 7404 | 8729 |
| Watermelon | `watermelon` | 1032 | — | 8684 |
| Mango | `mango` | 1053 | 7452 | 8633 |
| Kiwi | `kiwi` | 1075 | 7490 | 8593 |
| Pomegranate | `pomegranate` | 1095 | 7563 | 8532 |
| Green Bean | `greenbean` | 1122 | 7652 | — |
| Grapes | `grapes` | 1152 | 7699 | — |
| Coconut | `coconut` | 1178 | 7725 | 8825 |
| Fennel | `fennel` | 1197 | 7753 | 8872 |
| Artichoke | `artichoke` | 1220 | 7784 | — |
| Pea Pod | `peapod` | 1252 | 7851 | 8973 |
| Pumpkin | `pumpkin` | 1274 | 7893 | — |
| Turnip | `turnip` | 1295 | 7976 | 8401 |
| Chicken Breast | `chicken` | 1317 | 8061 | — |
| Ribeye Steak | `steak` | 1353 | 8179 | — |
| Salmon Fillet | `salmon` | 1380 | 8318 | — |
