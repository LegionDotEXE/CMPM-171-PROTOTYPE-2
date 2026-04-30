/*
 * ProfileDetailScene: shown after a HACK commit on any profile card.
 *
 * Layout (top → bottom, scrollable within a bounded panel):
 *   [Profile image]
 *   [Name]
 *   [General info block]
 *   [Credit card asset + card details]
 *   [SSN asset + SSN details]
 *   [Terminate button]  [Start Dating button]
 *
 * Panel design:
 *   The page renders inside a fixed rectangular panel centered on screen
 *   (DETAIL_LAYOUT.panelWidthPct × panelHeightPct of the camera).
 *   Content outside the panel is hidden behind the solid background.
 *   This gives the "phone within the screen" look instead of full-bleed.
 *
 * Scroll mechanics:
 *   - All scrollable content lives in scrollContainer whose .y is offset.
 *   - A Phaser Graphics mask clips the container to the panel bounds so
 *     content never bleeds outside the panel edges.
 *   - scroll only activates when the pointer is INSIDE the panel AND
 *     isPointerDown is true. _suppressScroll is set by buttons so a button
 *     tap never accidentally scrolls.
 *   - scrollMin (0) and scrollMax (negative) clamp container.y.
 *
 * Button animations:
 *   - Terminate: red flash + "TARGET ELIMINATED" animation tween.
 *   - Start Dating: heart particle burst + "MATCH!" animation tween.
 *
 * Entry contract:
 *   scene.launch("ProfileDetail", { profile }) from SwipeDeckScene.
 *   SwipeDeck is paused while this scene is active, and resumed on exit.
 *
 * Exit paths:
 *   "Kill"         → createKillEffect → GameState.recordKill →
 *                    scene.stop("ProfileDetail") + scene.resume("SwipeDeck")
 *   "Start Dating" → createDatingEffect → GameState.recordMatch →
 *                    scene.stop("ProfileDetail") + scene.resume("SwipeDeck")
 */

import { DETAIL_STYLE, DETAIL_LAYOUT } from "../constants/swipeConfig.js";
import { GameState } from "../systems/GameState.js";

export class ProfileDetailScene extends Phaser.Scene {
  constructor() {
    super({ key: "ProfileDetail" });

    this.currentProfile = null;   // full profile object injected via init()
    this.scrollContainer = null;  // container holding all scrollable content
    this.scrollY = 0;             // current container y offset (0 = top)
    this.scrollMin = 0;           // upper clamp 
    this.scrollMax = 0;           // lower clamp 

    // isPointerDown: true only while the pointer is held inside the panel.
    // _suppressScroll: set true by button pointerdown so that tap never scrolls.
    this.isPointerDown = false;
    this.dragStartY = 0;          
    this.scrollStartY = 0;      
    this._suppressScroll = false;

    // panel geometry – computed in create(), used by input and mask.
    this.panelX = 0;  
    this.panelY = 0;   
    this.panelW = 0;   
    this.panelH = 0;   

    // listener refs for clean shutdown
    this._ptrDownHandler = null;
    this._ptrMoveHandler = null;
    this._ptrUpHandler   = null;
    this._wheelHandler   = null;
    this._resizeHandler  = null;

    // double-fire guard for action buttons
    this._buttonLocked = false;

    this._cursorText = null;
  }

  init(data) {
    if (data && data.profile) {
      this.currentProfile = data.profile;
      return;
    }
    // fallback: try GameState's last-hacked profile
    this.currentProfile = GameState.getLastHackedProfile?.() ?? null;
    if (!this.currentProfile) {
      console.error("[ProfileDetailScene] no profile received – returning to SwipeDeck");
      this.scene.stop("ProfileDetail");
      this.scene.resume("SwipeDeck");
    }
  }

  preload() {
    // load asset images if not already cached so the graphics display correctly.
    if (!this.textures.exists("creditCardAsset")) {
      this.load.image("creditCardAsset", "assets/credit_card.png");
    }
    if (!this.textures.exists("ssnAsset")) {
      this.load.image("ssnAsset", "assets/ssn_card.png");
    }
  }

