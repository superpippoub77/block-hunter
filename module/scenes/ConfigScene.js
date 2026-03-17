/**
 * Crea la classe scena Config per opzioni di gioco e setup runtime.
 * @param {Record<string, any>} deps Dipendenze runtime condivise.
 * @returns {typeof Phaser.Scene} Classe scena Config.
 */
export function createConfigSceneClass(deps) {
    const {
        CONFIG,
        GAME_FONT,
        JSON,
        Math,
        OBJECT_NATIVE_SIZE,
        Phaser,
        resolveConfiguredFrontSceneTarget,
        String,
        TILE_NATIVE_WIDTH,
    } = deps;

    class ConfigScene extends Phaser.Scene {
        /**
         * Inizializza la scena configurazione.
         */
        constructor() {
            super('ConfigScene');
        }
    
        /**
         * Crea interfaccia e controlli della schermata config.
         * @returns {void}
         */
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
                        playerSize: CONFIG.playerSize,
                        helmetRadiusTiles: CONFIG.helmetRadiusTiles
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
                CONFIG.helmetRadiusTiles = 1.6;
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
                ['key', 'sand_pile', 'wooden', 'pepita'],
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
                const next = (typeof resolveConfiguredFrontSceneTarget === 'function')
                    ? resolveConfiguredFrontSceneTarget('ConfigScene', 'onEsc', 'AttractScene')
                    : 'AttractScene';
                this.scene.start(next || 'AttractScene');
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

    return ConfigScene;
}
