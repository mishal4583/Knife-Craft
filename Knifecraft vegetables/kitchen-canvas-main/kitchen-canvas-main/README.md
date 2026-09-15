# Kitchen Canvas

PROJECT: KnifeCraft Ingredient Laboratory

IMPORTANT CONTEXT

This is NOT the production KnifeCraft game.

This is a standalone ingredient visual/geometry laboratory used to develop and test the food system that will later be ported into the real KnifeCraft project.

The production game is a TypeScript/React-based project with an existing cutting/geometry system.

We already have a proven procedural ingredient approach from an earlier KnifeCraft prototype:

PROCEDURAL INGREDIENT

        ↓

CACHED CANVAS SPRITE

        ↓

CLIPPED BY CUT GEOMETRY

        ↓

INDIVIDUAL CUT PIECES

DO NOT replace this with ordinary static ingredient images.

The purpose of this project is to create a reusable procedural ingredient system and visually test new food types before integrating them into the production game.

==================================================

1. TECHNOLOGY

==================================================

Use:

- React

- TypeScript

- HTML Canvas

- Vite

- CSS

Do NOT use:

- Python

- Phaser

- Unity

- Three.js

- external image-generation APIs

- WebP ingredient sprites as gameplay silhouettes

Keep the implementation clean and modular so the useful parts can later be ported into another TypeScript project.

==================================================

2. CORE ARCHITECTURE

==================================================

Create a reusable IngredientDefinition structure.

Conceptually:

IngredientDefinition {

    id

    name

    category

    geometry

    paint

    techniques

    colors

    seamColors

    texture/detail settings

}

The important separation is:

GEOMETRY

    defines the gameplay silhouette

PAINT

    defines how the ingredient visually looks

CUTTING

    clips the painted ingredient using geometry

Do NOT bake gameplay geometry into painted pixels.

==================================================

3. PROCEDURAL RENDERING

==================================================

Each ingredient should be rendered procedurally into a cached high-resolution canvas.

Use supersampling for visual quality.

The cached ingredient rendering should contain:

- outer skin/surface

- inner flesh where applicable

- highlights

- subtle texture

- veins/segments/stems where appropriate

When a cut occurs, DO NOT create a new ingredient image.

Instead:

1. render the complete ingredient

2. create the cut-piece geometry

3. clip the cached ingredient rendering

4. render the resulting piece

This ensures that cut faces automatically expose the correct interior.

==================================================

4. SILHOUETTE SYSTEM

==================================================

Support both:

A. SINGLE-BODY INGREDIENTS

Examples:

Tomato

Lemon

Eggplant

Cheddar

Baguette

B. CLUSTER INGREDIENTS

Examples:

Basil

Parsley

Broccoli

The cluster system must support:

- multiple disconnected lobes

- gaps

- overlapping parts

- different part sizes

- stems

- irregular positioning

Do NOT make every ingredient one large blob.

==================================================

5. COMPATIBILITY

==================================================

Use an additive architecture.

Existing single-body geometry should remain simple.

Do not force every ingredient into cluster geometry.

Create reusable primitives such as:

ellipse

capsule

rounded polygon

irregular oval

cluster

stem

ring

wedge

Build ingredients from combinations of these primitives.

==================================================

6. CURRENT REFERENCE INGREDIENTS

==================================================

The following already exist conceptually and should be treated as visual references:

Tomato

Cucumber

Carrot

Onion

Potato

Garlic

Basil

Parsley

Basil and Parsley have already established the cluster-ingredient direction.

DO NOT redesign them unless needed for compatibility.

==================================================

7. NEW INGREDIENTS

==================================================

Implement these six:

1. Lemon

2. Avocado

3. Eggplant

4. Cheddar

5. Baguette

6. Broccoli

==================================================

8. LEMON

==================================================

Create a highly recognizable procedural lemon.

Appearance:

- warm yellow peel

- slightly irregular oval body

- subtle pores

- darker outer rind

- pale yellow interior

- visible citrus segments

- central pith/core

- subtle highlight

The interior must be part of the procedural rendering.

It must look like a lemon even without text.

Add:

Slice

Radial

testing controls.

Radial cut results must expose believable citrus segments.

==================================================

9. AVOCADO

==================================================

Create:

- pear-like body

- dark green skin

- light green flesh

- large central pit

- subtle flesh variation

- natural asymmetry

The pit should be represented by actual geometry where appropriate, not simply painted decoration.

Test:

Halve

The result should clearly show:

dark skin

green flesh

central pit

==================================================

10. EGGPLANT

==================================================

Create:

- elongated curved body

- deep purple skin

- subtle highlight

- green calyx

- pale cream interior

- natural asymmetry

It must NOT look like a purple cucumber.

Use a distinct elongated organic silhouette.

Test compatible cutting behavior.

==================================================

11. CHEDDAR

==================================================

Create a procedural cheese block.

Appearance:

- warm orange/yellow cheese

- solid rectangular/block form

- slightly irregular edges

- subtle surface texture

- lighter cut face

- small natural imperfections

It should feel dense and solid.

Do NOT make it look like a vegetable.

Test:

Slice

==================================================

12. BAGUETTE

==================================================

Create:

- elongated loaf

- golden brown crust

- darker baked edges

- pale interior crumb

- realistic scored top

- subtle crumb texture

The crust and crumb must be separate visual regions.

When sliced:

the cut face must show pale crumb.

Do not simply clip the brown exterior color.

Test:

Slice

==================================================

13. BROCCOLI

==================================================

Broccoli is the most important cluster test.

Build it from:

- central stalk

- branching stems

- multiple florets

- irregular floret sizes

- overlapping florets

- natural gaps

Florets should NOT be perfect circles.

Avoid:

- green cloud

