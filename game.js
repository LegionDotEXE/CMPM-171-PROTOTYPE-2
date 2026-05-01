import { TitleScreenScene } from "./src/scenes/TitleScreen.js";
import { SwipeDeckScene } from "./src/scenes/SwipeDeckScene.js";
import { StorageScene } from "./src/scenes/StorageScene.js";
import { GearPuzzleScene } from "./src/scenes/GearPuzzleScene.js";
import { ProfileDetailScene } from "./src/scenes/ProfileDetailScene.js";

const { Phaser } = window;

// global game boot settings live here so scene files stay focused on gameplay
const gameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  backgroundColor: "#15100d",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  input: {
    activePointers: 1,
    windowEvents: true,
    touch: { capture: true },
  },
  // Storage opens from SwipeDeck's Collection button.
  // ProfileDetail opens when a profile is clicked in Storage.
  // GearPuzzle opens when dating succeeds (or when the deck is exhausted).
  scene: [TitleScreenScene, SwipeDeckScene, GearPuzzleScene, StorageScene, ProfileDetailScene],
};

if (!Phaser) {
  throw new Error("Phaser failed to load. Ensure lib/phaser.js is available.");
}

// create game only after document load so mount node always exists
window.addEventListener(
  "load",
  () => {
    window.swipePrototypeGame = new Phaser.Game(gameConfig);
  },
  { once: true }
);