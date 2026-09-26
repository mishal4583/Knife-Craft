/* KNIFECRAFT — the five new ingredient PROFILES.
   Paste each block into `CONFIG.INGREDIENTS` verbatim. Every field is one the loader already reads:
   geom / resistance / audio / particles / seam. Two geom flags are NEW and are handled by the shared patches
   in 04-shared-patches.md: `keepOverhang` (chilli) and `leafRound` (cilantro).
   Order in the object does not matter except for the ingredient picker's display order. */

const INGREDIENT_ADDITIONS = {
/* GINGER — a RHIZOME, and the first food whose identity IS its lumpiness, so it reuses `cluster` (basil's
       primitive) for a BODY rather than a bunch: one thick mass with finger knobs budding off it at different
       angles. No new silhouette primitive and no new mechanic — the lobes union into one solid hand (nonzero
       winding), and because the knobs genuinely overlap the mass there are no interior gaps for a cut to fall
       through, unlike a herb. PEELABLE: the shell is SKIN.ginger and the base sprite is the shaved rhizome, so
       the rub turns a tan hand into a pale butter-yellow one. `mass`/`tip` mark which lobes are body and
       which are fingers — the painter reads them for the contact shadows and the node faces. */
    ginger: {
      name: 'Ginger',
      geom: { shape:'cluster', cx:270, cy:500, rx:0, ry:0,
        leaves: [
          { dx: -14, dy:-30, rx:150, ry:56, rot:-0.15, mass:true },  // the main rhizome
          { dx:  96, dy:-16, rx: 96, ry:48, rot: 0.06, mass:true },  // it thickens toward the right
          { dx:  74, dy:-86, rx: 60, ry:36, rot:-0.52 },             // the knob riding up behind
          { dx: 196, dy: 18, rx: 62, ry:34, rot: 0.46, tip:true },   // fingers: unequal, splayed forward
          { dx: -58, dy: 42, rx: 92, ry:38, rot: 0.30, tip:true },
          { dx:  74, dy: 62, rx: 74, ry:33, rot:-0.10, tip:true },
          { dx:-152, dy:-12, rx: 72, ry:34, rot:-0.34, tip:true },
          { dx:  10, dy:-96, rx: 36, ry:22, rot:-0.20 },             // one small nub on top
        ],
        bandTopClear: 0.10, bandBotFrac: 0.88, bandSideFrac: 0.86 },
      resistance: [[0,0.92],[0.16,0.66],[0.45,0.44],[0.82,0.50],[1,0.74]], // fibrous all the way: no soft core
      audio: { filterMin:1300, filterMax:4600, transQ:2.4, transPeak:0.30, transVel:0.26,
               atkFast:0.002, atkSlow:0.005, transDecay:0.028,
               glideType:'lowpass', glideMin:420, glideSpan:480, glideQ:1.5,
               glidePeak:0.08, glideVel:0.06, tailMs:64, tailVel:0.42,
               thunkHz:84, thunkDrop:46, thunkGain:0.46, thunkVel:0.58 },
      particles: { fragChance:0.9, fragColor:'#F2E7B2', fragEdge:'rgba(170,138,66,0.55)',
                   wetColor:'#EDDFA4', wet:0.18, gravity:1080, bounce:0.26, countScale:0.75 },
      seam: { seamDark:'rgba(150,120,52,0.52)', seamFlesh:'rgba(252,244,198,0.92)',
              preScoreDark:'rgba(126,100,40,0.70)', preScoreFlesh:'rgba(253,247,214,0.82)' },
    },
/* GREEN CHILLI — `taper` with eggplant's `spine`: the reference's whole character is the CURVE, a slender
       pod that bows most of the way and then runs out to a fine point, so the bowed centreline is real
       geometry (the cut model sees it) rather than a painted illusion. taperCurve BELOW 1 holds the pod's
       thickness through the body and narrows late, which is the reference's profile; `spine` stays modest
       (14 on a 42px half-thickness) because a deeper bow carries the body clear of its own centre line —
       the harness samples there and a hollow centre is a paint failure; the calyx and the crooked stalk are paint past the butt
       (pear's trick), so no cut, span or piece ever sees them. Not peelable — a chilli has no shell. */
    chilli: {
      name: 'Green Chilli',
      geom: { shape:'taper', cx:268, cy:498, rx:198, ry:42, rBig:42, rSmall:6,
              taperCurve: 0.82, buttRound: 0.62, tipRound: 3.6, spine: 14, spineRx: 198,
              overhang: { x:120, y:96 }, spriteM: 128, keepOverhang: true,   // calyx + stalk past the butt, kept after cuts; see PAINT.chilli
              bandTopClear: 0.10, bandBotFrac: 0.88, bandSideFrac: 0.86 },
      resistance: [[0,0.52],[0.10,0.16],[0.5,0.08],[0.86,0.16],[1,0.34]], // thin skin snap, hollow after it
      audio: { filterMin:1800, filterMax:6200, transQ:2.8, transPeak:0.30, transVel:0.28,
               atkFast:0.002, atkSlow:0.004, transDecay:0.022,
               glideType:'bandpass', glideMin:1500, glideSpan:2100, glideQ:1.5,
               glidePeak:0.09, glideVel:0.08, tailMs:70, tailVel:0.45,
               thunkHz:140, thunkDrop:74, thunkGain:0.24, thunkVel:0.42 },
      particles: { fragChance:0.7, fragColor:'#8FCE3A', fragEdge:'rgba(58,104,20,0.55)',
                   wetColor:'#D8EFA4', wet:0.40, gravity:900, bounce:0.10, countScale:0.55 },
      seam: { seamDark:'rgba(48,92,20,0.52)', seamFlesh:'rgba(232,246,198,0.92)',
              preScoreDark:'rgba(38,76,14,0.70)', preScoreFlesh:'rgba(238,250,210,0.82)' },
    },
/* LIME — the LEMON verbatim (same ellipse, same rind/pith/flesh inset, same radial-segment scaffold), with
       the whole palette moved to citrus green and the body a touch smaller and rounder, which is the only real
       difference between the two fruits on a board. No new geometry, no new mechanic. */
    lime: {
      name: 'Lime',
      geom: { shape:'ellipse', cx:270, cy:500, rx:108, ry:96, lobes:0,
              bandTopClear: 0.06, bandBotFrac: 0.92, bandSideFrac: 0.90 },
      resistance: [[0,0.70],[0.14,0.26],[0.5,0.10],[0.85,0.16],[1,0.36]], // peel resists, then a juicy glide
      audio: { filterMin:740, filterMax:3500, transQ:1.5, transPeak:0.27, transVel:0.32,
               atkFast:0.005, atkSlow:0.012, transDecay:0.042,
               glideType:'lowpass', glideMin:480, glideSpan:1020, glideQ:1.0,
               glidePeak:0.14, glideVel:0.12, tailMs:200, tailVel:0.8,
               thunkHz:106, thunkDrop:58, thunkGain:0.36, thunkVel:0.5 },
      particles: { fragChance:0.5, fragColor:'#C6DE72', fragEdge:'rgba(76,110,24,0.5)',
                   wetColor:'#DCEB9E', wet:0.85, gravity:880, bounce:0, countScale:0.9 },
      seam: { seamDark:'rgba(72,104,20,0.60)', seamFlesh:'rgba(238,248,206,0.95)',
              preScoreDark:'rgba(58,86,14,0.72)', preScoreFlesh:'rgba(244,251,218,0.85)' },
    },
/* CILANTRO — parsley's cluster verbatim (same primitive, same five functions, same stem rods), with the
       leaf-shape flag flipped to the ROUND variant and a slightly lighter, yellower green. The plant reference
       is a loose spray of a few LARGE fan leaflets on long thin petioles, not parsley's dense frill, so the
       leaflets are fewer and bigger — 14 blades against parsley's 20 — while the mid-band trio stays, since the
       harness scanlines the middle of the bunch and a hollow centre there is a paint failure. */
    cilantro: {
      name: 'Cilantro',
      geom: { shape:'cluster', cx:270, cy:500, rx:0, ry:0, leafRound: true,
        leaves: [
          { dx: -94, dy:-44, rx:44, ry:38, rot:-0.62 },
          { dx: -52, dy:-62, rx:42, ry:36, rot:-0.14 },
          { dx: -84, dy:  4, rx:41, ry:35, rot: 0.58 },
          { dx:  -6, dy:-82, rx:45, ry:39, rot:-0.44 },
          { dx:  36, dy:-66, rx:42, ry:36, rot: 0.16 },
          { dx:  92, dy:-38, rx:41, ry:35, rot:-0.30 },
          { dx:  84, dy:  8, rx:43, ry:37, rot: 0.66 },
          { dx: -66, dy: 46, rx:43, ry:37, rot:-0.50 },
          { dx: -22, dy: 74, rx:42, ry:36, rot: 0.22 },
          { dx:  34, dy: 70, rx:41, ry:35, rot: 0.52 },
          { dx:  70, dy: 44, rx:40, ry:34, rot:-0.24 },
          // MID BAND — these two exist for the centre pixel, not the silhouette: a fan blade grows to the RIGHT
          // of its base point, so a leaf centred on the bunch centre leaves that centre in the petiole gap.
          // Both are pushed left of centre with no rotation, so their blade bodies cover cx,cy outright.
          { dx: -34, dy:  2, rx:44, ry:38, rot: 0.00 },
          { dx: -26, dy:-14, rx:41, ry:35, rot: 0.14 },
          // And one leaflet sitting ON the bunch centre. A fan blade is centred on its own leaf ellipse, so this
          // is the only placement that guarantees the harness's centre probe lands in green rather than in the
          // gap between two fans — a transparent centre pixel is a paint failure however full the rest reads.
          { dx:   0, dy:  0, rx:42, ry:36, rot: 0.05 },
          { dx:  48, dy:  6, rx:41, ry:35, rot: 0.42 },
          { dx: -30, dy: 26, rx:42, ry:36, rot: 0.60 },
          // Six more leaflets filling the gaps between the big fans. A spray of only 14 blades left enough plate
          // showing that the bunch measured emptier than parsley's frill — the harness reads that as a paint
          // failure, and the photo's bunch is genuinely layered, so the fix is more leaves, not a wider fan.
          { dx: -68, dy:-10, rx:38, ry:33, rot:-0.86 },
          { dx: -18, dy:-44, rx:39, ry:34, rot:-0.28 },
          { dx:  62, dy:-14, rx:38, ry:33, rot: 0.90 },
          { dx:  16, dy: 40, rx:39, ry:34, rot: 0.34 },
          { dx: -54, dy: 12, rx:37, ry:32, rot: 0.18 },
          { dx:  58, dy: 22, rx:37, ry:32, rot:-0.66 },
          { dx: -41, dy:-20, rx:46, ry:3.2, rot:-0.42, stem:true },
          { dx:   3, dy:-34, rx:40, ry:3.2, rot: 1.35, stem:true },
          { dx:  41, dy:-16, rx:46, ry:3.2, rot:-0.38, stem:true },
          { dx: -28, dy: 20, rx:38, ry:2.8, rot: 0.60, stem:true },
          { dx:  24, dy: 26, rx:38, ry:2.8, rot:-0.60, stem:true },
          { dx:  -3, dy: 46, rx:34, ry:2.8, rot: 1.40, stem:true },
        ],
        bandTopClear: 0.08, bandBotFrac: 0.90, bandSideFrac: 0.88 },
      resistance: [[0,0.18],[0.10,0.08],[0.55,0.04],[0.88,0.06],[1,0.12]],
      audio: { filterMin:1400, filterMax:5800, transQ:2.3, transPeak:0.18, transVel:0.20,
               atkFast:0.002, atkSlow:0.005, transDecay:0.019,
               glideType:'bandpass', glideMin:2050, glideSpan:1500, glideQ:1.25,
               glidePeak:0.05, glideVel:0.05, tailMs:50, tailVel:0.30,
               thunkHz:164, thunkDrop:96, thunkGain:0.13, thunkVel:0.30 },
      particles: { fragChance:0.95, fragColor:'#7CAE4A', fragEdge:'rgba(36,66,22,0.5)',
                   wetColor:'#A8CB7C', wet:0.12, gravity:600, bounce:0.10, countScale:0.45 },
      seam: { seamDark:'rgba(20,44,13,0.72)', seamFlesh:'rgba(222,242,194,0.92)',
              preScoreDark:'rgba(16,36,10,0.78)', preScoreFlesh:'rgba(228,246,202,0.85)' },
    },
/* SPRING ONION — asparagus's BUNDLE verbatim: one cluster lobe per stalk, so a chop gives a chunk per
       stalk per band and no two stalks share a body. Only the proportions and the paint change. The reference's
       whole identity is the LENGTHWISE GRADIENT — a white bulb that swells at the butt, a long pale-green neck
       where the sheaths overlap, then a deep green hollow tube to the cut tip — plus the root fringe off the
       butt. Seven stalks, fanned like the photo's bunch; each lobe is longer and thinner than a spear, and the
       bulb bulge stays inside its own lobe ellipse so spans and cuts see exactly what is painted. */
    springonion: {
      name: 'Spring Onion',
      geom: { shape:'cluster', cx:270, cy:500, rx:0, ry:0, bundle: true,
              overhang: { x:26, y:6 }, spriteM: 46,   // the root tuft past the butt; see PAINT.springonion
        /* Spacing is set by the BULB, not the shaft: at 19px apart with a 20px bulb radius the seven bulbs
           fused into one white slab (the first pass's worst read). One bulb diameter of pitch keeps each
           teardrop its own object while the green tops still overlap into a bunch, as in the photo. */
        leaves: [                                            // dx shifted RIGHT so the root tuft clears the box edge
          { dx:  8, dy: -84, rx:180, ry:19.0, rot:-0.046 },
          { dx: 26, dy: -56, rx:196, ry:20.0, rot:-0.030 },
          { dx: 14, dy: -28, rx:186, ry:19.5, rot:-0.014 },
          { dx: 32, dy:   0, rx:200, ry:20.5, rot: 0.002 },
          { dx: 18, dy:  28, rx:190, ry:20.0, rot: 0.018 },
          { dx: 30, dy:  56, rx:194, ry:20.5, rot: 0.034 },
          { dx: 10, dy:  84, rx:178, ry:19.0, rot: 0.048 },
        ],
        bandTopClear: 0.06, bandBotFrac: 0.92, bandSideFrac: 0.94 },
      resistance: [[0,0.34],[0.14,0.16],[0.5,0.12],[0.85,0.15],[1,0.30]], // crisp hollow tube, the bulb end firmer
      audio: { filterMin:1150, filterMax:6000, transQ:2.4, transPeak:0.22, transVel:0.26,
               atkFast:0.002, atkSlow:0.006, transDecay:0.024,
               glideType:'highpass', glideMin:1450, glideSpan:2000, glideQ:1.35,
               glidePeak:0.07, glideVel:0.07, tailMs:80, tailVel:0.42,
               thunkHz:142, thunkDrop:80, thunkGain:0.18, thunkVel:0.36 },
      particles: { fragChance:0.8, fragColor:'#D8EBB2', fragEdge:'rgba(82,118,46,0.5)',
                   wetColor:'#EAF4CE', wet:0.45, gravity:760, bounce:0.14, countScale:0.55 },
      seam: { seamDark:'rgba(78,112,48,0.56)', seamFlesh:'rgba(238,246,214,0.94)',
              preScoreDark:'rgba(62,92,36,0.70)', preScoreFlesh:'rgba(244,250,226,0.85)' },
    },
};

/* Real-world size table — append to REAL_CM (`[long, short]` in cm, whole and untrimmed). The scale loop
   derives each sprite's k from these; nothing else needs touching. Spring onion's short axis is the BOUND
   BUNCH (11cm), not one stalk — using a single stalk's 4cm diameter shrank the whole bundle. */
const REAL_CM_ADDITIONS = {
  ginger: [14, 9],
  chilli: [12, 2.2],
  lime: [6, 4.5],
  cilantro: [17, 12],
  springonion: [34, 11],
};
