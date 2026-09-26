/* SHARED HELPER — both ginger painters (peeled body + corky shell) delegate to this one function, so the
   knobs, ridges and contact shadows can never drift between the two layers. Paste it at top level, beside the
   other paint helpers. */

/* GINGER, ONE ROUTINE, TWO SKINS. A hand of ginger is the same picture peeled or not — same knobs, same ring
   ridges, same nodes — so the body is drawn ONCE here and the palette is passed in: PAINT.ginger is the PEELED
   rhizome (the base sprite) and SKIN.ginger is the tan corky shell over it, which is the pineapple/mango
   arrangement and costs the cut model nothing.
   A cluster silhouette is one subpath PER LOBE, so stroking it outlines every ellipse, buried parts included —
   which reads as a heap of glass tubes. The rim is therefore laid down first and then BURIED: stroke all lobes,
   then paint the interior clipped to the union INSET by that stroke, so only the outer edge survives. */
function gingerBody(c2, g, P){
  const sil = silPath(g, 0);
  const lobe = (b, sx, sy) => { const p = new Path2D();
    p.ellipse(g.cx+b.dx, g.cy+b.dy, b.rx*sx, b.ry*sy, b.rot||0, 0, Math.PI*2); return p; };
  const lobeIn = (b, d) => { const p = new Path2D();
    p.ellipse(g.cx+b.dx, g.cy+b.dy, Math.max(2, b.rx-d), Math.max(2, b.ry-d), b.rot||0, 0, Math.PI*2);
    return p; };
  const RIM = 3;
  c2.strokeStyle = P.rim; c2.lineWidth = RIM;
  for(const b of g.leaves) c2.stroke(lobe(b, 1, 1));
  const inner = new Path2D();
  for(const b of g.leaves) inner.addPath(lobeIn(b, RIM*0.5));
  c2.save(); c2.clip(inner);
  const bg = c2.createLinearGradient(g.cx-g.rx*0.4, g.cy-g.ry, g.cx+g.rx*0.3, g.cy+g.ry);
  bg.addColorStop(0, P.base[0]); bg.addColorStop(0.34, P.base[1]);
  bg.addColorStop(0.70, P.base[2]); bg.addColorStop(1, P.base[3]);
  c2.fillStyle = bg; c2.fill(sil);
  for(const b of g.leaves){                     // each knob swells; its edge stays CLOSE to the mid tone, or
    const ox = g.cx+b.dx, oy = g.cy+b.dy;       // every lobe wears a dark ring and the hand falls apart
    c2.save(); c2.clip(lobeIn(b, RIM*0.5));
    const dome = c2.createRadialGradient(ox-b.rx*0.20, oy-b.ry*0.56, b.ry*0.05, ox, oy+b.ry*0.30, b.rx*1.05);
    dome.addColorStop(0, P.dome[0]); dome.addColorStop(0.42, P.dome[1]);
    dome.addColorStop(0.82, P.dome[2]); dome.addColorStop(1, P.dome[3]);
    c2.fillStyle = dome; c2.fill(lobe(b, 1, 1));
    c2.translate(ox, oy); c2.rotate(b.rot||0);  // ring ridges: at the joints and the tips, not ruled evenly
    const bands = b.tip ? 4 : 3;
    for(let i=0;i<bands;i++){
      const lx = b.rx*(b.tip ? 0.22 + i*0.18 : -0.52 + i*0.20);
      const q = 1 - (lx/b.rx)*(lx/b.rx);
      if(q <= 0) continue;
      const hgt = b.ry*Math.sqrt(q)*0.80;
      c2.strokeStyle = P.ridge; c2.lineWidth = 2.1; c2.lineCap = 'round';
      c2.beginPath(); c2.moveTo(lx, -hgt);
      c2.quadraticCurveTo(lx + b.rx*0.055, 0, lx, hgt); c2.stroke();
      c2.strokeStyle = P.lip; c2.lineWidth = 1.6;
      c2.beginPath(); c2.moveTo(lx-2.6, -hgt*0.94);
      c2.quadraticCurveTo(lx + b.rx*0.055 - 2.6, 0, lx-2.6, hgt*0.94); c2.stroke();
    }
    c2.restore();
  }
  /* CONTACT SHADOWS: a finger casts its shadow on the body JUST OUTSIDE its own outline, so the dark is a
     narrow annulus hugging the finger, clipped to the body lobe it grows from. Filling the whole overlap
     greys out half the rhizome; stroking the outline reads as loose sausages. */
  for(const f of g.leaves){
    if(!f.tip) continue;
    for(const b of g.leaves){
      if(!b.mass) continue;
      c2.save(); c2.clip(lobeIn(b, RIM*0.5));
      for(const [o, i2, a] of [[1.07, 1.00, 0.30], [1.15, 1.07, 0.17], [1.24, 1.15, 0.08]]){
        const ring = new Path2D();
        ring.addPath(lobe(f, o, o)); ring.addPath(lobe(f, i2, i2));
        c2.fillStyle = P.occl.replace('$A', a);
        c2.fill(ring, 'evenodd');
      }
      c2.restore();
    }
  }
  for(const b of g.leaves){                     // a blunt, slightly paler finger end
    if(!b.tip) continue;
    const m = Math.hypot(b.dx, b.dy) || 1;
    const sx = g.cx + b.dx + (b.dx/m)*b.rx*0.46, sy = g.cy + b.dy + (b.dy/m)*b.ry*0.46;
    const ng = c2.createRadialGradient(sx-b.ry*0.10, sy-b.ry*0.14, 1, sx, sy, b.ry*0.62);
    ng.addColorStop(0, P.node[0]); ng.addColorStop(0.58, P.node[1]); ng.addColorStop(1, P.node[2]);
    c2.fillStyle = ng;
    c2.beginPath(); c2.ellipse(sx, sy, b.ry*0.42, b.ry*0.30, b.rot||0, 0, Math.PI*2); c2.fill();
    c2.strokeStyle = P.ridge; c2.lineWidth = 1.4;
    c2.beginPath(); c2.ellipse(sx, sy, b.ry*0.50, b.ry*0.37, b.rot||0, 0, Math.PI*2); c2.stroke();
  }
  if(P.freckle) for(let i=0;i<70;i++){          // corky freckles: the SHELL has them, the shaved flesh does not
    const a = i*2.399, r = Math.sqrt((i+0.5)/70);
    const x = g.cx + Math.cos(a)*g.rx*r*0.94, y = g.cy + Math.sin(a)*g.ry*r*0.94;
    c2.fillStyle = i%3 ? P.freckle[0] : P.freckle[1];
    c2.beginPath(); c2.ellipse(x, y, 2 + (i%4)*0.55, 1.3 + (i%3)*0.45, a, 0, Math.PI*2); c2.fill();
  }
  /* ONE LIGHT over the whole hand: eight per-lobe domes are eight little suns. A multiply pass grades the
     finished body across a single upper-left source. */
  c2.globalCompositeOperation = 'multiply';
  const glob = c2.createLinearGradient(g.cx-g.rx*0.8, g.cy-g.ry, g.cx+g.rx*0.8, g.cy+g.ry);
  glob.addColorStop(0, P.grade[0]); glob.addColorStop(0.44, P.grade[1]);
  glob.addColorStop(0.80, P.grade[2]); glob.addColorStop(1, P.grade[3]);
  c2.fillStyle = glob; c2.fill(sil);
  c2.globalCompositeOperation = 'source-over';
  const shade = c2.createLinearGradient(g.cx, g.cy+g.ry*0.04, g.cx, g.cy+g.ry);
  shade.addColorStop(0, P.under.replace('$A', 0)); shade.addColorStop(1, P.under.replace('$A', 0.40));
  c2.fillStyle = shade; c2.fill(sil);
  const lit = c2.createLinearGradient(g.cx-g.rx*0.5, g.cy-g.ry, g.cx+g.rx*0.15, g.cy+g.ry*0.05);
  lit.addColorStop(0, P.sheen.replace('$A', 0.30)); lit.addColorStop(1, P.sheen.replace('$A', 0));
  c2.fillStyle = lit; c2.fill(sil);
  c2.restore();
}

