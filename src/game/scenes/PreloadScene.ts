import Phaser from "phaser";

/**
 * PRELOAD_SCENE — loads only what Phase 1 needs (§31: keep the initial
 * bundle small). The tomato and cutting board are painted procedurally
 * (see textures/boardTexture.ts and PreparationScene.drawTomatoShape) —
 * ported from knifecraft.html's own Canvas 2D paint functions — so there
 * is no ingredient/board image asset to preload here. Adding an
 * ingredient later means adding a PAINT-style function plus an entry in
 * definitions.ts, not touching this scene's structure.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("Preload");
  }

  create(): void {
    this.scene.start("Preparation");
  }
}
