export function createCreditsScene(deps) {
    const {
        Phaser,
        CONFIG,
        GAME_STATE,
        TRANSLATIONS,
        GAME_FONT,
        HUD_DEPTH,
        drawTextPanel,
        createCreditsManager,
        createLanguageCarousel,
        loadTranslations,
        hasStartAccessForPlayers,
        consumeCreditsForPlayers,
        resetGameStateForNewRun,
        isFreeplayEnabled
    } = deps;

    return class CreditsScene extends Phaser.Scene {
        constructor() {
            super('CreditsScene');
        }

        create() {
            this.add.image(400, 300, 'bg').setDisplaySize(800, 600);
            try {
                const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
                this.add.rectangle((CONFIG.width || 800) / 2, (CONFIG.height || 600) / 2, (CONFIG.width || 800), (CONFIG.height || 600), 0x000000, overlayAlpha).setDepth(0.1);
            } catch (e) { }

            const title = this.add.text(400, 80, 'SVILUPPATORI', { fontSize: '26px', fill: '#ffff00', fontFamily: GAME_FONT }).setOrigin(0.5);
            this.titlePanel = this.add.graphics();
            drawTextPanel(this.titlePanel, title, { paddingX: 18, paddingY: 10, radius: 8 });

            const lines = Array.isArray(CONFIG?.creditsScene?.lines) && CONFIG.creditsScene.lines.length > 0
                ? CONFIG.creditsScene.lines
                : [
                    'Project: Block Hunter',
                    'Version: 1.0.0',
                    '',
                    'Lead developer: Filippo Morano',
                    'Gameplay & Tools: Filippo Morano',
                    'Graphics: Filippo Morano',
                    'Music & SFX: Studio Sound',
                    '',
                    'Website: https://filippomorano.com',
                    'Contact: devs@filippomorano.com'
                ];

            let y = 150;
            lines.forEach((ln) => {
                this.add.text(400, y, ln, { fontSize: '18px', fill: '#ffffff', fontFamily: GAME_FONT }).setOrigin(0.5);
                y += 28;
            });

            this.creditsTimeoutSecs = Number(CONFIG.creditsTimeout) || 6000;
            this.creditsTimer = this.time.delayedCall(this.creditsTimeoutSecs, () => {
                this.scene.start('AttractScene');
            });

            this.languages = ['it', 'fr', 'de', 'en', 'us', 'ja', 'es', 'zh'];
            this.currentLangIndex = Math.max(0, this.languages.indexOf(GAME_STATE.language));
            if (!GAME_STATE.language) GAME_STATE.language = this.languages[this.currentLangIndex];

            try {
                this.creditManager = createCreditsManager(this, {
                    gameState: GAME_STATE,
                    config: CONFIG,
                    hudDepth: HUD_DEPTH,
                    font: GAME_FONT,
                    x: 400
                });
            } catch (e) {
                this.creditManager = null;
            }

            try {
                this.carousel = createLanguageCarousel(this, {
                    languages: this.languages,
                    index: this.currentLangIndex,
                    x: 400,
                    y: 560,
                    hudDepth: HUD_DEPTH,
                    font: GAME_FONT,
                    onRequestChange: (dir) => this.changeLangCredits(dir)
                });
                this.leftArrow = this.carousel?.leftArrow || this.leftArrow || null;
                this.rightArrow = this.carousel?.rightArrow || this.rightArrow || null;
                this.pulseCreditsArrow = this.carousel?.pulseArrow || this.pulseArrow || null;
            } catch (e) {
                this.carousel = null;
                this.leftArrow = null;
                this.rightArrow = null;
                this.pulseCreditsArrow = null;
            }

            this.input.keyboard.on('keydown-FIVE', () => this.insertCoinCredits());
            this.input.keyboard.on('keydown-SIX', () => this.insertCoinCredits());
            this.input.keyboard.on('keydown-LEFT', () => this.changeLangCredits(-1));
            this.input.keyboard.on('keydown-RIGHT', () => this.changeLangCredits(1));

            this.startGameFromCredits = (players) => {
                if (hasStartAccessForPlayers(players)) {
                    try {
                        const intro = this.sound.get('intro_bgm');
                        if (intro && intro.isPlaying) intro.stop();
                    } catch (e) { }
                    consumeCreditsForPlayers(players);
                    resetGameStateForNewRun(players);
                    this.scene.start('LevelSelectScene');
                } else {
                    this.scene.start('AttractScene');
                }
            };
            this.input.keyboard.on('keydown-ONE', () => this.startGameFromCredits(1));
            this.input.keyboard.on('keydown-TWO', () => this.startGameFromCredits(2));

            this.input.keyboard.once('keydown-SPACE', () => this.scene.start('AttractScene'));
            this.input.keyboard.once('keydown-ESC', () => this.scene.start('AttractScene'));

            this.changeLangCredits = (dir) => {
                if (this.sound) this.sound.play('select_sfx', { volume: 0.4 });
                this.currentLangIndex = (this.currentLangIndex + dir + this.languages.length) % this.languages.length;
                GAME_STATE.language = this.languages[this.currentLangIndex];
                if (this.flagSprite) this.flagSprite.setFrame(this.currentLangIndex);
                try {
                    const dirSign = (dir > 0) ? 1 : -1;
                    if (this.flagSprite) {
                        this.tweens.add({
                            targets: this.flagSprite,
                            x: this.flagSprite.x + (dirSign * 28),
                            angle: dirSign * 6,
                            scaleX: 1.15,
                            scaleY: 0.95,
                            duration: 140,
                            yoyo: true,
                            ease: 'Cubic.easeOut',
                            onComplete: () => {
                                try {
                                    this.flagSprite.setAngle(0);
                                    this.flagSprite.setScale(1, 1);
                                } catch (e) { }
                            }
                        });
                    }
                } catch (e) { }
                try {
                    if (dir > 0) this.pulseCreditsArrow && this.pulseCreditsArrow(this.rightArrow);
                    else if (dir < 0) this.pulseCreditsArrow && this.pulseCreditsArrow(this.leftArrow);
                } catch (e) { }
                loadTranslations(GAME_STATE.language, () => { this.updateCreditsUI(); });
                this.resetCreditsTimer();
            };

            this.insertCoinCredits = () => {
                try {
                    if (this.creditManager && typeof this.creditManager.insertCoin === 'function') {
                        this.creditManager.insertCoin({ volume: 0.45 });
                        this.resetCreditsTimer();
                        return;
                    }
                } catch (e) { }
                try {
                    if (this.sound) this.sound.play('coin_sfx', { volume: 0.45 });
                } catch (e) { }
                GAME_STATE.credits = (Number(GAME_STATE.credits) || 0) + 1;
                this.updateCreditsUI();
                this.resetCreditsTimer();
            };

            this.updateCreditsUI = () => {
                const t2 = TRANSLATIONS[GAME_STATE.language] || {};
                const insertCoin = t2.insert_coin || 'INSERT COIN';
                const credit = t2.credit || 'CREDIT';
                const freePlay = t2.free_play || 'FREE PLAY';
                const player1 = t2.player1 || 'PLAYER 1';
                const player2 = t2.player2 || 'PLAYER 2';
                const canStart1P = hasStartAccessForPlayers(1);
                const canStart2P = hasStartAccessForPlayers(2);

                if (this.coinText) {
                    if (isFreeplayEnabled()) this.coinText.setText(freePlay);
                    else if ((Number(GAME_STATE.credits) || 0) <= 0) this.coinText.setText(insertCoin);
                    else this.coinText.setText(credit + ' ' + (Number(GAME_STATE.credits) || 0));
                }
                if (this.player1Text) this.player1Text.setText(player1).setStyle({ fill: canStart1P ? '#00ff00' : '#666666' });
                if (this.player2Text) this.player2Text.setText(player2).setStyle({ fill: canStart2P ? '#00ff00' : '#666666' });
            };

            this.resetCreditsTimer = () => {
                try {
                    if (this.creditsTimer) this.creditsTimer.remove();
                } catch (e) { }
                this.creditsTimer = this.time.delayedCall(this.creditsTimeoutSecs, () => { this.scene.start('AttractScene'); });
            };

            loadTranslations(GAME_STATE.language, () => { this.updateCreditsUI(); });
        }
    };
}
