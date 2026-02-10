// ============================================================================
// BLOCKHUNTER - Arcade Game in Phaser 3
// ============================================================================

// Global configuration
const CONFIG = {
    width: 800,
    height: 600,
    tileSize: 32,
    gridWidth: 25,
    gridHeight: 18,
    playerSpeed: 120,
    boulderBaseSpeed: 60,
    dynamiteSpeed: 200,
    shardSpeed: 150,
    dynamiteLifetime: 5000,
    shardLifetime: 2000,
    doorCloseTime: 30000,
    attractTimeout: 10000,
    topTenTimeout: 10000,
    gemSpawnDelay: 1000
};

const GAME_FONT = '"Press Start 2P"';
// Translations
const TRANSLATIONS = {
    it: {
        title: 'BLOCKHUNTER',
        insertCoin: 'INSERISCI MONETA',
        credit: 'CREDITO',
        player1: '1 GIOCATORE',
        player2: '2 GIOCATORI',
        instructions: 'RACCOGLI TUTTE LE GEMME\nEVITA I MASSI\nWASD - MUOVI\nSPAZIO - DINAMITE',
        selectDifficulty: 'SCEGLI DIFFICOLTA',
        beginner: 'PRINCIPIANTE',
        medium: 'MEDIO',
        hard: 'DIFFICILE',
        gameOver: 'FINE PARTITA',
        enterName: 'INSERISCI NOME',
        topTen: 'CLASSIFICA',
        score: 'PUNTEGGIO',
        lives: 'VITE',
        dynamite: 'DINAMITE',
        level: 'LIVELLO'
    },
    fr: {
        title: 'BLOCKHUNTER',
        insertCoin: 'INSERER PIECE',
        credit: 'CREDIT',
        player1: '1 JOUEUR',
        player2: '2 JOUEURS',
        instructions: 'COLLECTEZ GEMMES\nEVITEZ ROCHERS\nWASD - BOUGER\nESPACE - DYNAMITE',
        selectDifficulty: 'CHOISIR DIFFICULTE',
        beginner: 'DEBUTANT',
        medium: 'MOYEN',
        hard: 'DIFFICILE',
        gameOver: 'FIN DU JEU',
        enterName: 'ENTREZ NOM',
        topTen: 'MEILLEURS SCORES',
        score: 'SCORE',
        lives: 'VIES',
        dynamite: 'DYNAMITE',
        level: 'NIVEAU'
    },
    de: {
        title: 'BLOCKHUNTER',
        insertCoin: 'MUNZE EINWERFEN',
        credit: 'KREDIT',
        player1: '1 SPIELER',
        player2: '2 SPIELER',
        instructions: 'SAMMLE EDELSTEINE\nVERMEIDE FELSEN\nWASD - BEWEGEN\nLEERTASTE - DYNAMIT',
        selectDifficulty: 'SCHWIERIGKEIT WAHLEN',
        beginner: 'ANFANGER',
        medium: 'MITTEL',
        hard: 'SCHWER',
        gameOver: 'SPIEL VORBEI',
        enterName: 'NAME EINGEBEN',
        topTen: 'TOP TEN',
        score: 'PUNKTE',
        lives: 'LEBEN',
        dynamite: 'DYNAMIT',
        level: 'STUFE'
    },
    en: {
        title: 'BLOCKHUNTER',
        insertCoin: 'INSERT COIN',
        credit: 'CREDIT',
        player1: '1 PLAYER',
        player2: '2 PLAYERS',
        instructions: 'COLLECT ALL GEMS\nAVOID BOULDERS\nWASD - MOVE\nSPACE - DYNAMITE',
        selectDifficulty: 'SELECT DIFFICULTY',
        beginner: 'BEGINNER',
        medium: 'MEDIUM',
        hard: 'HARD',
        gameOver: 'GAME OVER',
        enterName: 'ENTER NAME',
        topTen: 'TOP TEN SCORES',
        score: 'SCORE',
        lives: 'LIVES',
        dynamite: 'DYNAMITE',
        level: 'LEVEL'
    },
    us: {
        title: 'BLOCKHUNTER',
        insertCoin: 'INSERT COIN',
        credit: 'CREDIT',
        player1: '1 PLAYER',
        player2: '2 PLAYERS',
        instructions: 'COLLECT ALL GEMS\nAVOID BOULDERS\nWASD - MOVE\nSPACE - DYNAMITE',
        selectDifficulty: 'SELECT DIFFICULTY',
        beginner: 'BEGINNER',
        medium: 'MEDIUM',
        hard: 'HARD',
        gameOver: 'GAME OVER',
        enterName: 'ENTER NAME',
        topTen: 'TOP TEN SCORES',
        score: 'SCORE',
        lives: 'LIVES',
        dynamite: 'DYNAMITE',
        level: 'LEVEL'
    },
    ja: {
        title: 'BLOCKHUNTER',
        insertCoin: 'コインを入れる',
        credit: 'クレジット',
        player1: '1プレイヤー',
        player2: '2プレイヤー',
        instructions: '宝石を集める\n岩を避ける\nWASD - 移動\nスペース - ダイナマイト',
        selectDifficulty: '難易度を選択',
        beginner: '初心者',
        medium: '中級',
        hard: '上級',
        gameOver: 'ゲームオーバー',
        enterName: '名前を入力',
        topTen: 'トップテン',
        score: 'スコア',
        lives: 'ライフ',
        dynamite: 'ダイナマイト',
        level: 'レベル'
    },
    es: {
        title: 'BLOCKHUNTER',
        insertCoin: 'INSERTAR MONEDA',
        credit: 'CREDITO',
        player1: '1 JUGADOR',
        player2: '2 JUGADORES',
        instructions: 'RECOGE TODAS LAS GEMAS\nEVITA LAS ROCAS\nWASD - MOVER\nESPACIO - DINAMITA',
        selectDifficulty: 'SELECCIONAR DIFICULTAD',
        beginner: 'PRINCIPIANTE',
        medium: 'MEDIO',
        hard: 'DIFICIL',
        gameOver: 'FIN DEL JUEGO',
        enterName: 'INTRODUCE NOMBRE',
        topTen: 'MEJORES PUNTUACIONES',
        score: 'PUNTUACION',
        lives: 'VIDAS',
        dynamite: 'DINAMITA',
        level: 'NIVEL'
    },
    zh: {
        title: 'BLOCKHUNTER',
        insertCoin: '投币',
        credit: '信用',
        player1: '1玩家',
        player2: '2玩家',
        instructions: '收集宝石\n避开巨石\nWASD - 移动\n空格 - 炸药',
        selectDifficulty: '选择难度',
        beginner: '初级',
        medium: '中级',
        hard: '困难',
        gameOver: '游戏结束',
        enterName: '输入名字',
        topTen: '前十名',
        score: '分数',
        lives: '生命',
        dynamite: '炸药',
        level: '关卡'
    }
};

