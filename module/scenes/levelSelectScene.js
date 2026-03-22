export function createLevelSelectScene(deps) {
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
class LevelSelectScene extends Phaser.Scene {
    constructor() {
        super('LevelSelectScene');
    }

    getLevelSelectMetrics(width, height) {
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
            titleY: Math.round(h * 0.25),
            titleFont: Math.max(18, Math.round(40 * viewportScale)),
            optionStartY: Math.round(h * 0.42),
            optionStep: Math.max(42, Math.round(70 * viewportScale)),
            optionFont: Math.max(16, Math.round(32 * viewportScale)),
            strokePadX: Math.max(8, Math.round(12 * viewportScale)),
            strokePadY: Math.max(6, Math.round(8 * viewportScale)),
            strokeThickness: Math.max(2, Math.round(3 * viewportScale))
        };
    }

    applyResponsiveLayout(width, height) {
        const m = this.getLevelSelectMetrics(width, height);

        if (this.bgImage) {
            this.bgImage.setPosition(m.cx, m.cy);
            this.bgImage.setDisplaySize(m.w, m.h);
        }
        if (this.titleText) {
            this.titleText.setPosition(m.cx, m.titleY);
            this.titleText.setFontSize(`${m.titleFont}px`);
        }

        if (Array.isArray(this.diffTexts)) {
            this.diffTexts.forEach((txt, idx) => {
                if (!txt) return;
                txt.setPosition(m.cx, m.optionStartY + idx * m.optionStep);
                txt.setFontSize(`${m.optionFont}px`);
            });
        }

        this._selectionStrokePadX = m.strokePadX;
        this._selectionStrokePadY = m.strokePadY;
        this._selectionStrokeThickness = m.strokeThickness;
        if (this.updateSelection) this.updateSelection();
    }

    create() {
        const t = TRANSLATIONS[GAME_STATE.language];
        const metrics = this.getLevelSelectMetrics();

        this.bgImage = this.add.image(metrics.cx, metrics.cy, 'bg').setDisplaySize(metrics.w, metrics.h);

        this.titleText = this.add.text(metrics.cx, metrics.titleY, t.selectDifficulty, {
            fontSize: `${metrics.titleFont}px`,
            fill: '#ffff00',
            fontFamily: GAME_FONT
        }).setOrigin(0.5).setDepth(1);

        // credit
        try { addSpikeCredit(this); } catch (e) { }

        // Difficulties configuration and selectable UI
        this.difficulties = [
            { name: t.beginner, mult: 0.8 },
            { name: t.medium, mult: 1.0 },
            { name: t.hard || t.expert, mult: 1.3 }
        ];

        // Keep references to text objects and selection state
        this.diffTexts = [];
        this.selectedIndex = 0;
        this.selectionGraphics = this.add.graphics();
        this.playSelectSfx = () => {
            if (this.sound) {
                this.sound.play('select_sfx', { volume: 0.4 });
            }
        };

        // Helper to change selection (wrap-around)
        this.changeSelection = (dir) => {
            this.selectedIndex = (this.selectedIndex + dir + this.difficulties.length) % this.difficulties.length;
            this.playSelectSfx();
            this.updateSelection();
        };

        // Update visual state for selection: stroke, shadow and selection box
        this.updateSelection = () => {
            // Clear graphics and redraw around selected text
            this.selectionGraphics.clear();

            this.diffTexts.forEach((txt, idx) => {
                if (idx === this.selectedIndex) {
                    txt.setStyle({ fill: '#00ff00', stroke: '#00aa00', strokeThickness: 2 });
                    // green glow
                    if (txt.setShadow) txt.setShadow(0, 0, '#00ff00', 8, true, false);
                } else {
                    txt.setStyle({ fill: '#ffffff', stroke: '#000000', strokeThickness: 0 });
                    if (txt.setShadow) txt.setShadow(0, 0, '#000000', 0, false, false);
                }
            });

            const selectedText = this.diffTexts[this.selectedIndex];
            if (selectedText) {
                const b = selectedText.getBounds();
                // draw a stroked rectangle a bit bigger than the text bounds
                const padX = Number(this._selectionStrokePadX) || 12;
                const padY = Number(this._selectionStrokePadY) || 8;
                const thickness = Number(this._selectionStrokeThickness) || 3;
                this.selectionGraphics.lineStyle(thickness, 0x00ff00, 1);
                this.selectionGraphics.strokeRect(b.x - padX, b.y - padY, b.width + (padX * 2), b.height + (padY * 2));
            }
        };

        // Create the text objects and wire pointer events
        this.difficulties.forEach((diff, idx) => {
            const text = this.add.text(metrics.cx, metrics.optionStartY + idx * metrics.optionStep, diff.name, {
                fontSize: `${metrics.optionFont}px`,
                fill: '#ffffff',
                fontFamily: GAME_FONT
            }).setOrigin(0.5).setInteractive().setDepth(1);

            text.on('pointerover', () => {
                if (this.selectedIndex !== idx) {
                    this.playSelectSfx();
                }
                this.selectedIndex = idx;
                this.updateSelection();
            });
            text.on('pointerout', () => {
                // keep selection visuals (do not clear on out)
            });
            text.on('pointerdown', () => {
                this.playSelectSfx();
                GAME_STATE.difficulty = diff.mult;
                this.scene.start('GameScene');
            });

            this.diffTexts.push(text);
        });

        // Initialize selection visuals
        this.updateSelection();

    // Ensure selection graphics and UI are above the attract overlay
    try { if (this.selectionGraphics && this.selectionGraphics.setDepth) this.selectionGraphics.setDepth(1); } catch (e) { }

        this._onResponsiveResize = (gameSize) => {
            const w = (gameSize && gameSize.width) ? gameSize.width : (this.scale.width || CONFIG.width);
            const h = (gameSize && gameSize.height) ? gameSize.height : (this.scale.height || CONFIG.height);
            this.applyResponsiveLayout(w, h);
        };
        this.scale.on('resize', this._onResponsiveResize, this);
        this.events.once('shutdown', () => {
            try {
                if (this._onResponsiveResize) this.scale.off('resize', this._onResponsiveResize, this);
            } catch (e) { }
        });
        this.applyResponsiveLayout();

        // Keyboard navigation: Up/Down to change selection, Enter/Space to confirm
        this.input.keyboard.on('keydown-UP', () => this.changeSelection(-1));
        this.input.keyboard.on('keydown-DOWN', () => this.changeSelection(1));
        this.input.keyboard.on('keydown-ENTER', () => {
            this.playSelectSfx();
            const diff = this.difficulties[this.selectedIndex];
            GAME_STATE.difficulty = diff.mult;
            this.scene.start('GameScene');
        });
        this.input.keyboard.on('keydown-SPACE', () => {
            this.playSelectSfx();
            const diff = this.difficulties[this.selectedIndex];
            GAME_STATE.difficulty = diff.mult;
            this.scene.start('GameScene');
        });

        // Keep numeric shortcuts (also update selection visuals before starting)
        this.input.keyboard.on('keydown-ONE', () => {
            this.playSelectSfx();
            this.selectedIndex = 0;
            this.updateSelection();
            GAME_STATE.difficulty = this.difficulties[0].mult;
            this.scene.start('GameScene');
        });
        this.input.keyboard.on('keydown-TWO', () => {
            this.playSelectSfx();
            this.selectedIndex = 1;
            this.updateSelection();
            GAME_STATE.difficulty = this.difficulties[1].mult;
            this.scene.start('GameScene');
        });
        this.input.keyboard.on('keydown-THREE', () => {
            this.playSelectSfx();
            this.selectedIndex = 2;
            this.updateSelection();
            GAME_STATE.difficulty = this.difficulties[2].mult;
            this.scene.start('GameScene');
        });
    }
}

// ============================================================================
// GAME SCENE
// ============================================================================

    return LevelSelectScene;
}
