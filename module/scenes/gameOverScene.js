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

    create() {
        const t = TRANSLATIONS[GAME_STATE.language] || {};

        const gameOverText = t.game_over || t.gameOver || t.gameOverText || 'GAME OVER';
        const scoreLabel = t.score_label || t.score || 'SCORE';

        this.add.rectangle(400, 300, 800, 600, 0x220000);

        // Dim background with attract overlay alpha so Game Over matches Attract UI
        try {
            const overlayAlpha = (typeof CONFIG.attractOverlayAlpha === 'number') ? CONFIG.attractOverlayAlpha : 0.35;
            this.gameOverOverlay = this.add.rectangle(400, 300, 800, 600, 0x000000, overlayAlpha).setDepth(0.1);
        } catch (e) { /* ignore if CONFIG not ready */ }

        this.add.text(400, 200, gameOverText, {
            fontSize: '24px',
            fill: '#ff0000',
            fontFamily: GAME_FONT
        }).setOrigin(0.5).setDepth(1);

        this.add.text(400, 280, `${scoreLabel}: ${GAME_STATE.score}`, {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5).setDepth(1);

        // Check if high score
        const lowestScore = GAME_STATE.topScores[GAME_STATE.topScores.length - 1].score;
        if (GAME_STATE.score > lowestScore) {
            this.add.text(400, 350, t.enterName || 'ENTER YOUR NAME', {
                fontSize: '24px',
                fill: '#00ff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5).setDepth(1);

            // Letter picker: 3 letters, cycle with UP/DOWN, confirm letter with SPACE, 20s timeout
            this.nameChars = ['A', 'A', 'A'];
            this.currentCharIndex = 0;
            this.confirmed = [false, false, false];
            this.nameText = this.add.text(400, 400, this._formatNameDisplay(), {
                fontSize: '32px',
                fill: '#ffff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5).setDepth(1);

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

            // 20s timeout
            this._nameTimeout = this.time.delayedCall(20000, () => {
                this.saveScore();
            });
        } else {
            this.time.delayedCall(3000, () => {
                this.scene.start('AttractScene');
            });
        }
    }

    updateNameDisplay() {
        if (this.nameText) this.nameText.setText(this._formatNameDisplay());
    }

    saveScore() {
        // build final name from nameChars, pad with 'A' if needed
        const name = (this.nameChars || ['A','A','A']).slice(0,3).map((c) => (typeof c === 'string' && c.length ? c[0] : 'A')).join('').toUpperCase();

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
        try {
            if (this._onKeyDown) this.input.keyboard.off('keydown', this._onKeyDown);
        } catch (e) { /* ignore */ }
        try { if (this._nameTimeout) this._nameTimeout.remove(false); } catch (e) { }

        this.scene.start('TopTenScene');
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
