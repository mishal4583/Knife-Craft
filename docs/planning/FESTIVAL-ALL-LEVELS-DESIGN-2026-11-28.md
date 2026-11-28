# The 45 festival levels (developer 2026-11-28: "design for all the levels and build")

Written by `scripts/make-festival-design.mts` from the game's data (do not edit by hand; change `src/game/festival/` and run it again).

## One kitchen shape
Every festival has the same fifteen places, so the sorted stall, the stage ramp and the fairness proof hold for all of them: a **base**, three
**mains** (cooked on the hot station), five **toppings**, two **sauces**, one **side** (the second cooker) and three **drinks**. A food keeps its
place at every stage; what a stage has not got waits there, locked. Burger keeps exactly the rounds it had. A new festival starts further down its
menu (its food is new, the player is not). Toppings go on after cooking, except **Pizza**, which has its own step: the oven.

**Difficulty:** the ramp is the one in `tiers.ts` (unchanged). The simulated player (festival-rival-qa E5) wins all 45 levels at one tap every
0.8 s (98-100 %). At one tap every 1.2 s it wins the early festivals every time, but from about the ninth festival the second and third stages are
mostly lost: **play the late festivals on a real phone and say if they are too fast.** Unlocks: Burger at Level 10; each next festival after the
third stage of the one before and 10 more services.

## 1. 🍔 Burger Festival

Start with the bun; cook Patty, Chicken, Veggie on the grill and lay one on it; add the cold toppings and sauces; tap the finished burger to serve.
Side: Fries (fryer). Drinks: Cola, Lemonade, Shake. Later stages may ask for a second patty.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Dolly Ray (Sunny Side Diner) | 5 | 2 | 2 | 32 s | Bun, Patty, Cheese, Lettuce, Fries, Cola |
| 2 | Nils Haugen (Harbor Grill) | 8 | 3 | 3 | 36 s | + Chicken, Tomato, Onion, Ketchup, Lemonade |
| 3 | Walt Ferris (The Rustic Table) | 11 | 3 | 4 | 36 s | + Veggie, Pickles, Mustard, Shake |

## 2. 🍕 Pizza Festival

