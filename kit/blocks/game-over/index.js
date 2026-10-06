export function createGameOverScene(deps) {
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
    createLanguageCarousel,
    kitFlow,
    kitGame,
    createNameEntry,
    isHighScore,
    insertTopScore,
    saveTopScores
} = deps;
class GameOverScene extends Phaser.Scene {
    constructor() {
        super('GameOverScene');
    }

    getGameOverMetrics(width, height) {
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
            gameOverY: Math.round(h * 0.34),
            scoreY: Math.round(h * 0.47),
            enterNameY: Math.round(h * 0.58),
            nameY: Math.round(h * 0.66),
            countdownY: Math.round(h * 0.71),
            continueY: Math.round(h * 0.76),
            continueHintY: Math.round(h * 0.83),
            gameOverFont: Math.max(16, Math.round(24 * viewportScale)),
            scoreFont: Math.max(18, Math.round(32 * viewportScale)),
            enterNameFont: Math.max(14, Math.round(24 * viewportScale)),
            nameFont: Math.max(18, Math.round(32 * viewportScale)),
            countdownFont: Math.max(11, Math.round(16 * viewportScale)),
            continueFont: Math.max(13, Math.round(22 * viewportScale)),
            continueHintFont: Math.max(11, Math.round(16 * viewportScale))
        };
    }

    applyGameOverLayout(width, height) {
        const m = this.getGameOverMetrics(width, height);

        if (this.bgRect) {
            this.bgRect.setPosition(m.cx, m.cy);
            this.bgRect.setSize(m.w, m.h);
        }
        if (this.gameOverOverlay) {
            this.gameOverOverlay.setPosition(m.cx, m.cy);
            this.gameOverOverlay.setSize(m.w, m.h);
        }
        if (this.gameOverTextObj) {
            this.gameOverTextObj.setPosition(m.cx, m.gameOverY);
            this.gameOverTextObj.setFontSize(`${m.gameOverFont}px`);
        }
        if (this.scoreTextObj) {
            this.scoreTextObj.setPosition(m.cx, m.scoreY);
            this.scoreTextObj.setFontSize(`${m.scoreFont}px`);
        }
        if (this.nameEntry) {
            this.nameEntry.layout({
                x: m.cx, titleY: m.enterNameY, nameY: m.nameY, countdownY: m.countdownY,
                titleFont: m.enterNameFont, nameFont: m.nameFont, countdownFont: m.countdownFont
            });
        }
        if (this.continueTextObj) {
            this.continueTextObj.setPosition(m.cx, m.continueY);
            this.continueTextObj.setFontSize(`${m.continueFont}px`);
        }
        if (this.continueHintTextObj) {
            this.continueHintTextObj.setPosition(m.cx, m.continueHintY);
            this.continueHintTextObj.setFontSize(`${m.continueHintFont}px`);
        }
    }

    create() {
        // the scene instance is reused between games: forget the previous name entry
        this.nameEntry = null;
        const t = TRANSLATIONS[GAME_STATE.language] || {};
        const metrics = this.getGameOverMetrics();
        this._pendingSceneExit = false;
        this._nameWasAutoTimeout = false;

        const gameOverText = t.game_over || t.gameOver || t.gameOverText || 'GAME OVER';
        const scoreLabel = t.score_label || t.score || 'SCORE';

        this.bgRect = this.add.rectangle(metrics.cx, metrics.cy, metrics.w, metrics.h, 0x220000);

        // Dim background with attract overlay alpha so Game Over matches Attract UI
        try {
            const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
            this.gameOverOverlay = this.add.rectangle(metrics.cx, metrics.cy, metrics.w, metrics.h, 0x000000, overlayAlpha).setDepth(0.1);
        } catch (e) { /* ignore if CONFIG not ready */ }

        this.gameOverTextObj = this.add.text(metrics.cx, metrics.gameOverY, gameOverText, {
            fontSize: `${metrics.gameOverFont}px`,
            fill: '#ff0000',
            fontFamily: GAME_FONT
        }).setOrigin(0.5).setDepth(1);

        this.scoreTextObj = this.add.text(metrics.cx, metrics.scoreY, `${scoreLabel}: ${GAME_STATE.score}`, {
            fontSize: `${metrics.scoreFont}px`,
            fill: '#ffffff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5).setDepth(1);

        // Continue flow: show prompt only when enough credits are available.
        const continuePlayers = Number(GAME_STATE.players) === 2 ? 2 : 1;
        this._continuePlayers = continuePlayers;
        const canContinue = hasStartAccessForPlayers(continuePlayers);
        if (canContinue) {
            const continueText = t.continue_q || t.continue || 'CONTINUE?';
            const continueHint = continuePlayers === 2
                ? (t.press2_to_continue || 'PRESS 2 TO CONTINUE')
                : (t.press1_to_continue || 'PRESS 1 TO CONTINUE');
            this.continueTextObj = this.add.text(metrics.cx, metrics.continueY, continueText, {
                fontSize: `${metrics.continueFont}px`,
                fill: '#ffff66',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(1);
            this.continueHintTextObj = this.add.text(metrics.cx, metrics.continueHintY, continueHint, {
                fontSize: `${metrics.continueHintFont}px`,
                fill: '#ffffff',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(1);

            try {
                this.continueTextObj.setAlpha(0.9);
                this.tweens.add({
                    targets: this.continueTextObj,
                    alpha: 0.45,
                    duration: 420,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            } catch (e) { }
        }

        // High score: arcade initials entry (kit/blocks/score-entry)
        if (isHighScore(GAME_STATE.topScores, GAME_STATE.score)) {
            this.nameEntry = createNameEntry(this, {
                font: GAME_FONT,
                x: metrics.cx,
                titleY: metrics.enterNameY, nameY: metrics.nameY, countdownY: metrics.countdownY,
                titleFont: metrics.enterNameFont, nameFont: metrics.nameFont, countdownFont: metrics.countdownFont,
                labels: { title: t.enterName || 'ENTER YOUR NAME', time: t.time_left || 'TIME' },
                length: 3,
                timeoutMs: 10000,
                onConfirm: (name) => this.saveScore({ name }),
                // time is up: keep the default name and go to attract as a fresh start
                onTimeout: () => {
                    this._nameWasAutoTimeout = true;
                    this.saveScore({ useDefaultName: true, goToAttract: true });
                }
            });
        } else {
            if (!canContinue) {
                this.time.delayedCall(3000, () => {
                    this._goToAttractFresh();
                });
            } else {
                // "Continue" offered but nobody presses 1/2: do not wait forever
                const continueMs = Number(CONFIG.continueTimeout) > 0 ? Number(CONFIG.continueTimeout) : 10000;
                this._continueTimeout = this.time.delayedCall(continueMs, () => this._goToAttractFresh());
            }
        }

        this._onKeyOne = () => this.tryContinue(1);
        this._onKeyTwo = () => this.tryContinue(2);
        this.input.keyboard.on('keydown-ONE', this._onKeyOne);
        this.input.keyboard.on('keydown-TWO', this._onKeyTwo);

        this._onResponsiveResize = (gameSize) => {
            const w = (gameSize && gameSize.width) ? gameSize.width : (this.scale.width || CONFIG.width);
            const h = (gameSize && gameSize.height) ? gameSize.height : (this.scale.height || CONFIG.height);
            this.applyGameOverLayout(w, h);
        };
        this.scale.on('resize', this._onResponsiveResize, this);
        this.events.once('shutdown', () => {
            try {
                if (this._onResponsiveResize) this.scale.off('resize', this._onResponsiveResize, this);
            } catch (e) { }
            this._cleanupInputHandlers();
        });
        this.applyGameOverLayout();
    }

    saveScore(options = {}) {
        if (this._pendingSceneExit) return;
        this._pendingSceneExit = true;

        const useDefaultName = !!options.useDefaultName;
        const goToAttract = !!options.goToAttract;

        const name = useDefaultName ? 'AAA' : String(options.name || this.nameEntry?.name || 'AAA').toUpperCase();
        GAME_STATE.topScores = insertTopScore(GAME_STATE.topScores, { name, score: GAME_STATE.score, level: Number(GAME_STATE.currentLevel) || 0 });

        // persist to the server-side top scores (falls back to localStorage if the server is unavailable)
        saveTopScores(GAME_STATE.topScores, { endpoint: '/api/top-scores', storageKey: kitGame.storageKey('TopScores') });

        // cleanup keyboard handler and timeout
        this._cleanupInputHandlers();

        if (goToAttract) {
            this._goToAttractFresh();
            return;
        }

        // End gameplay scene when game is really over (no continue chosen).
        try { this.scene.stop(kitFlow.role('gameplay', 'GameScene')); } catch (e) { }
        this._resetAudioHard();
        this.scene.start(kitFlow.next('game-over', 'end', 'TopTenScene'));
    }

    _cleanupInputHandlers() {
        try {
            if (this._onKeyOne) this.input.keyboard.off('keydown-ONE', this._onKeyOne);
            if (this._onKeyTwo) this.input.keyboard.off('keydown-TWO', this._onKeyTwo);
        } catch (e) { }
        try { if (this.nameEntry) this.nameEntry.stop(); } catch (e) { }
        try { if (this._continueTimeout) this._continueTimeout.remove(false); } catch (e) { }
    }

    _resetAudioHard() {
        try {
            if (!this.sound) return;
            try { this.sound.stopAll(); } catch (e) { }
            const activeSounds = Array.isArray(this.sound.sounds) ? this.sound.sounds.slice() : [];
            activeSounds.forEach((snd) => {
                try { snd.stop && snd.stop(); } catch (e) { }
                try { snd.destroy && snd.destroy(); } catch (e) { }
            });
        } catch (e) { }
    }

    _goToAttractFresh() {
        if (this._pendingSceneExit && !this._nameWasAutoTimeout) return;
        this._pendingSceneExit = true;
        this._cleanupInputHandlers();

        try {
            const gs = this.scene.get(kitFlow.role('gameplay', 'GameScene'));
            if (gs && typeof gs._stopAllAudio === 'function') gs._stopAllAudio();
        } catch (e) { }

        this._resetAudioHard();

        try { GAME_STATE.isGameOver = false; } catch (e) { }
        try { clearRuntimeMatchStorage(); } catch (e) { }
        try { this.scene.stop(kitFlow.role('gameplay', 'GameScene')); } catch (e) { }
        this.scene.start(kitFlow.next('game-over', 'exit', 'AttractScene'));
    }

    tryContinue(requestedPlayers) {
        if (this._pendingSceneExit) return;
        const requiredPlayers = Number(this._continuePlayers) === 2 ? 2 : 1;
        if (Number(requestedPlayers) !== requiredPlayers) return;
        if (!hasStartAccessForPlayers(requiredPlayers)) return;

        consumeCreditsForPlayers(requiredPlayers);
        this._cleanupInputHandlers();
        this._resetAudioHard();

        try {
            const gameScene = this.scene.get(kitFlow.role('gameplay', 'GameScene'));
            if (gameScene && typeof gameScene.continueFromGameOver === 'function') {
                gameScene.continueFromGameOver(requiredPlayers);
            } else {
                try { GAME_STATE.isGameOver = false; } catch (e) { }
            }
        } catch (e) {
            try { GAME_STATE.isGameOver = false; } catch (err) { }
        }

        this.scene.stop();
    }

}


    return GameOverScene;
}
