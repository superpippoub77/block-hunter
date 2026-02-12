// ============================================================================
// BLOCKHUNTER - Arcade Game in Phaser 3
// ============================================================================

// Global configuration (populated from /data/config.json)
const CONFIG = {};

// Game state (populated from /data/config.json)
const GAME_STATE = {};

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
            if (parsed.cameraZoom) CONFIG.cameraZoom = parsed.cameraZoom;
            // Backwards compatibility: support old 'objectScale' saved values
            else if (parsed.objectScale) CONFIG.objectSize = Math.round(parsed.objectScale * OBJECT_NATIVE_SIZE);
        }
    } catch (e) {
        // ignore localStorage errors
    }
}

const GAME_FONT = '"Press Start 2P"';
// Translations
const TRANSLATIONS = {};

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

// ============================================================================
// BOOT SCENE
// ============================================================================
class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Create loading text with blinking cursor
        const baseText = 'LOADING...';
        let showCursor = true;
        const text = this.add.text(400, 300, baseText + ' |', {
            fontSize: '32px',
            fill: '#fff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        // Blinking cursor effect
        this.time.addEvent({
            delay: 500,
            loop: true,
            callback: () => {
                showCursor = !showCursor;
                text.setText(baseText + (showCursor ? ' |' : ''));
            }
        });

        this.tweens.add({
            targets: text,
            alpha: 0.3,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    create() {
        // La configurazione è già caricata da loadConfigAndStartGame, quindi si può passare direttamente
        this.scene.start('PreloadScene');
    }
}

// ============================================================================
// PRELOAD SCENE
// ============================================================================
class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }

    preload() {
        // Load title image
        this.load.image('title', 'images/title.png');

        // Load attract background
        this.load.image('bg', 'images/bg.png');

        // Load game background
        this.load.image('game_bg', 'images/game_bg.png');

        // Load flags sprite (8 flags: it, fr, de, en, us, ja, es, zh - 64x32 each)
        this.load.spritesheet('flags', 'images/flags.png', {
            frameWidth: 64,
            frameHeight: 32
        });

        // Load tiles sprite (6 tiles: wall, hole, sand, floor, stone, hole2 - 64x48 each)
        this.load.spritesheet('tiles', 'images/tiles.png', {
            frameWidth: 60,
            frameHeight: 48
        });

        // Load objects sprite (4x4 matrix = 16 objects)
        // Row 1: dynamite, heart, stone, player
        // Row 2: dynamite_chest, door, gem, stones
        // Row 3: key, sand_pile, ghost, pepita
        // Row 4: wall, hole1, hole2, explosion
        this.load.spritesheet('objects', 'images/obj.png', {
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

        // Create graphics for remaining assets
        this.createAssets();
    }

    createAssets() {
        // Objects sprite frame mapping (4x4 matrix):
        // Frame 0-3:   dynamite, heart, stone, player
        // Frame 4-7:   dynamite_chest, door, gem, stones
        // Frame 8-11:  key, sand_pile, ghost, pepita
        // Frame 12-15: wall, hole1, hole2, explosion

        const OBJECT_FRAMES = {
            dynamite_projectile: 0,
            heart: 1,
            stone: 2,
            player: 3,
            dynamite_chest: 4,
            door: 5,
            gem: 6,
            stones: 7,
            key: 8,
            sand_pile: 9,
            ghost: 10,
            pepita: 11,
            wall: 12,
            hole1: 13,
            hole2: 14,
            explosion: 15
        };

        // Create texture references from spritesheet
        // We'll use the spritesheet directly in game code
        // Just create the boulders and shards with graphics since they're not in the sprite

        const graphics = this.add.graphics();

        // Boulders (dynamic) - not in sprite, generate procedurally
        graphics.fillStyle(0x8B4513, 1);
        graphics.fillCircle(16, 16, 12);
        graphics.generateTexture('boulder_small', 32, 32);
        graphics.clear();

        graphics.fillCircle(20, 20, 18);
        graphics.generateTexture('boulder_medium', 40, 40);
        graphics.clear();

        graphics.fillCircle(24, 24, 22);
        graphics.generateTexture('boulder_large', 48, 48);
        graphics.clear();

        // Static rocks (diverse dimensioni e forme) - not in sprite
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

        // Store frame mapping for use in game
        window.OBJECT_FRAMES = OBJECT_FRAMES;
    }

    create() {
        // Carica le traduzioni prima di avviare la scena AttractScene
        const lang = CONFIG.language || 'it';
        loadTranslations(lang, () => {
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
        this.languages = ['it', 'fr', 'de', 'en', 'us', 'ja', 'es', 'zh'];
        this.currentLangIndex = 0;
        GAME_STATE.language = this.languages[0];

        // Background image
        this.add.image(400, 300, 'bg').setDisplaySize(800, 600);

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
        GAME_STATE.credits++;
        this.updateUI();
        this.resetTimeout();
    }

    startGame(players) {
        if (GAME_STATE.credits >= players) {
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
        this.currentLangIndex = (this.currentLangIndex + dir + this.languages.length) % this.languages.length;
        GAME_STATE.language = this.languages[this.currentLangIndex];

        // Update flag sprite frame
        if (this.flagSprite) {
            this.flagSprite.setFrame(this.currentLangIndex);
        }

        this.updateUI();
        this.resetTimeout();
    }

    updateUI() {
        // Fallback to empty object if translations not loaded
        const t = TRANSLATIONS[GAME_STATE.language] || {};

        // Provide default strings if missing
        const title = t.title || 'BLOCK HUNTER';
        const instructions = t.instructions || 'INSERT COIN TO START';
        const story = t.story || '';
        const insertCoin = t.insertCoin || 'INSERT COIN';
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
        const t = TRANSLATIONS[GAME_STATE.language];

        this.add.image(400, 300, 'bg').setDisplaySize(800, 600);

        const topTitle = this.add.text(400, 80, t.topTen, {
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
            `CAMERA ZOOM: ${CONFIG.cameraZoom.toFixed(2)}`,
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

        // Camera zoom control
        y += 22;
        this.add.text(30, y, 'Camera zoom:', { fontSize: '12px', fill: '#ffffff', fontFamily: GAME_FONT });
        this.cameraZoomText = this.add.text(160, y, CONFIG.cameraZoom.toFixed(2), { fontSize: '12px', fill: '#ffff00', fontFamily: GAME_FONT }).setOrigin(0, 0.5);
        const zoomMinus = this.add.text(220, y, '◄', { fontSize: '14px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);
        const zoomPlus = this.add.text(260, y, '►', { fontSize: '14px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive().setOrigin(0.5);

        // Camera enable/disable toggle
        y += 22;
        const cameraToggle = this.add.text(30, y, `Camera: ${CONFIG.cameraEnabled ? 'ON' : 'OFF'}`, { fontSize: '12px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive();
        y += 22;
        const zoomToggle = this.add.text(30, y, `Zoom: ${CONFIG.zoomEnabled ? 'ON' : 'OFF'}`, { fontSize: '12px', fill: '#ffffff', fontFamily: GAME_FONT }).setInteractive();
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

        zoomMinus.on('pointerdown', () => {
            CONFIG.cameraZoom = Math.max(0.5, Math.round((CONFIG.cameraZoom - 0.1) * 10) / 10);
            this.cameraZoomText.setText(CONFIG.cameraZoom.toFixed(2));
        });
        zoomPlus.on('pointerdown', () => {
            CONFIG.cameraZoom = Math.min(3, Math.round((CONFIG.cameraZoom + 0.1) * 10) / 10);
            this.cameraZoomText.setText(CONFIG.cameraZoom.toFixed(2));
        });

        cameraToggle.on('pointerdown', () => {
            CONFIG.cameraEnabled = !CONFIG.cameraEnabled;
            cameraToggle.setText(`Camera: ${CONFIG.cameraEnabled ? 'ON' : 'OFF'}`);
        });

        zoomToggle.on('pointerdown', () => {
            CONFIG.zoomEnabled = !CONFIG.zoomEnabled;
            zoomToggle.setText(`Zoom: ${CONFIG.zoomEnabled ? 'ON' : 'OFF'}`);
        });

        this.input.keyboard.on('keydown-O', () => {
            CONFIG.zoomEnabled = !CONFIG.zoomEnabled;
            zoomToggle.setText(`Zoom: ${CONFIG.zoomEnabled ? 'ON' : 'OFF'}`);
        });

        this.input.keyboard.on('keydown-I', () => {
            CONFIG.cameraEnabled = !CONFIG.cameraEnabled;
            cameraToggle.setText(`Camera: ${CONFIG.cameraEnabled ? 'ON' : 'OFF'}`);
        });

        applyBtn.on('pointerdown', () => {
            try {
                localStorage.setItem('blockHunterConfig', JSON.stringify({
                    tileSize: CONFIG.tileSize,
                    objectSize: CONFIG.objectSize,
                    cameraZoom: CONFIG.cameraZoom,
                    cameraEnabled: CONFIG.cameraEnabled,
                    zoomEnabled: CONFIG.zoomEnabled
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
            CONFIG.cameraZoom = 1;
            CONFIG.cameraEnabled = true;
            CONFIG.zoomEnabled = true;
            this.tileSizeText.setText(String(CONFIG.tileSize));
            this.objectSizeText.setText(String(CONFIG.objectSize));
            if (this.cameraZoomText) this.cameraZoomText.setText(CONFIG.cameraZoom.toFixed(2));
            cameraToggle.setText(`Camera: ${CONFIG.cameraEnabled ? 'ON' : 'OFF'}`);
            zoomToggle.setText(`Zoom: ${CONFIG.zoomEnabled ? 'ON' : 'OFF'}`);
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
            if (this.cameraZoomText) this.cameraZoomText.setText(CONFIG.cameraZoom.toFixed(2));
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
            { name: t.hard, mult: 1.3, y: 390 }
        ];

        // Keep references to text objects and selection state
        this.diffTexts = [];
        this.selectedIndex = 0;
        this.selectionGraphics = this.add.graphics();

        // Helper to change selection (wrap-around)
        this.changeSelection = (dir) => {
            this.selectedIndex = (this.selectedIndex + dir + this.difficulties.length) % this.difficulties.length;
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
                this.selectedIndex = idx;
                this.updateSelection();
            });
            text.on('pointerout', () => {
                // keep selection visuals (do not clear on out)
            });
            text.on('pointerdown', () => {
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
            const diff = this.difficulties[this.selectedIndex];
            GAME_STATE.difficulty = diff.mult;
            this.scene.start('GameScene');
        });
        this.input.keyboard.on('keydown-SPACE', () => {
            const diff = this.difficulties[this.selectedIndex];
            GAME_STATE.difficulty = diff.mult;
            this.scene.start('GameScene');
        });

        // Keep numeric shortcuts (also update selection visuals before starting)
        this.input.keyboard.on('keydown-ONE', () => {
            this.selectedIndex = 0;
            this.updateSelection();
            GAME_STATE.difficulty = this.difficulties[0].mult;
            this.scene.start('GameScene');
        });
        this.input.keyboard.on('keydown-TWO', () => {
            this.selectedIndex = 1;
            this.updateSelection();
            GAME_STATE.difficulty = this.difficulties[1].mult;
            this.scene.start('GameScene');
        });
        this.input.keyboard.on('keydown-THREE', () => {
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
        // Background for all levels
        this.gameBg = this.add.image(CONFIG.width / 2, CONFIG.height / 2, 'game_bg')
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
            this.levelConfig = {
                ...this.levelConfig,
                ...this.levelData,
                // Keep dynamicBoulders from LEVEL_CONFIG as it has direction/size info
                dynamicBoulders: this.levelConfig.dynamicBoulders
            };
        }

        // Create groups
        this.walls = this.physics.add.staticGroup();
        this.rocks = this.physics.add.staticGroup();
        this.boulders = this.physics.add.group();
        this.gems = this.physics.add.group();
        this.items = this.physics.add.group();
        this.dynamites = this.physics.add.group();
        this.shards = this.physics.add.group();
        this.doors = this.physics.add.staticGroup();

        // Create tilemap
        this.hasDoorInMap = false;
        this.mapGemPositions = [];
        this.mapGemIndex = 0;
        this.keySpawnPositions = [];
        this.lastKeyPos = null;
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
            this.gameBg.setPosition(worldX + worldWidth / 2, worldY + worldHeight / 2);
            this.gameBg.setScrollFactor(1);
        }

        if (this.cameras && this.cameras.main) {
            const cam = this.cameras.main;
            const viewW = cam.width;
            const viewH = cam.height;
            cam.setBounds(worldX, worldY, worldWidth, worldHeight);
            cam.roundPixels = true;

            // Auto-zoom for small maps so the camera view becomes smaller than the world
            // Respect configured base zoom as a minimum.
            let zoom = Math.max(0.5, CONFIG.cameraZoom || 1);
            if (worldWidth > 0 && worldHeight > 0 && (worldWidth <= viewW || worldHeight <= viewH)) {
                const fitZoom = Math.max(viewW / worldWidth, viewH / worldHeight);
                zoom = Math.max(zoom, fitZoom * 1.1);
            }
            cam.setZoom(zoom);

            const viewWorldW = viewW / zoom;
            const viewWorldH = viewH / zoom;
            const canScrollX = worldWidth > viewWorldW;
            const canScrollY = worldHeight > viewWorldH;

            if (canScrollX || canScrollY) {
                cam.startFollow(this.player, true, 0.08, 0.08);
                const dzW = canScrollX ? Math.min(viewWorldW * 0.35, worldWidth - viewWorldW) : 0;
                const dzH = canScrollY ? Math.min(viewWorldH * 0.35, worldHeight - viewWorldH) : 0;
                if (dzW > 0 && dzH > 0) {
                    cam.setDeadzone(dzW, dzH);
                }
            } else {
                cam.stopFollow();
                cam.centerOn(worldX + worldWidth / 2, worldY + worldHeight / 2);
            }
        }

        // Gems per level
        if (this.mapGemPositions && this.mapGemPositions.length > 0) {
            this.gemsRemaining = this.mapGemPositions.length;
        } else {
            this.gemsRemaining = CONFIG.gemsPerLevel;
        }

        // Spawn static rocks
        this.spawnStaticRocks();

        // Spawn first gem
        this.time.delayedCall(CONFIG.gemSpawnDelay, () => this.spawnGem());

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

        // Setup level timer (if provided in level data)
        this.setupLevelTimer();

        // Setup input
        this.setupInput();

        // Start boulder spawning
        if (this.levelConfig.dynamicBoulders) {
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

        const mapSymbolToType = (value) => {
            if (typeof value !== 'string') return value;
            if (value.length === 1) {
                switch (value) {
                    case 'w': return 'wall';
                    case 'h': return 'hole';
                    case 's': return 'hole2';
                    case 'g': return 'gem';
                    case '-': return 'empty';
                    case 'd': return 'door';
                    case 'k': return 'key';
                    case 'p': return 'pepita';
                    case 'b': return 'dynamite';
                    default: return value;
                }
            }
            return value;
        };

        for (let y = 0; y < mapRows; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < mapCols; x++) {
                let type = 'floor';

                // If we have map data from JSON, use it
                if (mapData && mapData[y] && mapData[y][x] !== undefined) {
                    type = mapSymbolToType(mapData[y][x]);
                } else {
                    // Fallback to old random generation
                    // Border walls
                    if (x === 0 || x === mapCols - 1 || y === 0 || y === mapRows - 1) {
                        type = 'wall';
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

                // Normalize item/door/gem tiles to floor for base tile rendering
                const tileType = (type === 'door' || type === 'key' || type === 'pepita' || type === 'dynamite' || type === 'gem')
                    ? 'floor'
                    : type;
                let tileSprite = null;

                if (tileType !== 'empty') {
                    // Get frame index for this tile type
                    const frameIndex = TILE_FRAMES[tileType] !== undefined ? TILE_FRAMES[tileType] : TILE_FRAMES.floor;

                    // Create sprite from tiles spritesheet at integer-aligned positions
                    const tx = Math.round(offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2);
                    const ty = Math.round(offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2);
                    tileSprite = this.add.sprite(tx, ty, 'tiles', frameIndex);
                    // Force tile to display exactly as a square cell of CONFIG.tileSize
                    // (avoids gaps when native tile frame height differs from width)
                    tileSprite.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);

                    if (type === 'wall' && this.walls) {
                        this.walls.add(tileSprite);
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
                        window.OBJECT_FRAMES.door
                    );
                    this.setupDoor(door);
                    this.hasDoorInMap = true;
                }

                if ((type === 'key' || type === 'pepita' || type === 'dynamite') && this.items) {
                    const frame = type === 'key'
                        ? window.OBJECT_FRAMES.key
                        : (type === 'pepita' ? window.OBJECT_FRAMES.pepita : window.OBJECT_FRAMES.dynamite_chest);
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

                this.tiles[y][x] = { type: tileType, sprite: tileSprite };
            }
        }

        // Store map dimensions for later use
        this.mapRows = mapRows;
        this.mapCols = mapCols;
        this.mapOffsetX = offsetX;
        this.mapOffsetY = offsetY;
    }

    createPlayer() {
        const centerX = CONFIG.width / 2;
        const centerY = CONFIG.height / 2;

        // Use player sprite from objects.png (frame 3) and keep original size
        this.player = this.physics.add.sprite(centerX, centerY, 'objects', window.OBJECT_FRAMES.player);
        // Apply configured object size (pixels) by converting to a scale factor
        const playerScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        this.player.setScale(playerScaleFactor);
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

        const rock = this.rocks.create(jitteredX, jitteredY, 'objects', window.OBJECT_FRAMES.stone);
        // Apply object size (pixels) converted to scale factor
        const rockScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        rock.setScale(rockScaleFactor);
        rock.setData('destructible', true);
        rock.setData('size', size);
        rock.setData('isFalling', true);

        // Rotazione casuale in partenza
        const startAngle = Phaser.Math.Between(0, 360);
        const endAngle = Phaser.Math.Between(0, 360);
        rock.setAngle(startAngle);

        // Effetto di apparizione con zoom da grosso a piccolo (caduta)
        rock.setScale(scale * 3); // Inizia 3x più grande
        rock.alpha = 0.7; // Leggermente trasparente all'inizio
        this.tweens.add({
            targets: rock,
            scale: scale,
            alpha: 1,
            angle: endAngle,
            duration: 400,
            ease: 'Cubic.easeOut', // Effetto di caduta naturale
            onComplete: () => {
                if (!rock || !rock.active || !rock.body) {
                    return;
                }
                // Aggiorna il corpo fisico dopo lo scaling: use actual display size
                if (rock.body) {
                    rock.body.setSize(Math.floor(rock.displayWidth || rock.width), Math.floor(rock.displayHeight || rock.height));
                }
                rock.setData('isFalling', false);
                // Piccolo rimbalzo finale
                this.tweens.add({
                    targets: rock,
                    scale: scale * 1.1,
                    duration: 100,
                    yoyo: true,
                    ease: 'Sine.easeInOut'
                });

                // Effetto di tonfo: leggero shake camera + squash rapido
                if (this.cameras && this.cameras.main) {
                    this.cameras.main.shake(80, 0.002);
                }
                this.tweens.add({
                    targets: rock,
                    scaleX: scale * 1.05,
                    scaleY: scale * 0.95,
                    duration: 80,
                    yoyo: true,
                    ease: 'Sine.easeOut'
                });

                // Polvere che si alza
                this.createDustPuff(rock.x, rock.y, scale);
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

        // Use gem sprite from objects.png (frame 6)
        const gem = this.gems.create(worldX, worldY, 'objects', window.OBJECT_FRAMES.gem);
        // Apply object size (pixels) converted to scale factor and update physics body
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

        if (this.mapGemPositions && this.mapGemPositions.length > 0) {
            this.mapGemIndex++;
        }
    }

    spawnKey() {
        const x = Phaser.Math.Between(2, this.mapCols - 3);
        const y = Phaser.Math.Between(2, this.mapRows - 3);

        const worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;

        // Use key sprite from objects.png (frame 8)
        const keySprite = this.items.create(worldX, worldY, 'objects', window.OBJECT_FRAMES.key);
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
        this.lastKeyPos = { x: worldX, y: worldY };
    }

    spawnKeyAt(x, y) {
        const keySprite = this.items.create(x, y, 'objects', window.OBJECT_FRAMES.key);
        // Keep key at original size
        if (keySprite.body) {
            keySprite.body.setSize(Math.floor(keySprite.displayWidth || keySprite.width), Math.floor(keySprite.displayHeight || keySprite.height));
        }
        keySprite.setData('type', 'key');
        this.lastKeyPos = { x, y };
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
        const door = this.doors.create(worldX, worldY, 'objects', window.OBJECT_FRAMES.door);
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

    setupCollisions() {
        // Player collisions
        this.physics.add.overlap(this.player, this.gems, this.collectGem, null, this);
        this.physics.add.overlap(this.player, this.items, this.collectItem, null, this);
        this.physics.add.collider(this.player, this.rocks);
        this.physics.add.overlap(this.player, this.rocks, this.hitByRock, null, this);
        this.physics.add.overlap(this.player, this.boulders, this.hitByBoulder, null, this);
        this.physics.add.overlap(this.player, this.shards, this.hitByShard, null, this);
        if (this.walls) {
            this.physics.add.collider(this.player, this.walls);
        }
        if (this.doors) {
            this.physics.add.collider(this.player, this.doors, this.onPlayerDoorCollide, null, this);
        }

        // Dynamite collisions
        this.physics.add.collider(this.dynamites, this.rocks, this.dynamiteHitRock, null, this);
        this.physics.add.overlap(this.dynamites, this.boulders, this.dynamiteHitBoulder, null, this);
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
        this.physics.add.collider(this.boulders, this.rocks);
        this.physics.add.collider(this.boulders, this.boulders);
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.keys = this.input.keyboard.addKeys({
            w: Phaser.Input.Keyboard.KeyCodes.W,
            a: Phaser.Input.Keyboard.KeyCodes.A,
            s: Phaser.Input.Keyboard.KeyCodes.S,
            d: Phaser.Input.Keyboard.KeyCodes.D,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE
        });

        this.lastDynamiteTime = 0;
    }

    createUI() {
        const t = TRANSLATIONS[GAME_STATE.language];

        this.scoreText = this.add.text(10, 10, `${t.score}: ${GAME_STATE.score}`, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: GAME_FONT
        });

        this.livesText = this.add.text(10, 35, `${t.lives}:`, {
            fontSize: '16px',
            fill: '#ff0000',
            fontFamily: GAME_FONT
        });

        this.dynamiteText = this.add.text(10, 60, `${t.dynamite}:`, {
            fontSize: '16px',
            fill: '#ffaa00',
            fontFamily: GAME_FONT
        });

        this.keysText = this.add.text(10, 85, `${t.keys}:`, {
            fontSize: '16px',
            fill: '#ffff66',
            fontFamily: GAME_FONT
        });

        this.gemsText = this.add.text(10, 110, `${t.gems}:`, {
            fontSize: '16px',
            fill: '#00ffff',
            fontFamily: GAME_FONT
        });

        this.levelText = this.add.text(790, 10, `${t.level}: ${GAME_STATE.currentLevel + 1}`, {
            fontSize: '16px',
            fill: '#00ff00',
            fontFamily: GAME_FONT
        }).setOrigin(1, 0);

        // Timer pepitas: create background (full-color) icons and a disabled overlay
        // that will progressively gray out elapsed slots.
        this.timerPepitas = []; // background (full-color)
        this.timerPepitasDisabled = []; // overlay (grayed) shown for elapsed slots
        this.timerPepitasCount = 20;
        const pepitaSize = 12;
        const pepitaGap = 1;
        const pepitaY = CONFIG.height - 16;
        this.timerLabel = this.add.text(10, pepitaY, 'TIMER', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: GAME_FONT
        }).setOrigin(0, 0.5);
        const pepitaStartX = this.timerLabel.getBounds().right + 8;
        for (let i = 0; i < this.timerPepitasCount; i++) {
            // background full-color pepita
            const pepita = this.add.sprite(
                pepitaStartX + i * (pepitaSize + pepitaGap),
                pepitaY,
                'objects',
                window.OBJECT_FRAMES.pepita
            );
            // scale timer icons according to objectSize (pixels)
            // Note: keep existing relative sizing behaviour but applied to both layers
            const pepitaScaleFactor = (CONFIG.objectSize / OBJECT_NATIVE_SIZE) * (pepitaSize / OBJECT_NATIVE_SIZE);
            pepita.setScale(pepitaScaleFactor);
            pepita.setScrollFactor(0);
            pepita.setDepth(2000);
            pepita.setVisible(false);
            this.timerPepitas.push(pepita);

            // disabled overlay (tinted gray) placed above the background
            const disabled = this.add.sprite(
                pepita.x,
                pepita.y,
                'objects',
                window.OBJECT_FRAMES.pepita
            );
            disabled.setScale(pepitaScaleFactor);
            disabled.setScrollFactor(0);
            // tint to gray to give a "disabled" appearance and slightly lower alpha
            disabled.setTint(0x888888);
            disabled.setAlpha(0.95);
            disabled.setDepth(pepita.depth + 1);
            disabled.setVisible(false);
            this.timerPepitasDisabled.push(disabled);
        }

        // Keep HUD fixed to screen
        this.scoreText.setScrollFactor(0).setDepth(2000);
        this.livesText.setScrollFactor(0).setDepth(2000);
        this.dynamiteText.setScrollFactor(0).setDepth(2000);
        this.keysText.setScrollFactor(0).setDepth(2000);
        this.gemsText.setScrollFactor(0).setDepth(2000);
        this.levelText.setScrollFactor(0).setDepth(2000);
        this.timerLabel.setScrollFactor(0).setDepth(2000);

        this.timerLabel.setVisible(false);
        // Hide both layers initially
        this.timerPepitas.forEach((p) => p.setVisible(false));
        if (this.timerPepitasDisabled) this.timerPepitasDisabled.forEach((d) => d.setVisible(false));

        this.livesIcons = [];
        this.dynamiteIcons = [];
        this.keysIcons = [];
        this.gemsIcons = [];
        this.refreshHudIcons();
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

    update() {
        if (!this.player || !this.player.active) return;

        // Player movement
        let velocityX = 0;
        let velocityY = 0;

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

        // Check if on sand
        const tile = this.getTileAt(this.player.x, this.player.y);
        if (tile && tile.type === 'sand') {
            speed *= 0.6;
        }

        this.player.setVelocity(velocityX * speed, velocityY * speed);

        // Shoot dynamite
        if (Phaser.Input.Keyboard.JustDown(this.keys.space)) {
            this.shootDynamite();
        }

        // Check if on hole
        if (tile && tile.type === 'hole') {
            this.hitHole();
        }

        // Check proximity to doors for opening
        this.checkDoorProximity();

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

    shootDynamite() {
        if (GAME_STATE.dynamiteCount <= 0) return;
        if (this.time.now - this.lastDynamiteTime < 300) return;

        GAME_STATE.dynamiteCount--;
        this.lastDynamiteTime = this.time.now;

        const dirX = this.lastMoveDir?.x ?? 1;
        const dirY = this.lastMoveDir?.y ?? 0;

        // Use dynamite projectile sprite from objects.png (frame 0)
        const dynamite = this.dynamites.create(this.player.x, this.player.y, 'objects', window.OBJECT_FRAMES.dynamite_projectile);
        const dynamiteScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        dynamite.setScale(dynamiteScaleFactor);
        // Keep dynamite at original sprite size; update physics body if present
        if (dynamite.body) {
            dynamite.body.setSize(Math.floor(dynamite.displayWidth || dynamite.width), Math.floor(dynamite.displayHeight || dynamite.height));
            dynamite.body.onWorldBounds = true;
        }
        dynamite.setVelocity(dirX * CONFIG.dynamiteSpeed, dirY * CONFIG.dynamiteSpeed);
        dynamite.setBounce(1, 1);
        dynamite.setCollideWorldBounds(true);
        if (dynamite.body) {
            dynamite.body.onWorldBounds = true;
        }

        // Subtle oscillating rotation while flying
        this.tweens.add({
            targets: dynamite,
            angle: 12,
            duration: 180,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        this.time.delayedCall(CONFIG.dynamiteLifetime, () => {
            if (dynamite.active) {
                this.explodeDynamite(dynamite);
            }
        });
    }

    explodeDynamite(dynamite) {
        // Create explosion effect using explosion sprite from objects.png (frame 15)
        const explosion = this.add.sprite(dynamite.x, dynamite.y, 'objects', window.OBJECT_FRAMES.explosion);
        const explosionScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        explosion.setScale(explosionScaleFactor);
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
        const explosion = this.add.sprite(x, y, 'objects', window.OBJECT_FRAMES.explosion);
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

    addScore(amount, x, y) {
        GAME_STATE.score += amount;
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

    destroyBoulder(boulder) {
        const size = boulder.getData('size') || 'medium';
        const shardCount = this.getShardCount(size);

        for (let i = 0; i < shardCount; i++) {
            const angle = (Math.PI * 2 * i) / shardCount;
            const shard = this.shards.create(boulder.x, boulder.y, 'shard');
            shard.setVelocity(
                Math.cos(angle) * CONFIG.shardSpeed,
                Math.sin(angle) * CONFIG.shardSpeed
            );

            this.time.delayedCall(CONFIG.shardLifetime, () => {
                if (shard.active) shard.destroy();
            });
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
        gem.destroy();
        this.addScore(50, gem.x, gem.y);

        this.gemsRemaining--;

        if (this.gemsRemaining > 0) {
            this.time.delayedCall(CONFIG.gemSpawnDelay, () => this.spawnGem());
            return;
        }

        // Level complete
        this.levelComplete();
    }

    collectItem(player, item) {
        const type = item.getData('type');

        if (type === 'key') {
            this.addScore(5, item.x, item.y);
            GAME_STATE.keysCount++;
            this.lastKeyPos = { x: item.x, y: item.y };
        } else if (type === 'dynamite') {
            GAME_STATE.dynamiteCount += 5;
        } else if (type === 'pepita') {
            GAME_STATE.lives++;
        }

        item.destroy();
    }

    tryOpenDoor(player, door) {
        if (!door || !door.active) return;
        if (door.getData('opening')) return;
        if (!door.getData('locked')) return;
        if (GAME_STATE.keysCount <= 0) return;

        GAME_STATE.keysCount--;
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

    hitHole() {
        this.loseLife();
    }

    loseLife() {
        if (this.invulnerable) return;

        GAME_STATE.lives--;
        this.addScore(-20, this.player?.x, this.player?.y);

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

    levelComplete() {
        this.addScore(50, this.player?.x, this.player?.y);
        GAME_STATE.currentLevel++;

        if (GAME_STATE.currentLevel >= LEVEL_CONFIG.levels.length) {
            // Game won!
            GAME_STATE.currentLevel = 0;
        }

        this.time.delayedCall(1000, () => {
            this.scene.restart();
        });
    }

    gameOver() {
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

    spawnBoulder() {
        if (!this.levelConfig.dynamicBoulders) return;

        const directions = this.levelConfig.dynamicBoulders.directions;
        const sizes = this.levelConfig.dynamicBoulders.sizes;

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

        const boulder = this.boulders.create(x, y, `boulder_${size}`);
        boulder.setVelocity(vx, vy);
        boulder.setData('size', size);
        boulder.setBounce(0.8);
    }

    updateUITexts() {
        const t = TRANSLATIONS[GAME_STATE.language];
        this.scoreText.setText(`${t.score}: ${GAME_STATE.score}`);
        this.livesText.setText(`${t.lives}:`);
        this.dynamiteText.setText(`${t.dynamite}:`);
        if (this.keysText) {
            this.keysText.setText(`${t.keys}:`);
        }
        if (this.gemsText) {
            this.gemsText.setText(`${t.gems}:`);
        }

        this.refreshHudIcons();
    }

    refreshHudIcons() {
        if (!this.livesText || !this.dynamiteText || !this.keysText) return;

        const iconSize = 16;
        const gap = 4;

        const clearIcons = (arr) => {
            arr.forEach((icon) => icon && icon.destroy && icon.destroy());
            arr.length = 0;
        };

        clearIcons(this.livesIcons);
        clearIcons(this.dynamiteIcons);
        clearIcons(this.keysIcons);
        clearIcons(this.gemsIcons);

        const placeIcons = (count, arr, frame, label) => {
            const bounds = label.getBounds();
            const startX = bounds.right + 6;
            const y = label.y + label.height / 2 + 1;
            for (let i = 0; i < count; i++) {
                const icon = this.add.sprite(startX + i * (iconSize + gap), y, 'objects', frame);
                icon.setDisplaySize(iconSize, iconSize);
                icon.setScrollFactor(0);
                icon.setDepth(2000);
                arr.push(icon);
            }
        };

        placeIcons(GAME_STATE.lives, this.livesIcons, window.OBJECT_FRAMES.heart, this.livesText);
        placeIcons(GAME_STATE.dynamiteCount, this.dynamiteIcons, window.OBJECT_FRAMES.dynamite_projectile, this.dynamiteText);
        placeIcons(GAME_STATE.keysCount, this.keysIcons, window.OBJECT_FRAMES.key, this.keysText);
        placeIcons(this.gemsRemaining, this.gemsIcons, window.OBJECT_FRAMES.gem, this.gemsText);
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
// GAME CONFIGURATION
// ============================================================================
function loadConfigAndStartGame() {
    fetch('data/config.json')
        .then(response => response.json())
        .then(cfg => {
            // Copy all config keys to CONFIG
            Object.assign(CONFIG, cfg);

            const config = {
                type: Phaser.AUTO,
                width: CONFIG.width,
                height: CONFIG.height,
                parent: 'game-container',
                backgroundColor: '#000000',
                physics: {
                    default: 'arcade',
                    arcade: {
                        gravity: { y: 0 },
                        debug: false
                    }
                },
                scene: [BootScene, PreloadScene, AttractScene, TopTenScene, ConfigScene, LevelSelectScene, GameScene, GameOverScene]
            };

            // Copy game state keys to GAME_STATE
            const stateKeys = [
                'credits', 'language', 'difficulty', 'currentLevel', 'score', 'lives', 'dynamiteCount', 'keysCount', 'topScores'
            ];
            stateKeys.forEach(k => {
                if (cfg[k] !== undefined) GAME_STATE[k] = cfg[k];
            });

            new Phaser.Game(config);
        })
        .catch(err => {
            console.error('Errore caricamento config.json:', err);
            alert('Impossibile caricare la configurazione del gioco.');
        });
}

loadConfigAndStartGame();
