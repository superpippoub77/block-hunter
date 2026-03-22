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

        getCreditsMetrics(width, height) {
            const w = Math.max(320, Math.round(width || this.scale.width || CONFIG.width || 800));
            const h = Math.max(240, Math.round(height || this.scale.height || CONFIG.height || 600));
            const baseW = Number(CONFIG.width) || 800;
            const baseH = Number(CONFIG.height) || 600;
            const viewportScale = Phaser.Math.Clamp(Math.min(w / baseW, h / baseH), 0.62, 1.25);

            return {
                w,
                h,
                cx: Math.round(w / 2),
                cy: Math.round(h / 2),
                titleY: Math.round(h * 0.13),
                titleFont: Math.max(16, Math.round(26 * viewportScale)),
                lineStartY: Math.round(h * 0.26),
                lineGap: Math.max(18, Math.round(28 * viewportScale)),
                lineFont: Math.max(11, Math.round(18 * viewportScale)),
                coinY: h - Math.max(68, Math.round(80 * viewportScale)),
                playersY: h - Math.max(34, Math.round(46 * viewportScale)),
                player1X: Math.round(w * 0.18),
                player2X: Math.round(w * 0.82),
                coinFont: Math.max(14, Math.round(24 * viewportScale)),
                playerFont: Math.max(11, Math.round(18 * viewportScale)),
                carouselY: h - Math.max(16, Math.round(30 * viewportScale)),
                carouselGap: Math.max(52, Math.round(80 * viewportScale))
            };
        }

        applyCreditsLayout(width, height) {
            const m = this.getCreditsMetrics(width, height);

            if (this.bgImage) {
                this.bgImage.setPosition(m.cx, m.cy);
                this.bgImage.setDisplaySize(m.w, m.h);
            }
            if (this.overlayRect) {
                this.overlayRect.setPosition(m.cx, m.cy);
                this.overlayRect.setSize(m.w, m.h);
            }
            if (this.titleText) {
                this.titleText.setPosition(m.cx, m.titleY);
                this.titleText.setFontSize(`${m.titleFont}px`);
            }
            if (this.titlePanel && this.titleText) {
                drawTextPanel(this.titlePanel, this.titleText, { paddingX: 18, paddingY: 10, radius: 8 });
            }

            if (Array.isArray(this.creditLines)) {
                this.creditLines.forEach((txt, idx) => {
                    if (!txt) return;
                    txt.setPosition(m.cx, m.lineStartY + idx * m.lineGap);
                    txt.setFontSize(`${m.lineFont}px`);
                    txt.setWordWrapWidth(Math.max(250, m.w - 70), true);
                });
            }

            if (this.coinText) {
                this.coinText.setPosition(m.cx, m.coinY);
                this.coinText.setFontSize(`${m.coinFont}px`);
            }
            if (this.player1Text) {
                this.player1Text.setPosition(m.player1X, m.playersY);
                this.player1Text.setFontSize(`${m.playerFont}px`);
            }
            if (this.player2Text) {
                this.player2Text.setPosition(m.player2X, m.playersY);
                this.player2Text.setFontSize(`${m.playerFont}px`);
            }

            const flagSprite = this.carousel?.flagSprite || this.flagSprite;
            const leftArrow = this.carousel?.leftArrow || this.leftArrow;
            const rightArrow = this.carousel?.rightArrow || this.rightArrow;
            if (flagSprite) {
                flagSprite.setPosition(m.cx, m.carouselY);
                flagSprite.baseX = m.cx;
            }
            if (leftArrow) {
                leftArrow.setPosition(m.cx - m.carouselGap, m.carouselY);
                leftArrow.setFontSize(`${Math.max(16, Math.round(m.playerFont * 1.35))}px`);
            }
            if (rightArrow) {
                rightArrow.setPosition(m.cx + m.carouselGap, m.carouselY);
                rightArrow.setFontSize(`${Math.max(16, Math.round(m.playerFont * 1.35))}px`);
            }
        }

        create() {
            const metrics = this.getCreditsMetrics();
            this.bgImage = this.add.image(metrics.cx, metrics.cy, 'bg').setDisplaySize(metrics.w, metrics.h);
            try {
                const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
                this.overlayRect = this.add.rectangle(metrics.cx, metrics.cy, metrics.w, metrics.h, 0x000000, overlayAlpha).setDepth(0.1);
            } catch (e) { }

            this.titleText = this.add.text(metrics.cx, metrics.titleY, 'SVILUPPATORI', { fontSize: `${metrics.titleFont}px`, fill: '#ffff00', fontFamily: GAME_FONT }).setOrigin(0.5);
            this.titlePanel = this.add.graphics();
            drawTextPanel(this.titlePanel, this.titleText, { paddingX: 18, paddingY: 10, radius: 8 });

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

            this.creditLines = [];
            let y = metrics.lineStartY;
            lines.forEach((ln) => {
                const lineText = this.add.text(metrics.cx, y, ln, { fontSize: `${metrics.lineFont}px`, fill: '#ffffff', fontFamily: GAME_FONT }).setOrigin(0.5);
                this.creditLines.push(lineText);
                y += metrics.lineGap;
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
                    x: metrics.cx
                });
            } catch (e) {
                this.creditManager = null;
            }

            try {
                this.carousel = createLanguageCarousel(this, {
                    languages: this.languages,
                    index: this.currentLangIndex,
                    x: metrics.cx,
                    y: metrics.carouselY,
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

            this._onResponsiveResize = (gameSize) => {
                const w = (gameSize && gameSize.width) ? gameSize.width : (this.scale.width || CONFIG.width);
                const h = (gameSize && gameSize.height) ? gameSize.height : (this.scale.height || CONFIG.height);
                this.applyCreditsLayout(w, h);
            };
            this.scale.on('resize', this._onResponsiveResize, this);
            this.events.once('shutdown', () => {
                try {
                    if (this._onResponsiveResize) this.scale.off('resize', this._onResponsiveResize, this);
                } catch (e) { }
            });
            this.applyCreditsLayout();

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
                this.applyCreditsLayout();
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
