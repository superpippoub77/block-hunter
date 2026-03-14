export function createLevelSelectSceneClass(deps) {
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

    class LevelSelectScene extends Phaser.Scene {
        constructor() {
            super('LevelSelectScene');
        }
    
        create() {
            const t = TRANSLATIONS[GAME_STATE.language];
    
            this.add.image(400, 300, 'bg').setDisplaySize(800, 600);
    
            this.add.text(400, 150, t.selectDifficulty, {
                fontSize: '40px',
                fill: '#ffff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5).setDepth(1);
    
            try {
                this.producerCreditText = createAddCredit(this, {
                    configCacheKey: 'addCreditOptions',
                    fontFamily: GAME_FONT
                });
            } catch (e) { this.producerCreditText = null; }
    
            // Difficulties configuration and selectable UI
            this.difficulties = [
                { name: t.beginner, mult: 0.8, y: 250 },
                { name: t.medium, mult: 1.0, y: 320 },
                { name: t.hard || t.expert, mult: 1.3, y: 390 }
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
                    this.selectionGraphics.lineStyle(3, 0x00ff00, 1);
                    this.selectionGraphics.strokeRect(b.x - 12, b.y - 8, b.width + 24, b.height + 16);
                }
            };
    
            // Create the text objects and wire pointer events
            this.difficulties.forEach((diff, idx) => {
                const text = this.add.text(400, diff.y, diff.name, {
                    fontSize: '32px',
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

    return LevelSelectScene;
}
