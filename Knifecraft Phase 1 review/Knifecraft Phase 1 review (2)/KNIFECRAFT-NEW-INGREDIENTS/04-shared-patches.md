# KNIFECRAFT — shared-code patches for the five new ingredients

Five ingredients were added on existing primitives. Four small edits to SHARED code were needed; everything
else is additive (profiles, painters, recipes, size rows). These four are the only places a port can get the
new foods wrong while every old food still works.

---

## 1. `drawOverhang` — an overhang that does NOT shed (chilli)

Every overhang (leaf crowns, stems) tips off and fades on the first cut. A chilli's stalk and calyx are woody
and attached to the shoulder the cuts never reach, so they stay for the whole run. One guard, one geom flag.

**Source: `knifecraft.html:5997`**

```js
  if(!g.overhang) return;
  if((s.ing === 'pumpkin') !== !!over) return;
  let a = 1, e = 0;
  /* Some overhangs STAY. A chilli's stalk is woody and still attached to the shoulder the cuts never reach —
     chopping rounds off the tip does not knock the stem off the board, so it holds its paint for the whole run. */
  if(cuts.length && !g.keepOverhang){ const k = clamp01((gnow - cuts[0].revealT0) / OVERHANG_SHED_MS); e = k*k; a = 1 - e; }
  if(a <= 0.002) return;
  const px = g.cx + g.rx*0.90, py = g.cy;        // the crown's own anchor: it tips about where it joins
```

Set by `chilli.geom.keepOverhang = true`. No other ingredient sets it; behaviour for all of them is byte-identical.

---

## 2. `parsleyLeafShape` — the ROUND leaf variant (cilantro)

Parsley's blade generator gained a second construction, selected by `geom.leafRound`. Parsley's own path is
untouched (it still runs the trifid lobe-sum). The round variant builds the blade in POLAR form: an envelope
over a fan, minus narrow gaussian slits cut inward from the margin, times a crenate ripple, closed back to the
base point — which is what a cilantro leaflet actually is (one webbed fan blade, not three radiating lobes).

Return contract is identical (`{walk, axes, fit, bx, seed, lcx, lcy}`), so the fit loop, centroid, plate clip
and chop logic are shared with parsley unchanged.

**Source: `knifecraft.html:5350`**

