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
    createLanguageCarousel
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
        if (this.enterNameTextObj) {
            this.enterNameTextObj.setPosition(m.cx, m.enterNameY);
            this.enterNameTextObj.setFontSize(`${m.enterNameFont}px`);
        }
        if (this.nameText) {
            this.nameText.setPosition(m.cx, m.nameY);
            this.nameText.setFontSize(`${m.nameFont}px`);
        }
        if (this.countdownTextObj) {
            this.countdownTextObj.setPosition(m.cx, m.countdownY);
            this.countdownTextObj.setFontSize(`${m.countdownFont}px`);
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

        // Check if high score
        const lowestScore = GAME_STATE.topScores[GAME_STATE.topScores.length - 1].score;
        if (GAME_STATE.score > lowestScore) {
            this.enterNameTextObj = this.add.text(metrics.cx, metrics.enterNameY, t.enterName || 'ENTER YOUR NAME', {
                fontSize: `${metrics.enterNameFont}px`,
                fill: '#00ff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5).setDepth(1);

            // Letter picker: 3 letters, cycle with UP/DOWN, confirm letter with X, 10s timeout
            this.nameChars = ['A', 'A', 'A'];
            this.currentCharIndex = 0;
            this.confirmed = [false, false, false];
            this.nameText = this.add.text(metrics.cx, metrics.nameY, this._formatNameDisplay(), {
                fontSize: `${metrics.nameFont}px`,
                fill: '#ffff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5).setDepth(1);

            const timeLabel = t.time_left || 'TIME';
            const timeoutMs = 10000;
            this._nameDeadlineAt = (Number(this.time?.now) || 0) + timeoutMs;
            this.countdownTextObj = this.add.text(metrics.cx, metrics.countdownY, `${timeLabel}: 10`, {
                fontSize: `${metrics.countdownFont}px`,
                fill: '#ffffff',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0.5).setDepth(1);

            this._nameCountdownTimer = this.time.addEvent({
                delay: 100,
                loop: true,
                callback: () => {
                    try {
                        const remainMs = Math.max(0, this._nameDeadlineAt - (Number(this.time?.now) || 0));
                        const remainSec = Math.ceil(remainMs / 1000);
                        if (this.countdownTextObj) this.countdownTextObj.setText(`${timeLabel}: ${remainSec}`);
                    } catch (e) { }
                }
            });

            // Keyboard handlers
            this._onKeyDown = (event) => {
                const key = event.key;
                if (key === 'ArrowUp') {
                    this._cycleLetter(1);
                } else if (key === 'ArrowDown') {
                    this._cycleLetter(-1);
                } else if (key && key.toLowerCase() === 'x') {
                    // confirm current letter (mapped to X key)
                    this._confirmLetter();
                } else if (key === 'Backspace') {
                    // go back to previous letter
                    this._goBackLetter();
                } else if (key === 'Enter') {
                    // if all confirmed, save
                    if (this.confirmed.every(Boolean)) this.saveScore();
                }
            };
            this.input.keyboard.on('keydown', this._onKeyDown);

            // 10s timeout: keep default name and go to attract as a fresh start.
            this._nameTimeout = this.time.delayedCall(timeoutMs, () => {
                this._nameWasAutoTimeout = true;
                this.saveScore({ useDefaultName: true, goToAttract: true });
            });
        } else {
            if (!canContinue) {
                this.time.delayedCall(3000, () => {
                    this._goToAttractFresh();
                });
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

    updateNameDisplay() {
        if (this.nameText) this.nameText.setText(this._formatNameDisplay());
    }

    saveScore(options = {}) {
        if (this._pendingSceneExit) return;
        this._pendingSceneExit = true;

        const useDefaultName = !!options.useDefaultName;
        const goToAttract = !!options.goToAttract;

        // build final name from nameChars, pad with 'A' if needed
        const name = useDefaultName
            ? 'AAA'
            : (this.nameChars || ['A','A','A']).slice(0,3).map((c) => (typeof c === 'string' && c.length ? c[0] : 'A')).join('').toUpperCase();

        GAME_STATE.topScores.push({ name, score: GAME_STATE.score, level: Number(GAME_STATE.currentLevel) || 0 });
        GAME_STATE.topScores.sort((a, b) => b.score - a.score);
        GAME_STATE.topScores = GAME_STATE.topScores.slice(0, 10);

        // persist to server-side topScores file (falls back to localStorage if server unavailable)
        try {
            (async () => {
                try {
                    const resp = await fetch('/api/top-scores', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(GAME_STATE.topScores)
                    });
                    if (!resp || !resp.ok) {
                        try { localStorage.setItem('blockHunterTopScores', JSON.stringify(GAME_STATE.topScores)); } catch (e) { }
                    }
                } catch (e) {
                    try { localStorage.setItem('blockHunterTopScores', JSON.stringify(GAME_STATE.topScores)); } catch (err) { }
                }
            })();
        } catch (e) {
            try { localStorage.setItem('blockHunterTopScores', JSON.stringify(GAME_STATE.topScores)); } catch (err) { }
        }

        // cleanup keyboard handler and timeout
        this._cleanupInputHandlers();

        if (goToAttract) {
            this._goToAttractFresh();
            return;
        }

        // End gameplay scene when game is really over (no continue chosen).
        try { this.scene.stop('GameScene'); } catch (e) { }
        this._resetAudioHard();
        this.scene.start('TopTenScene');
    }

    _cleanupInputHandlers() {
        try {
            if (this._onKeyDown) this.input.keyboard.off('keydown', this._onKeyDown);
        } catch (e) { }
        try {
            if (this._onKeyOne) this.input.keyboard.off('keydown-ONE', this._onKeyOne);
            if (this._onKeyTwo) this.input.keyboard.off('keydown-TWO', this._onKeyTwo);
        } catch (e) { }
        try { if (this._nameTimeout) this._nameTimeout.remove(false); } catch (e) { }
        try { if (this._nameCountdownTimer) this._nameCountdownTimer.remove(false); } catch (e) { }
        try { if (this.countdownTextObj) { this.countdownTextObj.destroy(); this.countdownTextObj = null; } } catch (e) { }
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
            const gs = this.scene.get('GameScene');
            if (gs && typeof gs._stopAllAudio === 'function') gs._stopAllAudio();
        } catch (e) { }

        this._resetAudioHard();

        try { GAME_STATE.isGameOver = false; } catch (e) { }
        try { clearRuntimeMatchStorage(); } catch (e) { }
        try { this.scene.stop('GameScene'); } catch (e) { }
        this.scene.start('AttractScene');
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
            const gameScene = this.scene.get('GameScene');
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

    _formatNameDisplay() {
        const chars = (this.nameChars || ['A','A','A']).slice(0, 3).map((c) => (typeof c === 'string' && c.length ? c[0] : 'A').toUpperCase());
        return chars.map((ch, i) => {
            if (this.confirmed && this.confirmed[i]) return ch;
            if (this.currentCharIndex === i) return `[${ch}]`;
            return ch;
        }).join(' ');
    }

    _cycleLetter(delta) {
        try {
            if (!this.nameChars) this.nameChars = ['A', 'A', 'A'];
            const idx = Number(this.currentCharIndex) || 0;
            const cur = String(this.nameChars[idx] || 'A').toUpperCase();
            const code = cur.charCodeAt(0);
            let pos = (code >= 65 && code <= 90) ? code - 65 : 0;
            pos = ((pos + delta) % 26 + 26) % 26;
            this.nameChars[idx] = String.fromCharCode(65 + pos);
            this.updateNameDisplay();
        } catch (e) { /* ignore */ }
    }

    _confirmLetter() {
        try {
            if (!this.confirmed) this.confirmed = [false, false, false];
            this.confirmed[this.currentCharIndex] = true;
            // advance to next unconfirmed
            for (let i = this.currentCharIndex + 1; i < 3; i++) {
                if (!this.confirmed[i]) {
                    this.currentCharIndex = i;
                    this.updateNameDisplay();
                    return;
                }
            }
            // all confirmed? save
            if (this.confirmed.every(Boolean)) {
                this.saveScore();
            } else {
                this.currentCharIndex = Math.min(2, this.currentCharIndex + 1);
                this.updateNameDisplay();
            }
        } catch (e) { /* ignore */ }
    }

    _goBackLetter() {
        try {
            if (!this.confirmed) this.confirmed = [false, false, false];
            if (this.currentCharIndex > 0) {
                this.currentCharIndex--;
            }
            this.confirmed[this.currentCharIndex] = false;
            this.updateNameDisplay();
        } catch (e) { /* ignore */ }
    }
}


    return GameOverScene;
}