- repeated balls

- cauliflower-like blob

- parsley-like leaves

The stalk should be visibly different from the floret crown.

Use the cluster primitive.

If necessary, extend the cluster primitive minimally to support a stem + crown structure.

Do NOT create a separate broccoli engine.

==================================================

14. CUTTING DEMONSTRATION

==================================================

Create a simple testing UI.

Left side:

Ingredient selector.

Show:

Lemon

Avocado

Eggplant

Cheddar

Baguette

Broccoli

Center:

large cutting board.

Display the selected ingredient.

Controls:

[Reset]

[Slice]

[Dice if supported]

[Halve]

[Radial]

[Chop]

[Chiffonade]

Only enable techniques that make sense for the selected ingredient.

Allow the user to draw/click simulated cut lines.

The purpose is to visually inspect:

whole ingredient

↓

cut

↓

individual pieces

↓

plated/result arrangement

==================================================

15. INGREDIENT CARD

==================================================

Show:

Ingredient name

Category

Available techniques

Example:

LEMON

Fruit

Slice

Radial

==================================================

16. VISUAL QUALITY RULE

==================================================

Everything must be judged at ACTUAL GAMEPLAY SCALE.

Do not optimize only for zoomed-in screenshots.

A food is successful only if it is recognizable when displayed at the same approximate size it will have in KnifeCraft.

The following must all be readable:

- silhouette

- color

- interior

- cut pieces

- plated result

==================================================

17. NO STATIC FOOD IMAGES

==================================================

Do not create six PNG/WebP assets.

Do not use AI-generated food images.

The purpose is to establish procedural definitions that can later be ported.

Textures may be generated procedurally inside the silhouette.

==================================================

18. PER-INGREDIENT SEAM COLORS

==================================================

Do not use one global tomato-colored seam.

Each ingredient must define its own seam colors.

Examples:

Tomato → red/dark red

Cucumber → green/pale green

Lemon → yellow/pale yellow

Avocado → green/light green

Eggplant → purple/cream

Cheddar → orange/yellow

Baguette → brown/cream

Broccoli → green/light green

The seam should remain visible against the ingredient without looking unnatural.

==================================================

19. VISUAL STYLE

==================================================

KnifeCraft visual language:

- cozy

- warm

- handcrafted

- slightly stylized

- painterly

- clean

- readable

- soft highlights

- subtle texture

Do NOT make the food photorealistic.

Do NOT make it generic flat vector art.

Target:

"beautiful cozy illustrated cooking game."

==================================================

20. DATA-DRIVEN DESIGN

==================================================

Do not create:

if ingredient === "lemon"

everywhere.

Instead:

IngredientDefinition

    ↓

geometry

    ↓

paint

    ↓

techniques

    ↓

colors

The rendering system should be generic.

Adding a ninth ingredient should require mostly:

new definition

+

new geometry composition

+

new paint function

not changes throughout the application.

==================================================

21. EXISTING KNIFECRAFT TECHNIQUES

==================================================

The current KnifeCraft technique catalog includes:

Slice

Dice

Julienne

Chop

Halve

Peel

Smash

Rings

Radial

Rock Mince

Chiffonade

Do not invent new techniques for these six ingredients unless absolutely necessary.

Use the existing technique vocabulary.

==================================================

22. IMPORTANT: THIS IS A REFERENCE LAB

==================================================

Do not build:

- progression

- coins

- shop

- kitchen upgrades

- recipes

- save system

- levels

- journal

- navigation

- player account

- multiplayer

- backend

Only build the ingredient visual/geometry laboratory.

==================================================

23. EXPORT / PORTABILITY

==================================================

Keep the ingredient system modular.

Organize code approximately as:

src/

  ingredients/

    types.ts

    primitives.ts

    cluster.ts

    renderer.ts

    cutter.ts

    definitions/

      lemon.ts

      avocado.ts

      eggplant.ts

      cheddar.ts

      baguette.ts

      broccoli.ts

    index.ts

The exact structure may differ if a better organization is appropriate.

Avoid putting the entire system inside App.tsx.

==================================================

24. PERFORMANCE

==================================================

Cache rendered ingredient canvases.

Do not repaint the full ingredient every frame unless necessary.

Cut pieces should use the cached source rendering.

Keep the system lightweight.

==================================================

25. IMPORTANT STOP CONDITION

==================================================

If one ingredient cannot be represented cleanly by the existing geometry architecture:

DO NOT hack around it.

Explain:

1. what geometry limitation exists

2. why it happens

3. the smallest reusable extension required

Then implement the extension only if it does not compromise the existing system.

==================================================

26. FINAL ACCEPTANCE TEST

==================================================

The project is successful when:

Lemon looks like Lemon.

Avocado looks like Avocado.

Eggplant looks like Eggplant.

Cheddar looks like Cheddar.

Baguette looks like Baguette.

Broccoli looks like Broccoli.

AND:

their cut pieces still look like the same food.

A sliced Lemon must still look like Lemon.

A halved Avocado must still look like Avocado.

A sliced Baguette must expose crumb.

A cut Eggplant must expose flesh.

Broccoli pieces must still look like broccoli florets/stalk.

==================================================

27. FINAL REPORT

==================================================

At the end report:

- files created

- files changed

- geometry primitives created

- rendering architecture

- each ingredient's implementation

- supported techniques

- screenshots/preview states

- known visual problems

- known geometry problems

- what is ready to port into production KnifeCraft

- what should NOT be ported directly

DO NOT claim production integration.

This project is the REFERENCE INGREDIENT LAB only.

START WITH THE SHARED FOUNDATION, THEN IMPLEMENT ALL SIX INGREDIENTS.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4119af3c-ab09-4001-98b6-15b482dace14).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
