import { createMapMixin } from './scene/map.js';
import { createEffectsMixin } from './scene/effects.js';
import { createPlayerMixin } from './scene/player.js';
import { createItemsMixin } from './scene/items.js';
import { createLevelflowMixin } from './scene/levelflow.js';
import { createRocksMixin } from './scene/rocks.js';
import { createDynamiteMixin } from './scene/dynamite.js';
import { createHudMixin } from './scene/hud.js';
import { createCollisionsMixin } from './scene/collisions.js';
import { createEnemiesCommonMixin } from './scene/enemies/common.js';
import { createEnemiesBatMixin } from './scene/enemies/bat.js';
import { createEnemiesGhostMixin } from './scene/enemies/ghost.js';
import { createEnemiesSpiderMixin } from './scene/enemies/spider.js';
import { createEnemiesSnakeMixin } from './scene/enemies/snake.js';

export function createGameScene(deps) {
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
    kitFlow
} = deps;
class GameScene extends Phaser.Scene {
        // Mostra un messaggio a tutto schermo e lo rimuove dopo alcuni secondi
        showFullScreenMessage(msg, style = 'info', duration = 2200) {
            if (this._fullScreenMsg) {
                this._fullScreenMsg.destroy();
                this._fullScreenMsg = null;
            }
            const w = this.scale.width || CONFIG.width;
            const h = this.scale.height || CONFIG.height;
            const color = style === 'warning' ? '#ff4444' : style === 'success' ? '#44ff44' : '#ffffff';
            const bgColor = style === 'warning' ? 0x660000 : style === 'success' ? 0x006600 : 0x000000;
            const bg = this.add.rectangle(w/2, h/2, w, 120, bgColor, 0.7).setDepth(9999);
            const text = this.add.text(w/2, h/2, msg, {
                fontFamily: GAME_FONT || 'PressStart2P',
                fontSize: '32px',
                color,
                align: 'center',
                stroke: '#000',
                strokeThickness: 6,
                padding: { left: 20, right: 20, top: 10, bottom: 10 },
                wordWrap: { width: w - 80 }
            }).setOrigin(0.5).setDepth(10000);
            this._fullScreenMsg = this.add.container(0, 0, [bg, text]);
            this.time.delayedCall(duration, () => {
                if (this._fullScreenMsg) { this._fullScreenMsg.destroy(); this._fullScreenMsg = null; }
            });
        }
    // Da chiamare quando viene raccolta un'asse
    onPlankCollected() {
        if (!this._eventFired) this._eventFired = {};
        this._eventFired['plank_collected_trigger'] = true;
        this.checkAndShowLevelEvents && this.checkAndShowLevelEvents();
    }

    // Da chiamare per warning custom
    triggerWarning() {
        if (!this._eventFired) this._eventFired = {};
        this._eventFired['warning_trigger'] = true;
        this.checkAndShowLevelEvents && this.checkAndShowLevelEvents();
    }

    constructor() {
        super('GameScene');
    }

    create() {
        // Carica le traduzioni prima di inizializzare la scena
        loadTranslations(GAME_STATE.language, () => {
            this.initializeGame();
        });

        const intro = this.sound.get('intro_bgm');
        if (intro && intro.isPlaying) {
            intro.stop();
        }

        playLoopAudioSafely(this, 'game_bgm', 0.28);
    }

