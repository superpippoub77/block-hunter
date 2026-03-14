export function createPreloadSceneClass(deps) {
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

    class PreloadScene extends Phaser.Scene {
        constructor() {
            super('PreloadScene');
        }
    
        // Load title, background, tiles, objects, and all level JSON files
        preload() {
            // Clear any stored state at game start to ensure a clean session
            try {
                if (window && window.sessionStorage) sessionStorage.clear();
            } catch (e) { }
            try {
                if (window && window.localStorage) localStorage.clear();
            } catch (e) { }
    
            this.add.rectangle(400, 300, 800, 600, 0x000000, 1).setDepth(0);
            const loadingText = this.add.text(400, 300, 'loading', {
                fontSize: '28px',
                fill: '#ffffff',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 4
            }).setOrigin(0.5).setDepth(10);
    
            // animate loading dots as 3 fixed dots; cycle brightness (alpha) so text size stays constant
            try {
                const baseStyle = {
                    fontSize: '28px',
                    fill: '#ffffff',
                    fontFamily: GAME_FONT,
                    stroke: '#000000',
                    strokeThickness: 4
                };
                // main label without dots
                const loadingTextMain = loadingText;
                loadingTextMain.setText('loading');
    
                // spacing and starting X for dots (positioned right after the main text)
                const dotSpacing = Math.max(12, Math.round(loadingTextMain.fontSize || 18));
                const baseRight = loadingTextMain.x + (loadingTextMain.width * 0.5) + 8;
    
                this._loadingDots = [];
                for (let i = 0; i < 3; i++) {
                    const dot = this.add.text(baseRight + i * dotSpacing, loadingTextMain.y, '.', baseStyle).setOrigin(0.5);
                    dot.setAlpha(0.35);
                    this._loadingDots.push(dot);
                }
    
                // animate alpha cycle: one dot bright at a time
                let dotIndex = 0;
                this._loadingDotEvent = this.time.addEvent({
                    delay: 400,
                    loop: true,
                    callback: () => {
                        try {
                            for (let j = 0; j < this._loadingDots.length; j++) {
                                this._loadingDots[j].setAlpha(j === dotIndex ? 1 : 0.35);
                            }
                            dotIndex = (dotIndex + 1) % 3;
                        } catch (e) { }
                        // restart bat sound if missing (branch without bat_fly_start)
                        try {
                            const sfx3 = bat.getData && bat.getData('sfx');
                            if (!sfx3 && this.sound && this.sound.add) {
                                const sfxNew2 = this.sound.add('bat_sfx', { loop: true, volume: 0.7 });
                                sfxNew2.play();
                                bat.setData('sfx', sfxNew2);
                                try { bat.on && bat.on('destroy', () => { try { sfxNew2.stop && sfxNew2.stop(); sfxNew2.destroy && sfxNew2.destroy(); } catch (e) { } }); } catch (e) { }
                            }
                        } catch (e) { }
                    }
                });
                // List of recently loaded files shown under the loading text
                this._loadedLines = [];
                const linesBaseY = 340;
                const lineHeight = 18;
                try {
                    this.load.on('filecomplete', (key, type) => {
                        try {
                            const label = `${key} (${type})`;
                            const txt = this.add.text(400, linesBaseY + this._loadedLines.length * lineHeight, label, {
                                fontSize: '14px',
                                fill: '#ffffff',
                                fontFamily: GAME_FONT
                            }).setOrigin(0.5, 0).setDepth(11);
                            this._loadedLines.push(txt);
                            // keep only last 10 entries
                            if (this._loadedLines.length > 10) {
                                const old = this._loadedLines.shift();
                                try { if (old && old.destroy) old.destroy(); } catch (e) { }
                                // relayout
                                this._loadedLines.forEach((t, i) => { try { t.y = linesBaseY + i * lineHeight; } catch (e) { } });
                            }
                        } catch (e) { }
                    });
                } catch (e) { }
            } catch (e) { }
    
            this.load.on('complete', () => {
                try {
                    if (this._loadingDotEvent) this._loadingDotEvent.remove(false);
                } catch (e) { }
                try {
                    if (this._loadingDots && Array.isArray(this._loadingDots)) {
                        this._loadingDots.forEach(d => { try { d.destroy(); } catch (e) {} });
                    }
                } catch (e) { }
                // (title handled when its file is loaded via 'filecomplete-title')
                if (loadingText && loadingText.destroy) {
                    loadingText.destroy();
                }
            });
        // title not shown during preload
    
            this.load
                .image('title', 'images/title.png')
                .image('explorer', 'images/explorer.png')
                .image('title_explosion', 'images/title_explosion.png')
                .image('bg', 'images/attract_bg.png')
                // 'game_bg.png' may be missing in some distributions; use level1.png as a fallback background
                .image('game_bg', 'images/level1.png')
                // Load tiles sprite (6 tiles: wall, hole, sand, floor, stone, hole2 - 64x48 each)
                .spritesheet('tiles', 'images/tiles.png', defaultFrame)
                // Load wall sprite sheet (1 row x 7 columns, 64x64 each frame)
                .spritesheet('wall_tiles', 'images/wall_completed.png', defaultFrame)
                // Load objects sprite (4x4 matrix = 16 objects)
                // Row 1: dynamite, heart, stone, player
                // Row 2: dynamite_chest, door, gem, stones
                // Row 3: key, sand_pile, ghost, pepita
                // Row 4: skull...wall, hole1, hole2, explosion
                .spritesheet('objects', 'images/objects.png', defaultFrame)
                // Front walking animation spritesheet (1 row, 7 frames, 172x135 each)
                // Bat flying animation spritesheet (1 row, 6 frames)
                .spritesheet('bat', 'images/bat.png', defaultFrame)
                // Ghost animation spritesheet (1 row, 10 frames)
                .spritesheet('ghost', 'images/ghost.png', defaultFrame)
                .spritesheet('player_front', 'images/player_front.png', {
                    frameWidth: 139,
                    frameHeight: 135
                })
                // Back walking animation spritesheet (same layout as player_front)
                .spritesheet('player_back', 'images/player_back.png', {
                    frameWidth: 139,
                    frameHeight: 135
                })
                // Right walking animation spritesheet (same layout as player_front)
                .spritesheet('player_right', 'images/player_right.png', {
                    frameWidth: 139,
                    frameHeight: 135
                })
                // Back-right walking animation spritesheet (same layout as player_front)
                .spritesheet('player_back_right', 'images/player_back_rigth.png', {
                    frameWidth: 139,
                    frameHeight: 135
                })
                
                .audio('intro_bgm', 'data/music/intro.mp3')
                .audio('game_bgm', 'data/music/game.mp3')
                .audio('step_sfx', 'data/music/step.mp3')
                .audio('stone_sfx', 'data/music/stone.mp3')
                .audio('explosion_sfx', 'data/music/explosion.mp3')
                .audio('gem_sfx', 'data/music/gem.mp3')
                .audio('rolling_sfx', 'data/music/rolling_stones.mp3')
                .audio('gameover_sfx', 'data/music/gameover.mp3')
                .audio('level_completed_sfx', 'data/music/level_completed.mp3')
                .audio('credits_manager_coin', 'module/plugin/creditsManager/music/coin.mp3')
                .audio('select_sfx', 'data/music/select.mp3')
                .audio('ghost_sfx', 'data/music/ghost.mp3')
                .audio('bat_sfx', 'data/music/bat.mp3')
                .audio('rain_sfx', 'data/music/rain.mp3');
    
            // Centralized language carousel options
            this.load.json('languageCarouselOptions', 'module/plugin/languageCarousel/json/config.json');
            // Centralized credits manager options
            this.load.json('creditsManagerOptions', 'module/plugin/creditsManager/json/config.json');
            // Centralized producer signature options
            this.load.json('addCreditOptions', 'module/plugin/addCredit/json/config.json');
    
            // Load all level JSON files (50 levels)
            // Carica solo i livelli con sottolivello 0-4 per ogni decade
            for (let decade = 1; decade <= 5; decade++) {
                for (let sub = 0; sub <= 4; sub++) {
                    const num = decade * 10 + sub;
                    this.load.json(`level${num}`, `data/level/level${num}.json`);
                }
            }
            this.load.json('objectsCatalog', 'data/objects.json');
    
            // Load background images for each master level (level1.png, level2.png, ...)
            for (let master = 1; master <= 5; master++) {
                this.load.image(`game_bg_${master}`, `images/level${master}.png`);
            }
    
            // Load optional foreground image (parallax overlay)
            // Place a file named 'foreground.png' in the images/ folder to use it.
            this.load.image('game_fg', 'images/foreground.png');
    
            // Create graphics for remaining assets
            this.createAssets();
            // create a simple wooden plank texture at runtime (fallback asset)
            try {
                const plankW = Math.max(24, Math.round(CONFIG.objectSize ? CONFIG.objectSize * 0.9 : OBJECT_NATIVE_SIZE * 0.5));
                const plankH = Math.max(12, Math.round(plankW * 0.28));
                const canvasKey = 'wooden_plank';
                if (!this.textures.exists(canvasKey)) {
                    const cvs = this.textures.createCanvas(canvasKey + '_tmp', plankW, plankH);
                    const ctx = cvs.getContext();
                    // wood grain background
                    ctx.fillStyle = '#8B5A2B';
                    ctx.fillRect(0, 0, plankW, plankH);
                    // lighter stripe
                    ctx.fillStyle = 'rgba(255,255,255,0.06)';
                    for (let i = 2; i < plankW; i += 6) {
                        ctx.fillRect(i, 0, 2, plankH);
                    }
                    // add a subtle darker edge
                    ctx.fillStyle = 'rgba(0,0,0,0.12)';
                    ctx.fillRect(0, 0, 2, plankH);
                    ctx.fillRect(plankW - 2, 0, 2, plankH);
                    this.textures.addCanvas(canvasKey, cvs.canvas);
                    this.textures.remove(canvasKey + '_tmp');
                }
            } catch (e) { /* ignore any texture creation errors */ }
            console.log("Assets loaded and created.");
        }
    
        createAssets() {
            // Usa il frame "stone" (frameIndex = 2) della spritesheet "objects" per i boulder
            const stoneFrameIndex = 2;
            const stoneTextureKey = 'objects';
            const stoneFrame = this.textures.getFrame(stoneTextureKey, stoneFrameIndex);
            if (stoneFrame) {
                // Crea una canvas temporanea per ridimensionare il frame
                const createBoulderTexture = (key, size) => {
                    const canvas = this.textures.createCanvas(key + '_tmp', size, size);
                    const ctx = canvas.getContext('2d');
                    // Disegna il frame "stone" scalato
                    ctx.drawImage(
                        stoneFrame.canvas,
                        stoneFrame.cutX, stoneFrame.cutY, stoneFrame.width, stoneFrame.height,
                        0, 0, size, size
                    );
                    // Trasferisci su una texture Phaser
                    this.textures.addCanvas(key, canvas.canvas);
                    this.textures.remove(key + '_tmp');
                };
                createBoulderTexture('boulder_small', 32);
                createBoulderTexture('boulder_medium', 40);
                createBoulderTexture('boulder_large', 48);
            }
    
            // Static rocks (diverse dimensioni e forme) - not in sprite
            const graphics = this.add.graphics();
            // Rock small
            graphics.fillStyle(0x555555, 1);
            graphics.fillRect(2, 2, CONFIG.tileSize - 4, CONFIG.tileSize - 4);
            graphics.fillStyle(0x444444, 1);
            graphics.fillRect(4, 4, 8, 8);
            graphics.fillRect(CONFIG.tileSize - 12, 6, 6, 6);
            graphics.generateTexture('rock_small', CONFIG.tileSize, CONFIG.tileSize);
            graphics.clear();
    
            // Rock medium
            graphics.fillStyle(0x555555, 1);
            graphics.fillRect(0, 0, CONFIG.tileSize, CONFIG.tileSize);
            graphics.fillStyle(0x444444, 1);
            graphics.fillRect(4, 4, 12, 12);
            graphics.fillRect(CONFIG.tileSize - 14, 8, 8, 8);
            graphics.fillRect(6, CONFIG.tileSize - 14, 10, 10);
            graphics.generateTexture('rock', CONFIG.tileSize, CONFIG.tileSize);
            graphics.clear();
    
            // Rock large
            graphics.fillStyle(0x555555, 1);
            graphics.fillRect(0, 0, CONFIG.tileSize, CONFIG.tileSize);
            graphics.fillStyle(0x666666, 1);
            graphics.fillRect(2, 2, CONFIG.tileSize - 4, CONFIG.tileSize - 4);
            graphics.fillStyle(0x444444, 1);
            graphics.fillRect(6, 6, 14, 14);
            graphics.fillRect(CONFIG.tileSize - 16, 10, 10, 10);
            graphics.fillRect(8, CONFIG.tileSize - 16, 12, 12);
            graphics.generateTexture('rock_large', CONFIG.tileSize, CONFIG.tileSize);
            graphics.clear();
    
            // Shard - not in sprite
            graphics.fillStyle(0xAAAAAA, 1);
            graphics.fillRect(0, 0, 6, 6);
            graphics.generateTexture('shard', 6, 6);
            graphics.clear();
    
            graphics.destroy();
        }
    
        create() {
            // Carica le traduzioni prima di avviare la scena iniziale
            const lang = CONFIG.language || 'it';
            loadTranslations(lang, (data) => {
                TRANSLATIONS[lang] = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
                const bonusTestMode = CONFIG.bonusTestMode || {};
                if (bonusTestMode.enabled === true) {
                    const bonusLevelName = bonusTestMode.bonusLevel || 'bonus1';
                    const returnLevel = Number.isFinite(Number(bonusTestMode.returnLevel))
                        ? Number(bonusTestMode.returnLevel)
                        : (Number(GAME_STATE.currentLevel) || 0);
    
                    this.scene.start('BonusScene', {
                        bonusLevelName,
                        bonusConfig: {
                            enabled: true,
                            name: bonusLevelName,
                            label: `TEST BONUS: ${bonusLevelName}`
                        },
                        returnLevel
                    });
                    return;
                }
    
                if (isFrontScenesEnabled()) {
                    this.scene.start('AttractScene');
                } else {
                    this.scene.start('LevelSelectScene');
                }
            });
        }
    }

    return PreloadScene;
}
