// single-source-of-truth config.
// every magic number, color, ratio, and easing string the game uses
// should live in one of the frozen blocks below. if you need to tune
// the feel, change ONE value here and the whole system follows.

// shared direction labels used by SwipeLogic, ProfileCard, and SwipeEffects.
// strings (not numbers) so debug logs stay readable.
export const SWIPE_DIRECTIONS = Object.freeze({
  SLASH: "SLASH",
  HACK: "HACK",
  NONE: "NONE",
});

// core swipe + scene timing config.
// swipeThreshold is the only value that affects "when" a commit fires.
export const SCENE_CONFIG = Object.freeze({
  profileJsonKey: "profiles", // key used when reading json from phaser cache
  profileJsonPath: "src/data/profiles.json", // source path for deck data
  swipeThreshold: 150, // pixels moved before a release counts as commit
  snapTweenMs: 260, // duration of the spring-back when release is short
  snapEase: "Back.easeOut", // easing that gives the springy return
  throwTweenMs: 400, // duration of the hack throw-off-screen tween
  throwRiseY: 200, // how high the hacked card drifts up while leaving
  throwHackX: -900, // target x offset for the hack exit (to the left)
  throwHackAngle: -20, // tilt in degrees while the card flies away
});

// per-card motion tuning: scale, lerp, tilt, alpha, and slash fragment tweening.
// these are "physics" numbers - they affect how a card MOVES, not how it looks.
export const CARD_CONFIG = Object.freeze({
  depthActive: 30, // render depth for the top/active card
  depthPending: 20, // render depth for the pending/back card
  pendingScale: 0.96, // slightly smaller to signal "behind"
  releaseScale: 1, // rest scale for the active card
  grabScale: 1.04, // slight puff on pointerdown for juice
  dragLerp: 0.2, // how fast the card chases the pointer (0..1)
  rotationDivisor: 15, // larger = gentler tilt response
  alphaFadeRange: 420, // pixels of drag that map to full alpha fade
  minAlpha: 0.55, // clamp so the card never fully disappears during drag
  fragmentPushX: 160, // horizontal distance for slash halves
  fragmentFallY: 160, // vertical distance for slash halves
  fragmentRotate: 0.32, // tilt (radians) applied to each slash half
  fragmentTweenMs: 280, // slash animation duration
});

// per-card visual styling: colors, fonts, text positions.
// these are "paint" numbers - they affect how a card LOOKS, not how it moves.
// separated from CARD_CONFIG so designers can tweak look without touching physics.
export const CARD_STYLE = Object.freeze({
  panelColor: 0xd90910, // bottom panel fill color (crimson red)
  panelAlpha: 1, // bottom panel opacity
  nameFontSize: "22px", // profile name font size
  nameColor: "#ffffff", // profile name color
  nameFontStyle: "bold", // profile name weight
  descFontSize: "14px", // description font size
  descColor: "#ffffff", // description color
  descAlign: "center", // description alignment
  wrapRatio: 0.88, // description wrap width as % of card width
  imageYPct: -0.15, // y offset for image center (negative = above card center)
  panelYPct: 0.35, // y offset for panel center (positive = below card center)
  nameYPct: 0.3, // y offset for name text
  descYPct: 0.4, // y offset for description text
  grabTweenMs: 110, // grab/release scale tween duration
  grabEase: "Sine.easeOut", // easing for the grab puff
  fallbackPanelColor: 0x333333, // neutral gray used if texture is missing
});

// overlay effect timing for the slash blood + hack binary rain.
// colors and counts live in EFFECT_STYLE below so tuning feel vs look is separate.
export const EFFECT_CONFIG = Object.freeze({
  depth: 80, // base depth so overlays sit above cards
  // slash blood decal + particle burst
  slashHoldMs: 280, // how long the decal stays at full alpha before fading
  slashFadeMs: 740, // decal fade duration
  slashCleanupMs: 1200, // hard destroy time so no memory leaks
  bloodScale: 1.2, // particle/blob size multiplier
  bloodCount: 180, // particles per burst
  bloodSpeedMin: 90, // min particle speed
  bloodSpeedMax: 360, // max particle speed
  bloodGravity: 760, // gravity for particles (faster falloff = juicier)
  bloodSpreadX: 320, // random x spread for splatter blobs
  bloodSpreadY: 240, // random y spread for splatter blobs
  // hack binary rain + backdrop tint
  hackGrowMs: 700, // backdrop tint grow-in time
  hackHoldMs: 300, // hold at full strength before fading
  hackFadeMs: 520, // fade out time
  hackColumnSpacing: 36, // distance between binary rain columns
  hackBinaryLength: 22, // characters per rain column
  hackRainMinMs: 1400, // fastest column fall
  hackRainMaxMs: 2300, // slowest column fall
});

