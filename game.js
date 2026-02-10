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
        
        // Create graphics for assets
        this.createAssets();
    }

    createAssets() {
        // Tiles are now loaded from sprite sheet (wall, hole, sand, floor, stone, hole2)
        // No need to generate wall, floor, sand, hole textures
        
        const graphics = this.add.graphics();
        
        // Player
        graphics.fillStyle(0xFFFF00, 1);
        graphics.fillRect(0, 0, CONFIG.tileSize, CONFIG.tileSize);
        graphics.generateTexture('player', CONFIG.tileSize, CONFIG.tileSize);
        graphics.clear();
        
        // Gem
        graphics.fillStyle(0x00FFFF, 1);
        graphics.fillCircle(CONFIG.tileSize/2, CONFIG.tileSize/2, CONFIG.tileSize/3);
        graphics.generateTexture('gem', CONFIG.tileSize, CONFIG.tileSize);
        graphics.clear();
        
        // Key
        graphics.fillStyle(0xFFD700, 1);
        graphics.fillCircle(CONFIG.tileSize/2, CONFIG.tileSize/2, CONFIG.tileSize/4);
        graphics.generateTexture('key', CONFIG.tileSize, CONFIG.tileSize);
        graphics.clear();
        
        // Door
        graphics.fillStyle(0x8B4513, 1);
        graphics.fillRect(0, 0, CONFIG.tileSize, CONFIG.tileSize);
        graphics.generateTexture('door', CONFIG.tileSize, CONFIG.tileSize);
        graphics.clear();
        
        // Dynamite item
        graphics.fillStyle(0xFF0000, 1);
        graphics.fillRect(CONFIG.tileSize/4, CONFIG.tileSize/4, CONFIG.tileSize/2, CONFIG.tileSize/2);
        graphics.generateTexture('dynamite_item', CONFIG.tileSize, CONFIG.tileSize);
        graphics.clear();
        
        // Life (pepita)
        graphics.fillStyle(0xFF69B4, 1);
        graphics.fillCircle(CONFIG.tileSize/2, CONFIG.tileSize/2, CONFIG.tileSize/3);
        graphics.generateTexture('pepita', CONFIG.tileSize, CONFIG.tileSize);
        graphics.clear();
        
        // Boulders (dynamic)
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
        
        // Static rocks (diverse dimensioni e forme)
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
        
        // Dynamite projectile
        graphics.fillStyle(0xFF0000, 1);
        graphics.fillRect(0, 0, 8, 8);
        graphics.generateTexture('dynamite', 8, 8);
        graphics.clear();
        
        // Shard
        graphics.fillStyle(0xAAAAAA, 1);
        graphics.fillRect(0, 0, 6, 6);
        graphics.generateTexture('shard', 6, 6);
        graphics.clear();
        
        graphics.destroy();
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
        // If you want to localize the title per language, replace the texture key accordingly.
        this.titleImage = this.add.image(400, 150, 'title').setOrigin(0.5);

        // Blink animation applied to the image
        this.tweens.add({
            targets: this.titleImage,
            alpha: 0.5,
            duration: 800,
            yoyo: true,
            repeat: -1
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
        
        // Any key resets timeout
        this.input.keyboard.on('keydown', () => this.resetTimeout());
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
        
        const difficulties = [
            { name: t.beginner, mult: 0.8, y: 250 },
            { name: t.medium, mult: 1.0, y: 320 },
            { name: t.hard, mult: 1.3, y: 390 }
        ];
        
        difficulties.forEach(diff => {
            const text = this.add.text(400, diff.y, diff.name, {
                fontSize: '32px',
                fill: '#ffffff',
                fontFamily: GAME_FONT
            }).setOrigin(0.5).setInteractive();
            
            text.on('pointerover', () => text.setStyle({ fill: '#00ff00' }));
            text.on('pointerout', () => text.setStyle({ fill: '#ffffff' }));
            text.on('pointerdown', () => {
                GAME_STATE.difficulty = diff.mult;
                this.scene.start('GameScene');
            });
        });
        
        // Keyboard selection
        this.input.keyboard.on('keydown-ONE', () => {
            GAME_STATE.difficulty = 0.8;
            this.scene.start('GameScene');
        });
        this.input.keyboard.on('keydown-TWO', () => {
            GAME_STATE.difficulty = 1.0;
            this.scene.start('GameScene');
        });
        this.input.keyboard.on('keydown-THREE', () => {
            GAME_STATE.difficulty = 1.3;
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
        this.levelConfig = LEVEL_CONFIG.levels[GAME_STATE.currentLevel];
        
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
        const offsetX = (CONFIG.width - CONFIG.gridWidth * CONFIG.tileSize) / 2;
        const offsetY = (CONFIG.height - CONFIG.gridHeight * CONFIG.tileSize) / 2;
        
        // Tile sprite mapping: 0=wall, 1=hole, 2=sand, 3=floor, 4=stone, 5=hole2
        const TILE_FRAMES = {
            wall: 0,
            hole: 1,
            sand: 2,
            floor: 3,
            stone: 4,
            hole2: 5
        };
        
        for (let y = 0; y < CONFIG.gridHeight; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < CONFIG.gridWidth; x++) {
                let type = 'floor';
                
                // Border walls
                if (x === 0 || x === CONFIG.gridWidth - 1 || y === 0 || y === CONFIG.gridHeight - 1) {
                    type = 'wall';
                }
                
                // Random sand patches
                if (type === 'floor' && Math.random() < 0.1) {
                    type = 'sand';
                }
                
                // Random holes
                if (type === 'floor' && Math.random() < 0.05) {
                    type = 'hole';
                }
                
                // Create sprite from tiles spritesheet
                const tile = this.add.sprite(
                    offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                    offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                    'tiles',
                    TILE_FRAMES[type]
                );
                
                // Scale tile to fit CONFIG.tileSize (64x48 -> 32x32 or keep original)
                // Since tiles are 64x48 and CONFIG.tileSize is 32, we need to scale down
                tile.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
                
                this.tiles[y][x] = { type, sprite: tile };
            }
        }
    }

    createPlayer() {
        const centerX = CONFIG.width / 2;
        const centerY = CONFIG.height / 2;
        
        this.player = this.physics.add.sprite(centerX, centerY, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.body.setSize(CONFIG.tileSize * 0.8, CONFIG.tileSize * 0.8);
    }

    spawnStaticRocks() {
        const offsetX = (CONFIG.width - CONFIG.gridWidth * CONFIG.tileSize) / 2;
        const offsetY = (CONFIG.height - CONFIG.gridHeight * CONFIG.tileSize) / 2;
        
        const numRocks = 10 + GAME_STATE.currentLevel * 2;
        const spawnDelay = Math.max(100, 1000 - GAME_STATE.currentLevel * 30); // Più veloce nei livelli avanzati
        
        this.rocksToSpawn = numRocks;
        this.rocksSpawned = 0;
        
        // Spawn progressivo
        this.rockSpawnTimer = this.time.addEvent({
            delay: spawnDelay,
            callback: () => {
                if (this.rocksSpawned < this.rocksToSpawn) {
                    this.spawnSingleRock(offsetX, offsetY);
                    this.rocksSpawned++;
                } else {
                    this.rockSpawnTimer.remove();
                }
            },
            callbackScope: this,
            loop: true
        });
    }
    
    spawnSingleRock(offsetX, offsetY) {
        // Posizione casuale evitando i bordi e il centro (dove spawna il player)
        let x, y, attempts = 0;
        do {
            x = Phaser.Math.Between(3, CONFIG.gridWidth - 4);
            y = Phaser.Math.Between(3, CONFIG.gridHeight - 4);
            attempts++;
            
            // Evita il centro dove spawna il player
            const centerX = Math.floor(CONFIG.gridWidth / 2);
            const centerY = Math.floor(CONFIG.gridHeight / 2);
            const tooClose = Math.abs(x - centerX) < 3 && Math.abs(y - centerY) < 3;
            
        } while (tooClose && attempts < 50);
        
        const worldX = offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;
        
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
        
        const rock = this.rocks.create(worldX, worldY, 'rock');
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
        
        // Effetto di apparizione con scala
        rock.setScale(0);
        this.tweens.add({
            targets: rock,
            scale: scale,
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
                // Aggiorna il corpo fisico dopo lo scaling
                rock.body.setSize(CONFIG.tileSize * scale, CONFIG.tileSize * scale);
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
        const offsetX = (CONFIG.width - CONFIG.gridWidth * CONFIG.tileSize) / 2;
        const offsetY = (CONFIG.height - CONFIG.gridHeight * CONFIG.tileSize) / 2;
        
        let x, y, attempts = 0;
        do {
            x = Phaser.Math.Between(2, CONFIG.gridWidth - 3);
            y = Phaser.Math.Between(2, CONFIG.gridHeight - 3);
            attempts++;
        } while (this.tiles[y][x].type !== 'floor' && attempts < 100);
        
        const worldX = offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;
        
        const gem = this.gems.create(worldX, worldY, 'gem');
        
        this.tweens.add({
            targets: gem,
            scale: 1.2,
            duration: 500,
            yoyo: true,
            repeat: -1
        });
    }

    spawnKey() {
        const offsetX = (CONFIG.width - CONFIG.gridWidth * CONFIG.tileSize) / 2;
        const offsetY = (CONFIG.height - CONFIG.gridHeight * CONFIG.tileSize) / 2;
        
        const x = Phaser.Math.Between(2, CONFIG.gridWidth - 3);
        const y = Phaser.Math.Between(2, CONFIG.gridHeight - 3);
        
        const worldX = offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;
        
        this.items.create(worldX, worldY, 'key').setData('type', 'key');
    }

    spawnDoor() {
        const offsetX = (CONFIG.width - CONFIG.gridWidth * CONFIG.tileSize) / 2;
        const offsetY = (CONFIG.height - CONFIG.gridHeight * CONFIG.tileSize) / 2;
        
        const side = Phaser.Math.Between(0, 3);
        let x, y;
        
        if (side === 0) { x = CONFIG.gridWidth - 1; y = Math.floor(CONFIG.gridHeight / 2); }
        else if (side === 1) { x = 0; y = Math.floor(CONFIG.gridHeight / 2); }
        else if (side === 2) { x = Math.floor(CONFIG.gridWidth / 2); y = CONFIG.gridHeight - 1; }
        else { x = Math.floor(CONFIG.gridWidth / 2); y = 0; }
        
        const worldX = offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;
        
        const door = this.doors.create(worldX, worldY, 'door');
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
        const offsetX = (CONFIG.width - CONFIG.gridWidth * CONFIG.tileSize) / 2;
        const offsetY = (CONFIG.height - CONFIG.gridHeight * CONFIG.tileSize) / 2;
        
        const gridX = Math.floor((x - offsetX) / CONFIG.tileSize);
        const gridY = Math.floor((y - offsetY) / CONFIG.tileSize);
        
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
        
        const dynamite = this.dynamites.create(this.player.x, this.player.y, 'dynamite');
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
        // Create explosion effect
        const explosion = this.add.circle(dynamite.x, dynamite.y, 40, 0xFF6600, 0.7);
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
        
        const offsetX = (CONFIG.width - CONFIG.gridWidth * CONFIG.tileSize) / 2;
        const offsetY = (CONFIG.height - CONFIG.gridHeight * CONFIG.tileSize) / 2;
        
        if (direction === 'top') {
            x = offsetX + Phaser.Math.Between(1, CONFIG.gridWidth - 2) * CONFIG.tileSize;
            y = offsetY;
            vx = Phaser.Math.Between(-50, 50);
            vy = CONFIG.boulderBaseSpeed * this.levelConfig.speed * GAME_STATE.difficulty;
        } else if (direction === 'bottom') {
            x = offsetX + Phaser.Math.Between(1, CONFIG.gridWidth - 2) * CONFIG.tileSize;
            y = offsetY + CONFIG.gridHeight * CONFIG.tileSize;
            vx = Phaser.Math.Between(-50, 50);
            vy = -CONFIG.boulderBaseSpeed * this.levelConfig.speed * GAME_STATE.difficulty;
        } else if (direction === 'left') {
            x = offsetX;
            y = offsetY + Phaser.Math.Between(1, CONFIG.gridHeight - 2) * CONFIG.tileSize;
            vx = CONFIG.boulderBaseSpeed * this.levelConfig.speed * GAME_STATE.difficulty;
            vy = Phaser.Math.Between(-50, 50);
        } else {
            x = offsetX + CONFIG.gridWidth * CONFIG.tileSize;
            y = offsetY + Phaser.Math.Between(1, CONFIG.gridHeight - 2) * CONFIG.tileSize;
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
    scene: [BootScene, PreloadScene, AttractScene, TopTenScene, LevelSelectScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);
