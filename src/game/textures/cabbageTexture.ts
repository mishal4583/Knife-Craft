/**
 * CABBAGE_TEXTURE — ported directly from knifecraft.html's actual
 * `PAINT.cabbage()` (source line 6447) against the real `ellipse`
 * geometry. The head is built from 8 real filled wrapping LOBES (not
 * lines drawn on a ball), each its own wobbled-radial shape with a lit
 * edge, a curving rib, a few veins, and a directional shadow — drawn
 * back-to-front and clipped by the silhouette so its far half vanishes
 * over the horizon. Fold lines come for free from the overlap between
 * lobes: each lobe's own OUTWARD arc gets an overlap groove plus a lit
 * fold line on top of it, everything else left unstroked (outlining a
 * whole lobe's ellipse made it read as a sticker).
 */
export function cabbageTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

type Lobe = {
  u: number;
  v: number;
  rx: number;
  ry: number;
  rot: number;
  lit: string;
  mid: string;
  dk: string;
  edge: number;
};

const LOBES: Lobe[] = [
  {
    u: 0.52,
    v: 0.42,
    rx: 0.7,
    ry: 0.6,
    rot: 0.6,
    lit: "#B9DC86",
    mid: "#93C263",
    dk: "#6E9F45",
    edge: 0.26,
  },
  {
    u: 0.64,
    v: -0.1,
    rx: 0.68,
    ry: 0.6,
    rot: -0.2,
    lit: "#C4E390",
    mid: "#9CCA69",
    dk: "#75A54A",
    edge: 0.28,
  },
  {
    u: 0.34,
    v: -0.56,
    rx: 0.66,
    ry: 0.58,
    rot: -0.7,
    lit: "#D2EA9E",
    mid: "#A9D474",
    dk: "#7EAD50",
    edge: 0.32,
  },
  {
    u: -0.16,
    v: 0.62,
    rx: 0.68,
    ry: 0.56,
    rot: 0.2,
    lit: "#C0DF8C",
    mid: "#98C767",
    dk: "#71A247",
    edge: 0.26,
  },
  {
    u: -0.58,
    v: 0.34,
    rx: 0.68,
    ry: 0.58,
    rot: -0.5,
    lit: "#D6ECA4",
    mid: "#ADD77A",
    dk: "#83B155",
    edge: 0.3,
  },
  {
    u: -0.62,
    v: -0.22,
    rx: 0.66,
    ry: 0.58,
    rot: 0.3,
    lit: "#E2F4B6",
    mid: "#B9E088",
    dk: "#8EBC60",
    edge: 0.34,
  },
  {
    u: -0.2,
    v: -0.62,
    rx: 0.66,
    ry: 0.56,
    rot: 0.8,
    lit: "#EBFAC6",
    mid: "#C5E894",
    dk: "#99C568",
    edge: 0.38,
  },
  {
    u: -0.06,
    v: -0.04,
    rx: 0.52,
    ry: 0.46,
    rot: 0.1,
    lit: "#E8F8C0",
    mid: "#C0E58E",
    dk: "#95C265",
    edge: 0.16,
  },
];