/* KNIFECRAFT — PAINT entries for the five new ingredients.
   Drop each method into the existing `const PAINT = { ... }` object verbatim. They use only helpers the
   file already has: silPath, innerGeom, taperY/taperH, and (for cilantro) parsleyLeafShape.
   Nothing here is new machinery. */

const PAINT_ADDITIONS = {
  /* LIME — lemon's painter with the palette shifted to green: deep peel green rind, the same white pith
     ring (a lime's pith is white too), pale yellow-green flesh, and the same membrane/vesicle scaffold. */
  lime(c2, g){
    const rind = c2.createRadialGradient(g.cx-g.rx*0.30, g.cy-g.ry*0.36, g.rx*0.16, g.cx, g.cy, g.rx*1.10);
    rind.addColorStop(0,'#A8C94A'); rind.addColorStop(0.58,'#7FAE31'); rind.addColorStop(1,'#537D1C');
    c2.fillStyle = rind; c2.fill(silPath(g, 0));
    c2.save(); c2.clip(silPath(g, 0));               // peel pores, kept to the outer band only
    c2.fillStyle = 'rgba(58,84,14,0.18)';
    for(let i=0;i<120;i++){
      const a = i*2.399963, r = 0.80 + 0.19*((i*7919 % 97)/97);   // golden angle: even, deterministic scatter
      c2.beginPath(); c2.arc(g.cx + Math.cos(a)*g.rx*r, g.cy + Math.sin(a)*g.ry*r, 1.5, 0, Math.PI*2); c2.fill();
    }
    c2.restore();
    const pith = innerGeom(g, 11);                   // the white layer — without it a cut reads as melon
    c2.fillStyle = '#F4F6E2'; c2.fill(silPath(pith, 0));
    const flesh = innerGeom(g, 17);
    const fg = c2.createRadialGradient(g.cx-g.rx*0.20, g.cy-g.ry*0.24, g.rx*0.10, g.cx, g.cy, g.rx*0.90);
    fg.addColorStop(0,'#EAF4BE'); fg.addColorStop(0.70,'#D8EA95'); fg.addColorStop(1,'#C4DB78');
    c2.fillStyle = fg; c2.fill(silPath(flesh, 0));
    c2.save(); c2.clip(silPath(flesh, 0));
    const SEG = 9;
    for(let s=0;s<SEG;s++){
      const a0 = (s/SEG)*Math.PI*2 + 0.22;
      c2.strokeStyle = 'rgba(255,255,255,0.20)'; c2.lineWidth = 1;   // juice vesicles within the segment
      for(let k=1;k<=5;k++){
        const a = a0 + (Math.PI*2/SEG)*(k/6);
        c2.beginPath();
        c2.moveTo(g.cx + Math.cos(a)*g.rx*0.14, g.cy + Math.sin(a)*g.ry*0.14);
        c2.lineTo(g.cx + Math.cos(a)*g.rx*0.80, g.cy + Math.sin(a)*g.ry*0.80);
        c2.stroke();
      }
      c2.strokeStyle = 'rgba(246,250,226,0.92)'; c2.lineWidth = 3.2; // the membrane between segments
      c2.beginPath();
      c2.moveTo(g.cx + Math.cos(a0)*g.rx*0.06, g.cy + Math.sin(a0)*g.ry*0.06);
      c2.lineTo(g.cx + Math.cos(a0)*g.rx*0.94, g.cy + Math.sin(a0)*g.ry*0.94);
      c2.stroke();
    }
    c2.fillStyle = '#F2F7DC';
    c2.beginPath(); c2.ellipse(g.cx, g.cy, g.rx*0.10, g.ry*0.10, 0, 0, Math.PI*2); c2.fill();
    c2.restore();
    c2.save(); c2.globalAlpha = 0.28;
    const hg = c2.createRadialGradient(g.cx-g.rx*0.34, g.cy-g.ry*0.40, 2, g.cx-g.rx*0.34, g.cy-g.ry*0.40, g.rx*0.44);
    hg.addColorStop(0,'#FBFFEA'); hg.addColorStop(1,'rgba(251,255,234,0)');
    c2.fillStyle = hg;
    c2.beginPath(); c2.ellipse(g.cx-g.rx*0.34, g.cy-g.ry*0.40, g.rx*0.40, g.ry*0.28, -0.32, 0, Math.PI*2); c2.fill();
    c2.restore();
  },
  /* CILANTRO — parsley's painter, unchanged except for palette and vein weight. The shape difference lives
     entirely in parsleyLeafShape's round variant (geom.leafRound), so both herbs share one blade generator. */
  cilantro(c2, g){
    // light interior → medium body → darker edge; fresh matte green, four subtle variants
    const TONES = [ ['#9AD56F','#74B851','#55913A'], ['#92CE66','#6DAF49','#4E8834'],
                    ['#A5DC7A','#7FC158','#5C9A40'], ['#8CC95F','#68A944','#4A8232'] ];
    for(const L of g.leaves){
      if(!L.stem) continue;
      c2.save(); c2.translate(g.cx+L.dx, g.cy+L.dy); c2.rotate(L.rot||0);
      const sg = c2.createLinearGradient(0, -L.ry, 0, L.ry);
      sg.addColorStop(0,'#A9C878'); sg.addColorStop(0.5,'#7BA24B'); sg.addColorStop(1,'#5E8339');
      c2.fillStyle = sg;
      c2.beginPath(); c2.ellipse(0, 0, L.rx, L.ry, 0, 0, Math.PI*2); c2.fill();
      c2.restore();
    }
    /* Flat-leaf parsley is TRIFID: three narrow-necked lobes fanning from the petiole point, each drawn to a
       point and cut by sharp V teeth, with the sinuses between lobes reaching well back toward the base. Two
       earlier passes failed for reasons worth recording: a width profile along ONE axis cannot divide a leaf
       (it gave a spiky almond), and three lobes radiating from a shared origin merge into one mass unless the
       fan is wide AND the lobes are narrow — which is why the leaf ellipses are near-round rather than flat.
       The outline itself lives in parsleyLeafShape so the plate clips to exactly what is painted here. */
    g.leaves.forEach((L, idx) => {
      const sh = parsleyLeafShape(g, idx);
      if(!sh) return;
      const t = TONES[sh.seed % TONES.length], rx = L.rx, ry = L.ry, f = sh.fit, bx = sh.bx;
      c2.save(); c2.translate(g.cx+L.dx, g.cy+L.dy); c2.rotate(L.rot||0);
      const blade = new Path2D();
      sh.walk.forEach((q, k) => { const x = bx + q[0]*f, y = q[1]*f; k ? blade.lineTo(x, y) : blade.moveTo(x, y); });
      blade.closePath();
      const bg = c2.createLinearGradient(-rx*0.4, -ry, rx*0.4, ry);
      bg.addColorStop(0, t[0]); bg.addColorStop(0.5, t[1]); bg.addColorStop(1, t[2]);
      c2.fillStyle = bg; c2.fill(blade);
      c2.save(); c2.clip(blade);
      c2.lineCap = 'round';
      c2.strokeStyle = 'rgba(38,72,26,0.30)'; c2.lineWidth = 1.3;      // one midvein per lobe, all from the base
      for(const a of sh.axes){
        c2.beginPath(); c2.moveTo(bx, 0);
        c2.lineTo(bx + Math.cos(a.ang)*a.len*f*0.88, Math.sin(a.ang)*a.len*f*0.88); c2.stroke();
      }
      c2.strokeStyle = 'rgba(44,80,30,0.18)'; c2.lineWidth = 0.8;      // secondaries toward the teeth
      for(const a of sh.axes) for(const u of [0.46, 0.72]){
        const px = bx + Math.cos(a.ang)*a.len*f*u, py = Math.sin(a.ang)*a.len*f*u;
        for(const s2 of [-1, 1]){
          c2.beginPath(); c2.moveTo(px, py);
          c2.lineTo(px + Math.cos(a.ang + s2*0.9)*a.len*f*0.16, py + Math.sin(a.ang + s2*0.9)*a.len*f*0.16);
          c2.stroke();
        }
      }
      const hl = c2.createRadialGradient(-rx*0.10, -ry*0.42, 2, -rx*0.10, -ry*0.42, rx*0.70);
      hl.addColorStop(0,'rgba(255,255,238,0.07)'); hl.addColorStop(1,'rgba(255,255,238,0)');
      c2.fillStyle = hl; c2.fill(blade);
      c2.restore();
      c2.strokeStyle = 'rgba(40,74,26,0.32)'; c2.lineWidth = 1; c2.stroke(blade);
      c2.restore();
    });
  },
  /* SPRING ONION — seven stalks, each its own cluster lobe (asparagus's rule). The stalk is drawn as one
     outline whose half-width is a function of length: a swollen ovoid bulb over the first fifth, a pinch at the
     neck, then a near-constant tube to the tip — the reference's silhouette exactly. Colour runs along the same
     axis in four stops (root white → bulb white → pale sheath green → deep leaf green), which is the one cue
     that says spring onion and nothing else. Sheath lines, a lit top ridge, the hollow cut tube at the tip and
     a fine root fringe off the butt finish it. */
  springonion(c2, g){
    const TONES = [ ['#EAF3C8','#9ECB55','#3F7A25'], ['#E6F0C0','#96C44C','#38701F'],
                    ['#F0F7D4','#A8D262','#47842C'], ['#E2EDBA','#8FBC44','#33691C'] ];
    let i = 0;
    for(const L of g.leaves){
      const t = TONES[i++ % TONES.length], rx = L.rx, ry = L.ry;
      c2.save(); c2.translate(g.cx+L.dx, g.cy+L.dy); c2.rotate(L.rot||0);
      /* Half-width along the stalk, u=0 at the butt. The bulb is ADDED to the tube, not max()'d over it: a max
         clamps the gaussian into a flat plateau and puts a hard corner where bulb meets neck, which is what
         made the first pass read as a polygon slab. The butt itself rounds off (a bulb is a teardrop, not a
         cut face) and the green tube holds almost full thickness to a FLAT cut end, as in the reference. */
      const hw = u => {
        /* Proportion is the whole game here: a bulb much wider than the shaft turns the stalk into a dart (the
           second pass), and a bulb the same width as the shaft is a leek. The photo runs about 1.6:1 with a LONG
           soft neck, so the gaussian is wide and its amplitude modest, and the butt end is blunt, not pointed. */
        const bulb = Math.exp(-Math.pow((u-0.115)/0.115, 2));
        const tube = 0.60 + 0.035*Math.sin(u*7.0);                     // the shaft, faintly uneven
        /* The cap has to reach ZERO or the outline's first sample is a vertical wall with square corners — the
           flat-butt defect — but on a CIRCULAR arc: sqrt and pow caps both converge to a pencil point, and an
           ellipse quadrant is the only cap that reads as the end of a bulb. */
        const butt = u < 0.075 ? Math.sqrt(Math.max(0, 1 - Math.pow(1 - u/0.075, 2))) : 1;   // circular cap, not a cone
        /* And the tip: flat-cut, but a real tube has rounded corners there. 2% of the length is enough to kill
           the right angle without the ribbon-chamfer look of an earlier pass. */
        const tip  = u > 0.98 ? Math.sqrt(Math.max(0, (1-u)/0.02))*0.35 + 0.65 : 1;
        return ry*(tube + 0.42*bulb)*butt*tip;
      };
      /* COSINE SAMPLING, not uniform. The caps occupy a few percent of the length, so 64 even samples put only
         four or five points in each one and the round cap came out as a polygonal V — the "pointy butt" that
         survived two shape fixes. Clustering the samples at both ends resolves the caps without more points. */
      const N = 72, uAt = k => 0.5 - 0.5*Math.cos(Math.PI*k/N), stalk = new Path2D();
      for(let k=0;k<=N;k++){ const u = uAt(k), x = -rx + 2*rx*u, y = -hw(u);
        k ? stalk.lineTo(x, y) : stalk.moveTo(x, y); }
      for(let k=N;k>=0;k--){ const u = uAt(k); stalk.lineTo(-rx + 2*rx*u, hw(u)); }
      stalk.closePath();
      const bg = c2.createLinearGradient(-rx, 0, rx, 0);
      bg.addColorStop(0.00,'#FCFCF4'); bg.addColorStop(0.20,'#F7F8E8');   // bulb: white, barely warm
      bg.addColorStop(0.30, t[0]); bg.addColorStop(0.58, t[1]); bg.addColorStop(0.86, t[2]); bg.addColorStop(1.00, t[2]);
      c2.fillStyle = bg; c2.fill(stalk);
      c2.save(); c2.clip(stalk);
      /* Cross-section shading AND the contact shadow in one gradient. The stalks overlap (a bound bunch), and
         with only a bottom shade the overlapping white bulbs fused into one slab; a narrow dark band along each
         stalk's own TOP edge is the shadow the stalk above casts on it, which is what separates them. */
      const shade = c2.createLinearGradient(0, -ry, 0, ry);
      shade.addColorStop(0.00,'rgba(40,58,22,0.26)');                    // shadow of the stalk lying over this one
      shade.addColorStop(0.14,'rgba(255,255,236,0.14)');
      shade.addColorStop(0.30,'rgba(255,255,236,0.30)');                 // the lit crown of the tube
      shade.addColorStop(0.56,'rgba(255,255,236,0)');
      shade.addColorStop(1.00,'rgba(26,48,14,0.32)');
      c2.fillStyle = shade; c2.fill(stalk);
      c2.lineCap = 'round';
      c2.strokeStyle = 'rgba(255,255,238,0.40)'; c2.lineWidth = 1.8;      // lit ridge down the top of the tube
      c2.beginPath(); c2.moveTo(-rx*0.66, -ry*0.30);
      c2.quadraticCurveTo(0, -ry*0.34, rx*0.92, -ry*0.26); c2.stroke();
      c2.strokeStyle = 'rgba(52,86,30,0.13)'; c2.lineWidth = 1.0;         // lengthwise leaf fibres, green half only
      for(const fy of [-0.46, -0.10, 0.28, 0.56]){
        c2.beginPath(); c2.moveTo(-rx*0.05, ry*fy*0.9);
        c2.quadraticCurveTo(rx*0.5, ry*fy, rx*0.95, ry*fy*0.8); c2.stroke();
      }
      /* SHEATH COLLARS sit where the sheaths actually part — at the white→green transition. Painted mid-bulb
         they were three crescents floating in white with nothing to attach to. */
      c2.strokeStyle = 'rgba(150,178,96,0.40)'; c2.lineWidth = 1.3;
      for(const u of [0.28, 0.32, 0.36]){
        const x0 = -rx + 2*rx*u, hy = hw(u)*0.86;
        c2.beginPath(); c2.moveTo(x0, -hy);
        c2.quadraticCurveTo(x0 + rx*0.03, 0, x0, hy); c2.stroke();
      }
      c2.restore();
      /* The cut end: a squared face of leaf wall with the hollow as a long thin slit down it — drawn short and
         round it read as a keyhole punched in the tip, which is what the ring in the second pass was. */
      c2.fillStyle = '#2C5A1E';
      c2.beginPath(); c2.ellipse(rx*0.955, 0, ry*0.085, hw(0.955)*0.90, 0, 0, Math.PI*2); c2.fill();
      c2.fillStyle = '#16380F';
      c2.beginPath(); c2.ellipse(rx*0.955, 0, ry*0.042, hw(0.955)*0.58, 0, 0, Math.PI*2); c2.fill();
      /* ROOT TUFT — splayed, not a comb: each hair gets its own length, its own fan angle off the butt and its
         own bow, so the fringe reads as the photo's dense tangle rather than a row of equal bristles. */
      c2.lineCap = 'round';
      for(let k=0;k<26;k++){
        const r1 = ((k*7919) % 101)/101, r2 = ((k*104729) % 97)/97, r3 = ((k*40503) % 89)/89;
        /* The hairs leave from the BULB TIP now that the butt converges: spread along the first few percent of
           the taper rather than along a flat end wall, so the tuft grows out of a point. */
        const u0 = 0.006 + 0.055*Math.abs((k/25)*2 - 1);
        const y0 = ((k/25)*2 - 1)*hw(u0)*0.75;
        const ln = 5 + 10*r1, ang = (y0/(ry||1))*0.75 + (r2 - 0.5)*0.9;
        const x0 = -rx + 2*rx*u0, ex = x0 - Math.cos(ang)*ln, ey = y0 + Math.sin(ang)*ln;
        c2.strokeStyle = r3 > 0.5 ? 'rgba(232,224,192,0.88)' : 'rgba(206,196,160,0.72)';
        c2.lineWidth = 0.8 + 0.7*r3;
        c2.beginPath(); c2.moveTo(x0, y0*0.8);
        c2.quadraticCurveTo(x0 - ln*0.45, y0 + (r2-0.5)*8, ex, ey); c2.stroke();
      }
      c2.strokeStyle = 'rgba(44,74,26,0.45)'; c2.lineWidth = 1.5; c2.stroke(stalk);
      c2.restore();
    }
  },
  /* GREEN CHILLI — a glossy pod. Three things carry it: the value range across the body (yellow-green lit
     flank over a deep shaded underside, which is what makes a cylinder), one long hard SPECULAR streak broken
     into segments (a chilli's skin is the shiniest thing on this board), and the crooked stalk with its
     five-pointed calyx painted past the butt. The pale inner flesh is inset so a cut face opens onto seed
     wall rather than more skin. */
  chilli(c2, g){
    const sil = silPath(g, 0);
    const sk = c2.createLinearGradient(g.cx, g.cy-g.rBig*1.1, g.cx, g.cy+g.rBig*1.3);
    sk.addColorStop(0,'#8CC62E'); sk.addColorStop(0.24,'#6FAF1E');
    sk.addColorStop(0.58,'#4E8E14'); sk.addColorStop(0.84,'#356D0E'); sk.addColorStop(1,'#234E0A');
    c2.fillStyle = sk; c2.fill(sil);
    c2.save(); c2.clip(sil);
    const along = c2.createLinearGradient(g.cx-g.rx, g.cy, g.cx+g.rx, g.cy);   // the tip darkens and dries
    along.addColorStop(0,'rgba(96,150,28,0.20)'); along.addColorStop(0.55,'rgba(255,255,255,0)');
    along.addColorStop(1,'rgba(28,58,8,0.40)');
    c2.fillStyle = along; c2.fill(sil);
    const N = 40;                                                 // the specular: segmented, along the bow
    for(let i=0;i<N;i++){
      const t = i/(N-1), x = g.cx - g.rx*0.86 + 1.68*g.rx*t*0.86;
      const hh = taperH(g, x);
      if(hh <= 0) continue;
      const y = taperY(g, x) - hh*0.46;
      // gloss, not a painted line: the streak thins toward the tip and breaks twice along the way
      const brk = Math.sin(t*7.4) > -0.55 ? 1 : 0;
      if(!brk) continue;
      const w = hh*0.30*(1 - 0.45*t);
      c2.fillStyle = 'rgba(232,250,196,' + (0.34 - 0.22*t).toFixed(3) + ')';
      c2.beginPath(); c2.ellipse(x, y, w*1.9, w*0.52, 0.06, 0, Math.PI*2); c2.fill();
    }
    for(let i=0;i<5;i++){                                         // faint length creases down the shaded flank
      const f = 0.24 + i*0.16;
      c2.strokeStyle = 'rgba(40,78,14,0.16)'; c2.lineWidth = 1.2;
      c2.beginPath();
      for(let k=0;k<=24;k++){
        const x = g.cx - g.rx*0.84 + 1.66*g.rx*(k/24)*0.84, hh = taperH(g, x);
        if(hh <= 0) continue;
        const y = taperY(g, x) + hh*f;
        k ? c2.lineTo(x, y) : c2.moveTo(x, y);
      }
      c2.stroke();
    }
    /* The flesh is a THIN inner core, not a window: a pod is 4cm thick at most, so an inset generous enough
       to read on a carrot turns the whole chilli pale and it stops being a chilli. */
    /* The flesh core is confined to the MID-BODY: run it to the tip and the fine point lights up as a pale
       bead, which is what the first pass did. A pod is thin, so the core is narrow as well as short. */
    const flesh = innerGeom(g, 30);
    const fg = c2.createLinearGradient(g.cx-g.rx, g.cy, g.cx+g.rx*0.7, g.cy);   // fades out at both ends, so
    fg.addColorStop(0,'rgba(196,222,140,0)');                                    // no hard band and no pale
    fg.addColorStop(0.30,'rgba(196,222,140,0.85)');                              // bead at the fine tip
    fg.addColorStop(0.62,'rgba(178,208,118,0.75)');
    fg.addColorStop(1,'rgba(163,193,105,0)');
    c2.fillStyle = fg; c2.fill(silPath(flesh, 0));
    c2.restore();
    /* CALYX + STALK, past the butt: paint only. A five-pointed green collar clasping the shoulder, then a
       woody stalk that kinks once and dries to straw at its cut end — the reference's most identifying part. */
    const bx = g.cx - g.rx*0.94, by = taperY(g, g.cx - g.rx*0.92);
    c2.save(); c2.translate(bx, by); c2.rotate(-2.05);   // continues the body's line, tipping up and back
    const stalk = c2.createLinearGradient(0, 0, 0, -120);
    stalk.addColorStop(0,'#41701A'); stalk.addColorStop(0.55,'#5B8A26'); stalk.addColorStop(1,'#9FAE62');
    c2.strokeStyle = stalk; c2.lineCap = 'round';
    c2.lineWidth = 17;                                            // thick where it leaves the shoulder,
    c2.beginPath(); c2.moveTo(0, 0); c2.quadraticCurveTo(-4, -34, 10, -62); c2.stroke();
    c2.lineWidth = 10;                                            // thinner and kinked past the bend
    c2.beginPath(); c2.moveTo(10, -62); c2.quadraticCurveTo(26, -88, 52, -102); c2.stroke();
    c2.strokeStyle = 'rgba(206,228,152,0.34)'; c2.lineWidth = 3;   // a lit edge up the stalk
    c2.beginPath(); c2.moveTo(-3, -6);
    c2.bezierCurveTo(-9, -46, 13, -80, 41, -100); c2.stroke();
    const cal = c2.createLinearGradient(-26, -26, 26, 26);
    cal.addColorStop(0,'#7FB030'); cal.addColorStop(0.6,'#578A1C'); cal.addColorStop(1,'#375F10');
    c2.fillStyle = cal;
    for(let i=0;i<5;i++){                                         // the collar: five short pointed lobes
      const a = -1.5 + i*0.62;
      c2.save(); c2.rotate(a);
      c2.beginPath(); c2.moveTo(0, 0);
      c2.quadraticCurveTo(15, 10, 6, 26);
      c2.quadraticCurveTo(-5, 13, 0, 0); c2.closePath(); c2.fill();
      c2.restore();
    }
    c2.fillStyle = '#568A1E';
    c2.beginPath(); c2.ellipse(0, 4, 16, 12, 0, 0, Math.PI*2); c2.fill();
    c2.strokeStyle = 'rgba(40,74,14,0.36)'; c2.lineWidth = 1.4; c2.stroke();
    c2.restore();
    c2.strokeStyle = 'rgba(26,54,8,0.46)'; c2.lineWidth = 1.8; c2.stroke(sil);
  },
  /* GINGER, PEELED — the base sprite, because ginger is a peelable food (see skinAlpha). The shaved rhizome is
     pale butter yellow, smooth and faintly waxy: same knobs and ridges, fainter, and NO corky freckles — the
     freckles are the skin's. */
  ginger(c2, g){
    gingerBody(c2, g, {
      rim:'#C7A24C',
      base:  ['#FDF6D2','#F8E9A2','#EBD173','#C9A544'],
      dome:  ['#FFFBDC','#FAEDA9','#F0DD88','#D6BC5F'],
      ridge: 'rgba(176,140,52,0.26)',  lip: 'rgba(255,253,226,0.52)',
      occl:  'rgba(150,118,40,$A)',
      node:  ['#FFFDE6','#F5E9AE','rgba(214,186,104,0)'],
      freckle: null,
      grade: ['#FFFFFB','#FDF6DC','#E9D496','#CEB268'],
      under: 'rgba(128,100,28,$A)', sheen: 'rgba(255,255,238,$A)',
    });
  },
};

/* SKIN entry — ginger only (it is peelable: corky tan shell over pale flesh). Goes into `const SKIN`. */

const SKIN_ADDITIONS = {
  /* GINGER SKIN — the unpeeled hand: the same knobs and ridges in warm corky tan, plus the freckle mat that
     only the shell has. It SHEDS on the rub (not in SKIN_KEEP), which is the difference between the two halves
     of the reference. */
  ginger(c2, g){
    gingerBody(c2, g, {
      rim:'#8A6634',
      base:  ['#F4E6C6','#E4CFA0','#C2A067','#8E6B36'],
      dome:  ['#F6EAC9','#EAD6A6','#D8BE8A','#C2A470'],
      ridge: 'rgba(122,88,38,0.30)',  lip: 'rgba(255,248,222,0.42)',
      occl:  'rgba(88,60,24,$A)',
      node:  ['#F8EDCD','#E3CB99','rgba(176,138,78,0)'],
      freckle: ['rgba(132,96,44,0.13)','rgba(80,54,20,0.11)'],
      grade: ['#FFFDF6','#F6EBD6','#D8BC92','#BC9A6A'],
      under: 'rgba(70,46,16,$A)', sheen: 'rgba(255,250,230,$A)',
    });
  },
};
