# Dishwashing: ready-to-paste Codex prompts (2026-11-07)

**Do you need these?** No: the sink game works today. Every piece (plates, bowls, forks, glasses, pots, pans, sheet pans,
ladles, turners, whisks…) is drawn in code (inline SVG, `restaurant/WashUpSink.tsx`), and the basin is the existing
`public/dishwashing/premium-sink.webp`. These prompts are the **optional art upgrade**: painted pots and pans in the
same hand-painted look as the rest of the game. Nothing is wired to them yet. When a PNG exists in
`art-source/dishwashing/`, say so and the build step (`webp` into `public/dishwashing/`, drawn in place of the SVG,
the SVG stays as the fallback if a picture fails to load) is next.

**How to use:** one Codex image conversation, the best existing sink picture (`public/dishwashing/premium-sink.webp`)
attached as the style reference. Paste ONE prompt at a time (each already holds the style rules). Ask for 4 variants,
keep the best, attach the kept one as the reference for the next piece. Save the PNGs in `art-source/dishwashing/`
named exactly like the heading id (`D1.png` …). Order: D1 (basin) first, then D2–D5 (the pieces), then D6–D7.

**Checklist after each image:** no text or letters anywhere; transparent background; exact size; nothing cut off; the same
warm top-left light as the first piece you accepted. **Pieces are CLEAN and EMPTY** (the game paints the dirt, the suds and
the shine on top, so no food, no stains, no steam, no water drops on them).

**Shared rule for every piece sprite:** drawn from slightly above (the same angle as the dinner plate in the sink), centered
in its canvas, with the same soft shadow under it falling bottom-right, and a flat plain surface inside (so painted dirt reads
on it).

---

## D1 — The sink basin (replaces `premium-sink.webp`)

```
STYLE BIBLE — KnifeCraft "Dishwashing" mini-game art.
A warm, cozy, hand-painted mobile-game look: soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker
outline in a warm brown (never pure black), rich but not neon colors, steel, wood and paper textures, a cheerful rustic
restaurant kitchen. Light comes from the top-left, warm golden (about 3200 K), soft shadow falling bottom-right.
Everything must look like it belongs to ONE set: same line weight, same softness, same saturation.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people or hands,
NO dishes, NO sponge, NO bubbles in the middle (the game places those). Transparent background is NOT needed: this is a full scene.
Keep the whole picture usable when it is cropped to 4:3 on a phone.

ASSET D1: a full-scene, slightly-from-above view of a commercial stainless-steel restaurant sink, the BIG basin filling the
centre of the picture. The basin is EMPTY, with a shallow layer of clear, slightly soapy warm water on its floor (a few tiny
bubbles ONLY at the far edges), so a plate, pot or pan can be laid in the middle. A chrome swan-neck tap at the top-left, a
pre-rinse spray hose hanging on the right, a stainless drainboard on the left, a wooden shelf with a folded blue-and-cream
dish towel on the far right. A dark walnut counter edge across the bottom. The middle 60% of the picture (the basin floor)
must be calm and evenly lit, with no strong highlights, because dirt is painted there. 1080 x 840 px, landscape.
```

---

## D2 — Pots (stock pot and saucepan)

```
STYLE BIBLE — KnifeCraft "Dishwashing" mini-game art.
A warm, cozy, hand-painted mobile-game look: soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker
outline in a warm brown (never pure black), rich but not neon colors, steel, wood and paper textures, a cheerful rustic
restaurant kitchen. Light comes from the top-left, warm golden (about 3200 K), soft shadow falling bottom-right.
Everything must look like it belongs to ONE set: same line weight, same softness, same saturation.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people or hands,
NO food, NO stains, NO steam, NO water drops. Output: PNG with a TRANSPARENT background (alpha); if that is not possible a flat
pure chroma green #00FF00 with no green in the subject. Keep a 4% margin; do not crop the subject. ONE image per request.

ASSET D2: TWO separate images in one sheet, side by side on a transparent background. LEFT: a large stainless-steel STOCK POT
(20 quart), seen from slightly above, open, two riveted side handles, a clean empty brushed-steel inside. RIGHT: a smaller
SAUCEPAN (3 quart) with ONE long steel handle pointing to the right-bottom, clean empty inside. The inside floor of both is
a calm, evenly lit, light steel grey (dirt is painted there by the game). 1440 x 720 px sheet (each pot about 640 x 560).
```

---

## D3 — Pans (frying pan and sauté pan)

```
STYLE BIBLE — KnifeCraft "Dishwashing" mini-game art.
A warm, cozy, hand-painted mobile-game look: soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker
outline in a warm brown (never pure black), rich but not neon colors, steel, wood and paper textures, a cheerful rustic
restaurant kitchen. Light comes from the top-left, warm golden (about 3200 K), soft shadow falling bottom-right.
Everything must look like it belongs to ONE set: same line weight, same softness, same saturation.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people or hands,
NO food, NO stains, NO steam, NO water drops. Output: PNG with a TRANSPARENT background (alpha); if that is not possible a flat
pure chroma green #00FF00 with no green in the subject. Keep a 4% margin; do not crop the subject. ONE image per request.

ASSET D3: TWO separate images in one sheet, side by side on a transparent background. LEFT: a 10-inch FRYING PAN, shallow,
round, seen from slightly above, a long straight steel handle pointing to the RIGHT, light brushed-steel inside (NOT black
non-stick, so dirt will show). RIGHT: a 5-quart SAUTÉ PAN, deeper, with a straight wall, a long handle to the right and a small
helper handle on the left. The inside floor is a calm, evenly lit, light steel grey. 1600 x 720 px sheet (each pan about
760 x 560, handle included).
```