export function paintCabbageTexture(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  margin: number,
): void {
  const cx = rx + margin;
  const cy = ry + margin;
  ctx.clearRect(0, 0, cx * 2, cy * 2);
  const sil = () => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  };

  const skin = ctx.createRadialGradient(
    cx - rx * 0.3,
    cy - ry * 0.4,
    rx * 0.06,
    cx + rx * 0.06,
    cy + ry * 0.06,
    rx * 1.14,
  );
  skin.addColorStop(0, "#F1FCCE");
  skin.addColorStop(0.3, "#D9F49E");
  skin.addColorStop(0.62, "#B4E268");
  skin.addColorStop(0.86, "#8FCA47");
  skin.addColorStop(1, "#71AB36");
  ctx.fillStyle = skin;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let li = 0;
  for (const L of LOBES) {
    const seed = li * 2.399963 + 0.7;
    li++;
    const cxp = cx + L.u * rx;
    const cyp = cy + L.v * ry;
    ctx.save();
    ctx.translate(cxp, cyp);
    ctx.rotate(L.rot);
    const RX = L.rx * rx;
    const RY = L.ry * ry;
    const lobe = new Path2D();
    const N = 64;
    for (let k = 0; k <= N; k++) {
      const t = (k / N) * Math.PI * 2;
      const w =
        1 +
        0.035 * Math.sin(3 * t + seed) +
        0.022 * Math.sin(5 * t + seed * 1.6) +
        0.014 * Math.sin(8 * t + seed * 2.2);
      const x = Math.cos(t) * RX * w;
      const y = Math.sin(t) * RY * w;
      if (k) lobe.lineTo(x, y);
      else lobe.moveTo(x, y);
    }
    lobe.closePath();
    const lg = ctx.createLinearGradient(-RX * 0.6, -RY * 0.8, RX * 0.7, RY * 0.9);
    lg.addColorStop(0, L.lit);
    lg.addColorStop(0.52, L.mid);
    lg.addColorStop(1, L.dk);
    ctx.fillStyle = lg;
    ctx.fill(lobe);

    ctx.save();
    ctx.clip(lobe);
    const rib = new Path2D(); // the leaf's own rib, curving with the lobe
    rib.moveTo(-RX * 0.9, RY * 0.44);
    rib.quadraticCurveTo(-RX * 0.2, RY * 0.02, RX * 0.72, -RY * 0.46);
    ctx.strokeStyle = "rgba(250,255,226,0.34)";
    ctx.lineWidth = 2.4;
    ctx.stroke(rib);
    ctx.strokeStyle = "rgba(78,116,36,0.13)";
    ctx.lineWidth = 1.8;
    ctx.save();
    ctx.translate(0, 3);
    ctx.stroke(rib);
    ctx.restore();
    ctx.strokeStyle = "rgba(248,255,224,0.20)"; // a few veins off it
    ctx.lineWidth = 1.3;
    for (let v = 0; v < 5; v++) {
      const bx = -RX * 0.62 + v * (RX * 0.32);
      const by = RY * (0.16 - v * 0.1);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + RX * 0.14, by + s * RY * 0.26, bx + RX * 0.3, by + s * RY * 0.52);
        ctx.stroke();
      }
    }
    const shd = ctx.createLinearGradient(0, -RY, 0, RY);
    shd.addColorStop(0, "rgba(255,255,235,0.16)");
    shd.addColorStop(0.5, "rgba(255,255,235,0)");
    shd.addColorStop(1, "rgba(46,80,22,0.20)");
    ctx.fillStyle = shd;
    ctx.fill(lobe);
    ctx.restore();

    // Only the leaf's OUTWARD arc is a visible fold — the rest is tucked
    // under the next leaf, and outlining the whole ellipse made every
    // lobe read as a sticker.
    const hx = (cxp - cx) / rx;
    const hy = (cyp - cy) / ry;
    const hlen = Math.hypot(hx, hy) || 1e-3;
    const ax = Math.atan2(hy / hlen, hx / hlen) - L.rot;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(Math.cos(ax) * RX * 0.12, Math.sin(ax) * RY * 0.12);
    ctx.arc(0, 0, Math.max(RX, RY) * 2.4, ax - 1.25, ax + 1.25);
    ctx.closePath();
    ctx.clip();
    ctx.strokeStyle = "rgba(60,98,26,0.24)"; // the overlap groove...
    ctx.lineWidth = 3.4;
    ctx.save();
    ctx.translate(0, 3.4);
    ctx.stroke(lobe);
    ctx.restore();
    ctx.strokeStyle = `rgba(253,255,238,${L.edge})`; // ...and the lit fold on top of it
    ctx.lineWidth = 2.4;
    ctx.stroke(lobe);
    ctx.restore();
    ctx.restore();
  }

  const sh = ctx.createRadialGradient(
    cx - rx * 0.32,
    cy - ry * 0.4,
    rx * 0.1,
    cx + rx * 0.1,
    cy + ry * 0.12,
    rx * 1.1,
  );
  sh.addColorStop(0, "rgba(255,255,238,0.20)");
  sh.addColorStop(0.42, "rgba(255,255,238,0)");
  sh.addColorStop(0.74, "rgba(70,104,34,0.16)");
  sh.addColorStop(1, "rgba(44,74,20,0.48)");
  ctx.fillStyle = sh;
  sil();
  ctx.fill();
  ctx.restore();

  const stemX = cx - 0.62 * rx; // stem scar, tucked where the leaves close
  const stemY = cy + 0.66 * ry;
  ctx.fillStyle = "rgba(238,248,206,0.70)";
  ctx.beginPath();
  ctx.ellipse(stemX, stemY, rx * 0.055, ry * 0.038, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(120,158,66,0.34)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = "rgba(86,124,40,0.34)";
  ctx.lineWidth = 2;
  sil();
  ctx.stroke();
}
