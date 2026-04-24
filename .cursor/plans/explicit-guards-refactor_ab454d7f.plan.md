---
name: explicit-guards-refactor
overview: Replace every instance of ??, ?., and ternaries in src/ with verbose if/else guards and explanatory comments, plus two Sourcery-AI bug fixes (monotonic fallback IDs + deck-length stability).
todos:
  - id: profileloader
    content: Rewrite ProfileLoader.getValidProfiles with two explicit guards replacing ?. and ??
    status: completed
  - id: inputmanager
    content: Expand InputManager constructor (2 sites), handleKey (2 sites), executeCommit (3 sites) to if/else blocks
    status: completed
  - id: swipedeckscene
    content: Expand SwipeDeckScene setupInput and cleanup keyboard accessors to explicit if checks
    status: completed
  - id: profilecard
    content: Expand ProfileCard.validateBounds width/height and setGrabState targetScale ternaries
    status: completed
  - id: hackoverlay
    content: Expand HackOverlay.makeBinaryText random-digit ternary to if/else
    status: completed
  - id: fallback-ids
    content: Replace Date.now() fallback ids in ProfileCard.validateProfile with a monotonic module-level counter (Sourcery bug fix)
    status: completed
  - id: createcard-stability
    content: Remove isTextureReady gate from SwipeDeckScene.createCard so ProfileCard fallback renders and deck length stays stable (Sourcery bug fix)
    status: completed
  - id: verify
    content: Grep for any remaining ??/?./ternaries in src and run ReadLints on all touched files
    status: completed
isProject: false
---

# Explicit Guards Refactor

## Goal
Make every safety check and conditional assignment readable by a reader who does not know `??`, `?.`, or ternaries. Every expanded guard gets a short `//` comment explaining what it is checking for.

## Scope
- Strip: `??`, `?.`, and `a ? b : c` ternaries.
- Keep: destructuring, spread, array methods (`.map`/`.filter`/`.forEach`), default params, arrow functions, `async`/`await`.
- Ignore: `lib/phaser.js` (vendor), `profiles.json`, `style.css`, markdown.

## Files affected (5)
- [src/systems/ProfileLoader.js](src/systems/ProfileLoader.js)
- [src/systems/InputManager.js](src/systems/InputManager.js)
- [src/scenes/SwipeDeckScene.js](src/scenes/SwipeDeckScene.js)
- [src/objects/ProfileCard.js](src/objects/ProfileCard.js)
- [src/systems/effects/HackOverlay.js](src/systems/effects/HackOverlay.js)

## Per-location transforms (15 sites)

### ProfileLoader.js (1 site: `??` + `?.`)
```js
// BEFORE
const data = scene.cache.json.get(SCENE_CONFIG.profileJsonKey);
const raw = data?.profiles ?? [];
return raw.filter((profile) => this.isProfileRenderable(profile));

// AFTER
const data = scene.cache.json.get(SCENE_CONFIG.profileJsonKey);
// bail early if the cache entry is missing
if (!data) return [];
// bail early if the profiles field is not an array
if (!Array.isArray(data.profiles)) return [];
return data.profiles.filter((profile) => this.isProfileRenderable(profile));
```

### InputManager.js (5 sites: 2× `??`, 2× `?.`, 3× ternary)

- **Lines 26-27:** `options.threshold ?? …` and `options.effects ?? null` → explicit `if/else` blocks with comments "use caller-provided threshold if given" / "default to no effects when none provided".
- **Line 106:** `event.key?.toLowerCase()` → `if (!event.key) return;` guard, then `const key = event.key.toLowerCase();`.
- **Line 109:** `const direction = key === "d" ? SLASH : HACK;` → `let direction; if (key === "d") direction = SLASH; else direction = HACK;`.
- **Line 141 / 157:** `this.effects ? this.effects.play(...) : Promise.resolve()` inside `Promise.all([...])` → extract to a named local:
  ```js
  // play overlay only if effects subsystem is wired, otherwise use a no-op promise
  let overlayPromise;
  if (this.effects) overlayPromise = this.effects.play(direction, card.x, card.y);
  else overlayPromise = Promise.resolve();
  ```
- **Line 144:** `this.stack.onHackCommit?.(card.id)` → `if (typeof this.stack.onHackCommit === "function") this.stack.onHackCommit(card.id);`

### SwipeDeckScene.js (2 sites: `?.`)
- **Line 176 setupInput:** `this.input.keyboard?.on(...)` → `if (this.input.keyboard) this.input.keyboard.on(...)`.
- **Line 248 cleanup:** `if (this.keyDownHandler) this.input.keyboard?.off(...)` → explicit joined check `if (this.keyDownHandler && this.input.keyboard) { ... }`.

### ProfileCard.js (3 sites: ternary)
- **Lines 51-52 validateBounds:** width and height assignments. Each ternary becomes a 3-line `if/else` with a `//` comment stating "fall back to config minimum when bounds are unusable".
- **Line 160 setGrabState:** `const targetScale = isGrabbed ? CARD_CONFIG.grabScale : CARD_CONFIG.releaseScale;` → explicit `let targetScale; if (isGrabbed) ... else ...`.

### HackOverlay.js (1 site: ternary)
- **Line 66 makeBinaryText:** `digits.push(Math.random() > 0.5 ? "1" : "0")` → explicit `if (Math.random() > 0.5) digits.push("1"); else digits.push("0");` with comment "random bit: 1 or 0".

## Verification
- `rg "\?\?|\?\." src --glob '*.js'` returns zero matches (only comments may contain `?`).
- `rg "\s\?\s" src --glob '*.js'` returns zero non-comment matches.
- ReadLints on all 5 files returns no errors.
- No behavior change: every rewrite produces identical runtime values.

## Non-goals
- Not touching destructuring (`const { width, height } = bounds`).
- Not touching spread (`...targetProps`).
- Not touching array methods (`.filter`, `.forEach`, `.map`).
- Not touching `lib/phaser.js`.