```js
     (fit loop, centroid, plate clip, chop) is untouched. */
  const RND = !!g.leafRound, N = 30, bxR = -0.62*rx;
  /* CILANTRO'S BLADE IS NOT PARSLEY'S. The reference is ONE continuous blade, a wedge that fans out from a
     narrow entire base and is widest at its outer arc; the division is cut INWARD from that arc as narrow
     slits reaching about 40% back, leaving ~7 blunt lobes whose own margins are coarsely CRENATE (rounded
     bumps, no points). Parsley's construction — three separate narrow lobes radiating from the petiole —
     cannot express that: it always shows three detached fingers with sky between them. So the round variant is
     built in POLAR form instead: an envelope r(θ) over the fan, minus gaussian slits, times a fine crenate
     ripple, closed back to the base point (which draws the two straight sides of the wedge for free).
     Same return contract as the trifid path, so the fit loop, centroid, plate clip and chop are untouched. */
  if(RND){
    const hh = k => { const v = Math.sin(seed*13.7 + k*7.31)*43758.5453; return (v - Math.floor(v))*2 - 1; };
    /* len is capped in practice by the fit loop below (the blade is shrunk about its base until it sits inside its
     own leaf ellipse), so asking for a LONGER fan makes the painted blade smaller, not bigger — 1.46 is the
     value that just fills the ellipse. Coverage is bought with shallower slits, never with more length. */
    /* These three numbers are set by the FIT LOOP, not by taste: the fan is shrunk about its base until it sits
       inside the leaf ellipse, so an over-long or over-wide fan comes back half-size and pushed off to one side
       (the first pass ran at fit 0.50 and left the bunch's centre bare). At ±66° over 1.20rx from a base at
       −0.62rx the fan fits at 0.94 and fills ~44% of its ellipse — the fullest of the combinations tried. */
    const TH = 1.15, len = 1.20*rx*(1 + 0.05*hh(1)), M = 84;
    const SLIT = [-1.10, -0.74, -0.32, 0.32, 0.74, 1.10].map((s, i) => s + 0.035*hh(i+3));
    const r = th => {
      let k = len*(1 - 0.12*Math.pow(Math.abs(th)/TH, 2.2));        // envelope: broad arc, easing in at the sides
      let cut = 0;
      for(const s of SLIT){ const q = (th - s)/0.066; cut += 0.26*Math.exp(-q*q); }   // narrow inward slits
      // Slit depth is a COVERAGE budget as well as a shape choice: at 0.42 the blade fell under the paint-smoke
      // floor. Narrower, shallower slits plus the refit fan clear the standard 30% bar with no allowance.
      k *= Math.max(0.22, 1 - cut);
      k *= 1 + 0.030*Math.cos(th*46 + 0.8*hh(2));                    // crenate margin: rounded bumps, never teeth
      return k;
    };
    const walk = [[0, 0]];
    for(let i=0;i<=M;i++){ const th = -TH + 2*TH*(i/M), rr = r(th);
      walk.push([Math.cos(th)*rr, Math.sin(th)*rr]); }
    const axes = [0, -0.53, 0.53, -0.92, 0.92, -1.20, 1.20].map(a => ({ ang: a, len: r(a) }));
    let fit = 1;
    for(let t=0;t<50;t++){
      let ok = true;
      for(const q of walk){ const x = bxR + q[0]*fit, y = q[1]*fit;
        if((x/rx)*(x/rx) + (y/ry)*(y/ry) > 1.06){ ok = false; break; } }
      if(ok) break;
      fit -= 0.02;
    }
    let sx = 0, sy = 0;
    for(const q of walk){ sx += bxR + q[0]*fit; sy += q[1]*fit; }
    return (g.__pslShape[seed] = { walk, axes, fit, bx: bxR, seed, lcx: sx/walk.length, lcy: sy/walk.length });
  }
```

Two numbers in there are set by the FIT LOOP, not by taste — see the comment. An over-long or over-wide fan
comes back half-size and pushed off-centre.

---

## 3. `clusterBlade` — cilantro has a painted blade too

```js
   lobe never becomes the whole piece), moved so that leaf sits on the piece's own pivot, scaled by how much of
   the leaf survived, and clipped by the SINGLE cut line that actually crosses it — one chopped edge, the rest the
   leaf's own outline. Multi-cut slivering, and with it the stick look, cannot happen. */
function clusterBlade(p, gp, i){ // the painted outline of one leaf, when the food has one tighter than its ellipse
  return (p.src && (p.src.ing === 'parsley' || p.src.ing === 'cilantro')) ? parsleyBladePath(gp, i) : null;
}
```

This is what makes a plated cilantro piece clip to the painted leaflet instead of its ellipse (otherwise the
cut seam runs on as a pale line past the green). Source: `knifecraft.html:5489`.

---

## 4. `REAL_CM` — five new size rows

See `01-ingredients.js`. The only judgement call: **spring onion is `[34, 11]`** — the short axis is the
bound BUNCH, not one stalk. A first pass used one stalk's 4cm diameter and the whole bundle rendered at 46% of
the board and read as "very small".

---

## Nothing else changed

- No new shape family (`cluster`, `taper`, `ellipse` only).
- No new technique (Slice / Chop / Chiffonade / Halve only).
- No new plating style (`shingle`, `mound`, `nest`, `fan`).
- No new peel mechanic — ginger is peelable through the existing `SKIN` + `skinAlpha` path (it is NOT in
  `SKIN_KEEP`, so its shell sheds on the rub); lime, cilantro, chilli and spring onion have no `SKIN` entry
  at all, so `skinAlpha` returns 0 and they must never be given a peel step.
- The §17E paint-smoke floor table is back to `{ parsley: 24, beetroot: 26 }` — cilantro clears the standard
  30% bar on its own (measured 35.9%), so it needs no allowance.
