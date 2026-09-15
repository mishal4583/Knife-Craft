import Phaser from "phaser";
import { BATCH_1 } from "../ingredients";
import { place, strokePoly } from "../ingredients/shapeUtils";

export type PreviewMode = "whole" | "cross" | "silhouette";

/**
 * DEV ONLY — visual QA scene for the Batch 1 ingredient art.
 * It renders the exact same IngredientVisualDefinition API the real
 * PreparationScene consumes; no gameplay systems are involved.
 */
export class IngredientPreviewScene extends Phaser.Scene {
  static KEY = "IngredientPreview";
  private g!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private mode: PreviewMode = "whole";
  private previewScale = 1;

  constructor() {
    super(IngredientPreviewScene.KEY);
  }

  create() {
    this.g = this.add.graphics();
    this.game.events.on("preview:mode", (m: PreviewMode) => {
      this.mode = m;
      this.redraw();
    });
    this.game.events.on("preview:scale", (s: number) => {
      this.previewScale = s;
      this.redraw();
    });
    this.redraw();
  }

  private redraw() {
    const g = this.g;
    g.clear();
    this.labels.forEach((l) => l.destroy());
    this.labels = [];

    const W = this.scale.width;
    const H = this.scale.height;
    const cols = 3;
    const rows = 2;
    const cw = W / cols;
    const ch = H / rows;

    // counter + board backdrop, matching the cozy kitchen direction
    g.fillStyle(0x6b4226, 1);
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < cols * rows; i++) {
      const cx = (i % cols) * cw;
      const cy = Math.floor(i / cols) * ch;
      g.fillStyle(i % 2 ? 0x7a4c2c : 0x74472a, 1);
      g.fillRect(cx, cy, cw, ch);
      g.fillStyle(0x8a6238, 0.55);
      g.fillRoundedRect(cx + 24, cy + 24, cw - 48, ch - 48, 36);
    }

    BATCH_1.forEach((def, i) => {
      const cx = (i % cols) * cw + cw / 2;
      const cy = Math.floor(i / cols) * ch + ch / 2 + 10;
      const fit = Math.min((cw - 130) / def.width, (ch - 170) / def.height) * this.previewScale;

      if (this.mode === "silhouette") {
        const sil = def.getSilhouette();
        g.fillStyle(0x3e2819, 0.9);
        g.fillPoints(
          place(sil.outline, cx, cy, fit) as unknown as Phaser.Math.Vector2[],
          true,
          true,
        );
        strokePoly(g, place(sil.outline, cx, cy, fit), 0xf6e8cc, 2, 0.9);
        sil.regions?.forEach((r) =>
          strokePoly(g, place(r.outline, cx, cy, fit), 0xb87333, 1.5, 0.7),
        );
      } else if (this.mode === "cross" && def.drawCrossSection) {
        def.drawCrossSection(g, cx, cy, fit);
      } else {
        def.drawWhole(g, cx, cy, fit);
      }

      const label = this.add
        .text(cx, Math.floor(i / cols) * ch + ch - 46, def.label, {
          fontFamily: "Nunito, sans-serif",
          fontSize: "26px",
          color: "#F6E8CC",
        })
        .setOrigin(0.5);
      this.labels.push(label);
    });
  }
}
