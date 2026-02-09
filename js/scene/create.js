
import * as Lang from '../components/lang.js';
import { createFlagCarousel } from '../components/carousel.js';
import { typeWriter, fallLetters } from '../utility/helper.js';

export function create(scene) {
    try {
        // mirror previous behavior: use explicit scene argument instead of `this`
        scene.cameras.main.setBackgroundColor('#0a0e27');

        // compute sprite cell sizes (if spriteSheet loaded)
        try {
            const st = scene.textures.get('spriteSheet');
            if (st && st.source && st.source[0]) {
                const img = st.source[0].image || st.source[0].data;
                if (img && img.width && img.height) {
                    window.spriteCellW = img.width / (window.SHEET_COLS || 4);
                    window.spriteCellH = img.height / (window.SHEET_ROWS || 4);
                    window.spriteSheetPad = Math.max(0, Math.round(Math.min(window.spriteCellW, window.spriteCellH) * 0.03));
                }
            }
        } catch (e) { /* ignore */ }

        // Create Phaser animations for the player spritesheet (if not already created)
        try {
            const anims = scene.anims;
            if (!anims.exists('p_idle_down')) anims.create({ key: 'p_idle_down', frames: [{ key: 'player', frame: 0 }], frameRate: 1, repeat: -1 });
            if (!anims.exists('p_idle_right')) anims.create({ key: 'p_idle_right', frames: [{ key: 'player', frame: 1 }], frameRate: 1, repeat: -1 });
            if (!anims.exists('p_idle_up')) anims.create({ key: 'p_idle_up', frames: [{ key: 'player', frame: 2 }], frameRate: 1, repeat: -1 });

            if (!anims.exists('p_run_down')) anims.create({ key: 'p_run_down', frames: [{ key: 'player', frame: 0 }, { key: 'player', frame: 3 }], frameRate: 10, repeat: -1 });
            if (!anims.exists('p_run_right')) anims.create({ key: 'p_run_right', frames: [{ key: 'player', frame: 1 }, { key: 'player', frame: 3 }], frameRate: 10, repeat: -1 });
            if (!anims.exists('p_run_up')) anims.create({ key: 'p_run_up', frames: [{ key: 'player', frame: 2 }, { key: 'player', frame: 3 }], frameRate: 10, repeat: -1 });
            if (!anims.exists('p_run_left')) anims.create({ key: 'p_run_left', frames: [{ key: 'player', frame: 1 }, { key: 'player', frame: 3 }], frameRate: 10, repeat: -1 });
            if (!anims.exists('p_idle_left')) anims.create({ key: 'p_idle_left', frames: [{ key: 'player', frame: 1 }], frameRate: 1, repeat: -1 });
        } catch (e) { /* ignore animation creation errors */ }

        // If the game isn't started, show attract UI
        if (!window.gameStarted) {
            try { window.initAttractUI && window.initAttractUI(scene); } catch (e) { /* ignore */ }
            try { window.showAttractUI && window.showAttractUI(scene); } catch (e) { /* ignore */ }
            return;
        }

        // Player (primary)
        try {
            window.player = scene.physics.add.sprite(300, 550, 'player');
            const displaySize = 20;
            window.player.setDisplaySize(displaySize, displaySize);
            window.player.body.setCollideWorldBounds(true);
            try { window.player.anims.play('p_idle_down'); window.player.setFlipX(false); } catch (e) { }
        } catch (e) {
            window.player = scene.add.rectangle(300, 550, 20, 20, 0x00ff00);
            scene.physics.add.existing(window.player);
            window.player.body.setCollideWorldBounds(true);
        }

        // Optionally create a second player when playersCount >= 2
        if ((window.playersCount || 1) >= 2) {
            try {
                window.player2 = scene.physics.add.sprite(500, 550, 'player');
                const displaySize2 = 20;
                window.player2.setDisplaySize(displaySize2, displaySize2);
                window.player2.body.setCollideWorldBounds(true);
                try { window.player2.anims.play('p_idle_down'); window.player2.setFlipX(false); } catch (e) { }
            } catch (e) {
                window.player2 = scene.add.rectangle(500, 550, 20, 20, 0x0000ff);
                scene.physics.add.existing(window.player2);
                window.player2.body.setCollideWorldBounds(true);
            }

            try {
                window.wasdKeys = scene.input.keyboard.addKeys({
                    up: Phaser.Input.Keyboard.KeyCodes.W,
                    left: Phaser.Input.Keyboard.KeyCodes.A,
                    down: Phaser.Input.Keyboard.KeyCodes.S,
                    right: Phaser.Input.Keyboard.KeyCodes.D,
                    shoot: Phaser.Input.Keyboard.KeyCodes.F
                });
            } catch (e) {
                const raw = scene.input.keyboard.addKeys('W,A,S,D,F');
                window.wasdKeys = {
                    up: raw.W || raw.w,
                    left: raw.A || raw.a,
                    down: raw.S || raw.s,
                    right: raw.D || raw.d,
                    shoot: raw.F || raw.f
                };
            }
        }

        // Target
        try {
            window.target = scene.physics.add.image(0, 0, 'spriteSheet');
            const tSize = 15;
            if ((window.applySpriteCrop && window.applySpriteCrop(scene, window.target, 'target')) || false) {
                window.target.setDisplaySize(tSize, tSize);
            } else {
                window.target.setDisplaySize(tSize, tSize);
                try { window.target.setTint(0xffff00); } catch (e) { }
            }
            try { window.spawnTarget && window.spawnTarget(scene); } catch (e) { }
        } catch (e) {
            window.target = scene.add.rectangle(0, 0, 15, 15, 0xffff00);
            scene.physics.add.existing(window.target);
            try { window.spawnTarget && window.spawnTarget(scene); } catch (e) { }
        }

        // Groups
        window.blocks = scene.physics.add.group();
        window.bullets = scene.physics.add.group();
        window.particles = scene.add.particles(0, 0);

        // Input
        window.cursors = scene.input.keyboard.createCursorKeys();
        window.spaceKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        // HUD
        window.scoreText1 = scene.add.text(16, 16, 'P1: 0', { fontSize: '14px', fontFamily: window.GAME_FONT, fill: '#00ffff' }).setDepth(100);
        window.livesText1 = scene.add.text(16, 36, 'LIVES: ' + (window.lives1 || 3), { fontSize: '12px', fontFamily: window.GAME_FONT, fill: '#00ffff' }).setDepth(100);
        window.scoreText2 = scene.add.text(scene.scale.width - 16, 16, 'P2: 0', { fontSize: '14px', fontFamily: window.GAME_FONT, fill: '#00ffff' }).setOrigin(1, 0).setDepth(100);
        window.livesText2 = scene.add.text(scene.scale.width - 16, 36, 'LIVES: ' + (window.lives2 || 3), { fontSize: '12px', fontFamily: window.GAME_FONT, fill: '#00ffff' }).setOrigin(1, 0).setDepth(100);
        window.levelText = scene.add.text(scene.scale.width / 2, 16, 'LEVEL: ' + (window.level || 1), { fontSize: '14px', fontFamily: window.GAME_FONT, fill: '#00ffff' }).setOrigin(0.5, 0).setDepth(100);

        // Collisions
        try { scene.physics.add.overlap(window.player, window.target, window.collectTarget, null, scene); } catch (e) { }
        try { scene.physics.add.overlap(window.player, window.blocks, window.hitBlock, null, scene); } catch (e) { }
        if (window.player2) {
            try { scene.physics.add.overlap(window.player2, window.target, window.collectTarget, null, scene); } catch (e) { }
            try { scene.physics.add.overlap(window.player2, window.blocks, window.hitBlock, null, scene); } catch (e) { }
        }
        try { scene.physics.add.overlap(window.bullets, window.blocks, window.destroyBlock, null, scene); } catch (e) { }

        try { window.applyTranslations && window.applyTranslations(); } catch (e) { }
    } catch (e) {
        console.warn('[scene.create] error', e);
    }
}
