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

        create() {
            const t = TRANSLATIONS[GAME_STATE.language] || {};

            this.add.image(400, 300, 'bg').setDisplaySize(800, 600);

            try {
                const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
                this.levelSelectOverlay = this.add.rectangle((CONFIG.width || 800) / 2, (CONFIG.height || 600) / 2, (CONFIG.width || 800), (CONFIG.height || 600), 0x000000, overlayAlpha).setDepth(0.1);
            } catch (e) { }

            const topTenTitle = t.topTen || 'CLASSIFICA';
            const topTitle = this.add.text(400, 80, topTenTitle, {
                fontSize: '24px',
                fill: '#ffff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5);

            try { addSpikeCredit(this); } catch (e) { }

            this.topTitlePanel = this.add.graphics();
            drawTextPanel(this.topTitlePanel, topTitle, { paddingX: 18, paddingY: 10, radius: 8 });

            const nameColLabel = t.name_label || t.name || t.player_name || 'Name';
            const levelColLabel = t.level_label || t.levelLabel || 'Lev';
            const scoreColLabel = t.score_label || t.scoreLabel || 'Score';

            const headerStyle = { fontSize: '18px', fill: '#bfeaff', fontFamily: GAME_FONT };
            this.add.text(150, 130, nameColLabel, headerStyle).setOrigin(0, 0.5);
            this.add.text(420, 130, levelColLabel, headerStyle).setOrigin(0.5, 0.5);
            this.add.text(650, 130, scoreColLabel, headerStyle).setOrigin(1, 0.5);

            let y = 150;
            GAME_STATE.topScores.forEach((entry, i) => {
                const nameText = this.add.text(150, y, `${i + 1}. ${entry.name}`, {
                    fontSize: '24px',
                    fill: '#ffffff',
                    fontFamily: GAME_FONT
                });

                const levelLabel = (typeof entry.level !== 'undefined') ? `LV${Number(entry.level) + 1}` : '';
                const levelText = this.add.text(420, y, levelLabel, {
                    fontSize: '20px',
                    fill: '#ffcc00',
                    fontFamily: GAME_FONT
                }).setOrigin(0.5, 0);

                const scoreText = this.add.text(650, y, entry.score.toString(), {
                    fontSize: '24px',
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

                y += 35;
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
                try {
                    if (this.children) {
                        this.children.list.forEach(ch => {
                            if (ch && ch.text && (ch.text === 'CLASSIFICA' || ch.text === TRANSLATIONS[this.previousLang]?.topTen || false)) {
                                ch.setText(topTenTitle);
                            }
                        });
                    }
                } catch (e) { }
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
        }
    };
}
