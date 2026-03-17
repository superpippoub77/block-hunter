/**
 * Crea la classe scena Attract (demo/menu iniziale) con dipendenze iniettate.
 * @param {Record<string, any>} deps Dipendenze runtime condivise.
 * @returns {typeof Phaser.Scene} Classe scena Attract.
 */
export function createAttractSceneClass(deps) {
    const {
        applyConfiguredAttractLayout,
        applyConfiguredAttractPlugins,
        applyConfiguredFrontSceneLayout,
        playConfiguredFrontSceneTimeline,
        resolveConfiguredFrontSceneTarget,
        resolveFrontSceneConfig,
        CONFIG,
        GAME_FONT,
        GAME_STATE,
        loadTranslations,
        Number,
        Phaser,
        SharedFrontendScene,
        playLoopAudioSafely,
        resetGameStateForNewRun,
        String,
        TRANSLATIONS,
    } = deps;
    class AttractScene extends SharedFrontendScene {
        /**
         * Inizializza la scena attract.
         */
        constructor() {
            super('AttractScene');
        }
    
        /**
         * Crea UI e stato della scena attract.
         * @returns {void}
         */
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
            this._frontSceneTimelineStarted = false;
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
                try {
                    applyConfiguredFrontSceneLayout(this, 'AttractScene', { t: TRANSLATIONS[GAME_STATE.language] || {}, state: GAME_STATE, config: CONFIG });
                                        // Assegna the instructions node for toggleStory compatibility
                                        const instructionsNode = this.__frontSceneRuntimeNodes?.['instructions']?.node;
                                        if (instructionsNode) {
                                            this.instructionsText = instructionsNode;
                                        }
                    const frontCfg = resolveFrontSceneConfig('AttractScene');
                    if (frontCfg.enabled && !this._frontSceneTimelineStarted) {
                        playConfiguredFrontSceneTimeline(this, 'AttractScene');
                        this._frontSceneTimelineStarted = true;
                    }
                } catch (e) { }
                this.resetTimeout();
                // Attract-mode decorative stones disabled (removed)
            };
    
            if (loadLanguage) loadLanguage(languageCode, onTranslationsReady);
            else onTranslationsReady({});
        }
    
        /**
         * Registra input/tasti della scena attract.
         * @returns {void}
         */
        setupInput() {
            this.bindSharedFrontKeys({
                onCoinAccepted: () => {
                    if (typeof this.updateUI === 'function') this.updateUI();
                    this.resetTimeout();
                },
                onPlayerStart: (players) => {
                /**
                 * Alterna la visualizzazione della storia/intro.
                 * @returns {void}
                 */
                    const requestedPlayers = Number(players) === 2 ? 2 : 1;
                    const intro = this.sound.get('intro_bgm');
                    if (intro && intro.isPlaying) intro.stop();
                    resetGameStateForNewRun(requestedPlayers);
                    const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                        ? resolveConfiguredFrontSceneTarget('AttractScene', 'onStart', 'LevelSelectScene')
                        : 'LevelSelectScene';
                    this.scene.start(next || 'LevelSelectScene');
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
    
        /**
         * Apre la scena di configurazione.
         * @returns {void}
         */
        openConfig() {
            const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                ? resolveConfiguredFrontSceneTarget('AttractScene', 'onConfig', 'ConfigScene')
                : 'ConfigScene';
            this.scene.start(next || 'ConfigScene');
        }
    
        /**
         * Aggiorna gli elementi UI della scena attract.
         * @returns {void}
         */
        updateUI() {
            // Fallback to empty object if translations not loaded
            const t = TRANSLATIONS[GAME_STATE.language] || {};
    
            // Provide default strings if missing
            const instructions = t.instructions || 'INSERT COIN TO START';
            const story = t.story || instructions;
            
            // Ensure instructions text node exists
            if (!this.instructionsText) {
                this.instructionsText = this.__frontSceneRuntimeNodes?.['instructions']?.node;
            }
            
            // Show either instructions or story depending on current toggle state
            const displayedText = (this.showingStory) ? (story || instructions) : instructions;
            if (this.instructionsText && typeof this.instructionsText.setText === 'function') {
                this.instructionsText.setText(displayedText);
            }

            this.updateSharedFrontUi();
        }
    
        /**
         * Resetta il timer di inattivita attract.
         * @returns {void}
         */
        resetTimeout() {
            if (this.attractTimer) {
                this.attractTimer.remove();
            }
            this.attractTimer = this.time.delayedCall(CONFIG.attractTimeout, () => {
                const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                    ? resolveConfiguredFrontSceneTarget('AttractScene', 'onTimeout', 'TopTenScene')
                    : 'TopTenScene';
                this.scene.start(next || 'TopTenScene');
            });
        }
    }

    return AttractScene;
}
