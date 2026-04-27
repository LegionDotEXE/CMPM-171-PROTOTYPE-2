export class StalkingScene extends Phaser.Scene {
    constructor() {
        super("stalkingScene");
    }

    preload() {}

    create() {
        this.width = this.scale.width;
        this.height = this.scale.height;

        this.gameStarted = false;

        this.setupMap();
        this.setupCharacters();
        this.startCountdown();
    }

    update(time, delta) {
        if (!this.gameStarted) return;

        this.updateTarget(delta);
        this.updatePlayer(delta);
        this.checkTargetEscaped();
    }

    setupMap() {
        this.add.rectangle(
            this.width / 2,
            this.height / 2,
            this.width * 0.7,
            this.height,
            0x222222
        );

        this.leftBound = this.width * 0.15;
        this.rightBound = this.width * 0.85;
    }

    setupCharacters() {
        // Red = target you are following.
        this.target = this.add.rectangle(
            this.width / 2,
            this.height / 2,
            40,
            40,
            0xff4444
        );

        // Blue = player / stalker.
        this.player = this.add.rectangle(
            this.width / 2,
            this.height - 80,
            35,
            35,
            0x44aaff
        );

        this.keys = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.playerSpeed = 180;
        this.targetSpeed = 60;

        this.minDistance = 120;
        this.maxDistance = 350;
    }

    updateTarget(delta) {
        const dt = delta / 1000;
        this.target.y -= this.targetSpeed * dt;
    }

    updatePlayer(delta) {
        const dt = delta / 1000;

        if (this.keys.up.isDown) {
            this.player.y -= this.playerSpeed * dt;
        }

        if (this.keys.down.isDown) {
            this.player.y += this.playerSpeed * dt;
        }

        if (this.keys.left.isDown) {
            this.player.x -= this.playerSpeed * dt;
        }

        if (this.keys.right.isDown) {
            this.player.x += this.playerSpeed * dt;
        }

        this.player.x = Phaser.Math.Clamp(this.player.x, this.leftBound, this.rightBound);
        this.player.y = Phaser.Math.Clamp(this.player.y, 80, this.height - 80);
    }

    checkTargetEscaped() {
        if (this.target.y < 0) {
            this.lose("Target escaped!");
        }
    }

    checkDistanceLose() {
        const distance = this.player.y - this.target.y;

        if (distance < this.minDistance) {
            this.lose("Too close!");
        }

        if (distance > this.maxDistance) {
            this.lose("Too far!");
        }
    }

    startCountdown() {
        let count = 3;

        this.countdownText = this.add.text(
            this.width / 2,
            this.height / 2,
            count,
            {
                fontSize: "80px",
                color: "#ffffff"
            }
        ).setOrigin(0.5).setDepth(100);

        this.time.addEvent({
            delay: 1000,
            repeat: 3,
            callback: () => {
                count--;

                if (count > 0) {
                    this.countdownText.setText(count);
                } else if (count === 0) {
                    this.countdownText.setText("GO!");
                } else {
                    this.countdownText.destroy();
                    this.gameStarted = true;
                }
            }
        });
    }

    lose(reason) {
        console.log(reason);
        this.scene.restart();
    }
}