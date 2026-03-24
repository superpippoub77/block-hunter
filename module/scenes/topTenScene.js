export function createTopTenScene(deps) {
    const {
        Phaser,
        CONFIG,
        GAME_STATE,
        TRANSLATIONS,
        GAME_FONT,
        HUD_DEPTH,
        drawTextPanel,
        addSpikeCredit,
        createCreditsManager,
        createLanguageCarousel,
        loadTranslations
    } = deps;

    return class TopTenScene extends Phaser.Scene {
        constructor() {
            super('TopTenScene');
        }

        getTopTenMetrics(width, height) {
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
                headerY: Math.round(h * 0.22),
                listStartY: Math.round(h * 0.26),
                rowStep: Math.max(22, Math.round(35 * viewportScale)),
                titleFont: Math.max(16, Math.round(24 * viewportScale)),
                headerFont: Math.max(12, Math.round(18 * viewportScale)),
                rowFont: Math.max(12, Math.round(24 * viewportScale)),
                levelFont: Math.max(11, Math.round(20 * viewportScale)),
                colNameX: Math.round(w * 0.17),
                colLevelX: Math.round(w * 0.52),
                colScoreX: Math.round(w * 0.84),
                creditsX: Math.round(w / 2),
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

        applyResponsiveLayout(width, height) {
            const m = this.getTopTenMetrics(width, height);

            if (this.bgImage) {
                this.bgImage.setPosition(m.cx, m.cy);
                this.bgImage.setDisplaySize(m.w, m.h);
            }
            if (this.levelSelectOverlay) {
                this.levelSelectOverlay.setPosition(m.cx, m.cy);
                this.levelSelectOverlay.setSize(m.w, m.h);
            }

            if (this.topTitleText) {
                this.topTitleText.setPosition(m.cx, m.titleY);
                this.topTitleText.setFontSize(`${m.titleFont}px`);
            }
            if (this.topTitlePanel && this.topTitleText) {
                drawTextPanel(this.topTitlePanel, this.topTitleText, { paddingX: 18, paddingY: 10, radius: 8 });
            }

            if (this.headerNameText) {
                this.headerNameText.setPosition(m.colNameX, m.headerY);
                this.headerNameText.setFontSize(`${m.headerFont}px`);
            }
            if (this.headerLevelText) {
                this.headerLevelText.setPosition(m.colLevelX, m.headerY);
                this.headerLevelText.setFontSize(`${m.headerFont}px`);
            }
            if (this.headerScoreText) {
                this.headerScoreText.setPosition(m.colScoreX, m.headerY);
                this.headerScoreText.setFontSize(`${m.headerFont}px`);
            }

            if (Array.isArray(this.scoreRows)) {
                this.scoreRows.forEach((row, idx) => {
                    const y = m.listStartY + idx * m.rowStep;
                    if (row?.nameText) {
                        row.nameText.setPosition(m.colNameX, y);
                        row.nameText.setFontSize(`${m.rowFont}px`);
                    }
                    if (row?.levelText) {
                        row.levelText.setPosition(m.colLevelX, y);
                        row.levelText.setFontSize(`${m.levelFont}px`);
                    }
                    if (row?.scoreText) {
                        row.scoreText.setPosition(m.colScoreX, y);
                        row.scoreText.setFontSize(`${m.rowFont}px`);
                    }
                });
            }

            if (this.coinText) {
                this.coinText.setPosition(m.creditsX, m.coinY);
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

            if (this.coinPanel) drawTextPanel(this.coinPanel, this.coinText, { paddingX: 14, paddingY: 8 });
            if (this.player1Panel && this.player1Text && Number(GAME_STATE.credits) >= 1) drawTextPanel(this.player1Panel, this.player1Text, { paddingX: 10, paddingY: 6 });
            if (this.player2Panel && this.player2Text && Number(GAME_STATE.credits) >= 2) drawTextPanel(this.player2Panel, this.player2Text, { paddingX: 10, paddingY: 6 });
        }

        create() {
            const t = TRANSLATIONS[GAME_STATE.language] || {};
            const metrics = this.getTopTenMetrics();

            this.bgImage = this.add.image(metrics.cx, metrics.cy, 'bg').setDisplaySize(metrics.w, metrics.h);

            try {
                const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
                this.levelSelectOverlay = this.add.rectangle(metrics.cx, metrics.cy, metrics.w, metrics.h, 0x000000, overlayAlpha).setDepth(0.1);
            } catch (e) { }

            const topTenTitle = t.topTen || 'CLASSIFICA';
            this.topTitleText = this.add.text(metrics.cx, metrics.titleY, topTenTitle, {
                fontSize: `${metrics.titleFont}px`,
                fill: '#ffff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5);

            try { addSpikeCredit(this); } catch (e) { }

            this.topTitlePanel = this.add.graphics();
            drawTextPanel(this.topTitlePanel, this.topTitleText, { paddingX: 18, paddingY: 10, radius: 8 });

            const nameColLabel = t.name_label || t.name || t.player_name || 'Name';
            const levelColLabel = t.level_label || t.levelLabel || 'Lev';
            const scoreColLabel = t.score_label || t.scoreLabel || 'Score';

            const headerStyle = { fontSize: `${metrics.headerFont}px`, fill: '#bfeaff', fontFamily: GAME_FONT };
            this.headerNameText = this.add.text(metrics.colNameX, metrics.headerY, nameColLabel, headerStyle).setOrigin(0, 0.5);
            this.headerLevelText = this.add.text(metrics.colLevelX, metrics.headerY, levelColLabel, headerStyle).setOrigin(0.5, 0.5);
            this.headerScoreText = this.add.text(metrics.colScoreX, metrics.headerY, scoreColLabel, headerStyle).setOrigin(1, 0.5);

            this.scoreRows = [];
            let y = metrics.listStartY;
            GAME_STATE.topScores.forEach((entry, i) => {
                const nameText = this.add.text(metrics.colNameX, y, `${i + 1}. ${entry.name}`, {
                    fontSize: `${metrics.rowFont}px`,
                    fill: '#ffffff',
                    fontFamily: GAME_FONT
                });

                const levelLabel = (typeof entry.level !== 'undefined') ? `LV${Number(entry.level) + 1}` : '';
                const levelText = this.add.text(metrics.colLevelX, y, levelLabel, {
                    fontSize: `${metrics.levelFont}px`,
                    fill: '#ffcc00',
                    fontFamily: GAME_FONT
                }).setOrigin(0.5, 0);

                const scoreText = this.add.text(metrics.colScoreX, y, entry.score.toString(), {
                    fontSize: `${metrics.rowFont}px`,
                    fill: '#00ff00',
                    fontFamily: GAME_FONT
                }).setOrigin(1, 0);

                const delay = i * 150;

                nameText.y = -50;
                scoreText.y = -50;

                this.tweens.add({
                    targets: nameText,
                    y,
                    duration: 600,
                    ease: 'Bounce.easeOut',
                    delay
                });

                this.tweens.add({
                    targets: scoreText,
                    y,
                    duration: 600,
                    ease: 'Bounce.easeOut',
                    delay: delay + 50
                });

                if (levelText) {
                    levelText.y = -50;
                    this.tweens.add({
                        targets: levelText,
                        y,
                        duration: 600,
                        ease: 'Bounce.easeOut',
                        delay: delay + 25
                    });
                    this.tweens.add({
                        targets: levelText,
                        angle: -0.5,
                        duration: 800,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut',
                        delay: delay + 600
                    });
                }

                this.tweens.add({
                    targets: [nameText, scoreText],
                    angle: -0.5,
                    duration: 800,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut',
                    delay: delay + 600
                });

                this.scoreRows.push({ nameText, levelText, scoreText });

                y += metrics.rowStep;
            });

            this.time.delayedCall(CONFIG.topTenTimeout, () => {
                this.scene.start('CreditsScene');
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
                    x: metrics.creditsX
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
                    onRequestChange: (dir) => this.changeLanguage(dir)
                });
                this.topLeftArrow = this.carousel?.leftArrow || this.leftArrow || null;
                this.topRightArrow = this.carousel?.rightArrow || this.rightArrow || null;
                this.pulseTopArrow = this.carousel?.pulseArrow || this.pulseArrow || null;
            } catch (e) {
                this.carousel = null;
                this.topLeftArrow = null;
                this.topRightArrow = null;
                this.pulseTopArrow = null;
            }

            this.setupInput();

            this._onResponsiveResize = (gameSize) => {
                const w = (gameSize && gameSize.width) ? gameSize.width : (this.scale.width || CONFIG.width);
                const h = (gameSize && gameSize.height) ? gameSize.height : (this.scale.height || CONFIG.height);
                this.applyResponsiveLayout(w, h);
            };
            this.scale.on('resize', this._onResponsiveResize, this);
            this.events.once('shutdown', () => {
                try {
                    if (this._onResponsiveResize) this.scale.off('resize', this._onResponsiveResize, this);
                } catch (e) { }
            });
            this.applyResponsiveLayout();

            loadTranslations(GAME_STATE.language, () => {
                this.updateUI();
            });
        }

        setupInput() {
            this.input.keyboard.on('keydown-FIVE', () => this.insertCoin());
            this.input.keyboard.on('keydown-SIX', () => this.insertCoin());

            this.input.keyboard.on('keydown-ONE', () => this.scene.start('LevelSelectScene'));
            this.input.keyboard.on('keydown-TWO', () => this.scene.start('LevelSelectScene'));

            this.input.keyboard.on('keydown-LEFT', () => this.changeLanguage(-1));
            this.input.keyboard.on('keydown-RIGHT', () => this.changeLanguage(1));

            this.input.keyboard.on('keydown', () => {
                this.scene.start('AttractScene');
            });
        }

        changeLanguage(dir) {
            this.currentLangIndex = (this.currentLangIndex + dir + this.languages.length) % this.languages.length;
            GAME_STATE.language = this.languages[this.currentLangIndex];
            if (this.flagSprite) this.flagSprite.setFrame(this.currentLangIndex);
            try {
                if (this.flagSprite) {
                    const dirSign = (dir > 0) ? 1 : -1;
                    this.tweens.add({
                        targets: this.flagSprite,
                        x: this.flagSprite.x + (dirSign * 28),
                        angle: dirSign * 6,
                        scaleX: 1.15,
                        scaleY: 0.95,
                        duration: 140,
                        yoyo: true,
                        ease: 'Cubic.easeOut',
                        onComplete: () => { try { this.flagSprite.setAngle(0); this.flagSprite.setScale(1, 1); } catch (e) { } }
                    });
                }
            } catch (e) { }

            try {
                if (dir > 0) this.pulseTopArrow && this.pulseTopArrow(this.topRightArrow);
                else if (dir < 0) this.pulseTopArrow && this.pulseTopArrow(this.topLeftArrow);
            } catch (e) { }

            loadTranslations(GAME_STATE.language, () => {
                const t = TRANSLATIONS[GAME_STATE.language] || {};
                const topTenTitle = t.topTen || 'CLASSIFICA';
                try { if (this.topTitleText) this.topTitleText.setText(topTenTitle); } catch (e) { }
                this.updateUI();
            });
        }

        insertCoin() {
            try {
                if (this.creditManager && typeof this.creditManager.insertCoin === 'function') {
                    this.creditManager.insertCoin({ volume: 0.45 });
                    return;
                }
            } catch (e) { }

            if (this.sound) this.sound.play('coin_sfx', { volume: 0.45 });
            GAME_STATE.credits++;
            this.updateUI();
        }

        updateUI() {
            const t = TRANSLATIONS[GAME_STATE.language] || {};
            const insertCoin = t.insert_coin || 'INSERT COIN';
            const credit = t.credit || 'CREDIT';
            const player1 = t.player1 || 'PLAYER 1';
            const player2 = t.player2 || 'PLAYER 2';

            if (GAME_STATE.credits === 0) {
                this.coinText.setText(insertCoin);
            } else {
                this.coinText.setText(credit + ' ' + GAME_STATE.credits);
            }

            if (GAME_STATE.credits >= 1) {
                this.player1Text.setText(player1).setStyle({ fill: '#00ff00' });
            } else {
                this.player1Text.setText(player1).setStyle({ fill: '#666666' });
            }

            if (GAME_STATE.credits >= 2) {
                this.player2Text.setText(player2).setStyle({ fill: '#00ff00' });
            } else {
                this.player2Text.setText(player2).setStyle({ fill: '#666666' });
            }

            if (this.coinPanel) drawTextPanel(this.coinPanel, this.coinText, { paddingX: 14, paddingY: 8 });
            if (this.player1Panel) {
                if (GAME_STATE.credits >= 1) drawTextPanel(this.player1Panel, this.player1Text, { paddingX: 10, paddingY: 6 });
                else this.player1Panel.clear();
            }
            if (this.player2Panel) {
                if (GAME_STATE.credits >= 2) drawTextPanel(this.player2Panel, this.player2Text, { paddingX: 10, paddingY: 6 });
                else this.player2Panel.clear();
            }

            this.applyResponsiveLayout();
        }
    };
}