**Put everything on the raw dough, bake the whole pizza in the oven, take it out and it is served.**
Side: Wings (fryer). Drinks: Cola, Lemonade, Limonata. Every pizza has one of Tomato sauce, Pesto and one of Mozzarella (once on the menu).

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Ines Alvarado (Mama's Kitchen) | 6 | 3 | 3 | 31 s | Dough, Pepperoni, Mozzarella, Olives, Peppers, Tomato sauce, Wings, Cola |
| 2 | Selene Kallas (Olive & Fig) | 9 | 3 | 3 | 36 s | + Mushroom, Onion, Lemonade, Limonata |
| 3 | Luigi Bianchi (Luigi's Trattoria) | 12 | 3 | 4 | 36 s | + Ham, Basil, Pesto |

## 3. 🥪 Sandwich Festival

Start with the toast; cook Chicken, Bacon, Egg on the griddle and lay one on it; add the cold toppings and sauces; tap the finished sandwich to serve.
Side: Crisps (fryer). Drinks: Iced tea, Orange, Smoothie. Later stages may ask for a second chicken.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Bea Marlow (Corner Toast Co.) | 7 | 3 | 3 | 36 s | Toast, Chicken, Cheese, Lettuce, Tomato, Mayo, Crisps, Iced tea |
| 2 | Etienne Roux (The Copper Pan) | 10 | 3 | 3 | 36 s | + Bacon, Cucumber, Orange, Smoothie |
| 3 | Wren Holloway (Maple & Sage) | 13 | 3 | 4 | 36 s | + Egg, Pickles, Mustard |

## 4. 🥞 Breakfast Festival

Start with the plate; cook Pancake, Waffle, French toast on the griddle and lay one on it; add the cold toppings and sauces; tap the finished breakfast to serve.
Side: Hash browns (fryer). Drinks: Coffee, Orange, Milk. Later stages may ask for a second pancake.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Maya Osei (Bean There Café) | 8 | 3 | 3 | 36 s | Plate, Pancake, Butter, Berries, Banana, Syrup, Hash browns, Coffee |
| 2 | Hugo Brandt (The Soup Pot) | 11 | 3 | 3 | 35 s | + Waffle, Blueberry, Orange, Milk |
| 3 | Odile Fontaine (Le Petit Jardin) | 14 | 3 | 4 | 35 s | + French toast, Cream, Chocolate |

## 5. 🌮 Street Food Festival

Start with the flatbread; cook Shawarma, Kofta, Halloumi on the grill and lay one on it; add the cold toppings and sauces; tap the finished wrap to serve.
Side: Falafel (fryer). Drinks: Ayran, Mint, Tamarind. Later stages may ask for a second shawarma.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Dario Haddad (The Pita Pocket) | 9 | 3 | 4 | 36 s | Flatbread, Shawarma, Cabbage, Lettuce, Tomato, Tahini, Falafel, Ayran |
| 2 | Rosa Cruz (Taco Hut) | 12 | 3 | 4 | 44 s | + Kofta, Cucumber, Mint, Tamarind |
| 3 | Samir Haddad (The Spice Route) | 15 | 4 | 4 | 44 s | + Halloumi, Pickles, Chilli |

## 6. 🍜 Asian Food Festival

Start with the rice bowl; cook Teriyaki, Prawns, Tofu on the wok and lay one on it; add the cold toppings and sauces; tap the finished bowl to serve.
Side: Spring rolls (fryer). Drinks: Green tea, Lychee, Boba.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Ken Ito (Noodle Nook) | 10 | 3 | 4 | 36 s | Rice bowl, Teriyaki, Scallion, Carrot, Edamame, Soy, Spring rolls, Green tea |
| 2 | Jun Wei (Wok 'n' Roll) | 13 | 3 | 4 | 43 s | + Prawns, Cucumber, Lychee, Boba |
| 3 | Lian Zhou (Jade Dragon) | 16 | 4 | 4 | 43 s | + Tofu, Kimchi, Sriracha |

## 7. 🥗 Healthy Food Festival

Start with the greens; cook Chicken, Salmon, Tofu on the grill and lay one on it; add the cold toppings and sauces; tap the finished salad to serve.
Side: Sweet fries (fryer). Drinks: Water, Orange, Green.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Luca Verde (Salad Days) | 11 | 3 | 4 | 35 s | Greens, Chicken, Feta, Avocado, Tomato, Lemon, Sweet fries, Water |
| 2 | Tess Alder (The Green Fork) | 14 | 3 | 4 | 42 s | + Salmon, Cucumber, Orange, Green |
| 3 | Nikos Pappas (Aegean Blue) | 17 | 4 | 4 | 42 s | + Tofu, Corn, Yogurt |

## 8. 🍖 BBQ Festival

Start with the platter; cook Sausage, Ribs, Steak on the smoker and lay one on it; add the cold toppings and sauces; tap the finished platter to serve.
Side: Wedges (fryer). Drinks: Iced tea, Lemonade, Root beer. Later stages may ask for a second sausage.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Min-jun Park (Seoul Food) | 12 | 3 | 4 | 44 s | Platter, Sausage, Slaw, Beans, Corn, BBQ, Wedges, Iced tea |
| 2 | Rurik Dane (Hearth & Ember) | 15 | 4 | 4 | 41 s | + Ribs, Onion, Lemonade, Root beer |
| 3 | Brock Anders (The Iron Skillet) | 18 | 4 | 4 | 41 s | + Steak, Pickles, Hot |

## 9. 🍝 Pasta Festival

Start with the bowl; cook Spaghetti, Penne, Ravioli on the pot and lay one on it; add the cold toppings and sauces; tap the finished pasta to serve.
Side: Garlic bread (toaster). Drinks: Water, Lemonade, Grape. Every pasta has one of Marinara, Pesto, Alfredo (once on the menu).

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Claire Duval (The Little Bistro) | 13 | 3 | 4 | 43 s | Bowl, Spaghetti, Marinara, Parmesan, Mushroom, Pesto, Garlic bread, Water |
| 2 | Gianni Moro (Pasta Fresca) | 16 | 4 | 4 | 40 s | + Penne, Meatballs, Lemonade, Grape |
| 3 | Sofia Rinaldi (Trattoria del Sole) | 19 | 4 | 4 | 40 s | + Ravioli, Basil, Alfredo |

## 10. 🦐 Seafood Festival

Start with the rice plate; cook Salmon, Prawns, White fish on the grill and lay one on it; add the cold toppings and sauces; tap the finished plate to serve.
Side: Calamari (fryer). Drinks: Lemonade, Iced tea, Coconut.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Tom Marlin (The Blue Anchor) | 14 | 3 | 4 | 42 s | Rice plate, Salmon, Lemon, Lettuce, Tomato, Tartar, Calamari, Lemonade |
| 2 | Haru Tanaka (Zen Garden) | 17 | 4 | 4 | 39 s | + Prawns, Corn, Iced tea, Coconut |
| 3 | Marin Cole (Cedar & Salt) | 20 | 4 | 4 | 39 s | + White fish, Olives, Garlic butter |

## 11. 🥐 Bakery Festival

Start with the cake plate; cook Muffin, Croissant, Cinnamon roll on the oven and lay one on it; add the cold toppings and sauces; tap the finished treat to serve.
Side: Cookies (racks). Drinks: Coffee, Cocoa, Milk.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Ivy Calder (The Orchard Room) | 15 | 3 | 4 | 41 s | Cake plate, Muffin, Icing, Berries, Choc chips, Chocolate, Cookies, Coffee |
| 2 | Sven Lund (Silver Birch) | 18 | 4 | 4 | 38 s | + Croissant, Almonds, Cocoa, Milk |
| 3 | Margaux Lenoir (Chez Margaux) | 21 | 4 | 4 | 38 s | + Cinnamon roll, Sprinkles, Caramel |

## 12. 🥘 Indian Street Food

Start with the thali; cook Dosa, Paratha, Paneer on the tawa and lay one on it; add the cold toppings and sauces; tap the finished plate to serve.
Side: Samosa (fryer). Drinks: Chai, Nimbu, Lassi.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Arjun Rao (Curry Corner) | 16 | 4 | 4 | 40 s | Thali, Dosa, Masala, Onion, Tomato, Mint, Samosa, Chai |
| 2 | Priya Nair (Saffron House) | 19 | 4 | 4 | 37 s | + Paratha, Coriander, Nimbu, Lassi |
| 3 | Kavya Menon (Marigold) | 22 | 4 | 4 | 37 s | + Paneer, Curd, Tamarind |

## 13. 🌯 Mexican Festival

Start with the tortilla; cook Carne asada, Chicken, Fajita veg on the grill and lay one on it; add the cold toppings and sauces; tap the finished taco to serve.
Side: Nachos (fryer). Drinks: Horchata, Lime soda, Fresca. Later stages may ask for a second carne asada.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Nok Siri (Bangkok Bowl) | 17 | 4 | 4 | 39 s | Tortilla, Carne asada, Cheese, Lettuce, Salsa, Sour cream, Nachos, Horchata |
| 2 | Elena Ruiz (Casa Verde) | 20 | 4 | 4 | 37 s | + Chicken, Guacamole, Lime soda, Fresca |
| 3 | Mateo Salas (La Cantina Real) | 23 | 4 | 4 | 37 s | + Fajita veg, Jalapeño, Hot |

## 14. 🍽️ Gourmet Festival

Start with the fine plate; cook Steak, Salmon, Scallops on the pan and lay one on it; add the cold toppings and sauces; tap the finished course to serve.
Side: Truffle fries (fryer). Drinks: Water, Grape, Coffee.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Victor Alaric (The Velvet Spoon) | 18 | 4 | 4 | 38 s | Fine plate, Steak, Mash, Asparagus, Mushroom, Jus, Truffle fries, Water |
| 2 | Augustin Pell (The Grand Larder) | 21 | 4 | 4 | 37 s | + Salmon, Tomatoes, Grape, Coffee |
| 3 | Freya Nystrom (Aurora) | 24 | 4 | 4 | 37 s | + Scallops, Greens, Garlic butter |

## 15. 🏆 World Championship

Start with the gold plate; cook Wagyu, Lobster, Glazed chicken on the grill and lay one on it; add the cold toppings and sauces; tap the finished plate to serve.
Side: Golden fries (fryer). Drinks: Water, Lemonade, Shake.

| Stage | Rival | Customers | At once | Burners and plates | Patience | On the counter |
|---|---|---:|---:|---:|---:|---|
| 1 | Takeshi Mori (Kaiseki Mori) | 19 | 4 | 4 | 37 s | Gold plate, Wagyu, Mash, Asparagus, Mushroom, Jus, Golden fries, Water |
| 2 | Reginald Ashby (The Crown Kitchen) | 22 | 4 | 4 | 37 s | + Lobster, Tomatoes, Lemonade, Shake |
| 3 | Amelie Laurent (Maison Lumière) | 25 | 4 | 4 | 37 s | + Glazed chicken, Greens, Gold glaze |
