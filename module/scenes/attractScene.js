export function createAttractScene(deps) {
const {
    Phaser,
    CONFIG,
    GAME_STATE,
    GAME_FONT,
    HUD_DEPTH,
    TRANSLATIONS,
    LOGGER,
    OBJECT_FRAMES,
    TILE_FRAMES,
    WALL_TILE_COLS,
    applyMappingFrameOverrides,
    isFreeplayEnabled,
    hasStartAccessForPlayers,
    consumeCreditsForPlayers,
    TILE_NATIVE_WIDTH,
    TILE_NATIVE_HEIGHT,
    OBJECT_NATIVE_SIZE,
    defaultFrame,
    PRELOAD_ASSET_MANIFEST_KEY,
    PRELOAD_ASSET_MANIFEST_PATH,
    PRELOAD_SPRITESHEET_CONFIGS,
    LOG_LEVELS,
    LOG_LEVEL_NAMES,
    normalizeLogLevel,
    readInitialLogLevel,
    inferPurposeFromName,
    getFunctionParamNames,
    inferOutputFromName,
    toDocEntry,
    buildTopLevelFunctionDocs,
    buildSceneMethodsDocs,
    chooseTraceLevel,
    instrumentSceneMethods,
    queueLegacyPreloadAssets,
    queueAssetsFromManifest,
    mergeLocalConfig,
    loadTranslations,
    clearRuntimeMatchStorage,
    resetGameStateForNewRun,
    drawTextPanel,
    getTextureMaxNumericFrame,
    playLoopAudioSafely,
    resolveContactSpec,
    LEVEL_CONFIG,
    getLevelFileName,
    getLevelMasterNumber,
    parseExitTargetLevel,
    addSpikeCredit,
    createCreditsManager,
    createLanguageCarousel
} = deps;
class AttractScene extends Phaser.Scene {
    constructor() {
        super('AttractScene');
    }

    create() {
        const gameMusic = this.sound.get('game_bgm');
        if (gameMusic && gameMusic.isPlaying) {
            gameMusic.stop();
        }

        this.languages = ['it', 'fr', 'de', 'en', 'us', 'ja', 'es', 'zh'];
        this.currentLangIndex = 0;
        GAME_STATE.language = this.languages[0];

        // Intro music before gameplay
        playLoopAudioSafely(this, 'intro_bgm', 0.35);

    // Background image (use parallaxBgFactor for consistency)
    const attractBgScroll = (typeof CONFIG.parallaxBgFactor === 'number') ? CONFIG.parallaxBgFactor : 0.96;
    this.add.image(400, 300, 'bg').setDisplaySize(800, 600).setScrollFactor(attractBgScroll);
        // Configurable dark overlay to dim the background while UI is visible
        const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
        this.attractOverlay = this.add.rectangle(400, 300, 800, 600, 0x000000, overlayAlpha).setDepth(0.1);

            // credit (place in attract mode bottom-right like other non-game scenes)
            try { addSpikeCredit(this); } catch (e) { }

        // Title image (loaded from images/title.png)
        this.titleImage = this.add.image(400, -120, 'title').setOrigin(0.5);
        this.titleImage.setScale(1.3);

        this.tweens.add({
            targets: this.titleImage,
            y: 150,
            scale: 1,
            duration: 800,
            ease: 'Bounce.easeOut',
            onComplete: () => {
                // (no physics body on titleImage in attract mode)
                const vibTween = this.tweens.add({
                    targets: this.titleImage,
                    x: '+=6',
                    duration: 70,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                const rotTween = this.tweens.add({
                    targets: this.titleImage,
                    angle: 2,
                    duration: 140,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                const blinkTween = this.tweens.add({
                    targets: this.titleImage,
                    alpha: 0.6,
                    duration: 900,
                    yoyo: true,
                    repeat: -1
                });
                this.time.delayedCall(3000, () => {
                    try {
                        if (vibTween && vibTween.stop) vibTween.stop();
                        if (rotTween && rotTween.stop) rotTween.stop();
                        if (blinkTween && blinkTween.stop) blinkTween.stop();
                    } catch (e) { }
                    this.titleImage.x = 400;
                    this.titleImage.y = 150;
                    this.titleImage.angle = 0;
                    this.titleImage.alpha = 1;
                    this.titleImage.setScale(1);

                    // subtitle removed: no subtitle sign created here

                    const explorerImage = this.add.image(-220, 430, 'explorer').setOrigin(0.5);
                    explorerImage.setDepth(20);
                    // (no physics body on explorerImage in attract mode)
                    this.tweens.add({
                        targets: explorerImage,
                        x: 400,
                        duration: 2000,
                        ease: 'Sine.easeOut',
                        onComplete: () => {
                            this.tweens.add({
                                targets: explorerImage,
                                alpha: 0,
                                duration: 250,
                                onComplete: () => {
                                    explorerImage.destroy();

                                    this.titleImage.setVisible(false);

                                    const explosionTitle = this.add.image(400, 150, 'title_explosion').setOrigin(0.5);
                                    explosionTitle.setAlpha(0);
                                    explosionTitle.setDepth(21);

                                    this.tweens.add({
                                        targets: explosionTitle,
                                        alpha: 1,
                                        duration: 180,
                                        onComplete: () => {
                                            // Move the explosion away and restore the title immediately (subtitle removed)
                                            try {
                                                this.tweens.add({
                                                    targets: explosionTitle,
                                                    y: -180,
                                                    alpha: 0,
                                                    duration: 420,
                                                    ease: 'Cubic.easeIn',
                                                    onComplete: () => {
                                                        try { explosionTitle.destroy(); } catch (e) { }
                                                        this.titleImage.setVisible(true);
                                                        this.titleImage.x = 400;
                                                        this.titleImage.y = -120;
                                                        this.titleImage.angle = 0;
                                                        this.titleImage.alpha = 1;
                                                        this.titleImage.setScale(1);
                                                        this.tweens.add({
                                                            targets: this.titleImage,
                                                            y: 150,
                                                            duration: 800,
                                                            ease: 'Bounce.easeOut'
                                                        });
                                                    }
                                                });
                                            } catch (e) { }
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
            }
        });

        this.instructionsText = this.add.text(400, 280, '', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: GAME_FONT,
            align: 'center'
        }).setOrigin(0.5);
        this.instructionsText.y = -50;
        this.tweens.add({
            targets: this.instructionsText,
            y: 280,
            duration: 800,
            ease: 'Bounce.easeOut'
        });
        this.tweens.add({
            targets: this.instructionsText,
            angle: -1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 800
        });

        // Legend of objects removed by request (was showing object icons and descriptions).
        // If you want to re-enable it later, restore the legend block here.

        // Panels and UI elements (HUD placed on top using HUD_DEPTH)
        try {
            this.creditManager = createCreditsManager(this, { gameState: GAME_STATE, config: CONFIG, hudDepth: HUD_DEPTH, font: GAME_FONT, x: 400 });
        } catch (e) {
            // fallback: create minimal texts directly
            this.coinText = this.add.text(400, 520, '', { fontSize: '24px', fill: '#ffee00ff', fontFamily: GAME_FONT }).setOrigin(0.5).setDepth(HUD_DEPTH).setScrollFactor(0);
            this.coinPanel = null;
            this.player1Text = this.add.text(150, 550, '', { fontSize: '18px', fill: '#666666', fontFamily: GAME_FONT }).setOrigin(0.5).setDepth(HUD_DEPTH).setScrollFactor(0);
            this.player1Panel = null;
            this.player2Text = this.add.text(650, 550, '', { fontSize: '18px', fill: '#666666', fontFamily: GAME_FONT }).setOrigin(0.5).setDepth(HUD_DEPTH).setScrollFactor(0);
            this.player2Panel = null;
        }

        // Language selector with flags (use shared language carousel module)
        this.carousel = createLanguageCarousel(this, { languages: this.languages, index: this.currentLangIndex, x: 400, y: 560, hudDepth: HUD_DEPTH, font: GAME_FONT });

        // Signature text for attract mode
        // signature text removed from bottom-center in AttractScene (keep credit via addSpikeCredit)

        // Setup input
        this.setupInput();
        this.lastMoveDir = { x: 1, y: 0 };

        // Story alternating: toggle between instructions and a short story every few seconds
        this.showingStory = false;

        // Carica le traduzioni prima di mostrare la UI
        loadTranslations(GAME_STATE.language, () => {
            // Story toggle event solo dopo che le traduzioni sono pronte
            this.storyToggleEvent = this.time.addEvent({
                delay: 5000,
                loop: true,
                callback: this.toggleStory,
                callbackScope: this
            });
            this.updateUI();
            this.resetTimeout();
            // Attract-mode decorative stones disabled (removed)
        });
    }

    setupInput() {
        // Coin insert (route to creditManager if available)
        this.input.keyboard.on('keydown-FIVE', () => {
            try {
                if (this.creditManager && typeof this.creditManager.insertCoin === 'function') {
                    this.creditManager.insertCoin();
                } else {
                    this.insertCoin();
                }
            } catch (e) { this.insertCoin(); }
        });
        this.input.keyboard.on('keydown-SIX', () => {
            try {
                if (this.creditManager && typeof this.creditManager.insertCoin === 'function') {
                    this.creditManager.insertCoin();
                } else {
                    this.insertCoin();
                }
            } catch (e) { this.insertCoin(); }
        });

        // Start game
        this.input.keyboard.on('keydown-ONE', () => this.startGame(1));
        this.input.keyboard.on('keydown-TWO', () => this.startGame(2));

        // Language change
        this.input.keyboard.on('keydown-LEFT', () => this.changeLanguage(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.changeLanguage(1));

        // Config page
        this.input.keyboard.on('keydown-T', () => this.openConfig());

        // Any key resets timeout
        this.input.keyboard.on('keydown', () => this.resetTimeout());
    }

    // Toggle between instructions and story with a fade animation
    toggleStory() {
        const t = TRANSLATIONS[GAME_STATE.language];
        const newText = this.showingStory ? t.instructions : t.story;

        // Fade out -> change text -> fade in
        this.tweens.add({
            targets: this.instructionsText,
            alpha: 0,
            duration: 250,
            onComplete: () => {
                this.instructionsText.setText(newText);
                // small reposition in case multi-line height changes
                this.instructionsText.setOrigin(0.5);
                this.tweens.add({
                    targets: this.instructionsText,
                    alpha: 1,
                    duration: 300
                });
            }
        });

        this.showingStory = !this.showingStory;
    }

    openConfig() {
        this.scene.start('ConfigScene');
    }

    insertCoin() {
        // prefer creditManager implementation if present
        try {
            if (this.creditManager && typeof this.creditManager.insertCoin === 'function') {
                this.creditManager.insertCoin({ volume: 0.45 });
                return;
            }
        } catch (e) { }

        if (this.sound) {
            this.sound.play('coin_sfx', { volume: 0.45 });
        }
        GAME_STATE.credits++;
        this.updateUI();
        this.resetTimeout();
    }

    startGame(players) {
        if (hasStartAccessForPlayers(players)) {
            const intro = this.sound.get('intro_bgm');
            if (intro && intro.isPlaying) {
                intro.stop();
            }
            consumeCreditsForPlayers(players);
            resetGameStateForNewRun(players);
            this.scene.start('LevelSelectScene');
        }
    }

    changeLanguage(dir) {
        if (this.sound) {
            this.sound.play('select_sfx', { volume: 0.4 });
        }
        this.currentLangIndex = (this.currentLangIndex + dir + this.languages.length) % this.languages.length;
        GAME_STATE.language = this.languages[this.currentLangIndex];

        // Update flag sprite frame
        if (this.flagSprite) {
            this.flagSprite.setFrame(this.currentLangIndex);
        }

        // swish effect: quick slide + small tilt when changing flag
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
                    onComplete: () => { try { this.flagSprite.setAngle(0); this.flagSprite.setScale(1,1); } catch (e) { } }
                });
            }
        } catch (e) { }

        // visual feedback: pulse and yellow the appropriate arrow
        try {
            if (dir > 0) this.pulseArrow && this.pulseArrow(this.rightArrow);
            else if (dir < 0) this.pulseArrow && this.pulseArrow(this.leftArrow);
        } catch (e) { }

        // Carica il nuovo dizionario e aggiorna la UI solo dopo il caricamento
        loadTranslations(GAME_STATE.language, () => {
            this.updateUI();
        });
        this.resetTimeout();
    }

    updateUI() {
        // Fallback to empty object if translations not loaded
        const t = TRANSLATIONS[GAME_STATE.language] || {};

        // Provide default strings if missing
        const title = t.title || 'BLOCK HUNTER';
        const instructions = t.instructions || 'INSERT COIN TO START';
        const story = t.story || '';
        const insertCoin = t.insert_coin || 'INSERT COIN';
        const credit = t.credit || 'CREDIT';
        const freePlay = t.free_play || 'FREE PLAY';
        const player1 = t.player1 || 'PLAYER 1';
        const player2 = t.player2 || 'PLAYER 2';
        const canStart1P = hasStartAccessForPlayers(1);
        const canStart2P = hasStartAccessForPlayers(2);

        // Title used to be a text object; now we use an image. Keep backward compatibility
        if (this.titleText && typeof this.titleText.setText === 'function') {
            this.titleText.setText(title);
        } else if (this.titleImage) {
            // no-op: title is an image loaded from images/title.png
        }
        // Show either instructions or story depending on current toggle state
        const displayedText = (this.showingStory) ? (story || instructions) : instructions;
        this.instructionsText.setText(displayedText);

        // Make sure UI texts are above panels
        this.coinText.setDepth(HUD_DEPTH);
        this.player1Text.setDepth(HUD_DEPTH);
        this.player2Text.setDepth(HUD_DEPTH);

        // Draw/update panels: coin always visible, player panels visible only when active
        if (this.coinPanel) drawTextPanel(this.coinPanel, this.coinText, { paddingX: 14, paddingY: 8 });

        if (this.player1Panel) {
            if (canStart1P) {
                // Highlight player panel when active
                drawTextPanel(this.player1Panel, this.player1Text, { paddingX: 10, paddingY: 6 });
            } else {
                // hide when inactive
                this.player1Panel.clear();
            }
        }

        if (this.player2Panel) {
            if (canStart2P) {
                drawTextPanel(this.player2Panel, this.player2Text, { paddingX: 10, paddingY: 6 });
            } else {
                this.player2Panel.clear();
            }
        }

        // Language is now shown via flag sprite, not text

        if (isFreeplayEnabled()) {
            this.coinText.setText(freePlay);
        } else if (GAME_STATE.credits === 0) {
            this.coinText.setText(insertCoin);
        } else {
            this.coinText.setText(credit + ' ' + GAME_STATE.credits);
        }

        if (canStart1P) {
            this.player1Text.setText(player1).setStyle({ fill: '#00ff00' });
        } else {
            this.player1Text.setText(player1).setStyle({ fill: '#666666' });
        }

        if (canStart2P) {
            this.player2Text.setText(player2).setStyle({ fill: '#00ff00' });
        } else {
            this.player2Text.setText(player2).setStyle({ fill: '#666666' });
        }
    }

    resetTimeout() {
        if (this.attractTimer) {
            this.attractTimer.remove();
        }
        this.attractTimer = this.time.delayedCall(CONFIG.attractTimeout, () => {
            this.scene.start('TopTenScene');
        });
    }
}

    return AttractScene;
}
