export function createGameSceneClass(deps) {
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

    class GameScene extends Phaser.Scene {
        constructor() {
            super('GameScene');
        }
    
        create() {
            // Carica le traduzioni prima di inizializzare la scena
            loadTranslations(GAME_STATE.language, (data) => {
                const lang = String(GAME_STATE.language || '').trim().toLowerCase();
                if (lang) TRANSLATIONS[lang] = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
                this.initializeGame();
            });
    
            const intro = this.sound.get('intro_bgm');
            if (intro && intro.isPlaying) {
                intro.stop();
            }
    
            playLoopAudioSafely(this, 'game_bgm', 0.28);
        }
    
        initializeGame() {
            this.isLevelTransitioning = false;
            this.levelStartScore = Number(GAME_STATE.score) || 0;
            this.levelStats = {
                pointsEarned: 0,
                batsCaught: 0,
                keysCollected: 0,
                gemsCollected: 0,
                pepitasCollected: 0
            };
    
            const playerFrontMaxFrame = getTextureMaxNumericFrame(this, 'player_front', 5);
            const playerBackMaxFrame = getTextureMaxNumericFrame(this, 'player_back', 5);
            const playerRightMaxFrame = getTextureMaxNumericFrame(this, 'player_right', 5);
            const playerBackRightMaxFrame = getTextureMaxNumericFrame(this, 'player_back_right', 5);
    
            // Player front walk animation (used for down direction)
            if (!this.anims.exists('player_front_walk')) {
                this.anims.create({
                    key: 'player_front_walk',
                    frames: this.anims.generateFrameNumbers('player_front', { start: 0, end: playerFrontMaxFrame }),
                    frameRate: 10,
                    repeat: -1
                });
            }
            if (!this.anims.exists('player_back_walk')) {
                this.anims.create({
                    key: 'player_back_walk',
                    frames: this.anims.generateFrameNumbers('player_back', { start: 0, end: playerBackMaxFrame }),
                    frameRate: 10,
                    repeat: -1
                });
            }
            if (!this.anims.exists('player_right_walk')) {
                this.anims.create({
                    key: 'player_right_walk',
                    frames: this.anims.generateFrameNumbers('player_right', { start: 0, end: playerRightMaxFrame }),
                    frameRate: 10,
                    repeat: -1
                });
            }
            if (!this.anims.exists('player_back_right_walk')) {
                this.anims.create({
                    key: 'player_back_right_walk',
                    frames: this.anims.generateFrameNumbers('player_back_right', { start: 0, end: playerBackRightMaxFrame }),
                    frameRate: 10,
                    repeat: -1
                });
            }
            // Bat animations: spritesheet has 10 frames (0..9)
            // 0..4 = start/arrival (takeoff/landing), 5..9 = flight
            if (!this.anims.exists('bat_fly_start')) {
                this.anims.create({
                    key: 'bat_fly_start',
                    frames: this.anims.generateFrameNumbers('bat', { start: 0, end: 9 }),
                    frameRate: 12,
                    repeat: 0
                });
            }
            if (!this.anims.exists('bat_fly_loop')) {
                this.anims.create({
                    key: 'bat_fly_loop',
                    frames: this.anims.generateFrameNumbers('bat', { start: 5, end: 9 }),
                    frameRate: 12,
                    repeat: -1
                });
            }
            if (!this.anims.exists('bat_fly_loop_rev')) {
                const f = this.anims.generateFrameNumbers('bat', { start: 5, end: 9 });
                const fr = f.slice().reverse();
                this.anims.create({ key: 'bat_fly_loop_rev', frames: fr, frameRate: 12, repeat: -1 });
            }
            if (!this.anims.exists('bat_stop')) {
                const sf = this.anims.generateFrameNumbers('bat', { start: 0, end: 4 });
                const sfr = sf.slice().reverse();
                this.anims.create({ key: 'bat_stop', frames: sfr, frameRate: 12, repeat: 0 });
            }
            if (!this.anims.exists('ghost_float')) {
                this.anims.create({
                    key: 'ghost_float',
                    frames: this.anims.generateFrameNumbers('ghost', { start: 0, end: 9 }),
                    frameRate: 10,
                    yoyo: true,
                    repeat: -1
                });
            }
    
            // Note: miner sprites are not animated here (no dedicated walk animations)
    
            // Background selection: prefer level-specific `background` if provided in JSON,
            // otherwise fallback to master-level image (game_bg_1..game_bg_5) or default 'game_bg'.
            const masterLevel = getLevelMasterNumber(GAME_STATE.currentLevel);
            const masterLevelBgKey = `game_bg_${masterLevel}`;
            let selectedBgKey = 'game_bg';
            let pendingDynamicBg = null; // when level provides a path to load dynamically
    
            // prefer explicit background set in level JSON
            if (this.levelData && this.levelData.background != null) {
                const b = this.levelData.background;
                if (typeof b === 'number') {
                    const k = `game_bg_${b}`;
                    if (this.textures.exists(k)) selectedBgKey = k;
                } else if (typeof b === 'string') {
                    if (/^\d+$/.test(b)) {
                        const k = `game_bg_${b}`;
                        if (this.textures.exists(k)) selectedBgKey = k;
                    } else if (this.textures.exists(b)) {
                        // string refers to an already-loaded texture key
                        selectedBgKey = b;
                    } else {
                        // treat string as a path/URL to load dynamically; generate a unique key
                        const genKey = `game_bg_level_${GAME_STATE.currentLevel}`;
                        pendingDynamicBg = { key: genKey, src: b };
                        // leave selectedBgKey as default for now; we'll swap texture after load
                    }
                }
            } else {
                selectedBgKey = this.textures.exists(masterLevelBgKey) ? masterLevelBgKey : 'game_bg';
            }
    
            // Parallax configuration: allow overriding with CONFIG values
            const parallaxBgFactor = (typeof CONFIG.parallaxBgFactor === 'number') ? CONFIG.parallaxBgFactor : 0.96;
    
            // Only create the generic gameBg here when the level JSON does NOT
            // provide its own background (to avoid duplicating a level-specific
            // background that will be created later once the level data is available).
            const _levelFileForBgCheck = (typeof getLevelFileName === 'function') ? getLevelFileName(GAME_STATE.currentLevel) : null;
            const _cachedLevelJson = _levelFileForBgCheck ? this.cache.json.get(_levelFileForBgCheck) : null;
            const _levelHasBgInCache = !!(_cachedLevelJson && _cachedLevelJson.background != null);
    
            if (!_levelHasBgInCache) {
                this.gameBg = this.add.image(CONFIG.width / 2, CONFIG.height / 2, selectedBgKey)
                    .setDisplaySize(CONFIG.width, CONFIG.height)
                    .setScrollFactor(parallaxBgFactor)
                    .setDepth(-1000);
            } else {
                this.gameBg = null;
            }
    
            
    
            // If the level requested a background image path that wasn't preloaded, load it dynamically
            if (pendingDynamicBg) {
                try {
                    // avoid re-adding if already in cache under generated key
                    if (!this.textures.exists(pendingDynamicBg.key)) {
                        this.load.image(pendingDynamicBg.key, pendingDynamicBg.src);
                        this.load.once('complete', () => {
                            try {
                                if (this.gameBg && this.gameBg.setTexture) {
                                    this.gameBg.setTexture(pendingDynamicBg.key);
                                    // resize to world extents after swapping texture
                                    const bgW = Math.max(worldWidth, CONFIG.width);
                                    const bgH = Math.max(worldHeight, CONFIG.height);
                                    try { this.gameBg.setOrigin(0, 0); } catch (e) { }
                                    this.gameBg.setDisplaySize(bgW, bgH);
                                    this.gameBg.setPosition(worldX, worldY);
                                    this.gameBg.setScrollFactor(parallaxBgFactor);
                                }
                            } catch (e) { }
                        });
                        this.load.start();
                    } else {
                        // already exists under generated key
                        try {
                            this.gameBg.setTexture(pendingDynamicBg.key);
                        } catch (e) { }
                    }
                } catch (e) { }
            }
    
            // Foreground will be created after the tilemap/world size is known.
            // We avoid creating it here to keep positioning simple and consistent
            // across all levels (see creation after world bounds are set).
    
            // Get level data from JSON
            const levelFileName = getLevelFileName(GAME_STATE.currentLevel);
            this.levelData = this.cache.json.get(levelFileName);
            this.initializeObjectCatalog();
    
            // Get level config (rules for boulders, etc.)
            this.levelConfig = LEVEL_CONFIG.levels[GAME_STATE.currentLevel];
    
            // Merge JSON data into levelConfig
            if (this.levelData) {
                const baseDynamicBoulders = this.levelConfig?.dynamicBoulders;
                const levelDynamicBoulders = this.levelData?.dynamicBoulders;
                let mergedDynamicBoulders = baseDynamicBoulders;
    
                if (levelDynamicBoulders === false) {
                    mergedDynamicBoulders = false;
                } else if (levelDynamicBoulders && typeof levelDynamicBoulders === 'object') {
                    mergedDynamicBoulders = {
                        ...(baseDynamicBoulders && typeof baseDynamicBoulders === 'object' ? baseDynamicBoulders : {}),
                        ...levelDynamicBoulders
                    };
                }
    
                this.levelConfig = {
                    ...this.levelConfig,
                    ...this.levelData,
                    dynamicBoulders: mergedDynamicBoulders
                };
            }
    
            // Per-level music: if the level JSON provides a `music` field, stop
            // the default BGM and load/play the specified track (searching under
            // `data/music/` by default).
            try {
                const lvlMusic = this.levelData && (this.levelData.music || this.levelData.backgroundMusic || null);
                if (lvlMusic) {
                    const raw = String(lvlMusic).trim();
                    if (raw.length) {
                        // Stop default game bgm if playing
                        try { const g = this.sound.get('game_bgm'); if (g && g.isPlaying) g.stop(); } catch (e) { }
    
                        // Resolve source path: prefer absolute/explicit paths, but
                        // if the value looks like just a filename or starts with
                        // 'music/' prefix, normalize to 'data/music/...'
                        let srcPath = raw;
                        const hasDataPrefix = /^data\//i.test(raw);
                        const hasSlash = /\//.test(raw);
                        const hasExt = /\.[a-zA-Z0-9]{2,5}$/.test(raw);
                        if (!hasDataPrefix) {
                            if (!hasSlash) {
                                srcPath = `data/music/${raw}${hasExt ? '' : '.mp3'}`;
                            } else if (/^music\//i.test(raw)) {
                                srcPath = `data/${raw}`; // e.g. 'music/track.mp3' -> 'data/music/track.mp3'
                            } else {
                                // keep provided path (could be 'assets/...')
                                srcPath = raw;
                            }
                        }
    
                        const musicKey = `level_music_${GAME_STATE.currentLevel}`;
                        try {
                            const existing = this.sound.get(musicKey);
                            if (existing) {
                                playLoopAudioSafely(this, musicKey, 0.28);
                            } else {
                                // Dynamically load and play the audio file
                                this.load.audio(musicKey, srcPath);
                                this.load.once('complete', () => {
                                    try { playLoopAudioSafely(this, musicKey, 0.28); } catch (e) { }
                                });
                                this.load.start();
                            }
                        } catch (e) {
                            // Fallback: try playing default BGM
                            try { playLoopAudioSafely(this, 'game_bgm', 0.28); } catch (e2) { }
                        }
                    }
                }
            } catch (e) { }
            
    
            // --- Rain / weather effect (configurable from level JSON)
            try {
                const generalFx = this.getGeneralEffectsConfig();
                const rainCfg = (generalFx && generalFx.rain)
                    || (this.levelData && (this.levelData.rain || (this.levelData.weather && this.levelData.weather.rain)))
                    || null;
                const clearRain = () => {
                    try {
                        if (this.rainEmitter) { try { this.rainEmitter.stop && this.rainEmitter.stop(); } catch (e) { } this.rainEmitter = null; }
                        if (this.rainParticles) { try { this.rainParticles.destroy && this.rainParticles.destroy(); } catch (e) { } this.rainParticles = null; }
                        if (this.rainTimer) { try { this.rainTimer.remove(false); } catch (e) { } this.rainTimer = null; }
                        if (this.rainMasterTimer) { try { this.rainMasterTimer.remove(false); } catch (e) { } this.rainMasterTimer = null; }
                        if (this.rainBurstTimer) { try { this.rainBurstTimer.remove(false); } catch (e) { } this.rainBurstTimer = null; }
                        if (this.rainGroup) { try { this.rainGroup.clear(true, true); } catch (e) { } this.rainGroup = null; }
                        try {
                            if (this.rainSfx) { try { this.rainSfx.stop && this.rainSfx.stop(); } catch (e) { } try { this.rainSfx.destroy && this.rainSfx.destroy(); } catch (e) { } this.rainSfx = null; }
                        } catch (e) { }
                        this.rainActive = false;
                        this.currentRain = null;
                    } catch (e) { }
                };
    
                // Ensure rain is cleaned up if the scene is shutdown/destroyed
                try {
                    if (this.events && this.events.on) {
                        this.events.on('shutdown', clearRain);
                        this.events.on('destroy', clearRain);
                    }
                } catch (e) { }
    
                if (rainCfg && (rainCfg.enabled === true || String(rainCfg.enabled) === 'true')) {
                    const intensity = Phaser.Math.Clamp(Number(rainCfg.intensity) || 1, 0.1, 5); // 0.1..5
                    const frequency = Phaser.Math.Clamp(Number(rainCfg.frequency) || 180, 20, 2000); // ms between emissions
    
                    if (!this.textures.exists('raindrop')) {
                        const g = this.add.graphics({ x: 0, y: 0 });
                        g.fillStyle(0xa6daff, 1);
                        g.fillRect(0, 0, 2, 12);
                        try { g.generateTexture('raindrop', 2, 12); } catch (e) { }
                        g.destroy();
                    }
    
                    try {
                        console.log('Rain config', rainCfg);
                        const qty = Math.max(1, Math.round(1 + intensity * 2));
                        const windX = Phaser.Math.Clamp(Number(rainCfg.wind) || 0, -500, 500);
                        const gameW = CONFIG.width || (this.scale && this.scale.width) || 800;
                        const gameH = CONFIG.height || (this.scale && this.scale.height) || 600;
    
                        // simple custom rain: spawn images and tween them down
                        this.rainGroup = this.rainGroup || this.add.group();
    
                        const directionMode = String(rainCfg.direction || 'down');
    
                        const spawnDrop = () => {
                            const x = Phaser.Math.Between(0, gameW);
                            const startY = -10 - Phaser.Math.Between(0, 80);
                            const drop = this.add.image(x, startY, 'raindrop').setOrigin(0.5).setScrollFactor(0).setDepth(1000).setAlpha(0.95);
                            const speedY = Phaser.Math.Between(400 * intensity, 700 * intensity); // px/s
                            const travel = gameH - startY + 30;
                            const duration = Math.max(200, Math.round((travel / speedY) * 1000));
                            let windOffset = 0;
                            if (directionMode === 'random') {
                                windOffset = Phaser.Math.Between(-300, 300);
                            } else if (directionMode === 'left') {
                                const mag = Math.max(50, Math.abs(Number(rainCfg.wind) || 200));
                                windOffset = -mag + Phaser.Math.Between(-30, 30);
                            } else if (directionMode === 'right') {
                                const mag = Math.max(50, Math.abs(Number(rainCfg.wind) || 200));
                                windOffset = mag + Phaser.Math.Between(-30, 30);
                            } else {
                                // down (default) — windX influences horizontal drift
                                windOffset = windX + Phaser.Math.Between(-30, 30);
                            }
    
                            this.tweens.add({
                                targets: drop,
                                x: drop.x + windOffset,
                                y: gameH + 30,
                                duration: duration,
                                ease: 'Linear',
                                onComplete: () => { try { drop.destroy(); } catch (e) { } }
                            });
                            this.rainGroup.add(drop);
                        };
    
                        // Handle continuous mode or burst mode (interval/duration)
                        const intervalSec = Math.max(0, Number(rainCfg.interval) || 0);
                        const durationSec = Math.max(0, Number(rainCfg.duration) || 0);
    
                        if (durationSec > 0 && intervalSec > 0) {
                            // Master timer that starts bursts every `intervalSec`
                            this.rainMasterTimer = this.time.addEvent({
                                delay: intervalSec * 1000,
                                loop: true,
                                callback: () => {
                                    // start burst emitter that spawns every `frequency` ms
                                    const burst = this.time.addEvent({
                                        delay: frequency,
                                        loop: true,
                                        callback: () => {
                                            for (let i = 0; i < qty; i++) spawnDrop();
                                        }
                                    });
                                    this.rainBurstTimer = burst;
                                    // start rain audio for the burst
                                    try {
                                        if (this.sound && this.sound.add) {
                                            if (!this.rainSfx) {
                                                this.rainSfx = this.sound.add('rain_sfx', { loop: true, volume: 0.6 });
                                            }
                                            try { this.rainSfx.play(); } catch (e) { }
                                        }
                                    } catch (e) { }
                                    // schedule burst stop after durationSec
                                    this.time.addEvent({ delay: durationSec * 1000, callback: () => {
                                        try { burst.remove(false); } catch (e) { }
                                        if (this.rainBurstTimer === burst) this.rainBurstTimer = null;
                                        // stop rain audio at end of burst
                                        try {
                                            if (this.rainSfx) {
                                                try { this.rainSfx.stop && this.rainSfx.stop(); } catch (e) { }
                                                try { this.rainSfx.destroy && this.rainSfx.destroy(); } catch (e) { }
                                                this.rainSfx = null;
                                            }
                                        } catch (e) { }
                                    } });
                                }
                            });
                            this.rainActive = true;
                            this.currentRain = { intensity, frequency, wind: windX, direction: directionMode, interval: intervalSec, duration: durationSec };
                            console.log('Rain master timer started', { qty, frequency, intervalSec, durationSec, windX });
                        } else {
                            // continuous spawning at `frequency` ms
                            this.rainTimer = this.time.addEvent({
                                delay: frequency,
                                loop: true,
                                callback: () => {
                                    for (let i = 0; i < qty; i++) spawnDrop();
                                }
                            });
                            this.rainActive = true;
                            this.currentRain = { intensity, frequency, wind: windX, direction: directionMode, interval: 0, duration: 0 };
                            try {
                                if (this.sound && this.sound.add && !this.rainSfx) {
                                    this.rainSfx = this.sound.add('rain_sfx', { loop: true, volume: 0.6 });
                                    this.rainSfx.play();
                                }
                            } catch (e) { }
                            console.log('Rain continuous timer started', { qty, frequency, windX });
                        }
                    } catch (e) {
                        console.warn('Rain emitter failed', e);
                        clearRain();
                    }
                } else {
                    clearRain();
                }
            } catch (e) {
                // ignore
            }
    
            // Create groups
            this.walls = this.physics.add.staticGroup();
            this.rocks = this.physics.add.staticGroup();
            this.boulders = this.physics.add.group();
            this.ghosts = this.physics.add.group();
            this.bats = this.physics.add.group();
            this.gems = this.physics.add.group();
            this.items = this.physics.add.group();
            this.dynamites = this.physics.add.group();
            this.shards = this.physics.add.group();
            this.doors = this.physics.add.staticGroup();
            this.hole2Exits = this.physics.add.staticGroup();
        // Placed planks (visual overlays) - not physics objects
        this.planks = this.add.group();
    
            // Create tilemap
            this.hasDoorInMap = false;
            this.mapGemPositions = [];
            this.mapGemIndex = 0;
            this.keySpawnPositions = [];
            this.ghostSpawnPositions = [];
            this.hole2ExitPositions = [];
            this.hole2ExitsActive = false;
            this.lastKeyPos = null;
            this.cartPowerActive = false;
            this.cartPowerUntil = 0;
            this.cartPowerTimer = null;
            this.playerCollisionRefs = [];
            this.playerGemStock = 0;
            this.batDirectionTimer = null;
            this.dynamicBouldersRuntimeDisabled = false;
            this.batSpawnPositions = [];
            this.effectFollowers = [];
            this.spawnedFallingStoneCount = 0;
            this.stoneShardBurstsRemaining = 0;
            this.nextStoneShardBurstIndex = Number.POSITIVE_INFINITY;
    
            const stoneShardBurstCount = Number(this.levelConfig?.staticRocks?.shardBurstCount);
            const maxStoneShardBursts = 12;
            if (Number.isFinite(stoneShardBurstCount) && stoneShardBurstCount > 0) {
                this.stoneShardBurstsRemaining = Math.min(maxStoneShardBursts, Math.floor(stoneShardBurstCount));
                this.nextStoneShardBurstIndex = Phaser.Math.Between(1, 3);
            }
    
            this.createTilemap();
    
            // restore any previously placed planks for this level (persisted in localStorage)
            try {
                if (!Array.isArray(GAME_STATE.placedPlanks)) {
                    const saved = localStorage.getItem('blockHunterPlacedPlanks');
                    GAME_STATE.placedPlanks = saved ? JSON.parse(saved) : [];
                }
                this.restorePlacedPlanks && this.restorePlacedPlanks();
            } catch (e) { }
    
            // Create player
            this.createPlayer();
    
            // Setup camera and world bounds for scrolling
            const worldWidth = this.mapCols * CONFIG.tileSize;
            const worldHeight = this.mapRows * CONFIG.tileSize;
            const worldX = this.mapOffsetX;
            const worldY = this.mapOffsetY;
            this.physics.world.setBounds(worldX, worldY, worldWidth, worldHeight);
            if (this.player && this.player.body) {
                this.player.body.setCollideWorldBounds(true);
            }
    
            // Resize and position background(s) to cover the world, then let them scroll.
            // Support level-specific multi-layer backgrounds: each layer can define:
            // - src
            // - parallax factor/alpha
            // - pixel offset (offsetX/left, offsetY/top)
            // - replicas on X/Y (repeatX/repeatY or replicaX/replicaY), including '*' for extended repeat
            // - replica step in pixels (repeatStepX/repeatStepY)
            const ensureBgEntrySrc = (entry) => {
                if (entry && typeof entry === 'object') return entry.src;
                return entry;
            };
    
            const bgWidth = Math.max(worldWidth, CONFIG.width);
            const bgHeight = Math.max(worldHeight, CONFIG.height);
            const fgWidth = Math.max(worldWidth, CONFIG.width);
            const fgHeight = Math.max(worldHeight, CONFIG.height);
    
            const parseNumeric = (value, fallback = 0) => {
                const n = Number(value);
                return Number.isFinite(n) ? n : fallback;
            };
    
            const parseRepeatValue = (value) => {
                if (value === '*' || value === 'infinite' || value === 'Infinity') return '*';
                const n = Number(value);
                if (!Number.isFinite(n)) return 1;
                return Math.max(1, Math.floor(n));
            };
    
            const resolveLayerPlacement = (entry, layerW, layerH, viewportW, viewportH) => {
                const e = (entry && typeof entry === 'object') ? entry : {};
    
                const offsetX = parseNumeric(e.offsetX ?? e.left ?? e.x ?? e.positionX, 0);
                const offsetY = parseNumeric(e.offsetY ?? e.top ?? e.y ?? e.positionY, 0);
    
                const stepX = parseNumeric(
                    e.repeatStepX ?? e.replicaStepX ?? e.repeatOffsetX ?? e.replicaOffsetX,
                    layerW
                );
                const stepY = parseNumeric(
                    e.repeatStepY ?? e.replicaStepY ?? e.repeatOffsetY ?? e.replicaOffsetY,
                    layerH
                );
    
                const repeatX = parseRepeatValue(e.repeatX ?? e.replicaX ?? e.repeatCountX ?? e.replicaCountX ?? 1);
                const repeatY = parseRepeatValue(e.repeatY ?? e.replicaY ?? e.repeatCountY ?? e.replicaCountY ?? 1);
    
                const safeStepX = Math.abs(stepX) > 0 ? stepX : layerW;
                const safeStepY = Math.abs(stepY) > 0 ? stepY : layerH;
    
                const computeInfiniteCount = (stepAbs, span, fallbackSize) => {
                    const unit = Math.max(1, stepAbs || fallbackSize || 1);
                    return Math.max(1, Math.ceil(span / unit) + 2);
                };
    
                const spanX = Math.max(worldWidth, viewportW) + Math.abs(offsetX) + Math.abs(safeStepX);
                const spanY = Math.max(worldHeight, viewportH) + Math.abs(offsetY) + Math.abs(safeStepY);
    
                const countX = (repeatX === '*')
                    ? computeInfiniteCount(Math.abs(safeStepX), spanX, layerW)
                    : repeatX;
                const countY = (repeatY === '*')
                    ? computeInfiniteCount(Math.abs(safeStepY), spanY, layerH)
                    : repeatY;
    
                return {
                    offsetX,
                    offsetY,
                    stepX: safeStepX,
                    stepY: safeStepY,
                    repeatX,
                    repeatY,
                    countX,
                    countY
                };
            };
    
            const placeLayerImage = (img, baseX, baseY, layerW, layerH, placement, ix, iy) => {
                const x = baseX + placement.offsetX + placement.stepX * ix;
                const y = baseY + placement.offsetY + placement.stepY * iy;
                try { img.setOrigin(0, 0); } catch (e) { }
                img.setDisplaySize(layerW, layerH);
                img.setPosition(x, y);
                img.__bhLayerMeta = {
                    baseX,
                    baseY,
                    layerW,
                    layerH,
                    offsetX: placement.offsetX,
                    offsetY: placement.offsetY,
                    stepX: placement.stepX,
                    stepY: placement.stepY,
                    ix,
                    iy
                };
            };
    
            const applyLayerResize = (img, w, h) => {
                if (!img || !img.__bhLayerMeta) return;
                const m = img.__bhLayerMeta;
                const x = m.baseX + m.offsetX + m.stepX * m.ix;
                const y = m.baseY + m.offsetY + m.stepY * m.iy;
                try { img.setOrigin(0, 0); } catch (e) { }
                img.setDisplaySize(w, h);
                img.setPosition(x, y);
                m.layerW = w;
                m.layerH = h;
            };
    
            if (this.levelData && this.levelData.background != null) {
                const specs = Array.isArray(this.levelData.background) ? this.levelData.background : [this.levelData.background];
                this.gameBgs = [];
                specs.forEach((entry, idx) => {
                    const src = ensureBgEntrySrc(entry);
                    let key = 'game_bg';
                    let dynamic = false;
    
                    if (typeof src === 'number' || (/^\d+$/.test(String(src)))) {
                        key = `game_bg_${src}`;
                    } else if (typeof src === 'string') {
                        if (this.textures.exists(src)) {
                            key = src;
                        } else {
                            dynamic = true;
                            key = `game_bg_level_${GAME_STATE.currentLevel}_bg_${idx}`;
                        }
                    }
    
                    const parallaxFactor = (entry && typeof entry === 'object' && typeof entry.parallaxBgFactor === 'number')
                        ? entry.parallaxBgFactor
                        : ((typeof CONFIG.parallaxBgFactor === 'number') ? CONFIG.parallaxBgFactor : 0.96);
    
                    const alphaVal = (entry && typeof entry === 'object' && typeof entry.parallaxBgAlpha === 'number')
                        ? Number(entry.parallaxBgAlpha)
                        : (typeof CONFIG.parallaxBgAlpha === 'number' ? Number(CONFIG.parallaxBgAlpha) : 1);
    
                    const placement = resolveLayerPlacement(entry, bgWidth, bgHeight, CONFIG.width, CONFIG.height);
    
                    const createBgImage = (textureKey) => {
                        try {
                            for (let iy = 0; iy < placement.countY; iy++) {
                                for (let ix = 0; ix < placement.countX; ix++) {
                                    const img = this.add.image(worldX, worldY, textureKey);
                                    placeLayerImage(img, worldX, worldY, bgWidth, bgHeight, placement, ix, iy);
                                    try { img.setDepth(-1000 - idx); } catch (e) { }
                                    try { img.setScrollFactor(parallaxFactor); } catch (e) { }
                                    try { img.setAlpha(Phaser.Math.Clamp(alphaVal, 0, 1)); } catch (e) { }
                                    this.gameBgs.push(img);
                                }
                            }
                        } catch (e) { }
                    };
    
                    if (dynamic) {
                        try {
                            if (!this.textures.exists(key)) {
                                this.load.image(key, src);
                                this.load.once('complete', () => { try { if (this.textures.exists(key)) createBgImage(key); } catch (e) { } });
                                this.load.start();
                            } else {
                                createBgImage(key);
                            }
                        } catch (e) { }
                    } else {
                        if (this.textures.exists(key)) createBgImage(key);
                    }
                });
    
                // set primary refs for compatibility with existing code
                if (this.gameBgs && this.gameBgs.length) this.gameBg = this.gameBgs[0];
            } else {
                if (this.gameBg) {
                    placeLayerImage(this.gameBg, worldX, worldY, bgWidth, bgHeight, {
                        offsetX: 0,
                        offsetY: 0,
                        stepX: bgWidth,
                        stepY: bgHeight
                    }, 0, 0);
                    this.gameBg.setScrollFactor(parallaxBgFactor);
                }
            }
    
            // Foreground: support multi-layer foregrounds similar to backgrounds.
            try {
                const parallaxFgDefault = (typeof CONFIG.parallaxFgFactor === 'number')
                    ? CONFIG.parallaxFgFactor
                    : Math.max(0, (parallaxBgFactor || 0.96) * 0.88);
    
                const defaultFgKey = 'game_fg';
    
                const ensureFgEntrySrc = (entry) => { if (entry && typeof entry === 'object') return entry.src; return entry; };
    
                const specs = (this.levelData && this.levelData.foreground != null)
                    ? (Array.isArray(this.levelData.foreground) ? this.levelData.foreground : [this.levelData.foreground])
                    : null;
    
                this.gameFgs = [];
    
                const createForegroundWithKey = (fgKey, entry, idx) => {
                    try {
                        if (!this.textures.exists(fgKey)) return;
                        const placement = resolveLayerPlacement(entry, fgWidth, fgHeight, CONFIG.width, CONFIG.height);
    
                        const fgAlpha = (entry && typeof entry === 'object' && typeof entry.parallaxFgAlpha === 'number')
                            ? Number(entry.parallaxFgAlpha)
                            : (typeof CONFIG.parallaxFgAlpha === 'number' ? Number(CONFIG.parallaxFgAlpha) : 0.92);
    
                        const parallaxFactor = (entry && typeof entry === 'object' && typeof entry.parallaxFgFactor === 'number')
                            ? entry.parallaxFgFactor
                            : parallaxFgDefault;
    
                        for (let iy = 0; iy < placement.countY; iy++) {
                            for (let ix = 0; ix < placement.countX; ix++) {
                                const img = this.add.image(worldX, worldY, fgKey);
                                placeLayerImage(img, worldX, worldY, fgWidth, fgHeight, placement, ix, iy);
                                try { img.setDepth(3000 + idx); } catch (e) { }
                                try { img.setAlpha(Phaser.Math.Clamp(fgAlpha, 0, 1)); } catch (e) { }
                                img.setScrollFactor(parallaxFactor);
    
                                this.gameFgs.push(img);
                                this.gameFg = this.gameFgs.length ? this.gameFgs[this.gameFgs.length - 1] : img;
                            }
                        }
                    } catch (e) { /* ignore failures creating FG */ }
                };
    
                if (specs && specs.length) {
                    specs.forEach((entry, idx) => {
                        const src = ensureFgEntrySrc(entry);
                        let key = defaultFgKey;
                        let dynamic = false;
    
                        if (typeof src === 'number' || (/^\d+$/.test(String(src)))) {
                            key = `game_fg_level_${src}`;
                        } else if (typeof src === 'string') {
                            if (this.textures.exists(src)) {
                                key = src;
                            } else {
                                dynamic = true;
                                key = `game_fg_level_${GAME_STATE.currentLevel}_fg_${idx}`;
                            }
                        }
    
                        if (dynamic) {
                            try {
                                if (!this.textures.exists(key)) {
                                    this.load.image(key, src);
                                    this.load.once('complete', () => { try { if (this.textures.exists(key)) createForegroundWithKey(key, entry, idx); } catch (e) { } });
                                    this.load.start();
                                } else {
                                    createForegroundWithKey(key, entry, idx);
                                }
                            } catch (e) { }
                        } else {
                            if (this.textures.exists(key)) createForegroundWithKey(key, entry, idx);
                        }
                    });
                } else {
                    // No level override: use the default game_fg texture if present
                    if (this.textures.exists(defaultFgKey)) createForegroundWithKey(defaultFgKey, null, 0);
                }
            } catch (e) { }
    
            // Camera follow: move view with player to explore larger maps
            const camera = this.cameras.main;
            camera.setBounds(worldX, worldY, worldWidth, worldHeight);
            camera.startFollow(this.player, true, 0.12, 0.12);
            camera.setDeadzone((this.scale.width || CONFIG.width) * 0.3, (this.scale.height || CONFIG.height) * 0.3);
            camera.roundPixels = true;
    
            // Gems per level
            if (this.mapGemPositions && this.mapGemPositions.length > 0) {
                this.gemsRemaining = this.mapGemPositions.length;
            } else {
                this.gemsRemaining = CONFIG.gemsPerLevel;
            }
            // Determine whether gems should appear one-by-one or all at once for this level.
            try {
                this.gemsOneByOne = Boolean(
                    (this.levelData && this.levelData.map && typeof this.levelData.map.gemsOneByOne !== 'undefined') ? this.levelData.map.gemsOneByOne
                    : (this.levelData && typeof this.levelData.gemsOneByOne !== 'undefined') ? this.levelData.gemsOneByOne
                    : (typeof CONFIG.gemsOneByOneDefault !== 'undefined' ? CONFIG.gemsOneByOneDefault : false)
                );
            } catch (e) { this.gemsOneByOne = false; }
            // Number of gems required to unlock the exit for this level.
            // Priority: levelData.requiredGems || levelData.gemsRequired || levelData.map.requiredGems -> fallback CONFIG.gemsPerLevel
            this.requiredGems = Number(this.levelData?.requiredGems ?? this.levelData?.gemsRequired ?? this.levelData?.map?.requiredGems ?? CONFIG.gemsPerLevel) || Number(CONFIG.gemsPerLevel);
            // Preserve initial gem count so we can tell when "all gems" were collected
            this.initialGems = Number(this.gemsRemaining) || 0;
            // Flag set when exit(s) are unlocked/visible and can be used to complete the level
            this.exitUnlocked = false;
    
            // Spawn static rocks only when not disabled globally and not disabled by level JSON
            try {
                const disabledGlobally = (CONFIG.disableStaticRocks === true);
                const lvlStatic = this.levelConfig && this.levelConfig.staticRocks;
                const disabledByLevel = (lvlStatic === false) || (lvlStatic && typeof lvlStatic === 'object' && lvlStatic.enabled === false);
                if (!disabledGlobally && !disabledByLevel) {
                    this.spawnStaticRocks();
                }
            } catch (e) { /* ignore errors determining staticRocks */ }
    
            // Spawn ghosts (count from level JSON, e.g. "ghost": 3)
            this.spawnGhosts();
            this.spawnBatsFromMap();
    
            // Spawn gems according to mode: one-by-one (spawn first only) or all-at-once
            if ((Number(this.gemsRemaining) || 0) > 0) {
                if (this.gemsOneByOne) {
                    this.time.delayedCall(CONFIG.gemSpawnDelay, () => this.spawnGem());
                } else {
                    // spawn all gems immediately
                    if (Array.isArray(this.mapGemPositions) && this.mapGemPositions.length > 0) {
                        for (let i = 0; i < this.mapGemPositions.length; i++) {
                            const p = this.mapGemPositions[i];
                            try { this.createGemPickupAt(p.x, p.y); } catch (e) { }
                        }
                        this.mapGemIndex = this.mapGemPositions.length;
                    } else {
                        // no fixed positions: spawn N gems randomly
                        const count = Number(this.gemsRemaining) || 0;
                        for (let i = 0; i < count; i++) {
                            try { this.spawnGem(); } catch (e) { }
                        }
                    }
                }
            } else {
                // No gems to spawn — consider exits active only when the "all collected" condition
                // holds (initialGems is 0 so treated as already collected).
                if ((Number(this.levelStats?.gemsCollected) || 0) >= Number(this.requiredGems || 0) || (Number(this.initialGems || 0) === 0)) {
                    this.activateHole2Exits();
                }
            }
    
            // Setup collisions
            this.setupCollisions();
    
            // Setup world bounds bounce for dynamite
            if (!this.worldBoundsHandlerAdded) {
                this.worldBoundsHandlerAdded = true;
                this.physics.world.on('worldbounds', (body) => {
                    const obj = body?.gameObject;
                    if (!obj || !obj.active) return;
                    if (this.dynamites && this.dynamites.contains(obj)) {
                        this.bounceAndExplode(obj);
                        return;
                    }
                    // If a rolling boulder hits the world bounds, attempt to split it (acts like hitting solid ground)
                    try {
                        if (this.boulders && this.boulders.contains && this.boulders.contains(obj)) {
                            this.trySplitRollingBoulder(obj, null);
                            return;
                        }
                    } catch (e) { }
                });
            }
    
            // Setup UI
            this.createUI();
            this.showLevelObjective();
    
            // Recompute layout when the canvas/container is resized (for responsive/mobile)
            this.scale.on('resize', (gameSize) => {
                const w = (gameSize && gameSize.width) ? gameSize.width : (this.scale.width || CONFIG.width);
                const h = (gameSize && gameSize.height) ? gameSize.height : (this.scale.height || CONFIG.height);
                try {
                    camera.setDeadzone(w * 0.3, h * 0.3);
    
                    // Adjust background display to cover world or new viewport
                    const bgW = Math.max(worldWidth, w);
                    const bgH = Math.max(worldHeight, h);
                    if (this.gameBgs && this.gameBgs.length) {
                        this.gameBgs.forEach((img) => {
                            try { applyLayerResize(img, bgW, bgH); } catch (e) { }
                        });
                    } else if (this.gameBg) {
                        applyLayerResize(this.gameBg, bgW, bgH);
                    }
    
                    const fgW = Math.max(worldWidth, w);
                    const fgH = Math.max(worldHeight, h);
                    if (this.gameFgs && this.gameFgs.length) {
                        this.gameFgs.forEach((img) => {
                            try { applyLayerResize(img, fgW, fgH); } catch (e) { }
                        });
                    }
    
                    // Reposition HUD elements
                    if (this.updateHudLayout) this.updateHudLayout();
                    // Recreate objective pointer to use new camera dimensions
                    if (this.createObjectivePointerUI) this.createObjectivePointerUI();
                } catch (e) {
                    console.warn('Resize handler error', e);
                }
            }, this);
    
            // Setup level timer (if provided in level data)
            this.setupLevelTimer();
    
            // Setup per-level light effect: piena, tremolante, flash, spenta
            this.setupLevelLightEffect();
    
            // Setup input
            this.setupInput();
    
            // Start boulder spawning
            const dynamicBoulders = this.levelConfig?.dynamicBoulders;
            const dynamicBouldersEnabled = !!dynamicBoulders
                && (typeof dynamicBoulders !== 'object' || dynamicBoulders.enabled !== false);
            if (dynamicBouldersEnabled) {
                this.startBoulderSpawning();
            }
    
            // Setup escape route
            if (this.levelConfig.escapeRoute) {
                this.spawnKey();
                if (!this.hasDoorInMap) {
                    this.spawnDoor();
                }
            }
        }
    
        createTilemap() {
            this.tiles = [];
    
            // Get map data from JSON
            // Support both old format (map as array) and new format (map.tiles as array)
            let mapData = null;
            let mapRows = CONFIG.gridHeight;
            let mapCols = CONFIG.gridWidth;
    
            if (this.levelData?.map) {
                // New format: map object with cols, rows, tiles
                if (this.levelData.map.tiles) {
                    mapData = this.levelData.map.tiles;
                    mapRows = this.levelData.map.rows || mapData.length;
                    mapCols = this.levelData.map.cols || (mapData[0]?.length || CONFIG.gridWidth);
                }
                // Old format: map is directly the array
                else if (Array.isArray(this.levelData.map)) {
                    mapData = this.levelData.map;
                    mapRows = this.levelData.rows || mapData.length;
                    mapCols = this.levelData.cols || (mapData[0]?.length || CONFIG.gridWidth);
                }
            } else {
                // Fallback to old properties
                mapRows = this.levelData?.rows || CONFIG.gridHeight;
                mapCols = this.levelData?.cols || CONFIG.gridWidth;
            }
    
            // Place map at world origin; camera will handle centering for small maps
            const offsetX = 0;
            const offsetY = 0;
    
            // Tile frames are defined centrally in data/module/constants.js (TILE_FRAMES)
    
            const resolveTokenMap = (val) => {
                try {
                    if (val == null) return val;
                    if (typeof val !== 'string') return val;
                    const map = (this.levelData && this.levelData.tokenMap) ? this.levelData.tokenMap : (CONFIG.tokenMap || {});
                    const tryKeys = [val, val.toLowerCase(), val.toUpperCase()];
                    for (let k of tryKeys) {
                        if (k && map[k] && String(map[k]).trim() !== String(val)) {
                            return resolveTokenMap(String(map[k]));
                        }
                    }
                } catch (e) { /* ignore */ }
                return val;
            };
    
            const splitTokenEffects = (rawToken) => {
                const text = String(rawToken ?? '').trim();
                if (!text) return { base: text, effects: [], effectOptions: {} };
    
                // Supports forms like: g(lamp), g(lamp,pulse), exit[12](lamp), g(lamp).
                const match = text.match(/^(.+?)\(([^()]+)\)(\.)?$/);
                if (!match) return { base: text, effects: [], effectOptions: {} };
    
                let base = String(match[1] || '').trim();
                if (match[3] === '.') base = `${base}.`;
    
                const listRaw = String(match[2] || '');
                const entries = [];
                let buf = '';
                let depth = 0;
                for (let i = 0; i < listRaw.length; i++) {
                    const ch = listRaw[i];
                    if (ch === '{') depth++;
                    if (ch === '}') depth = Math.max(0, depth - 1);
                    if (ch === ',' && depth === 0) {
                        entries.push(buf.trim());
                        buf = '';
                        continue;
                    }
                    buf += ch;
                }
                if (buf.trim()) entries.push(buf.trim());
    
                const effects = [];
                const effectOptions = {};
    
                entries.forEach((entry) => {
                    const rawEntry = String(entry || '').trim();
                    if (!rawEntry) return;
    
                    const m = rawEntry.match(/^([a-z0-9_\-]+)(?:\{([^}]*)\})?$/i);
                    if (!m) return;
    
                    const normalizedName = this.normalizeEffectName(m[1]);
                    if (!normalizedName) return;
                    if (!effects.includes(normalizedName)) effects.push(normalizedName);
    
                    const optionsText = String(m[2] || '').trim();
                    if (!optionsText) return;
    
                    const optionPairs = optionsText.split(/[;,]+/).map((p) => p.trim()).filter(Boolean);
                    if (!optionPairs.length) return;
    
                    const parsedOptions = {};
                    optionPairs.forEach((pair) => {
                        const eqIdx = pair.indexOf(':');
                        const sepIdx = eqIdx >= 0 ? eqIdx : pair.indexOf('=');
                        if (sepIdx <= 0) return;
                        const key = String(pair.slice(0, sepIdx)).trim();
                        const rawValue = String(pair.slice(sepIdx + 1)).trim();
                        if (!key) return;
    
                        if (/^(true|false)$/i.test(rawValue)) {
                            parsedOptions[key] = /^true$/i.test(rawValue);
                            return;
                        }
                        if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
                            parsedOptions[key] = Number(rawValue);
                            return;
                        }
                        // Keep non-numeric values as string (colors like #ffee99, 0xffee99, etc.)
                        parsedOptions[key] = rawValue;
                    });
    
                    if (Object.keys(parsedOptions).length) {
                        effectOptions[normalizedName] = {
                            ...(effectOptions[normalizedName] || {}),
                            ...parsedOptions
                        };
                    }
                });
    
                return { base, effects, effectOptions };
            };
    
            const parseSingleMapSymbol = (value) => {
                // apply tokenMap mappings first
                const originalValue = value;
                value = resolveTokenMap(value);
                // support trailing '.' to indicate transparency / no tile (e.g. 'f.' puddle effects but no tile drawn)
                let noTileFlag = false;
                try {
                    // Case A: original token in the map data itself ends with '.' (e.g. 'x.').
                    if (typeof originalValue === 'string' && originalValue.length > 1 && originalValue.endsWith('.')) {
                        noTileFlag = true;
                        // remove trailing dot for subsequent parsing of the resolved value
                        if (typeof value === 'string' && value.endsWith('.')) {
                            value = value.slice(0, -1);
                        }
                        // If mapping didn't resolve (e.g. tokenMap contains only the base key without '.'),
                        // attempt to resolve using the base key as well so 'x.' can match a mapping for 'x'.
                        try {
                            const baseKey = originalValue.slice(0, -1);
                            const map = (this.levelData && this.levelData.tokenMap) ? this.levelData.tokenMap : (CONFIG.tokenMap || {});
                            const tryKeys = [baseKey, baseKey.toLowerCase(), baseKey.toUpperCase()];
                            for (let k of tryKeys) {
                                if (k && map[k] && String(map[k]).trim() !== String(baseKey)) {
                                    // use mapped value (may itself end with '.')
                                    value = String(map[k]);
                                    if (value.endsWith('.')) value = value.slice(0, -1);
                                    break;
                                }
                            }
                        } catch (e) { }
                    }
    
                    // Case B: mapping in tokenMap yields a value that ends with '.' (e.g. '#': 'w0000.').
                    // In that case, even if the original token didn't end with '.', we should
                    // honor the trailing dot in the mapped value and treat it as `noTile`.
                    if (!noTileFlag && typeof value === 'string' && value.endsWith('.')) {
                        noTileFlag = true;
                        value = value.slice(0, -1);
                    }
                } catch (e) { }
    
                // diagnostic log to help debug map tokens with trailing dot
                try {
                    if (noTileFlag && typeof console !== 'undefined' && console.log) {
                        console.log('[MAP_NO_TILE]', originalValue, '->', value);
                    }
                } catch (e) { }
                // Treat null/undefined/empty-string as explicit empty tile
                if (value == null) {
                    return { type: 'empty', wallFrame: 0, wallRotation: 0 };
                }
    
                if (typeof value !== 'string') {
                    // convert non-string values to string for parsing (numbers, etc.)
                    try { value = String(value); } catch (e) { return { type: 'empty', wallFrame: 0, wallRotation: 0 }; }
                }
    
                const normalizedValue = value.trim().toLowerCase();
                if (normalizedValue === '') {
                    return { type: 'empty', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
    
                if (normalizedValue === 'floor') {
                    return { type: 'floor', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
                if (normalizedValue === 'empty') {
                    return { type: 'empty', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
                if (normalizedValue === 'hole') {
                    return { type: 'hole', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
                if (normalizedValue === 'hole2') {
                    return { type: 'hole2', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
                if (normalizedValue === 'wall' || normalizedValue === 'w') {
                    return { type: 'wall', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
    
                // Support full token wR C R F (row,col,rot,flip) where flip is h/v/0
                const wallMatch4 = value.match(/^w(\d)(\d)(\d)([hv0])$/i);
                if (wallMatch4) {
                    const row = Number(wallMatch4[1]);
                    const col = Number(wallMatch4[2]);
                    const rotationCode = Number(wallMatch4[3]);
                    const flipChar = String(wallMatch4[4]).toLowerCase();
                    const validRow = row >= 0 && row <= 3;
                    const validCol = col >= 0 && col <= 5;
                    const validRotation = rotationCode >= 0 && rotationCode <= 3;
                    const validFlip = flipChar === 'h' || flipChar === 'v' || flipChar === '0';
                    if (validRow && validCol && validRotation && validFlip) {
                        return {
                                type: 'wall',
                                wallFrame: row * WALL_TILE_COLS + col,
                                wallRotation: rotationCode,
                                wallFlip: flipChar,
                                noTile: noTileFlag
                            };
                    }
                }
    
                // Support old "wCR" (three digits without flip) -> treat as no flip
                const wallMatch3 = value.match(/^w(\d)(\d)(\d)$/i);
                if (wallMatch3) {
                    const row = Number(wallMatch3[1]);
                    const col = Number(wallMatch3[2]);
                    const rotationCode = Number(wallMatch3[3]);
                    const validRow = row >= 0 && row <= 3;
                    const validCol = col >= 0 && col <= 5;
                    const validRotation = rotationCode >= 0 && rotationCode <= 3;
                    if (validRow && validCol && validRotation) {
                        return {
                            type: 'wall',
                            wallFrame: row * WALL_TILE_COLS + col,
                            wallRotation: rotationCode,
                            wallFlip: '0',
                            noTile: noTileFlag
                        };
                    }
                }
    
                const wallMatch2 = value.match(/^w(\d)(\d)$/i);
                if (wallMatch2) {
                    // Legacy two-digit token: first digit was frame, second was rotation
                    const legacyFrame = Number(wallMatch2[1]);
                    const rotationCode = Number(wallMatch2[2]);
                    const baseCol = legacyFrame;
                    const validBaseCol = baseCol >= 0 && baseCol <= 6;
                    const validRotation = rotationCode >= 0 && rotationCode <= 3;
                    if (validBaseCol && validRotation) {
                        return {
                            type: 'wall',
                            wallFrame: baseCol,
                            wallRotation: rotationCode,
                            wallFlip: '0',
                            noTile: noTileFlag
                        };
                    }
                    if (validBaseCol) {
                        return {
                            type: 'wall',
                            wallFrame: baseCol,
                            wallRotation: ((rotationCode % 4) + 4) % 4,
                            wallFlip: '0',
                            noTile: noTileFlag
                        };
                    }
                    return { type: 'wall', wallFrame: 0, wallRotation: 0, wallFlip: '0', noTile: noTileFlag };
                }
    
                // Support multi-character tokens like 'back' and 'back[...]'
                if (typeof value === 'string') {
                    const vnorm = value.trim().toLowerCase();
                    const backTargetMatch = vnorm.match(/^(?:bck|back|back_level)\[(.+)\]$/i);
                    if (backTargetMatch) {
                        const target = parseExitTargetLevel(backTargetMatch[1]);
                        return {
                            type: 'back',
                            wallFrame: 0,
                            wallRotation: 0,
                            noTile: noTileFlag,
                            backTargetLevelIndex: target ? target.index : null,
                            backTargetLevelId: target ? target.id : null
                        };
                    }
                    if (vnorm === 'bck' || vnorm === 'back' || vnorm === 'back_level') {
                        return { type: 'back', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    }
                    if (vnorm === 'hc' || vnorm === 'hole_cover') {
                        return { type: 'hole_cover', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    }
                }
    
                // Support multi-character tokens like 'exit' which should map to hole2 (the exit frame)
                if (typeof value === 'string') {
                    const vnorm = value.trim().toLowerCase();
                    const exitTargetMatch = vnorm.match(/^exit\[(.+)\]$/i);
                    if (exitTargetMatch) {
                        const target = parseExitTargetLevel(exitTargetMatch[1]);
                        return {
                            type: 'hole2',
                            wallFrame: 0,
                            wallRotation: 0,
                            noTile: noTileFlag,
                            exitTargetLevelIndex: target ? target.index : null,
                            exitTargetLevelId: target ? target.id : null
                        };
                    }
                    if (vnorm === 'exit' || vnorm === 'hole2') {
                        return { type: 'hole2', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    }
                }
    
                if (value.length === 1) {
                    switch (value) {
                        // single-letter 'w' treated as water here; wall tokens like w12 are handled earlier
                        case 'w': return { type: 'water', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        // 'f' is mud (fango) per new mapping
                        case 'f': return { type: 'mud', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case 'm': return { type: 'skeleton', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        // Removed special-case '#' token: no longer map '#' to invisible wall here.
                        case 'h': return { type: 'hole', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case '.': return { type: 'hole', wallFrame: 0, wallRotation: 0, noTile: true };
                        case 's': return { type: 'sand', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case 'g': return { type: 'gem', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case '-': return { type: 'empty', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case 'l': return { type: 'heart', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case 'd': return { type: 'door', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case 'k': return { type: 'key', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case 'p': return { type: 'pepita', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case 'b': return { type: 'dynamite', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        case 'c': return { type: 'cart', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                        default: return { type: value, wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    }
                }
    
                return {
                    type: value,
                    wallFrame: 0,
                    wallRotation: 0,
                    noTile: noTileFlag
                };
            };
    
        const wallMaxFrame = getTextureMaxNumericFrame(this, 'wall_tiles', WALL_TILE_COLS);
    
        // No local helper: use global resolveContactSpec to obtain per-type spec
    
            const mapSymbolToCell = (value) => {
                if (typeof value === 'string') {
                    const slashIndex = value.indexOf('/');
                    if (slashIndex > 0 && slashIndex < value.length - 1) {
                        const coverPart = value.slice(0, slashIndex).trim();
                        const revealPart = value.slice(slashIndex + 1).trim();
                        if (coverPart && revealPart) {
                            const coverMeta = splitTokenEffects(coverPart);
                            const revealMeta = splitTokenEffects(revealPart);
                            const coverCell = parseSingleMapSymbol(coverMeta.base);
                            const revealCell = parseSingleMapSymbol(revealMeta.base);
                            if (coverMeta.effects.length) coverCell.effects = coverMeta.effects;
                            if (revealMeta.effects.length) revealCell.effects = revealMeta.effects;
                            if (coverMeta.effectOptions && Object.keys(coverMeta.effectOptions).length) coverCell.effectOptions = coverMeta.effectOptions;
                            if (revealMeta.effectOptions && Object.keys(revealMeta.effectOptions).length) revealCell.effectOptions = revealMeta.effectOptions;
                            return {
                                ...coverCell,
                                hiddenReveal: revealCell
                            };
                        }
                    }
                }
    
                const singleMeta = splitTokenEffects(value);
                const singleCell = parseSingleMapSymbol(singleMeta.base);
                if (singleMeta.effects.length) singleCell.effects = singleMeta.effects;
                if (singleMeta.effectOptions && Object.keys(singleMeta.effectOptions).length) singleCell.effectOptions = singleMeta.effectOptions;
                return {
                    ...singleCell,
                    hiddenReveal: null
                };
            };
    
            for (let y = 0; y < mapRows; y++) {
                this.tiles[y] = [];
                for (let x = 0; x < mapCols; x++) {
                    let type = 'floor';
                    let wallFrame = 0;
                    let wallRotation = 0;
                    let wallFlip = '0';
                    let hiddenReveal = null;
                    let tileNoTile = false;
                    let cellEffects = [];
                    let cellEffectOptions = {};
                    let cellBackTargetLevelIndex = null;
                    let cellBackTargetLevelId = null;
                    let cellExitTargetLevelIndex = null;
                    let cellExitTargetLevelId = null;
    
                    // If we have map data from JSON, use it
                    if (mapData && mapData[y] && mapData[y][x] !== undefined) {
                        const cell = mapSymbolToCell(mapData[y][x]);
                        type = cell.type;
                        wallFrame = cell.wallFrame;
                        wallRotation = cell.wallRotation || 0;
                        wallFlip = cell.wallFlip || '0';
                        hiddenReveal = cell.hiddenReveal || null;
                        var tileInvisible = !!cell.invisible;
                        tileNoTile = !!cell.noTile;
                        cellEffects = Array.isArray(cell.effects) ? cell.effects : [];
                        cellEffectOptions = (cell.effectOptions && typeof cell.effectOptions === 'object' && !Array.isArray(cell.effectOptions))
                            ? cell.effectOptions
                            : {};
                        cellBackTargetLevelIndex = Number.isFinite(Number(cell.backTargetLevelIndex)) ? Number(cell.backTargetLevelIndex) : null;
                        cellBackTargetLevelId = cell.backTargetLevelId || null;
                        cellExitTargetLevelIndex = Number.isFinite(Number(cell.exitTargetLevelIndex)) ? Number(cell.exitTargetLevelIndex) : null;
                        cellExitTargetLevelId = cell.exitTargetLevelId || null;
                    } else {
                        // Fallback to old random generation
                        // Border walls
                        if (x === 0 || x === mapCols - 1 || y === 0 || y === mapRows - 1) {
                            type = 'wall';
                            wallFrame = 0;
                            wallRotation = 0;
                        }
                        // Random sand patches
                        else if (Math.random() < 0.1) {
                            type = 'sand';
                        }
                        // Random holes
                        else if (Math.random() < 0.05) {
                            type = 'hole';
                        }
                    }
    
                    // Object tiles are rendered without floor underneath
                    // Normally treat object tokens as 'empty' so no floor tile is drawn.
                    // However, if the logical type is 'wall' we must still create a wall
                    // collision even when the token has a trailing '.' (noTile). In that
                    // case mark the wall as invisible so it blocks but doesn't render.
                    if (type === 'wall' && tileNoTile) {
                        tileInvisible = true;
                    }
    
                    const tileType = ((tileNoTile && type !== 'wall') || type === 'door'
                        || type === 'key'
                        || type === 'pepita'
                        || type === 'dynamite'
                        || type === 'gem'
                        || type === 'cart'
                        || type === 'skeleton'
                        || type === 'hole2'
                        || type === 'heart'
                        || type === 'helmet'
                        || type === 'wooden')
                        ? 'empty'
                        : type;
                    const normalizedTileType = (tileType === 'bat' || tileType === 'ghost') ? 'floor' : tileType;
                    let tileSprite = null;
                    let coverSprite = null;
    
                    // Diagnostic: log tile creation decisions
                    try {
                        if (typeof console !== 'undefined' && console.log) console.log('[TILE_CREATE]', x, y, 'type=', type, 'tileNoTile=', tileNoTile, 'tileType=', tileType, 'normalized=', normalizedTileType);
                    } catch (e) { }
                    if (normalizedTileType !== 'empty') {
                        // Get frame index for this tile type
                        const frameIndex = normalizedTileType === 'wall'
                            ? Phaser.Math.Clamp(Number(wallFrame) || 0, 0, wallMaxFrame)
                            : (TILE_FRAMES[normalizedTileType] !== undefined ? TILE_FRAMES[normalizedTileType] : TILE_FRAMES.floor);
                        const tileTexture = normalizedTileType === 'wall' ? 'wall_tiles' : 'tiles';
    
                        // Create sprite from tiles spritesheet at integer-aligned positions
                        const tx = Math.round(offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2);
                        const ty = Math.round(offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2);
                        tileSprite = this.add.sprite(tx, ty, tileTexture, frameIndex);
                        // Force tile to display exactly as a square cell of CONFIG.tileSize
                        // (avoids gaps when native tile frame height differs from width)
                        tileSprite.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
                        try { tileSprite.setData && tileSprite.setData('type', normalizedTileType); } catch (e) { }
                        try { this.applyTokenEffects(tileSprite, cellEffects, tx, ty, cellEffectOptions); } catch (e) { }
    
                        // If the tile was marked 'invisible' in the map, hide its graphic
                        if (type === 'wall' && tileInvisible) {
                            try { tileSprite.setVisible(false); } catch (e) { }
                        }
    
                        if (type === 'wall') {
                            if (wallFlip === 'h') {
                                tileSprite.setFlipX(true);
                            } else if (wallFlip === 'v') {
                                tileSprite.setFlipY(true);
                            } else {
                                // 0..3 -> 0,90,180,270
                                tileSprite.setAngle((Number(wallRotation) || 0) * 90);
                            }
                        }
    
                        if (type === 'wall' && this.walls) {
                            this.walls.add(tileSprite);
                            // Ensure a static physics body exists for this tileSprite even when
                            // added from a plain sprite (some Phaser builds do not auto-create
                            // bodies for sprites added to a staticGroup). This guarantees
                            // invisible walls will block the player.
                            try {
                                if (!tileSprite.body && this.physics && this.physics.add && this.physics.add.existing) {
                                    this.physics.add.existing(tileSprite, true);
                                }
                            } catch (e) { }
                            // assign contact spec according to config (contactType, radiusMultiplier, proximityTiles)
                            try {
                                const spec = resolveContactSpec('wall');
                                tileSprite.setData && tileSprite.setData('contactType', spec.contactType);
                                tileSprite.setData && tileSprite.setData('contactSpec', spec);
                                tileSprite.setData && tileSprite.setData('type', 'wall');
                            } catch (e) { }
                            coverSprite = tileSprite;
                            if (tileSprite.body) {
                                // Prefer a center-based circular body for tile objects so contact feels like it happens at tile center
                                try {
                                    const tw = Math.floor(tileSprite.displayWidth || tileSprite.width);
                                    const th = Math.floor(tileSprite.displayHeight || tileSprite.height);
                                    const spec = resolveContactSpec('wall');
                                    let radius;
                                    if (spec && typeof spec.radiusPixels === 'number') {
                                        radius = Math.floor(spec.radiusPixels);
                                    } else {
                                        const multiplier = (spec && spec.radiusMultiplier) ? spec.radiusMultiplier : 0.45;
                                        radius = Math.floor(Math.min(tw, th) * multiplier);
                                    }
                                    if (tileInvisible) {
                                        // For invisible walls, use a full-tile rectangular body so collision covers entire cell
                                        try { tileSprite.body.setSize(tw, th); tileSprite.body.setOffset(0, 0); } catch (e) { }
                                    } else {
                                        try { tileSprite.body.setCircle(radius); const offsetX = Math.floor((tw / 2) - radius); const offsetY = Math.floor((th / 2) - radius); tileSprite.body.setOffset(offsetX, offsetY); } catch (e) { }
                                    }
                                } catch (e) {
                                    tileSprite.body.setSize(Math.floor(tileSprite.displayWidth || tileSprite.width), Math.floor(tileSprite.displayHeight || tileSprite.height));
                                }
                            }
                        }
    
                            // If map explicitly specified a hole_cover token, create a persistent plank overlay
                            if (type === 'hole_cover') {
                                try {
                                    // mark tile as floor so player can walk on it
                                    type = 'floor';
                                    // Use tiles.png hole_cover frame instead of creating a separate plank image
                                    if (tileSprite && tileSprite.setFrame) {
                                        try { tileSprite.setFrame(TILE_FRAMES.hole_cover); } catch (e) { }
                                        try { tileSprite.setData && tileSprite.setData('covered', true); } catch (e) { }
                                        coverSprite = tileSprite;
                                    } else {
                                        // fallback: create no extra overlay, still mark covered on data container
                                        try { coverSprite = null; } catch (e) { }
                                    }
                                } catch (e) { }
                            }
                    }
    
                    if (type === 'door' && !tileNoTile && this.doors) {
                        const door = this.doors.create(
                            offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                            offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                            'objects',
                            OBJECT_FRAMES.door
                        );
                        this.setupDoor(door);
                        try { this.applyTokenEffects(door, cellEffects, door.x, door.y, cellEffectOptions); } catch (e) { }
                        this.hasDoorInMap = true;
                        coverSprite = door;
                    }
    
                    if (!tileNoTile && (type === 'key' || type === 'pepita' || type === 'heart' || type === 'dynamite' || type === 'skeleton' || type === 'cart' || type === 'helmet' || type === 'wooden') && this.items) {
                        const objectDef = this.getObjectDefinitionForType(type);
                        let frame = OBJECT_FRAMES.wall;
                        if (type === 'key') frame = OBJECT_FRAMES.key;
                        else if (type === 'pepita') frame = OBJECT_FRAMES.pepita;
                        else if (type === 'heart') frame = OBJECT_FRAMES.heart;
                        else if (type === 'dynamite') frame = OBJECT_FRAMES.dynamite_chest;
                        else if (type === 'wooden') frame = OBJECT_FRAMES.wooden;
                        else if (type === 'cart') frame = OBJECT_FRAMES.cart;
                        else if (type === 'helmet') frame = OBJECT_FRAMES.helmet;
                        if (Number.isFinite(Number(objectDef?.defaultFrame))) {
                            frame = Number(objectDef.defaultFrame);
                        }
                        const itemTexture = String(objectDef?.textureKey || 'objects');
                        // Keep map token visuals as `objects` until revealed; actual skeleton
                        // will be spawned when the tile is revealed.
                        const itemSprite = this.items.create(
                            offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                            offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                            itemTexture,
                            frame
                        );
                        // Keep item at original sprite size and prefer a circular body centered on the item so pickups/poles behave by center contact
                        if (itemSprite.body) {
                            try {
                                const iw = Math.floor(itemSprite.displayWidth || itemSprite.width);
                                const ih = Math.floor(itemSprite.displayHeight || itemSprite.height);
                                const spec = resolveContactSpec(type === 'gem' ? 'gem' : 'item');
                                let radius;
                                if (spec && typeof spec.radiusPixels === 'number') {
                                    radius = Math.floor(spec.radiusPixels);
                                } else {
                                    const multiplier = (spec && spec.radiusMultiplier) ? spec.radiusMultiplier : 0.45;
                                    radius = Math.floor(Math.min(iw, ih) * multiplier);
                                }
                                itemSprite.body.setCircle(radius);
                                const offsetX = Math.floor((iw / 2) - radius);
                                const offsetY = Math.floor((ih / 2) - radius);
                                itemSprite.body.setOffset(offsetX, offsetY);
                            } catch (e) {
                                itemSprite.body.setSize(itemSprite.displayWidth || itemSprite.width, itemSprite.displayHeight || itemSprite.height);
                            }
                        }
                        // Apply object scale multiplier so items adapt to configuration
                        const objectScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
                        itemSprite.setScale(objectScaleFactor);
                        if (itemSprite.body) {
                            // Recalculate body after scaling; try circular again using configured multiplier
                            try {
                                const iw = Math.floor(itemSprite.displayWidth || itemSprite.width);
                                const ih = Math.floor(itemSprite.displayHeight || itemSprite.height);
                                const spec = resolveContactSpec(type === 'gem' ? 'gem' : 'item');
                                let radius;
                                if (spec && typeof spec.radiusPixels === 'number') {
                                    radius = Math.floor(spec.radiusPixels);
                                } else {
                                    const multiplier = (spec && spec.radiusMultiplier) ? spec.radiusMultiplier : 0.45;
                                    radius = Math.floor(Math.min(iw, ih) * multiplier);
                                }
                                itemSprite.body.setCircle(radius);
                                const offsetX = Math.floor((iw / 2) - radius);
                                const offsetY = Math.floor((ih / 2) - radius);
                                itemSprite.body.setOffset(offsetX, offsetY);
                            } catch (e) {
                                itemSprite.body.setSize(Math.floor(itemSprite.displayWidth || itemSprite.width), Math.floor(itemSprite.displayHeight || itemSprite.height));
                            }
                        }
                        itemSprite.setData('type', type);
                        this.assignObjectDefinitionToSprite(itemSprite, objectDef || type);
                        // contact type/spec from config for items
                        try {
                            const specItem = resolveContactSpec(type === 'gem' ? 'gem' : 'item');
                            itemSprite.setData && itemSprite.setData('contactType', specItem.contactType);
                            itemSprite.setData && itemSprite.setData('contactSpec', specItem);
                        } catch (e) { }
                        itemSprite.setData('gridX', x);
                        itemSprite.setData('gridY', y);
                        try { this.applyTokenEffects(itemSprite, cellEffects, itemSprite.x, itemSprite.y, cellEffectOptions); } catch (e) { }
                        if (type === 'key' || type === 'wooden') {
                            // keys and wooden planks float to indicate pickup
                            this.applyKeyFloatingEffect(itemSprite);
                        }
                        coverSprite = itemSprite;
                        if (type === 'dynamite') {
                            try { this.levelHasDynamite = true; } catch (e) { }
                        }
    
                        if (type === 'key' && this.keySpawnPositions) {
                            this.keySpawnPositions.push({ x: itemSprite.x, y: itemSprite.y });
                        }
                    }
    
                    if (!tileNoTile && type === 'gem') {
                        if (!this.mapGemPositions) {
                            this.mapGemPositions = [];
                        }
                        this.mapGemPositions.push({
                            x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                            y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                            effects: cellEffects,
                            effectOptions: cellEffectOptions
                        });
                    }
    
                    if (!tileNoTile && type === 'hole2') {
                        if (!this.hole2ExitPositions) {
                            this.hole2ExitPositions = [];
                        }
                        this.hole2ExitPositions.push({
                            x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                            y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                            gridX: x,
                            gridY: y,
                            exitTargetLevelIndex: cellExitTargetLevelIndex,
                            exitTargetLevelId: cellExitTargetLevelId,
                            effects: cellEffects,
                            effectOptions: cellEffectOptions
                        });
                    }
    
                    if (!tileNoTile && type === 'back') {
                        try {
                            this.spawnBackLabelAt(
                                offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                                offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2
                            );
                        } catch (e) { }
                    }
    
                    if (!tileNoTile && type === 'ghost') {
                        if (!this.ghostSpawnPositions) {
                            this.ghostSpawnPositions = [];
                        }
                        this.ghostSpawnPositions.push({
                            x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                            y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2
                        });
                    }
    
                    if (!tileNoTile && type === 'bat') {
                        if (!this.batSpawnPositions) {
                            this.batSpawnPositions = [];
                        }
                        this.batSpawnPositions.push({
                            x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                            y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                            effects: cellEffects
                        });
                    }
    
                    // Store logical type (for game logic) and sprite separately. Use original
                    // `type` as the tile `type` so holes are recognized even when no tile is drawn.
                    this.tiles[y][x] = {
                        type: type,
                        sprite: tileSprite,
                        noTile: !!tileNoTile,
                        invisible: !!tileInvisible,
                        backTargetLevelIndex: cellBackTargetLevelIndex,
                        backTargetLevelId: cellBackTargetLevelId,
                        effects: cellEffects,
                        effectOptions: cellEffectOptions
                    };
                    // Diagnostic: when debug flag enabled and the source map token had a trailing dot,
                    // print the stored tile entry so we can verify `noTile`/type/hiddenReveal propagation.
                    try {
                        if (CONFIG.debugTileGrid && mapData && mapData[y] && typeof mapData[y][x] === 'string' && mapData[y][x].endsWith('.')) {
                            try {
                                const tileObj = this.tiles[y] && this.tiles[y][x] ? this.tiles[y][x] : null;
                                const ctype = (tileObj && tileObj.sprite && typeof tileObj.sprite.getData === 'function') ? tileObj.sprite.getData('contactType') : (tileObj && tileObj.contactType) || null;
                                console.log('[DEBUG_TILE_ENTRY]', 'grid=', y, x, 'token=', mapData[y][x], 'contactType=', ctype, 'tileObj=', tileObj);
                            } catch (e) { }
                        }
                    } catch (e) { }
                    if (hiddenReveal) {
                        this.tiles[y][x].hiddenReveal = hiddenReveal;
                        this.tiles[y][x].coverType = type;
                        this.tiles[y][x].coverSprite = coverSprite;
                        this.tiles[y][x].hiddenRevealed = false;
                    }
                }
            }
    
            // Store map dimensions for later use
            this.mapRows = mapRows;
            this.mapCols = mapCols;
            this.mapOffsetX = offsetX;
            this.mapOffsetY = offsetY;
    
            // Decorative fog / mist support (per-level configurable)
            try {
                const generalFx = this.getGeneralEffectsConfig();
                const fogCfg = (generalFx && generalFx.fog) || ((this.levelData && this.levelData.fog) ? this.levelData.fog : null);
                if (fogCfg && fogCfg.enabled) {
                    const fogAlpha = (typeof fogCfg.alpha === 'number') ? fogCfg.alpha : 0.28;
                    // layers controls depth; density controls how many blobs per layer
                    const layers = Math.max(1, Number(fogCfg.layers) || 3);
                    const density = Math.max(2, Number(fogCfg.density) || 5);
                    const dirSign = (fogCfg.direction === 'right') ? 1 : -1;
                    const speedMode = (fogCfg.speed === 'fast') ? 'fast' : 'slow';
                    const baseDur = (speedMode === 'fast') ? 5000 : 14000;
                    this.fogBlobs = [];
                    // Map/world bounds for placement (allow margin so blobs appear off-screen too)
                    const mapW = Math.max( (this.mapCols || mapCols) * (CONFIG.tileSize || 64), this.sys.game.config.width || 800 );
                    const mapH = Math.max( (this.mapRows || mapRows) * (CONFIG.tileSize || 64), this.sys.game.config.height || 600 );
                    const margin = Math.max(200, Math.floor((CONFIG.tileSize || 64) * 2));
                    // ensure a soft fog texture exists (generate once per scene)
                    try {
                        if (!this.textures.exists || !this.textures.exists('fog_blob')) {
                            // generate a radial soft blob using graphics rendered to texture
                            const genW = 256;
                            const genH = 160;
                            const g = this.add.graphics();
                            // draw multiple concentric circles to simulate a soft gradient
                            const cx = Math.floor(genW / 2);
                            const cy = Math.floor(genH / 2);
                            const maxR = Math.min(cx, cy);
                            for (let r = maxR; r > 0; r -= 4) {
                                const alpha = Phaser.Math.Clamp((maxR - r) / maxR, 0, 1);
                                const a = 0.6 * (1 - alpha) * 0.9;
                                g.fillStyle(0xffffff, a);
                                g.fillCircle(cx, cy, r);
                            }
                            try {
                                const rt = this.add.renderTexture(0, 0, genW, genH);
                                rt.draw(g, 0, 0);
                                rt.saveTexture('fog_blob');
                                rt.destroy();
                            } catch (e) { }
                            try { g.destroy(); } catch (e) {}
                        }
                    } catch (e) { }
    
                    // spawn multiple layers for parallax effect; outer layers are larger and slower
                    for (let layer = 0; layer < layers; layer++) {
                        const blobsInLayer = density * (1 + Math.floor(layer * 0.5));
                        // anchor fog to background parallax (so it doesn't follow camera directly)
                        const scrollFactor = (typeof parallaxBgFactor === 'number') ? parallaxBgFactor : 0.96;
                        for (let i = 0; i < blobsInLayer; i++) {
                            try {
                                // allow placement with margin so fog appears in various screen parts
                                const px = (this.mapOffsetX || 0) + Phaser.Math.Between(-margin, mapW + margin);
                                const py = (this.mapOffsetY || 0) + Phaser.Math.Between(-margin, mapH + margin);
                                // larger sizes for more volumetric appearance; scale by layer so distant layers are bigger
                                const minW = Math.floor((CONFIG.tileSize || 64) * (2.5 + layer * 0.8));
                                const maxW = Math.floor((CONFIG.tileSize || 64) * (6.0 + layer * 1.2));
                                const sizeW = Phaser.Math.Between(minW, maxW);
                                const minH = Math.floor((CONFIG.tileSize || 64) * (1.4 + layer * 0.6));
                                const maxH = Math.floor((CONFIG.tileSize || 64) * (3.8 + layer * 0.9));
                                const sizeH = Phaser.Math.Between(minH, maxH);
                                // Create a soft image blob using generated fog texture; anchor to background parallax
                                // Place fog in front of the background (which uses -1000) but behind gameplay elements
                                const blobDepth = -900 + (layer * 10);
                                const blob = this.add.image(px, py, 'fog_blob').setOrigin(0.5).setDepth(blobDepth).setScrollFactor(scrollFactor);
                                blob.setDisplaySize(sizeW, sizeH);
                                // alpha scaled by layer and random noise for variety
                                const layerAlpha = fogAlpha * (1 - (layer / Math.max(1, layers + 1)) );
                                blob.setAlpha(Phaser.Math.Clamp(layerAlpha * (0.7 + Math.random() * 0.8), 0.02, 0.9));
                                try { blob.setBlendMode && blob.setBlendMode(Phaser.BlendModes.SCREEN); } catch (e) { }
                                // Drift: slower for distant layers, more pronounced for closer ones
                                const driftBase = (dirSign * Phaser.Math.Between(40, 220)) * (1 + (i * 0.02));
                                const driftX = driftBase * (1 + (layer * 0.3));
                                const driftY = Phaser.Math.Between(-120, 120) * (1 - (layer / Math.max(1, layers)));
                                const dur = Math.max(2000, Math.round(baseDur * (1 + (i * 0.05) + (layer * 0.2))));
                                this.tweens.add({ targets: blob, x: blob.x + driftX, y: blob.y + driftY, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                                this.fogBlobs.push(blob);
                            } catch (e) { }
                        }
                    }
                }
            } catch (e) { }
    
            // If the level contains dynamite items in the map, grant extra dynamite sticks
            try {
                if (this.levelHasDynamite) {
                    GAME_STATE.dynamiteCount = (Number(GAME_STATE.dynamiteCount) || 0) + 50;
                    if (this.updateUI) this.updateUI();
                }
            } catch (e) { }
    
            // Foreground resizing/positioning removed here to keep logic simple.
            // The foreground will be created and positioned once the world bounds
            // are established (see creation after background sizing). Keeping the
            // creation in one place ensures consistent behaviour across all levels.
    
            // --- Debug: draw light tile outlines to visualize the grid ---
            // Create a graphics layer that outlines each tile. Useful to see
            // tile boundaries (including empty tiles). Toggle with 'G'.
            try {
                if (this.tileGridDebug) { this.tileGridDebug.clear(); }
                this.tileGridDebug = this.add.graphics();
                // Draw a thin semi-transparent stroke
                this.tileGridDebug.lineStyle(1, 0xffffff, 0.18);
                for (let y = 0; y < mapRows; y++) {
                    for (let x = 0; x < mapCols; x++) {
                        const rectX = offsetX + x * CONFIG.tileSize;
                        const rectY = offsetY + y * CONFIG.tileSize;
                        this.tileGridDebug.strokeRect(rectX, rectY, CONFIG.tileSize, CONFIG.tileSize);
                    }
                }
                // Put debug overlay above tiles but below sprites (adjust depth if needed)
                this.tileGridDebug.setDepth(50);
                // Hidden-tile color overlay (only when debug enabled)
                try {
                    if (this.tileHiddenDebug) this.tileHiddenDebug.clear();
                    else this.tileHiddenDebug = this.add.graphics();
                    // Place the hidden-tile overlay just below the HUD so it's always visible
                    // above tiles/background but under UI elements.
                    this.tileHiddenDebug.setDepth(HUD_DEPTH - 1);
                    if (CONFIG.debugTileGrid) {
                        for (let y = 0; y < mapRows; y++) {
                            for (let x = 0; x < mapCols; x++) {
                                const t = (this.tiles && this.tiles[y]) ? this.tiles[y][x] : null;
                                if (!t) continue;
                                // Highlight tiles that are logically hidden (either marked as hiddenReveal
                                // and not yet revealed, or marked `noTile` which indicates a transparent
                                // token like 'water.' / 'f.' where the logical cell exists but no tile drawn)
                                if (!( (t.hiddenReveal && !t.hiddenRevealed) || t.noTile )) continue;
                                const rectX = offsetX + x * CONFIG.tileSize;
                                const rectY = offsetY + y * CONFIG.tileSize;
                                // determine logical token to color: prefer hiddenReveal token if present,
                                // otherwise fall back to tile type (useful for `noTile` cases)
                                const hv = (t.hiddenReveal && t.hiddenReveal.type) ? String(t.hiddenReveal.type).toLowerCase() : String(t.type || '').toLowerCase();
                                let color = null;
                                if (hv.indexOf('hole') !== -1 || hv === 'h' || hv === '.') {
                                    color = 0x000000; // black for hidden holes
                                } else if (hv.indexOf('water') !== -1) {
                                    color = 0x1f66ff; // blue for hidden water
                                } else if (hv.indexOf('mud') !== -1 || hv === 'f') {
                                    color = 0x8b4513; // brown for hidden mud
                                } else {
                                    // fallback: if tile type or cover indicates wall, use gray
                                    const tt = String(t.type || t.coverType || '').toLowerCase();
                                    if (tt === 'wall' || tt.startsWith('w')) color = 0x808080;
                                }
                                if (color !== null) {
                                    try {
                                        // Use a lower alpha so the overlay is diagnostic but not fully opaque
                                        this.tileHiddenDebug.fillStyle(color, 0.45);
                                        this.tileHiddenDebug.fillRect(rectX, rectY, CONFIG.tileSize, CONFIG.tileSize);
                                    } catch (e) { }
                                }
                            }
                        }
                    }
                } catch (e) { }
                // Create/clear labels array
                try {
                    if (this.tileGridLabels && Array.isArray(this.tileGridLabels)) {
                        this.tileGridLabels.forEach(l => { try { l.destroy(); } catch (e) { } });
                    }
                } catch (e) { }
                this.tileGridLabels = [];
    
                // Create small coordinate labels centered in each tile when debug enabled
                const labelStyle = { font: '10px monospace', fill: '#ffffff', align: 'center' };
                for (let y = 0; y < mapRows; y++) {
                    for (let x = 0; x < mapCols; x++) {
                        const cx = offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
                        const cy = offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;
                        // include contactType in debug label when available
                        let labelText = `${y},${x}`;
                        try {
                            const t = (this.tiles && this.tiles[y]) ? this.tiles[y][x] : null;
                            let ctype = null;
                            if (t) {
                                if (t.sprite && typeof t.sprite.getData === 'function') {
                                    ctype = t.sprite.getData('contactType') || null;
                                }
                                if (!ctype && t.contactType) ctype = t.contactType;
                                // fallback: derive from logical type using resolveContactSpec
                                if (!ctype && typeof resolveContactSpec === 'function') {
                                    try {
                                        const spec = resolveContactSpec(t.type || null);
                                        if (spec && spec.contactType) ctype = spec.contactType;
                                    } catch (e) { }
                                }
                            }
                            if (ctype) labelText = `${y},${x}\n${ctype}`;
                            else labelText = `${y},${x}`;
                        } catch (e) { }
                        const txt = this.add.text(cx, cy, labelText, labelStyle).setOrigin(0.5).setLineSpacing(0);
                        txt.setAlpha(0.7);
                        txt.setDepth(51);
                        // Keep label hidden unless debug enabled
                        txt.visible = !!CONFIG.debugTileGrid;
                        this.tileGridLabels.push(txt);
                    }
                }
    
                // Visibility controlled by config but still toggleable with G
                this.tileGridDebug.visible = !!CONFIG.debugTileGrid;
                // Toggle visibility with G key (affects both strokes and labels)
                this.input.keyboard.on('keydown-G', () => {
                    const visible = !this.tileGridDebug.visible;
                    this.tileGridDebug.visible = visible;
                    if (this.tileGridLabels && Array.isArray(this.tileGridLabels)) {
                        this.tileGridLabels.forEach(l => { l.visible = visible; });
                    }
                    // Also show/hide the hidden-tile overlay (noTile / hiddenReveal)
                    try {
                        if (this.tileHiddenDebug) this.tileHiddenDebug.visible = visible;
                    } catch (e) { }
                });
            } catch (e) {
                // ignore if input not ready or in non-interactive context
            }
        }
    }

    return GameScene;
}
