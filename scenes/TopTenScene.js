export function createTopTenSceneClass(deps) {
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

    class TopTenScene extends SharedFrontendScene {
        constructor() {
            super('TopTenScene');
        }
    
        create() {
            const t = TRANSLATIONS[GAME_STATE.language] || {};
    
            this.add.image(400, 300, 'bg').setDisplaySize(800, 600);
    
            // Dim background with attract overlay alpha so Level Select matches Attract UI
            try {
                const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
                this.levelSelectOverlay = this.add.rectangle((CONFIG.width || 800) / 2, (CONFIG.height || 600) / 2, (CONFIG.width || 800), (CONFIG.height || 600), 0x000000, overlayAlpha).setDepth(0.1);
            } catch (e) { /* ignore if CONFIG not ready */ }
            // Fallback: se la traduzione manca, mostra 'CLASSIFICA'
            const topTenTitle = t.topTen || 'CLASSIFICA';
            const topTitle = this.add.text(400, 80, topTenTitle, {
                fontSize: '24px',
                fill: '#ffff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5);
            this.topTitleText = topTitle;
    
            // Panel behind Top Ten title
            this.topTitlePanel = this.add.graphics();
            drawTextPanel(this.topTitlePanel, topTitle, { paddingX: 18, paddingY: 10, radius: 8 });
    
            // Column headers (localized if possible)
            const nameColLabel = t.name_label || t.name || t.player_name || 'Name';
            const levelColLabel = t.level_label || t.levelLabel || 'Lev';
            const scoreColLabel = t.score_label || t.scoreLabel || 'Score';
    
            const headerStyle = { fontSize: '18px', fill: '#bfeaff', fontFamily: GAME_FONT };
            this.topNameHeaderText = this.add.text(150, 130, nameColLabel, headerStyle).setOrigin(0, 0.5);
            this.topLevelHeaderText = this.add.text(420, 130, levelColLabel, headerStyle).setOrigin(0.5, 0.5);
            this.topScoreHeaderText = this.add.text(650, 130, scoreColLabel, headerStyle).setOrigin(1, 0.5);
    
            let y = 150;
            GAME_STATE.topScores.forEach((entry, i) => {
                // Name text with falling effect
                const nameText = this.add.text(150, y, `${i + 1}. ${entry.name}`, {
                    fontSize: '24px',
                    fill: '#ffffff',
                    fontFamily: GAME_FONT
                });
    
                // Score text with falling effect
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
    
                // Apply falling boulder effect with staggered delays
                const delay = i * 150; // Each entry falls slightly after the previous
    
                // Start above screen
                nameText.y = -50;
                scoreText.y = -50;
    
                // Falling animation for name
                this.tweens.add({
                    targets: nameText,
                    y: y,
                    duration: 600,
                    ease: 'Bounce.easeOut',
                    delay: delay
                });
    
                // Falling animation for score
                    this.tweens.add({
                        targets: scoreText,
                        y: y,
                        duration: 600,
                        ease: 'Bounce.easeOut',
                        delay: delay + 50 // Slightly delayed for cascading effect
                    });
    
                    // Falling animation for level
                    if (levelText) {
                        levelText.y = -50;
                        this.tweens.add({
                            targets: levelText,
                            y: y,
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
    
                // Subtle wobble after landing
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
    
            this.initializeSharedFrontState();
            this.createSharedFrontUi();
            try { this.updateSharedFrontUi(); } catch (e) { }
    
            this.setupInput();
    
            const languageCode = String(GAME_STATE.language || '').trim().toLowerCase();
            try {
                if (this.carousel && typeof this.carousel.syncLanguage === 'function') {
                    this.carousel.syncLanguage(languageCode, { gameState: GAME_STATE });
                }
            } catch (e) { }
    
            const loadLanguage = (typeof this.carousel?.loadTranslations === 'function')
                ? this.carousel.loadTranslations.bind(this.carousel)
                : null;
            if (loadLanguage) {
                loadLanguage(languageCode, (payload) => {
                    const normalized = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
                    if (languageCode) TRANSLATIONS[languageCode] = normalized;
                    this.updateUI();
                });
            } else {
                this.updateUI();
            }
        }
    
        setupInput() {
            this.bindSharedFrontKeys({
                onCoinAccepted: () => {
                    if (typeof this.updateUI === 'function') this.updateUI();
                },
                onPlayerStart: (players) => {
                    const requestedPlayers = Number(players) === 2 ? 2 : 1;
                    resetGameStateForNewRun(requestedPlayers);
                    this.scene.start('LevelSelectScene');
                },
                onLanguageChanged: () => this.updateUI(),
                onUnhandledKey: () => this.scene.start('AttractScene')
            });
        }
    
        updateUI() {
            const t = TRANSLATIONS[GAME_STATE.language] || {};
            if (this.topTitleText) this.topTitleText.setText(t.topTen || 'CLASSIFICA');
            if (this.topNameHeaderText) this.topNameHeaderText.setText(t.name_label || t.name || t.player_name || 'Name');
            if (this.topLevelHeaderText) this.topLevelHeaderText.setText(t.level_label || t.levelLabel || 'Lev');
            if (this.topScoreHeaderText) this.topScoreHeaderText.setText(t.score_label || t.scoreLabel || 'Score');
            if (this.topTitlePanel && this.topTitleText) drawTextPanel(this.topTitlePanel, this.topTitleText, { paddingX: 18, paddingY: 10, radius: 8 });
            this.updateSharedFrontUi();
        }
    }

    return TopTenScene;
}
