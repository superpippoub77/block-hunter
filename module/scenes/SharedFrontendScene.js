/**
 * Crea la classe base condivisa per scene frontend (menu/UI).
 * @param {Record<string, any>} deps Dipendenze runtime condivise.
 * @returns {typeof Phaser.Scene} Classe scena SharedFrontend.
 */
export function createSharedFrontendSceneClass(deps) {
    const {
        createAddCredit,
        createCreditsManager,
        createLanguageCarousel,
        CONFIG,
        console,
        drawTextPanel,
        GAME_FONT,
        GAME_STATE,
        HUD_DEPTH,
        isFreePlayMode,
        Number,
        Phaser,
        resetGameStateForNewRun,
        String,
        TRANSLATIONS,
    } = deps;

    class SharedFrontendScene extends Phaser.Scene {
        /**
         * Costruttore base scene frontend condivise.
         * @param {string} sceneKey Chiave della scena Phaser.
         */
        constructor(sceneKey) {
            super(sceneKey);
            this.languages = ['it', 'fr', 'de', 'en', 'us', 'ja', 'es', 'zh'];
            this.currentLangIndex = 0;
        }
    
        /**
         * Inizializza stato condiviso frontend.
         * @param {{resetLanguage?: boolean}} [param0={}] Opzioni init.
         * @returns {void}
         */
        initializeSharedFrontState({ resetLanguage = false } = {}) {
            const currentLanguage = String(GAME_STATE.language || '').trim().toLowerCase();
            if (resetLanguage || !this.languages.includes(currentLanguage)) {
                this.currentLangIndex = 0;
                GAME_STATE.language = this.languages[0];
                return;
            }
    
            this.currentLangIndex = this.languages.indexOf(currentLanguage);
            GAME_STATE.language = this.languages[this.currentLangIndex];
        }
    
        /**
         * Crea la UI comune per scene frontend.
         * @returns {void}
         */
        createSharedFrontUi() {
            try {
                this.creditManager = createCreditsManager(this, {
                    gameState: GAME_STATE,
                    config: CONFIG,
                    hudDepth: HUD_DEPTH,
                    font: GAME_FONT,
                    x: 400,
                    getTranslation: () => TRANSLATIONS[GAME_STATE.language] || {},
                    isFreePlayMode: () => isFreePlayMode()
                });
            } catch (e) {
                try { console.error('[SharedFrontendScene] creditsManager init failed', e); } catch (_err) { }
                this.creditManager = null;
            }

            // Fallback: keep INSERT COIN visible even if plugin init fails.
            if (!this.creditManager) {
                try {
                    this.coinText = this.add.text(400, 520, 'INSERT COIN', {
                        fontSize: '24px',
                        fill: '#ffee00',
                        fontFamily: GAME_FONT
                    }).setOrigin(0.5).setDepth((typeof HUD_DEPTH === 'number') ? HUD_DEPTH : 10000).setScrollFactor(0);
                } catch (e) { }
            }
    
            this.carousel = createLanguageCarousel(this, {
                languages: this.languages,
                index: this.currentLangIndex,
                x: 400,
                y: 560,
                hudDepth: HUD_DEPTH,
                font: GAME_FONT,
                onRequestChange: (dir) => {
                    if (this.carousel && typeof this.carousel.changeLanguage === 'function') {
                        this.carousel.changeLanguage(dir, {
                            gameState: GAME_STATE,
                            translationStore: TRANSLATIONS,
                            onAfter: (lang) => {
                                if (typeof this.onLanguageChanged === 'function') this.onLanguageChanged(lang);
                                else if (typeof this.updateUI === 'function') this.updateUI();
                                else this.updateSharedFrontUi();
                            }
                        });
                    }
                }
            });
            try {
                this.producerCreditText = createAddCredit(this, {
                    configCacheKey: 'addCreditOptions',
                    fontFamily: GAME_FONT
                });
            } catch (e) {
                this.producerCreditText = null;
            }

            // Ensure credit labels are rendered immediately on scene enter.
            try { this.updateSharedFrontUi(); } catch (e) { }
        }
    
        /**
         * Associa i binding tastiera condivisi.
         * @param {object} [options={}] Opzioni binding.
         * @returns {void}
         */
        bindSharedFrontKeys(options = {}) {
            const onCoinAccepted = (typeof options.onCoinAccepted === 'function')
                ? options.onCoinAccepted
                : (() => {
                    if (typeof this.updateUI === 'function') this.updateUI();
                    else this.updateSharedFrontUi();
                });
            const onPlayerStart = (typeof options.onPlayerStart === 'function')
                ? options.onPlayerStart
                : ((players) => {
                    const requestedPlayers = Number(players) === 2 ? 2 : 1;
                    resetGameStateForNewRun(requestedPlayers);
                    this.scene.start('LevelSelectScene');
                });
            const onInsufficientCredits = (typeof options.onInsufficientCredits === 'function')
                ? options.onInsufficientCredits
                : null;
            const onLanguageChanged = (typeof options.onLanguageChanged === 'function')
                ? options.onLanguageChanged
                : (() => {
                    if (typeof this.updateUI === 'function') this.updateUI();
                    else this.updateSharedFrontUi();
                });
            const onInteraction = (typeof options.onInteraction === 'function')
                ? options.onInteraction
                : null;
    
            this.input.keyboard.on('keydown', (event) => {
                try {
                    if (this.creditManager && typeof this.creditManager.handleControlInput === 'function') {
                        const result = this.creditManager.handleControlInput(event, {
                            onCoinInserted: () => {
                                onCoinAccepted();
                                this.pulseCreditAcceptedUi();
                            },
                            onStart: (players) => onPlayerStart(players),
                            onInsufficientCredits: (players) => {
                                if (onInsufficientCredits) onInsufficientCredits(players);
                            },
                            onInteraction: (type) => {
                                if (onInteraction) onInteraction(type);
                            }
                        });
                        if (result && result.consumed) return;
                    }
                } catch (e) { }
            });
    
            this.input.keyboard.on('keydown', (event) => {
                try {
                    if (this.carousel && typeof this.carousel.handleKeyboardInput === 'function') {
                        const consumed = this.carousel.handleKeyboardInput(event, {
                            gameState: GAME_STATE,
                            translationStore: TRANSLATIONS,
                            onAfter: (lang) => onLanguageChanged(lang)
                        });
                        if (consumed) {
                            if (onInteraction) onInteraction('language');
                            return;
                        }
                    }
                } catch (e) { }
            });
    
            if (typeof options.onConfig === 'function') {
                this.input.keyboard.on('keydown-T', () => {
                    options.onConfig();
                    if (onInteraction) onInteraction('config');
                });
            }
    
            if (typeof options.onSpace === 'function') {
                this.input.keyboard.on('keydown-SPACE', () => {
                    options.onSpace();
                    if (onInteraction) onInteraction('space');
                });
            }
    
            if (typeof options.onEsc === 'function') {
                this.input.keyboard.on('keydown-ESC', () => {
                    options.onEsc();
                    if (onInteraction) onInteraction('esc');
                });
            }
    
            if (typeof options.onUnhandledKey === 'function') {
                const handledKeys = new Set(['ARROWLEFT', 'ARROWRIGHT', 'T', ' ', 'ESCAPE']);
                try {
                    if (this.creditManager && typeof this.creditManager.getHandledControlKeys === 'function') {
                        const creditHandled = this.creditManager.getHandledControlKeys();
                        if (Array.isArray(creditHandled)) {
                            for (const key of creditHandled) handledKeys.add(String(key || '').trim().toUpperCase());
                        }
                    }
                    if (this.carousel && typeof this.carousel.getHandledControlTokens === 'function') {
                        const languageHandled = this.carousel.getHandledControlTokens();
                        if (Array.isArray(languageHandled)) {
                            for (const key of languageHandled) handledKeys.add(String(key || '').trim().toUpperCase());
                        }
                    }
                } catch (e) { }
                this.input.keyboard.on('keydown', (event) => {
                    const key = this.normalizeSharedFrontKey(event);
                    if (handledKeys.has(key)) return;
                    if (onInteraction) onInteraction('key', event);
                    options.onUnhandledKey(event);
                });
            }
        }
    
        /**
         * Normalizza evento tastiera in codice standardizzato.
         * @param {KeyboardEvent} event Evento keydown.
         * @returns {string}
         */
        normalizeSharedFrontKey(event) {
            const rawKey = String(event?.key || event?.code || '').trim().toUpperCase();
            if (rawKey === 'SPACEBAR') return ' ';
            return rawKey;
        }

        /**
         * Applica feedback visivo quando il credito viene accettato.
         * @returns {void}
         */
        pulseCreditAcceptedUi() {
            const pulseTarget = (obj, opts = {}) => {
                if (!obj || !this.tweens) return;
                try {
                    this.tweens.add({
                        targets: obj,
                        scaleX: opts.scaleX || 1.12,
                        scaleY: opts.scaleY || 1.12,
                        duration: opts.duration || 120,
                        yoyo: true,
                        ease: 'Sine.easeOut'
                    });
                } catch (e) { }
            };

            try { pulseTarget(this.coinText, { scaleX: 1.08, scaleY: 1.08, duration: 140 }); } catch (e) { }

            const canActivateP1 = !!(this.creditManager && typeof this.creditManager.canActivatePlayers === 'function' && this.creditManager.canActivatePlayers(1));
            const canActivateP2 = !!(this.creditManager && typeof this.creditManager.canActivatePlayers === 'function' && this.creditManager.canActivatePlayers(2));

            if (canActivateP1) {
                try { pulseTarget(this.player1Text); } catch (e) { }
                try {
                    if (this.player1Panel) {
                        this.tweens.add({
                            targets: this.player1Panel,
                            alpha: 0.35,
                            duration: 90,
                            yoyo: true,
                            ease: 'Sine.easeOut'
                        });
                    }
                } catch (e) { }
            }

            if (canActivateP2) {
                try { pulseTarget(this.player2Text); } catch (e) { }
                try {
                    if (this.player2Panel) {
                        this.tweens.add({
                            targets: this.player2Panel,
                            alpha: 0.35,
                            duration: 90,
                            yoyo: true,
                            ease: 'Sine.easeOut'
                        });
                    }
                } catch (e) { }
            }
        }
    
        /**
         * Aggiorna elementi UI condivisi frontend.
         * @returns {void}
         */
        updateSharedFrontUi() {
            try {
                if (this.creditManager && typeof this.creditManager.updateTexts === 'function') {
                    this.creditManager.updateTexts();
                }
            } catch (e) { }
    
            const canActivateP1 = !!(this.creditManager && typeof this.creditManager.canActivatePlayers === 'function' && this.creditManager.canActivatePlayers(1));
            const canActivateP2 = !!(this.creditManager && typeof this.creditManager.canActivatePlayers === 'function' && this.creditManager.canActivatePlayers(2));
            if (this.player1Text) this.player1Text.setStyle({ fill: canActivateP1 ? '#00ff00' : '#666666' });
            if (this.player2Text) this.player2Text.setStyle({ fill: canActivateP2 ? '#00ff00' : '#666666' });
    
            if (this.coinPanel) drawTextPanel(this.coinPanel, this.coinText, { paddingX: 14, paddingY: 8 });
            if (this.player1Panel) {
                if (canActivateP1) drawTextPanel(this.player1Panel, this.player1Text, { paddingX: 10, paddingY: 6 });
                else this.player1Panel.clear();
            }
            if (this.player2Panel) {
                if (canActivateP2) drawTextPanel(this.player2Panel, this.player2Text, { paddingX: 10, paddingY: 6 });
                else this.player2Panel.clear();
            }
        }
    
    }

    return SharedFrontendScene;
}