// Game state
const GAME_STATE = {
    credits: 0,
    language: 'en',
    difficulty: 1.0,
    currentLevel: 0,
    score: 0,
    lives: 5,
    dynamiteCount: 20,
    topScores: [
        { name: 'AAA', score: 5000 },
        { name: 'BBB', score: 4000 },
        { name: 'CCC', score: 3000 },
        { name: 'DDD', score: 2000 },
        { name: 'EEE', score: 1000 },
        { name: 'FFF', score: 900 },
        { name: 'GGG', score: 800 },
        { name: 'HHH', score: 700 },
        { name: 'III', score: 600 },
        { name: 'JJJ', score: 500 }
    ]
};

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
        // Create loading text
        const text = this.add.text(400, 300, 'LOADING...', {
            fontSize: '32px',
            fill: '#fff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        this.tweens.add({
            targets: text,
            alpha: 0.3,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    create() {
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
        this.load.spritesheet('objects', 'images/objects.png', {
            frameWidth: 64,
            frameHeight: 64
        });

        // Load all level JSON files (50 levels)
        for (let i = 10; i <= 54; i++) {
            this.load.json(`level${i}`, `data/level/level${i}.json`);
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
        this.scene.start('AttractScene');
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

        // Background
        this.add.rectangle(400, 300, 800, 600, 0x001122);

        // Title image (loaded from images/title.png)
        // Appears with a falling-rock effect and then vibrates
        // If you want to localize the title per language, replace the texture key accordingly.
        this.titleImage = this.add.image(400, -120, 'title').setOrigin(0.5);
        // Start slightly bigger to emphasize the drop
        this.titleImage.setScale(1.3);

        // Landing tween: drop into place with bounce, then start vibration + blink
        this.tweens.add({
            targets: this.titleImage,
            y: 150,
            scale: 1,
            duration: 800,
            ease: 'Bounce.easeOut',
            onComplete: () => {
                // Start temporary vibration/rotation/blink tweens and stop them after a short time
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

                // Stop the temporary effects after a short duration (3 seconds)
                this.time.delayedCall(3000, () => {
                    try {
                        if (vibTween && vibTween.stop) vibTween.stop();
                        if (rotTween && rotTween.stop) rotTween.stop();
                        if (blinkTween && blinkTween.stop) blinkTween.stop();
                    } catch (e) {
                        // ignore if tweens already removed
                    }

                    // Reset to stable final state
                    this.titleImage.x = 400;
                    this.titleImage.y = 150;
                    this.titleImage.angle = 0;
                    this.titleImage.alpha = 1;
                    this.titleImage.setScale(1);
                });
            }
        });

        // Instructions
        this.instructionsText = this.add.text(400, 280, '', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: GAME_FONT,
            align: 'center'
        }).setOrigin(0.5);

        // Falling effect for instructions (like boulders)
        this.instructionsText.y = -50; // Start above screen
        this.tweens.add({
            targets: this.instructionsText,
            y: 280,
            duration: 800,
            ease: 'Bounce.easeOut'
        });

        // Subtle continuous wobble to simulate unstable rock
        this.tweens.add({
            targets: this.instructionsText,
            angle: -1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 800
        });

        // Language selector with flags
        this.flagSprite = this.add.sprite(400, 400, 'flags', this.currentLangIndex).setOrigin(0.5);

        // Flag waving animation (sventolio)
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

        // Insert coin text
        this.coinText = this.add.text(400, 480, '', {
            fontSize: '24px',
            fill: '#ffee00ff',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        // Player buttons
        this.player1Text = this.add.text(150, 550, '', {
            fontSize: '18px',
            fill: '#666666',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        this.player2Text = this.add.text(650, 550, '', {
            fontSize: '18px',
            fill: '#666666',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

        // Setup input
        this.setupInput();

        // Update UI
        this.updateUI();

        // Attract timeout
        this.resetTimeout();
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
        const t = TRANSLATIONS[GAME_STATE.language];

        // Title used to be a text object; now we use an image. Keep backward compatibility
        // in case other code still created a text title elsewhere.
        if (this.titleText && typeof this.titleText.setText === 'function') {
            this.titleText.setText(t.title);
        } else if (this.titleImage) {
            // no-op: title is an image loaded from images/title.png
        }
        this.instructionsText.setText(t.instructions);

        // Language is now shown via flag sprite, not text
        // (removed: this.langText.setText(GAME_STATE.language.toUpperCase());)

        if (GAME_STATE.credits === 0) {
            this.coinText.setText(t.insertCoin);
        } else {
            this.coinText.setText(t.credit + ' ' + GAME_STATE.credits);
        }

        if (GAME_STATE.credits >= 1) {
            this.player1Text.setText(t.player1).setStyle({ fill: '#00ff00' });
        } else {
            this.player1Text.setText(t.player1).setStyle({ fill: '#666666' });
        }

        if (GAME_STATE.credits >= 2) {
            this.player2Text.setText(t.player2).setStyle({ fill: '#00ff00' });
        } else {
            this.player2Text.setText(t.player2).setStyle({ fill: '#666666' });
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

        this.add.rectangle(400, 300, 800, 600, 0x000033);

        this.add.text(400, 80, t.topTen, {
            fontSize: '48px',
            fill: '#ffff00',
            fontFamily: GAME_FONT
        }).setOrigin(0.5);

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
                sprite.setDisplaySize(spriteSize, spriteSize);

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
            tile.setDisplaySize(spriteSize, spriteSize);

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

        this.add.rectangle(400, 300, 800, 600, 0x112200);

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

        // Create tilemap
        this.createTilemap();

        // Create player
        this.createPlayer();

        // Create groups
        this.rocks = this.physics.add.staticGroup();
        this.boulders = this.physics.add.group();
        this.gems = this.physics.add.group();
        this.items = this.physics.add.group();
        this.dynamites = this.physics.add.group();
        this.shards = this.physics.add.group();
        this.doors = this.physics.add.staticGroup();

        // Spawn static rocks
        this.spawnStaticRocks();

        // Spawn gem
        this.time.delayedCall(CONFIG.gemSpawnDelay, () => this.spawnGem());

        // Setup collisions
        this.setupCollisions();

        // Setup UI
        this.createUI();

        // Setup input
        this.setupInput();

        // Start boulder spawning
        if (this.levelConfig.dynamicBoulders) {
            this.startBoulderSpawning();
        }

        // Setup escape route
        if (this.levelConfig.escapeRoute) {
            this.spawnKey();
            this.spawnDoor();
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

        // Calculate offset to center the map
        const offsetX = (CONFIG.width - mapCols * CONFIG.tileSize) / 2;
        const offsetY = (CONFIG.height - mapRows * CONFIG.tileSize) / 2;

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

        for (let y = 0; y < mapRows; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < mapCols; x++) {
                let type = 'floor';

                // If we have map data from JSON, use it
                if (mapData && mapData[y] && mapData[y][x]) {
                    type = mapData[y][x];
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

                // Get frame index for this tile type
                const frameIndex = TILE_FRAMES[type] !== undefined ? TILE_FRAMES[type] : TILE_FRAMES.floor;

                // Create sprite from tiles spritesheet
                const tile = this.add.sprite(
                    offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                    offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                    'tiles',
                    frameIndex
                );

                // Scale tile to fit CONFIG.tileSize (64x48 -> 32x32 or keep original)
                // Since tiles are 64x48 and CONFIG.tileSize is 32, we need to scale down
                tile.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);

                this.tiles[y][x] = { type, sprite: tile };
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

        // Use player sprite from objects.png (frame 3)
        this.player = this.physics.add.sprite(centerX, centerY, 'objects', window.OBJECT_FRAMES.player);
        // objects.png frames are 64x64 — scale to tile size so player fits the grid
        this.player.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(CONFIG.tileSize * 0.8, CONFIG.tileSize * 0.8);
    }

    spawnStaticRocks() {
        const numRocks = 10 + GAME_STATE.currentLevel * 2;
        const spawnDelay = Math.max(100, 1000 - GAME_STATE.currentLevel * 30); // Più veloce nei livelli avanzati

        this.rocksToSpawn = numRocks;
        this.rocksSpawned = 0;

        // Spawn progressivo
        this.rockSpawnTimer = this.time.addEvent({
            delay: spawnDelay,
            callback: () => {
                if (this.rocksSpawned < this.rocksToSpawn) {
                    this.spawnSingleRock();
                    this.rocksSpawned++;
                } else {
                    this.rockSpawnTimer.remove();
                }
            },
            callbackScope: this,
            loop: true
        });
    }

    spawnSingleRock() {
        // Posizione casuale evitando i bordi e il centro (dove spawna il player)
        let x, y, attempts = 0, tooClose;
        do {
            x = Phaser.Math.Between(3, this.mapCols - 4);
            y = Phaser.Math.Between(3, this.mapRows - 4);
            attempts++;

            // Evita il centro dove spawna il player
            const centerX = Math.floor(this.mapCols / 2);
            const centerY = Math.floor(this.mapRows / 2);
            tooClose = Math.abs(x - centerX) < 3 && Math.abs(y - centerY) < 3;

        } while (tooClose && attempts < 50);

        const worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;

        // Add a small random pixel jitter so rocks don't always align to the exact same tile centers
        const jitterX = Phaser.Math.Between(-6, 6);
        const jitterY = Phaser.Math.Between(-6, 6);
        const jitteredX = Phaser.Math.Clamp(worldX + jitterX, this.mapOffsetX + CONFIG.tileSize / 2, this.mapOffsetX + (this.mapCols - 1) * CONFIG.tileSize + CONFIG.tileSize / 2);
        const jitteredY = Phaser.Math.Clamp(worldY + jitterY, this.mapOffsetY + CONFIG.tileSize / 2, this.mapOffsetY + (this.mapRows - 1) * CONFIG.tileSize + CONFIG.tileSize / 2);

        // Dimensione casuale basata sulla configurazione del livello
        const rockConfig = this.levelConfig.staticRocks;
        let size = 'medium'; // default

        if (rockConfig === true || !rockConfig.dynamicSize) {
            // Dimensione fissa media
            size = 'medium';
        } else if (rockConfig.dynamicSize) {
            // Dimensione casuale
            const sizes = ['small', 'medium', 'large'];
            size = Phaser.Utils.Array.GetRandom(sizes);
        }

        // Crea la roccia con la texture appropriata
        let texture = 'rock';
        let scale = 1;

        if (size === 'small') {
            texture = 'rock_small';
            scale = 0.7;
        } else if (size === 'large') {
            texture = 'rock_large';
            scale = 1.3;
        }

        const rock = this.rocks.create(jitteredX, jitteredY, 'rock');
        rock.setScale(scale);
        rock.setData('destructible', true);
        rock.setData('size', size);

        // Rotazione casuale
        let shouldRotate = false;
        if (rockConfig.rotation || rockConfig.chaotic) {
            shouldRotate = true;
        }

        if (shouldRotate) {
            const randomAngle = Phaser.Math.Between(0, 360);
            rock.setAngle(randomAngle);
        }

        // Effetto di apparizione con zoom da grosso a piccolo (caduta)
        rock.setScale(scale * 3); // Inizia 3x più grande
        rock.alpha = 0.7; // Leggermente trasparente all'inizio
        this.tweens.add({
            targets: rock,
            scale: scale,
            alpha: 1,
            duration: 400,
            ease: 'Cubic.easeOut', // Effetto di caduta naturale
            onComplete: () => {
                // Aggiorna il corpo fisico dopo lo scaling
                rock.body.setSize(CONFIG.tileSize * scale, CONFIG.tileSize * scale);
                // Piccolo rimbalzo finale
                this.tweens.add({
                    targets: rock,
                    scale: scale * 1.1,
                    duration: 100,
                    yoyo: true,
                    ease: 'Sine.easeInOut'
                });
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
        let x, y, attempts = 0;
        do {
            x = Phaser.Math.Between(2, this.mapCols - 3);
            y = Phaser.Math.Between(2, this.mapRows - 3);
            attempts++;
        } while (this.tiles[y][x].type !== 'floor' && attempts < 100);

        const worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;

        // Use gem sprite from objects.png (frame 6)
        const gem = this.gems.create(worldX, worldY, 'objects', window.OBJECT_FRAMES.gem);
        // Scale gem to tile size (objects.png frames are 64x64)
        gem.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);

        this.tweens.add({
            targets: gem,
            scale: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    spawnKey() {
        const x = Phaser.Math.Between(2, this.mapCols - 3);
        const y = Phaser.Math.Between(2, this.mapRows - 3);

        const worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;

        // Use key sprite from objects.png (frame 8)
        const keySprite = this.items.create(worldX, worldY, 'objects', window.OBJECT_FRAMES.key);
        keySprite.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
        keySprite.setData('type', 'key');
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
        door.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
        door.setData('locked', true);
    }

    setupCollisions() {
        // Player collisions
        this.physics.add.overlap(this.player, this.gems, this.collectGem, null, this);
        this.physics.add.overlap(this.player, this.items, this.collectItem, null, this);
        this.physics.add.collider(this.player, this.rocks);
        this.physics.add.overlap(this.player, this.boulders, this.hitByBoulder, null, this);
        this.physics.add.overlap(this.player, this.shards, this.hitByShard, null, this);

        // Dynamite collisions
        this.physics.add.collider(this.dynamites, this.rocks, this.dynamiteHitRock, null, this);
        this.physics.add.overlap(this.dynamites, this.boulders, this.dynamiteHitBoulder, null, this);

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
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: GAME_FONT
        });

        this.livesText = this.add.text(10, 35, `${t.lives}: ${GAME_STATE.lives}`, {
            fontSize: '20px',
            fill: '#ff0000',
            fontFamily: GAME_FONT
        });

        this.dynamiteText = this.add.text(10, 60, `${t.dynamite}: ${GAME_STATE.dynamiteCount}`, {
            fontSize: '20px',
            fill: '#ffaa00',
            fontFamily: GAME_FONT
        });

        this.levelText = this.add.text(790, 10, `${t.level}: ${GAME_STATE.currentLevel + 1}`, {
            fontSize: '20px',
            fill: '#00ff00',
            fontFamily: GAME_FONT
        }).setOrigin(1, 0);
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

        // Normalize diagonal movement
        if (velocityX !== 0 && velocityY !== 0) {
            velocityX *= 0.707;
            velocityY *= 0.707;
        }

        let speed = CONFIG.playerSpeed;

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

        // Update UI
        this.updateUITexts();
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

        const velocityX = this.player.body.velocity.x;
        const velocityY = this.player.body.velocity.y;

        let dirX = velocityX !== 0 ? Math.sign(velocityX) : 1;
        let dirY = velocityY !== 0 ? Math.sign(velocityY) : 0;

        // Use dynamite projectile sprite from objects.png (frame 0)
        const dynamite = this.dynamites.create(this.player.x, this.player.y, 'objects', window.OBJECT_FRAMES.dynamite_projectile);
        // Scale dynamite to tile size
        dynamite.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
        dynamite.setVelocity(dirX * CONFIG.dynamiteSpeed, dirY * CONFIG.dynamiteSpeed);
        dynamite.setBounce(1, 1);
        dynamite.setCollideWorldBounds(true);

        this.time.delayedCall(CONFIG.dynamiteLifetime, () => {
            if (dynamite.active) {
                this.explodeDynamite(dynamite);
            }
        });
    }

    explodeDynamite(dynamite) {
        // Create explosion effect using explosion sprite from objects.png (frame 15)
        const explosion = this.add.sprite(dynamite.x, dynamite.y, 'objects', window.OBJECT_FRAMES.explosion);
        explosion.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
        this.tweens.add({
            targets: explosion,
            scale: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => explosion.destroy()
        });

        dynamite.destroy();
    }

    dynamiteHitRock(dynamite, rock) {
        if (rock.getData('destructible')) {
            rock.destroy();
            GAME_STATE.score += 10;
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
        GAME_STATE.score += 20;
    }

    getShardCount(size) {
        const config = LEVEL_CONFIG.globalRules.dynamicBoulders.sizes[size];
        if (!config) return 0;
        return Phaser.Math.Between(config.shards[0], config.shards[1]);
    }

    collectGem(player, gem) {
        gem.destroy();
        GAME_STATE.score += 50;

        // Level complete
        this.levelComplete();
    }

    collectItem(player, item) {
        const type = item.getData('type');

        if (type === 'key') {
            GAME_STATE.score += 5;
            // Unlock doors
            this.doors.children.entries.forEach(door => {
                door.setData('locked', false);
                door.setTint(0x00ff00);
            });
        } else if (type === 'dynamite') {
            GAME_STATE.dynamiteCount += 5;
        } else if (type === 'pepita') {
            GAME_STATE.lives++;
        }

        item.destroy();
    }

    hitByBoulder(player, boulder) {
        this.loseLife();
        boulder.destroy();
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
        GAME_STATE.score -= 20;

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
        GAME_STATE.score += 50;
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
        this.livesText.setText(`${t.lives}: ${GAME_STATE.lives}`);
        this.dynamiteText.setText(`${t.dynamite}: ${GAME_STATE.dynamiteCount}`);
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

const game = new Phaser.Game(config);
