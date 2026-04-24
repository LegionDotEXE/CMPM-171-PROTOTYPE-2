import { EFFECT_CONFIG, EFFECT_STYLE } from "../../constants/swipeConfig.js";

// hack overlay: dark green backdrop tint + matrix-style falling binary rain.
// single responsibility - this file only draws the hack visual.
// the dispatcher (SwipeEffects) decides WHEN to call play().
export const HackOverlay = {
  // public entry for the dispatcher.
  // input: scene. output: promise resolved after fade + cleanup.
  play(scene) {
    const backdrop = this.createBackdrop(scene);
    const columns = this.createColumns(scene);
    return this.animateSequence(scene, backdrop, columns);
  },

  // full-screen green rectangle used as the tint layer.
  createBackdrop(scene) {
    const camera = scene.cameras.main;
    return scene.add
      .rectangle(
        camera.width / 2,
        camera.height / 2,
        camera.width,
        camera.height,
        EFFECT_STYLE.hackTintColor,
        EFFECT_STYLE.hackTintAlphaStart
      )
      .setDepth(EFFECT_CONFIG.depth);
  },

  // build one falling text column per hackColumnSpacing across the camera.
  // output: array of text game objects (cleaned up in animateSequence).
  createColumns(scene) {
    const columns = [];
    const camera = scene.cameras.main;
    for (let x = 0; x <= camera.width; x += EFFECT_CONFIG.hackColumnSpacing) {
      columns.push(this.createColumn(scene, x, camera.height + EFFECT_STYLE.hackExtraFallY));
    }
    return columns;
  },

  // one falling column of 0s and 1s.
  // input: scene, x position, y to fall down to.
  createColumn(scene, x, targetY) {
    const column = scene.add.text(x, EFFECT_STYLE.hackSpawnYOffset, this.makeBinaryText(), {
      color: EFFECT_STYLE.hackTextColor,
      fontSize: EFFECT_STYLE.hackTextFontSize,
      fontFamily: EFFECT_STYLE.hackTextFontFamily,
    });
    column.setDepth(EFFECT_CONFIG.depth + 1).setAlpha(EFFECT_STYLE.hackColumnAlpha);
    column.setStroke(EFFECT_STYLE.hackTextStrokeColor, EFFECT_STYLE.hackColumnStrokeWidth);
    column.setShadow(0, 0, EFFECT_STYLE.hackTextShadowColor, EFFECT_STYLE.hackTextShadowBlur, true, true);
    scene.tweens.add({
      targets: column,
      y: targetY,
      duration: Phaser.Math.Between(EFFECT_CONFIG.hackRainMinMs, EFFECT_CONFIG.hackRainMaxMs),
      ease: "Sine.easeInOut",
    });
    return column;
  },

  // build a vertical string of random 0s and 1s.
  // length controlled by EFFECT_CONFIG.hackBinaryLength.
  makeBinaryText() {
    const digits = [];
    for (let i = 0; i < EFFECT_CONFIG.hackBinaryLength; i += 1) {
      digits.push(Math.random() > 0.5 ? "1" : "0");
    }
    return digits.join("\n");
  },

  // grow backdrop alpha, hold, then fade out and destroy every temp object.
  // returns promise so the commit flow can await it cleanly.
  animateSequence(scene, backdrop, columns) {
    return new Promise((resolve) => {
      scene.tweens.add({
        targets: backdrop,
        alpha: EFFECT_STYLE.hackTintAlphaPeak,
        duration: EFFECT_CONFIG.hackGrowMs,
        ease: "Sine.easeOut",
        onComplete: () => this.fadeOut(scene, backdrop, columns, resolve),
      });
    });
  },

  // final fade + destroy pass. runs after grow-in completes.
  fadeOut(scene, backdrop, columns, resolve) {
    scene.tweens.add({
      targets: [backdrop, ...columns],
      alpha: 0,
      delay: EFFECT_CONFIG.hackHoldMs,
      duration: EFFECT_CONFIG.hackFadeMs,
      ease: "Cubic.easeOut",
      onComplete: () => {
        backdrop.destroy();
        columns.forEach((column) => column.destroy());
        resolve();
      },
    });
  },
};
