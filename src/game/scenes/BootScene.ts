import Phaser from "phaser";

/**
 * BOOT_SCENE — configures the renderer, then hands off immediately.
 * Kept separate from PreloadScene per the migration brief's scene
 * structure (§35): boot config vs. asset loading are different concerns
 * even though both are quick.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    this.scale.on("resize", () => {
      // No-op here — PreparationScene owns responsive relayout. Boot just
      // needs to exist so the scale manager has fired at least once
      // before Preload measures anything.
    });
    this.scene.start("Preload");
  }
}