    initializeGame() {
        // --- Eventi custom da JSON livello ---
        // levelEvents is filled once this.levelData is loaded (see below)
        this.levelEvents = [];
        this._eventFired = {};

        // Regole predefinite: puoi aggiungerne altre nel JSON
        const eventRuleCheckers = {
            'gems_half': () => {
                const total = this.initialGems || this.requiredGems || 0;
                const collected = this.levelStats?.gemsCollected || 0;
                return total > 0 && collected >= Math.ceil(total/2) && !this._eventFired['gems_half'];
            },
            'plank_collected': () => {
                return this._eventFired['plank_collected_trigger'] && !this._eventFired['plank_collected'];
            },
            'warning': () => {
                return this._eventFired['warning_trigger'] && !this._eventFired['warning'];
            }
        };

        // Hook: chiama questa funzione ogni volta che vuoi controllare e mostrare eventi
        this.checkAndShowLevelEvents = () => {
            if (!this.levelEvents) return;
            for (const ev of this.levelEvents) {
                if (this._eventFired[ev.type]) continue;
                const checker = eventRuleCheckers[ev.type];
                if (checker && checker()) {
                    this.showFullScreenMessage(ev.message, ev.style);
                    this._eventFired[ev.type] = true;
                }
            }
        };
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

        // New definitive layout for player_front spritesheet:
        // row 1 (0..9): front, idle 0..1 and walk 2..9
        // row 2 (10..19): side, idle 10..11 and walk 12..19
        const hasCombinedFrontSideSheet = playerFrontMaxFrame >= 19;
        const hasCombinedBackSheet = playerFrontMaxFrame >= 29;

        const frontWalkStart = hasCombinedFrontSideSheet ? 2 : 0;
        const frontWalkEnd = hasCombinedFrontSideSheet ? 9 : playerFrontMaxFrame;
        const frontIdleStart = 0;
        const frontIdleEnd = hasCombinedFrontSideSheet ? 1 : Math.min(1, playerFrontMaxFrame);

        // Lateral movement always uses the 2nd row of player_front with flipX for left.
        const sideWalkTexture = 'player_front';
        const sideWalkStart = hasCombinedFrontSideSheet ? 12 : frontWalkStart;
        const sideWalkEnd = hasCombinedFrontSideSheet ? 19 : frontWalkEnd;
        const sideIdleTexture = 'player_front';
        const sideIdleStart = hasCombinedFrontSideSheet ? 10 : frontIdleStart;
        const sideIdleEnd = hasCombinedFrontSideSheet ? 11 : frontIdleEnd;

        const backWalkTexture = 'player_front';
        const backWalkStart = hasCombinedBackSheet ? 22 : frontWalkStart;
        const backWalkEnd = hasCombinedBackSheet ? 29 : frontWalkEnd;
        const backIdleTexture = 'player_front';
        const backIdleStart = hasCombinedBackSheet ? 20 : frontIdleStart;
        const backIdleEnd = hasCombinedBackSheet ? 21 : frontIdleEnd;

        if (!this.anims.exists('player_front_idle')) {
            this.anims.create({
                key: 'player_front_idle',
                frames: this.anims.generateFrameNumbers('player_front', { start: frontIdleStart, end: frontIdleEnd }),
                frameRate: 3, // aumentato da 3 a 6
                repeat: -1
            });
        }
        if (!this.anims.exists('player_side_idle')) {
            this.anims.create({
                key: 'player_side_idle',
                frames: this.anims.generateFrameNumbers(sideIdleTexture, { start: sideIdleStart, end: sideIdleEnd }),
                frameRate: 3, // aumentato da 3 a 6
                repeat: -1
            });
        }
        if (!this.anims.exists('player_back_idle')) {
            this.anims.create({
                key: 'player_back_idle',
                frames: this.anims.generateFrameNumbers(backIdleTexture, { start: backIdleStart, end: backIdleEnd }),
                frameRate: 3, // aumentato da 3 a 6
                repeat: -1
            });
        }

        // Player front walk animation (used for down direction)
        if (!this.anims.exists('player_front_walk')) {
            this.anims.create({
                key: 'player_front_walk',
                frames: this.anims.generateFrameNumbers('player_front', { start: frontWalkStart, end: frontWalkEnd }),
                frameRate: 20, // aumentato da 10 a 20
                repeat: -1
            });
        }
        if (!this.anims.exists('player_back_walk')) {
            this.anims.create({
                key: 'player_back_walk',
                frames: this.anims.generateFrameNumbers(backWalkTexture, { start: backWalkStart, end: backWalkEnd }),
                frameRate: 20, // aumentato da 10 a 20
                repeat: -1
            });
        }
        if (!this.anims.exists('player_right_walk')) {
            this.anims.create({
                key: 'player_right_walk',
                frames: this.anims.generateFrameNumbers(sideWalkTexture, { start: sideWalkStart, end: sideWalkEnd }),
                frameRate: 20, // aumentato da 10 a 20
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
        if (!this.anims.exists('spider_float') && this.textures.exists('spider')) {
            this.anims.create({
                key: 'spider_float',
                frames: this.anims.generateFrameNumbers('spider', { start: 0, end: 9 }),
                frameRate: 10,
                yoyo: true,
                repeat: -1
            });
        }
        if (!this.anims.exists('snake_float') && this.textures.exists('snake')) {
            this.anims.create({
                key: 'snake_float',
                frames: this.anims.generateFrameNumbers('snake', { start: 0, end: 9 }),
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
        this.levelEvents = Array.isArray(this.levelData?.events) ? this.levelData.events.slice() : [];

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
        this.spiders = this.physics.add.group();
        this.snakes = this.physics.add.group();
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
        this.batSpawnPositions = [];
        this.spiderSpawnPositions = [];
        this.snakeSpawnPositions = [];
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

        // Apply multi-type invisible zones defined in level JSON
        try {
            const zonesMap = this.levelData?.map?.zones ?? {};
            const zoneSubs = this.levelData?.map?.zoneSubs ?? {};
            const scN = Number(this.levelData?.map?.subCellN ?? 0);
            const ts = CONFIG.tileSize || 32;
            const ox = this.mapOffsetX || 0;
            const oy = this.mapOffsetY || 0;

            // Helper: inject tile type override for effect zones (hole/sand/mud/water)
            const _injectTileType = (col, row, type) => {
                try {
                    if (this.tiles && this.tiles[row] && this.tiles[row][col]) {
                        this.tiles[row][col].type = type;
                    }
                } catch (e) {}
            };

            // Helper: create static wall body
            const _makeWallBody = (wx, wy, w, h) => {
                try {
                    const s = this.add.rectangle(wx, wy, w, h, 0x000000, 0).setOrigin(0.5, 0.5);
                    this.physics.add.existing(s, true);
                    if (s.body) { s.body.setSize(w, h); s.body.setOffset(0, 0); }
                    this.walls.add(s);
                } catch (e) {}
            };

            // Backward compat: old blockedZones → wall
            const legacyWall = this.levelData?.map?.blockedZones ?? this.levelData?.blockedZones;
            if (Array.isArray(legacyWall)) {
                legacyWall.forEach((z) => {
                    if (!Array.isArray(z) || !Number.isFinite(z[0]) || !Number.isFinite(z[1])) return;
                    _makeWallBody(Math.round(ox + z[0] * ts + ts / 2), Math.round(oy + z[1] * ts + ts / 2), ts, ts);
                });
            }
            // Backward compat: old blockedSubCells → wall
            if (scN > 1) {
                const legacySubWall = this.levelData?.map?.blockedSubCells ?? this.levelData?.blockedSubCells;
                if (Array.isArray(legacySubWall)) {
                    const subSz = ts / scN;
                    legacySubWall.forEach((z) => {
                        if (!Array.isArray(z) || !Number.isFinite(z[0]) || !Number.isFinite(z[1])) return;
                        _makeWallBody(Math.round(ox + z[0] * subSz + subSz / 2), Math.round(oy + z[1] * subSz + subSz / 2), subSz, subSz);
                    });
                }
            }

            // New zones format: process each zone type
            const _zoneTypes = ['wall', 'hole', 'sand', 'mud', 'water'];
            _zoneTypes.forEach((ztype) => {
                // Tile-level zones
                const arr = zonesMap[ztype];
                if (Array.isArray(arr)) {
                    arr.forEach((z) => {
                        if (!Array.isArray(z) || !Number.isFinite(z[0]) || !Number.isFinite(z[1])) return;
                        const col = Math.round(z[0]);
                        const row = Math.round(z[1]);
                        if (ztype === 'wall') {
                            _makeWallBody(Math.round(ox + col * ts + ts / 2), Math.round(oy + row * ts + ts / 2), ts, ts);
                        } else {
                            _injectTileType(col, row, ztype);
                        }
                    });
                }
                // Sub-cell zones
                if (scN > 1) {
                    const subArr = zoneSubs[ztype];
                    if (Array.isArray(subArr)) {
                        const subSz = ts / scN;
                        subArr.forEach((z) => {
                            if (!Array.isArray(z) || !Number.isFinite(z[0]) || !Number.isFinite(z[1])) return;
                            const gsc = Math.round(z[0]);
                            const gsr = Math.round(z[1]);
                            if (ztype === 'wall') {
                                _makeWallBody(Math.round(ox + gsc * subSz + subSz / 2), Math.round(oy + gsr * subSz + subSz / 2), subSz, subSz);
                            } else {
                                // Inject into parent tile cell for effect types
                                _injectTileType(Math.floor(gsc / scN), Math.floor(gsr / scN), ztype);
                            }
                        });
                    }
                }
            });
        } catch (e) { /* ignore zone errors */ }

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
        // - explicit size (width/height, or w/h) to avoid fullscreen stretch
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

        const resolveLayerSize = (entry, defaultW, defaultH, natW = 0, natH = 0) => {
            const e = (entry && typeof entry === 'object') ? entry : {};
            const rawW = Number(e.width ?? e.w ?? e.displayWidth ?? e.layerWidth);
            const rawH = Number(e.height ?? e.h ?? e.displayHeight ?? e.layerHeight);
            const hasW = Number.isFinite(rawW) && rawW > 0;
            const hasH = Number.isFinite(rawH) && rawH > 0;

            // Proportional: if only one dimension is set, derive the other from the natural aspect ratio
            if (hasW && !hasH && natW > 0 && natH > 0) {
                return { layerW: rawW, layerH: Math.round(rawW * natH / natW), fixedSize: true };
            }
            if (hasH && !hasW && natW > 0 && natH > 0) {
                return { layerW: Math.round(rawH * natW / natH), layerH: rawH, fixedSize: true };
            }

            return {
                layerW: hasW ? rawW : defaultW,
                layerH: hasH ? rawH : defaultH,
                fixedSize: hasW || hasH
            };
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

        // Optional per-layer transform: rotation (degrees, around the centre) and flipX / flipY
        const resolveLayerTransform = (entry) => {
            const e = (entry && typeof entry === 'object') ? entry : {};
            return { rotation: parseNumeric(e.rotation ?? e.angle, 0), flipX: e.flipX === true, flipY: e.flipY === true };
        };

        // (x, y, w, h) is the unrotated box; the image is centred in it so rotation pivots on its centre
        const setLayerBox = (img, x, y, w, h, tf) => {
            try { img.setOrigin(0.5, 0.5); } catch (e) { }
            img.setDisplaySize(w, h);
            img.setPosition(x + w / 2, y + h / 2);
            if (tf) {
                try { img.setAngle(tf.rotation || 0); } catch (e) { }
                try { img.setFlip(!!tf.flipX, !!tf.flipY); } catch (e) { }
            }
        };

        const placeLayerImage = (img, baseX, baseY, layerW, layerH, placement, ix, iy, fixedSize = false, transform = null) => {
            const x = baseX + placement.offsetX + placement.stepX * ix;
            const y = baseY + placement.offsetY + placement.stepY * iy;
            setLayerBox(img, x, y, layerW, layerH, transform);
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
                iy,
                fixedSize
            };
        };

        const applyLayerResize = (img, w, h) => {
            if (!img || !img.__bhLayerMeta) return;
            const m = img.__bhLayerMeta;
            if (m.fixedSize) return;
            const x = m.baseX + m.offsetX + m.stepX * m.ix;
            const y = m.baseY + m.offsetY + m.stepY * m.iy;
            setLayerBox(img, x, y, w, h, null);
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

                const createBgImage = (textureKey) => {
                    try {
                        const frame = this.textures.getFrame(textureKey, 0);
                        const natW = frame?.realWidth ?? frame?.width ?? 0;
                        const natH = frame?.realHeight ?? frame?.height ?? 0;
                        const layerSize = resolveLayerSize(entry, bgWidth, bgHeight, natW, natH);
                        const placement = resolveLayerPlacement(entry, layerSize.layerW, layerSize.layerH, CONFIG.width, CONFIG.height);
                        for (let iy = 0; iy < placement.countY; iy++) {
                            for (let ix = 0; ix < placement.countX; ix++) {
                                const img = this.add.image(worldX, worldY, textureKey);
                                placeLayerImage(img, worldX, worldY, layerSize.layerW, layerSize.layerH, placement, ix, iy, layerSize.fixedSize, resolveLayerTransform(entry));
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
                    const frame = this.textures.getFrame(fgKey, 0);
                    const natW = frame?.realWidth ?? frame?.width ?? 0;
                    const natH = frame?.realHeight ?? frame?.height ?? 0;
                    const layerSize = resolveLayerSize(entry, fgWidth, fgHeight, natW, natH);
                    const placement = resolveLayerPlacement(entry, layerSize.layerW, layerSize.layerH, CONFIG.width, CONFIG.height);

                    const fgAlpha = (entry && typeof entry === 'object' && typeof entry.parallaxFgAlpha === 'number')
                        ? Number(entry.parallaxFgAlpha)
                        : (typeof CONFIG.parallaxFgAlpha === 'number' ? Number(CONFIG.parallaxFgAlpha) : 0.92);

                    const parallaxFactor = (entry && typeof entry === 'object' && typeof entry.parallaxFgFactor === 'number')
                        ? entry.parallaxFgFactor
                        : parallaxFgDefault;

                    for (let iy = 0; iy < placement.countY; iy++) {
                        for (let ix = 0; ix < placement.countX; ix++) {
                            const img = this.add.image(worldX, worldY, fgKey);
                            placeLayerImage(img, worldX, worldY, layerSize.layerW, layerSize.layerH, placement, ix, iy, layerSize.fixedSize, resolveLayerTransform(entry));
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
        // Determine whether jump is enabled for this level.
        try {
            this.jumpEnabled = Boolean(
                (this.levelData && this.levelData.map && typeof this.levelData.map.jumpEnabled !== 'undefined') ? this.levelData.map.jumpEnabled
                : (this.levelData && typeof this.levelData.jumpEnabled !== 'undefined') ? this.levelData.jumpEnabled
                : true
            );
        } catch (e) { this.jumpEnabled = true; }
        // Number of gems required to unlock the exit for this level.
        // Priority: levelData.requiredGems || levelData.gemsRequired || levelData.map.requiredGems -> fallback CONFIG.gemsPerLevel
        this.requiredGems = Number(this.levelData?.requiredGems ?? this.levelData?.gemsRequired ?? this.levelData?.map?.requiredGems ?? CONFIG.gemsPerLevel) || Number(CONFIG.gemsPerLevel);
        // Preserve initial gem count so we can tell when "all gems" were collected
        this.initialGems = Number(this.gemsRemaining) || 0;
        // Flag set when exit(s) are unlocked/visible and can be used to complete the level
        this.exitUnlocked = false;

        // Controllo eventi all'avvio (es. warning immediati)
        this.checkAndShowLevelEvents && this.checkAndShowLevelEvents();
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
        this.spawnSpidersFromMap();
        this.spawnSnakesFromMap();

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

    update(time, delta) {
        // If the game is over, stop processing gameplay inputs/updates
        if (GAME_STATE.isGameOver) return;

        if (!this.player || !this.player.active) return;

        // Player movement
        let velocityX = 0;
        let velocityY = 0;

        // Touch input support: if TOUCH_INPUT is present, prefer it when non-zero
        try {
            const t = window.TOUCH_INPUT;
            if (t) {
                // t.x right positive, t.y down positive (joystick uses screen coords)
                // our game uses up = -1, down = +1; TOUCH_INPUT.y already maps that way
                if (Math.abs(Number(t.x) || 0) > 0.05) velocityX = Number(t.x);
                if (Math.abs(Number(t.y) || 0) > 0.05) velocityY = Number(t.y);
            }
        } catch (e) { }

        // Player 1 movement (arrow keys)
        if (this.cursors.left.isDown) velocityX = -1;
        if (this.cursors.right.isDown) velocityX = 1;
        if (this.cursors.up.isDown) velocityY = -1;
        if (this.cursors.down.isDown) velocityY = 1;

        // Player 2 movement (WASD) - compute separate velocity but do not override player1's
        let p2VelocityX = 0;
        let p2VelocityY = 0;
        try {
            if (this.p2Keys.a.isDown) p2VelocityX = -1;
            if (this.p2Keys.d.isDown) p2VelocityX = 1;
            if (this.p2Keys.w.isDown) p2VelocityY = -1;
            if (this.p2Keys.s.isDown) p2VelocityY = 1;
        } catch (e) { /* p2Keys may not exist */ }

        if (velocityX !== 0 || velocityY !== 0) {
            this.lastMoveDir = {
                x: Math.sign(velocityX),
                y: Math.sign(velocityY)
            };
        }

        if (typeof p2VelocityX !== 'undefined' && (p2VelocityX !== 0 || p2VelocityY !== 0)) {
            this.lastMoveDirP2 = {
                x: Math.sign(p2VelocityX),
                y: Math.sign(p2VelocityY)
            };
        }

        // Normalize diagonal movement
        if (velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707;
            velocityY *= 0.707;
        }
        if (p2VelocityX !== 0 && p2VelocityY !== 0) {
            p2VelocityX *= 0.707;
            p2VelocityY *= 0.707;
        }

        let speed = CONFIG.playerSpeed;
        if (this.playerSlowFactor && this.playerSlowFactor !== 1) {
            speed *= this.playerSlowFactor;
        }
        if (this.cartPowerActive) {
            speed *= 2;
        }

        try {
            const touch = (window && window.TOUCH_INPUT) ? window.TOUCH_INPUT : null;
            const touchJump = !!(touch && touch.jump);
            const p1JumpPressed = Array.isArray(this.p1JumpKeys) && this.p1JumpKeys.some(k => Phaser.Input.Keyboard.JustDown(k));
            if (p1JumpPressed || (touchJump && !this._lastTouchJump)) {
                this.attemptJumpFor(this.player, { inputX: velocityX, inputY: velocityY });
            }
            this._lastTouchJump = touchJump;
        } catch (e) { }
        try {
            const p2JumpPressed = Array.isArray(this.p2JumpKeys) && this.p2JumpKeys.some(k => Phaser.Input.Keyboard.JustDown(k));
            if (p2JumpPressed) this.attemptJumpFor(this.player2, { inputX: p2VelocityX, inputY: p2VelocityY });
        } catch (e) { }

        const p1Jumping = this.isJumpingPlayer(this.player);
        const p2Jumping = this.isJumpingPlayer(this.player2);

        // Check tile under player and trigger tile-specific effects (sand, water, mud, back)
        const tile = this.getTileAt(this.player.x, this.player.y);
        if (!p1Jumping && tile && tile.type) {
            // Sand slow
            if (tile.type === 'sand') {
            try {
                if (!this.playerSandActive) {
                    this.playerSandActive = true;
                    this.playerSlowFactor = Number(CONFIG.sandSlowFactor) || 0.5;
                    // create halo effect around player
                    try {
                        if (!this.playerSandHalo) {
                            const radius = Math.max((this.player.displayWidth || 16), (this.player.displayHeight || 16)) * 0.9;
                            this.playerSandHalo = this.add.circle(this.player.x, this.player.y, radius, 0xffeaa7, 0.32).setDepth(900);
                            try { this.playerSandHalo.setBlendMode(Phaser.BlendModes.ADD); } catch (e) { }
                        }
                    } catch (e) { }

                    // schedule timer to remove slow after configured duration
                    if (this.playerSandTimer) { try { this.playerSandTimer.remove(false); } catch (e) { } }
                    this.playerSandTimer = this.time.delayedCall(Number(CONFIG.sandSlowDuration) || 20000, () => {
                        this.playerSlowFactor = 1;
                        this.playerSandActive = false;
                        try { if (this.playerSandHalo) { this.playerSandHalo.destroy(); this.playerSandHalo = null; } } catch (e) { }
                        this.playerSandTimer = null;
                    }, [], this);
                }
            } catch (e) { /* ignore sand effect errors */ }
            }

            // Water: deduct dynamite once per tile when stepped on
            if (tile.type === 'water') {
                try {
                    // visual splash effect at player position
                    try {
                        // Only create a splash when the player is actively moving and not on cooldown
                        const moving = this.player && this.player.body && (Math.abs((this.player.body.velocity && this.player.body.velocity.x) || 0) > 10 || Math.abs((this.player.body.velocity && this.player.body.velocity.y) || 0) > 10);
                        if (moving && !this.playerWaterSplashCooldown) {
                            const sx = Math.round(this.player.x || (offsetX + x * CONFIG.tileSize + CONFIG.tileSize/2));
                            const sy = Math.round((this.player.y + ((this.player.displayHeight || CONFIG.playerSize || 16) / 2)));
                            // create a few small droplet rectangles at player's feet to simulate a single splash
                            const dropletQty = Phaser.Math.Between(4, 7);
                            for (let di = 0; di < dropletQty; di++) {
                                try {
                                    const w = Phaser.Math.Between(1, 2);
                                    const h = Phaser.Math.Between(4, 8);
                                    const drop = this.add.rectangle(sx, sy, w, h, 0x88ccff, 1).setDepth(910).setOrigin(0.5);
                                    drop.setAngle(Phaser.Math.Between(-40, 40));
                                    const angle = Phaser.Math.DegToRad(Phaser.Math.Between(-120, -60));
                                    const speed = Phaser.Math.Between(40, 100);
                                    const tx = Math.round(sx + Math.cos(angle) * speed);
                                    const ty = Math.round(sy + Math.sin(angle) * speed / 2);
                                    const dur = Phaser.Math.Between(300, 520);
                                    this.tweens.add({ targets: drop, x: tx, y: ty, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => { try { drop.destroy(); } catch (e) { } } });
                                } catch (e) { }
                            }
                            // subtle ripple ring at feet
                            try {
                                const ring = this.add.circle(sx, sy, 4, 0x3399ff, 0.28).setDepth(909);
                                this.tweens.add({ targets: ring, scaleX: 6, scaleY: 4, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => { try { ring.destroy(); } catch (e) { } } });
                            } catch (e) { }

                                // repeat the splash a few times (burst) and set cooldown so splash isn't continuous
                                const bursts = 3;
                                const interval = 120;
                                for (let b = 0; b < bursts; b++) {
                                    try {
                                        this.time.delayedCall(b * interval, () => {
                                            try {
                                                // recreate droplets for this burst
                                                const dropletQty2 = Phaser.Math.Between(3, 6);
                                                for (let di2 = 0; di2 < dropletQty2; di2++) {
                                                    try {
                                                        const w = Phaser.Math.Between(1, 2);
                                                        const h = Phaser.Math.Between(4, 8);
                                                        const drop2 = this.add.rectangle(sx, sy, w, h, 0x88ccff, 1).setDepth(910).setOrigin(0.5);
                                                        drop2.setAngle(Phaser.Math.Between(-40, 40));
                                                        const angle2 = Phaser.Math.DegToRad(Phaser.Math.Between(-120, -60));
                                                        const speed2 = Phaser.Math.Between(40, 100);
                                                        const tx2 = Math.round(sx + Math.cos(angle2) * speed2);
                                                        const ty2 = Math.round(sy + Math.sin(angle2) * speed2 / 2);
                                                        const dur2 = Phaser.Math.Between(300, 520);
                                                        this.tweens.add({ targets: drop2, x: tx2, y: ty2, alpha: 0, duration: dur2, ease: 'Cubic.easeOut', onComplete: () => { try { drop2.destroy(); } catch (e) { } } });
                                                    } catch (e) { }
                                                }
                                                try { const ring2 = this.add.circle(sx, sy, 4, 0x3399ff, 0.28).setDepth(909); this.tweens.add({ targets: ring2, scaleX: 6, scaleY: 4, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => { try { ring2.destroy(); } catch (e) { } } }); } catch (e) { }
                                            } catch (e) { }
                                        }, [], this);
                                    } catch (e) { }
                                }
                                this.playerWaterSplashCooldown = true;
                                try { this.time.delayedCall((bursts * interval) + 300, () => { this.playerWaterSplashCooldown = false; }, [], this); } catch (e) { this.playerWaterSplashCooldown = false; }
                        }
                    } catch (e) { }

                    if (!tile.waterTriggered) {
                        tile.waterTriggered = true;
                        GAME_STATE.dynamiteCount = Math.max(0, (Number(GAME_STATE.dynamiteCount) || 0) - 10);
                        this.refreshHudIcons && this.refreshHudIcons();
                        // small popup
                        this.showScorePopup && this.showScorePopup(-10, this.player.x, this.player.y);
                    }
                    // apply a persistent wet visual on the tile itself
                    try {
                        if (!tile.waterWet) {
                            // compute tile center coordinates
                            const gridX = Math.floor((this.player.x - (this.mapOffsetX || 0)) / (Number(CONFIG.tileSize) || 32));
                            const gridY = Math.floor((this.player.y - (this.mapOffsetY || 0)) / (Number(CONFIG.tileSize) || 32));
                            const worldX = (this.mapOffsetX || 0) + gridX * (Number(CONFIG.tileSize) || 32) + (Number(CONFIG.tileSize) || 32) / 2;
                            const worldY = (this.mapOffsetY || 0) + gridY * (Number(CONFIG.tileSize) || 32) + (Number(CONFIG.tileSize) || 32) / 2;
                            const wet = this.add.circle(worldX, worldY, Math.floor((Number(CONFIG.tileSize) || 32) * 0.42), 0x3399ff, 0.22).setDepth(Math.round(worldY) - 5);
                            tile.waterWet = true;
                            tile.wetSprite = wet;
                            const wetDur = Number(CONFIG.waterWetDuration) || 2500;
                            this.time.delayedCall(wetDur, () => {
                                try { if (wet && wet.destroy) wet.destroy(); } catch (e) { }
                                tile.waterWet = false;
                                tile.wetSprite = null;
                            }, [], this);
                        }
                    } catch (e) { }
                } catch (e) { }
            }

            // Mud: freeze player for 3 seconds
            if (tile.type === 'mud') {
                try {
                    // don't re-trigger mud while immune (grace period after free)
                    if (this.playerMudImmune) {
                        // skip effect while immune
                    } else if (!this.playerMudActive) {
                        this.playerMudActive = true;
                        // stop movement
                        try { if (this.player.body) { this.player.body.setVelocity(0, 0); this.player.body.setEnable(false); } } catch (e) { }
                        // small visual
                        try { if (!this.playerMudHalo) { this.playerMudHalo = this.add.circle(this.player.x, this.player.y, (this.player.displayWidth || 16) * 0.8, 0x663300, 0.28).setDepth(900); } } catch (e) { }
                        // mud splash visual at player's feet (brown droplets)
                        try {
                            const mx = Math.round(this.player.x || (offsetX + x * CONFIG.tileSize + CONFIG.tileSize/2));
                            const my = Math.round((this.player.y + ((this.player.displayHeight || CONFIG.playerSize || 16) / 2)));
                            const mudQty = Phaser.Math.Between(5, 8);
                            for (let mi = 0; mi < mudQty; mi++) {
                                try {
                                    const w = Phaser.Math.Between(1, 3);
                                    const h = Phaser.Math.Between(3, 7);
                                    const drop = this.add.rectangle(mx, my, w, h, 0x663300, 1).setDepth(900).setOrigin(0.5);
                                    drop.setAngle(Phaser.Math.Between(-50, 50));
                                    const angle = Phaser.Math.DegToRad(Phaser.Math.Between(-120, -60));
                                    const speed = Phaser.Math.Between(20, 60);
                                    const tx = Math.round(mx + Math.cos(angle) * speed);
                                    const ty = Math.round(my + Math.sin(angle) * speed / 2);
                                    const dur = Phaser.Math.Between(300, 650);
                                    this.tweens.add({ targets: drop, x: tx, y: ty, alpha: 0, duration: dur, ease: 'Cubic.easeOut', onComplete: () => { try { drop.destroy(); } catch (e) { } } });
                                } catch (e) { }
                            }
                            try { const ringMud = this.add.circle(mx, my, 3, 0x552200, 0.28).setDepth(899); this.tweens.add({ targets: ringMud, scaleX: 5, scaleY: 3, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => { try { ringMud.destroy(); } catch (e) { } } }); } catch (e) { }
                        } catch (e) { }
                        // clear any previous mud timers / countdowns
                        if (this.playerMudTimer) { try { this.playerMudTimer.remove(false); } catch (e) { } }
                        if (this.playerMudCountdownEvent) { try { this.playerMudCountdownEvent.remove(false); } catch (e) { } }
                        if (this.playerMudCountdown) { try { this.playerMudCountdown.destroy(); } catch (e) { } this.playerMudCountdown = null; }

                        const mudDur = Number(CONFIG.mudDuration) || 3000;
                        // create visual countdown in seconds above player
                        try {
                            const secs = Math.max(1, Math.ceil(mudDur / 1000));
                            this.playerMudCountdownSecs = secs;
                            this.playerMudCountdown = this.add.text(this.player.x, this.player.y - ((this.player.displayHeight || 16) * 0.9), String(this.playerMudCountdownSecs), { fontSize: '18px', fill: '#ffffff', fontFamily: GAME_FONT }).setOrigin(0.5).setDepth(901);
                            // update position each second and decrement
                            this.playerMudCountdownEvent = this.time.addEvent({
                                delay: 1000,
                                repeat: secs - 1,
                                callback: () => {
                                    try {
                                        this.playerMudCountdownSecs = Math.max(0, (this.playerMudCountdownSecs || 1) - 1);
                                        if (this.playerMudCountdown) this.playerMudCountdown.setText(String(this.playerMudCountdownSecs));
                                        // reposition to follow player
                                        try { if (this.playerMudCountdown && this.player) this.playerMudCountdown.setPosition(this.player.x, this.player.y - ((this.player.displayHeight || 16) * 0.9)); } catch (e) {}
                                    } catch (e) { }
                                },
                                callbackScope: this
                            });
                        } catch (e) { }

                        this.playerMudTimer = this.time.delayedCall(mudDur, () => {
                            this.playerMudActive = false;
                            try { if (this.player.body) this.player.body.setEnable(true); } catch (e) { }
                            try { if (this.playerMudHalo) { this.playerMudHalo.destroy(); this.playerMudHalo = null; } } catch (e) { }
                            // cleanup countdown visuals/events
                            try { if (this.playerMudCountdownEvent) { this.playerMudCountdownEvent.remove(false); this.playerMudCountdownEvent = null; } } catch (e) { }
                            try { if (this.playerMudCountdown) { this.playerMudCountdown.destroy(); this.playerMudCountdown = null; } } catch (e) { }
                            this.playerMudTimer = null;
                            // give a short immunity so player can move off mud without being retriggered
                            try { this.playerMudImmune = true; } catch (e) { }
                            try {
                                if (this.playerMudImmuneTimer) { try { this.playerMudImmuneTimer.remove(false); } catch (e) { } }
                            } catch (e) { }
                            try {
                                this.playerMudImmuneTimer = this.time.delayedCall(1000, () => {
                                    try { this.playerMudImmune = false; } catch (e) { }
                                    try { this.playerMudImmuneTimer = null; } catch (e) { }
                                }, [], this);
                            } catch (e) { }
                        }, [], this);
                    }
                    // apply a visible mud stain to the tile so puddle effect is visible on the map
                    try {
                        if (!tile.mudApplied) {
                            const gridX = Math.floor((this.player.x - (this.mapOffsetX || 0)) / (Number(CONFIG.tileSize) || 32));
                            const gridY = Math.floor((this.player.y - (this.mapOffsetY || 0)) / (Number(CONFIG.tileSize) || 32));
                            const worldX = (this.mapOffsetX || 0) + gridX * (Number(CONFIG.tileSize) || 32) + (Number(CONFIG.tileSize) || 32) / 2;
                            const worldY = (this.mapOffsetY || 0) + gridY * (Number(CONFIG.tileSize) || 32) + (Number(CONFIG.tileSize) || 32) / 2;
                            const stain = this.add.rectangle(worldX, worldY, Math.floor((Number(CONFIG.tileSize) || 32) * 0.9), Math.floor((Number(CONFIG.tileSize) || 32) * 0.9), 0x552200, 0.28).setOrigin(0.5).setDepth(Math.round(worldY) - 6);
                            tile.mudApplied = true;
                            tile.mudSprite = stain;
                            const stainDur = (Number(CONFIG.mudDuration) || 3000) * 2;
                            this.time.delayedCall(stainDur, () => {
                                try { if (stain && stain.destroy) stain.destroy(); } catch (e) { }
                                tile.mudApplied = false;
                                tile.mudSprite = null;
                            }, [], this);
                        }
                    } catch (e) { }
                } catch (e) { }
            }

            // Back level token: return to previous level
            if (tile.type === 'back') {
                try {
                    const forcedBackLevel = Number.isFinite(Number(tile.backTargetLevelIndex)) ? Number(tile.backTargetLevelIndex) : null;
                    this.goToPreviousLevel(forcedBackLevel);
                } catch (e) { }
            }
        }

        // Apply velocities, with sliding when rain is active
        try {
            if (!p1Jumping) {
                const desiredVX = velocityX * speed;
                const desiredVY = velocityY * speed;
                if (this.rainActive && this.currentRain) {
                    const intensity = Number(this.currentRain.intensity) || 1;
                    let traction = 0.35 / intensity; // higher intensity -> lower traction
                    traction = Phaser.Math.Clamp(traction, 0.03, 1);
                    const curVX = (this.player.body && this.player.body.velocity) ? this.player.body.velocity.x : 0;
                    const curVY = (this.player.body && this.player.body.velocity) ? this.player.body.velocity.y : 0;
                    const newVX = Phaser.Math.Linear(curVX, desiredVX, traction);
                    const newVY = Phaser.Math.Linear(curVY, desiredVY, traction);
                    this.player.setVelocity(newVX, newVY);
                } else {
                    this.player.setVelocity(desiredVX, desiredVY);
                }
            }
        } catch (e) { try { if (!p1Jumping) this.player.setVelocity(velocityX * speed, velocityY * speed); } catch (e2) { } }

        // apply velocity for player2 if present (same sliding effect)
        try {
            if (this.player2 && this.player2.active && !p2Jumping) {
                const desired2X = p2VelocityX * speed;
                const desired2Y = p2VelocityY * speed;
                if (this.rainActive && this.currentRain) {
                    const intensity2 = Number(this.currentRain.intensity) || 1;
                    let traction2 = 0.35 / intensity2;
                    traction2 = Phaser.Math.Clamp(traction2, 0.03, 1);
                    const cur2X = (this.player2.body && this.player2.body.velocity) ? this.player2.body.velocity.x : 0;
                    const cur2Y = (this.player2.body && this.player2.body.velocity) ? this.player2.body.velocity.y : 0;
                    const new2X = Phaser.Math.Linear(cur2X, desired2X, traction2);
                    const new2Y = Phaser.Math.Linear(cur2Y, desired2Y, traction2);
                    this.player2.setVelocity(new2X, new2Y);
                } else {
                    this.player2.setVelocity(desired2X, desired2Y);
                }
            }
        } catch (e) { }

        // Update depth ordering based on Y so player appears behind objects when above them
        // and in front when below them (depth = y). This gives a simple top-down layering.
        try {
            if (this.updateLayerDepths) this.updateLayerDepths();
        } catch (e) { }

        try { this.updateEffectFollowers(); } catch (e) { }

        // Update floating player labels (1P / 2P) so they follow each player
        try {
            const labelOffsetY = -6;
            if (this.playerLabel) {
                if (this.player && this.player.active) {
                    const pHeight = (this.player.displayHeight || Number(CONFIG.playerSize) || OBJECT_NATIVE_SIZE);
                    const lx = Math.round(this.player.x - 10);
                    const ly = Math.round(this.player.y - (pHeight / 2) + labelOffsetY);
                    this.playerLabel.setPosition(lx, ly);
                    this.playerLabel.setVisible(true);
                } else {
                    try { this.playerLabel.setVisible(false); } catch (e) { }
                }
            }

            if (this.player2Label) {
                if (this.player2 && this.player2.active) {
                    const p2Height = (this.player2.displayHeight || Number(CONFIG.playerSize) || OBJECT_NATIVE_SIZE);
                    const lx2 = Math.round(this.player2.x + 10);
                    const ly2 = Math.round(this.player2.y - (p2Height / 2) + labelOffsetY);
                    this.player2Label.setPosition(lx2, ly2);
                    this.player2Label.setVisible(true);
                } else {
                    try { this.player2Label.setVisible(false); } catch (e) { }
                }
            }
        } catch (e) { /* ignore label update errors */ }

        // Keep sand halo positioned on the player while effect active
        if (this.playerSandHalo && this.player && this.player.active) {
            try { this.playerSandHalo.setPosition(this.player.x, this.player.y); } catch (e) { }
        }

        // Keep helmet aura positioned on the player while effect active
        if (this.helmetAura && this.player && this.player.active) {
            try { this.helmetAura.setPosition(this.player.x, this.player.y); } catch (e) { }
        }

        // While helmet active, proactively destroy falling rocks within helmet radius
        if (this.helmetActive && this.player && this.player.active && this.rocks) {
            try {
                const tiles = Number(CONFIG.helmetRadiusTiles) || 1.6;
                const radius = tiles * (Number(CONFIG.tileSize) || 64);
                const rocks = (this.rocks && this.rocks.children && this.rocks.children.entries) ? this.rocks.children.entries.slice() : [];
                let destroyedAny = false;
                for (let i = 0; i < rocks.length; i++) {
                    const rk = rocks[i];
                    if (!rk || !rk.active) continue;
                    // target falling or destructible rocks
                    if (!rk.getData) continue;
                    const isFallingRk = !!rk.getData('isFalling');
                    const destructible = !!rk.getData('destructible');
                    if (!isFallingRk && !destructible) continue;
                    const dx = (rk.x || 0) - (this.player.x || 0);
                    const dy = (rk.y || 0) - (this.player.y || 0);
                    if (Math.hypot(dx, dy) <= radius) {
                        destroyedAny = true;
                        try { this.addScore(5, rk.x, rk.y); } catch (e) { }
                        try {
                            const size = rk.getData && rk.getData('size') ? rk.getData('size') : 'medium';
                            try { this.createDustPuff(rk.x, rk.y, (size === 'small' ? 0.8 : (size === 'large' ? 1.4 : 1))); } catch (e) { }
                            try { this.emitStoneShardBurst(rk.x, rk.y, size); } catch (e) { }
                        } catch (e) { }
                        try { rk.destroy(); } catch (e) { }
                    }
                }
                if (destroyedAny) {
                    try { if (this.sound) this.sound.play('explosion_sfx', { volume: 0.45 }); } catch (e) { }
                    try { this.createExplosionAt(this.player.x, this.player.y); } catch (e) { }
                }
            } catch (e) { /* ignore runtime errors in helmet scan */ }
        }

    // Directional walk animations: down/front, up/back, right/right, left/right+flipX
    const isMoving = velocityX !== 0 || velocityY !== 0;
    const isMovingP2 = (typeof p2VelocityX !== 'undefined') ? (p2VelocityX !== 0 || p2VelocityY !== 0) : false;
        if (isMoving) {
            const stepInterval = 180;
            if (!this.lastStepSoundTime || (this.time.now - this.lastStepSoundTime) >= stepInterval) {
                this.sound.play('step_sfx', { volume: 0.34 });
                this.lastStepSoundTime = this.time.now;
            }
        }
        if (isMoving) {
            let nextFacing = this.playerFacing || 'front';
            if (Math.abs(velocityX) >= Math.abs(velocityY)) {
                // Horizontal intent always uses lateral row (right/left),
                // even when the previous vertical facing was 'back'.
                nextFacing = velocityX > 0 ? 'right' : 'left';
            } else {
                nextFacing = velocityY < 0 ? 'back' : 'front';
                this.playerVerticalFacing = nextFacing;
            }
            this.playerFacing = nextFacing;

            let animKey = 'player_front_walk';
            if (nextFacing === 'back') animKey = 'player_back_walk';
            else if (nextFacing === 'back_right' || nextFacing === 'back_left') animKey = 'player_back_walk';
            else if (nextFacing === 'right' || nextFacing === 'left') animKey = 'player_right_walk';

            if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== animKey) {
                this.player.anims.play(animKey, true);
            }
            this.player.setFlipX(nextFacing === 'left');

            // Slight tilt on diagonal movement for row1(front) and row3(up) animations.
            const diagonalTiltDeg = 8;
            const isDiagonalMove = Math.abs(velocityX) > 0 && Math.abs(velocityY) > 0;
            const usesTiltRow = animKey === 'player_front_walk' || animKey === 'player_back_walk';
            const targetAngle = (isDiagonalMove && usesTiltRow)
                ? (velocityX > 0 ? diagonalTiltDeg : -diagonalTiltDeg)
                : 0;
            this.player.setAngle(targetAngle);
        } else {
            const currentAnimKey = this.player.anims.currentAnim?.key;
            if (this.player.anims.isPlaying && (currentAnimKey === 'player_front_walk' || currentAnimKey === 'player_back_walk' || currentAnimKey === 'player_right_walk')) {
                this.player.anims.stop();
            }
            this.player.setAngle(0);

            const facing = this.playerFacing || 'front';
            if (facing === 'back') {
                if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== 'player_back_idle') {
                    this.player.anims.play('player_back_idle', true);
                }
                this.player.setFlipX(false);
            } else if (facing === 'back_right') {
                if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== 'player_back_idle') {
                    this.player.anims.play('player_back_idle', true);
                }
                this.player.setFlipX(false);
            } else if (facing === 'back_left') {
                if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== 'player_back_idle') {
                    this.player.anims.play('player_back_idle', true);
                }
                this.player.setFlipX(false);
            } else if (facing === 'right') {
                if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== 'player_side_idle') {
                    this.player.anims.play('player_side_idle', true);
                }
                this.player.setFlipX(false);
            } else if (facing === 'left') {
                if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== 'player_side_idle') {
                    this.player.anims.play('player_side_idle', true);
                }
                this.player.setFlipX(true);
            } else {
                if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== 'player_front_idle') {
                    this.player.anims.play('player_front_idle', true);
                }
                this.player.setFlipX(false);
            }
        }

        // Player2 animations (mirror of player but separate state)
        try {
            if (this.player2 && this.player2.active) {
                if (isMovingP2) {
                    let nextFacingP2 = this.player2Facing || 'front';
                    if (Math.abs(p2VelocityX) >= Math.abs(p2VelocityY)) {
                        nextFacingP2 = p2VelocityX > 0 ? 'right' : 'left';
                    } else {
                        nextFacingP2 = p2VelocityY < 0 ? 'back' : 'front';
                        this.player2VerticalFacing = nextFacingP2;
                    }
                    this.player2Facing = nextFacingP2;

                    let animKey2 = 'player_front_walk';
                    if (nextFacingP2 === 'back') animKey2 = 'player_back_walk';
                    else if (nextFacingP2 === 'back_right' || nextFacingP2 === 'back_left') animKey2 = 'player_back_walk';
                    else if (nextFacingP2 === 'right' || nextFacingP2 === 'left') animKey2 = 'player_right_walk';

                    if (!this.player2.anims.isPlaying || this.player2.anims.currentAnim?.key !== animKey2) {
                        this.player2.anims.play(animKey2, true);
                    }
                    this.player2.setFlipX(nextFacingP2 === 'left');

                    const diagonalTiltDeg2 = 8;
                    const isDiagonalMove2 = Math.abs(p2VelocityX) > 0 && Math.abs(p2VelocityY) > 0;
                    const usesTiltRow2 = animKey2 === 'player_front_walk' || animKey2 === 'player_back_walk';
                    const targetAngle2 = (isDiagonalMove2 && usesTiltRow2)
                        ? (p2VelocityX > 0 ? diagonalTiltDeg2 : -diagonalTiltDeg2)
                        : 0;
                    this.player2.setAngle(targetAngle2);
                } else {
                    const currentAnimKey2 = this.player2.anims.currentAnim?.key;
                    if (this.player2.anims.isPlaying && (currentAnimKey2 === 'player_front_walk' || currentAnimKey2 === 'player_back_walk' || currentAnimKey2 === 'player_right_walk')) {
                        this.player2.anims.stop();
                    }
                    this.player2.setAngle(0);

                    const facing2 = this.player2Facing || 'front';
                    if (facing2 === 'back') {
                        if (!this.player2.anims.isPlaying || this.player2.anims.currentAnim?.key !== 'player_back_idle') {
                            this.player2.anims.play('player_back_idle', true);
                        }
                        this.player2.setFlipX(false);
                    } else if (facing2 === 'back_right') {
                        if (!this.player2.anims.isPlaying || this.player2.anims.currentAnim?.key !== 'player_back_idle') {
                            this.player2.anims.play('player_back_idle', true);
                        }
                        this.player2.setFlipX(false);
                    } else if (facing2 === 'back_left') {
                        if (!this.player2.anims.isPlaying || this.player2.anims.currentAnim?.key !== 'player_back_idle') {
                            this.player2.anims.play('player_back_idle', true);
                        }
                        this.player2.setFlipX(false);
                    } else if (facing2 === 'right') {
                        if (!this.player2.anims.isPlaying || this.player2.anims.currentAnim?.key !== 'player_side_idle') {
                            this.player2.anims.play('player_side_idle', true);
                        }
                        this.player2.setFlipX(false);
                    } else if (facing2 === 'left') {
                        if (!this.player2.anims.isPlaying || this.player2.anims.currentAnim?.key !== 'player_side_idle') {
                            this.player2.anims.play('player_side_idle', true);
                        }
                        this.player2.setFlipX(true);
                    } else {
                        if (!this.player2.anims.isPlaying || this.player2.anims.currentAnim?.key !== 'player_front_idle') {
                            this.player2.anims.play('player_front_idle', true);
                        }
                        this.player2.setFlipX(false);
                    }
                }
            }
        } catch (e) { }

        // Shoot dynamite (keyboard X or SPACE OR touch action button)
        try {
            const touch = (window && window.TOUCH_INPUT) ? window.TOUCH_INPUT : null;
            const touchAction = !!(touch && touch.action);
            const p1ShootKeyA = this.keys && this.keys.x;
            const p1ShootKeyB = this.keys && this.keys.space;
            if (!p1Jumping && ((p1ShootKeyA && Phaser.Input.Keyboard.JustDown(p1ShootKeyA)) || (p1ShootKeyB && Phaser.Input.Keyboard.JustDown(p1ShootKeyB)) || (touchAction && !this._lastTouchAction))) {
                this.shootDynamite();
            }
            // remember last touch action state for edge detection
            this._lastTouchAction = touchAction;
        } catch (e) {
            // If anything goes wrong reading touch input, fall back to keyboard only
            try {
                if (!p1Jumping && ((this.keys && this.keys.x && Phaser.Input.Keyboard.JustDown(this.keys.x)) || (this.keys && this.keys.space && Phaser.Input.Keyboard.JustDown(this.keys.space)))) {
                    this.shootDynamite();
                }
            } catch (e2) { /* ignore */ }
        }

        this.updateCompanionPosition();

        // Toggle miner headlamp when room light is off
        if (this.keys && this.keys.l && Phaser.Input.Keyboard.JustDown(this.keys.l)) {
            this.toggleHeadlamp();
        }

        // Action keys: try placing plank first, otherwise open nearby door when action pressed
        try {
            const p1ActionPressed = Array.isArray(this.p1ActionKeys) && this.p1ActionKeys.some(k => Phaser.Input.Keyboard.JustDown(k));
            if (p1ActionPressed && !p1Jumping) {
                const used = this.placePlankFor(this.player);
                if (!used) {
                    const doors = this.doors?.children?.entries || [];
                    for (const door of doors) {
                        if (!door || !door.active) continue;
                        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);
                        if (dist <= CONFIG.tileSize * 1.1) {
                            this.tryOpenDoor(this.player, door);
                            break;
                        }
                    }
                }
            }
        } catch (e) { }
        try {
            const p2ActionPressed = Array.isArray(this.p2ActionKeys) && this.p2ActionKeys.some(k => Phaser.Input.Keyboard.JustDown(k));
            if (p2ActionPressed && !p2Jumping) {
                const used2 = this.placePlankFor(this.player2);
                if (!used2) {
                    const doors = this.doors?.children?.entries || [];
                    for (const door of doors) {
                        if (!door || !door.active) continue;
                        const dist = Phaser.Math.Distance.Between(this.player2.x, this.player2.y, door.x, door.y);
                        if (dist <= CONFIG.tileSize * 1.1) {
                            this.tryOpenDoor(this.player2, door);
                            break;
                        }
                    }
                }
            }
        } catch (e) { }
        // Check if on hole
        if (!p1Jumping && tile && tile.type === 'hole') {
            this.hitHole();
        }

        // Check if on back tile: return to previous level
        if (!p1Jumping && tile && tile.type === 'back') {
            const forcedBackLevel = Number.isFinite(Number(tile.backTargetLevelIndex)) ? Number(tile.backTargetLevelIndex) : null;
            this.goToPreviousLevel(forcedBackLevel);
        }

        // Check proximity to doors for opening
        this.checkDoorProximity();
        // Check proximity to holes for placing planks (show action hint if player has planks)
        this.checkHoleProximity();
        // Check if any boulders are falling into holes
        this.checkBouldersInHoles();

        // Update headlamp cone to follow player/camera direction
        if (this.isRoomDark && this.headlampEnabled) {
            this.updateHeadlampCone();
        }

        // Ghost visual perspective update (foreground ghosts look bigger)
        this.updateGhostPerspective();
        this.updateBatPerspective();
        this.updateSpiders();
        this.updateSnakes();

        // Dynamic boulders roll and slow down over time
        if (!this.dynamicBouldersRuntimeDisabled) {
            try {
                this.updateRollingBoulders(delta);
            } catch (error) {
                console.error('Dynamic boulders runtime disabled due to update error:', error);
                this.dynamicBouldersRuntimeDisabled = true;
                if (this.boulderTimer) {
                    this.boulderTimer.remove();
                    this.boulderTimer = null;
                }
            }
        }
        this.updateObjectivePointerUI();

    // Foreground removed: no per-frame FG adjustments needed.

        // Update UI
        this.updateUITexts();
    }
}

    // methods grouped by topic in kit/gameplay/scene/*.js
    [createMapMixin, createEffectsMixin, createPlayerMixin, createItemsMixin, createLevelflowMixin, createRocksMixin, createDynamiteMixin, createHudMixin, createCollisionsMixin, createEnemiesCommonMixin, createEnemiesBatMixin, createEnemiesGhostMixin, createEnemiesSpiderMixin, createEnemiesSnakeMixin].forEach((createMixin) => {
        const Mixin = createMixin(deps);
        Object.getOwnPropertyNames(Mixin.prototype).forEach((name) => {
            if (name === 'constructor') return;
            if (Object.prototype.hasOwnProperty.call(GameScene.prototype, name)) throw new Error(`GameScene: metodo duplicato ${name}`);
            Object.defineProperty(GameScene.prototype, name, Object.getOwnPropertyDescriptor(Mixin.prototype, name));
        });
    });

    return GameScene;
}