---

## D4 — Sheet pan

```
STYLE BIBLE — KnifeCraft "Dishwashing" mini-game art.
A warm, cozy, hand-painted mobile-game look: soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker
outline in a warm brown (never pure black), rich but not neon colors, steel, wood and paper textures, a cheerful rustic
restaurant kitchen. Light comes from the top-left, warm golden (about 3200 K), soft shadow falling bottom-right.
Everything must look like it belongs to ONE set: same line weight, same softness, same saturation.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people or hands,
NO food, NO stains, NO steam, NO water drops. Output: PNG with a TRANSPARENT background (alpha); if that is not possible a flat
pure chroma green #00FF00 with no green in the subject. Keep a 4% margin; do not crop the subject. ONE image per request.

ASSET D4: one aluminium SHEET PAN (full size, rolled rim), seen from slightly above, landscape, the rim a little brighter than
the flat inside, the inside a calm, evenly lit, light grey with a very faint brushed texture. 720 x 480 px.
```

---

## D5 — Kitchen utensils (one sheet, six pieces)

```
STYLE BIBLE — KnifeCraft "Dishwashing" mini-game art.
A warm, cozy, hand-painted mobile-game look: soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker
outline in a warm brown (never pure black), rich but not neon colors, steel, wood and paper textures, a cheerful rustic
restaurant kitchen. Light comes from the top-left, warm golden (about 3200 K), soft shadow falling bottom-right.
Everything must look like it belongs to ONE set: same line weight, same softness, same saturation.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people or hands,
NO food, NO stains, NO steam, NO water drops. Output: PNG with a TRANSPARENT background (alpha); if that is not possible a flat
pure chroma green #00FF00 with no green in the subject. Keep a 4% margin; do not crop the subject. ONE image per request.

ASSET D5: SIX separate, clean steel utensils laid vertically (handle at the bottom) in a row with wide gaps between them, on a
transparent background, left to right: a LADLE (8 oz), a high-heat TURNER (flat spatula), a fine-mesh SKIMMER, a piano WHISK,
a pair of 12-inch TONGS (closed), a 4-sided BOX GRATER (standing, shown from slightly above). Each about 220 px wide and 640 px
tall. Plain brushed steel with a dark wooden or black handle where it makes sense. The heads are calm and evenly lit (dirt is
painted there by the game). 1440 x 720 px sheet.
```

---

## D6 — Sponge and spray head (the two tools)

```
STYLE BIBLE — KnifeCraft "Dishwashing" mini-game art.
A warm, cozy, hand-painted mobile-game look: soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker
outline in a warm brown (never pure black), rich but not neon colors, steel, wood and paper textures, a cheerful rustic
restaurant kitchen. Light comes from the top-left, warm golden (about 3200 K), soft shadow falling bottom-right.
Everything must look like it belongs to ONE set: same line weight, same softness, same saturation.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people or hands.
Output: PNG with a TRANSPARENT background (alpha); if that is not possible a flat pure chroma green #00FF00 with no green in
the subject. Keep a 4% margin. ONE image per request.

ASSET D6: TWO separate images in one sheet on a transparent background. LEFT: a chunky yellow kitchen SPONGE with a green
scouring pad on its underside, soft and a little wet, tilted 25 degrees, a few tiny bubbles on it. RIGHT: a steel pre-rinse SPRAY
HEAD seen from the front-bottom, spraying a short fan of clear blue water drops DOWNWARD (the drops end after about one third of
the image height). 1000 x 500 px sheet (each about 500 x 500).
```

---

## D7 — Suds sprites (bubbles for the rinse step)

```
STYLE BIBLE — KnifeCraft "Dishwashing" mini-game art.
A warm, cozy, hand-painted mobile-game look: soft painterly shading, gentle rim light, rounded chunky shapes, a thin darker
outline in a warm brown (never pure black), rich but not neon colors, steel, wood and paper textures, a cheerful rustic
restaurant kitchen. Light comes from the top-left, warm golden (about 3200 K), soft shadow falling bottom-right.
Everything must look like it belongs to ONE set: same line weight, same softness, same saturation.
STRICT RULES: NO text, NO letters, NO numbers, NO logos, NO brand names, NO watermarks, NO signature, NO people or hands.
Output: PNG with a TRANSPARENT background (alpha); if that is not possible a flat pure chroma green #00FF00 with no green in
the subject. Keep a 4% margin. ONE image per request.

ASSET D7: a sprite sheet of soap SUDS on a transparent background, a 4 x 2 grid of eight different clumps (128 x 128 px each):
four single glossy bubbles of different sizes (a pale blue-white film, a soft white highlight top-left, a faint rainbow rim) and
four clusters of 5 to 9 touching bubbles. Soft, translucent, easy to tile over a plate. 512 x 256 px sheet.
```
