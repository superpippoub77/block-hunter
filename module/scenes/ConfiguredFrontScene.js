/**
 * Crea una scena frontend completamente guidata da front-scenes.json.
 * @param {string} sceneKey Chiave scena da risolvere nel file di configurazione.
 * @param {Record<string, any>} deps Dipendenze runtime condivise.
 * @returns {typeof Phaser.Scene} Classe scena configurata.
 */
export function createConfiguredFrontSceneClass(sceneKey, deps) {
    const {
        applyConfiguredFrontSceneLayout,
        CONFIG,
        GAME_STATE,
        Number,
        Phaser,
        playConfiguredFrontSceneTimeline,
        resolveFrontSceneConfig,
        SharedFrontendScene,
        String,
        TRANSLATIONS
    } = deps;

    const key = String(sceneKey || '').trim() || 'ConfiguredFrontScene';
    const BaseScene = SharedFrontendScene || Phaser.Scene;

    /**
     * Converte un colore in formato #rrggbb verso intero Phaser.
     * @param {string|number} raw Valore colore.
     * @returns {number}
     */
    function toColorInt(raw) {
        if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
        const txt = String(raw || '').trim();
        if (!txt) return 0x000000;
        if (txt.startsWith('#')) {
            const parsed = Number.parseInt(txt.slice(1), 16);
            return Number.isFinite(parsed) ? parsed : 0x000000;
        }
        const parsed = Number.parseInt(txt, 16);
        return Number.isFinite(parsed) ? parsed : 0x000000;
    }

    return class ConfiguredFrontScene extends BaseScene {
        /**
         * Costruttore scena configurata.
         */
        constructor() {
            super(key);
            this._frontSceneAutoAdvanceEvent = null;
            this._frontSceneTimelineStarted = false;
            this._configuredNextScene = '';
            this._configuredTransitions = {};
        }

        /**
         * Crea la scena usando la configurazione JSON.
         * @returns {void}
         */
        create() {
            try {
                if (typeof this.initializeSharedFrontState === 'function') {
                    this.initializeSharedFrontState();
                }
            } catch (_e) { }

            const cfg = resolveFrontSceneConfig(key);
            const canvasW = Math.max(320, Number(cfg.canvas?.width) || Number(CONFIG.width) || 800);
            const canvasH = Math.max(200, Number(cfg.canvas?.height) || Number(CONFIG.height) || 600);

            const bgKey = String(cfg.background?.imageKey || '').trim();
            if (bgKey) {
                try {
                    const bg = this.add.image(canvasW * 0.5, canvasH * 0.5, bgKey);
                    const size = Array.isArray(cfg.background?.displaySize) ? cfg.background.displaySize : [canvasW, canvasH];
                    const bgW = Math.max(1, Number(size[0]) || canvasW);
                    const bgH = Math.max(1, Number(size[1]) || canvasH);
                    bg.setDisplaySize(bgW, bgH);
                    bg.setDepth(Number(cfg.background?.depth) || -1000);
                } catch (_e) { }
            }

            if (cfg.overlay && typeof cfg.overlay === 'object') {
                try {
                    const alpha = Math.max(0, Math.min(1, Number(cfg.overlay.alpha) || 0));
                    const overlay = this.add.rectangle(
                        canvasW * 0.5,
                        canvasH * 0.5,
                        canvasW,
                        canvasH,
                        toColorInt(cfg.overlay.color),
                        alpha
                    );
                    overlay.setDepth(Number(cfg.overlay.depth) || 0.1);
                } catch (_e) { }
            }

            try {
                if (typeof this.createSharedFrontUi === 'function') {
                    this.createSharedFrontUi();
                    this.updateSharedFrontUi?.();
                }
            } catch (_e) { }

            const languageCode = String(GAME_STATE.language || '').trim().toLowerCase();
            const loadLanguage = (typeof this.carousel?.loadTranslations === 'function')
                ? this.carousel.loadTranslations.bind(this.carousel)
                : null;

            const onTranslationsReady = (payload) => {
                const normalized = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
                if (languageCode) TRANSLATIONS[languageCode] = normalized;

                const t = TRANSLATIONS[GAME_STATE.language] || {};
                applyConfiguredFrontSceneLayout(this, key, { t, state: GAME_STATE, config: CONFIG });

                const timeline = (cfg.timeline && typeof cfg.timeline === 'object') ? cfg.timeline : {};
                const autoStart = timeline.autoStart !== false;
                if (autoStart && !this._frontSceneTimelineStarted) {
                    playConfiguredFrontSceneTimeline(this, key);
                    this._frontSceneTimelineStarted = true;
                }

                this._configuredNextScene = String(timeline.nextScene || '').trim();
                this._configuredTransitions = (timeline.transitions && typeof timeline.transitions === 'object')
                    ? timeline.transitions
                    : {};
                this.scheduleConfiguredAutoAdvance();
                this.bindConfiguredSceneKeys();
                this.updateUI();
            };

            if (loadLanguage) loadLanguage(languageCode, onTranslationsReady);
            else onTranslationsReady({});
        }

        /**
         * Restituisce il delay di auto-advance in ms.
         * @returns {number}
         */
        resolveAutoAdvanceDelayMs() {
            const cfg = resolveFrontSceneConfig(key);
            const timeline = (cfg.timeline && typeof cfg.timeline === 'object') ? cfg.timeline : {};
            const nextDelay = Number(timeline.nextDelayMs);
            if (Number.isFinite(nextDelay) && nextDelay >= 0) return Math.floor(nextDelay);
            const duration = Number(timeline.duration);
            if (Number.isFinite(duration) && duration > 0) return Math.floor(duration);
            return -1;
        }

        /**
         * Pianifica il passaggio automatico alla prossima scena configurata.
         * @returns {void}
         */
        scheduleConfiguredAutoAdvance() {
            if (!this.time) return;
            if (this._frontSceneAutoAdvanceEvent && this._frontSceneAutoAdvanceEvent.remove) {
                try { this._frontSceneAutoAdvanceEvent.remove(); } catch (_e) { }
            }
            this._frontSceneAutoAdvanceEvent = null;

            const nextScene = this.resolveConfiguredTransitionTarget('onTimeout', this._configuredNextScene);
            if (!nextScene) return;

            const delay = this.resolveAutoAdvanceDelayMs();
            if (!(delay >= 0)) return;

            this._frontSceneAutoAdvanceEvent = this.time.delayedCall(delay, () => {
                this.advanceConfiguredScene('onTimeout');
            });
        }

        /**
         * Risolve la destinazione transizione da mappa configurata.
         * @param {string} keyName Chiave transizione.
         * @param {string} [fallback=''] Fallback opzionale.
         * @returns {string}
         */
        resolveConfiguredTransitionTarget(keyName, fallback = '') {
            const map = (this._configuredTransitions && typeof this._configuredTransitions === 'object')
                ? this._configuredTransitions
                : {};
            const keyNorm = String(keyName || '').trim();
            const mapped = String(map[keyNorm] || '').trim();
            if (mapped) return mapped;
            return String(fallback || '').trim();
        }

        /**
         * Esegue il passaggio alla prossima scena configurata, se valida.
         * @returns {void}
         */
        advanceConfiguredScene(transitionKey = 'next') {
            const nextScene = this.resolveConfiguredTransitionTarget(transitionKey, this._configuredNextScene);
            if (!nextScene || !this.scene) return;
            try {
                this.scene.start(nextScene);
            } catch (_e) { }
        }

        /**
         * Associa keybinding minimi per saltare la scena configurata.
         * @returns {void}
         */
        bindConfiguredSceneKeys() {
            if (!this.input || !this.input.keyboard) return;
            this.input.keyboard.on('keydown-ENTER', () => this.advanceConfiguredScene('onEnter'));
            this.input.keyboard.on('keydown-SPACE', () => this.advanceConfiguredScene('onSpace'));
            this.input.keyboard.on('keydown-ESC', () => this.advanceConfiguredScene('onEsc'));
        }

        /**
         * Aggiorna eventuale UI condivisa.
         * @returns {void}
         */
        updateUI() {
            try {
                if (typeof this.updateSharedFrontUi === 'function') this.updateSharedFrontUi();
            } catch (_e) { }
        }
    };
}
