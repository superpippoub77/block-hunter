export function createCreditsSceneClass(deps) {
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

    class CreditsScene extends SharedFrontendScene {
        constructor() {
            super('CreditsScene');
        }
    
        create() {
            const t = TRANSLATIONS[GAME_STATE.language] || {};
            this.initializeSharedFrontState();
            // Background
            this.add.image(400, 300, 'bg').setDisplaySize(800, 600);
            // Overlay panel
            try {
                const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
                this.add.rectangle((CONFIG.width || 800) / 2, (CONFIG.height || 600) / 2, (CONFIG.width || 800), (CONFIG.height || 600), 0x000000, overlayAlpha).setDepth(0.1);
            } catch (e) { }
    
            const title = this.add.text(400, 80, t.credits_title || t.credits || 'SVILUPPATORI', { fontSize: '26px', fill: '#ffff00', fontFamily: GAME_FONT }).setOrigin(0.5);
            this.creditsTitleText = title;
            this.titlePanel = this.add.graphics();
            drawTextPanel(this.titlePanel, title, { paddingX: 18, paddingY: 10, radius: 8 });
    
            // Developer entries (customize as needed)
            const lines = [
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
                const txt = this.add.text(400, y, ln, { fontSize: '18px', fill: '#ffffff', fontFamily: GAME_FONT }).setOrigin(0.5);
                y += 28;
            });
    
            // Duration then return to attract (we keep a timer so it can be reset on coin)
            this.creditsTimeoutSecs = Number(CONFIG.creditsTimeout) || 6000;
            this.creditsTimer = this.time.delayedCall(this.creditsTimeoutSecs, () => {
                this.scene.start('AttractScene');
            });
    
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
                    this.resetCreditsTimer();
                },
                onPlayerStart: (players) => {
                    const requestedPlayers = Number(players) === 2 ? 2 : 1;
                    try {
                        const intro = this.sound.get('intro_bgm');
                        if (intro && intro.isPlaying) intro.stop();
                    } catch (e) { }
                    resetGameStateForNewRun(requestedPlayers);
                    this.scene.start('LevelSelectScene');
                },
                onInsufficientCredits: () => this.scene.start('AttractScene'),
                onLanguageChanged: () => {
                    this.updateUI();
                    this.resetCreditsTimer();
                },
                onSpace: () => this.scene.start('AttractScene'),
                onEsc: () => this.scene.start('AttractScene'),
                onInteraction: () => this.resetCreditsTimer()
            });
        }
    
        updateUI() {
            const t = TRANSLATIONS[GAME_STATE.language] || {};
            if (this.creditsTitleText) {
                this.creditsTitleText.setText(t.credits_title || t.credits || 'SVILUPPATORI');
            }
            if (this.titlePanel && this.creditsTitleText) {
                drawTextPanel(this.titlePanel, this.creditsTitleText, { paddingX: 18, paddingY: 10, radius: 8 });
            }
            this.updateSharedFrontUi();
        }
    
        resetCreditsTimer() {
            try { if (this.creditsTimer) this.creditsTimer.remove(); } catch (e) { }
            this.creditsTimer = this.time.delayedCall(this.creditsTimeoutSecs, () => { this.scene.start('AttractScene'); });
        }
    }

    return CreditsScene;
}
