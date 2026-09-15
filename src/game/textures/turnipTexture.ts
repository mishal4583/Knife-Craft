/**
 * TURNIP_TEXTURE — ported directly from knifecraft.html's actual
 * `SKIN.turnip()` (source line 7568) — the source's PERMANENT skin layer,
 * which is genuinely the whole visible root (a separate, undocumented
 * "TURNIP BASE"/`PAINT.turnip()` exists at line 7481, but its own comment
 * says it's just the ivory ground SKIN.turnip paints over, never seen on
 * its own — so this, not that, is the real ported visual). The magenta
 * cap is NOT a gradient stop (a hard/soft stop reads as a printed band):
 * five nested wobbly washes at rising opacity ramp to near-solid at the
 * crown and fade to nothing by the waist, over fine vertical striations,
 * a sheen, a glare, and a base shade.
 *
 * The source's taproot + leaf stalks are a bezier-ribbon system drawn
 * PAST the silhouette (`drawOverhang`, source line ~7610) — not ported:
 * PreparationScene's own piece-rendering pipeline (pieceBounds/
 * regionGeom in CutGeometry.ts) crops every piece, including the whole
 * uncut ingredient, to the collision silhouette's own rx/ry bounds, so
 * that geometry would be invisible in production regardless (see
 * cornTexture.ts's own doc for the fuller explanation of this
 * architecture constraint). The crown SCAR the stalks leave — the one
 * piece of that system actually painted INSIDE the silhouette — is kept.
 */
export function turnipTextureSize(
  rx: number,
  ry: number,
  margin: number,
): { w: number; h: number } {
  return { w: (rx + margin) * 2, h: (ry + margin) * 2 };
}

export function paintTurnipTexture(
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

  const base = ctx.createLinearGradient(cx, cy - ry, cx, cy + ry);
  base.addColorStop(0, "#F8F1E3");
  base.addColorStop(0.52, "#F7ECDB");
  base.addColorStop(0.84, "#EFE0C6");
  base.addColorStop(1, "#E2CFAE");
  ctx.fillStyle = base;
  sil();
  ctx.fill();

  ctx.save();
  sil();
  ctx.clip();

  // everything above a wandering line at height fraction k (of ry, from center)
  const capTo = (k: number): Path2D => {
    const p = new Path2D();
    const N = 48;
    const X = rx + 10;
    p.moveTo(cx - X, cy - ry - 10);
    p.lineTo(cx + X, cy - ry - 10);
    for (let i = N; i >= 0; i--) {
      const u = -1 + (2 * i) / N;
      const yb =
        cy + ry * (k + 0.085 * Math.sin(u * 3.3 + 1.2) + 0.045 * Math.sin(u * 6.7 + 0.3) + 0.3 * u);
      p.lineTo(cx + X * u, yb);
    }
    p.closePath();
    return p;
  };
  const wash = (k: number, rgb: string, a0: number) => {
    // solid at the crown, gone by its own boundary
    const lg = ctx.createLinearGradient(cx, cy - ry * 1.02, cx, cy + ry * k);
    lg.addColorStop(0, `rgba(${rgb},${a0})`);
    lg.addColorStop(0.55, `rgba(${rgb},${(a0 * 0.72).toFixed(2)})`);
    lg.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = lg;
    ctx.fill(capTo(k));
  };
  wash(0.3, "190,58,146", 0.6);
  wash(0.14, "186,50,142", 0.54);
  wash(-0.08, "176,42,134", 0.46);
  wash(-0.44, "150,34,120", 0.32);

  ctx.lineWidth = 1.4; // fine vertical striations, both zones
  for (let i = 0; i < 46; i++) {
    const u = -0.94 + (1.88 * ((i * 7919) % 97)) / 97;
    const x = cx + rx * u;
    const hh = ((i * 6151) % 89) / 89;
    const y0 = cy - ry * (0.9 - 0.62 * hh);
    const y1 = y0 + ry * (0.16 + 0.26 * hh);
    ctx.strokeStyle = y0 < cy - ry * 0.06 ? "rgba(255,240,250,0.07)" : "rgba(202,168,112,0.09)";
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.quadraticCurveTo(x + 2, (y0 + y1) / 2, x, y1);
    ctx.stroke();
  }
  const sheen = ctx.createRadialGradient(
    cx - rx * 0.36,
    cy - ry * 0.46,
    2,
    cx - rx * 0.36,
    cy - ry * 0.46,
    rx * 0.76,
  );
  sheen.addColorStop(0, "rgba(255,244,252,0.34)");
  sheen.addColorStop(0.5, "rgba(255,244,252,0.12)");
  sheen.addColorStop(1, "rgba(255,244,252,0)");
  ctx.fillStyle = sheen;
  sil();
  ctx.fill();
  const gl = ctx.createLinearGradient(cx + rx * 0.3, cy - ry * 0.52, cx + rx * 0.66, cy + ry * 0.1);
  gl.addColorStop(0, "rgba(255,246,252,0)");
  gl.addColorStop(0.5, "rgba(255,246,252,0.26)");
  gl.addColorStop(1, "rgba(255,246,252,0)");
  ctx.fillStyle = gl;
  sil();
  ctx.fill();
  const shade = ctx.createLinearGradient(
    cx - rx * 0.4,
    cy + ry * 0.34,
    cx - rx * 0.1,
    cy + ry * 1.02,
  );
  shade.addColorStop(0, "rgba(122,96,58,0)");
  shade.addColorStop(1, "rgba(122,96,58,0.30)");
  ctx.fillStyle = shade;
  sil();
  ctx.fill();

  // the tan crown scar the (unported, past-silhouette) leaf stalks leave from
  const bx = cx + 26;
  const by = cy - ry * 0.93;
  const scar = ctx.createRadialGradient(bx, by + 2, 1, bx, by + 2, 17);
  scar.addColorStop(0, "rgba(198,166,110,0.70)");
  scar.addColorStop(0.62, "rgba(186,152,98,0.34)");
  scar.addColorStop(1, "rgba(186,152,98,0)");
  ctx.fillStyle = scar;
  ctx.beginPath();
  ctx.ellipse(bx, by + 2, 17, 9, -0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "rgba(150,90,140,0.26)";
  ctx.lineWidth = 1.4;
  sil();
  ctx.stroke();
}