  create() {
    if (!this.currentProfile) return;
    this.scrollY = 0;
    this.isPointerDown = false;
    this._suppressScroll = false;
    this._buttonLocked = false;
    this._cursorText = null;

    this.input.topOnly = false;

    const cam = this.cameras.main;

    // panel is a centered rectangle, decided not to put in full screen
    // all content and the scroll mask are derived from these four values.
    this.panelW = Math.floor(cam.width  * DETAIL_LAYOUT.panelWidthPct);
    this.panelH = Math.floor(cam.height * DETAIL_LAYOUT.panelHeightPct);
    this.panelX = Math.floor((cam.width  - this.panelW) / 2);
    this.panelY = Math.floor((cam.height - this.panelH) / 2);

    this.createBackground(cam);
    this.createScanlines(cam);
    this.createPanel();
    this.createScrollContent();
    this.applyScrollMask();
    this.createButtons();   
    this.bindInput();
    this.bindLifecycle();
    this.playEntryGlitch();
  }

  shutdown() {
    this.detachListeners();
  }

  // solid near-black fill
  createBackground(cam) {
    this.add
      .rectangle(cam.width / 2, cam.height / 2, cam.width, cam.height, DETAIL_STYLE.bgColor, 1)
      .setOrigin(0.5)
      .setDepth(0);
  }

  createScanlines(cam) {
    const g = this.add.graphics().setDepth(50).setAlpha(0.15);
    const lineH = 3;
    const gap   = 3;
    for (let scanY = 0; scanY < cam.height; scanY += lineH + gap) {
      g.fillStyle(0x000000, 1);
      g.fillRect(0, scanY, cam.width, lineH);
    }
  }

  // draw the bounded panel: dark fill + green border.
  // everything scrollable will be masked to this rectangle.
  createPanel() {
    this.add
      .rectangle(
        this.panelX + this.panelW / 2,
        this.panelY + this.panelH / 2,
        this.panelW,
        this.panelH,
        DETAIL_STYLE.panelBgColor,
        1
      )
      .setOrigin(0.5)
      .setDepth(1);

    // panel border (green accent)
    const border = this.add.graphics().setDepth(2);
    border.lineStyle(DETAIL_STYLE.panelBorderWidth, DETAIL_STYLE.panelBorderColor, 1);
    border.strokeRect(this.panelX, this.panelY, this.panelW, this.panelH);

    const inner = this.add.graphics().setDepth(2);
    inner.lineStyle(1, 0x004422, 0.5);
    inner.strokeRect(this.panelX + 4, this.panelY + 4, this.panelW - 8, this.panelH - 8);

    this.drawCornerBrackets(this.panelX, this.panelY, this.panelW, this.panelH, 22, 3);
  }

  drawCornerBrackets(x, y, w, h, size, thickness) {
    const g = this.add.graphics().setDepth(3);
    g.lineStyle(thickness, 0x00ff88, 1);
    const corners = [
      [x,     y,      1,  1],
      [x + w, y,     -1,  1],
      [x,     y + h,  1, -1],
      [x + w, y + h, -1, -1],
    ];
    corners.forEach(([cx2, cy2, sx, sy]) => {
      g.beginPath();
      g.moveTo(cx2 + sx * size, cy2);
      g.lineTo(cx2, cy2);
      g.lineTo(cx2, cy2 + sy * size);
      g.strokePath();
    });
  }

