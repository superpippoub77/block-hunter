// Player: creazione, comandi, salto, vite, casco, carrello, aiutante.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createPlayerMixin(deps) {
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

return class PlayerMixin {

    createPlayer() {
        if (this.nameText) this.nameText.setText(this._formatNameDisplay());
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
        // Ensure player is rendered above decorative fog blobs
        try { this.player.setDepth(2000); } catch (e) { }
        // Configure body size based on the sprite's actual display size
        if (this.player.body) {
            const w = this.player.displayWidth || this.player.width;
            const h = this.player.displayHeight || this.player.height;
            // Use a circular body centered on the sprite so contact feels like it's at the object's center.
            // Radius chosen smaller than sprite to avoid overly generous collisions.
            try {
                    const specPlayer = resolveContactSpec('player');
                    let radius;
                    if (specPlayer && typeof specPlayer.radiusPixels === 'number') {
                        radius = Math.floor(specPlayer.radiusPixels);
                    } else {
                        const playerMultiplier = (specPlayer && specPlayer.radiusMultiplier) ? specPlayer.radiusMultiplier : 0.35;
                        radius = Math.floor(Math.min(w, h) * playerMultiplier);
                    }
                    this.player.body.setCircle(radius);
                    // center the circle inside the display sprite
                    const offsetX = Math.floor((w / 2) - radius);
                    const offsetY = Math.floor((h / 2) - radius);
                    this.player.body.setOffset(offsetX, offsetY);
            } catch (e) {
                // Fallback to rectangular body if setCircle isn't available
                this.player.body.setSize(Math.floor(w * 0.7), Math.floor(h * 0.7));
                this.player.body.setOffset(Math.floor(w * 0.15), Math.floor(h * 0.15));
            }
        }

        // Create a small '1P' label that follows player1 in 2-player mode
        try {
            if (Number(GAME_STATE.players) === 2) {
                const labelY = py - (this.player.displayHeight || playerDisplaySize) / 2 - 6;
                this.playerLabel = this.add.text(px - 10, labelY, '1P', {
                    fontSize: '12px',
                    fill: '#ffff00',
                    fontFamily: GAME_FONT
                }).setOrigin(0.5, 1);
                // add a visible black stroke for legibility
                try { this.playerLabel.setStroke('#000000', 3); } catch (e) { }
                // Put label above most game elements so it's always readable
                this.playerLabel.setDepth(2500);
                // tint player sprite to a reference color (yellow) for quick identification
                try { this.player.setTint(0xffff00); } catch (e) { }
            }
        } catch (e) { /* ignore label creation errors */ }

        // If two-player mode, create player2 as well
        try {
            if (Number(GAME_STATE.players) === 2) {
                // try to use a separate playerStart2 if provided in levelData
                let px2 = px + (CONFIG.tileSize || 64);
                let py2 = py;
                if (this.levelData && this.levelData.playerStart2) {
                    const ps2 = this.levelData.playerStart2;
                    if (typeof ps2.x === 'number' && typeof ps2.y === 'number') {
                        px2 = ps2.x;
                        py2 = ps2.y;
                    } else if (typeof ps2.row === 'number' && typeof ps2.col === 'number') {
                        px2 = this.mapOffsetX + ps2.col * CONFIG.tileSize + CONFIG.tileSize / 2;
                        py2 = this.mapOffsetY + ps2.row * CONFIG.tileSize + CONFIG.tileSize / 2;
                    }
                }

                this.player2 = this.physics.add.sprite(px2, py2, 'player_front', 0);
                const playerDisplaySize = Number(CONFIG.playerSize) || Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE;
                this.player2.setDisplaySize(playerDisplaySize, playerDisplaySize);
                this.player2Facing = 'front';
                this.player2VerticalFacing = 'front';
                this.player2.setFlipX(false);
                this.player2.setCollideWorldBounds(true);
                // Ensure player2 is rendered above decorative fog blobs
                try { this.player2.setDepth(2000); } catch (e) { }
                if (this.player2.body) {
                    const w2 = this.player2.displayWidth || this.player2.width;
                    const h2 = this.player2.displayHeight || this.player2.height;
                    try {
                        const specPlayer2 = resolveContactSpec('player');
                        let radius2;
                        if (specPlayer2 && typeof specPlayer2.radiusPixels === 'number') {
                            radius2 = Math.floor(specPlayer2.radiusPixels);
                        } else {
                            const playerMultiplier2 = (specPlayer2 && specPlayer2.radiusMultiplier) ? specPlayer2.radiusMultiplier : 0.35;
                            radius2 = Math.floor(Math.min(w2, h2) * playerMultiplier2);
                        }
                        this.player2.body.setCircle(radius2);
                        const offsetX2 = Math.floor((w2 / 2) - radius2);
                        const offsetY2 = Math.floor((h2 / 2) - radius2);
                        this.player2.body.setOffset(offsetX2, offsetY2);
                    } catch (e) {
                        this.player2.body.setSize(Math.floor(w2 * 0.7), Math.floor(h2 * 0.7));
                        this.player2.body.setOffset(Math.floor(w2 * 0.15), Math.floor(h2 * 0.15));
                    }
                }
                // Create a small '2P' label that follows player2
                try {
                    const labelY2 = py2 - (this.player2.displayHeight || playerDisplaySize) / 2 - 6;
                    this.player2Label = this.add.text(px2 + 10, labelY2, '2P', {
                        fontSize: '12px',
                        fill: '#ff0000',
                        fontFamily: GAME_FONT
                    }).setOrigin(0.5, 1);
                    try { this.player2Label.setStroke('#000000', 3); } catch (e) { }
                    this.player2Label.setDepth(2500);
                    // tint player2 sprite to a reference color (red)
                    try { this.player2.setTint(0xff0000); } catch (e) { }
                } catch (e) { /* ignore */ }
            }
        } catch (e) { }
    }

    setupInput() {
        this.cursors = this.input.keyboard.createCursorKeys();
        // Build input mapping from CONFIG.controlPanel when available (falls back to defaults)
        const panel = (window.CONFIG && window.CONFIG.controlPanel) ? window.CONFIG.controlPanel : (window.CONTROL_PANEL || {});
        // Player2 keys
        const p2cfg = panel.player2 || {};
        const p2move = p2cfg.move || { left: 'A', right: 'D', up: 'W', down: 'S' };
        const p2shoot = Array.isArray(p2cfg.shoot) ? p2cfg.shoot : (p2cfg.shoot ? p2cfg.shoot : ['M','N']);
        const p2jump = Array.isArray(p2cfg.jump) ? p2cfg.jump : (p2cfg.jump ? p2cfg.jump : ['H']);
        this.p2Keys = this.input.keyboard.addKeys({
            w: Phaser.Input.Keyboard.KeyCodes[p2move.up] || Phaser.Input.Keyboard.KeyCodes.W,
            a: Phaser.Input.Keyboard.KeyCodes[p2move.left] || Phaser.Input.Keyboard.KeyCodes.A,
            s: Phaser.Input.Keyboard.KeyCodes[p2move.down] || Phaser.Input.Keyboard.KeyCodes.S,
            d: Phaser.Input.Keyboard.KeyCodes[p2move.right] || Phaser.Input.Keyboard.KeyCodes.D,
            f: Phaser.Input.Keyboard.KeyCodes.F,
            m: Phaser.Input.Keyboard.KeyCodes[p2shoot[0]] || Phaser.Input.Keyboard.KeyCodes.M,
            n: p2shoot[1] ? (Phaser.Input.Keyboard.KeyCodes[p2shoot[1]] || Phaser.Input.Keyboard.KeyCodes.N) : Phaser.Input.Keyboard.KeyCodes.N
        });

        // Shared action keys / misc for Player1 - use configured values when present
        const p1cfg = panel.player1 || {};
        const p1shoot = Array.isArray(p1cfg.shoot) ? p1cfg.shoot : (p1cfg.shoot ? p1cfg.shoot : ['X','SPACE']);
        const p1action = Array.isArray(p1cfg.action) ? p1cfg.action : (p1cfg.action ? p1cfg.action : ['Z']);
        const p1jump = Array.isArray(p1cfg.jump) ? p1cfg.jump : (p1cfg.jump ? p1cfg.jump : ['C']);
        this.keys = this.input.keyboard.addKeys({
            space: Phaser.Input.Keyboard.KeyCodes[p1shoot.includes('SPACE') ? 'SPACE' : 'SPACE'] || Phaser.Input.Keyboard.KeyCodes.SPACE,
            x: Phaser.Input.Keyboard.KeyCodes[p1shoot[0]] || Phaser.Input.Keyboard.KeyCodes.X,
            z: Phaser.Input.Keyboard.KeyCodes[p1action[0]] || Phaser.Input.Keyboard.KeyCodes.Z,
            c: Phaser.Input.Keyboard.KeyCodes[p1jump[0]] || Phaser.Input.Keyboard.KeyCodes.C,
            f: Phaser.Input.Keyboard.KeyCodes.F
        });

        // Build arrays of action keys based on config for both players
        const toKeyCode = (name) => {
            try {
                const n = String(name || '').toUpperCase();
                if (!n) return null;
                if (Phaser.Input.Keyboard.KeyCodes[n] !== undefined) return Phaser.Input.Keyboard.KeyCodes[n];
                return Phaser.Input.Keyboard.KeyCodes[n];
            } catch (e) { return null; }
        };

        try {
            const p1ActionNames = Array.isArray(p1action) ? p1action : (p1action ? [p1action] : ['Z']);
            this.p1ActionKeys = p1ActionNames.map((nm) => {
                const kc = toKeyCode(nm) || Phaser.Input.Keyboard.KeyCodes.Z;
                return this.input.keyboard.addKey(kc);
            });
        } catch (e) { this.p1ActionKeys = []; }

        try {
            const p2action = Array.isArray(p2cfg.action) ? p2cfg.action : (p2cfg.action ? p2cfg.action : ['M','N']);
            const p2ActionNames = Array.isArray(p2action) ? p2action : [p2action];
            this.p2ActionKeys = p2ActionNames.map((nm) => {
                const kc = toKeyCode(nm) || Phaser.Input.Keyboard.KeyCodes.F;
                return this.input.keyboard.addKey(kc);
            });
        } catch (e) { this.p2ActionKeys = []; }

        try {
            const p1JumpNames = Array.isArray(p1jump) ? p1jump : [p1jump];
            this.p1JumpKeys = p1JumpNames.map((nm) => {
                const kc = toKeyCode(nm) || Phaser.Input.Keyboard.KeyCodes.C;
                return this.input.keyboard.addKey(kc);
            });
        } catch (e) { this.p1JumpKeys = []; }

        try {
            const p2JumpNames = Array.isArray(p2jump) ? p2jump : [p2jump];
            this.p2JumpKeys = p2JumpNames.map((nm) => {
                const kc = toKeyCode(nm) || Phaser.Input.Keyboard.KeyCodes.H;
                return this.input.keyboard.addKey(kc);
            });
        } catch (e) { this.p2JumpKeys = []; }

        this.lastDynamiteTime = 0;
        this.lastStepSoundTime = 0;
    }

    isJumpingPlayer(player) {
        try {
            return !!(player && player.getData && player.getData('isJumping'));
        } catch (e) {
            return false;
        }
    }

    getJumpDirectionFor(player, inputX = 0, inputY = 0) {
        const ix = Number(inputX) || 0;
        const iy = Number(inputY) || 0;
        if (Math.abs(ix) > 0 || Math.abs(iy) > 0) {
            if (Math.abs(ix) >= Math.abs(iy)) return { x: Math.sign(ix), y: 0 };
            return { x: 0, y: Math.sign(iy) };
        }

        const isPlayer2 = player === this.player2;
        const lastMoveDir = isPlayer2 ? this.lastMoveDirP2 : this.lastMoveDir;
        if (lastMoveDir && (Math.abs(Number(lastMoveDir.x) || 0) > 0 || Math.abs(Number(lastMoveDir.y) || 0) > 0)) {
            if (Math.abs(Number(lastMoveDir.x) || 0) >= Math.abs(Number(lastMoveDir.y) || 0)) {
                return { x: Math.sign(Number(lastMoveDir.x) || 0), y: 0 };
            }
            return { x: 0, y: Math.sign(Number(lastMoveDir.y) || 0) };
        }

        const facing = isPlayer2 ? (this.player2Facing || 'front') : (this.playerFacing || 'front');
        if (facing === 'left' || facing === 'back_left') return { x: -1, y: 0 };
        if (facing === 'right' || facing === 'back_right') return { x: 1, y: 0 };
        if (facing === 'back') return { x: 0, y: -1 };
        return { x: 0, y: 1 };
    }

    isJumpBlockedTile(tile) {
        if (!tile) return true;
        const type = String(tile.type || '').toLowerCase();
        return type === 'wall' || type === 'door';
    }

    hasBlockingJumpOccupantAt(gridX, gridY) {
        const hasOccupantInGroup = (group) => {
            const entries = group?.children?.entries || [];
            return entries.some((entry) => {
                if (!entry || !entry.active) return false;
                const objGridX = Math.floor(((entry.x || 0) - (this.mapOffsetX || 0)) / CONFIG.tileSize);
                const objGridY = Math.floor(((entry.y || 0) - (this.mapOffsetY || 0)) / CONFIG.tileSize);
                return objGridX === gridX && objGridY === gridY;
            });
        };

        return hasOccupantInGroup(this.rocks) || hasOccupantInGroup(this.boulders);
    }

    attemptJumpFor(player, options = {}) {
        try {
            if (this.jumpEnabled === false) return false;
            if (!player || !player.active || !player.body) return false;
            if (this.isJumpingPlayer(player)) return false;
            if (player.body.enable === false) return false;

            const now = Number(this.time?.now) || 0;
            const nextJumpAt = Number(player.getData && player.getData('nextJumpAt')) || 0;
            if (now < nextJumpAt) return false;

            const direction = this.getJumpDirectionFor(player, options.inputX, options.inputY);
            if (!direction || (!direction.x && !direction.y)) return false;

            const startGridX = Math.floor((player.x - (this.mapOffsetX || 0)) / CONFIG.tileSize);
            const startGridY = Math.floor((player.y - (this.mapOffsetY || 0)) / CONFIG.tileSize);
            const jumpCfg = CONFIG.jump || {};
            const jumpDistanceTiles = Math.max(2, Number(jumpCfg.distanceTiles ?? CONFIG.jumpDistanceTiles) || 2);
            const midGridX = startGridX + direction.x;
            const midGridY = startGridY + direction.y;
            const landGridX = startGridX + direction.x * jumpDistanceTiles;
            const landGridY = startGridY + direction.y * jumpDistanceTiles;

            const midTile = this.tiles?.[midGridY]?.[midGridX] || null;
            const landingTile = this.tiles?.[landGridY]?.[landGridX] || null;
            if (this.isJumpBlockedTile(midTile) || this.isJumpBlockedTile(landingTile)) return false;
            if (this.hasBlockingJumpOccupantAt(landGridX, landGridY)) return false;

            const landX = this.mapOffsetX + landGridX * CONFIG.tileSize + CONFIG.tileSize / 2;
            const landY = this.mapOffsetY + landGridY * CONFIG.tileSize + CONFIG.tileSize / 2;
            const startX = Number(player.x) || landX;
            const startY = Number(player.y) || landY;
            const jumpDuration = Math.max(120, Number(jumpCfg.duration ?? CONFIG.jumpDuration) || 220);
            const jumpCooldown = Math.max(jumpDuration, Number(jumpCfg.cooldown ?? CONFIG.jumpCooldown) || 450);
            const jumpArcHeight = Math.max(10, Number(jumpCfg.arcHeight ?? CONFIG.jumpArcHeight) || Math.floor(CONFIG.tileSize * 0.85));
            const baseScaleX = Number(player.scaleX) || 1;
            const baseScaleY = Number(player.scaleY) || 1;

            try { player.body.setVelocity(0, 0); } catch (e) { }
            try { player.body.setEnable(false); } catch (e) { }
            try { player.setData('isJumping', true); } catch (e) { }
            try { player.setData('nextJumpAt', now + jumpCooldown); } catch (e) { }
            try { if (player.anims && player.anims.isPlaying) player.anims.stop(); } catch (e) { }

            const jumpProgress = { t: 0 };
            this.tweens.add({
                targets: jumpProgress,
                t: 1,
                duration: jumpDuration,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    const t = Phaser.Math.Clamp(Number(jumpProgress.t) || 0, 0, 1);
                    const travelX = Phaser.Math.Linear(startX, landX, t);
                    const travelY = Phaser.Math.Linear(startY, landY, t);
                    const hopOffset = jumpArcHeight * 4 * t * (1 - t);
                    try { player.setPosition(travelX, travelY - hopOffset); } catch (e) { }
                },
                onComplete: () => {
                    try { player.setPosition(landX, landY); } catch (e) { }
                    try { player.setScale(baseScaleX, baseScaleY); } catch (e) { }
                    try { player.setData('isJumping', false); } catch (e) { }
                    try { player.body.setEnable(true); } catch (e) { }
                    try { if (this.createDustPuff) this.createDustPuff(landX, landY, 0.75); } catch (e) { }
                }
            });

            this.tweens.add({
                targets: player,
                scaleX: baseScaleX * 1.12,
                scaleY: baseScaleY * 1.12,
                duration: Math.floor(jumpDuration / 2),
                yoyo: true,
                ease: 'Sine.easeOut'
            });

            return true;
        } catch (e) {
            return false;
        }
    }

    respawnPlayer(player) {
        try {
            const pl = player || this.player;
            if (!pl) return;
            // find level playerStart if available
            let px = CONFIG.width / 2;
            let py = CONFIG.height / 2;
            if (this.levelData && this.levelData.playerStart) {
                const ps = this.levelData.playerStart;
                if (typeof ps.x === 'number' && typeof ps.y === 'number') {
                    px = ps.x;
                    py = ps.y;
                } else if (typeof ps.row === 'number' && typeof ps.col === 'number') {
                    px = this.mapOffsetX + ps.col * CONFIG.tileSize + CONFIG.tileSize / 2;
                    py = this.mapOffsetY + ps.row * CONFIG.tileSize + CONFIG.tileSize / 2;
                }
            }
            pl.setActive(true);
            pl.setVisible(true);
            try { pl.body && pl.body.setVelocity(0, 0); } catch (e) { }
            pl.setPosition(px, py);
            // short invulnerability effect
            this.invulnerable = true;
            this.tweens.add({
                targets: pl,
                alpha: 0.3,
                duration: 100,
                yoyo: true,
                repeat: 10,
                onComplete: () => {
                    this.invulnerable = false;
                    pl.alpha = 1;
                }
            });
        } catch (e) { }
    }

    loseLife(options = {}) {
        if (this.cartPowerActive) return;
        if (this.invulnerable) return;
        const skipScorePenalty = !!options.skipScorePenalty;
        const reason = options.reason || '';
        const popupX = options.popupX;
        const popupY = options.popupY;
        const player = options.player;
        const forAll = !!options.forAll;

        // decrement appropriate lives counter
        if (forAll && Number(GAME_STATE.players) === 2) {
            GAME_STATE.livesP1 = Math.max(0, (Number(GAME_STATE.livesP1) || 0) - 1);
            GAME_STATE.livesP2 = Math.max(0, (Number(GAME_STATE.livesP2) || 0) - 1);
        } else if (player) {
            if (Number(GAME_STATE.players) === 2) {
                if (player === this.player) GAME_STATE.livesP1 = Math.max(0, (Number(GAME_STATE.livesP1) || 0) - 1);
                else if (player === this.player2) GAME_STATE.livesP2 = Math.max(0, (Number(GAME_STATE.livesP2) || 0) - 1);
                else GAME_STATE.lives = Math.max(0, (Number(GAME_STATE.lives) || 0) - 1);
            } else {
                GAME_STATE.lives = Math.max(0, (Number(GAME_STATE.lives) || 0) - 1);
            }
        } else {
            GAME_STATE.lives = Math.max(0, (Number(GAME_STATE.lives) || 0) - 1);
        }

        if (!skipScorePenalty) {
            const sx = (player && player.x) ? player.x : this.player?.x;
            const sy = (player && player.y) ? player.y : this.player?.y;
            this.addScore(-20, sx, sy, true);
        }

        if (reason === 'score_underflow') {
            this.showLifeLossPopup(popupX, popupY);
        }

        // Decide game over or respawn based on single/multi player state
        if (Number(GAME_STATE.players) === 2) {
            const p1 = Number(GAME_STATE.livesP1) || 0;
            const p2 = Number(GAME_STATE.livesP2) || 0;
            if (p1 <= 0 && p2 <= 0) {
                this.gameOver();
                return;
            }
            // if the affected player still has lives, respawn that player; otherwise disable their sprite
            if (player === this.player) {
                if ((Number(GAME_STATE.livesP1) || 0) > 0) this.respawnPlayer(this.player);
                else try { this.player.setActive(false).setVisible(false); } catch (e) { }
            } else if (player === this.player2) {
                if ((Number(GAME_STATE.livesP2) || 0) > 0) this.respawnPlayer(this.player2);
                else try { this.player2.setActive(false).setVisible(false); } catch (e) { }
            } else {
                // generic fallback: respawn main player if any lives remain
                if ((Number(GAME_STATE.livesP1) || 0) > 0) this.respawnPlayer(this.player);
            }
            this.refreshHudIcons && this.refreshHudIcons();
            return;
        }

        // Single-player fallback
        if ((Number(GAME_STATE.lives) || 0) <= 0) {
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

    activateHelmet(durationMs = 10000) {
        this.helmetActive = true;
        this.helmetUntil = this.time.now + Math.max(0, Number(durationMs) || 0);

        if (this.helmetTimer) {
            this.helmetTimer.remove(false);
        }

        // create blue aura around player
        try {
            if (!this.helmetAura && this.player) {
                const radius = Math.max((this.player.displayWidth || 16), (this.player.displayHeight || 16)) * 1.4;
                this.helmetAura = this.add.circle(this.player.x, this.player.y, radius, 0x4db6ff, 0.28).setDepth(900);
                try { this.helmetAura.setBlendMode(Phaser.BlendModes.ADD); } catch (e) { }
            }
        } catch (e) { /* ignore */ }

        this.helmetTimer = this.time.delayedCall(Math.max(0, Number(durationMs) || 0), () => {
            this.deactivateHelmet();
        }, [], this);
    }

    deactivateHelmet() {
        this.helmetActive = false;
        this.helmetUntil = 0;
        if (this.helmetTimer) {
            try { this.helmetTimer.remove(false); } catch (e) {}
            this.helmetTimer = null;
        }
        try { if (this.helmetAura) { this.helmetAura.destroy(); this.helmetAura = null; } } catch (e) { }
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

    activateCompanionHelper(durationMs = 20000) {
        const helperDuration = Number(durationMs) > 0 ? Number(durationMs) : 20000;

        if (!this.companionSprite || !this.companionSprite.active) {
            const scaleFactor = (Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE) / OBJECT_NATIVE_SIZE;
            this.companionSprite = this.add.sprite(
                (this.player?.x || 0) + CONFIG.tileSize * 0.8,
                this.player?.y || 0,
                'objects',
                OBJECT_FRAMES.skeleton
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
        // no bounce: explode where it lands
        try { dynamite.setBounce(0, 0); } catch (e) {}
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
};
}
