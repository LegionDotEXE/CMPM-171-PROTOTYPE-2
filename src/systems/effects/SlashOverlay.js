import { EFFECT_CONFIG, EFFECT_STYLE } from "../../constants/swipeConfig.js";

// slash overlay: painted blood decal + particle burst.
// single responsibility - this file only knows how to draw blood.
// the dispatcher (SwipeEffects) decides WHEN to call play().

// shared blood particle texture cache key.
// module-level so we never rebuild the texture per instance.
const BLOOD_TEXTURE_KEY = "blood_drop";

export const SlashOverlay = {
  // public entry for the dispatcher.
  // input: scene, x, y (impact position in world coords).
  // output: promise that resolves once fade + cleanup finish.
  play(scene, x, y) {
    this.ensureBloodTexture(scene);
    const splatter = this.createSplatter(scene, x, y);
    const particles = this.createBloodParticles(scene);
    particles.explode(EFFECT_CONFIG.bloodCount, x, y);
    return this.fadeAndCleanup(scene, splatter, particles);
  },

  // lazily generate the small round blood particle texture.
  // safe to call multiple times; skips if the texture already exists.
  ensureBloodTexture(scene) {
    if (scene.textures.exists(BLOOD_TEXTURE_KEY)) return;
    const graphics = scene.add.graphics();
    graphics.fillStyle(EFFECT_STYLE.bloodParticleColor, 1);
    graphics.fillCircle(
      EFFECT_STYLE.bloodParticleRadius,
      EFFECT_STYLE.bloodParticleRadius,
      EFFECT_STYLE.bloodParticleRadius
    );
    graphics.generateTexture(
      BLOOD_TEXTURE_KEY,
      EFFECT_STYLE.bloodParticleSize,
      EFFECT_STYLE.bloodParticleSize
    );
    graphics.destroy();
  },

  // draw the painted blood decal as one graphics object.
  // input: scene, centerX, centerY. output: graphics (caller destroys later).
  createSplatter(scene, centerX, centerY) {
    const splatter = scene.add.graphics();
    splatter.setDepth(EFFECT_CONFIG.depth);
    splatter.fillStyle(EFFECT_STYLE.bloodDecalColor, EFFECT_STYLE.bloodDecalAlpha);
    this.drawSplatterBlobs(splatter, centerX, centerY);
    return splatter;
  },

  // fill the splatter with random ellipses so each slash looks unique.
  drawSplatterBlobs(splatter, centerX, centerY) {
    for (let i = 0; i < EFFECT_STYLE.bloodBlobCount; i += 1) {
      const offsetX = Phaser.Math.FloatBetween(-EFFECT_CONFIG.bloodSpreadX, EFFECT_CONFIG.bloodSpreadX);
      const offsetY = Phaser.Math.FloatBetween(-EFFECT_CONFIG.bloodSpreadY, EFFECT_CONFIG.bloodSpreadY);
      const radiusX = Phaser.Math.FloatBetween(EFFECT_STYLE.bloodBlobMinR, EFFECT_STYLE.bloodBlobMaxR) * EFFECT_CONFIG.bloodScale;
      const radiusY = Phaser.Math.FloatBetween(EFFECT_STYLE.bloodBlobMinR * 0.6, EFFECT_STYLE.bloodBlobMaxR * 0.7) * EFFECT_CONFIG.bloodScale;
      splatter.fillEllipse(centerX + offsetX, centerY + offsetY, radiusX, radiusY);
    }
  },

  // create the particle emitter (non-emitting by default) used for bursts.
  // we call emitter.explode(count, x, y) after this to fire the burst.
  createBloodParticles(scene) {
    return scene.add.particles(0, 0, BLOOD_TEXTURE_KEY, {
      speed: { min: EFFECT_CONFIG.bloodSpeedMin, max: EFFECT_CONFIG.bloodSpeedMax },
      angle: { min: 200, max: 340 },
      lifespan: EFFECT_STYLE.bloodParticleLifespanMs,
      gravityY: EFFECT_CONFIG.bloodGravity,
      alpha: { start: 1, end: 0 },
      scale: { start: EFFECT_CONFIG.bloodScale, end: 0.2 },
      emitting: false,
      depth: EFFECT_CONFIG.depth + 1,
    });
  },

  // fade decal, then hard-destroy both decal + emitter after a safe delay.
  // returns a promise that resolves so SwipeLogic can await the commit.
  fadeAndCleanup(scene, splatter, particles) {
    scene.tweens.add({
      targets: splatter,
      alpha: 0,
      delay: EFFECT_CONFIG.slashHoldMs,
      duration: EFFECT_CONFIG.slashFadeMs,
      ease: "Cubic.easeOut",
    });
    return new Promise((resolve) => {
      scene.time.delayedCall(EFFECT_CONFIG.slashCleanupMs, () => {
        splatter.destroy();
        particles.destroy();
        resolve();
      });
    });
  },
};