  // all scrollable objects live inside scrollContainer.
  // positions are in world space so the mask and
  // layout math both use the same coordinate system.
  createScrollContent() {
    const cx = this.panelX + this.panelW / 2;
    // content width capped so text doesn't span the full panel on wide screens
    const contentWidth = Math.min(this.panelW - 24, DETAIL_LAYOUT.maxContentWidth);

    this.scrollContainer = this.add.container(0, 0).setDepth(3);

    let y = this.panelY + DETAIL_LAYOUT.topPad;

    y = this.addTerminalHeader(cx, y, contentWidth);
    y += 12;

    y = this.addProfileImage(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    y = this.addNameText(cx, y);
    y += DETAIL_LAYOUT.sectionGap;

    y = this.addDivider(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    y = this.addSectionHeader(cx, y, "GENERAL INFORMATION");
    y += DETAIL_LAYOUT.headerGap;
    y = this.addGeneralInfo(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    y = this.addDivider(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    y = this.addSectionHeader(cx, y, "CREDIT CARD INFORMATION");
    y += DETAIL_LAYOUT.headerGap;
    y = this.addCreditCardBlock(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    y = this.addDivider(cx, y, contentWidth);
    y += DETAIL_LAYOUT.sectionGap;

    y = this.addSectionHeader(cx, y, "SOCIAL SECURITY NUMBER");
    y += DETAIL_LAYOUT.headerGap;
    y = this.addSSNBlock(cx, y, contentWidth);

    // bottom padding clears the pinned button bar
    y += DETAIL_LAYOUT.buttonHeight + DETAIL_LAYOUT.bottomPad + 40;

    // scrollMax: how far up the container can travel so the last item is visible.
    const visiblePanelH = this.panelH - DETAIL_LAYOUT.buttonHeight - 16;
    const contentH = y - this.panelY;
    this.scrollMax = Math.min(0, visiblePanelH - contentH);
  }

  addTerminalHeader(cx, y, contentWidth) {
    const bar = this.add
      .rectangle(cx, y + 14, contentWidth, 28, 0x003311, 1)
      .setOrigin(0.5, 0);
    this.scrollContainer.add(bar);

    const leftX = cx - contentWidth * 0.45;

    const prefix = this.add.text(leftX, y + 6, ">> ACCESS GRANTED", {
      fontSize:   "14px",
      color:      "#00ff88",
      fontStyle:  "bold",
      fontFamily: DETAIL_STYLE.fontFamily,
    }).setOrigin(0, 0);
    this.scrollContainer.add(prefix);

    this._cursorText = this.add.text(leftX + prefix.width + 6, y + 6, "\u2588", {
      fontSize:   "14px",
      color:      "#00ff88",
      fontFamily: DETAIL_STYLE.fontFamily,
    }).setOrigin(0, 0);
    this.scrollContainer.add(this._cursorText);

    this.tweens.add({
      targets:  this._cursorText,
      alpha:    0,
      duration: 500,
      ease:     "Power1",
      yoyo:     true,
      repeat:   -1,
    });

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const ts  = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}  ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const tsText = this.add.text(cx + contentWidth * 0.45, y + 6, ts, {
      fontSize:   "11px",
      color:      "#336644",
      fontFamily: DETAIL_STYLE.fontFamily,
    }).setOrigin(1, 0);
    this.scrollContainer.add(tsText);

    return y + 28 + 4;
  }

  // profile image with green accent border
  addProfileImage(cx, y, contentWidth) {
    const profile = this.currentProfile;
    const textureKey = `profile_${profile.id}`;
    const imgW = contentWidth * 0.85;
    const imgH = DETAIL_LAYOUT.profileImageHeight;
    const imgCY = y + imgH / 2;

    const border = this.add.rectangle(cx, imgCY, imgW + 6, imgH + 6, 0x000000, 0);
    border.setStrokeStyle(2, 0x00ff88, 1).setOrigin(0.5);
    this.scrollContainer.add(border);

    if (this.textures.exists(textureKey)) {
      const img = this.add.image(cx, imgCY, textureKey).setDisplaySize(imgW, imgH).setOrigin(0.5);
      img.setTint(0xaaffcc);
      this.scrollContainer.add(img);
    } else {
      const ph = this.add.rectangle(cx, imgCY, imgW, imgH, DETAIL_STYLE.imageFallbackColor, 1).setOrigin(0.5);
      this.scrollContainer.add(ph);
    }

    const scanBar = this.add.rectangle(cx, y, imgW, 4, 0x00ff88, 0.20).setOrigin(0.5, 0);
    this.scrollContainer.add(scanBar);
    const startY = y;
    this.tweens.add({
      targets:  scanBar,
      y:        y + imgH,
      duration: 2400,
      ease:     "Linear",
      repeat:   -1,
      onRepeat: () => { scanBar.y = startY; },
    });

    this.addScrollCornerBrackets(cx - imgW / 2, y, imgW, imgH, 14, 2);

    return y + imgH;
  }

  addScrollCornerBrackets(x, y, w, h, size, thickness) {
    const g = this.add.graphics();
    g.lineStyle(thickness, 0x00ff88, 0.80);
    const corners = [
      [x,     y,      1,  1],
      [x + w, y,     -1,  1],
      [x,     y + h,  1, -1],
      [x + w, y + h, -1, -1],
    ];
    corners.forEach(([cx2, cy2, sx, sy]) => {
      g.beginPath();
      g.moveTo(cx2 + sx * size, cy2);
      g.lineTo(cx2, cy2);
      g.lineTo(cx2, cy2 + sy * size);
      g.strokePath();
    });
    this.scrollContainer.add(g);
  }

  // name in large bold white text
  addNameText(cx, y) {
    const text = this.add.text(cx, y, (this.currentProfile.name || "Unknown").toUpperCase(), {
      fontSize:      DETAIL_STYLE.nameFontSize,
      color:         DETAIL_STYLE.nameColor,
      fontStyle:     "bold",
      fontFamily:    DETAIL_STYLE.fontFamily,
      letterSpacing: 4,
    }).setOrigin(0.5, 0);
    this.scrollContainer.add(text);

    const ny = y + text.height + 4;
    const idLine = this.add.text(cx,
      ny,
      `SUBJECT_ID: ${String(this.currentProfile.id).padStart(4, "0")}  //  CLEARANCE: LEVEL-5`, {
        fontSize:   "12px",
        color:      "#336644",
        fontFamily: DETAIL_STYLE.fontFamily,
      }).setOrigin(0.5, 0);
    this.scrollContainer.add(idLine);

    return ny + idLine.height;
  }

  // thin 1px horizontal divider
  addDivider(cx, y, contentWidth) {
    const line = this.add
      .rectangle(cx, y, contentWidth * 0.9, 1, DETAIL_STYLE.dividerColor, 0.5)
      .setOrigin(0.5, 0);
    this.scrollContainer.add(line);
    return y + 1;
  }

  // uppercase section label in green
  addSectionHeader(cx, y, label) {
    const text = this.add.text(cx, y, label, {
      fontSize:      DETAIL_STYLE.sectionHeaderFontSize,
      color:         DETAIL_STYLE.sectionHeaderColor,
      fontStyle:     "bold",
      fontFamily:    DETAIL_STYLE.fontFamily,
      letterSpacing: 2,
    }).setOrigin(0.5, 0);
    this.scrollContainer.add(text);
    return y + text.height;
  }

  // Strcutured key value rows
  addGeneralInfo(cx, y, contentWidth) {
    const profile = this.currentProfile;

    const bioText = this.add.text(cx, y, `"${profile.text || "No additional information available."}"`, {
      fontSize:    "14px",
      color:       "#558855",
      align:       "center",
      wordWrap:    { width: contentWidth * 0.88, useAdvancedWrap: true },
      lineSpacing: 3,
      fontFamily:  DETAIL_STYLE.fontFamily,
    }).setOrigin(0.5, 0);
    this.scrollContainer.add(bioText);
    y += bioText.height + DETAIL_LAYOUT.headerGap;

    const info = profile.info || {};
    const rows = [
      ["Age",        info.age        || "—"],
      ["Occupation", info.occupation || "—"],
      ["Location",   info.location   || "—"],
      ["Height",     info.height     || "—"],
      ["Status",     info.status     || "—"],
    ];
    return this.addInfoRows(cx, y, contentWidth, rows);
  }

  // credit card graphic + detail rows
  addCreditCardBlock(cx, y, contentWidth) {
    y = this.addCreditCardGraphic(cx, y, contentWidth);
    y += DETAIL_LAYOUT.assetGap;

    const cc = this.currentProfile.creditCard || {};
    const rows = [
      ["Card Number", cc.number  || "•••• •••• •••• ••••"],
      ["Cardholder",  cc.holder  || this.currentProfile.name || "—"],
      ["Expiry",      cc.expiry  || "••/••"],
      ["CVV",         cc.cvv     || "•••"],
      ["Bank",        cc.bank    || "—"],
      ["Type",        cc.type    || "—"],
    ];
    return this.addInfoRows(cx, y, contentWidth, rows);
  }

  // ssn graphic + detail rows + confidential warning
  addSSNBlock(cx, y, contentWidth) {
    y = this.addSSNGraphic(cx, y, contentWidth);
    y += DETAIL_LAYOUT.assetGap;

    // Intial configurations
    // will be replaced with the information from the JSON file as provided

    // Same for above too
    const ssn = this.currentProfile.ssn || {};
    const rows = [
      ["SSN",    ssn.number || "•••-••-••••"],
      ["Issued", ssn.issued || "—"],
      ["State",  ssn.state  || "—"],
    ];
    y = this.addInfoRows(cx, y, contentWidth, rows);

    const warning = this.add.text(cx, y + 4, "⚠  CONFIDENTIAL — HANDLE WITH CARE  ⚠", {
      fontSize:   "16px",
      color:      "#ff4444",
      fontStyle:  "bold",
      fontFamily: DETAIL_STYLE.fontFamily,
    }).setOrigin(0.5, 0);
    this.scrollContainer.add(warning);
    this.tweens.add({
      targets:  warning,
      alpha:    0.25,
      duration: 900,
      ease:     "Sine.easeInOut",
      yoyo:     true,
      repeat:   -1,
    });
    return y + warning.height + 8;
  }

  // credit card image. returns new cursorY
  addCreditCardGraphic(cx, y, contentWidth) {
    const cardW = contentWidth * DETAIL_LAYOUT.ccWidthRatio;
    const cardH = cardW * DETAIL_LAYOUT.ccAspectRatio;

    const img = this.add.image(cx, y + cardH / 2, "creditCardAsset")
      .setDisplaySize(cardW, cardH)
      .setOrigin(0.5);
    img.setTint(0xaaffcc);
    this.scrollContainer.add(img);
    this.addScrollCornerBrackets(cx - cardW / 2, y, cardW, cardH, 10, 1);

    return y + cardH;
  }

  // ssn card image. returns new cursorY
  addSSNGraphic(cx, y, contentWidth) {
    const cardW = contentWidth * DETAIL_LAYOUT.ssnWidthRatio;
    const cardH = cardW * DETAIL_LAYOUT.ssnAspectRatio;

    const img = this.add.image(cx, y + cardH / 2, "ssnAsset")
      .setDisplaySize(cardW, cardH)
      .setOrigin(0.5);
    img.setTint(0xaaffcc);
    this.scrollContainer.add(img);
    this.addScrollCornerBrackets(cx - cardW / 2, y, cardW, cardH, 10, 1);

    return y + cardH;
  }

  // left-aligned key, right-aligned value per row
  addInfoRows(cx, y, contentWidth, rows) {
    const leftX  = cx - contentWidth * 0.44;
    const rightX = cx + contentWidth * 0.44;

    rows.forEach(([key, val]) => {
      const keyText = this.add.text(leftX, y, key, {
        fontSize:   DETAIL_STYLE.infoKeyFontSize,
        color:      DETAIL_STYLE.infoKeyColor,
        fontStyle:  "bold",
        fontFamily: DETAIL_STYLE.fontFamily,
      }).setOrigin(0, 0);

      const valText = this.add.text(rightX, y, String(val), {
        fontSize:   DETAIL_STYLE.infoValFontSize,
        color:      DETAIL_STYLE.infoValColor,
        fontFamily: DETAIL_STYLE.fontFamily,
        align:      "right",
        wordWrap:   { width: contentWidth * 0.46, useAdvancedWrap: true },
      }).setOrigin(1, 0);

      this.scrollContainer.add([keyText, valText]);
      y += Math.max(keyText.height, valText.height) + DETAIL_LAYOUT.infoRowHeight * 0.25;
    });

    return y;
  }


  // clip scrollContainer to the panel rectangle so content never bleeds outside.
  applyScrollMask() {
    const maskGraphics = this.make.graphics({ add: false });
    maskGraphics.fillStyle(0xffffff, 1);
    // leave the button bar height unmasked at the bottom so buttons stay visible.
    const maskH = this.panelH - DETAIL_LAYOUT.buttonHeight - 12;
    maskGraphics.fillRect(this.panelX, this.panelY, this.panelW, maskH);
    const mask = maskGraphics.createGeometryMask();
    this.scrollContainer.setMask(mask);
  }


  // buttons are placed directly in the scene (not in scrollContainer) so they
  // sit at a fixed position at the bottom of the panel regardless of scroll.
  createButtons() {
    const btnY   = this.panelY + this.panelH - DETAIL_LAYOUT.buttonHeight / 2 - 8;
    const btnW   = this.panelW * 0.38;
    const btnH   = DETAIL_LAYOUT.buttonHeight;
    const cx     = this.panelX + this.panelW / 2;

    // Kill (red)
    this.createButton(cx - btnW / 2 - 8, btnY, btnW, btnH,
      "TERMINATE", 0x1a0000, 0xff0000, 0x440000, () => this.handleKill());

    // Start Dating (green)
    this.createButton(cx + btnW / 2 + 8, btnY, btnW, btnH,
      "START DATING", 0x001a08, 0x00ff88, 0x003311, () => this.handleStartDating());
  }

  // build one button: bg rect + label text at depth 10/11
  createButton(x, y, w, h, label, baseColor, glowColor, hoverColor, callback) {
    const glowHex = `#${glowColor.toString(16).padStart(6, "0")}`;

    const bg = this.add.rectangle(x, y, w, h, baseColor)
      .setOrigin(0.5)
      .setDepth(10)
      .setInteractive({ useHandCursor: true });
    bg.setStrokeStyle(1.5, glowColor, 0.9);

    const txt = this.add.text(x, y, label, {
      fontSize:   DETAIL_STYLE.btnFontSize,
      color:      glowHex,
      fontStyle:  "bold",
      fontFamily: DETAIL_STYLE.fontFamily,
    }).setOrigin(0.5).setDepth(11);

    bg.on("pointerover", () => {
      bg.setFillStyle(hoverColor);
      bg.setStrokeStyle(2, glowColor, 1);
      txt.setScale(1.05);
    });
    bg.on("pointerout",  () => {
      bg.setFillStyle(baseColor);
      bg.setStrokeStyle(1.5, glowColor, 0.9);
      txt.setScale(1);
    });

    bg.on("pointerdown", () => {
      if (this._buttonLocked) return;
      this._buttonLocked = true;
      // suppress the scene-level scroll handler for this touch
      this._suppressScroll = true;

      this.tweens.add({
        targets: [bg, txt], scaleX: 0.95, scaleY: 0.95,
        duration: 80, ease: "Power1", yoyo: true,
      });
      this.time.delayedCall(100, () => callback());
    });
  }

  playEntryGlitch() {
    const { width, height } = this.cameras.main;
    this.cameras.main.shake(200, 0.008);
    [0.40, 0.22, 0.10].forEach((alpha, i) => {
      this.time.delayedCall(i * 75, () => {
        const f = this.add.rectangle(width / 2, height / 2, width, height, 0x00ff88, alpha)
          .setDepth(200);
        this.tweens.add({
          targets: f, alpha: 0, duration: 120, ease: "Power2",
          onComplete: () => f.destroy(),
        });
      });
    });
  }

  handleKill() {
    if (this.currentProfile) GameState.recordKill(this.currentProfile.id);
    window.dispatchEvent(
      new CustomEvent("profile-killed", { detail: { profileId: this.currentProfile?.id } })
    );
    this.createKillEffect().then(() => {
      this.scene.stop("ProfileDetail");
      this.scene.resume("SwipeDeck");
    });
  }

  // red flash + "TARGET ELIMINATED" animation tween
  createKillEffect() {
    return new Promise((resolve) => {
      const { width, height } = this.cameras.main;

      this.cameras.main.shake(280, 0.016);

      const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xff0000, 0.6)
        .setOrigin(0.5).setDepth(1000);

      const noise = this.add.graphics().setDepth(1001);
      for (let i = 0; i < 70; i++) {
        noise.fillStyle(0xffffff, Math.random() * 0.35);
        noise.fillRect(
          Math.random() * width, Math.random() * height,
          Math.random() * 38 + 2, Math.random() * 3 + 1
        );
      }

      const eliminatedText = this.add.text(width / 2, height / 2, "TARGET ELIMINATED", {
        fontSize: "48px", color: "#ff0000", fontStyle: "bold",
        stroke: "#000000", strokeThickness: 6,
        fontFamily: DETAIL_STYLE.fontFamily,
        letterSpacing: 6,
      }).setOrigin(0.5).setDepth(1002).setScale(0);

      this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: "Power2" });
      this.tweens.add({
        targets: noise, alpha: 0, duration: 380, ease: "Power2",
        onComplete: () => noise.destroy(),
      });

      this.tweens.add({
        targets: eliminatedText, scale: 1, duration: 300, ease: "Back.out",
        onComplete: () => {
          this.tweens.add({
            targets: eliminatedText, alpha: 0, scale: 1.5, duration: 400, ease: "Power2",
            onComplete: resolve,
          });
        },
      });
    });
  }

  handleStartDating() {
    if (this.currentProfile) GameState.recordMatch(this.currentProfile.id);
    window.dispatchEvent(
      new CustomEvent("profile-dating", { detail: { profileId: this.currentProfile?.id } })
    );
    this.createDatingEffect().then(() => {
      this.scene.stop("ProfileDetail");
      this.scene.resume("SwipeDeck");
    });
  }

  // heart particle burst + "MATCH!" animation tween
  createDatingEffect() {
    return new Promise((resolve) => {
      const { width, height } = this.cameras.main;

      const flash = this.add.rectangle(width / 2, height / 2, width, height, 0x00ff88, 0.14)
        .setOrigin(0.5).setDepth(999);
      this.tweens.add({
        targets: flash, alpha: 0, duration: 600, ease: "Power2",
        onComplete: () => flash.destroy(),
      });

      for (let i = 0; i < 24; i++) {
        const heart = this.add.text(
          width / 2 + Phaser.Math.Between(-130, 130),
          height / 2 + Phaser.Math.Between(-100, 100),
          "♥", {
            fontSize: `${Phaser.Math.Between(20, 40)}px`,
            color: "#ff69b4",
          }
        ).setOrigin(0.5).setDepth(1000);

        this.tweens.add({
          targets: heart,
          y: heart.y - Phaser.Math.Between(100, 200),
          alpha: 0, scale: 0,
          duration: Phaser.Math.Between(800, 1500),
          delay: Phaser.Math.Between(0, 300),
          ease: "Power2",
          onComplete: () => heart.destroy(),
        });
      }

      const matchText = this.add.text(width / 2, height / 2, "MATCH!", {
        fontSize: "56px", color: "#ff69b4", fontStyle: "bold",
        stroke: "#ffffff", strokeThickness: 4,
        fontFamily: DETAIL_STYLE.fontFamily,
        letterSpacing: 6,
      }).setOrigin(0.5).setDepth(1001).setScale(0);

      this.tweens.add({
        targets: matchText, scale: 1, duration: 400, ease: "Back.out",
        onComplete: () => {
          this.tweens.add({
            targets: matchText, y: matchText.y - 50, alpha: 0,
            duration: 600, delay: 400, ease: "Power2",
            onComplete: resolve,
          });
        },
      });
    });
  }


  bindInput() {
    const DRAG_THRESHOLD = 8;

    // only begin tracking scroll when the pointer lands INSIDE the panel.
    this._ptrDownHandler = (ptr) => {
      if (!this._isInsidePanel(ptr.x, ptr.y)) return;
      if (this._suppressScroll) { this._suppressScroll = false; return; }

      this.isPointerDown = true;
      this.dragStartY    = ptr.y;
      this.scrollStartY  = this.scrollY;
    };

    // only scroll when isPointerDown is true
    this._ptrMoveHandler = (ptr) => {
      if (!this.isPointerDown) return;
      const delta = ptr.y - this.dragStartY;
      if (Math.abs(delta) < DRAG_THRESHOLD) return;
      this.scrollY = Phaser.Math.Clamp(
        this.scrollStartY + delta,
        this.scrollMax,
        this.scrollMin
      );
      this.scrollContainer.y = this.scrollY;
    };

    this._ptrUpHandler = () => {
      this.isPointerDown   = false;
      this._suppressScroll = false;
    };

    this.input.on("pointerdown",      this._ptrDownHandler);
    this.input.on("pointermove",      this._ptrMoveHandler);
    this.input.on("pointerup",        this._ptrUpHandler);
    this.input.on("pointerupoutside", this._ptrUpHandler);

    // only scrolls when cursor is inside the panel
    this._wheelHandler = (ptr, _objs, _dx, deltaY) => {
      if (!this._isInsidePanel(ptr.x, ptr.y)) return;
      this.scrollY = Phaser.Math.Clamp(
        this.scrollY - deltaY * DETAIL_LAYOUT.wheelScrollSpeed,
        this.scrollMax,
        this.scrollMin
      );
      this.scrollContainer.y = this.scrollY;
    };
    this.input.on("wheel", this._wheelHandler);
  }

  // returns true if (x, y) is within the panel rectangle.
  _isInsidePanel(x, y) {
    return (
      x >= this.panelX &&
      x <= this.panelX + this.panelW &&
      y >= this.panelY &&
      y <= this.panelY + this.panelH
    );
  }


  bindLifecycle() {
    this._resizeHandler = () => {
      const cam = this.cameras.main;
      this.panelW = Math.floor(cam.width  * DETAIL_LAYOUT.panelWidthPct);
      this.panelH = Math.floor(cam.height * DETAIL_LAYOUT.panelHeightPct);
      this.panelX = Math.floor((cam.width  - this.panelW) / 2);
      this.panelY = Math.floor((cam.height - this.panelH) / 2);

      const visiblePanelH = this.panelH - DETAIL_LAYOUT.buttonHeight - 16;
      const bounds = this.scrollContainer.getBounds();
      this.scrollMax = Math.min(0, visiblePanelH - bounds.height);
      this.scrollY   = Phaser.Math.Clamp(this.scrollY, this.scrollMax, this.scrollMin);
      this.scrollContainer.y = this.scrollY;
    };
    this.scale.on("resize", this._resizeHandler);

    this.events.once("shutdown", () => this.detachListeners());
    this.events.once("destroy",  () => this.detachListeners());
  }

  detachListeners() {
    if (this._ptrDownHandler) this.input.off("pointerdown",      this._ptrDownHandler);
    if (this._ptrMoveHandler) this.input.off("pointermove",      this._ptrMoveHandler);
    if (this._ptrUpHandler)   this.input.off("pointerup",        this._ptrUpHandler);
    if (this._ptrUpHandler)   this.input.off("pointerupoutside", this._ptrUpHandler);
    if (this._wheelHandler)   this.input.off("wheel",            this._wheelHandler);
    if (this._resizeHandler)  this.scale.off("resize",           this._resizeHandler);
    this._ptrDownHandler = null;
    this._ptrMoveHandler = null;
    this._ptrUpHandler   = null;
    this._wheelHandler   = null;
    this._resizeHandler  = null;
  }
}