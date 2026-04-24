import { LOADER_CONFIG, SCENE_CONFIG } from "../constants/swipeConfig.js";

// progressive profile loader.
// responsibility: own every piece of asset loading so the scene stays thin.
//
// strategy (Pillar 8 - Smart Asset Loading):
//   1. preload json in scene.preload()
//   2. in scene.create(), load the first N=initialBatchSize images right away
//      so the initial stack (active + pending) can render with zero pop.
//   3. after that first batch resolves, schedule a delayed background load of
//      the REMAINING images so the CPU uses idle time to fetch them.
//   4. scene never has to touch phaser's loader directly.
export const ProfileLoader = {
  // queue the profiles.json file in the phaser loader.
  // input: phaser scene (during preload phase).
  // output: none (phaser will cache the json under SCENE_CONFIG.profileJsonKey).
  preloadJson(scene) {
    scene.load.json(SCENE_CONFIG.profileJsonKey, SCENE_CONFIG.profileJsonPath);
  },

  // read profiles from phaser json cache and drop any that are missing
  // the minimum fields needed to render a card.
  // input: scene. output: array of valid profile objects.
  getValidProfiles(scene) {
    const data = scene.cache.json.get(SCENE_CONFIG.profileJsonKey);
    const raw = data?.profiles ?? [];
    return raw.filter((profile) => this.isProfileRenderable(profile));
  },

  // minimum contract for a profile object to be renderable.
  // missing id / name / imagePath means the card can't be built.
  isProfileRenderable(profile) {
    if (!profile) return false;
    if (profile.id == null) return false;
    if (!profile.name) return false;
    if (!profile.imagePath) return false;
    return true;
  },

  // check if a profile's texture is already cached.
  // input: scene + profile. output: boolean.
  // used by scene code to skip creating cards whose texture isn't ready yet.
  isTextureReady(scene, profile) {
    return scene.textures.exists(this.textureKeyFor(profile));
  },

  // stable cache key for a profile image.
  // kept as one method so the key format never drifts across files.
  textureKeyFor(profile) {
    return `profile_${profile.id}`;
  },

  // load a specific slice of profiles as a foreground batch.
  // input: scene, full profiles array, startIndex, count.
  // output: promise that resolves when every queued image finishes.
  //
  // used for the FIRST batch so the initial stack can render immediately.
  // images that are already cached are skipped so this is idempotent.
  loadBatch(scene, profiles, startIndex, count) {
    const slice = profiles.slice(startIndex, startIndex + count);
    const pending = slice.filter((profile) => !this.isTextureReady(scene, profile));
    pending.forEach((profile) => {
      scene.load.image(this.textureKeyFor(profile), profile.imagePath);
    });
    return new Promise((resolve) => {
      if (!pending.length) {
        resolve();
        return;
      }
      scene.load.once("complete", () => resolve());
      if (!scene.load.isLoading()) scene.load.start();
    });
  },

  // schedule idle-time loading for every profile AFTER the first batch.
  // input: scene, profiles array, index where background work should start.
  //
  // uses a small delayedCall so we don't fight with the scene's first render.
  // after the delay we queue every remaining image and start the loader.
  // this is pillar 8's "background pre-fetching" - the CPU fetches while
  // the user is still figuring out what to do with the first card.
  loadInBackground(scene, profiles, startIndex) {
    const remaining = profiles.slice(startIndex).filter((profile) => !this.isTextureReady(scene, profile));
    if (!remaining.length) return;
    scene.time.delayedCall(LOADER_CONFIG.backgroundDelayMs, () => {
      remaining.forEach((profile) => {
        scene.load.image(this.textureKeyFor(profile), profile.imagePath);
      });
      if (!scene.load.isLoading()) scene.load.start();
    });
  },
};
