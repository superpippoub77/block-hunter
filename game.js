// ============================================================================
// BLOCKHUNTER - Arcade Game in Phaser 3
// ============================================================================

import { OBJECT_FRAMES } from './data/module/constants.js';

// Global configuration (populated from /data/config.json)
const CONFIG = {};

// Game state (populated from /data/config.json)
const GAME_STATE = {};


const GAME_FONT = '"Press Start 2P"';
// Translations
const TRANSLATIONS = {};
// Load configuration from /data/config.json
// Rimosso: la configurazione viene caricata solo tramite loadConfigAndStartGame

// Native asset sizes (used to compute scale when adapting to CONFIG)
const TILE_NATIVE_WIDTH = 64; // tiles spritesheet native width per tile frame
const TILE_NATIVE_HEIGHT = 48;
const OBJECT_NATIVE_SIZE = 64; // objects.png frames are 64x64

// Load persistent config if present (optional: can be merged after loadConfig)
function mergeLocalConfig() {
    try {
        const saved = localStorage.getItem('blockHunterConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.tileSize) CONFIG.tileSize = parsed.tileSize;
            if (parsed.objectSize) CONFIG.objectSize = parsed.objectSize;
            if (parsed.playerSize) CONFIG.playerSize = parsed.playerSize;
            // Backwards compatibility: support old 'objectScale' saved values
            else if (parsed.objectScale) CONFIG.objectSize = Math.round(parsed.objectScale * OBJECT_NATIVE_SIZE);
        }
    } catch (e) {
        // ignore localStorage errors
    }
}


function loadTranslations(lang, callback) {
    fetch(`data/dic/${lang}.json`)
        .then(res => res.json())
        .then(data => {
            TRANSLATIONS[lang] = data;
            if (typeof callback === 'function') callback(data);
        })
        .catch(() => {
            TRANSLATIONS[lang] = {};
            if (typeof callback === 'function') callback({});
        });
}



// Utility: draw a rounded panel (semi-transparent fill + black border) around a text object
function drawTextPanel(graphics, textObj, opts = {}) {
    const paddingX = opts.paddingX || 12;
    const paddingY = opts.paddingY || 6;
    const radius = opts.radius || 6;

    graphics.clear();
    if (!textObj || !textObj.text) return;

    const width = (textObj.width || 0) + paddingX * 2;
    const height = (textObj.height || 0) + paddingY * 2;
    const x = textObj.x - width * (textObj.originX || 0.5);
    const y = textObj.y - height * (textObj.originY || 0.5);

    // semi-transparent dark fill
    graphics.fillStyle(0x000000, 0.35);
    if (graphics.fillRoundedRect) {
        graphics.fillRoundedRect(x, y, width, height, radius);
    } else {
        graphics.fillRect(x, y, width, height);
    }

    // black border
    graphics.lineStyle(2, 0x000000, 1);
    if (graphics.strokeRoundedRect) {
        graphics.strokeRoundedRect(x, y, width, height, radius);
    } else {
        graphics.strokeRect(x, y, width, height);
    }

    // Ensure panel sits behind the text
    try {
        graphics.setDepth((textObj.depth || 0) - 1);
    } catch (e) {
        // ignore if depth cannot be set
    }
}

function getTextureMaxNumericFrame(scene, textureKey, fallback = 0) {
    try {
        const texture = scene?.textures?.get(textureKey);
        if (!texture) return fallback;

        const names = texture.getFrameNames ? texture.getFrameNames() : [];
        const numericFrames = names
            .map((name) => Number(name))
            .filter((value) => Number.isFinite(value));

        if (numericFrames.length > 0) {
            return Math.max(...numericFrames);
        }

        const frameTotal = Number(texture.frameTotal);
        if (Number.isFinite(frameTotal) && frameTotal > 1) {
            return Math.max(0, frameTotal - 1);
        }
    } catch (e) {
        // ignore and use fallback
    }

    return fallback;
}

function playLoopAudioSafely(scene, key, volume = 0.3) {
    const sound = scene?.sound;
    if (!sound) return;

    const playNow = () => {
        const existing = sound.get(key);
        if (existing) {
            if (!existing.isPlaying) {
                existing.play({ loop: true, volume });
            }
            return;
        }
        sound.play(key, { loop: true, volume });
    };

    if (sound.locked) {
        sound.once('unlocked', () => {
            try {
                playNow();
            } catch (e) {
                // ignore autoplay race errors
            }
        });
        return;
    }

    try {
        const ctx = sound.context;
        if (ctx && ctx.state === 'suspended' && ctx.resume) {
            ctx.resume().catch(() => { });
        }
    } catch (e) {
        // ignore
    }

    playNow();
}

