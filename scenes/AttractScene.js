export function createAttractSceneClass(deps) {
    const {
        createAddCredit,
        createCreditsManager,
        createLanguageCarousel,
        applyConfiguredAttractLayout,
        applyConfiguredAttractPlugins,
        applyStartupSettings,
        Boolean,
        clearInterval,
        clearRuntimeMatchStorage,
        clearTimeout,
        CONFIG,
        console,
        Date,
        defaultFrame,
        document,
        drawTextPanel,
        EFFECT_LIBRARY,
        GAME_FONT,
        GAME_STATE,
        getLevelFileName,
        getLevelMasterNumber,
        getTextureMaxNumericFrame,
        HUD_DEPTH,
        isFinite,
        isFreePlayMode,
        isFrontScenesEnabled,
        isNaN,
        JSON,
        LEVEL_CONFIG,
        loadTranslations,
        loadEffectDefinitionFromScript,
        Math,
        mergeLocalConfig,
        normalizeEffectKey,
        normalizeStartupElement,
        normalizeStartupSettings,
        Number,
        OBJECT_NATIVE_SIZE,
        OBJECT_FRAMES,
        parseEffectLibraryManifestEntries,
        parseExitTargetLevel,
        parseFloat,
        parseInt,
        Phaser,
        SharedFrontendScene,
        playConfiguredAttractElementTween,
        playLoopAudioSafely,
        Promise,
        registerEffectLibraryDefinition,
        resetGameStateForNewRun,
        resolveContactSpec,
        setInterval,
        setTimeout,
        STARTUP_DEFAULTS,
        STARTUP_SETTINGS,
        String,
        TILE_NATIVE_HEIGHT,
        TILE_NATIVE_WIDTH,
        TILE_FRAMES,
        toEffectImportPath,
        TRANSLATIONS,
        WALL_TILE_COLS,
        window,
    } = deps;

    class AttractScene extends SharedFrontendScene {
        constructor() {
            super('AttractScene');
        }
    
        create() {
            const gameMusic = this.sound.get('game_bgm');
            if (gameMusic && gameMusic.isPlaying) {
                gameMusic.stop();
            }
    
            this.initializeSharedFrontState({ resetLanguage: true });
    
            // Intro music before gameplay
            playLoopAudioSafely(this, 'intro_bgm', 0.35);
    
        // Background image (use parallaxBgFactor for consistency)
        const attractBgScroll = (typeof CONFIG.parallaxBgFactor === 'number') ? CONFIG.parallaxBgFactor : 0.96;
        this.add.image(400, 300, 'bg').setDisplaySize(800, 600).setScrollFactor(attractBgScroll);
            // Configurable dark overlay to dim the background while UI is visible
            const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
            this.attractOverlay = this.add.rectangle(400, 300, 800, 600, 0x000000, overlayAlpha).setDepth(0.1);
    
            // Optional runtime-configured attract overlay from data/start.json
            try { applyConfiguredAttractLayout(this); } catch (e) { }
    
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
    
            this.createSharedFrontUi();
            try { this.updateSharedFrontUi(); } catch (e) { }
            try { applyConfiguredAttractPlugins(this); } catch (e) { }
    
            // Signature text for attract mode is now rendered by creditsManager plugin.
    
            // Setup input
            this.setupInput();
            this.lastMoveDir = { x: 1, y: 0 };
    
            // Story alternating: toggle between instructions and a short story every few seconds
            this.showingStory = false;
    
            // Carica le traduzioni dal modulo languageCarousel prima di mostrare la UI
            const languageCode = String(GAME_STATE.language || '').trim().toLowerCase();
            try {
                if (this.carousel && typeof this.carousel.syncLanguage === 'function') {
                    this.carousel.syncLanguage(languageCode, { gameState: GAME_STATE });
                }
            } catch (e) { }
    
            const loadLanguage = (typeof this.carousel?.loadTranslations === 'function')
                ? this.carousel.loadTranslations.bind(this.carousel)
                : null;
            const onTranslationsReady = (payload) => {
                const normalized = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
                if (languageCode) TRANSLATIONS[languageCode] = normalized;
                // Story toggle event solo dopo che le traduzioni sono pronte
                this.storyToggleEvent = this.time.addEvent({
                    delay: 5000,
                    loop: true,
                    callback: this.toggleStory,
                    callbackScope: this
                });
                this.updateUI();
                try { applyConfiguredAttractPlugins(this); } catch (e) { }
                this.resetTimeout();
                // Attract-mode decorative stones disabled (removed)
            };
    
            if (loadLanguage) loadLanguage(languageCode, onTranslationsReady);
            else onTranslationsReady({});
        }
    
        setupInput() {
            this.bindSharedFrontKeys({
                onCoinAccepted: () => {
                    if (typeof this.updateUI === 'function') this.updateUI();
                    this.resetTimeout();
                },
                onPlayerStart: (players) => {
                    const requestedPlayers = Number(players) === 2 ? 2 : 1;
                    const intro = this.sound.get('intro_bgm');
                    if (intro && intro.isPlaying) intro.stop();
                    resetGameStateForNewRun(requestedPlayers);
                    this.scene.start('LevelSelectScene');
                },
                onLanguageChanged: () => {
                    this.updateUI();
                    this.resetTimeout();
                },
                onConfig: () => this.openConfig(),
                onInteraction: () => this.resetTimeout()
            });
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
    
        updateUI() {
            // Fallback to empty object if translations not loaded
            const t = TRANSLATIONS[GAME_STATE.language] || {};
    
            // Provide default strings if missing
            const title = t.title || 'BLOCK HUNTER';
            const instructions = t.instructions || 'INSERT COIN TO START';
            const story = t.story || '';
            const insertCoin = t.insert_coin || 'INSERT COIN';
            const credit = t.credit || 'CREDIT';
            const player1 = t.player1 || 'PLAYER 1';
            const player2 = t.player2 || 'PLAYER 2';
    
            // Title used to be a text object; now we use an image. Keep backward compatibility
            if (this.titleText && typeof this.titleText.setText === 'function') {
                this.titleText.setText(title);
            } else if (this.titleImage) {
                // no-op: title is an image loaded from images/title.png
            }
            // Show either instructions or story depending on current toggle state
            const displayedText = (this.showingStory) ? (story || instructions) : instructions;
            this.instructionsText.setText(displayedText);
    
            this.updateSharedFrontUi();
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
