/**
 * Crea la classe scena Credits con dependency injection dal core.
 * @param {Record<string, any>} deps Dipendenze runtime condivise.
 * @returns {typeof Phaser.Scene} Classe scena Credits.
 */
export function createCreditsSceneClass(deps) {
    const {
        CONFIG,
        drawTextPanel,
        GAME_FONT,
        GAME_STATE,
        SharedFrontendScene,
        applyConfiguredFrontSceneLayout,
        playConfiguredFrontSceneTimeline,
        resolveConfiguredFrontSceneTarget,
        resolveFrontSceneConfig,
        resetGameStateForNewRun,
        TRANSLATIONS,
    } = deps;

    class CreditsScene extends SharedFrontendScene {
        /**
         * Inizializza la scena credits.
         */
        constructor() {
            super('CreditsScene');
        }
    
        /**
         * Crea UI credits e attiva i timer di ritorno.
         * @returns {void}
         */
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
                const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                    ? resolveConfiguredFrontSceneTarget('CreditsScene', 'onTimeout', 'AttractScene')
                    : 'AttractScene';
                this.scene.start(next || 'AttractScene');
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
            this._frontSceneTimelineStarted = false;
            if (loadLanguage) {
                loadLanguage(languageCode, (payload) => {
                    const normalized = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
                    if (languageCode) TRANSLATIONS[languageCode] = normalized;
                    this.updateUI();
                    try {
                        const frontCfg = resolveFrontSceneConfig('CreditsScene');
                        if (frontCfg.enabled && !this._frontSceneTimelineStarted) {
                            playConfiguredFrontSceneTimeline(this, 'CreditsScene');
                            this._frontSceneTimelineStarted = true;
                        }
                    } catch (e) { }
                });
            } else {
                this.updateUI();
                try {
                    const frontCfg = resolveFrontSceneConfig('CreditsScene');
                    if (frontCfg.enabled && !this._frontSceneTimelineStarted) {
                        playConfiguredFrontSceneTimeline(this, 'CreditsScene');
                        this._frontSceneTimelineStarted = true;
                    }
                } catch (e) { }
            }
        }
    
        /**
         * Registra input della scena credits.
         * @returns {void}
         */
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
                    const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                        ? resolveConfiguredFrontSceneTarget('CreditsScene', 'onStart', 'LevelSelectScene')
                        : 'LevelSelectScene';
                    this.scene.start(next || 'LevelSelectScene');
                },
                onInsufficientCredits: () => {
                    const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                        ? resolveConfiguredFrontSceneTarget('CreditsScene', 'onInsufficientCredits', 'AttractScene')
                        : 'AttractScene';
                    this.scene.start(next || 'AttractScene');
                },
                onLanguageChanged: () => {
                    this.updateUI();
                    this.resetCreditsTimer();
                },
                onSpace: () => {
                    const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                        ? resolveConfiguredFrontSceneTarget('CreditsScene', 'onSpace', 'AttractScene')
                        : 'AttractScene';
                    this.scene.start(next || 'AttractScene');
                },
                onEsc: () => {
                    const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                        ? resolveConfiguredFrontSceneTarget('CreditsScene', 'onEsc', 'AttractScene')
                        : 'AttractScene';
                    this.scene.start(next || 'AttractScene');
                },
                onInteraction: () => this.resetCreditsTimer()
            });
        }
    
        /**
         * Aggiorna testi e stato UI credits.
         * @returns {void}
         */
        updateUI() {
            const t = TRANSLATIONS[GAME_STATE.language] || {};
            if (this.creditsTitleText) {
                this.creditsTitleText.setText(t.credits_title || t.credits || 'SVILUPPATORI');
            }
            if (this.titlePanel && this.creditsTitleText) {
                drawTextPanel(this.titlePanel, this.creditsTitleText, { paddingX: 18, paddingY: 10, radius: 8 });
            }
            try {
                applyConfiguredFrontSceneLayout(this, 'CreditsScene', { t, state: GAME_STATE, config: CONFIG });
            } catch (e) { }
            this.updateSharedFrontUi();
        }
    
        /**
         * Resetta timeout di inattivita nella scena credits.
         * @returns {void}
         */
        resetCreditsTimer() {
            try { if (this.creditsTimer) this.creditsTimer.remove(); } catch (e) { }
            this.creditsTimer = this.time.delayedCall(this.creditsTimeoutSecs, () => {
                const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                    ? resolveConfiguredFrontSceneTarget('CreditsScene', 'onTimeout', 'AttractScene')
                    : 'AttractScene';
                this.scene.start(next || 'AttractScene');
            });
        }
    }

    return CreditsScene;
}