// Level configurations
const LEVEL_CONFIG = {
    globalRules: {
        staticRocks: {
            sizes: ["small", "medium", "large"],
            randomSpawn: true,
            generateShards: false
        },
        dynamicBoulders: {
            sizes: {
                small: { shards: [0, 1] },
                medium: { shards: [2, 3] },
                large: { shards: [4, 6] }
            }
        }
    },
    levels: [
        { id: "1.0", staticRocks: true, dynamicBoulders: false, speed: 1, escapeRoute: false },
        { id: "1.1", staticRocks: true, dynamicBoulders: false, speed: 2, escapeRoute: false },
        { id: "1.2", staticRocks: true, dynamicBoulders: false, speed: 3, escapeRoute: false },
        { id: "1.3", staticRocks: true, dynamicBoulders: false, speed: 4, escapeRoute: true },
        { id: "1.4", staticRocks: true, dynamicBoulders: false, speed: 5, escapeRoute: true },
        { id: "2.0", staticRocks: true, dynamicBoulders: { directions: ["top"], sizes: ["medium"] }, speed: 1, escapeRoute: false },
        { id: "2.1", staticRocks: true, dynamicBoulders: { directions: ["bottom"], sizes: ["medium"] }, speed: 2, escapeRoute: false },
        { id: "2.2", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom"], sizes: ["medium"] }, speed: 1, escapeRoute: false },
        { id: "2.3", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom"], sizes: ["medium", "large"] }, speed: 2, escapeRoute: true },
        { id: "2.4", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom"], sizes: ["large"] }, speed: 3, escapeRoute: true },
        { id: "3.0", staticRocks: true, dynamicBoulders: { directions: ["right"], sizes: ["medium"] }, speed: 1, escapeRoute: false },
        { id: "3.1", staticRocks: true, dynamicBoulders: { directions: ["left"], sizes: ["medium"] }, speed: 2, escapeRoute: false },
        { id: "3.2", staticRocks: true, dynamicBoulders: { directions: ["left", "right"], sizes: ["medium"] }, speed: 1, escapeRoute: false },
        { id: "3.3", staticRocks: true, dynamicBoulders: { directions: ["left", "right"], sizes: ["medium", "large"] }, speed: 2, escapeRoute: true },
        { id: "3.4", staticRocks: true, dynamicBoulders: { directions: ["left", "right"], sizes: ["large"] }, speed: 3, escapeRoute: true },
        { id: "4.0", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["medium"] }, speed: 1, escapeRoute: true },
        { id: "4.1", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["medium", "large"] }, speed: 2, escapeRoute: true },
        { id: "4.2", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large"] }, speed: 3, escapeRoute: true },
        { id: "4.3", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large", "small"] }, speed: 4, escapeRoute: true },
        { id: "4.4", staticRocks: true, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large"] }, speed: 5, escapeRoute: true },
        { id: "5.0", staticRocks: { dynamicSize: true }, dynamicBoulders: false, speed: 1, escapeRoute: false },
        { id: "5.1", staticRocks: { dynamicSize: true }, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["medium", "large"] }, speed: 2, escapeRoute: true },
        { id: "5.2", staticRocks: { dynamicSize: true }, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large"] }, speed: 3, escapeRoute: true },
        { id: "5.3", staticRocks: { dynamicSize: true, rotation: true }, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large"] }, speed: 4, escapeRoute: true },
        { id: "5.4", staticRocks: { dynamicSize: true, chaotic: true }, dynamicBoulders: { directions: ["top", "bottom", "left", "right"], sizes: ["large", "small"] }, speed: 5, escapeRoute: true }
    ]
};

// Helper function to get level file number from level index
// Level index 0-4 -> level10-14, 5-9 -> level20-24, etc.
function getLevelFileName(levelIndex) {
    const majorLevel = Math.floor(levelIndex / 5) + 1;
    const minorLevel = levelIndex % 5;
    return `level${majorLevel}${minorLevel}`;
}

function getLevelMasterNumber(levelIndex) {
    return Math.floor(levelIndex / 5) + 1;
}



// ============================================================================
// PRELOAD SCENE
// ============================================================================
class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }

    // Load title, background, tiles, objects, and all level JSON files
    preload() {
        this.add.rectangle(400, 300, 800, 600, 0x000000, 1).setDepth(0);
        const loadingText = this.add.text(400, 300, 'loading...', {
            fontSize: '28px',
            fill: '#ffffff',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(10);

        this.load.on('complete', () => {
            if (loadingText && loadingText.destroy) {
                loadingText.destroy();
            }
        });

        this.load
            .image('title', 'images/title.png')
            .image('subtitle', 'images/subtitle.png')
            .image('explorer', 'images/explorer.png')
            .image('title_explosion', 'images/title_explosion.png')
            .audio('intro_bgm', 'data/music/intro.mp3')
            .audio('game_bgm', 'data/music/game.mp3')
            .audio('step_sfx', 'data/music/step.mp3')
            .audio('stone_sfx', 'data/music/stone.mp3')
            .audio('explosion_sfx', 'data/music/explosion.mp3')
            .audio('gem_sfx', 'data/music/gem.mp3')
            .audio('level_completed_sfx', 'data/music/level_completed.mp3')
            .audio('coin_sfx', 'data/music/coin.mp3')
            .audio('select_sfx', 'data/music/select.mp3')
            .audio('ghost_sfx', 'data/music/ghost.mp3')
            .image('bg', 'images/attract_bg.png')
            .image('game_bg', 'images/game_bg.png')
            // Load flags sprite (8 flags: it, fr, de, en, us, ja, es, zh - 64x32 each)
            .spritesheet('flags', 'images/flags.png', {
                frameWidth: 64,
                frameHeight: 32
            })
            // Load tiles sprite (6 tiles: wall, hole, sand, floor, stone, hole2 - 64x48 each)
            .spritesheet('tiles', 'images/tiles.png', {
                frameWidth: 64,
                frameHeight: 64
            })
            // Load wall sprite sheet (1 row x 7 columns, 64x64 each frame)
            .spritesheet('wall_tiles', 'images/wall.png', {
                frameWidth: 64,
                frameHeight: 64
            })
            // Load objects sprite (4x4 matrix = 16 objects)
            // Row 1: dynamite, heart, stone, player
            // Row 2: dynamite_chest, door, gem, stones
            // Row 3: key, sand_pile, ghost, pepita
            // Row 4: skull...wall, hole1, hole2, explosion
            .spritesheet('objects', 'images/obj_game.png', {
                frameWidth: 64,
                frameHeight: 64
            })
            // Front walking animation spritesheet (1 row, 7 frames, 172x135 each)
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
            // Bat flying animation spritesheet (1 row, 6 frames)
            .spritesheet('bat', 'images/batpng.png', {
                frameWidth: 64,
                frameHeight: 64
            })
            // Ghost animation spritesheet (1 row, 5 frames)
            .spritesheet('ghost', 'images/ghost.png', {
                frameWidth: 64,
                frameHeight: 64
            });

        // Load all level JSON files (50 levels)
        // Carica solo i livelli con sottolivello 0-4 per ogni decade
        for (let decade = 1; decade <= 5; decade++) {
            for (let sub = 0; sub <= 4; sub++) {
                const num = decade * 10 + sub;
                this.load.json(`level${num}`, `data/level/level${num}.json`);
            }
        }

        // Load background images for each master level (level1.png, level2.png, ...)
        for (let master = 1; master <= 5; master++) {
            this.load.image(`game_bg_${master}`, `images/level${master}.png`);
        }

        // Create graphics for remaining assets
        this.createAssets();
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
        loadTranslations(lang, () => {
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

            this.scene.start('AttractScene');
        });
    }
}

// ============================================================================
// ATTRACT SCENE
// ============================================================================
class AttractScene extends Phaser.Scene {
    constructor() {
        super('AttractScene');
    }

    create() {
        const gameMusic = this.sound.get('game_bgm');
        if (gameMusic && gameMusic.isPlaying) {
            gameMusic.stop();
        }

        this.languages = ['it', 'fr', 'de', 'en', 'us', 'ja', 'es', 'zh'];
        this.currentLangIndex = 0;
        GAME_STATE.language = this.languages[0];

        // Intro music before gameplay
        playLoopAudioSafely(this, 'intro_bgm', 0.35);

        // Background image
        this.add.image(400, 300, 'bg').setDisplaySize(800, 600);
        this.add.rectangle(400, 300, 800, 600, 0x000000, 0.35).setDepth(0.1);

        // Title image (loaded from images/title.png)
        this.titleImage = this.add.image(400, -120, 'title').setOrigin(0.5);
        this.titleImage.setScale(1.3);

        this.tweens.add({
            targets: this.titleImage,
            y: 150,
            scale: 1,
            duration: 800,
            ease: 'Bounce.easeOut',
            onComplete: () => {
                const vibTween = this.tweens.add({
                    targets: this.titleImage,
                    x: '+=6',
                    duration: 70,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                const rotTween = this.tweens.add({
                    targets: this.titleImage,
                    angle: 2,
                    duration: 140,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                const blinkTween = this.tweens.add({
                    targets: this.titleImage,
                    alpha: 0.6,
                    duration: 900,
                    yoyo: true,
                    repeat: -1
                });
                this.time.delayedCall(3000, () => {
                    try {
                        if (vibTween && vibTween.stop) vibTween.stop();
                        if (rotTween && rotTween.stop) rotTween.stop();
                        if (blinkTween && blinkTween.stop) blinkTween.stop();
                    } catch (e) { }
                    this.titleImage.x = 400;
                    this.titleImage.y = 150;
                    this.titleImage.angle = 0;
                    this.titleImage.alpha = 1;
                    this.titleImage.setScale(1);

                    const explorerImage = this.add.image(-220, 430, 'explorer').setOrigin(0.5);
                    explorerImage.setDepth(20);
                    this.tweens.add({
                        targets: explorerImage,
                        x: 400,
                        duration: 2000,
                        ease: 'Sine.easeOut',
                        onComplete: () => {
                            this.tweens.add({
                                targets: explorerImage,
                                alpha: 0,
                                duration: 250,
                                onComplete: () => {
                                    explorerImage.destroy();

                                    this.titleImage.setVisible(false);

                                    const explosionTitle = this.add.image(400, 150, 'title_explosion').setOrigin(0.5);
                                    explosionTitle.setAlpha(0);
                                    explosionTitle.setDepth(21);

                                    this.tweens.add({
                                        targets: explosionTitle,
                                        alpha: 1,
                                        duration: 180,
                                        onComplete: () => {
                                            // After the explosion appears, show subtitle.png as a fade-in, hold, fade-out
                                            // and only after subtitle finished we move the explosion away and restore the title.
                                            this.time.delayedCall(120, () => {
                                                const subtitleImg = this.add.image(400, 210, 'subtitle').setOrigin(0.5);
                                                // Responsive resize: choose target width based on canvas width, max 400px
                                                try {
                                                    const canvasW = (this.scale && this.scale.width) ? this.scale.width : CONFIG.width || 800;
                                                    const margin = 40; // leave some horizontal margin
                                                    const maxWidth = 400;
                                                    const targetWidth = Math.min(maxWidth, Math.max(120, Math.floor((canvasW - margin) * 0.6)));
                                                    const tex = subtitleImg.texture && subtitleImg.frame ? subtitleImg.frame : null;
                                                    const srcW = tex ? (tex.width || subtitleImg.width) : subtitleImg.width;
                                                    const srcH = tex ? (tex.height || subtitleImg.height) : subtitleImg.height;
                                                    if (srcW && srcH) {
                                                        const targetHeight = Math.round((targetWidth / srcW) * srcH);
                                                        subtitleImg.setDisplaySize(targetWidth, targetHeight);
                                                    } else {
                                                        subtitleImg.setDisplaySize(targetWidth, Math.round(targetWidth * 0.25));
                                                    }
                                                } catch (e) {
                                                    // ignore sizing errors and proceed with default size
                                                }
                                                subtitleImg.setAlpha(0);
                                                subtitleImg.setDepth(22);

                                                // Sequence: fade in -> hold -> fade out -> destroy -> continue
                                                // Pop-in scale + fade-in
                                                subtitleImg.setScale(0.85);
                                                this.tweens.add({
                                                    targets: subtitleImg,
                                                    alpha: 1,
                                                    scale: 1,
                                                    duration: 360,
                                                    ease: 'Back.easeOut',
                                                    onComplete: () => {
                                                        // hold for 800ms, then fade-out with slight scale down
                                                        this.time.delayedCall(800, () => {
                                                            this.tweens.add({
                                                                targets: subtitleImg,
                                                                alpha: 0,
                                                                scale: 0.95,
                                                                duration: 350,
                                                                ease: 'Quad.easeIn',
                                                                onComplete: () => {
                                                                    try { subtitleImg.destroy(); } catch (e) {}
                                                                    // now move the explosion out and bring back the title
                                                                    this.tweens.add({
                                                                        targets: explosionTitle,
                                                                        y: -180,
                                                                        alpha: 0,
                                                                        duration: 420,
                                                                        ease: 'Cubic.easeIn',
                                                                        onComplete: () => {
                                                                            try { explosionTitle.destroy(); } catch (e) {}
                                                                            this.titleImage.setVisible(true);
                                                                            this.titleImage.x = 400;
                                                                            this.titleImage.y = -120;
                                                                            this.titleImage.angle = 0;
                                                                            this.titleImage.alpha = 1;
                                                                            this.titleImage.setScale(1);
                                                                            this.tweens.add({
                                                                                targets: this.titleImage,
                                                                                y: 150,
                                                                                duration: 800,
                                                                                ease: 'Bounce.easeOut'
                                                                            });
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                        });
                                                    }
                                                });
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                });
            }
        });

        this.instructionsText = this.add.text(400, 280, '', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: GAME_FONT,
            align: 'center'
        }).setOrigin(0.5);
        this.instructionsText.y = -50;
        this.tweens.add({
            targets: this.instructionsText,
            y: 280,
            duration: 800,
            ease: 'Bounce.easeOut'
        });
        this.tweens.add({
            targets: this.instructionsText,
            angle: -1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 800
        });

        // Panels and UI elements
        this.coinText = this.add.text(400, 480, '', {
            fontSize: '24px',
            fill: '#ffee00ff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);
        this.coinPanel = this.add.graphics();
        this.player1Text = this.add.text(150, 550, '', {
            fontSize: '18px',
            fill: '#666666',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);
        this.player1Panel = this.add.graphics();
        this.player2Text = this.add.text(650, 550, '', {
            fontSize: '18px',
            fill: '#666666',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);
        this.player2Panel = this.add.graphics();

        // Language selector with flags
        this.flagSprite = this.add.sprite(400, 400, 'flags', this.currentLangIndex).setOrigin(0.5);
        this.tweens.add({
            targets: this.flagSprite,
            scaleX: 1.05,
            scaleY: 0.98,
            angle: -2,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.tweens.add({
            targets: this.flagSprite,
            y: 398,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 200
        });
        this.add.text(320, 400, '◄', {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5).setInteractive().on('pointerdown', () => this.changeLanguage(-1));
        this.add.text(480, 400, '►', {
            fontSize: '24px',
            fill: '#ffffff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5).setInteractive().on('pointerdown', () => this.changeLanguage(1));

        // Setup input
        this.setupInput();
        this.lastMoveDir = { x: 1, y: 0 };

        // Story alternating: toggle between instructions and a short story every few seconds
        this.showingStory = false;

        // Carica le traduzioni prima di mostrare la UI
        loadTranslations(GAME_STATE.language, () => {
            // Story toggle event solo dopo che le traduzioni sono pronte
            this.storyToggleEvent = this.time.addEvent({
                delay: 5000,
                loop: true,
                callback: this.toggleStory,
                callbackScope: this
            });
            this.updateUI();
            this.resetTimeout();
        });
    }

    setupInput() {
        // Coin insert
        this.input.keyboard.on('keydown-FIVE', () => this.insertCoin());
        this.input.keyboard.on('keydown-SIX', () => this.insertCoin());

        // Start game
        this.input.keyboard.on('keydown-ONE', () => this.startGame(1));
        this.input.keyboard.on('keydown-TWO', () => this.startGame(2));

        // Language change
        this.input.keyboard.on('keydown-LEFT', () => this.changeLanguage(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.changeLanguage(1));

        // Config page
        this.input.keyboard.on('keydown-T', () => this.openConfig());

        // Any key resets timeout
        this.input.keyboard.on('keydown', () => this.resetTimeout());
    }

    // Toggle between instructions and story with a fade animation
    toggleStory() {
        const t = TRANSLATIONS[GAME_STATE.language];
        const newText = this.showingStory ? t.instructions : t.story;

        // Fade out -> change text -> fade in
        this.tweens.add({
            targets: this.instructionsText,
            alpha: 0,
            duration: 250,
            onComplete: () => {
                this.instructionsText.setText(newText);
                // small reposition in case multi-line height changes
                this.instructionsText.setOrigin(0.5);
                this.tweens.add({
                    targets: this.instructionsText,
                    alpha: 1,
                    duration: 300
                });
            }
        });

        this.showingStory = !this.showingStory;
    }

    openConfig() {
        this.scene.start('ConfigScene');
    }

    insertCoin() {
        if (this.sound) {
            this.sound.play('coin_sfx', { volume: 0.45 });
        }
        GAME_STATE.credits++;
        this.updateUI();
        this.resetTimeout();
    }

    startGame(players) {
        if (GAME_STATE.credits >= players) {
            const intro = this.sound.get('intro_bgm');
            if (intro && intro.isPlaying) {
                intro.stop();
            }
            GAME_STATE.credits -= players;
            GAME_STATE.score = 0;
            GAME_STATE.lives = 5;
            GAME_STATE.dynamiteCount = 20;
            GAME_STATE.keysCount = 0;
            GAME_STATE.currentLevel = 0;
            this.scene.start('LevelSelectScene');
        }
    }

    changeLanguage(dir) {
        if (this.sound) {
            this.sound.play('select_sfx', { volume: 0.4 });
        }
        this.currentLangIndex = (this.currentLangIndex + dir + this.languages.length) % this.languages.length;
        GAME_STATE.language = this.languages[this.currentLangIndex];

        // Update flag sprite frame
        if (this.flagSprite) {
            this.flagSprite.setFrame(this.currentLangIndex);
        }

        // Carica il nuovo dizionario e aggiorna la UI solo dopo il caricamento
        loadTranslations(GAME_STATE.language, () => {
            this.updateUI();
        });
        this.resetTimeout();
    }

    updateUI() {
        // Fallback to empty object if translations not loaded
        const t = TRANSLATIONS[GAME_STATE.language] || {};

        // Provide default strings if missing
        const title = t.title || 'BLOCK HUNTER';
        const instructions = t.instructions || 'INSERT COIN TO START';
        const story = t.story || '';
        const insertCoin = t.insert_coin || 'INSERT COIN';
        const credit = t.credit || 'CREDIT';
        const player1 = t.player1 || 'PLAYER 1';
        const player2 = t.player2 || 'PLAYER 2';

        // Title used to be a text object; now we use an image. Keep backward compatibility
        if (this.titleText && typeof this.titleText.setText === 'function') {
            this.titleText.setText(title);
        } else if (this.titleImage) {
            // no-op: title is an image loaded from images/title.png
        }
        // Show either instructions or story depending on current toggle state
        const displayedText = (this.showingStory) ? (story || instructions) : instructions;
        this.instructionsText.setText(displayedText);

        // Make sure UI texts are above panels
        this.coinText.setDepth(2);
        this.player1Text.setDepth(2);
        this.player2Text.setDepth(2);

        // Draw/update panels: coin always visible, player panels visible only when active
        if (this.coinPanel) drawTextPanel(this.coinPanel, this.coinText, { paddingX: 14, paddingY: 8 });

        if (this.player1Panel) {
            if (GAME_STATE.credits >= 1) {
                // Highlight player panel when active
                drawTextPanel(this.player1Panel, this.player1Text, { paddingX: 10, paddingY: 6 });
            } else {
                // hide when inactive
                this.player1Panel.clear();
            }
        }

        if (this.player2Panel) {
            if (GAME_STATE.credits >= 2) {
                drawTextPanel(this.player2Panel, this.player2Text, { paddingX: 10, paddingY: 6 });
            } else {
                this.player2Panel.clear();
            }
        }

        // Language is now shown via flag sprite, not text

        if (GAME_STATE.credits === 0) {
            this.coinText.setText(insertCoin);
        } else {
            this.coinText.setText(credit + ' ' + GAME_STATE.credits);
        }

        if (GAME_STATE.credits >= 1) {
            this.player1Text.setText(player1).setStyle({ fill: '#00ff00' });
        } else {
            this.player1Text.setText(player1).setStyle({ fill: '#666666' });
        }

        if (GAME_STATE.credits >= 2) {
            this.player2Text.setText(player2).setStyle({ fill: '#00ff00' });
        } else {
            this.player2Text.setText(player2).setStyle({ fill: '#666666' });
        }
    }

    resetTimeout() {
        if (this.attractTimer) {
            this.attractTimer.remove();
        }
        this.attractTimer = this.time.delayedCall(CONFIG.attractTimeout, () => {
            this.scene.start('TopTenScene');
        });
    }
}

// ============================================================================
// TOP TEN SCENE
// ============================================================================
class TopTenScene extends Phaser.Scene {
    constructor() {
        super('TopTenScene');
    }

    create() {
        const t = TRANSLATIONS[GAME_STATE.language] || {};

        this.add.image(400, 300, 'bg').setDisplaySize(800, 600);

        // Fallback: se la traduzione manca, mostra 'CLASSIFICA'
        const topTenTitle = t.topTen || 'CLASSIFICA';
        const topTitle = this.add.text(400, 80, topTenTitle, {
            fontSize: '48px',
            fill: '#ffff00',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        // Panel behind Top Ten title
        this.topTitlePanel = this.add.graphics();
        drawTextPanel(this.topTitlePanel, topTitle, { paddingX: 18, paddingY: 10, radius: 8 });

        let y = 150;
        GAME_STATE.topScores.forEach((entry, i) => {
            // Name text with falling effect
            const nameText = this.add.text(250, y, `${i + 1}. ${entry.name}`, {
                fontSize: '24px',
                fill: '#ffffff',
                fontFamily: GAME_FONT
            });

            // Score text with falling effect
            const scoreText = this.add.text(550, y, entry.score.toString(), {
                fontSize: '24px',
                fill: '#00ff00',
                fontFamily: GAME_FONT
            }).setOrigin(1, 0);

            // Apply falling boulder effect with staggered delays
            const delay = i * 150; // Each entry falls slightly after the previous

            // Start above screen
            nameText.y = -50;
            scoreText.y = -50;

            // Falling animation for name
            this.tweens.add({
                targets: nameText,
                y: y,
                duration: 600,
                ease: 'Bounce.easeOut',
                delay: delay
            });

            // Falling animation for score
            this.tweens.add({
                targets: scoreText,
                y: y,
                duration: 600,
                ease: 'Bounce.easeOut',
                delay: delay + 50 // Slightly delayed for cascading effect
            });

            // Subtle wobble after landing
            this.tweens.add({
                targets: [nameText, scoreText],
                angle: -0.5,
                duration: 800,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: delay + 600
            });

            y += 35;
        });

        this.time.delayedCall(CONFIG.topTenTimeout, () => {
            this.scene.start('AttractScene');
        });

        // --- Add attract-style UI (credits, player panels, language flag)
        // Keep selections visible while Top Ten is displayed
        this.languages = ['it', 'fr', 'de', 'en', 'us', 'ja', 'es', 'zh'];
        this.currentLangIndex = Math.max(0, this.languages.indexOf(GAME_STATE.language));
        if (!GAME_STATE.language) GAME_STATE.language = this.languages[this.currentLangIndex];

        // Coin/credits
        this.coinText = this.add.text(400, 480, '', {
            fontSize: '24px',
            fill: '#ffee00ff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);
        this.coinPanel = this.add.graphics();

        // Player labels
        this.player1Text = this.add.text(150, 550, '', {
            fontSize: '18px',
            fill: '#666666',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);
        this.player1Panel = this.add.graphics();
        this.player2Text = this.add.text(650, 550, '', {
            fontSize: '18px',
            fill: '#666666',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);
        this.player2Panel = this.add.graphics();

        // Flags (language selector display)
        this.flagSprite = this.add.sprite(400, 400, 'flags', this.currentLangIndex).setOrigin(0.5);
        this.tweens.add({
            targets: this.flagSprite,
            scaleX: 1.05,
            scaleY: 0.98,
            angle: -2,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Input handlers for coin insert / language change
        this.setupInput();

        // Load translations then update UI
        loadTranslations(GAME_STATE.language, () => {
            this.updateUI();
        });
    }

    setupInput() {
        // Coin insert (NUM 5/6)
        this.input.keyboard.on('keydown-FIVE', () => this.insertCoin());
        this.input.keyboard.on('keydown-SIX', () => this.insertCoin());

        // Start game (allow starting from TopTen via 1/2)
        this.input.keyboard.on('keydown-ONE', () => this.scene.start('LevelSelectScene'));
        this.input.keyboard.on('keydown-TWO', () => this.scene.start('LevelSelectScene'));

        // Language change while on Top Ten
        this.input.keyboard.on('keydown-LEFT', () => this.changeLanguage(-1));
        this.input.keyboard.on('keydown-RIGHT', () => this.changeLanguage(1));

        // Any key may return to attract (reset timer handled in AttractScene)
        this.input.keyboard.on('keydown', () => {
            // immediate return to attract so players can interact normally
            this.scene.start('AttractScene');
        });
    }

    changeLanguage(dir) {
        this.currentLangIndex = (this.currentLangIndex + dir + this.languages.length) % this.languages.length;
        GAME_STATE.language = this.languages[this.currentLangIndex];
        if (this.flagSprite) this.flagSprite.setFrame(this.currentLangIndex);
        loadTranslations(GAME_STATE.language, () => {
            // Refresh texts that depend on translations
            // Update top title
            const t = TRANSLATIONS[GAME_STATE.language] || {};
            const topTenTitle = t.topTen || 'CLASSIFICA';
            // find the top title text node and update if present
            try {
                if (this.children) {
                    this.children.list.forEach(ch => {
                        if (ch && ch.text && (ch.text === 'CLASSIFICA' || ch.text === TRANSLATIONS[this.previousLang]?.topTen || false)) {
                            ch.setText(topTenTitle);
                        }
                    });
                }
            } catch (e) {}
            this.updateUI();
        });
    }

    insertCoin() {
        if (this.sound) this.sound.play('coin_sfx', { volume: 0.45 });
        GAME_STATE.credits++;
        this.updateUI();
    }

    updateUI() {
        const t = TRANSLATIONS[GAME_STATE.language] || {};
        const insertCoin = t.insert_coin || 'INSERT COIN';
        const credit = t.credit || 'CREDIT';
        const player1 = t.player1 || 'PLAYER 1';
        const player2 = t.player2 || 'PLAYER 2';

        if (GAME_STATE.credits === 0) {
            this.coinText.setText(insertCoin);
        } else {
            this.coinText.setText(credit + ' ' + GAME_STATE.credits);
        }

        if (GAME_STATE.credits >= 1) {
            this.player1Text.setText(player1).setStyle({ fill: '#00ff00' });
        } else {
            this.player1Text.setText(player1).setStyle({ fill: '#666666' });
        }

        if (GAME_STATE.credits >= 2) {
            this.player2Text.setText(player2).setStyle({ fill: '#00ff00' });
        } else {
            this.player2Text.setText(player2).setStyle({ fill: '#666666' });
        }

        // Draw panels
        if (this.coinPanel) drawTextPanel(this.coinPanel, this.coinText, { paddingX: 14, paddingY: 8 });
        if (this.player1Panel) {
            if (GAME_STATE.credits >= 1) drawTextPanel(this.player1Panel, this.player1Text, { paddingX: 10, paddingY: 6 });
            else this.player1Panel.clear();
        }
        if (this.player2Panel) {
            if (GAME_STATE.credits >= 2) drawTextPanel(this.player2Panel, this.player2Text, { paddingX: 10, paddingY: 6 });
            else this.player2Panel.clear();
        }
    }
}

// ============================================================================
// CONFIG SCENE
// ============================================================================
class ConfigScene extends Phaser.Scene {
    constructor() {
        super('ConfigScene');
    }

    create() {
        // Background
        this.add.rectangle(400, 300, 800, 600, 0x001100);

        // Title
        this.add.text(400, 30, 'CONFIGURATION', {
            fontSize: '32px',
            fill: '#ffff00',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        // General config section
        let y = 80;
        this.add.text(20, y, 'GENERAL CONFIG:', {
            fontSize: '16px',
            fill: '#00ff00',
            fontFamily: GAME_FONT
        });
        y += 25;

        // Display config values
        const configInfo = [
            `SCREEN: ${CONFIG.width}x${CONFIG.height}`,
            `TILE SIZE: ${CONFIG.tileSize}px`,
            `PLAYER SIZE: ${CONFIG.playerSize}px`,
            `GRID: ${CONFIG.gridWidth}x${CONFIG.gridHeight}`,
            `PLAYER SPEED: ${CONFIG.playerSpeed}`,
            `BOULDER SPEED: ${CONFIG.boulderBaseSpeed}`,
            `DYNAMITE SPEED: ${CONFIG.dynamiteSpeed}`,
            `ATTRACT TIMEOUT: ${CONFIG.attractTimeout}ms`
        ];

        configInfo.forEach(info => {
            this.add.text(30, y, info, {
                fontSize: '12px',
                fill: '#ffffff',
                fontFamily: GAME_FONT
            });
            y += 18;
        });

        // --- Size controls: allow configuring TILE SIZE and OBJECT SCALE ---
        y += 8;
        this.add.text(20, y, 'SIZE CONFIG:', {
            fontSize: '14px',
            fill: '#00ff00',
            fontFamily: GAME_FONT
        });
        y += 20;

        // Tile size control
        this.add.text(30, y, 'Tile size (px):', { fontSize: '12px', fill: '#ffffff', fontFamily: GAME_FONT });
        this.tileSizeText = this.add.text(160, y, String(CONFIG.tileSize), { fontSize: '12px', fill: '#ffff00', fontFamily: GAME_FONT }).setOrigin(0, 0.5);
        const tileMinus = this.add.text(220, y, '◄', { fontSize: '14px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);
        const tilePlus = this.add.text(260, y, '►', { fontSize: '14px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);

        // Object scale control
        y += 22;
        this.add.text(30, y, 'Object scale:', { fontSize: '12px', fill: '#ffffff', fontFamily: GAME_FONT });
        this.objectSizeText = this.add.text(160, y, String(CONFIG.objectSize), { fontSize: '12px', fill: '#ffff00', fontFamily: GAME_FONT }).setOrigin(0, 0.5);
        const objMinus = this.add.text(220, y, '◄', { fontSize: '14px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);
        const objPlus = this.add.text(260, y, '►', { fontSize: '14px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);

        // Player size control
        y += 22;
        this.add.text(30, y, 'Player size:', { fontSize: '12px', fill: '#ffffff', fontFamily: GAME_FONT });
        this.playerSizeText = this.add.text(160, y, String(CONFIG.playerSize), { fontSize: '12px', fill: '#ffff00', fontFamily: GAME_FONT }).setOrigin(0, 0.5);
        const playerMinus = this.add.text(220, y, '◄', { fontSize: '14px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);
        const playerPlus = this.add.text(260, y, '►', { fontSize: '14px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);

        y += 22;

        // Apply / Reset buttons
        const applyBtn = this.add.text(340, y, '[ APPLY ]', { fontSize: '12px', fill: '#00ff00', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);
        const resetBtn = this.add.text(430, y, '[ RESET ]', { fontSize: '12px', fill: '#ff4444', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);

        // Keep lists of preview sprites so we can update scale when config changes
        this.previewObjectSprites = [];
        this.previewTileSprites = [];

        // Handlers
        tileMinus.on('pointerdown', () => {
            CONFIG.tileSize = Math.max(8, CONFIG.tileSize - 4);
            this.tileSizeText.setText(String(CONFIG.tileSize));
            this.updatePreviewSizes();
        });
        tilePlus.on('pointerdown', () => {
            CONFIG.tileSize = Math.min(256, CONFIG.tileSize + 4);
            this.tileSizeText.setText(String(CONFIG.tileSize));
            this.updatePreviewSizes();
        });

        objMinus.on('pointerdown', () => {
            CONFIG.objectSize = Math.max(8, CONFIG.objectSize - 4);
            this.objectSizeText.setText(String(CONFIG.objectSize));
            this.updatePreviewSizes();
        });
        objPlus.on('pointerdown', () => {
            CONFIG.objectSize = Math.min(512, CONFIG.objectSize + 4);
            this.objectSizeText.setText(String(CONFIG.objectSize));
            this.updatePreviewSizes();
        });

        playerMinus.on('pointerdown', () => {
            CONFIG.playerSize = Math.max(8, CONFIG.playerSize - 4);
            this.playerSizeText.setText(String(CONFIG.playerSize));
            this.updatePreviewSizes();
        });
        playerPlus.on('pointerdown', () => {
            CONFIG.playerSize = Math.min(512, CONFIG.playerSize + 4);
            this.playerSizeText.setText(String(CONFIG.playerSize));
            this.updatePreviewSizes();
        });

        applyBtn.on('pointerdown', () => {
            try {
                localStorage.setItem('blockHunterConfig', JSON.stringify({
                    tileSize: CONFIG.tileSize,
                    objectSize: CONFIG.objectSize,
                    playerSize: CONFIG.playerSize
                }));
            } catch (e) { }
            // show small confirmation
            const c = this.add.text(520, y, 'SAVED', { fontSize: '12px', fill: '#00ff00', fontFamily: GAME_FONT }).setOrigin(0.5);
            this.time.delayedCall(1200, () => c.destroy());
            this.updatePreviewSizes();
        });

        resetBtn.on('pointerdown', () => {
            CONFIG.tileSize = 32;
            CONFIG.objectSize = OBJECT_NATIVE_SIZE;
            CONFIG.playerSize = OBJECT_NATIVE_SIZE;
            this.tileSizeText.setText(String(CONFIG.tileSize));
            this.objectSizeText.setText(String(CONFIG.objectSize));
            this.playerSizeText.setText(String(CONFIG.playerSize));
            try { localStorage.removeItem('blockHunterConfig'); } catch (e) { }
            this.updatePreviewSizes();
        });

        // Objects section
        y += 10;
        this.add.text(20, y, 'OBJECTS SPRITE (4x4):', {
            fontSize: '16px',
            fill: '#00ff00',
            fontFamily: GAME_FONT
        });
        y += 25;

        // Display objects grid
        const objectNames = [
            ['dynamite', 'heart', 'stone', 'player'],
            ['dynamite_chest', 'door', 'gem', 'stones'],
            ['key', 'sand_pile', 'ghost', 'pepita'],
            ['wall', 'hole1', 'hole2', 'explosion']
        ];

        const startX = 30;
        const startY = y;
        const spriteSize = 40;
        // Increase spacing so 64x64 frames have visible gaps; spacing is center-to-center distance
        const spacing = 64;

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                const x = startX + col * spacing;
                const y = startY + row * spacing;
                const frameIndex = row * 4 + col;

                // Draw background panel to create visual gap / padding between frames
                const panelSize = spriteSize + 12; // background slightly larger than sprite
                this.add.rectangle(x + spriteSize / 2, y + spriteSize / 2, panelSize, panelSize, 0x001122).setOrigin(0.5);

                // Draw sprite on top
                const sprite = this.add.sprite(x + spriteSize / 2, y + spriteSize / 2, 'objects', frameIndex);
                // preview scale: base preview scaling to make sprites fit in the small preview box,
                // then apply the global objectSize so preview reflects configuration
                const basePreviewScale = spriteSize / OBJECT_NATIVE_SIZE;
                const objectScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
                sprite.setScale(basePreviewScale * objectScaleFactor);
                this.previewObjectSprites.push(sprite);

                // Label
                this.add.text(x + spriteSize / 2, y + spriteSize + 5, objectNames[row][col], {
                    fontSize: '8px',
                    fill: '#aaaaaa',
                    fontFamily: GAME_FONT
                }).setOrigin(0.5, 0);
            }
        }

        // Tiles section
        const tilesY = startY + 4 * spacing + 30;
        this.add.text(20, tilesY, 'TILES SPRITE (6 TILES):', {
            fontSize: '16px',
            fill: '#00ff00',
            fontFamily: GAME_FONT
        });

        const tileNames = ['wall', 'hole', 'sand', 'floor', 'stone', 'hole2'];
        const tilesStartY = tilesY + 25;

        for (let i = 0; i < 6; i++) {
            const x = startX + i * spacing;

            // Draw tile
            const tile = this.add.sprite(x + spriteSize / 2, tilesStartY + spriteSize / 2, 'tiles', i);
            // preview scale for tiles: fit preview box then apply tileSize/config
            const baseTilePreviewScale = spriteSize / TILE_NATIVE_WIDTH;
            tile.setScale(baseTilePreviewScale * (CONFIG.tileSize / TILE_NATIVE_WIDTH));
            this.previewTileSprites.push(tile);

            // Label
            this.add.text(x + spriteSize / 2, tilesStartY + spriteSize + 5, tileNames[i], {
                fontSize: '8px',
                fill: '#aaaaaa',
                fontFamily: GAME_FONT
            }).setOrigin(0.5, 0);
        }

        // Instructions
        this.add.text(400, 580, 'PRESS ESC TO RETURN', {
            fontSize: '16px',
            fill: '#ffff00',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        // Setup input
        this.input.keyboard.on('keydown-ESC', () => {
            this.scene.start('AttractScene');
        });

        // Helper to update preview sprites scaling when CONFIG changes
        this.updatePreviewSizes = () => {
            // update object previews
            try {
                const basePreviewScale = spriteSize / OBJECT_NATIVE_SIZE;
                const objectScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
                (this.previewObjectSprites || []).forEach(s => {
                    if (s && s.setScale) s.setScale(basePreviewScale * objectScaleFactor);
                });
            } catch (e) { }

            // update tile previews
            try {
                const baseTilePreviewScale = spriteSize / TILE_NATIVE_WIDTH;
                (this.previewTileSprites || []).forEach(s => {
                    if (s && s.setScale) s.setScale(baseTilePreviewScale * (CONFIG.tileSize / TILE_NATIVE_WIDTH));
                });
            } catch (e) { }

            // update config info display text if present
            if (this.tileSizeText) this.tileSizeText.setText(String(CONFIG.tileSize));
            if (this.objectSizeText) this.objectSizeText.setText(String(CONFIG.objectSize));
            if (this.playerSizeText) this.playerSizeText.setText(String(CONFIG.playerSize));
        };
    }
}

// ============================================================================
// LEVEL SELECT SCENE
// ============================================================================
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
        }).setOrigin(0.5);

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
            }).setOrigin(0.5).setInteractive();

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
class GameScene extends Phaser.Scene {
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
        if (!this.anims.exists('bat_fly')) {
            this.anims.create({
                key: 'bat_fly',
                frames: this.anims.generateFrameNumbers('bat', { start: 0, end: 5 }),
                frameRate: 12,
                repeat: -1
            });
        }
        if (!this.anims.exists('ghost_float')) {
            this.anims.create({
                key: 'ghost_float',
                frames: this.anims.generateFrameNumbers('ghost', { start: 0, end: 4 }),
                frameRate: 10,
                yoyo: true,
                repeat: -1
            });
        }

        // Background based on master level (1..5), fallback to default game_bg
        const masterLevel = getLevelMasterNumber(GAME_STATE.currentLevel);
        const masterLevelBgKey = `game_bg_${masterLevel}`;
        const selectedBgKey = this.textures.exists(masterLevelBgKey) ? masterLevelBgKey : 'game_bg';
        this.gameBg = this.add.image(CONFIG.width / 2, CONFIG.height / 2, selectedBgKey)
            .setDisplaySize(CONFIG.width, CONFIG.height)
            .setScrollFactor(1)
            .setDepth(-1000);

        // Get level data from JSON
        const levelFileName = getLevelFileName(GAME_STATE.currentLevel);
        this.levelData = this.cache.json.get(levelFileName);

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

        // Resize and position background to cover the world, then let it scroll
        if (this.gameBg) {
            const bgWidth = Math.max(worldWidth, CONFIG.width);
            const bgHeight = Math.max(worldHeight, CONFIG.height);
            this.gameBg.setDisplaySize(bgWidth, bgHeight);
            this.gameBg.setPosition(worldX + bgWidth / 2, worldY + bgHeight / 2);
            this.gameBg.setScrollFactor(1);
        }

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

        // Spawn static rocks solo se non disabilitato da config
        if (!CONFIG.disableStaticRocks) {
            this.spawnStaticRocks();
        }

        // Spawn ghosts (count from level JSON, e.g. "ghost": 3)
        this.spawnGhosts();
        this.spawnBatsFromMap();

        // Spawn first gem, otherwise activate map exits immediately
        if ((Number(this.gemsRemaining) || 0) > 0) {
            this.time.delayedCall(CONFIG.gemSpawnDelay, () => this.spawnGem());
        } else {
            this.activateHole2Exits();
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
                }
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
                if (this.gameBg) {
                    const bgW = Math.max(worldWidth, w);
                    const bgH = Math.max(worldHeight, h);
                    this.gameBg.setDisplaySize(bgW, bgH);
                    this.gameBg.setPosition(worldX + bgW / 2, worldY + bgH / 2);
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

        // Tile sprite mapping: 0=wall, 1=hole, 2=sand, 3=floor, 4=stone, 5=hole2
        const TILE_FRAMES = {
            wall: 0,
            hole: 1,
            sand: 2,
            sand1: 2, sand2: 2, sand3: 2, sand4: 2, sand5: 2,
            sand6: 2, sand7: 2, sand8: 2, sand9: 2, sand10: 2,
            floor: 3,
            stone: 4,
            hole2: 5,
            sandPile: 4  // sandPile uses stone texture
        };

        const parseSingleMapSymbol = (value) => {
            if (typeof value !== 'string') {
                return {
                    type: value,
                    wallFrame: 0,
                    wallRotation: 0
                };
            }

            const normalizedValue = value.trim().toLowerCase();
            if (normalizedValue === 'floor' || normalizedValue === 'f') {
                return { type: 'floor', wallFrame: 0, wallRotation: 0 };
            }
            if (normalizedValue === 'empty') {
                return { type: 'empty', wallFrame: 0, wallRotation: 0 };
            }
            if (normalizedValue === 'hole') {
                return { type: 'hole', wallFrame: 0, wallRotation: 0 };
            }
            if (normalizedValue === 'hole2') {
                return { type: 'hole2', wallFrame: 0, wallRotation: 0 };
            }
            if (normalizedValue === 'wall' || normalizedValue === 'w') {
                return { type: 'wall', wallFrame: 0, wallRotation: 0 };
            }

            const wallMatch = value.match(/^w(\d)(\d)$/i);
            if (wallMatch) {
                const baseCol = Number(wallMatch[1]);
                const rotationCode = Number(wallMatch[2]);
                const validBaseCol = baseCol >= 0 && baseCol <= 6;
                const validRotation = rotationCode >= 0 && rotationCode <= 3;

                // New format: wCR => C=column (0..6), R=rotation (0..3, clockwise 90° steps)
                if (validBaseCol && validRotation) {
                    return {
                        type: 'wall',
                        wallFrame: baseCol,
                        wallRotation: rotationCode
                    };
                }

                if (validBaseCol) {
                    return {
                        type: 'wall',
                        wallFrame: baseCol,
                        wallRotation: ((rotationCode % 4) + 4) % 4
                    };
                }

                return {
                    type: 'wall',
                    wallFrame: 0,
                    wallRotation: 0
                };
            }

            if (value.length === 1) {
                switch (value) {
                    case 'w': return { type: 'wall', wallFrame: 0, wallRotation: 0 };
                    case 'f': return { type: 'floor', wallFrame: 0, wallRotation: 0 };
                    case 'm': return { type: 'skeleton', wallFrame: 0, wallRotation: 0 };
                    case 'h': return { type: 'hole', wallFrame: 0, wallRotation: 0 };
                    case 's': return { type: 'hole2', wallFrame: 0, wallRotation: 0 };
                    case 'g': return { type: 'gem', wallFrame: 0, wallRotation: 0 };
                    case '-': return { type: 'empty', wallFrame: 0, wallRotation: 0 };
                    case 'd': return { type: 'door', wallFrame: 0, wallRotation: 0 };
                    case 'k': return { type: 'key', wallFrame: 0, wallRotation: 0 };
                    case 'p': return { type: 'pepita', wallFrame: 0, wallRotation: 0 };
                    case 'b': return { type: 'dynamite', wallFrame: 0, wallRotation: 0 };
                    case 'c': return { type: 'cart', wallFrame: 0, wallRotation: 0 };
                    default: return { type: value, wallFrame: 0, wallRotation: 0 };
                }
            }

            return {
                type: value,
                wallFrame: 0,
                wallRotation: 0
            };
        };

        const wallMaxFrame = getTextureMaxNumericFrame(this, 'wall_tiles', 6);

        const mapSymbolToCell = (value) => {
            if (typeof value === 'string') {
                const slashIndex = value.indexOf('/');
                if (slashIndex > 0 && slashIndex < value.length - 1) {
                    const coverPart = value.slice(0, slashIndex).trim();
                    const revealPart = value.slice(slashIndex + 1).trim();
                    if (coverPart && revealPart) {
                        const coverCell = parseSingleMapSymbol(coverPart);
                        const revealCell = parseSingleMapSymbol(revealPart);
                        return {
                            ...coverCell,
                            hiddenReveal: revealCell
                        };
                    }
                }
            }

            const singleCell = parseSingleMapSymbol(value);
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
                let hiddenReveal = null;

                // If we have map data from JSON, use it
                if (mapData && mapData[y] && mapData[y][x] !== undefined) {
                    const cell = mapSymbolToCell(mapData[y][x]);
                    type = cell.type;
                    wallFrame = cell.wallFrame;
                    wallRotation = cell.wallRotation || 0;
                    hiddenReveal = cell.hiddenReveal || null;
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
                const tileType = (type === 'door'
                    || type === 'key'
                    || type === 'pepita'
                    || type === 'dynamite'
                    || type === 'gem'
                    || type === 'cart'
                    || type === 'skeleton'
                    || type === 'hole2')
                    ? 'empty'
                    : type;
                const normalizedTileType = (tileType === 'bat' || tileType === 'ghost') ? 'floor' : tileType;
                let tileSprite = null;
                let coverSprite = null;

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

                    if (type === 'wall' && wallRotation) {
                        tileSprite.setAngle(wallRotation * 90);
                    }

                    if (type === 'wall' && this.walls) {
                        this.walls.add(tileSprite);
                        coverSprite = tileSprite;
                        if (tileSprite.body) {
                            // Use the actual display size of the sprite for physics body
                            tileSprite.body.setSize(Math.floor(tileSprite.displayWidth || tileSprite.width), Math.floor(tileSprite.displayHeight || tileSprite.height));
                        }
                    }
                }

                if (type === 'door' && this.doors) {
                    const door = this.doors.create(
                        offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        'objects',
                        OBJECT_FRAMES.door
                    );
                    this.setupDoor(door);
                    this.hasDoorInMap = true;
                    coverSprite = door;
                }

                if ((type === 'key' || type === 'pepita' || type === 'dynamite' || type === 'skeleton' || type === 'cart') && this.items) {
                    const frame = type === 'key'
                        ? OBJECT_FRAMES.key
                        : (type === 'pepita'
                            ? OBJECT_FRAMES.pepita
                            : (type === 'dynamite'
                                ? OBJECT_FRAMES.dynamite_chest
                                : (type === 'cart' ? OBJECT_FRAMES.cart : OBJECT_FRAMES.wall)));
                    const itemSprite = this.items.create(
                        offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        'objects',
                        frame
                    );
                    // Keep item at original sprite size
                    if (itemSprite.body) {
                        itemSprite.body.setSize(itemSprite.displayWidth || itemSprite.width, itemSprite.displayHeight || itemSprite.height);
                    }
                    // Apply object scale multiplier so items adapt to configuration
                    const objectScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
                    itemSprite.setScale(objectScaleFactor);
                    if (itemSprite.body) {
                        itemSprite.body.setSize(Math.floor(itemSprite.displayWidth || itemSprite.width), Math.floor(itemSprite.displayHeight || itemSprite.height));
                    }
                    itemSprite.setData('type', type);
                    itemSprite.setData('gridX', x);
                    itemSprite.setData('gridY', y);
                    if (type === 'key') {
                        this.applyKeyFloatingEffect(itemSprite);
                    }
                    coverSprite = itemSprite;

                    if (type === 'key' && this.keySpawnPositions) {
                        this.keySpawnPositions.push({ x: itemSprite.x, y: itemSprite.y });
                    }
                }

                if (type === 'gem') {
                    if (!this.mapGemPositions) {
                        this.mapGemPositions = [];
                    }
                    this.mapGemPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2
                    });
                }

                if (type === 'hole2') {
                    if (!this.hole2ExitPositions) {
                        this.hole2ExitPositions = [];
                    }
                    this.hole2ExitPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        gridX: x,
                        gridY: y
                    });
                }

                if (type === 'ghost') {
                    if (!this.ghostSpawnPositions) {
                        this.ghostSpawnPositions = [];
                    }
                    this.ghostSpawnPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2
                    });
                }

                if (type === 'bat') {
                    if (!this.batSpawnPositions) {
                        this.batSpawnPositions = [];
                    }
                    this.batSpawnPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2
                    });
                }

                this.tiles[y][x] = { type: normalizedTileType, sprite: tileSprite };
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
                    const txt = this.add.text(cx, cy, `${y},${x}`, labelStyle).setOrigin(0.5);
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
            });
        } catch (e) {
            // ignore if input not ready or in non-interactive context
        }
    }

    createPlayer() {
        // Determine initial player position. Support per-level `playerStart`
        // inside level data. `playerStart` may be specified as pixel coords
        // { x: 123, y: 456 } or as tile indices { row: r, col: c }.
        let px = CONFIG.width / 2;
        let py = CONFIG.height / 2;

        try {
            if (this.levelData && this.levelData.playerStart) {
                const ps = this.levelData.playerStart;
                if (typeof ps.x === 'number' && typeof ps.y === 'number') {
                    px = ps.x;
                    py = ps.y;
                } else if (typeof ps.row === 'number' && typeof ps.col === 'number') {
                    // convert tile indices to world pixels (center of tile)
                    px = this.mapOffsetX + ps.col * CONFIG.tileSize + CONFIG.tileSize / 2;
                    py = this.mapOffsetY + ps.row * CONFIG.tileSize + CONFIG.tileSize / 2;
                }
            }
        } catch (e) { /* fall back to center */ }

        // Use dedicated front player spritesheet (frame 0 idle)
        this.player = this.physics.add.sprite(px, py, 'player_front', 0);
        // Keep configured player size in pixels
        const playerDisplaySize = Number(CONFIG.playerSize) || Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE;
        this.player.setDisplaySize(playerDisplaySize, playerDisplaySize);
        this.playerFacing = 'front';
        this.playerVerticalFacing = 'front';
        this.player.setFlipX(false);
        this.player.setCollideWorldBounds(true);
        // Configure body size based on the sprite's actual display size
        if (this.player.body) {
            const w = this.player.displayWidth || this.player.width;
            const h = this.player.displayHeight || this.player.height;
            this.player.body.setSize(Math.floor(w * 0.7), Math.floor(h * 0.7));
            this.player.body.setOffset(Math.floor(w * 0.15), Math.floor(h * 0.15));
        }
    }

    spawnStaticRocks() {
        const spawnDelay = Math.max(200, 1200 - GAME_STATE.currentLevel * 40); // Più veloce nei livelli avanzati

        // Spawn continuo
        this.rockSpawnTimer = this.time.addEvent({
            delay: spawnDelay,
            callback: () => {
                this.spawnSingleRock();
            },
            callbackScope: this,
            loop: true
        });
    }

    shouldCurrentStoneBurstOnLanding() {
        this.spawnedFallingStoneCount = (Number(this.spawnedFallingStoneCount) || 0) + 1;

        if ((Number(this.stoneShardBurstsRemaining) || 0) <= 0) {
            return false;
        }

        const nextIndex = Number(this.nextStoneShardBurstIndex);
        if (!Number.isFinite(nextIndex) || this.spawnedFallingStoneCount < nextIndex) {
            return false;
        }

        this.stoneShardBurstsRemaining = Math.max(0, this.stoneShardBurstsRemaining - 1);
        if (this.stoneShardBurstsRemaining > 0) {
            this.nextStoneShardBurstIndex = this.spawnedFallingStoneCount + Phaser.Math.Between(1, 3);
        } else {
            this.nextStoneShardBurstIndex = Number.POSITIVE_INFINITY;
        }

        return true;
    }

    emitStoneShardBurst(x, y, size = 'medium') {
        const shardCount = this.getShardCount(size);
        if (!this.shards || shardCount <= 0) return;

        for (let i = 0; i < shardCount; i++) {
            const angle = (Math.PI * 2 * i) / shardCount;
            const speed = CONFIG.shardSpeed * Phaser.Math.FloatBetween(0.85, 1.2);
            this.spawnStoneShardProjectile(x, y, angle, speed);
        }
    }

    spawnStoneShardProjectile(x, y, angle, speed) {
        if (!this.shards) return null;

        const shard = this.shards.create(x, y, 'objects', OBJECT_FRAMES.stone);
        const objectScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        const shardScale = Math.max(0.14, objectScaleFactor * 0.22);
        shard.setScale(shardScale);

        const speedValue = Math.max(40, Number(speed) || CONFIG.shardSpeed || 120);
        const vx = Math.cos(angle) * speedValue + Phaser.Math.Between(-24, 24);
        const vy = Math.sin(angle) * speedValue + Phaser.Math.Between(-24, 24);
        shard.setVelocity(vx, vy);
        shard.setAngularVelocity(Phaser.Math.Between(-420, 420));

        if (shard.body) {
            shard.body.setSize(Math.max(2, Math.floor(shard.displayWidth || shard.width)), Math.max(2, Math.floor(shard.displayHeight || shard.height)));
            shard.body.setAllowGravity(true);
            shard.body.setGravity(0, Phaser.Math.Between(160, 280));
            shard.body.setDrag(55, 18);
            shard.body.setBounce(0.35, 0.2);
            shard.body.setCollideWorldBounds(true);
        }

        this.attachShardSmokeTrail(shard);

        this.time.delayedCall(CONFIG.shardLifetime, () => {
            if (shard.active) shard.destroy();
        });

        return shard;
    }

    attachShardSmokeTrail(shard) {
        if (!shard || !shard.active) return;

        const smokeEvent = this.time.addEvent({
            delay: 55,
            loop: true,
            callback: () => {
                if (!shard || !shard.active) {
                    if (smokeEvent && smokeEvent.remove) {
                        smokeEvent.remove(false);
                    }
                    return;
                }

                const smoke = this.add.circle(
                    shard.x + Phaser.Math.Between(-2, 2),
                    shard.y + Phaser.Math.Between(-2, 2),
                    Phaser.Math.Between(2, 3),
                    0xb0b0b0,
                    0.48
                );
                smoke.setDepth(860);

                this.tweens.add({
                    targets: smoke,
                    y: smoke.y - Phaser.Math.Between(6, 12),
                    x: smoke.x + Phaser.Math.Between(-5, 5),
                    scale: 1.9,
                    alpha: 0,
                    duration: Phaser.Math.Between(230, 360),
                    ease: 'Sine.easeOut',
                    onComplete: () => smoke.destroy()
                });
            }
        });

        shard.setData('smokeTrailEvent', smokeEvent);
        if (shard.once) {
            shard.once('destroy', () => {
                if (smokeEvent && smokeEvent.remove) {
                    smokeEvent.remove(false);
                }
            });
        }
    }

    getRandomWalkableTile() {
        if (!this.tiles || !this.tiles.length) return null;

        const maxAttempts = 100;
        let attempt = 0;
        let x = 0;
        let y = 0;

        while (attempt < maxAttempts) {
            x = Phaser.Math.Between(1, this.mapCols - 2);
            y = Phaser.Math.Between(1, this.mapRows - 2);

            const tile = this.tiles[y]?.[x];
            if (tile && (tile.type === 'floor' || tile.type === 'sand' || tile.type === 'empty')) {
                return { x, y };
            }
            attempt++;
        }

        return null;
    }

    spawnSingleRock() {
        // Posizione casuale evitando i bordi e il centro (dove spawna il player)
        let attempts = 0;
        let pos = null;
        let tooClose = false;
        let x = 0;
        let y = 0;

        do {
            pos = this.getRandomWalkableTile();
            if (!pos) return;
            x = pos.x;
            y = pos.y;
            attempts++;

            // Evita il centro dove spawna il player

            const centerX = Math.floor(this.mapCols / 2);
            const centerY = Math.floor(this.mapRows / 2);
            tooClose = Math.abs(x - centerX) < 3 && Math.abs(y - centerY) < 3;

            // Evita lo stesso tile della spawn precedente
            if (this.lastRockTile && this.lastRockTile.x === x && this.lastRockTile.y === y) {
                tooClose = true;
            }
        } while (tooClose && attempts < 50);

        this.lastRockTile = { x, y };

        const worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;

        // Add a small random pixel jitter so rocks don't always align to the exact same tile centers
        const jitterX = Phaser.Math.Between(-6, 6);
        const jitterY = Phaser.Math.Between(-6, 6);
        const jitteredX = Phaser.Math.Clamp(worldX + jitterX, this.mapOffsetX + CONFIG.tileSize / 2, this.mapOffsetX + (this.mapCols - 1) * CONFIG.tileSize + CONFIG.tileSize / 2);
        const jitteredY = Phaser.Math.Clamp(worldY + jitterY, this.mapOffsetY + CONFIG.tileSize / 2, this.mapOffsetY + (this.mapRows - 1) * CONFIG.tileSize + CONFIG.tileSize / 2);

        // Dimensione casuale basata sulla configurazione del livello
        const rockConfig = this.levelConfig.staticRocks;
        const availableSizes = rockConfig?.sizes || LEVEL_CONFIG.globalRules.staticRocks.sizes || ['small', 'medium', 'large'];
        const size = Phaser.Utils.Array.GetRandom(availableSizes);

        // Crea la roccia con la sprite stone
        let scale = 1;

        if (size === 'small') {
            scale = 0.7;
        } else if (size === 'large') {
            scale = 1.3;
        }

        const rock = this.rocks.create(jitteredX, jitteredY, 'objects', OBJECT_FRAMES.stone);
        // Apply object size (pixels) converted to scale factor
        const rockScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        const finalScale = scale * rockScaleFactor;
        rock.setScale(finalScale);
        rock.setData('destructible', true);
        rock.setData('size', size);
        rock.setData('isFalling', true);
        rock.setData('burstOnLanding', this.shouldCurrentStoneBurstOnLanding());

        // Rotazione casuale in partenza
        const startAngle = Phaser.Math.Between(0, 360);
        const endAngle = Phaser.Math.Between(0, 360);
        rock.setAngle(startAngle);

        // Effetto di apparizione con zoom da grosso a piccolo (caduta)
        rock.setScale(finalScale * 3); // Inizia 3x più grande
        rock.alpha = 0.7; // Leggermente trasparente all'inizio
        this.tweens.add({
            targets: rock,
            scale: finalScale,
            alpha: 1,
            angle: endAngle,
            duration: 400,
            ease: 'Cubic.easeOut', // Effetto di caduta naturale
            onComplete: () => {
                if (!rock || !rock.active) {
                    return;
                }
                // Aggiorna il corpo fisico dopo lo scaling: use actual display size
                if (rock.body) {
                    rock.body.setSize(Math.floor(rock.displayWidth || rock.width), Math.floor(rock.displayHeight || rock.height));
                }
                rock.setData('isFalling', false);

                // Effetto terremoto del pavimento all'impatto della stone
                const impactIntensity = size === 'large' ? 0.008 : (size === 'medium' ? 0.005 : 0.003);
                const impactDuration = size === 'large' ? 180 : (size === 'medium' ? 130 : 90);
                const impactVolume = size === 'large' ? 0.65 : (size === 'medium' ? 0.5 : 0.35);
                if (this.cameras && this.cameras.main) {
                    this.cameras.main.shake(impactDuration, impactIntensity, false);
                }
                if (this.sound) {
                    this.sound.play('stone_sfx', { volume: impactVolume });
                }

                // Piccolo rimbalzo finale
                this.tweens.add({
                    targets: rock,
                    scale: finalScale * 1.1,
                    duration: 100,
                    yoyo: true,
                    ease: 'Sine.easeInOut'
                });

                this.tweens.add({
                    targets: rock,
                    scaleX: finalScale * 1.05,
                    scaleY: finalScale * 0.95,
                    duration: 80,
                    yoyo: true,
                    ease: 'Sine.easeOut'
                });

                // Polvere che si alza
                this.createDustPuff(rock.x, rock.y, scale);

                if (rock.getData('burstOnLanding')) {
                    this.emitStoneShardBurst(rock.x, rock.y, size);
                }
            }
        });

        // Se è un livello caotico, aggiungi movimento casuale
        if (rockConfig.chaotic) {
            this.tweens.add({
                targets: rock,
                angle: rock.angle + Phaser.Math.Between(-180, 180),
                duration: Phaser.Math.Between(2000, 4000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    spawnGem() {
        if (this.gemsRemaining <= 0) {
            return;
        }
        let worldX;
        let worldY;

        if (this.mapGemPositions && this.mapGemPositions.length > 0) {
            const next = this.mapGemPositions[this.mapGemIndex];
            if (!next) {
                return;
            }
            worldX = next.x;
            worldY = next.y;
        } else {
            let x, y, attempts = 0;
            do {
                x = Phaser.Math.Between(2, this.mapCols - 3);
                y = Phaser.Math.Between(2, this.mapRows - 3);
                attempts++;
            } while (this.tiles[y][x].type !== 'floor' && this.tiles[y][x].type !== 'empty' && attempts < 100);

            worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
            worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;
        }

        this.createGemPickupAt(worldX, worldY);

        if (this.mapGemPositions && this.mapGemPositions.length > 0) {
            this.mapGemIndex++;
        }
    }

    createGemPickupAt(worldX, worldY) {
        if (!this.gems) return null;

        const gem = this.gems.create(worldX, worldY, 'objects', OBJECT_FRAMES.gem);
        const gemScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        gem.setScale(gemScaleFactor);
        if (gem.body) {
            gem.body.setSize(Math.floor(gem.displayWidth || gem.width), Math.floor(gem.displayHeight || gem.height));
        }

        this.tweens.add({
            targets: gem,
            scale: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        return gem;
    }

    respawnStolenGemInMap(avoidX, avoidY) {
        const tile = this.getRandomWalkableTile();
        let worldX;
        let worldY;

        if (tile) {
            worldX = this.mapOffsetX + tile.x * CONFIG.tileSize + CONFIG.tileSize / 2;
            worldY = this.mapOffsetY + tile.y * CONFIG.tileSize + CONFIG.tileSize / 2;
        } else {
            worldX = Number.isFinite(Number(avoidX)) ? Number(avoidX) : (this.player?.x || 0);
            worldY = Number.isFinite(Number(avoidY)) ? Number(avoidY) : (this.player?.y || 0);
        }

        this.createGemPickupAt(worldX, worldY);
    }

    spawnKey() {
        const x = Phaser.Math.Between(2, this.mapCols - 3);
        const y = Phaser.Math.Between(2, this.mapRows - 3);

        const worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;

        // Use key sprite from objects.png (frame 8)
        const keySprite = this.items.create(worldX, worldY, 'objects', OBJECT_FRAMES.key);
        // Keep key at original size
        if (keySprite.body) {
            keySprite.body.setSize(Math.floor(keySprite.displayWidth || keySprite.width), Math.floor(keySprite.displayHeight || keySprite.height));
        }
        const keyScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        keySprite.setScale(keyScaleFactor);
        if (keySprite.body) {
            keySprite.body.setSize(Math.floor(keySprite.displayWidth || keySprite.width), Math.floor(keySprite.displayHeight || keySprite.height));
        }
        keySprite.setData('type', 'key');
        this.applyKeyFloatingEffect(keySprite);
        this.lastKeyPos = { x: worldX, y: worldY };
    }

    spawnKeyAt(x, y) {
        const keySprite = this.items.create(x, y, 'objects', OBJECT_FRAMES.key);
        // Keep key at original size
        if (keySprite.body) {
            keySprite.body.setSize(Math.floor(keySprite.displayWidth || keySprite.width), Math.floor(keySprite.displayHeight || keySprite.height));
        }
        const keyScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        keySprite.setScale(keyScaleFactor);
        if (keySprite.body) {
            keySprite.body.setSize(Math.floor(keySprite.displayWidth || keySprite.width), Math.floor(keySprite.displayHeight || keySprite.height));
        }
        keySprite.setData('type', 'key');
        this.applyKeyFloatingEffect(keySprite);
        this.lastKeyPos = { x, y };
    }

    applyKeyFloatingEffect(keySprite) {
        if (!keySprite || !keySprite.active || !this.tweens) return;
        this.tweens.add({
            targets: keySprite,
            y: keySprite.y - Math.max(4, Math.round(CONFIG.tileSize * 0.12)),
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    spawnDoor() {
        const side = Phaser.Math.Between(0, 3);
        let x, y;

        if (side === 0) { x = this.mapCols - 1; y = Math.floor(this.mapRows / 2); }
        else if (side === 1) { x = 0; y = Math.floor(this.mapRows / 2); }
        else if (side === 2) { x = Math.floor(this.mapCols / 2); y = this.mapRows - 1; }
        else { x = Math.floor(this.mapCols / 2); y = 0; }

        const worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;

        // Use door sprite from objects.png (frame 5)
        const door = this.doors.create(worldX, worldY, 'objects', OBJECT_FRAMES.door);
        this.setupDoor(door);
    }

    setupDoor(door) {
        if (!door) return;
        // Apply object size (pixels) converted to scale factor to door
        const doorScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        door.setScale(doorScaleFactor);
        door.setData('locked', true);
        door.setData('opening', false);
        if (door.body) {
            door.body.setSize(Math.floor(door.displayWidth || door.width), Math.floor(door.displayHeight || door.height));
        }
        if (door.refreshBody) {
            door.refreshBody();
        }
    }

    spawnHole2ExitAt(worldX, worldY, gridX = null, gridY = null) {
        if (!this.hole2Exits) return;

        const exits = this.hole2Exits.children?.entries || [];
        const alreadyExists = exits.some((entry) => {
            if (!entry || !entry.active) return false;
            return Math.abs(entry.x - worldX) < 1 && Math.abs(entry.y - worldY) < 1;
        });
        if (alreadyExists) return;

        const hole2Exit = this.hole2Exits.create(worldX, worldY, 'objects', OBJECT_FRAMES.hole2);
        const hole2ScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        hole2Exit.setScale(hole2ScaleFactor);
        hole2Exit.setData('gridX', gridX);
        hole2Exit.setData('gridY', gridY);
        if (hole2Exit.body) {
            hole2Exit.body.setSize(Math.floor(hole2Exit.displayWidth || hole2Exit.width), Math.floor(hole2Exit.displayHeight || hole2Exit.height));
        }
        if (hole2Exit.refreshBody) {
            hole2Exit.refreshBody();
        }
    }

    activateHole2Exits() {
        if (this.hole2ExitsActive) return;

        const exits = Array.isArray(this.hole2ExitPositions) ? this.hole2ExitPositions : [];
        if (!exits.length) {
            this.levelComplete();
            return;
        }

        this.hole2ExitsActive = true;
        exits.forEach((exitPos) => {
            this.spawnHole2ExitAt(exitPos.x, exitPos.y, exitPos.gridX, exitPos.gridY);
        });
    }

    onPlayerReachHole2Exit(player, hole2Exit) {
        if (!this.hole2ExitsActive) return;
        if (!hole2Exit || !hole2Exit.active) return;
        if ((Number(this.gemsRemaining) || 0) > 0) return;
        this.levelComplete();
    }

    setupCollisions() {
        // Player collisions
        this.physics.add.overlap(this.player, this.gems, this.collectGem, null, this);
        this.physics.add.overlap(this.player, this.items, this.collectItem, null, this);
        this.physics.add.overlap(this.player, this.bats, this.hitByBat, null, this);
        const playerRockCollider = this.physics.add.collider(this.player, this.rocks);
        if (playerRockCollider) {
            this.playerCollisionRefs.push(playerRockCollider);
        }
        this.physics.add.overlap(this.player, this.rocks, this.hitByRock, null, this);
        this.physics.add.overlap(this.player, this.boulders, this.hitByBoulder, null, this);
        this.physics.add.overlap(this.player, this.ghosts, this.hitByGhost, null, this);
        this.physics.add.overlap(this.player, this.shards, this.hitByShard, null, this);
        this.physics.add.overlap(this.player, this.hole2Exits, this.onPlayerReachHole2Exit, null, this);
        if (this.walls) {
            const playerWallCollider = this.physics.add.collider(this.player, this.walls);
            if (playerWallCollider) {
                this.playerCollisionRefs.push(playerWallCollider);
            }
        }
        if (this.doors) {
            const playerDoorCollider = this.physics.add.collider(this.player, this.doors, this.onPlayerDoorCollide, null, this);
            if (playerDoorCollider) {
                this.playerCollisionRefs.push(playerDoorCollider);
            }
        }

        // Dynamite collisions
        this.physics.add.collider(this.dynamites, this.rocks, this.dynamiteHitRock, null, this);
        this.physics.add.overlap(this.dynamites, this.boulders, this.dynamiteHitBoulder, null, this);
        this.physics.add.overlap(this.dynamites, this.bats, this.dynamiteHitBat, null, this);
        this.physics.add.overlap(this.dynamites, this.shards, this.dynamiteHitShard, null, this);
        if (this.walls) {
            this.physics.add.collider(this.dynamites, this.walls, (dynamite) => {
                this.bounceAndExplode(dynamite);
            });
        }
        if (this.doors) {
            this.physics.add.collider(this.dynamites, this.doors, (dynamite) => {
                this.bounceAndExplode(dynamite);
            });
        }

        // Boulder collisions
        this.physics.add.collider(this.boulders, this.rocks, (boulder, rock) => {
            this.trySplitRollingBoulder(boulder, rock);
        });
        this.physics.add.collider(this.boulders, this.boulders, (boulderA, boulderB) => {
            this.trySplitRollingBoulder(boulderA, boulderB);
            this.trySplitRollingBoulder(boulderB, boulderA);
        });

    }

    spawnMapBat(worldX, worldY) {
        if (!this.bats) return;

        const bat = this.bats.create(worldX, worldY, 'bat', 0);
        const batScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        bat.setScale(batScaleFactor);
        bat.setData('baseScale', batScaleFactor);
        bat.setData('flutterPhase', Phaser.Math.FloatBetween(0, Math.PI * 2));
        if (bat.body) {
            bat.body.setSize(Math.floor(bat.displayWidth || bat.width), Math.floor(bat.displayHeight || bat.height));
            bat.body.setCollideWorldBounds(true);
            bat.body.setBounce(1, 1);
        }
        bat.setData('speed', this.getBatSpeedForLevel());
        bat.setData('nextStealAt', 0);
        if (bat.anims) {
            bat.play('bat_fly', true);
        }
        this.setBatRandomVelocity(bat);

        if (!this.batDirectionTimer) {
            this.batDirectionTimer = this.time.addEvent({
                delay: 700,
                loop: true,
                callback: () => {
                    const bats = this.bats?.children?.entries || [];
                    bats.forEach((entry) => {
                        if (!entry || !entry.active) return;
                        if (Math.random() < 0.45) {
                            this.setBatRandomVelocity(entry);
                        }
                    });
                }
            });
        }
    }

    setBatRandomVelocity(bat) {
        if (!bat || !bat.active) return;
        const speed = Number(bat.getData('speed')) || 90;
        const dx = Phaser.Math.FloatBetween(-1, 1);
        const dy = Phaser.Math.FloatBetween(-1, 1);
        const len = Math.hypot(dx, dy) || 1;
        bat.setVelocity((dx / len) * speed, (dy / len) * speed);
    }

    startBatGemCarryAndDrop(bat) {
        if (!bat || !bat.active) {
            this.respawnStolenGemInMap(this.player?.x, this.player?.y);
            return;
        }

        this.releaseBatCarriedGem(bat, false);

        const gemScaleFactor = (CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.62;
        const carriedGem = this.add.sprite(bat.x, bat.y, 'objects', OBJECT_FRAMES.gem);
        carriedGem.setScale(gemScaleFactor);
        carriedGem.setAlpha(0.92);
        carriedGem.setDepth((bat.depth || 0) + 2);

        bat.setData('carriedGemSprite', carriedGem);
        bat.setData('carriedGemDropping', false);
        bat.setData('carriedGemOffsetX', Phaser.Math.Between(-8, 8));
        bat.setData('carriedGemOffsetY', Phaser.Math.Between(-18, -10));

        const dropDelay = Phaser.Math.Between(1200, 2400);
        const dropTimer = this.time.delayedCall(dropDelay, () => {
            if (!bat || !bat.active) {
                if (carriedGem && carriedGem.active) {
                    carriedGem.destroy();
                }
                this.respawnStolenGemInMap(this.player?.x, this.player?.y);
                return;
            }

            const rawTileX = Math.floor((bat.x - this.mapOffsetX) / CONFIG.tileSize);
            const rawTileY = Math.floor((bat.y - this.mapOffsetY) / CONFIG.tileSize);
            const tileX = Phaser.Math.Clamp(rawTileX, 0, this.mapCols - 1);
            const tileY = Phaser.Math.Clamp(rawTileY, 0, this.mapRows - 1);
            const tileType = this.tiles?.[tileY]?.[tileX]?.type;
            const canDropHere = tileType === 'floor' || tileType === 'empty';

            const dropPos = canDropHere
                ? { x: bat.x, y: bat.y }
                : null;

            const fallbackTile = !dropPos ? this.getRandomWalkableTile() : null;
            const dropX = dropPos
                ? dropPos.x
                : (fallbackTile
                    ? this.mapOffsetX + fallbackTile.x * CONFIG.tileSize + CONFIG.tileSize / 2
                    : bat.x);
            const dropY = dropPos
                ? dropPos.y
                : (fallbackTile
                    ? this.mapOffsetY + fallbackTile.y * CONFIG.tileSize + CONFIG.tileSize / 2
                    : bat.y);

            bat.setData('carriedGemDropping', true);
            this.tweens.add({
                targets: carriedGem,
                x: dropX,
                y: dropY,
                scale: gemScaleFactor * 0.95,
                alpha: 1,
                duration: 260,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    if (carriedGem && carriedGem.active) {
                        carriedGem.destroy();
                    }
                    bat.setData('carriedGemSprite', null);
                    bat.setData('carriedGemDropping', false);
                    bat.setData('carriedGemDropTimer', null);
                    this.createGemPickupAt(dropX, dropY);
                }
            });
        });

        bat.setData('carriedGemDropTimer', dropTimer);
    }

    releaseBatCarriedGem(bat, dropToMap = true) {
        if (!bat) return;

        const dropTimer = bat.getData('carriedGemDropTimer');
        if (dropTimer && dropTimer.remove) {
            dropTimer.remove(false);
        }

        const carriedGem = bat.getData('carriedGemSprite');
        if (carriedGem && carriedGem.active) {
            if (dropToMap) {
                this.createGemPickupAt(bat.x, bat.y);
            }
            carriedGem.destroy();
        }

        bat.setData('carriedGemSprite', null);
        bat.setData('carriedGemDropping', false);
        bat.setData('carriedGemDropTimer', null);
    }

    updateBatPerspective() {
        const bats = this.bats?.children?.entries || [];
        if (!bats.length) return;

        const worldTop = this.mapOffsetY;
        const worldHeight = Math.max(1, this.mapRows * CONFIG.tileSize);
        const timeNow = this.time?.now || 0;

        bats.forEach((bat) => {
            if (!bat || !bat.active) return;

            const baseScale = Number(bat.getData('baseScale')) || (CONFIG.objectSize / OBJECT_NATIVE_SIZE);
            const phase = Number(bat.getData('flutterPhase')) || 0;
            const yNorm = Phaser.Math.Clamp((bat.y - worldTop) / worldHeight, 0, 1);

            const perspectiveScale = Phaser.Math.Linear(0.74, 1.22, yNorm);
            const flutterMul = 1 + Math.sin((timeNow / 230) + phase) * 0.04;
            bat.setScale(baseScale * perspectiveScale * flutterMul);

            const carriedGem = bat.getData('carriedGemSprite');
            const isDropping = !!bat.getData('carriedGemDropping');
            if (carriedGem && carriedGem.active) {
                if (!isDropping) {
                    const offX = Number(bat.getData('carriedGemOffsetX')) || 0;
                    const offY = Number(bat.getData('carriedGemOffsetY')) || -14;
                    carriedGem.setPosition(bat.x + offX, bat.y + offY);
                }
                carriedGem.setDepth((bat.depth || 0) + 2);
            }
        });
    }

    getBatCountForLevel() {
        const direct = Number(this.levelData?.bat);
        if (Number.isFinite(direct) && direct > 0) {
            return Math.floor(direct);
        }
        const inMap = Number(this.levelData?.map?.bat);
        if (Number.isFinite(inMap) && inMap > 0) {
            return Math.floor(inMap);
        }
        return 0;
    }

    getBatSpeedForLevel() {
        const direct = Number(this.levelData?.batSpeed);
        if (Number.isFinite(direct) && direct > 0) {
            return direct;
        }
        const inMap = Number(this.levelData?.map?.batSpeed);
        if (Number.isFinite(inMap) && inMap > 0) {
            return inMap;
        }
        return Number(CONFIG.batSpeed) > 0 ? Number(CONFIG.batSpeed) : 90;
    }

    spawnBatsFromMap() {
        if (!this.bats) return;
        const requestedCount = this.getBatCountForLevel();
        if (requestedCount <= 0) return;

        const spawnPositions = Array.isArray(this.batSpawnPositions) ? this.batSpawnPositions : [];
        if (!spawnPositions.length) return;

        for (let i = 0; i < requestedCount; i++) {
            const pos = spawnPositions[i % spawnPositions.length];
            if (!pos) continue;
            this.spawnMapBat(pos.x, pos.y);
        }
    }

    getGhostCountForLevel() {
        const direct = Number(this.levelData?.ghost);
        if (Number.isFinite(direct) && direct > 0) {
            return Math.floor(direct);
        }
        const inMap = Number(this.levelData?.map?.ghost);
        if (Number.isFinite(inMap) && inMap > 0) {
            return Math.floor(inMap);
        }
        return 0;
    }

    getGhostSpeedForLevel() {
        const direct = Number(this.levelData?.ghostSpeed);
        if (Number.isFinite(direct) && direct > 0) {
            return direct;
        }
        const inMap = Number(this.levelData?.map?.ghostSpeed);
        if (Number.isFinite(inMap) && inMap > 0) {
            return inMap;
        }
        return Number(CONFIG.ghostSpeed) > 0 ? Number(CONFIG.ghostSpeed) : 80;
    }

    spawnGhosts() {
        if (!this.ghosts) return;

        const count = this.getGhostCountForLevel();
        if (count <= 0) {
            this.stopGhostSfx();
            return;
        }

        this.startGhostSfx(count);

        const ghostSpeed = this.getGhostSpeedForLevel();
        const spawnPositions = Array.isArray(this.ghostSpawnPositions) ? this.ghostSpawnPositions : [];

        for (let i = 0; i < count; i++) {
            let worldX;
            let worldY;
            if (spawnPositions.length > 0) {
                const pos = spawnPositions[i % spawnPositions.length];
                if (!pos) continue;
                worldX = pos.x;
                worldY = pos.y;
            } else {
                const tile = this.getRandomWalkableTile();
                if (!tile) continue;
                worldX = this.mapOffsetX + tile.x * CONFIG.tileSize + CONFIG.tileSize / 2;
                worldY = this.mapOffsetY + tile.y * CONFIG.tileSize + CONFIG.tileSize / 2;
            }

            const ghost = this.ghosts.create(worldX, worldY, 'ghost', 0);
            const ghostScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
            ghost.setScale(ghostScaleFactor);
            ghost.setData('baseScale', ghostScaleFactor);
            ghost.setData('flutterPhase', Phaser.Math.FloatBetween(0, Math.PI * 2));
            ghost.setData('speed', ghostSpeed);
            if (this.anims.exists('ghost_float')) {
                ghost.play('ghost_float');
            }
            if (ghost.body) {
                ghost.body.setSize(Math.floor(ghost.displayWidth || ghost.width), Math.floor(ghost.displayHeight || ghost.height));
                ghost.body.setCollideWorldBounds(true);
                ghost.body.setBounce(1, 1);
            }

            this.setGhostRandomVelocity(ghost);

            this.tweens.add({
                targets: ghost,
                alpha: 0.55,
                duration: 500,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });

            // Flutter effect: ghosts float up/down and slightly change size
            const hoverAmplitude = Math.max(3, Math.round(CONFIG.tileSize * 0.08));
            this.tweens.add({
                targets: ghost,
                y: ghost.y - hoverAmplitude,
                duration: Phaser.Math.Between(420, 620),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 220)
            });
        }

        this.ghostDirectionTimer = this.time.addEvent({
            delay: 900,
            loop: true,
            callback: () => {
                const ghosts = this.ghosts?.children?.entries || [];
                ghosts.forEach((ghost) => {
                    if (!ghost || !ghost.active) return;
                    if (Math.random() < 0.35) {
                        this.setGhostRandomVelocity(ghost);
                    }
                });
            }
        });
    }

    startGhostSfx(ghostCount = 1) {
        if (!this.sound) return;
        const volume = Phaser.Math.Clamp(0.12 + (Math.max(1, ghostCount) - 1) * 0.035, 0.12, 0.45);
        const existing = this.sound.get('ghost_sfx');
        if (existing) {
            if (existing.setVolume) {
                existing.setVolume(volume);
            }
            if (!existing.isPlaying) {
                existing.play({ loop: true, volume });
            }
        } else {
            this.sound.play('ghost_sfx', { loop: true, volume });
        }
    }

    stopGhostSfx() {
        if (!this.sound) return;
        const sfx = this.sound.get('ghost_sfx');
        if (sfx && sfx.isPlaying) {
            sfx.stop();
        }
    }

    setGhostRandomVelocity(ghost) {
        if (!ghost || !ghost.active) return;
        const speed = Number(ghost.getData('speed')) || 80;
        const dx = Phaser.Math.FloatBetween(-1, 1);
        const dy = Phaser.Math.FloatBetween(-1, 1);
        const len = Math.hypot(dx, dy) || 1;
        ghost.setVelocity((dx / len) * speed, (dy / len) * speed);
    }

    updateGhostPerspective() {
        const ghosts = this.ghosts?.children?.entries || [];
        if (!ghosts.length) return;

        const worldTop = this.mapOffsetY;
        const worldBottom = this.mapOffsetY + this.mapRows * CONFIG.tileSize;
        const worldHeight = Math.max(1, worldBottom - worldTop);

        ghosts.forEach((ghost) => {
            if (!ghost || !ghost.active) return;

            const baseScale = Number(ghost.getData('baseScale')) || (CONFIG.objectSize / OBJECT_NATIVE_SIZE);
            const phase = Number(ghost.getData('flutterPhase')) || 0;

            // Foreground perspective: lower on screen => bigger
            const yNorm = Phaser.Math.Clamp((ghost.y - worldTop) / worldHeight, 0, 1);
            const perspectiveScale = 0.82 + yNorm * 0.38;

            // Continuous flutter scaling
            const flutterScale = 1 + Math.sin(this.time.now * 0.006 + phase) * 0.06;

            const finalScale = baseScale * perspectiveScale * flutterScale;
            ghost.setScale(finalScale);
        });
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys({
            w: Phaser.Input.Keyboard.KeyCodes.W,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            d: Phaser.Input.Keyboard.KeyCodes.D,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE,
            l: Phaser.Input.Keyboard.KeyCodes.L
        });

        this.lastDynamiteTime = 0;
        this.lastStepSoundTime = 0;
    }

    activateCompanionHelper(durationMs = 20000) {
        const helperDuration = Number(durationMs) > 0 ? Number(durationMs) : 20000;

        if (!this.companionSprite || !this.companionSprite.active) {
            const scaleFactor = (Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE) / OBJECT_NATIVE_SIZE;
            this.companionSprite = this.add.sprite(
                (this.player?.x || 0) + CONFIG.tileSize * 0.8,
                this.player?.y || 0,
                'objects',
                OBJECT_FRAMES.wall
            );
            this.companionSprite.setScale(scaleFactor);
            this.companionSprite.setAlpha(0.95);
            this.companionSprite.setDepth((this.player?.depth || 0) + 1);
        }

        if (this.companionExpireEvent) {
            this.companionExpireEvent.remove(false);
        }

        this.companionExpireEvent = this.time.delayedCall(helperDuration, () => {
            this.deactivateCompanionHelper();
        });

        this.tweens.add({
            targets: this.companionSprite,
            alpha: 0.7,
            duration: 180,
            yoyo: true,
            repeat: 2
        });
    }

    deactivateCompanionHelper() {
        if (this.companionExpireEvent) {
            this.companionExpireEvent.remove(false);
            this.companionExpireEvent = null;
        }

        if (this.companionSprite && this.companionSprite.active) {
            this.companionSprite.destroy();
        }
        this.companionSprite = null;
    }

    updateCompanionPosition() {
        if (!this.companionSprite || !this.companionSprite.active || !this.player || !this.player.active) return;

        const side = CONFIG.tileSize * 0.8;
        const targetX = this.player.x + side;
        const targetY = this.player.y;

        this.companionSprite.x = Phaser.Math.Linear(this.companionSprite.x, targetX, 0.28);
        this.companionSprite.y = Phaser.Math.Linear(this.companionSprite.y, targetY, 0.28);
    }

    shootCompanionDynamite(dirX, dirY, dynamiteDisplaySize, baseSpeed, launchSpeed, cruiseSpeed) {
        if (!this.companionSprite || !this.companionSprite.active || !this.dynamites) return;

        const dynamite = this.dynamites.create(this.companionSprite.x, this.companionSprite.y, 'objects', OBJECT_FRAMES.dynamite_projectile);
        dynamite.setDisplaySize(dynamiteDisplaySize * 1.12, dynamiteDisplaySize * 1.12);
        dynamite.setTint(0x99ffee);

        this.tweens.add({
            targets: dynamite,
            displayWidth: dynamiteDisplaySize,
            displayHeight: dynamiteDisplaySize,
            duration: 260,
            ease: 'Quad.easeOut'
        });

        if (dynamite.body) {
            dynamite.body.setSize(Math.floor(dynamite.displayWidth || dynamite.width), Math.floor(dynamite.displayHeight || dynamite.height));
            dynamite.body.onWorldBounds = true;
        }

        dynamite.setVelocity(dirX * launchSpeed, dirY * launchSpeed);
        dynamite.setDamping(true);
        dynamite.setDrag(baseSpeed * 2.4, baseSpeed * 2.4);
        dynamite.setBounce(1, 1);
        dynamite.setCollideWorldBounds(true);

        this.time.delayedCall(380, () => {
            if (!dynamite || !dynamite.active) return;
            dynamite.setDrag(baseSpeed * 0.4, baseSpeed * 0.4);
            const vx = dynamite.body?.velocity?.x || 0;
            const vy = dynamite.body?.velocity?.y || 0;
            const speedNow = Math.hypot(vx, vy);
            if (speedNow > cruiseSpeed && speedNow > 0.0001) {
                const scale = cruiseSpeed / speedNow;
                dynamite.setVelocity(vx * scale, vy * scale);
            }
        });

        this.tweens.add({
            targets: dynamite,
            angle: 12,
            duration: 180,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.attachDynamiteSmokeTrail(dynamite);

        this.time.delayedCall(CONFIG.dynamiteLifetime, () => {
            if (dynamite.active) {
                this.explodeDynamite(dynamite);
            }
        });
    }

    createUI() {
        console.log('Creating UI with language:', GAME_STATE.language);
        const t = TRANSLATIONS[GAME_STATE.language];

        if (this.hudContainer && this.hudContainer.destroy && this.hudContainer.active) {
            this.hudContainer.destroy(true);
        }
        this.hudContainer = null;

        if (!this.hudContainer || !this.hudContainer.active) {
            this.hudContainer = this.add.container(0, 0);
        }
        this.hudContainer.setScrollFactor(0);

        // Create HUD text objects and add them to the HUD container.
        const cam = this.cameras?.main;
        const camW = (cam && cam.width) ? cam.width : (this.scale.width || CONFIG.width);
        const camH = (cam && cam.height) ? cam.height : (this.scale.height || CONFIG.height);

        this.scoreText = this.add.text(10, 10, `${t.score_label}: ${GAME_STATE.score}`, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: GAME_FONT
        });
        this.hudContainer.add(this.scoreText);
        this.levelText = this.add.text(camW - 10, 10, `${t.level_label}: ${GAME_STATE.currentLevel + 1}`, {
            fontSize: '16px',
            fill: '#00ff00',
            fontFamily: GAME_FONT
        }).setOrigin(1, 0);
        this.hudContainer.add(this.levelText);

        // Timer pepitas: create background (full-color) icons and a disabled overlay
        // that will progressively gray out elapsed slots.
        this.timerPepitas = []; // background (full-color)
        this.timerPepitasDisabled = []; // overlay (grayed) shown for elapsed slots
        this.timerPepitasCount = 20;
        const pepitaSize = 12;
        const pepitaGap = 1;
        const pepitaY = camH - 16;
        this.timerLabel = this.add.text(10, pepitaY, 'TIMER', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: GAME_FONT
        }).setOrigin(0, 0.5);
        this.hudContainer.add(this.timerLabel);
        const timerLabelWidth = Number(this.timerLabel?.width) || 52;
        const pepitaStartX = 10 + timerLabelWidth + 8;
        for (let i = 0; i < this.timerPepitasCount; i++) {
            // background full-color pepita
            const pepita = this.add.sprite(
                pepitaStartX + i * (pepitaSize + pepitaGap),
                pepitaY,
                'objects',
                OBJECT_FRAMES.pepita
            );
            // scale timer icons according to objectSize (pixels)
            // Note: keep existing relative sizing behaviour but applied to both layers
            const pepitaScaleFactor = (CONFIG.objectSize / OBJECT_NATIVE_SIZE) * (pepitaSize / OBJECT_NATIVE_SIZE);
            pepita.setScale(pepitaScaleFactor);
            pepita.setScrollFactor(0);
            pepita.setDepth(2000);
            pepita.setVisible(false);
            this.hudContainer.add(pepita);
            this.timerPepitas.push(pepita);

            // disabled overlay (tinted gray) placed above the background
            const disabled = this.add.sprite(
                pepita.x,
                pepita.y,
                'objects',
                OBJECT_FRAMES.pepita
            );
            disabled.setScale(pepitaScaleFactor);
            disabled.setScrollFactor(0);
            // tint to gray to give a "disabled" appearance and slightly lower alpha
            disabled.setTint(0x888888);
            disabled.setAlpha(0.95);
            disabled.setDepth(pepita.depth + 1);
            disabled.setVisible(false);
            this.hudContainer.add(disabled);
            this.timerPepitasDisabled.push(disabled);
        }

    this.hudContainer.setDepth(2000);
    // Hide timer label initially
    this.timerLabel.setVisible(false);
        // Hide both layers initially
    this.timerPepitas.forEach((p) => p.setVisible(false));
    if (this.timerPepitasDisabled) this.timerPepitasDisabled.forEach((d) => d.setVisible(false));

        this.topStatsObjects = [];
        this.refreshHudIcons();
        this.createObjectivePointerUI();
        // Ensure HUD elements are laid out according to current camera size
        if (this.updateHudLayout) this.updateHudLayout();

        // --- DOM HUD: create or update overlay elements for responsive UI ---
        try {
            const scoreElId = 'scoreDisplay';
            const levelElId = 'levelDisplay';
            let scoreEl = document.getElementById(scoreElId);
            let levelEl = document.getElementById(levelElId);
            if (!scoreEl) {
                // fallback: create minimal DOM HUD if index.html not updated
                const domHud = document.getElementById('dom-hud') || document.createElement('div');
                domHud.id = 'dom-hud';
                document.body.appendChild(domHud);
                scoreEl = document.createElement('div');
                scoreEl.id = scoreElId;
                scoreEl.className = 'dom-hud-item';
                domHud.appendChild(scoreEl);
            }
            if (!levelEl) {
                const domHud = document.getElementById('dom-hud') || document.createElement('div');
                domHud.id = 'dom-hud';
                document.body.appendChild(domHud);
                levelEl = document.createElement('div');
                levelEl.id = levelElId;
                levelEl.className = 'dom-hud-item';
                domHud.appendChild(levelEl);
            }
            scoreEl.textContent = `${t.score_label}: ${GAME_STATE.score}`;
            levelEl.textContent = `${t.level_label}: ${GAME_STATE.currentLevel + 1}`;
        } catch (e) {
            // noop
        }
    }

    updateHudLayout() {
        const cam = this.cameras?.main;
        const camW = (cam && cam.width) ? cam.width : (this.scale.width || CONFIG.width);
        const camH = (cam && cam.height) ? cam.height : (this.scale.height || CONFIG.height);

        if (this.levelText) {
            this.levelText.setX(camW - 10);
        }
        if (this.timerLabel) {
            this.timerLabel.setY(camH - 16);
        }
        // reposition pepitas and disabled overlays
        if (this.timerPepitas && this.timerPepitas.length > 0) {
            const timerLabelWidth = Number(this.timerLabel?.width) || 52;
            const pepitaStartX = 10 + timerLabelWidth + 8;
            const pepitaSize = 12;
            const pepitaGap = 1;
            for (let i = 0; i < this.timerPepitas.length; i++) {
                const px = pepitaStartX + i * (pepitaSize + pepitaGap);
                const py = camH - 16;
                const p = this.timerPepitas[i];
                const d = this.timerPepitasDisabled[i];
                if (p) { p.setPosition(px, py); }
                if (d) { d.setPosition(px, py); }
            }
        }
    }

    createObjectivePointerUI() {
        const camera = this.cameras?.main;
        if (!camera) return;

        const centerX = camera.width - 72;
        const arrowY = camera.height - 54;

        const previousTargets = [
            this.objectivePointerArrow,
            this.objectivePointerArrowShadow,
            this.objectivePointerHalo,
            this.objectivePointerLabel
        ].filter(Boolean);

        if (this.objectivePointerPulse) {
            try {
                if (this.objectivePointerPulse.stop) {
                    this.objectivePointerPulse.stop();
                }
            } catch (e) {
                // ignore stale tween state
            }
            this.objectivePointerPulse = null;
        }

        if (previousTargets.length > 0 && this.tweens && this.tweens.killTweensOf) {
            try {
                this.tweens.killTweensOf(previousTargets);
            } catch (e) {
                // ignore if tween manager already disposed target internals
            }
        }

        if (this.objectivePointerArrow && this.objectivePointerArrow.destroy) {
            this.objectivePointerArrow.destroy();
        }
        if (this.objectivePointerArrowShadow && this.objectivePointerArrowShadow.destroy) {
            this.objectivePointerArrowShadow.destroy();
        }
        if (this.objectivePointerHalo && this.objectivePointerHalo.destroy) {
            this.objectivePointerHalo.destroy();
        }
        if (this.objectivePointerLabel && this.objectivePointerLabel.destroy) {
            this.objectivePointerLabel.destroy();
        }

        this.objectivePointerHalo = this.add.circle(centerX, arrowY, 42, 0x000000, 0.18)
            .setDepth(4998)
            .setScrollFactor(0);

        this.objectivePointerArrowShadow = this.add.triangle(
            centerX + 2,
            arrowY + 2,
            0, 0,
            54, 22,
            0, 44,
            0x000000,
            0.38
        ).setOrigin(0.5).setDepth(4999).setScrollFactor(0);

        this.objectivePointerArrow = this.add.triangle(
            centerX,
            arrowY,
            0, 0,
            50, 20,
            0, 40,
            0xffe36b,
            0.48
        ).setOrigin(0.5).setDepth(5000).setScrollFactor(0);

        this.objectivePointerLabel = this.add.text(centerX, arrowY - 24, 'GEM', {
            fontSize: '13px',
            fill: '#fff2b3',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(5000).setScrollFactor(0).setAlpha(0.55);

        this.objectivePointerPulse = this.tweens.add({
            targets: [this.objectivePointerArrow, this.objectivePointerArrowShadow, this.objectivePointerHalo, this.objectivePointerLabel],
            scaleX: { from: 0.98, to: 1.04 },
            scaleY: { from: 0.98, to: 1.04 },
            duration: 560,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                if (this.objectivePointerHalo && this.objectivePointerHalo.active && this.objectivePointerArrow && this.objectivePointerArrow.active) {
                    const alphaPulse = 0.12 + ((this.objectivePointerArrow.scaleX - 0.98) / 0.06) * 0.1;
                    this.objectivePointerHalo.setAlpha(Phaser.Math.Clamp(alphaPulse, 0.1, 0.22));
                }
            }
        });
    }

    getNearestPoint(originX, originY, points) {
        if (!Array.isArray(points) || points.length === 0) return null;
        let nearest = null;
        let nearestDistSq = Number.POSITIVE_INFINITY;

        for (const point of points) {
            if (!point) continue;
            const px = Number(point.x);
            const py = Number(point.y);
            if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
            const dx = px - originX;
            const dy = py - originY;
            const distSq = (dx * dx) + (dy * dy);
            if (distSq < nearestDistSq) {
                nearestDistSq = distSq;
                nearest = { x: px, y: py };
            }
        }

        return nearest;
    }

    getObjectivePointerTarget() {
        const originX = Number(this.player?.x) || 0;
        const originY = Number(this.player?.y) || 0;

        if ((Number(this.gemsRemaining) || 0) > 0) {
            const activeGems = (this.gems?.children?.entries || []).filter((gem) => gem && gem.active);
            const gemTarget = this.getNearestPoint(originX, originY, activeGems);
            if (gemTarget) {
                return { type: 'gem', x: gemTarget.x, y: gemTarget.y };
            }

            if (Array.isArray(this.mapGemPositions) && this.mapGemPositions.length > 0) {
                const index = Phaser.Math.Clamp(Number(this.mapGemIndex) || 0, 0, this.mapGemPositions.length - 1);
                const nextGem = this.mapGemPositions[index];
                if (nextGem && Number.isFinite(Number(nextGem.x)) && Number.isFinite(Number(nextGem.y))) {
                    return { type: 'gem', x: Number(nextGem.x), y: Number(nextGem.y) };
                }
            }
        }

        if (this.hole2ExitsActive) {
            const activeExits = (this.hole2Exits?.children?.entries || []).filter((exitObj) => exitObj && exitObj.active);
            const exitTarget = this.getNearestPoint(originX, originY, activeExits);
            if (exitTarget) {
                return { type: 'exit', x: exitTarget.x, y: exitTarget.y };
            }

            const fallbackExit = this.getNearestPoint(originX, originY, this.hole2ExitPositions);
            if (fallbackExit) {
                return { type: 'exit', x: fallbackExit.x, y: fallbackExit.y };
            }
        }

        return null;
    }

    updateObjectivePointerUI() {
        if (!this.objectivePointerArrow || !this.objectivePointerArrow.active) return;
        if (!this.objectivePointerLabel || !this.objectivePointerLabel.active) return;
        if (!this.player || !this.player.active) return;

        const target = this.getObjectivePointerTarget();
        if (!target) {
            this.objectivePointerArrow.setVisible(false);
            if (this.objectivePointerArrowShadow) this.objectivePointerArrowShadow.setVisible(false);
            if (this.objectivePointerHalo) this.objectivePointerHalo.setVisible(false);
            this.objectivePointerLabel.setVisible(false);
            return;
        }

        this.objectivePointerArrow.setVisible(true);
        if (this.objectivePointerArrowShadow) this.objectivePointerArrowShadow.setVisible(true);
        if (this.objectivePointerHalo) this.objectivePointerHalo.setVisible(true);
        this.objectivePointerLabel.setVisible(true);
        const targetLabel = target.type === 'gem' ? 'GEM' : 'EXIT';
        if (this.objectivePointerLabel.text !== targetLabel) {
            this.objectivePointerLabel.setText(targetLabel);
        }

        const dx = target.x - this.player.x;
        const dy = target.y - this.player.y;
        const angle = Math.atan2(dy, dx);
        this.objectivePointerArrow.setRotation(angle);
        if (this.objectivePointerArrowShadow) {
            this.objectivePointerArrowShadow.setRotation(angle);
        }
    }

    showLevelObjective() {
        const objectiveLabel = this.levelData?.objectiveLabel;
        if (!objectiveLabel || typeof objectiveLabel !== 'string') return;

        const t = TRANSLATIONS[GAME_STATE.language] || {};
        const objectiveText = t[objectiveLabel] || objectiveLabel;
        if (!objectiveText || typeof objectiveText !== 'string') return;

        const x = this.cameras.main.width / 2;
        const y = 64;
        const textObj = this.add.text(x, y, objectiveText, {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: GAME_FONT,
            align: 'center',
            stroke: '#000000',
            strokeThickness: 3,
            wordWrap: { width: Math.max(320, this.cameras.main.width - 80), useAdvancedWrap: true }
        }).setOrigin(0.5).setDepth(2100).setScrollFactor(0);

        const panel = this.add.graphics();
        drawTextPanel(panel, textObj, { paddingX: 14, paddingY: 10, radius: 8 });
        panel.setDepth(2099);
        panel.setScrollFactor(0);

        this.tweens.add({
            targets: [textObj, panel],
            alpha: 0,
            duration: 900,
            delay: 2800,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                if (textObj && textObj.destroy) textObj.destroy();
                if (panel && panel.destroy) panel.destroy();
            }
        });
    }

    setupLevelTimer() {
        const seconds = Number(this.levelData?.timer ?? this.levelData?.map?.timer);
        if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) {
            return;
        }

        this.levelTimeTotal = seconds * 1000;
        this.levelTimeRemaining = this.levelTimeTotal;

        if (this.timerPepitas && this.timerPepitas.length > 0) {
            if (this.timerLabel) {
                this.timerLabel.setVisible(true);
            }
            // Show background icons and hide disabled overlays initially; updateTimerBar will set disabled visibility correctly
            this.timerPepitas.forEach((p) => p.setVisible(true));
            if (this.timerPepitasDisabled) this.timerPepitasDisabled.forEach((d) => d.setVisible(false));
            this.updateTimerBar();
        }

        if (this.levelTimerEvent) {
            this.levelTimerEvent.remove();
        }

        this.levelTimerEvent = this.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                if (this.levelTimeRemaining <= 0) return;
                this.levelTimeRemaining -= 100;
                if (this.levelTimeRemaining <= 0) {
                    this.levelTimeRemaining = 0;
                    this.updateTimerBar();
                    this.onLevelTimeout();
                } else {
                    this.updateTimerBar();
                }
            }
        });
    }

    setupLevelLightEffect() {
        this.stopLevelLightEffect();

        const lightModeRaw = this.levelData?.light ?? this.levelConfig?.light;
        const lightMode = String(lightModeRaw || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        if (!lightMode) {
            return;
        }

        const isOff = lightMode === 'spenta' || lightMode === 'off';
        const isFull = lightMode === 'piena' || lightMode === 'full';
        const isFixed = lightMode === 'fissa' || lightMode === 'fixed';
        const isFlash = lightMode.startsWith('flash') || lightMode.includes('lampo') || lightMode === 'lightning';

        if (isFull) {
            this.isRoomDark = false;
            this.headlampEnabled = false;
            return;
        }

        this.levelLightOverlay = this.add.rectangle(
            CONFIG.width / 2,
            CONFIG.height / 2,
            CONFIG.width,
            CONFIG.height,
            0x000000
        );
        this.levelLightOverlay.setScrollFactor(0);
        this.levelLightOverlay.setDepth(1800);

        if (isOff) {
            this.levelLightOverlay.setAlpha(0.82);
            this.isRoomDark = true;
            this.headlampEnabled = false;
            this.setupHeadlampMask();
            return;
        }

        this.isRoomDark = false;
        this.headlampEnabled = false;

        if (isFixed) {
            this.levelLightOverlay.setAlpha(0.48);
            return;
        }

        if (isFlash) {
            this.levelLightOverlay.setAlpha(0.56);
            this.levelLightTimer = this.time.addEvent({
                delay: 1300,
                loop: true,
                callback: () => {
                    if (!this.levelLightOverlay || !this.levelLightOverlay.active) return;
                    const overlay = this.levelLightOverlay;
                    overlay.setFillStyle(0xffffff, 1);
                    overlay.setAlpha(0);
                    this.tweens.add({
                        targets: overlay,
                        alpha: 0.24,
                        duration: 35,
                        yoyo: true,
                        repeat: 1,
                        ease: 'Linear',
                        onComplete: () => {
                            if (!overlay || !overlay.active) return;
                            overlay.setFillStyle(0x000000, 1);
                            overlay.setAlpha(0.56);
                        }
                    });
                }
            });
            return;
        }

        // Default / 'tremolante'
        this.levelLightOverlay.setAlpha(0.52);
        this.levelLightTimer = this.time.addEvent({
            delay: 120,
            loop: true,
            callback: () => {
                if (!this.levelLightOverlay || !this.levelLightOverlay.active) return;
                const flickerAlpha = Phaser.Math.FloatBetween(0.42, 0.62);
                this.levelLightOverlay.setAlpha(flickerAlpha);
            }
        });
    }

    setupHeadlampMask() {
        if (!this.levelLightOverlay || !this.isRoomDark) return;

        if (this.headlampMaskGraphics) {
            this.headlampMaskGraphics.destroy();
            this.headlampMaskGraphics = null;
        }

        this.headlampMaskGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        this.levelLightMask = this.headlampMaskGraphics.createGeometryMask();
        this.levelLightMask.invertAlpha = true;
        this.levelLightOverlay.setMask(this.levelLightMask);
        this.updateHeadlampCone();
    }

    toggleHeadlamp() {
        if (!this.isRoomDark) return;
        this.headlampEnabled = !this.headlampEnabled;
        this.updateHeadlampCone();
    }

    getHeadlampDirectionVector() {
        const facing = this.playerFacing || 'front';
        if (facing === 'back') return { x: 0, y: -1 };
        if (facing === 'right') return { x: 1, y: 0 };
        if (facing === 'left') return { x: -1, y: 0 };
        if (facing === 'back_right') return { x: 0.707, y: -0.707 };
        if (facing === 'back_left') return { x: -0.707, y: -0.707 };

        const dx = this.lastMoveDir?.x ?? 0;
        const dy = this.lastMoveDir?.y ?? 1;
        const len = Math.hypot(dx, dy) || 1;
        return { x: dx / len, y: dy / len };
    }

    updateHeadlampCone() {
        if (!this.headlampMaskGraphics) return;

        this.headlampMaskGraphics.clear();

        if (!this.headlampEnabled || !this.player || !this.player.active || !this.isRoomDark) {
            return;
        }

        const camera = this.cameras.main;
        const px = this.player.x - camera.worldView.x;
        const py = this.player.y - camera.worldView.y;

        const direction = this.getHeadlampDirectionVector();
        const baseAngle = Math.atan2(direction.y, direction.x);
        const range = CONFIG.tileSize * 4.8;

        // Soft cone gradient: bright center + fading edges
        const drawConeLayer = (halfAngleDeg, rangeMul, alpha) => {
            const halfAngle = Phaser.Math.DegToRad(halfAngleDeg);
            const layerRange = range * rangeMul;
            const points = [{ x: px, y: py }];
            const segments = 22;
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const angle = baseAngle - halfAngle + t * (halfAngle * 2);
                points.push({
                    x: px + Math.cos(angle) * layerRange,
                    y: py + Math.sin(angle) * layerRange
                });
            }
            this.headlampMaskGraphics.fillStyle(0xffffff, alpha);
            this.headlampMaskGraphics.fillPoints(points, true);
        };

        // Outer soft spill
        drawConeLayer(40, 1.0, 0.28);
        // Mid cone
        drawConeLayer(30, 0.93, 0.48);
        // Bright core
        drawConeLayer(18, 0.86, 0.9);

        // Glow near the helmet (center brightest)
        this.headlampMaskGraphics.fillStyle(0xffffff, 1);
        this.headlampMaskGraphics.fillCircle(px, py, Math.max(14, CONFIG.tileSize * 0.62));
        this.headlampMaskGraphics.fillStyle(0xffffff, 0.45);
        this.headlampMaskGraphics.fillCircle(px, py, Math.max(20, CONFIG.tileSize * 0.95));
    }

    stopLevelLightEffect() {
        if (this.levelLightTimer) {
            this.levelLightTimer.remove();
            this.levelLightTimer = null;
        }
        if (this.levelLightOverlay) {
            this.levelLightOverlay.clearMask();
        }
        if (this.headlampMaskGraphics) {
            this.headlampMaskGraphics.destroy();
            this.headlampMaskGraphics = null;
        }
        this.levelLightMask = null;
        this.isRoomDark = false;
        this.headlampEnabled = false;
        if (this.levelLightOverlay) {
            this.levelLightOverlay.destroy();
            this.levelLightOverlay = null;
        }
    }

    updateTimerBar() {
        if (!this.timerPepitas || !this.timerPepitas.length || !this.levelTimeTotal) return;
        const ratio = Phaser.Math.Clamp(this.levelTimeRemaining / this.levelTimeTotal, 0, 1);
        const activeCount = Math.ceil(ratio * this.timerPepitasCount);
        for (let i = 0; i < this.timerPepitas.length; i++) {
            // Background always visible when timer active
            this.timerPepitas[i].setVisible(true);
            // Disabled overlay is visible for elapsed slots (i >= activeCount)
            if (this.timerPepitasDisabled && this.timerPepitasDisabled[i]) {
                this.timerPepitasDisabled[i].setVisible(i >= activeCount);
            }
        }
    }

    onLevelTimeout() {
        this.loseLife();
        if (GAME_STATE.lives > 0) {
            this.levelTimeRemaining = this.levelTimeTotal;
            this.updateTimerBar();
        }
    }

    update(time, delta) {
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
        } catch (e) {}

        if (this.cursors.left.isDown || this.keys.a.isDown) velocityX = -1;
        if (this.cursors.right.isDown || this.keys.d.isDown) velocityX = 1;
        if (this.cursors.up.isDown || this.keys.w.isDown) velocityY = -1;
        if (this.cursors.down.isDown || this.keys.s.isDown) velocityY = 1;

        if (velocityX !== 0 || velocityY !== 0) {
            this.lastMoveDir = {
                x: Math.sign(velocityX),
                y: Math.sign(velocityY)
            };
        }

        // Normalize diagonal movement
        if (velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707;
            velocityY *= 0.707;
        }

        let speed = CONFIG.playerSpeed;
        if (this.playerSlowFactor && this.playerSlowFactor !== 1) {
            speed *= this.playerSlowFactor;
        }
        if (this.cartPowerActive) {
            speed *= 2;
        }

        // Check if on sand
        const tile = this.getTileAt(this.player.x, this.player.y);
        if (tile && tile.type === 'sand') {
            speed *= 0.6;
        }

        this.player.setVelocity(velocityX * speed, velocityY * speed);

        // Directional walk animations: down/front, up/back, right/right, left/right+flipX
        const isMoving = velocityX !== 0 || velocityY !== 0;
        if (isMoving) {
            const stepInterval = 180;
            if (!this.lastStepSoundTime || (this.time.now - this.lastStepSoundTime) >= stepInterval) {
                this.sound.play('step_sfx', { volume: 0.34 });
                this.lastStepSoundTime = this.time.now;
            }
        }
        if (isMoving) {
            let nextFacing = this.playerFacing || 'front';
            if (Math.abs(velocityX) > Math.abs(velocityY)) {
                const verticalFacing = this.playerVerticalFacing || 'front';
                if (verticalFacing === 'back') {
                    nextFacing = velocityX > 0 ? 'back_right' : 'back_left';
                } else {
                    nextFacing = velocityX > 0 ? 'right' : 'left';
                }
            } else {
                nextFacing = velocityY < 0 ? 'back' : 'front';
                this.playerVerticalFacing = nextFacing;
            }
            this.playerFacing = nextFacing;

            let animKey = 'player_front_walk';
            if (nextFacing === 'back') animKey = 'player_back_walk';
            else if (nextFacing === 'back_right' || nextFacing === 'back_left') animKey = 'player_back_right_walk';
            else if (nextFacing === 'right' || nextFacing === 'left') animKey = 'player_right_walk';

            if (!this.player.anims.isPlaying || this.player.anims.currentAnim?.key !== animKey) {
                this.player.anims.play(animKey, true);
            }
            this.player.setFlipX(nextFacing === 'left' || nextFacing === 'back_left');
        } else {
            const currentAnimKey = this.player.anims.currentAnim?.key;
            if (this.player.anims.isPlaying && (currentAnimKey === 'player_front_walk' || currentAnimKey === 'player_back_walk' || currentAnimKey === 'player_right_walk' || currentAnimKey === 'player_back_right_walk')) {
                this.player.anims.stop();
            }

            const facing = this.playerFacing || 'front';
            if (facing === 'back') {
                this.player.setTexture('player_back', 0);
                this.player.setFlipX(false);
            } else if (facing === 'back_right') {
                this.player.setTexture('player_back_right', 0);
                this.player.setFlipX(false);
            } else if (facing === 'back_left') {
                this.player.setTexture('player_back_right', 0);
                this.player.setFlipX(true);
            } else if (facing === 'right') {
                this.player.setTexture('player_right', 0);
                this.player.setFlipX(false);
            } else if (facing === 'left') {
                this.player.setTexture('player_right', 0);
                this.player.setFlipX(true);
            } else {
                this.player.setTexture('player_front', 0);
                this.player.setFlipX(false);
            }
        }

        // Shoot dynamite (keyboard space OR touch action button)
        try {
            const touch = (window && window.TOUCH_INPUT) ? window.TOUCH_INPUT : null;
            const touchAction = !!(touch && touch.action);
            if (Phaser.Input.Keyboard.JustDown(this.keys.space) || (touchAction && !this._lastTouchAction)) {
                this.shootDynamite();
            }
            // remember last touch action state for edge detection
            this._lastTouchAction = touchAction;
        } catch (e) {
            // If anything goes wrong reading touch input, fall back to keyboard only
            if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
                this.shootDynamite();
            }
        }

        this.updateCompanionPosition();

        // Toggle miner headlamp when room light is off
        if (Phaser.Input.Keyboard.JustDown(this.keys.l)) {
            this.toggleHeadlamp();
        }

        // Check if on hole
        if (tile && tile.type === 'hole') {
            this.hitHole();
        }

        // Check proximity to doors for opening
        this.checkDoorProximity();

        // Update headlamp cone to follow player/camera direction
        if (this.isRoomDark && this.headlampEnabled) {
            this.updateHeadlampCone();
        }

        // Ghost visual perspective update (foreground ghosts look bigger)
        this.updateGhostPerspective();
        this.updateBatPerspective();

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

        // Update UI
        this.updateUITexts();
    }

    checkDoorProximity() {
        if (!this.doors || !this.player) return;
        const doors = this.doors.children?.entries || [];
        for (const door of doors) {
            if (!door || !door.active) continue;
            if (!door.getData('locked')) continue;
            if (door.getData('opening')) continue;
            if (GAME_STATE.keysCount <= 0) continue;

            const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);
            if (dist <= CONFIG.tileSize * 1.1) {
                this.tryOpenDoor(this.player, door);
                break;
            }
        }
    }

    onPlayerDoorCollide(player, door) {
        this.tryOpenDoor(player, door);
    }

    getTileAt(x, y) {
        const gridX = Math.floor((x - this.mapOffsetX) / CONFIG.tileSize);
        const gridY = Math.floor((y - this.mapOffsetY) / CONFIG.tileSize);

        if (gridY >= 0 && gridY < this.tiles.length && gridX >= 0 && gridX < this.tiles[0].length) {
            return this.tiles[gridY][gridX];
        }
        return null;
    }

    revealHiddenMapObjects(centerX, centerY, radius) {
        if (!this.tiles || !this.tiles.length) return;
        const maxDist = Number(radius) || CONFIG.tileSize;

        for (let gridY = 0; gridY < this.tiles.length; gridY++) {
            for (let gridX = 0; gridX < this.tiles[gridY].length; gridX++) {
                const tile = this.tiles[gridY]?.[gridX];
                if (!tile || !tile.hiddenReveal || tile.hiddenRevealed) continue;

                const worldX = this.mapOffsetX + gridX * CONFIG.tileSize + CONFIG.tileSize / 2;
                const worldY = this.mapOffsetY + gridY * CONFIG.tileSize + CONFIG.tileSize / 2;
                const dist = Phaser.Math.Distance.Between(centerX, centerY, worldX, worldY);
                if (dist > maxDist) continue;

                if (tile.coverSprite && tile.coverSprite.active) {
                    tile.coverSprite.destroy();
                }

                this.spawnRevealedCellObject(gridX, gridY, tile.hiddenReveal);
                tile.hiddenRevealed = true;
                tile.hiddenReveal = null;
                tile.coverSprite = null;
            }
        }
    }

    revealHiddenAtGrid(gridX, gridY) {
        if (typeof gridX !== 'number' || typeof gridY !== 'number') return;
        const tile = this.tiles?.[gridY]?.[gridX];
        if (!tile || !tile.hiddenReveal || tile.hiddenRevealed) return;

        if (tile.coverSprite && tile.coverSprite.active) {
            tile.coverSprite.destroy();
        }

        this.spawnRevealedCellObject(gridX, gridY, tile.hiddenReveal);
        tile.hiddenRevealed = true;
        tile.hiddenReveal = null;
        tile.coverSprite = null;
    }

    spawnRevealedCellObject(gridX, gridY, revealCell) {
        if (!revealCell || typeof revealCell.type !== 'string') return;

        const worldX = this.mapOffsetX + gridX * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + gridY * CONFIG.tileSize + CONFIG.tileSize / 2;
        const revealType = revealCell.type;

        const TILE_FRAMES = {
            hole: 1,
            sand: 2,
            floor: 3,
            stone: 4,
            hole2: 5
        };

        const createItemFromType = (itemType) => {
            if (!this.items) return;
            const frame = itemType === 'key'
                ? OBJECT_FRAMES.key
                : (itemType === 'pepita'
                    ? OBJECT_FRAMES.pepita
                    : (itemType === 'dynamite'
                        ? OBJECT_FRAMES.dynamite_chest
                        : (itemType === 'cart' ? OBJECT_FRAMES.cart : OBJECT_FRAMES.wall)));
            const itemSprite = this.items.create(worldX, worldY, 'objects', frame);
            const objectScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
            itemSprite.setScale(objectScaleFactor);
            if (itemSprite.body) {
                itemSprite.body.setSize(Math.floor(itemSprite.displayWidth || itemSprite.width), Math.floor(itemSprite.displayHeight || itemSprite.height));
            }
            itemSprite.setData('type', itemType);
            itemSprite.setData('gridX', gridX);
            itemSprite.setData('gridY', gridY);
            if (itemType === 'key') {
                this.applyKeyFloatingEffect(itemSprite);
            }

            if (itemType === 'key' && this.keySpawnPositions) {
                this.keySpawnPositions.push({ x: itemSprite.x, y: itemSprite.y });
            }
        };

        if (revealType === 'wall') {
            const revealWallMaxFrame = getTextureMaxNumericFrame(this, 'wall_tiles', 6);
            const clampedRevealWallFrame = Phaser.Math.Clamp(Number(revealCell.wallFrame) || 0, 0, revealWallMaxFrame);
            const wallSprite = this.add.sprite(worldX, worldY, 'wall_tiles', clampedRevealWallFrame);
            wallSprite.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
            if (revealCell.wallRotation) {
                wallSprite.setAngle((revealCell.wallRotation || 0) * 90);
            }
            if (this.walls) {
                this.walls.add(wallSprite);
                if (wallSprite.body) {
                    wallSprite.body.setSize(Math.floor(wallSprite.displayWidth || wallSprite.width), Math.floor(wallSprite.displayHeight || wallSprite.height));
                }
            }
            this.tiles[gridY][gridX].type = 'wall';
            this.tiles[gridY][gridX].sprite = wallSprite;
            return;
        }

        if (revealType === 'door') {
            if (this.doors) {
                const door = this.doors.create(worldX, worldY, 'objects', OBJECT_FRAMES.door);
                this.setupDoor(door);
                this.hasDoorInMap = true;
            }
            this.tiles[gridY][gridX].type = 'floor';
            return;
        }

        if (revealType === 'key' || revealType === 'pepita' || revealType === 'dynamite' || revealType === 'skeleton' || revealType === 'cart') {
            createItemFromType(revealType);
            this.tiles[gridY][gridX].type = 'floor';
            return;
        }

        if (revealType === 'gem') {
            if (this.gems) {
                const gem = this.gems.create(worldX, worldY, 'objects', OBJECT_FRAMES.gem);
                const gemScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
                gem.setScale(gemScaleFactor);
                if (gem.body) {
                    gem.body.setSize(Math.floor(gem.displayWidth || gem.width), Math.floor(gem.displayHeight || gem.height));
                }
                this.tweens.add({
                    targets: gem,
                    scale: 1.2,
                    duration: 500,
                    yoyo: true,
                    repeat: -1
                });
                this.gemsRemaining = (Number(this.gemsRemaining) || 0) + 1;
            }
            this.tiles[gridY][gridX].type = 'floor';
            return;
        }

        if (revealType === 'hole2') {
            if (!this.hole2ExitPositions) {
                this.hole2ExitPositions = [];
            }
            this.hole2ExitPositions.push({ x: worldX, y: worldY, gridX, gridY });
            this.tiles[gridY][gridX].type = 'floor';

            if (this.hole2ExitsActive && (Number(this.gemsRemaining) || 0) <= 0) {
                this.spawnHole2ExitAt(worldX, worldY, gridX, gridY);
            }
            return;
        }

        if (revealType === 'empty') {
            this.tiles[gridY][gridX].type = 'empty';
            this.tiles[gridY][gridX].sprite = null;
            return;
        }

        const baseFrame = TILE_FRAMES[revealType];
        if (baseFrame !== undefined) {
            const tileSprite = this.add.sprite(worldX, worldY, 'tiles', baseFrame);
            tileSprite.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
            this.tiles[gridY][gridX].type = revealType;
            this.tiles[gridY][gridX].sprite = tileSprite;
            return;
        }

        this.tiles[gridY][gridX].type = 'floor';
    }

    shootDynamite() {
        if (GAME_STATE.dynamiteCount <= 0) return;
        if (this.time.now - this.lastDynamiteTime < 300) return;

        GAME_STATE.dynamiteCount--;
        this.lastDynamiteTime = this.time.now;

        const dirX = this.lastMoveDir?.x ?? 1;
        const dirY = this.lastMoveDir?.y ?? 0;
        const baseSpeed = CONFIG.dynamiteSpeed;
        const launchSpeed = baseSpeed * 1.45;
        const cruiseSpeed = baseSpeed * 0.72;
        const dynamiteDisplaySize = Number(CONFIG.dynamiteSize) > 0
            ? Number(CONFIG.dynamiteSize)
            : Math.max(8, Math.round((Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE) * 0.6));

        // Use dynamite projectile sprite from objects.png (frame 0)
        const dynamite = this.dynamites.create(this.player.x, this.player.y, 'objects', OBJECT_FRAMES.dynamite_projectile);
        dynamite.setDisplaySize(dynamiteDisplaySize * 1.12, dynamiteDisplaySize * 1.12);
        this.tweens.add({
            targets: dynamite,
            displayWidth: dynamiteDisplaySize,
            displayHeight: dynamiteDisplaySize,
            duration: 260,
            ease: 'Quad.easeOut'
        });
        // Keep dynamite at original sprite size; update physics body if present
        if (dynamite.body) {
            dynamite.body.setSize(Math.floor(dynamite.displayWidth || dynamite.width), Math.floor(dynamite.displayHeight || dynamite.height));
            dynamite.body.onWorldBounds = true;
        }
        dynamite.setVelocity(dirX * launchSpeed, dirY * launchSpeed);
        dynamite.setDamping(true);
        dynamite.setDrag(baseSpeed * 2.4, baseSpeed * 2.4);
        dynamite.setBounce(1, 1);
        dynamite.setCollideWorldBounds(true);
        if (dynamite.body) {
            dynamite.body.onWorldBounds = true;
        }

        // Throw feeling: starts fast then slows down (small parabola-like launch feel)
        this.time.delayedCall(380, () => {
            if (!dynamite || !dynamite.active) return;
            dynamite.setDrag(baseSpeed * 0.4, baseSpeed * 0.4);
            const vx = dynamite.body?.velocity?.x || 0;
            const vy = dynamite.body?.velocity?.y || 0;
            const speedNow = Math.hypot(vx, vy);
            if (speedNow > cruiseSpeed && speedNow > 0.0001) {
                const scale = cruiseSpeed / speedNow;
                dynamite.setVelocity(vx * scale, vy * scale);
            }
        });

        // Subtle oscillating rotation while flying
        this.tweens.add({
            targets: dynamite,
            angle: 12,
            duration: 180,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.attachDynamiteSmokeTrail(dynamite);

        this.time.delayedCall(CONFIG.dynamiteLifetime, () => {
            if (dynamite.active) {
                this.explodeDynamite(dynamite);
            }
        });

        if (this.companionSprite && this.companionSprite.active) {
            this.shootCompanionDynamite(dirX, dirY, dynamiteDisplaySize, baseSpeed, launchSpeed, cruiseSpeed);
        }
    }

    explodeDynamite(dynamite) {
        if (!dynamite || !dynamite.active) return;

        const smokeTrailEvent = dynamite.getData('smokeTrailEvent');
        if (smokeTrailEvent && smokeTrailEvent.remove) {
            smokeTrailEvent.remove(false);
        }

        // Create explosion effect using explosion sprite from objects.png (frame 15)
        const explosion = this.add.sprite(dynamite.x, dynamite.y, 'objects', OBJECT_FRAMES.explosion);
        const explosionScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        explosion.setScale(explosionScaleFactor);
        if (this.sound) {
            this.sound.play('explosion_sfx', { volume: 0.6 });
        }
        // Keep explosion sprite at original size; tween will scale it up visually
        this.tweens.add({
            targets: explosion,
            scale: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => explosion.destroy()
        });

        dynamite.destroy();

        // Slow player if inside explosion radius
        this.applyExplosionSlow(explosion.x, explosion.y);
        this.revealHiddenMapObjects(explosion.x, explosion.y, CONFIG.tileSize * 0.95);
    }

    bounceAndExplode(dynamite) {
        if (!dynamite || !dynamite.active) return;
        if (dynamite.getData('bounceExplode')) return;
        dynamite.setData('bounceExplode', true);

        const vx = dynamite.body?.velocity?.x || 0;
        const vy = dynamite.body?.velocity?.y || 0;
        const len = Math.max(1, Math.hypot(vx, vy));
        const nx = vx / len;
        const ny = vy / len;

        // Small hop and nudge before exploding
        this.tweens.add({
            targets: dynamite,
            x: dynamite.x + nx * 8,
            y: dynamite.y + ny * 8 - 4,
            duration: 120,
            yoyo: true,
            ease: 'Sine.easeOut',
            onComplete: () => {
                if (dynamite.active) {
                    this.explodeDynamite(dynamite);
                }
            }
        });
    }

    applyExplosionSlow(x, y) {
        if (!this.player || !this.player.active) return;
        const radius = CONFIG.tileSize * 1.5;
        const dist = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
        if (dist > radius) return;

        this.playerSlowFactor = 0.5;
        if (this.playerSlowTimer) {
            this.playerSlowTimer.remove();
        }
        this.playerSlowTimer = this.time.delayedCall(800, () => {
            this.playerSlowFactor = 1;
        });
    }

    createExplosionAt(x, y) {
        const explosion = this.add.sprite(x, y, 'objects', OBJECT_FRAMES.explosion);
        const explosionScaleFactor2 = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        explosion.setScale(explosionScaleFactor2);
        // Keep explosion sprite at original size; tween will scale it up visually
        this.tweens.add({
            targets: explosion,
            scale: 2,
            alpha: 0,
            duration: 250,
            onComplete: () => explosion.destroy()
        });
    }

    createDustPuff(x, y, scale) {
        const puff = this.add.circle(x, y + 6, CONFIG.tileSize * 0.4, 0xD2C2A0, 0.75);
        puff.setBlendMode(Phaser.BlendModes.ADD);
        puff.setDepth(900);
        this.tweens.add({
            targets: puff,
            scale: (scale || 1) * 2.2,
            alpha: 0,
            y: y - 16,
            duration: 320,
            ease: 'Cubic.easeOut',
            onComplete: () => puff.destroy()
        });
    }

    createBloodSplatter(x, y, intensity = 1) {
        const centerX = typeof x === 'number' ? x : (this.player?.x || 0);
        const centerY = typeof y === 'number' ? y : (this.player?.y || 0);
        const intensityMul = Phaser.Math.Clamp(Number(intensity) || 1, 0.5, 3);
        const particleCount = Math.max(8, Math.floor(Phaser.Math.Between(20, 32) * intensityMul));

        for (let i = 0; i < particleCount; i++) {
            const droplet = this.add.circle(
                centerX + Phaser.Math.Between(-12, 12),
                centerY + Phaser.Math.Between(-12, 12),
                Phaser.Math.Between(3, 7),
                Phaser.Utils.Array.GetRandom([0xb30000, 0xcc0000, 0x8a0303]),
                Phaser.Math.FloatBetween(0.78, 1)
            );
            droplet.setDepth(1100);

            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.Between(18, 52);

            this.tweens.add({
                targets: droplet,
                x: droplet.x + Math.cos(angle) * distance,
                y: droplet.y + Math.sin(angle) * distance + Phaser.Math.Between(8, 26),
                alpha: 0,
                scale: Phaser.Math.FloatBetween(0.7, 1),
                duration: Phaser.Math.Between(340, 560),
                ease: 'Cubic.easeOut',
                onComplete: () => droplet.destroy()
            });
        }
    }

    attachDynamiteSmokeTrail(dynamite) {
        if (!dynamite || !dynamite.active) return;

        const smokeEvent = this.time.addEvent({
            delay: 28,
            loop: true,
            callback: () => {
                if (!dynamite || !dynamite.active) {
                    if (smokeEvent && smokeEvent.remove) {
                        smokeEvent.remove(false);
                    }
                    return;
                }

                for (let i = 0; i < 2; i++) {
                    const smoke = this.add.circle(
                        dynamite.x + Phaser.Math.Between(-4, 4),
                        dynamite.y + Phaser.Math.Between(-4, 4),
                        Phaser.Math.Between(3, 6),
                        0xb8b8b8,
                        0.62
                    );
                    smoke.setDepth(850);

                    this.tweens.add({
                        targets: smoke,
                        y: smoke.y - Phaser.Math.Between(14, 24),
                        x: smoke.x + Phaser.Math.Between(-8, 8),
                        scale: 2.8,
                        alpha: 0,
                        duration: 520,
                        ease: 'Sine.easeOut',
                        onComplete: () => smoke.destroy()
                    });
                }
            }
        });

        dynamite.setData('smokeTrailEvent', smokeEvent);
        if (dynamite.once) {
            dynamite.once('destroy', () => {
                if (smokeEvent && smokeEvent.remove) {
                    smokeEvent.remove(false);
                }
            });
        }
    }

    addScore(amount, x, y, skipUnderflowLifeLoss = false) {
        const numericAmount = Number(amount) || 0;
        if (numericAmount > 0 && this.levelStats) {
            this.levelStats.pointsEarned = (Number(this.levelStats.pointsEarned) || 0) + numericAmount;
        }

        const nextScore = (Number(GAME_STATE.score) || 0) + (Number(amount) || 0);

        if (nextScore < 0) {
            GAME_STATE.score = 0;
            this.showScorePopup(amount, x, y);
            if (!skipUnderflowLifeLoss) {
                this.loseLife({
                    skipScorePenalty: true,
                    reason: 'score_underflow',
                    popupX: x,
                    popupY: y
                });
            }
            return;
        }

        GAME_STATE.score = nextScore;
        this.showScorePopup(amount, x, y);
    }

    showScorePopup(amount, x, y) {
        const posX = typeof x === 'number' ? x : (this.player?.x || 0);
        const posY = typeof y === 'number' ? y : (this.player?.y || 0);
        const color = amount >= 0 ? '#00ff66' : '#ff4444';
        const text = amount > 0 ? `+${amount}` : `${amount}`;

        const popup = this.add.text(posX, posY - 10, text, {
            fontSize: '16px',
            fill: color,
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        popup.setDepth(1000);
        popup.setScrollFactor(1);

        this.tweens.add({
            targets: popup,
            y: posY - 40,
            alpha: 0,
            duration: 700,
            ease: 'Cubic.easeOut',
            onComplete: () => popup.destroy()
        });
    }

    showLifeLossPopup(x, y) {
        const posX = typeof x === 'number' ? x : (this.player?.x || 0);
        const posY = typeof y === 'number' ? y : (this.player?.y || 0);

        const popup = this.add.text(posX, posY - 28, 'LIFE -1', {
            fontSize: '16px',
            fill: '#ff3355',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5);

        popup.setDepth(1001);
        popup.setScrollFactor(1);

        this.tweens.add({
            targets: popup,
            y: posY - 60,
            alpha: 0,
            duration: 800,
            ease: 'Cubic.easeOut',
            onComplete: () => popup.destroy()
        });
    }

    explodeNearbyRocks(centerX, centerY, radius) {
        const rocks = this.rocks?.children?.entries || [];
        rocks.forEach((rock) => {
            if (!rock || !rock.active) return;
            if (!rock.getData('destructible')) return;
            const dist = Phaser.Math.Distance.Between(centerX, centerY, rock.x, rock.y);
            if (dist <= radius) {
                this.createExplosionAt(rock.x, rock.y);
                rock.destroy();
                this.addScore(10, rock.x, rock.y);
            }
        });
    }

    dynamiteHitRock(dynamite, rock) {
        if (rock.getData('destructible')) {
            this.explodeNearbyRocks(rock.x, rock.y, CONFIG.tileSize * 1.6);
            this.explodeDynamite(dynamite);
        } else {
            // Bounce off
        }
    }

    dynamiteHitBoulder(dynamite, boulder) {
        this.destroyBoulder(boulder);
        this.explodeDynamite(dynamite);
    }

    dynamiteHitBat(dynamite, bat) {
        if (!bat || !bat.active) return;
        this.releaseBatCarriedGem(bat, true);
        this.addScore(12, bat.x, bat.y);
        if (this.levelStats) {
            this.levelStats.batsCaught = (Number(this.levelStats.batsCaught) || 0) + 1;
        }
        bat.destroy();
        this.explodeDynamite(dynamite);
    }

    dynamiteHitShard(dynamite, shard) {
        if (!shard || !shard.active) return;
        this.addScore(3, shard.x, shard.y);
        this.createExplosionAt(shard.x, shard.y);
        shard.destroy();
        this.explodeDynamite(dynamite);
    }

    destroyBoulder(boulder) {
        const size = boulder.getData('size') || 'medium';
        const shardCount = this.getShardCount(size);

        for (let i = 0; i < shardCount; i++) {
            const angle = (Math.PI * 2 * i) / shardCount;
            const speed = CONFIG.shardSpeed * Phaser.Math.FloatBetween(1.0, 1.35);
            this.spawnStoneShardProjectile(boulder.x, boulder.y, angle, speed);
        }

        boulder.destroy();
        this.addScore(20, boulder.x, boulder.y);
    }

    getShardCount(size) {
        const config = LEVEL_CONFIG.globalRules.dynamicBoulders.sizes[size];
        if (!config) return 0;
        return Phaser.Math.Between(config.shards[0], config.shards[1]);
    }

    collectGem(player, gem) {
        if (this.sound) {
            this.sound.play('gem_sfx', { volume: 0.45 });
        }
        gem.destroy();
        this.addScore(50, gem.x, gem.y);
        this.playerGemStock = (Number(this.playerGemStock) || 0) + 1;
        if (this.levelStats) {
            this.levelStats.gemsCollected = (Number(this.levelStats.gemsCollected) || 0) + 1;
        }

        this.gemsRemaining--;

        if (this.gemsRemaining > 0) {
            this.time.delayedCall(CONFIG.gemSpawnDelay, () => this.spawnGem());
            return;
        }

        this.activateHole2Exits();
    }

    collectItem(player, item) {
        const type = item.getData('type');
        const gridX = item.getData('gridX');
        const gridY = item.getData('gridY');

        if (type === 'key') {
            this.addScore(5, item.x, item.y);
            GAME_STATE.keysCount++;
            this.lastKeyPos = { x: item.x, y: item.y };
            if (this.levelStats) {
                this.levelStats.keysCollected = (Number(this.levelStats.keysCollected) || 0) + 1;
            }
        } else if (type === 'dynamite') {
            GAME_STATE.dynamiteCount += 5;
        } else if (type === 'pepita') {
            GAME_STATE.lives++;
            if (this.levelStats) {
                this.levelStats.pepitasCollected = (Number(this.levelStats.pepitasCollected) || 0) + 1;
            }
        } else if (type === 'cart') {
            this.activateCartPowerup(10000);
        } else if (type === 'skeleton') {
            this.addScore(20, item.x, item.y);
            this.activateCompanionHelper(20000);
        }

        item.destroy();
        this.revealHiddenAtGrid(gridX, gridY);
    }

    activateCartPowerup(durationMs = 10000) {
        this.cartPowerActive = true;
        this.cartPowerUntil = this.time.now + Math.max(0, Number(durationMs) || 0);

        if (this.cartPowerTimer) {
            this.cartPowerTimer.remove(false);
        }

        if (Array.isArray(this.playerCollisionRefs)) {
            this.playerCollisionRefs.forEach((collider) => {
                if (collider) {
                    collider.active = false;
                }
            });
        }

        if (this.player) {
            this.player.setAlpha(0.85);
        }

        this.cartPowerTimer = this.time.delayedCall(Math.max(0, Number(durationMs) || 0), () => {
            this.deactivateCartPowerup();
        });
    }

    deactivateCartPowerup() {
        this.cartPowerActive = false;
        this.cartPowerUntil = 0;

        if (this.cartPowerTimer) {
            this.cartPowerTimer.remove(false);
            this.cartPowerTimer = null;
        }

        if (Array.isArray(this.playerCollisionRefs)) {
            this.playerCollisionRefs.forEach((collider) => {
                if (collider) {
                    collider.active = true;
                }
            });
        }

        if (this.player) {
            this.player.setAlpha(1);
        }
    }

    tryOpenDoor(player, door) {
        if (!door || !door.active) return;
        if (door.getData('opening')) return;
        if (!door.getData('locked')) return;
        if (GAME_STATE.keysCount <= 0) return;

        GAME_STATE.keysCount = Math.max(0, GAME_STATE.keysCount - 1);
        door.setData('opening', true);
        door.setData('locked', false);
        if (door.disableBody) {
            door.disableBody(true, true);
        } else {
            door.setVisible(false);
            if (door.body) {
                door.body.enable = false;
            }
        }

        // Respawn key and re-close door after 10 seconds
        this.time.delayedCall(10000, () => {
            if (!door) return;
            if (door.enableBody) {
                door.enableBody(false, door.x, door.y, true, true);
                if (door.refreshBody) {
                    door.refreshBody();
                }
            } else {
                door.setVisible(true);
                if (door.body) {
                    door.body.enable = true;
                }
            }
            door.setData('locked', true);
            door.setData('opening', false);

            this.respawnKey();
        });
    }

    respawnKey() {
        // Avoid multiple keys on the field
        const existingKey = this.items?.children?.entries?.find((item) => item?.getData('type') === 'key');
        if (existingKey) return;

        if (this.lastKeyPos) {
            this.spawnKeyAt(this.lastKeyPos.x, this.lastKeyPos.y);
            return;
        }

        if (this.keySpawnPositions && this.keySpawnPositions.length > 0) {
            const pos = this.keySpawnPositions[0];
            this.spawnKeyAt(pos.x, pos.y);
            return;
        }

        const tile = this.getRandomWalkableTile();
        if (!tile) return;
        const worldX = this.mapOffsetX + tile.x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + tile.y * CONFIG.tileSize + CONFIG.tileSize / 2;
        this.spawnKeyAt(worldX, worldY);
    }

    hitByBoulder(player, boulder) {
        this.loseLife();
        boulder.destroy();
    }

    hitByRock(player, rock) {
        if (!rock.getData('isFalling')) return;
        this.loseLife();
        rock.destroy();
    }

    hitByShard(player, shard) {
        this.loseLife();
        shard.destroy();
    }

    hitByGhost(player, ghost) {
        this.loseLife();
    }

    hitByBat(player, bat) {
        if (!bat || !bat.active) return;
        if (this.cartPowerActive) return;

        const now = this.time.now;
        const nextStealAt = Number(bat.getData('nextStealAt')) || 0;
        if (now < nextStealAt) return;
        bat.setData('nextStealAt', now + 1000);

        this.createBloodSplatter(player?.x, player?.y, 1.9);

        const batAlreadyCarryingGem = !!bat.getData('carriedGemSprite');
        if ((Number(this.playerGemStock) || 0) > 0 && !batAlreadyCarryingGem) {
            this.playerGemStock = Math.max(0, (Number(this.playerGemStock) || 0) - 1);
            this.gemsRemaining = (Number(this.gemsRemaining) || 0) + 1;
            this.startBatGemCarryAndDrop(bat);
            this.showScorePopup(-1, player?.x, player?.y);
            return;
        }

        this.loseLife();
    }

    hitHole() {
        this.loseLife();
    }

    loseLife(options = {}) {
        if (this.cartPowerActive) return;
        if (this.invulnerable) return;

        const skipScorePenalty = !!options.skipScorePenalty;
        const reason = options.reason || '';
        const popupX = options.popupX;
        const popupY = options.popupY;

        GAME_STATE.lives--;
        if (!skipScorePenalty) {
            this.addScore(-20, this.player?.x, this.player?.y, true);
        }

        if (reason === 'score_underflow') {
            this.showLifeLossPopup(popupX, popupY);
        }

        if (GAME_STATE.lives <= 0) {
            this.gameOver();
            return;
        }

        // Invulnerability frames
        this.invulnerable = true;
        this.tweens.add({
            targets: this.player,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: 10,
            onComplete: () => {
                this.invulnerable = false;
                this.player.alpha = 1;
            }
        });
    }

    getBonusMetricValue(metricName) {
        const name = String(metricName || '').trim().toLowerCase();
        const scoreNow = Number(GAME_STATE.score) || 0;
        const pointsFromStats = Number(this.levelStats?.pointsEarned) || 0;

        const metrics = {
            points: pointsFromStats,
            score: scoreNow,
            pointsearned: pointsFromStats,
            bats: Number(this.levelStats?.batsCaught) || 0,
            batscaught: Number(this.levelStats?.batsCaught) || 0,
            pipistrelli: Number(this.levelStats?.batsCaught) || 0,
            pipistrellicatturati: Number(this.levelStats?.batsCaught) || 0,
            keys: Number(this.levelStats?.keysCollected) || 0,
            keyscollected: Number(this.levelStats?.keysCollected) || 0,
            keysrecovered: Number(this.levelStats?.keysCollected) || 0,
            chiavi: Number(this.levelStats?.keysCollected) || 0,
            gems: Number(this.levelStats?.gemsCollected) || 0,
            gemscollected: Number(this.levelStats?.gemsCollected) || 0,
            pepite: Number(this.levelStats?.pepitasCollected) || 0,
            pepitas: Number(this.levelStats?.pepitasCollected) || 0,
            pepitascollected: Number(this.levelStats?.pepitasCollected) || 0,
            levelcompleted: 1
        };

        return Number(metrics[name]) || 0;
    }

    evaluateBonusCriteria(bonusConfig) {
        if (!bonusConfig || bonusConfig.enabled === false) return false;

        const criteria = bonusConfig.criteria || bonusConfig.criterio || bonusConfig.requirements || null;
        if (!criteria) {
            return true;
        }

        if (Array.isArray(criteria)) {
            return criteria.every((entry) => {
                if (!entry || typeof entry !== 'object') return true;
                const metric = entry.metric || entry.name || entry.type;
                const target = Number(entry.value ?? entry.min ?? entry.target ?? 0);
                if (!metric || !Number.isFinite(target)) return true;
                return this.getBonusMetricValue(metric) >= target;
            });
        }

        if (typeof criteria === 'object') {
            const mode = String(criteria.mode || criteria.match || 'all').toLowerCase();
            const entries = Object.entries(criteria)
                .filter(([key]) => !['mode', 'match'].includes(String(key).toLowerCase()));

            if (!entries.length) return true;

            const checks = entries.map(([metric, expected]) => {
                const minValue = Number(expected);
                if (!Number.isFinite(minValue)) return true;
                return this.getBonusMetricValue(metric) >= minValue;
            });

            return mode === 'any' ? checks.some(Boolean) : checks.every(Boolean);
        }

        return true;
    }

    levelComplete() {
        if (this.isLevelTransitioning) {
            return;
        }
        this.isLevelTransitioning = true;

        const t = TRANSLATIONS[GAME_STATE.language] || {};

        this.deactivateCompanionHelper();

        this.stopLevelLightEffect();
        this.stopGhostSfx();

        if (this.sound) {
            this.sound.play('level_completed_sfx', { volume: 0.6 });
        }
        this.addScore(50, this.player?.x, this.player?.y);

        const currentLevelData = this.levelData || {};
        const bonusConfig = currentLevelData?.bonus;
        const shouldRunBonus = !!bonusConfig
            && bonusConfig.enabled !== false
            && this.evaluateBonusCriteria(bonusConfig)
            && !!(bonusConfig.name || bonusConfig.level || bonusConfig.file || bonusConfig.nome);

        const totalLevels = LEVEL_CONFIG.levels.length;
        const nextLevel = (GAME_STATE.currentLevel + 1) % totalLevels;
        GAME_STATE.currentLevel = nextLevel;

        const completedText = t.level_completed || t.levelComplete || 'LEVEL COMPLETED';
        const bonusUnlockedText = t.bonus_unlocked || 'BONUS UNLOCKED!';
        const displayText = shouldRunBonus ? `${completedText}\n${bonusUnlockedText}` : completedText;
        const camera = this.cameras.main;
        const completedOverlay = this.add.rectangle(
            camera.width / 2,
            camera.height / 2,
            camera.width,
            camera.height,
            0x000000,
            1
        ).setScrollFactor(0).setDepth(4000);

        const completedLabel = this.add.text(
            camera.width / 2,
            camera.height / 2,
            displayText,
            {
                fontSize: '34px',
                fill: '#ffffff',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 5,
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(4001).setScrollFactor(0);

        // Stop ongoing gameplay timers before switching level
        if (this.boulderTimer) {
            this.boulderTimer.remove();
            this.boulderTimer = null;
        }
        if (this.rockSpawnTimer) {
            this.rockSpawnTimer.remove();
            this.rockSpawnTimer = null;
        }
        if (this.levelTimerEvent) {
            this.levelTimerEvent.remove();
            this.levelTimerEvent = null;
        }
        if (this.ghostDirectionTimer) {
            this.ghostDirectionTimer.remove();
            this.ghostDirectionTimer = null;
        }
        if (this.batDirectionTimer) {
            this.batDirectionTimer.remove();
            this.batDirectionTimer = null;
        }

        let transitioned = false;
        const goToNextLevel = () => {
            if (transitioned) return;
            transitioned = true;
            if (completedLabel && completedLabel.destroy) completedLabel.destroy();
            if (completedOverlay && completedOverlay.destroy) completedOverlay.destroy();

            if (shouldRunBonus) {
                const bonusLevelName = bonusConfig.name || bonusConfig.level || bonusConfig.file || bonusConfig.nome;
                this.scene.start('BonusScene', {
                    bonusLevelName,
                    bonusConfig,
                    returnLevel: nextLevel
                });
                return;
            }

            this.scene.start('GameScene');
        };

        this.time.delayedCall(1500, goToNextLevel);
    }

    gameOver() {
        this.stopLevelLightEffect();
        this.stopGhostSfx();
        if (this.batDirectionTimer) {
            this.batDirectionTimer.remove();
            this.batDirectionTimer = null;
        }
        this.deactivateCompanionHelper();
        const gameMusic = this.sound.get('game_bgm');
        if (gameMusic && gameMusic.isPlaying) {
            gameMusic.stop();
        }
        this.scene.start('GameOverScene');
    }

    startBoulderSpawning() {
        const spawnInterval = 3000 / (this.levelConfig.speed * GAME_STATE.difficulty);

        this.boulderTimer = this.time.addEvent({
            delay: spawnInterval,
            callback: this.spawnBoulder,
            callbackScope: this,
            loop: true
        });
    }

    getRollingStoneScale(size) {
        const objectScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        const sizeScale = size === 'small' ? 0.7 : (size === 'large' ? 1.3 : 1);
        return sizeScale * objectScaleFactor;
    }

    spawnRollingBoulder(x, y, size, vx, vy, splitGeneration = 0) {
        const boulder = this.boulders.create(x, y, 'objects', OBJECT_FRAMES.stone);
        const finalScale = this.getRollingStoneScale(size);

        boulder.setScale(finalScale);
        boulder.setAngle(Phaser.Math.Between(0, 360));
        boulder.setVelocity(vx, vy);
        boulder.setData('size', size);
        boulder.setData('splitGeneration', splitGeneration);
        boulder.setData('isSplitting', false);

        const initialSpeed = Math.sqrt((vx * vx) + (vy * vy));
        boulder.setData('rollingMinSpeed', Phaser.Math.Between(36, 56));
        boulder.setData('rollingStartSpeed', initialSpeed);
        boulder.setData('rollingDecayRate', Phaser.Math.FloatBetween(0.45, 0.78));
        boulder.setData('rollingPulsePhase', Phaser.Math.FloatBetween(0, Math.PI * 2));
        boulder.setData('rollingPulseAmp', Phaser.Math.FloatBetween(0.2, 0.35));
        boulder.setData('rollingPulseFreq', Phaser.Math.FloatBetween(7.8, 11.2));
        boulder.setData('rollingAge', 0);
        boulder.setData('rollingHopInterval', Phaser.Math.Between(120, 190));
        boulder.setData('rollingHopTimer', Phaser.Math.Between(35, 120));
        boulder.setData('rollingHopPower', Phaser.Math.Between(24, 50));
        boulder.setData('rollingLateralPower', Phaser.Math.Between(14, 34));
        boulder.setData('rollingSpinSign', Math.random() < 0.5 ? -1 : 1);
        boulder.setData('rollingSpeed', initialSpeed);
        boulder.setData('rollingBaseScale', finalScale);

        if (boulder.body) {
            boulder.body.setAllowGravity(false);
            boulder.body.setCollideWorldBounds(true);
            boulder.body.setSize(Math.floor(boulder.displayWidth || boulder.width), Math.floor(boulder.displayHeight || boulder.height));
        }
        boulder.setBounce(0.9);
        this.attachBoulderSmokeTrail(boulder);

        return boulder;
    }

    trySplitRollingBoulder(boulder, impactObject) {
        if (!boulder || !boulder.active || !boulder.body) return;
        if (boulder.getData('isSplitting')) return;

        const dynamicBoulders = this.levelConfig?.dynamicBoulders;
        if (dynamicBoulders && typeof dynamicBoulders === 'object' && dynamicBoulders.splitOnImpact === false) {
            return;
        }

        const splitGeneration = Number(boulder.getData('splitGeneration')) || 0;
        const maxSplitGenerationRaw = Number(dynamicBoulders?.maxSplitGeneration);
        const maxSplitGeneration = Number.isFinite(maxSplitGenerationRaw)
            ? Math.max(0, Math.floor(maxSplitGenerationRaw))
            : 1;
        if (splitGeneration >= maxSplitGeneration) return;

        const sourceSize = boulder.getData('size') || 'medium';
        const nextSize = sourceSize === 'large' ? 'medium' : 'small';

        const splitRange = Array.isArray(dynamicBoulders?.splitPiecesRange)
            ? dynamicBoulders.splitPiecesRange
            : [2, 3];
        const rangeMinRaw = Number(splitRange[0]);
        const rangeMaxRaw = Number(splitRange[1]);
        const rangeMin = Number.isFinite(rangeMinRaw) ? Math.max(1, Math.floor(rangeMinRaw)) : 2;
        const rangeMax = Number.isFinite(rangeMaxRaw) ? Math.max(rangeMin, Math.floor(rangeMaxRaw)) : 3;
        const pieces = Phaser.Math.Between(rangeMin, rangeMax);

        const baseSpeed = Math.max(80, Math.sqrt((boulder.body.velocity.x ** 2) + (boulder.body.velocity.y ** 2)));
        const baseAngle = (impactObject && impactObject.active)
            ? Phaser.Math.Angle.Between(impactObject.x, impactObject.y, boulder.x, boulder.y)
            : Phaser.Math.FloatBetween(0, Math.PI * 2);

        boulder.setData('isSplitting', true);

        for (let i = 0; i < pieces; i++) {
            const spread = Phaser.Math.FloatBetween(-0.9, 0.9) + ((i - (pieces - 1) / 2) * 0.55);
            const angle = baseAngle + spread;
            const pieceSpeed = baseSpeed * Phaser.Math.FloatBetween(0.55, 0.9);
            const pieceVx = Math.cos(angle) * pieceSpeed;
            const pieceVy = Math.sin(angle) * pieceSpeed;

            const offsetDist = Phaser.Math.Between(6, 14);
            const spawnX = boulder.x + Math.cos(angle) * offsetDist;
            const spawnY = boulder.y + Math.sin(angle) * offsetDist;
            this.spawnRollingBoulder(spawnX, spawnY, nextSize, pieceVx, pieceVy, splitGeneration + 1);
        }

        this.createDustPuff(boulder.x, boulder.y, 0.9);
        this.createExplosionAt(boulder.x, boulder.y);
        boulder.destroy();
    }

    spawnBoulder() {
        const dynamicBoulders = this.levelConfig?.dynamicBoulders;
        if (!dynamicBoulders) return;
        if (typeof dynamicBoulders === 'object' && dynamicBoulders.enabled === false) return;

        const defaultDirections = ['top', 'bottom', 'left', 'right'];
        const staticRockConfig = this.levelConfig?.staticRocks;
        const defaultSizes = (Array.isArray(staticRockConfig?.sizes) && staticRockConfig.sizes.length > 0)
            ? staticRockConfig.sizes
            : (LEVEL_CONFIG.globalRules?.staticRocks?.sizes || ['small', 'medium', 'large']);

        const directions = (typeof dynamicBoulders === 'object' && Array.isArray(dynamicBoulders.directions) && dynamicBoulders.directions.length > 0)
            ? dynamicBoulders.directions
            : defaultDirections;
        const sizes = (typeof dynamicBoulders === 'object' && Array.isArray(dynamicBoulders.sizes) && dynamicBoulders.sizes.length > 0)
            ? dynamicBoulders.sizes
            : defaultSizes;

        if (!directions.length || !sizes.length) return;

        const direction = Phaser.Utils.Array.GetRandom(directions);
        const size = Phaser.Utils.Array.GetRandom(sizes);

        let x, y, vx, vy;

        if (direction === 'top') {
            x = this.mapOffsetX + Phaser.Math.Between(1, this.mapCols - 2) * CONFIG.tileSize;
            y = this.mapOffsetY;
            vx = Phaser.Math.Between(-50, 50);
            vy = CONFIG.boulderBaseSpeed * this.levelConfig.speed * GAME_STATE.difficulty;
        } else if (direction === 'bottom') {
            x = this.mapOffsetX + Phaser.Math.Between(1, this.mapCols - 2) * CONFIG.tileSize;
            y = this.mapOffsetY + this.mapRows * CONFIG.tileSize;
            vx = Phaser.Math.Between(-50, 50);
            vy = -CONFIG.boulderBaseSpeed * this.levelConfig.speed * GAME_STATE.difficulty;
        } else if (direction === 'left') {
            x = this.mapOffsetX;
            y = this.mapOffsetY + Phaser.Math.Between(1, this.mapRows - 2) * CONFIG.tileSize;
            vx = CONFIG.boulderBaseSpeed * this.levelConfig.speed * GAME_STATE.difficulty;
            vy = Phaser.Math.Between(-50, 50);
        } else {
            x = this.mapOffsetX + this.mapCols * CONFIG.tileSize;
            y = this.mapOffsetY + Phaser.Math.Between(1, this.mapRows - 2) * CONFIG.tileSize;
            vx = -CONFIG.boulderBaseSpeed * this.levelConfig.speed * GAME_STATE.difficulty;
            vy = Phaser.Math.Between(-50, 50);
        }

        this.spawnRollingBoulder(x, y, size, vx, vy, 0);
    }

    attachBoulderSmokeTrail(boulder) {
        if (!boulder || !boulder.active) return;

        const smokeEvent = this.time.addEvent({
            delay: 34,
            loop: true,
            callback: () => {
                if (!boulder || !boulder.active) {
                    if (smokeEvent && smokeEvent.remove) {
                        smokeEvent.remove(false);
                    }
                    return;
                }

                const velocityX = Number(boulder.body?.velocity?.x) || 0;
                const velocityY = Number(boulder.body?.velocity?.y) || 0;
                const trailX = boulder.x - Math.sign(velocityX) * Phaser.Math.Between(2, 6);
                const trailY = boulder.y - Math.sign(velocityY) * Phaser.Math.Between(2, 6);

                const trailParticles = 2;
                for (let i = 0; i < trailParticles; i++) {
                    const smoke = this.add.circle(
                        trailX + Phaser.Math.Between(-3, 3),
                        trailY + Phaser.Math.Between(-2, 2),
                        Phaser.Math.Between(4, 7),
                        Phaser.Utils.Array.GetRandom([0x8b6a42, 0x7c5a37, 0x6f4e2e, 0x5f452a, 0x9a7749]),
                        Phaser.Math.FloatBetween(0.58, 0.74)
                    );
                    smoke.setDepth(860);

                    this.tweens.add({
                        targets: smoke,
                        y: smoke.y - Phaser.Math.Between(3, 8),
                        x: smoke.x + Phaser.Math.Between(-8, 8),
                        scale: Phaser.Math.FloatBetween(1.8, 2.7),
                        alpha: 0,
                        duration: Phaser.Math.Between(300, 560),
                        ease: 'Sine.easeOut',
                        onComplete: () => smoke.destroy()
                    });
                }
            }
        });

        boulder.setData('smokeTrailEvent', smokeEvent);
        if (boulder.once) {
            boulder.once('destroy', () => {
                if (smokeEvent && smokeEvent.remove) {
                    smokeEvent.remove(false);
                }
            });
        }
    }

    updateRollingBoulders(deltaMs = 16) {
        const boulders = this.boulders?.children?.entries || [];
        if (!boulders.length) return;

        const dt = Math.max(0.001, (Number(deltaMs) || 16) / 1000);

        boulders.forEach((boulder) => {
            if (!boulder || !boulder.active || !boulder.body) return;

            const vx = Number(boulder.body.velocity?.x) || 0;
            const vy = Number(boulder.body.velocity?.y) || 0;
            const currentSpeed = Math.sqrt((vx * vx) + (vy * vy));
            if (currentSpeed <= 0.001) return;

            const minSpeed = Number(boulder.getData('rollingMinSpeed')) || 30;
            const startSpeed = Number(boulder.getData('rollingStartSpeed')) || currentSpeed;
            const decayRate = Number(boulder.getData('rollingDecayRate')) || 0.62;
            const pulsePhase = Number(boulder.getData('rollingPulsePhase')) || 0;
            const pulseAmp = Number(boulder.getData('rollingPulseAmp')) || 0.22;
            const pulseFreq = Number(boulder.getData('rollingPulseFreq')) || 8.8;
            const baseScale = Number(boulder.getData('rollingBaseScale')) || 1;

            const age = (Number(boulder.getData('rollingAge')) || 0) + dt;
            boulder.setData('rollingAge', age);

            const decayedBase = Math.max(minSpeed, startSpeed * Math.exp(-decayRate * age));
            const pulseMul = 1 + Math.sin(age * pulseFreq + pulsePhase) * pulseAmp;
            const targetSpeed = Math.max(minSpeed, decayedBase * pulseMul);

            let hopTimer = (Number(boulder.getData('rollingHopTimer')) || 0) - (dt * 1000);
            if (hopTimer <= 0) {
                const dirX0 = vx / currentSpeed;
                const dirY0 = vy / currentSpeed;
                const perpX = -dirY0;
                const perpY = dirX0;
                const hopPower = Number(boulder.getData('rollingHopPower')) || 26;
                const lateralPower = Number(boulder.getData('rollingLateralPower')) || 18;

                const kickX = dirX0 * hopPower + perpX * Phaser.Math.Between(-lateralPower, lateralPower);
                const kickY = dirY0 * hopPower + perpY * Phaser.Math.Between(-lateralPower, lateralPower);
                boulder.setVelocity(vx + kickX, vy + kickY);

                this.tweens.add({
                    targets: boulder,
                    scaleX: baseScale * 1.12,
                    scaleY: baseScale * 0.88,
                    duration: 75,
                    yoyo: true,
                    ease: 'Quad.easeOut'
                });

                const interval = Number(boulder.getData('rollingHopInterval')) || 170;
                hopTimer = interval + Phaser.Math.Between(-45, 45);
            }
            boulder.setData('rollingHopTimer', hopTimer);

            const adjustedVx = Number(boulder.body.velocity?.x) || 0;
            const adjustedVy = Number(boulder.body.velocity?.y) || 0;
            const adjustedSpeed = Math.max(0.001, Math.sqrt((adjustedVx * adjustedVx) + (adjustedVy * adjustedVy)));
            const dirX = adjustedVx / adjustedSpeed;
            const dirY = adjustedVy / adjustedSpeed;

            const desiredVx = dirX * targetSpeed;
            const desiredVy = dirY * targetSpeed;
            const blend = Phaser.Math.Clamp(dt * 8, 0.08, 0.35);
            const nextVx = Phaser.Math.Linear(adjustedVx, desiredVx, blend);
            const nextVy = Phaser.Math.Linear(adjustedVy, desiredVy, blend);

            boulder.setVelocity(nextVx, nextVy);
            boulder.setData('rollingSpeed', targetSpeed);

            const spinSign = Number(boulder.getData('rollingSpinSign')) || 1;
            boulder.setAngularVelocity(spinSign * Phaser.Math.Clamp(targetSpeed * 4.6, 95, 980));
        });
    }

    updateUITexts() {
        const t = TRANSLATIONS[GAME_STATE.language];
        // Use the same keys as createUI and the JSON translations (suffix _label)
        this.scoreText.setText(`${t.score_label}: ${GAME_STATE.score}`);
        this.levelText.setText(`${t.level_label}: ${GAME_STATE.currentLevel + 1}`);

        // Update DOM HUD if present (keeps mobile HUD crisp and readable)
        try {
            const scoreEl = document.getElementById('scoreDisplay');
            const levelEl = document.getElementById('levelDisplay');
            if (scoreEl) scoreEl.textContent = `${t.score_label}: ${GAME_STATE.score}`;
            if (levelEl) levelEl.textContent = `${t.level_label}: ${GAME_STATE.currentLevel + 1}`;
        } catch (e) {}

        this.refreshHudIcons();
    }

    refreshHudIcons() {
        if (!this.scoreText || !this.scoreText.active) return;
        if (!this.levelText || !this.levelText.active) return;
        if (!this.hudContainer || !this.hudContainer.active) return;

        if (!this.topStatsObjects) {
            this.topStatsObjects = [];
        }
        this.topStatsObjects.forEach((obj) => {
            if (obj && obj.destroy) obj.destroy();
        });
        this.topStatsObjects.length = 0;

        const iconSize = 16;
        const iconGap = 3;
        const sectionGap = 14;
        const topY = 18;

        let scoreBounds;
        let levelBounds;
        try {
            scoreBounds = this.scoreText.getBounds();
            levelBounds = this.levelText.getBounds();
        } catch (e) {
            return;
        }
        const laneStart = scoreBounds.right + 14;
        const laneEnd = levelBounds.x - 14;
        let x = laneStart;

        const addIcon = (frame) => {
            const icon = this.add.sprite(x, topY, 'objects', frame).setDisplaySize(iconSize, iconSize);
            icon.setDepth(2000);
            this.hudContainer.add(icon);
            this.topStatsObjects.push(icon);
            x += iconSize + iconGap;
            return icon;
        };

        const addCountText = (value, color = '#ffffff') => {
            const txt = this.add.text(x, topY, String(value), {
                fontSize: '14px',
                fill: color,
                fontFamily: GAME_FONT
            }).setOrigin(0, 0.5);
            txt.setDepth(2000);
            this.hudContainer.add(txt);
            this.topStatsObjects.push(txt);
            x += txt.width + sectionGap;
            return txt;
        };

        // Cuori: solo icone
        for (let i = 0; i < GAME_STATE.lives; i++) {
            addIcon(OBJECT_FRAMES.heart);
        }
        x += sectionGap;

        // Chiavi: solo icone
        for (let i = 0; i < GAME_STATE.keysCount; i++) {
            addIcon(OBJECT_FRAMES.key);
        }
        x += sectionGap;

        // Dinamite: una sola icona + numero rimanente
        addIcon(OBJECT_FRAMES.dynamite_projectile);
        addCountText(GAME_STATE.dynamiteCount, '#ffaa00');

        // Gemme: una sola icona + numero rimanente
        addIcon(OBJECT_FRAMES.gem);
        addCountText(this.gemsRemaining, '#00ffff');

        // Centra l'intero blocco tra punteggio e livello
        const usedWidth = x - laneStart;
        const availableWidth = Math.max(0, laneEnd - laneStart);
        const offset = Math.max(0, (availableWidth - usedWidth) / 2);
        this.topStatsObjects.forEach((obj) => {
            if (obj && typeof obj.x === 'number') {
                obj.x += offset;
            }
        });
    }
}

// ============================================================================
// BONUS SCENE (Mine cart runner)
// ============================================================================
class BonusScene extends Phaser.Scene {
    constructor() {
        super('BonusScene');
    }

    init(data = {}) {
        this.bonusConfig = data.bonusConfig || {};
        this.bonusLevelName = data.bonusLevelName || this.bonusConfig.name || this.bonusConfig.level || this.bonusConfig.file || this.bonusConfig.nome;
        this.returnLevel = Number.isFinite(Number(data.returnLevel)) ? Number(data.returnLevel) : GAME_STATE.currentLevel;
        this.bonusCacheKey = this.bonusLevelName ? `bonus_level_${this.bonusLevelName}` : null;
        this.isBonusTransitioning = false;
        this.bonusPepitasCollected = 0;
        this.bonusStartScore = Number(GAME_STATE.score) || 0;
    }

    preload() {
        if (this.bonusCacheKey && this.bonusLevelName) {
            this.load.json(this.bonusCacheKey, `data/level/${this.bonusLevelName}.json`);
        }
    }

    create() {
        const t = TRANSLATIONS[GAME_STATE.language] || {};
        const bonusData = this.bonusCacheKey ? this.cache.json.get(this.bonusCacheKey) : null;

        if (!bonusData || !bonusData.map) {
            this.showBonusMessageAndReturn(t.bonus_missing || 'BONUS DATA MISSING');
            return;
        }

        const mapData = Array.isArray(bonusData.map?.tiles)
            ? bonusData.map.tiles
            : (Array.isArray(bonusData.map) ? bonusData.map : []);
        if (!mapData.length) {
            this.showBonusMessageAndReturn(t.bonus_missing || 'BONUS DATA MISSING');
            return;
        }

        this.mapRows = Number(bonusData.map?.rows) || mapData.length;
        this.mapCols = Number(bonusData.map?.cols) || (mapData[0]?.length || 40);
        this.mapOffsetX = 0;
        this.mapOffsetY = 0;

        const tileSize = CONFIG.tileSize;
        const worldWidth = this.mapCols * tileSize;
        const worldHeight = Math.max(CONFIG.height, this.mapRows * tileSize);

        const masterLevel = getLevelMasterNumber(this.returnLevel);
        const masterLevelBgKey = `game_bg_${masterLevel}`;
        const selectedBgKey = this.textures.exists(masterLevelBgKey) ? masterLevelBgKey : 'game_bg';
        this.add.image(worldWidth / 2, worldHeight / 2, selectedBgKey)
            .setDisplaySize(worldWidth, worldHeight)
            .setDepth(-1000);

        this.bonusRails = this.physics.add.staticGroup();
        this.bonusHazards = this.physics.add.group({ allowGravity: false, immovable: true });
        this.bonusPepitas = this.physics.add.group({ allowGravity: false, immovable: true });
        this.bonusGems = this.physics.add.group({ allowGravity: false, immovable: true });
        this.bonusProjectiles = this.physics.add.group({ allowGravity: false, immovable: false });
        this.bonusFallingRocks = this.physics.add.group();
        this.bonusRailVisuals = [];

        this.finishX = worldWidth - tileSize * 2;
        let startX = tileSize * 2;
        let startY = worldHeight - tileSize * 2;
        let startRailTopY = null;
        let firstRailX = null;
        let firstRailTopY = null;
        let lastRailX = null;

        const wallMaxFrame = getTextureMaxNumericFrame(this, 'wall_tiles', 6);

        const parseWallToken = (token) => {
            const tokenStr = String(token || '').trim().toLowerCase();
            const wallMatch = tokenStr.match(/^w(\d)(\d)$/i);
            if (!wallMatch) {
                return { isWall: false, frame: 0, rotation: 0 };
            }
            const frame = Phaser.Math.Clamp(Number(wallMatch[1]) || 0, 0, wallMaxFrame);
            const rotation = ((Number(wallMatch[2]) || 0) % 4 + 4) % 4;
            return { isWall: true, frame, rotation };
        };

        const isSolidRailToken = (token) => {
            const tokenStr = String(token || '').trim().toLowerCase();
            if (!tokenStr || tokenStr === '-') return false;
            if (tokenStr === 'h' || tokenStr === 'hole' || tokenStr === 'hole1' || tokenStr === 'hole2') return false;
            if (tokenStr === '=' || tokenStr === 't' || tokenStr === 's' || tokenStr === 'e' || tokenStr === 'rail' || tokenStr === 'floor' || tokenStr === 'f') return true;
            if (/^w\d\d$/i.test(tokenStr)) return true;
            return false;
        };

        const createRailAt = (wx, wy, token) => {
            const wallInfo = parseWallToken(token);
            const visual = wallInfo.isWall
                ? this.add.sprite(wx, wy, 'wall_tiles', wallInfo.frame)
                : this.add.sprite(wx, wy, 'tiles', 3);
            visual.setDisplaySize(tileSize, tileSize);
            if (wallInfo.isWall && wallInfo.rotation) {
                visual.setAngle(wallInfo.rotation * 90);
            }
            visual.setDepth(500);
            this.bonusRailVisuals.push(visual);

            const rail = this.bonusRails.create(wx, wy, 'tiles', 3);
            rail.setDisplaySize(tileSize, tileSize);
            rail.setVisible(false);
            if (rail.refreshBody) rail.refreshBody();

            if (firstRailX === null) {
                firstRailX = wx;
                firstRailTopY = wy - tileSize / 2;
            }
            lastRailX = wx;
        };

        for (let y = 0; y < this.mapRows; y++) {
            for (let x = 0; x < this.mapCols; x++) {
                const tokenRaw = mapData[y]?.[x];
                const token = String(tokenRaw ?? '-').trim().toLowerCase();
                const wx = this.mapOffsetX + x * tileSize + tileSize / 2;
                const wy = this.mapOffsetY + y * tileSize + tileSize / 2;

                if (isSolidRailToken(token)) {
                    createRailAt(wx, wy, token);
                }

                if (token === 's') {
                    startX = wx;
                    startRailTopY = wy - tileSize / 2;
                }
                if (token === 'e') {
                    this.finishX = wx;
                }

                if (token === 'r') {
                    const rock = this.bonusHazards.create(wx, wy - tileSize * 0.35, 'objects', OBJECT_FRAMES.stone);
                    rock.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.9);
                    rock.setData('hazardType', 'rock');
                    rock.setData('destructible', true);
                } else if (token === 'g') {
                    const ghost = this.bonusHazards.create(wx, wy - tileSize * 0.55, 'objects', OBJECT_FRAMES.ghost);
                    ghost.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.85);
                    ghost.setData('hazardType', 'ghost');
                    ghost.setData('destructible', false);
                    this.tweens.add({
                        targets: ghost,
                        y: ghost.y - 12,
                        duration: 420,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                } else if (token === 'b') {
                    const bat = this.bonusHazards.create(wx, wy - tileSize * 0.65, 'bat', 0);
                    bat.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.7);
                    bat.setData('hazardType', 'bat');
                    bat.setData('destructible', false);
                    if (this.anims.exists('bat_fly')) {
                        bat.play('bat_fly', true);
                    }
                    this.tweens.add({
                        targets: bat,
                        y: bat.y + 10,
                        duration: 280,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                } else if (token === 'p') {
                    const pepita = this.bonusPepitas.create(wx, wy - tileSize * 0.6, 'objects', OBJECT_FRAMES.pepita);
                    pepita.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.75);
                    this.tweens.add({
                        targets: pepita,
                        y: pepita.y - 8,
                        duration: 360,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                } else if (token === 'm' || token === 'gem') {
                    const gem = this.bonusGems.create(wx, wy - tileSize * 0.62, 'objects', OBJECT_FRAMES.gem);
                    gem.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.76);
                    this.tweens.add({
                        targets: gem,
                        y: gem.y - 10,
                        duration: 360,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            }
        }

        if (startRailTopY === null && firstRailX !== null) {
            startX = firstRailX;
            startRailTopY = firstRailTopY;
        }

        if (firstRailX === null || startRailTopY === null) {
            this.showBonusMessageAndReturn(t.bonus_missing || 'BONUS TRACK MISSING');
            return;
        }

        if (!(Number.isFinite(Number(this.finishX))) && lastRailX !== null) {
            this.finishX = lastRailX;
        }
        if (lastRailX !== null) {
            this.finishX = Math.max(Number(this.finishX) || lastRailX, lastRailX);
        }

        // Hidden safety rails at spawn to avoid instant fall from tiny gaps/config mistakes
        for (let i = 0; i < 5; i++) {
            const safeX = startX + i * tileSize;
            const safeY = startRailTopY + tileSize / 2;
            const safeRail = this.bonusRails.create(safeX, safeY, 'tiles', 3);
            safeRail.setDisplaySize(tileSize, tileSize);
            safeRail.setVisible(false);
            if (safeRail.refreshBody) safeRail.refreshBody();
        }

        this.cart = this.physics.add.sprite(startX, startY, 'objects', OBJECT_FRAMES.cart);
        this.cart.setScale(CONFIG.objectSize / OBJECT_NATIVE_SIZE);
        this.cart.setDepth(1200);
        this.cart.body.setGravityY(1100);
        this.cart.body.setCollideWorldBounds(false);
        this.cart.body.setSize(Math.floor(this.cart.displayWidth * 0.8), Math.floor(this.cart.displayHeight * 0.82));
        if (startRailTopY !== null) {
            startY = startRailTopY - (this.cart.displayHeight * 0.48);
            this.cart.setPosition(startX, startY);
        }
        this.bonusSpawnY = startY;

        // Rider (miner) visible on top of the cart
        this.cartRider = this.add.sprite(this.cart.x, this.cart.y - this.cart.displayHeight * 0.55, 'player_front', 0);
        const riderScale = Math.max(0.34, (Number(CONFIG.playerSize) || Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE) / 220);
        this.riderBaseScale = riderScale;
        this.cartRider.setScale(riderScale);
        this.cartRider.setDepth(1202);

        this.physics.add.collider(this.cart, this.bonusRails, () => {
            this.bonusHadRailContact = true;
        }, null, this);
        this.bonusHadRailContact = false;
        this.bonusGraceDurationMs = Number(this.bonusConfig.graceMs ?? bonusData.graceMs ?? 1600) || 1600;
        this.bonusGraceUntil = (this.time?.now || 0) + Math.max(0, this.bonusGraceDurationMs);
        this.bonusStartX = startX;
        this.bonusHazardActivationX = startX + tileSize * 5;

        this.physics.add.overlap(this.cart, this.bonusHazards, () => {
            const now = this.time?.now || 0;
            if (now < this.bonusGraceUntil) return;
            if ((Number(this.cart?.x) || 0) < this.bonusHazardActivationX) return;
            this.failBonus();
        }, null, this);
        this.physics.add.overlap(this.cart, this.bonusPepitas, (_, pepita) => {
            if (!pepita || !pepita.active) return;
            pepita.destroy();
            this.bonusPepitasCollected++;
            const pepitaScore = Number(this.bonusConfig.pepitaScore ?? 10) || 10;
            GAME_STATE.score = (Number(GAME_STATE.score) || 0) + pepitaScore;
            this.updateBonusHud();
        }, null, this);

        this.physics.add.overlap(this.cart, this.bonusGems, (_, gem) => {
            if (!gem || !gem.active) return;
            gem.destroy();
            GAME_STATE.score = (Number(GAME_STATE.score) || 0) + 50;
            this.updateBonusHud();
        }, null, this);

        this.physics.add.overlap(this.cart, this.bonusFallingRocks, () => {
            const now = this.time?.now || 0;
            if (now < this.bonusGraceUntil) return;
            this.failBonus();
        }, null, this);

        this.physics.add.overlap(this.bonusProjectiles, this.bonusHazards, (projectile, hazard) => {
            if (!projectile || !projectile.active || !hazard || !hazard.active) return;
            const hazardType = hazard.getData('hazardType');
            if (hazardType === 'rock' || hazard.getData('destructible')) {
                this.destroyBonusRock(hazard);
                projectile.destroy();
                return;
            }
            projectile.destroy();
        }, null, this);

        this.physics.add.overlap(this.bonusProjectiles, this.bonusFallingRocks, (projectile, rock) => {
            if (!projectile || !projectile.active || !rock || !rock.active) return;
            this.destroyBonusRock(rock);
            projectile.destroy();
        }, null, this);

        this.physics.add.collider(this.bonusFallingRocks, this.bonusRails, this.onBonusRockLanded, null, this);

        this.fallingRockTimer = this.time.addEvent({
            delay: Number(this.bonusConfig.fallingRockInterval ?? bonusData.fallingRockInterval ?? 1300) || 1300,
            loop: true,
            callback: () => {
                if (this.isBonusTransitioning) return;
                this.spawnBonusFallingRock();
            }
        });

        this.physics.world.setBounds(0, 0, worldWidth, worldHeight + tileSize * 2);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.startFollow(this.cart, true, 0.15, 0.1);
        this.cameras.main.setDeadzone(CONFIG.width * 0.35, CONFIG.height * 0.5);

        this.baseSpeed = Number(this.bonusConfig.baseSpeed ?? bonusData.baseSpeed ?? 220) || 220;
        this.minSpeed = Number(this.bonusConfig.minSpeed ?? bonusData.minSpeed ?? 90) || 90;
        this.maxSpeed = Number(this.bonusConfig.maxSpeed ?? bonusData.maxSpeed ?? 520) || 520;
        this.speedStep = Number(this.bonusConfig.speedStep ?? bonusData.speedStep ?? 320) || 320;
        this.brakeStep = Number(this.bonusConfig.brakeStep ?? bonusData.brakeStep ?? (this.speedStep * 1.35)) || (this.speedStep * 1.35);
        this.coastDecel = Number(this.bonusConfig.coastDecel ?? bonusData.coastDecel ?? (this.speedStep * 0.45)) || (this.speedStep * 0.45);
        this.jumpVelocity = Number(this.bonusConfig.jumpVelocity ?? bonusData.jumpVelocity ?? 560) || 560;
        this.cartSpeed = 0;

        this.cursors = this.input.keyboard.createCursorKeys();
        this.upKey = this.cursors.up;
        this.downKey = this.cursors.down;
        this.spaceShootKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        this.bonusHud = this.add.text(12, 10, '', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(3000);
        this.bonusLabel = this.add.text(CONFIG.width / 2, 12, this.bonusConfig.label || t.bonus_level || 'BONUS', {
            fontSize: '14px',
            fill: '#ffe36b',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(3000);
        this.updateBonusHud();
    }

    spawnBonusFallingRock() {
        if (!this.bonusFallingRocks || !this.cart) return;

        const cam = this.cameras?.main;
        const centerX = Number(this.cart.x) || (cam?.midPoint?.x || CONFIG.width / 2);
        const spawnX = Phaser.Math.Clamp(
            Phaser.Math.Between(centerX + CONFIG.width * 0.2, centerX + CONFIG.width * 0.95),
            CONFIG.tileSize,
            this.physics.world.bounds.width - CONFIG.tileSize
        );
        const spawnY = (cam?.scrollY || 0) - CONFIG.tileSize;

        const rock = this.bonusFallingRocks.create(spawnX, spawnY, 'objects', OBJECT_FRAMES.stone);
        rock.setScale((CONFIG.objectSize / OBJECT_NATIVE_SIZE) * Phaser.Math.FloatBetween(0.82, 1.05));
        rock.setDepth(1100);
        rock.setData('hazardType', 'rock');
        rock.setData('destructible', true);
        rock.setData('landed', false);
        rock.setVelocity(Phaser.Math.Between(-20, 20), Phaser.Math.Between(10, 40));
        rock.setAngularVelocity(Phaser.Math.Between(-380, 380));
        if (rock.body) {
            rock.body.setGravityY(Phaser.Math.Between(980, 1280));
            rock.body.setBounce(0.06, 0.06);
            rock.body.setSize(Math.floor((rock.displayWidth || rock.width) * 0.88), Math.floor((rock.displayHeight || rock.height) * 0.88));
        }

        this.spawnBonusRockTrail(rock);
    }

    spawnBonusRockTrail(rock) {
        if (!rock || !rock.active) return;
        const trailEvent = this.time.addEvent({
            delay: 70,
            loop: true,
            callback: () => {
                if (!rock || !rock.active) {
                    if (trailEvent && trailEvent.remove) trailEvent.remove(false);
                    return;
                }
                const smoke = this.add.circle(
                    rock.x + Phaser.Math.Between(-3, 3),
                    rock.y + Phaser.Math.Between(-3, 3),
                    Phaser.Math.Between(3, 6),
                    Phaser.Utils.Array.GetRandom([0x8f8f8f, 0x7a7a7a, 0x666666]),
                    Phaser.Math.FloatBetween(0.35, 0.55)
                ).setDepth(900);

                this.tweens.add({
                    targets: smoke,
                    y: smoke.y - Phaser.Math.Between(4, 8),
                    alpha: 0,
                    scale: Phaser.Math.FloatBetween(1.5, 2.3),
                    duration: Phaser.Math.Between(240, 420),
                    ease: 'Sine.easeOut',
                    onComplete: () => smoke.destroy()
                });
            }
        });
        rock.setData('trailEvent', trailEvent);
        if (rock.once) {
            rock.once('destroy', () => {
                const eventRef = rock.getData('trailEvent');
                if (eventRef && eventRef.remove) eventRef.remove(false);
            });
        }
    }

    createBonusPuff(x, y, scale = 1) {
        for (let i = 0; i < 10; i++) {
            const puff = this.add.circle(
                x + Phaser.Math.Between(-8, 8),
                y + Phaser.Math.Between(-6, 6),
                Phaser.Math.Between(3, 7) * scale,
                Phaser.Utils.Array.GetRandom([0xd2d2d2, 0xb3b3b3, 0x8f8f8f]),
                Phaser.Math.FloatBetween(0.45, 0.8)
            ).setDepth(950);

            this.tweens.add({
                targets: puff,
                x: puff.x + Phaser.Math.Between(-26, 26),
                y: puff.y + Phaser.Math.Between(-16, 10),
                alpha: 0,
                scale: Phaser.Math.FloatBetween(1.2, 2.2),
                duration: Phaser.Math.Between(260, 520),
                ease: 'Sine.easeOut',
                onComplete: () => puff.destroy()
            });
        }
    }

    wobbleBonusTrackAt(x, y) {
        const nearbyRails = (this.bonusRailVisuals || []).filter((rail) => {
            if (!rail || !rail.active) return false;
            return Math.abs(rail.x - x) <= CONFIG.tileSize * 1.2 && Math.abs(rail.y - y) <= CONFIG.tileSize * 0.8;
        });

        nearbyRails.forEach((rail) => {
            this.tweens.add({
                targets: rail,
                y: rail.y + 4,
                duration: 70,
                yoyo: true,
                ease: 'Sine.easeInOut'
            });
        });

        this.cameras.main.shake(90, 0.0035);
    }

    onBonusRockLanded(rock) {
        if (!rock || !rock.active) return;
        if (rock.getData('landed')) return;

        rock.setData('landed', true);
        this.createBonusPuff(rock.x, rock.y + (rock.displayHeight || 24) * 0.28, 0.9);
        this.wobbleBonusTrackAt(rock.x, rock.y);

        if (rock.body) {
            rock.body.setGravityY(0);
            rock.body.setVelocityX(Math.max(20, (Number(this.cartSpeed) || 0) * 0.12));
            rock.body.setVelocityY(0);
        }

        this.time.delayedCall(3200, () => {
            if (rock && rock.active) rock.destroy();
        });
    }

    destroyBonusRock(rock) {
        if (!rock || !rock.active) return;
        this.createBonusPuff(rock.x, rock.y, 1);
        this.wobbleBonusTrackAt(rock.x, rock.y);
        rock.destroy();
    }

    shootBonusDynamite() {
        if (!this.cart || !this.cart.active || this.isBonusTransitioning) return;
        const now = this.time?.now || 0;
        if (now < (this.nextBonusShotAt || 0)) return;
        this.nextBonusShotAt = now + 320;

        const dynamite = this.bonusProjectiles.create(
            this.cart.x + Math.max(10, (this.cart.displayWidth || 24) * 0.35),
            this.cart.y - Math.max(4, (this.cart.displayHeight || 24) * 0.15),
            'objects',
            OBJECT_FRAMES.dynamite_projectile
        );
        dynamite.setScale(Math.max(0.22, (CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.35));
        dynamite.setDepth(1300);
        dynamite.setVelocity(Math.max(280, (Number(this.cartSpeed) || 0) + 260), 0);
        dynamite.setAngularVelocity(Phaser.Math.Between(-620, 620));

        this.time.delayedCall(2000, () => {
            if (dynamite && dynamite.active) {
                this.createBonusPuff(dynamite.x, dynamite.y, 0.45);
                dynamite.destroy();
            }
        });
    }

    updateBonusHud() {
        if (!this.bonusHud || !this.bonusHud.active) return;
        const scoreDelta = (Number(GAME_STATE.score) || 0) - (Number(this.bonusStartScore) || 0);
        const speedNow = Math.max(0, Math.round(Number(this.cartSpeed) || 0));
        this.bonusHud.setText(`BONUS +${scoreDelta}  PEPITE:${this.bonusPepitasCollected}  SPEED:${speedNow}`);
    }

    showBonusMessageAndReturn(message) {
        this.add.text(CONFIG.width / 2, CONFIG.height / 2, message, {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 4,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3200);

        this.time.delayedCall(1200, () => {
            GAME_STATE.currentLevel = this.returnLevel;
            this.scene.start('GameScene');
        });
    }

    completeBonus() {
        if (this.isBonusTransitioning) return;
        this.isBonusTransitioning = true;

        const bonusReward = Number(this.bonusConfig.rewardScore ?? 80) || 80;
        GAME_STATE.score = (Number(GAME_STATE.score) || 0) + bonusReward;

        this.add.text(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y, 'BONUS COMPLETATO!', {
            fontSize: '24px',
            fill: '#00ff88',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3300);

        this.time.delayedCall(900, () => {
            GAME_STATE.currentLevel = this.returnLevel;
            this.scene.start('GameScene');
        });
    }

    failBonus() {
        if (this.isBonusTransitioning) return;
        this.isBonusTransitioning = true;

        GAME_STATE.lives = Math.max(0, (Number(GAME_STATE.lives) || 0) - 1);
        if ((Number(GAME_STATE.lives) || 0) <= 0) {
            this.scene.start('GameOverScene');
            return;
        }

        this.add.text(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y, 'BONUS FALLITO', {
            fontSize: '24px',
            fill: '#ff6666',
            fontFamily: GAME_FONT,
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(3300);

        this.time.delayedCall(900, () => {
            GAME_STATE.currentLevel = this.returnLevel;
            this.scene.start('GameScene');
        });
    }

    update(time, delta) {
        if (!this.cart || !this.cart.active || this.isBonusTransitioning) return;

        const dt = Math.max(0.001, (Number(delta) || 16) / 1000);
        if (this.cursors.right.isDown) {
            this.cartSpeed += this.speedStep * dt;
        }
        if (this.cursors.left.isDown) {
            this.cartSpeed -= this.brakeStep * dt;
        } else if (!this.cursors.right.isDown) {
            this.cartSpeed -= this.coastDecel * dt;
        }
        this.cartSpeed = Phaser.Math.Clamp(this.cartSpeed, 0, this.maxSpeed);

        this.cart.setVelocityX(this.cartSpeed);

        // Keep the cart from going backward out of the safe start zone
        if ((Number(this.cart.x) || 0) < (Number(this.bonusStartX) || 0)) {
            this.cart.x = this.bonusStartX;
            if (this.cart.body) {
                this.cart.body.velocity.x = Math.max(0, Number(this.cart.body.velocity.x) || 0);
            }
            this.cartSpeed = Math.max(this.cartSpeed, 0);
        }

        if (this.cartRider && this.cartRider.active) {
            const isCrouching = !!this.downKey?.isDown;
            const riderOffsetY = isCrouching ? this.cart.displayHeight * 0.36 : this.cart.displayHeight * 0.55;
            this.cartRider.setPosition(this.cart.x, this.cart.y - riderOffsetY);
            const crouchScaleY = isCrouching ? this.riderBaseScale * 0.72 : this.riderBaseScale;
            this.cartRider.setScale(this.riderBaseScale, crouchScaleY);
            this.cartRider.setFlipX((Number(this.cart.body?.velocity?.x) || 0) < 0);
        }

        const canJump = this.cart.body?.blocked?.down || this.cart.body?.touching?.down;
        if (canJump && this.upKey && Phaser.Input.Keyboard.JustDown(this.upKey)) {
            this.cart.setVelocityY(-this.jumpVelocity);
        }

        if (this.spaceShootKey && Phaser.Input.Keyboard.JustDown(this.spaceShootKey)) {
            this.shootBonusDynamite();
        }

        const now = this.time?.now || 0;
        if (now < this.bonusGraceUntil && this.cart.y > (Number(this.bonusSpawnY) || 0) + CONFIG.tileSize * 1.1) {
            this.cart.setPosition(this.bonusStartX, this.bonusSpawnY);
            if (this.cart.body) {
                this.cart.body.setVelocity(0, 0);
            }
        }

        if (now >= this.bonusGraceUntil
            && (Number(this.cart.x) || 0) >= this.bonusHazardActivationX
            && this.bonusHadRailContact
            && this.cart.y > this.physics.world.bounds.height + CONFIG.tileSize) {
            this.failBonus();
            return;
        }

        if (this.cart.x >= this.finishX) {
            this.completeBonus();
        }

        this.updateBonusHud();
    }
}

// ============================================================================
// GAME OVER SCENE
// ============================================================================
class GameOverScene extends Phaser.Scene {
    constructor() {
        super('GameOverScene');
    }

    create() {
        const t = TRANSLATIONS[GAME_STATE.language];

        this.add.rectangle(400, 300, 800, 600, 0x220000);

        this.add.text(400, 200, t.gameOver, {
            fontSize: '64px',
            fill: '#ff0000',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        this.add.text(400, 280, `${t.score}: ${GAME_STATE.score}`, {
            fontSize: '32px',
            fill: '#ffffff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        // Check if high score
        const lowestScore = GAME_STATE.topScores[GAME_STATE.topScores.length - 1].score;
        if (GAME_STATE.score > lowestScore) {
            this.add.text(400, 350, t.enterName, {
                fontSize: '24px',
                fill: '#00ff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5);

            this.nameInput = '';
            this.nameText = this.add.text(400, 400, '___', {
                fontSize: '32px',
                fill: '#ffff00',
                fontFamily: GAME_FONT
            }).setOrigin(0.5);

            this.input.keyboard.on('keydown', (event) => {
                if (event.key.length === 1 && this.nameInput.length < 3) {
                    this.nameInput += event.key.toUpperCase();
                    this.updateNameDisplay();
                } else if (event.key === 'Backspace' && this.nameInput.length > 0) {
                    this.nameInput = this.nameInput.slice(0, -1);
                    this.updateNameDisplay();
                } else if (event.key === 'Enter' && this.nameInput.length === 3) {
                    this.saveScore();
                }
            });
        } else {
            this.time.delayedCall(3000, () => {
                this.scene.start('AttractScene');
            });
        }
    }

    updateNameDisplay() {
        let display = this.nameInput;
        while (display.length < 3) {
            display += '_';
        }
        this.nameText.setText(display);
    }

    saveScore() {
        GAME_STATE.topScores.push({
            name: this.nameInput,
            score: GAME_STATE.score
        });
        GAME_STATE.topScores.sort((a, b) => b.score - a.score);
        GAME_STATE.topScores = GAME_STATE.topScores.slice(0, 10);

        this.scene.start('TopTenScene');
    }
}

// ============================================================================
// GAME INITIALIZATION
// Caricamento della configurazione da file JSON e avvio del gioco con Phaser
// ============================================================================
async function inizialization() {
    try {
        const response = await fetch('data/config.json');
        const cfg = await response.json();
        // Copy all config keys to CONFIG
        Object.assign(CONFIG, cfg);
        if (!Number.isFinite(Number(CONFIG.playerSize)) || Number(CONFIG.playerSize) <= 0) {
            CONFIG.playerSize = Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE;
        }
        if (!Number.isFinite(Number(CONFIG.ghostSpeed)) || Number(CONFIG.ghostSpeed) <= 0) {
            CONFIG.ghostSpeed = 80;
        }
        if (!Number.isFinite(Number(CONFIG.dynamiteSize)) || Number(CONFIG.dynamiteSize) <= 0) {
            CONFIG.dynamiteSize = Math.max(8, Math.round((Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE) * 0.6));
        }

        // Resolve Phaser scale mode from config (defaults to FIT)
        const requestedScaleMode = String(CONFIG.scaleMode || 'FIT').toUpperCase();
    let phaserScaleMode = Phaser.Scale.FIT;
    if (requestedScaleMode === 'ENVELOP' || requestedScaleMode === 'ENVELOPE') phaserScaleMode = Phaser.Scale.ENVELOP;
    else if (requestedScaleMode === 'NONE') phaserScaleMode = Phaser.Scale.NONE;
    else if (requestedScaleMode === 'RESIZE') phaserScaleMode = Phaser.Scale.RESIZE;

        const config = {
            type: Phaser.AUTO,
            // Use Phaser Scale manager to display the original 800x600 game in the
            // available viewport according to the requested scale mode.
            scale: {
                mode: phaserScaleMode,
                autoCenter: Phaser.Scale.CENTER_BOTH,
                parent: 'game-container',
                width: Number(CONFIG.width) || 800,
                height: Number(CONFIG.height) || 600
            },
            backgroundColor: '#000000',
            physics: {
                default: 'arcade',
                arcade: {
                    gravity: { y: 0 },
                    debug: false
                }
            },
            scene: [PreloadScene, AttractScene, TopTenScene, ConfigScene, LevelSelectScene, GameScene, BonusScene, GameOverScene]
        };

        // Copy game state keys to GAME_STATE
        const stateKeys = [
            'credits', 'language', 'difficulty', 'currentLevel', 'score', 'lives', 'dynamiteCount', 'keysCount', 'topScores'
        ];
        stateKeys.forEach(k => {
            if (cfg[k] !== undefined) GAME_STATE[k] = cfg[k];
        });

        new Phaser.Game(config);

        // If the configuration asks for a fullscreen toggle, add a small DOM button.
        try {
            if (CONFIG.enableFullscreen) {
                const existing = document.getElementById('fullscreenBtn');
                if (!existing) {
                    const btn = document.createElement('button');
                    btn.id = 'fullscreenBtn';
                    btn.title = 'Toggle Fullscreen';
                    btn.innerText = '⤢';
                    Object.assign(btn.style, {
                        position: 'fixed',
                        right: '12px',
                        top: '12px',
                        zIndex: 9999,
                        padding: '6px 8px',
                        fontSize: '16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'rgba(12,18,32,0.8)',
                        color: '#dbeeff',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                    });
                    btn.addEventListener('click', async () => {
                        try {
                            const container = document.getElementById('game-container') || document.documentElement;
                            if (document.fullscreenElement) {
                                await document.exitFullscreen();
                            } else if (container.requestFullscreen) {
                                await container.requestFullscreen();
                            } else if (container.webkitRequestFullscreen) {
                                // Safari
                                container.webkitRequestFullscreen();
                            }
                        } catch (e) {
                            console.warn('Fullscreen toggle failed', e);
                        }
                    });
                        // Keyboard shortcut: F toggles fullscreen
                        document.addEventListener('keydown', (ev) => {
                            if (ev && (ev.key === 'f' || ev.key === 'F')) {
                                ev.preventDefault?.();
                                btn.click();
                            }
                        });
                        // If device is touch-capable, make the button more prominent
                        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                            btn.style.padding = '10px 12px';
                            btn.style.fontSize = '20px';
                        }
                    document.body.appendChild(btn);
                }
            }
        } catch (e) {
            console.warn('Error creating fullscreen button', e);
        }

        return true;
    } catch (err) {
        console.error('Errore caricamento config.json:', err);
        alert('Impossibile caricare la configurazione del gioco.');
        return false;
    }
}

window.inizialization = inizialization;