// colors and text styling for the overlay effects.
// separated from EFFECT_CONFIG so art direction changes are one-file edits.
export const EFFECT_STYLE = Object.freeze({
  bloodParticleColor: 0xcf1010, // color of the small round particle sprites
  bloodParticleSize: 22, // generated texture pixel size
  bloodParticleRadius: 11, // circle radius inside generated texture
  bloodParticleLifespanMs: 950, // how long each particle lives
  bloodDecalColor: 0x8f0000, // dark red painted blood decal
  bloodDecalAlpha: 0.78, // painted decal opacity
  bloodBlobCount: 28, // number of random ellipses per splatter
  bloodBlobMinR: 18, // min ellipse radius (multiplied by bloodScale)
  bloodBlobMaxR: 56, // max ellipse radius (multiplied by bloodScale)
  hackTintColor: 0x022d12, // dark green backdrop tint
  hackTintAlphaStart: 0.16, // tint opacity before grow
  hackTintAlphaPeak: 0.4, // tint opacity at peak during hack
  hackTextColor: "#9dff62", // falling digits color
  hackTextStrokeColor: "#4eff1f", // digit outline color
  hackTextShadowColor: "#2cff00", // digit glow shadow color
  hackTextShadowBlur: 10, // glow blur radius
  hackTextFontSize: "30px", // digit font size
  hackTextFontFamily: "Courier New, monospace", // digit font family
  hackSpawnYOffset: -420, // y where each column spawns (above screen)
  hackExtraFallY: 280, // extra fall distance past camera bottom
  hackColumnAlpha: 0.92, // column text opacity
  hackColumnStrokeWidth: 1, // outline thickness on digits
});

// phone-frame layout: percentage-based so every screen fits the same feel.
// card size is derived from camera dimensions * pct, clamped by min/max so
// tiny or huge screens still look reasonable.
export const LAYOUT_CONFIG = Object.freeze({
  imageRatio: 0.7, // top 70% of the card is the profile image
  textRatio: 0.3, // bottom 30% is the name/description panel
  cardWidthPct: 0.85, // card width as fraction of camera width
  cardHeightPct: 0.82, // card height as fraction of camera height
  cardAspectTall: 1.5, // preferred height / width for a portrait card
  cardMinWidth: 220, // never render cards narrower than this
  cardMaxWidth: 520, // never render cards wider than this
  pendingOffsetY: 14, // pending card sits this far below active
  pendingDropStartY: -500, // pending "drops in" from this y after promotion
  pendingDropTweenMs: 400, // drop-in duration
});

// progressive asset loader tuning.
// small numbers because we only have a handful of profiles; scaling up
// is as simple as increasing initialBatchSize.
export const LOADER_CONFIG = Object.freeze({
  initialBatchSize: 3, // how many profile images to load before first render
  backgroundDelayMs: 200, // delay before idle-time background loading begins
});


// ─── ProfileDetailScene constants ────────────────────────────────────────────
// All visual styling for ProfileDetailScene lives here so tuning is one-file.
// Separated from the card constants above to keep each section self-contained.

// colors, fonts, and text sizing for the detail panel.
export const DETAIL_STYLE = Object.freeze({
  bgColor:               0x0a0a0a,  // near-black fullscreen backdrop
  panelBgColor:          0x111418,  // slightly lighter panel fill
  panelBorderColor:      0x00ff88,  // green accent border
  panelBorderWidth:      2,         // border stroke thickness in px

  fontFamily:            "Courier New, monospace", // consistent monospace theme

  nameFontSize:          "26px",
  nameColor:             "#ffffff",

  sectionHeaderFontSize: "11px",
  sectionHeaderColor:    "#00ff88",  // green to match border

  infoKeyFontSize:       "12px",
  infoKeyColor:          "#888888",  // muted label color
  infoValFontSize:       "12px",
  infoValColor:          "#dddddd",  // bright value color

  dividerColor:          0x444444,   // thin separator line

  imageFallbackColor:    0x222222,   // dark gray when profile texture is missing

  btnFontSize:           "12px",
  btnTextColor:          "#ffffff",
});

// layout geometry and spacing for the detail panel.
export const DETAIL_LAYOUT = Object.freeze({
  panelWidthPct:       0.92,   // panel width as fraction of camera width
  panelHeightPct:      0.88,   // panel height as fraction of camera height
  maxContentWidth:     520,    // max content width in px (caps wide-screen stretch)

  topPad:              16,     // gap between panel top and first content item
  bottomPad:           16,     // gap below last content item (before button bar)
  sectionGap:          14,     // vertical gap between major sections
  headerGap:           8,      // gap between a section header and its content
  assetGap:            10,     // gap between an asset graphic and its info rows
  infoRowHeight:       22,     // base row height used for row spacing math

  profileImageHeight:  200,    // profile photo height in px

  // credit card asset sizing
  ccWidthRatio:        0.90,   // card width as fraction of contentWidth
  ccAspectRatio:       0.63,   // card height = cardWidth * this ratio (standard card ~1.586:1 inverted)

  // ssn card asset sizing
  ssnWidthRatio:       0.85,
  ssnAspectRatio:      0.50,

  buttonHeight:        44,     // pinned button bar height in px
  wheelScrollSpeed:    0.4,    // fraction of wheel deltaY applied per scroll event
});