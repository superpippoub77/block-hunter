// Rocce e massi: rocce statiche, schegge, massi rotolanti.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createRocksMixin(deps) {
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

return class RocksMixin {

    spawnStaticRocks() {
        // Determine spawn interval: allow per-level override via
        // `levelConfig.staticRocks.spawnInterval` (ms) or `spawnRate` (per second).
        const staticCfg = this.levelConfig?.staticRocks || {};
        let spawnDelay = Math.max(200, 1200 - GAME_STATE.currentLevel * 40); // default faster on higher levels
        try {
            if (Number.isFinite(Number(staticCfg.spawnInterval)) && Number(staticCfg.spawnInterval) > 0) {
                spawnDelay = Math.max(80, Number(staticCfg.spawnInterval));
            } else if (Number.isFinite(Number(staticCfg.spawnRate)) && Number(staticCfg.spawnRate) > 0) {
                spawnDelay = Math.max(80, Math.round(1000 / Number(staticCfg.spawnRate)));
            }
        } catch (e) { }

        // Determine how many rocks to spawn each tick: support `spawnCounts` array or `spawnCount` number
        const chooseStaticSpawnCount = () => {
            try {
                if (Array.isArray(staticCfg.spawnCounts) && staticCfg.spawnCounts.length > 0) {
                    const pick = Phaser.Utils.Array.GetRandom(staticCfg.spawnCounts);
                    return Math.max(1, Math.floor(Number(pick) || 1));
                } else if (Number.isFinite(Number(staticCfg.spawnCount)) && Number(staticCfg.spawnCount) > 0) {
                    return Math.max(1, Math.floor(Number(staticCfg.spawnCount)));
                }
            } catch (e) { }
            return 1;
        };

        // Spawn continuo
        this.rockSpawnTimer = this.time.addEvent({
            delay: spawnDelay,
            callback: () => {
                const count = chooseStaticSpawnCount();
                for (let i = 0; i < count; i++) {
                    this.spawnSingleRock();
                }
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
        // Create a soft shadow (ellipse) underneath the rock
        try {
            const shadowWidth = Math.max(12, 28 * finalScale);
            const shadowHeight = Math.max(6, 8 * finalScale);
            const rockShadow = this.add.ellipse(
                jitteredX,
                jitteredY + (6 * finalScale),
                shadowWidth,
                shadowHeight,
                0x000000,
                0.42
            ).setOrigin(0.5);
            // Put shadow just below the rock (rocks set very high depth while falling)
            try { rockShadow.setDepth((rock.depth || Math.round(jitteredY)) - 1); } catch (e) { }
            rock.setData('shadow', rockShadow);
            if (rock.once) {
                rock.once('destroy', () => {
                    try { if (rockShadow && rockShadow.destroy) rockShadow.destroy(); } catch (e) { }
                });
            }
        } catch (e) { }
    rock.setData('isFalling', true);
    // Durante la caduta la roccia deve essere in primo piano rispetto agli oggetti sotto
    try {
        // Compute a depth that is above all in-game world objects but below UI/HUD elements.
        // Use `HUD_DEPTH` as threshold for HUD/UI elements.
        const HUD_DEPTH_THRESHOLD = HUD_DEPTH;
        let maxWorldDepth = 0;
        try {
            const children = this.children && this.children.list ? this.children.list : [];
            for (let i = 0; i < children.length; i++) {
                const ch = children[i];
                if (!ch || typeof ch.depth === 'undefined') continue;
                const d = Number(ch.depth) || 0;
                if (d >= HUD_DEPTH_THRESHOLD) continue; // skip HUD/overlay
                if (d > maxWorldDepth) maxWorldDepth = d;
            }
        } catch (e) { }
        // place the falling rock above all world objects but below HUD; clamp if needed
        let fallingDepth = Math.max((Math.round(maxWorldDepth) + 4), 3000);
        if (fallingDepth >= HUD_DEPTH_THRESHOLD) fallingDepth = Math.max(3000, HUD_DEPTH_THRESHOLD - 10);
        rock.setDepth(fallingDepth);
        // ensure shadow renders just below the rock while falling
        try {
            const sh = rock.getData && rock.getData('shadow');
            if (sh && sh.setDepth) {
                sh.setDepth((rock.depth || fallingDepth) - 1);
            }
        } catch (e) { }
    } catch (e) { }
        rock.setData('burstOnLanding', this.shouldCurrentStoneBurstOnLanding());

        // Rotazione casuale in partenza (calcolata prima della caduta; la roccia NON ruoterà durante la discesa)
        const startAngle = Phaser.Math.Between(0, 360);
        rock.setAngle(startAngle);

        // Effetto di apparizione con zoom da grosso a piccolo (caduta)
        rock.setScale(finalScale * 3); // Inizia 3x più grande
        rock.alpha = 0.7; // Leggermente trasparente all'inizio
        this.tweens.add({
            targets: rock,
            scale: finalScale,
            alpha: 1,
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
                // Ripristina la depth in base alla Y così il layering torna naturale
                try { 
                    rock.setDepth(Math.round(rock.y)); 
                    // update shadow to remain just under the rock
                    try {
                        const sh = rock.getData && rock.getData('shadow');
                        if (sh && sh.active) {
                            sh.x = rock.x;
                            sh.y = rock.y + (6 * (rock.scaleY || 1));
                            try { sh.setDepth((rock.depth || Math.round(rock.y)) - 1); } catch (e) { }
                        }
                    } catch (e) { }
                } catch (e) { }

                // No angular deceleration for static rocks (they don't rotate during or after the fall)

                // Effetto terremoto del pavimento all'impatto della stone
                const impactIntensity = size === 'large' ? 0.008 : (size === 'medium' ? 0.005 : 0.003);
                const impactDuration = size === 'large' ? 180 : (size === 'medium' ? 130 : 90);
                const impactVolume = size === 'large' ? 0.65 : (size === 'medium' ? 0.5 : 0.35);
                if (CONFIG.enableImpactShake !== false && this.cameras && this.cameras.main) {
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
                // No tremble: keep final transform stable after landing

                // Polvere che si alza
                this.createDustPuff(rock.x, rock.y, scale);

                if (rock.getData('burstOnLanding')) {
                    this.emitStoneShardBurst(rock.x, rock.y, size);
                }
            }
        });

        // For static rocks we do not apply a rotation tween even in 'chaotic' mode,
        // so their angle remains the precomputed one during fall and after landing.
    }

    checkBouldersInHoles() {
        // Check each active boulder to see if it's over a hole
        if (!this.boulders) return;
        const boulders = this.boulders.children?.entries || [];
        boulders.forEach((boulder) => {
            if (!boulder || !boulder.active) return;
            // Prevent re-checking if already falling into hole
            if (boulder.getData && boulder.getData('fallingIntoHole')) return;
            
            const tile = this.getTileAt(boulder.x, boulder.y);
            if (tile && tile.type === 'hole') {
                this.boulderIntoHole(boulder);
            }
        });
    }

    boulderIntoHole(boulder) {
        // Boulder falls into hole with shrinking animation
        if (!boulder || !boulder.active) return;
        
        try {
            if (boulder.setData) boulder.setData('fallingIntoHole', true);
            
            // Stop boulder movement
            try { if (boulder.body) { boulder.body.setVelocity(0, 0); boulder.body.angularVelocity = 0; } } catch (e) { }
            
            // Get boulder grid position for center calculation
            const gridX = Math.floor((boulder.x - (this.mapOffsetX || 0)) / CONFIG.tileSize);
            const gridY = Math.floor((boulder.y - (this.mapOffsetY || 0)) / CONFIG.tileSize);
            const centerX = this.mapOffsetX + gridX * CONFIG.tileSize + CONFIG.tileSize / 2;
            const centerY = this.mapOffsetY + gridY * CONFIG.tileSize + CONFIG.tileSize / 2;
            
            // Get boulder's current scale
            const currentScale = boulder.scale || 1;
            
            // Sinking tween: move to center, shrink and fade (same as player)
            this.tweens.add({
                targets: boulder,
                x: centerX,
                y: centerY + (CONFIG.tileSize * 0.18),
                scale: Math.max(0.05, currentScale * 0.35),
                alpha: 0,
                angle: 14,
                duration: 520,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    try {
                        // Create a small dust puff at the hole center
                        try {
                            if (this.createDustPuff) this.createDustPuff(centerX, centerY, 0.9);
                        } catch (e) { }
                        
                        // Play fall sfx if available
                        try {
                            if (this.sound) {
                                if (this.sound.get('fall_sfx')) this.sound.play('fall_sfx');
                                else if (this.sound.get('explosion_sfx')) this.sound.play('explosion_sfx', { volume: 0.35 });
                            }
                        } catch (e) { }
                        
                        // Hide and remove the boulder
                        boulder.setVisible(false);
                        boulder.setActive(false);
                        boulder.destroy();
                    } catch (e) { }
                }
            });
        } catch (e) { }
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

    hitByBoulder(player, boulder) {
        this.loseLife({ player });
        boulder.destroy();
    }

    hitByRock(player, rock) {
        const isFalling = !!(rock && rock.getData && rock.getData('isFalling'));
        // If helmet active, destroy the rock and surrounding rocks (regardless of falling state)
        if (this.helmetActive) {
            const tiles = Number(CONFIG.helmetRadiusTiles) || 1.6;
            const radius = tiles * (Number(CONFIG.tileSize) || 64);
            // destroy rocks within radius (including the one that hit)
            const rocks = (this.rocks && this.rocks.children && this.rocks.children.entries) ? this.rocks.children.entries.slice() : [];
            let destroyedCount = 0;
            for (let i = 0; i < rocks.length; i++) {
                const rk = rocks[i];
                if (!rk || !rk.active) continue;
                const dx = (rk.x || 0) - (player.x || 0);
                const dy = (rk.y || 0) - (player.y || 0);
                if (Math.hypot(dx, dy) <= radius) {
                    destroyedCount++;
                    try { this.addScore(5, rk.x, rk.y); } catch (e) { }
                    try {
                        const size = rk.getData && rk.getData('size') ? rk.getData('size') : 'medium';
                        // visual effects: dust + shards
                        try { this.createDustPuff(rk.x, rk.y, (size === 'small' ? 0.8 : (size === 'large' ? 1.4 : 1))); } catch (e) { }
                        try { this.emitStoneShardBurst(rk.x, rk.y, size); } catch (e) { }
                    } catch (e) { }
                    try { rk.destroy(); } catch (e) { }
                }
            }
            if (destroyedCount > 0) {
                try { if (this.sound) this.sound.play('explosion_sfx', { volume: 0.45 }); } catch (e) { }
                try { this.createExplosionAt(player.x, player.y); } catch (e) { }
            }
            return;
        }

        // If not falling and helmet not active, ignore non-falling rocks (player walks into them)
        if (!isFalling) return;

        // Normal hit by falling rock
        this.loseLife({ player });
        try { rock.destroy(); } catch (e) { }
    }

    hitByShard(player, shard) {
        this.loseLife({ player });
        shard.destroy();
    }

    startBoulderSpawning() {
        // Default spawn interval scales with level speed and difficulty
        let spawnInterval = 3000 / (this.levelConfig.speed * GAME_STATE.difficulty);
        try {
            const dyn = this.levelConfig?.dynamicBoulders || {};
            if (Number.isFinite(Number(dyn.spawnInterval)) && Number(dyn.spawnInterval) > 0) {
                spawnInterval = Math.max(60, Number(dyn.spawnInterval));
            } else if (Number.isFinite(Number(dyn.spawnRate)) && Number(dyn.spawnRate) > 0) {
                spawnInterval = Math.max(60, Math.round(1000 / Number(dyn.spawnRate)));
            }
        } catch (e) { }

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
        // create a soft shadow underneath the rolling boulder
        try {
            const shW = Math.max(14, 28 * finalScale);
            const shH = Math.max(6, 8 * finalScale);
            const bShadow = this.add.ellipse(boulder.x, boulder.y + (6 * finalScale), shW, shH, 0x000000, 0.42).setOrigin(0.5);
            try { bShadow.setDepth(Math.round(boulder.y) - 1); } catch (e) { }
            boulder.setData('shadow', bShadow);
            if (boulder.once) {
                boulder.once('destroy', () => {
                    try { if (bShadow && bShadow.destroy) bShadow.destroy(); } catch (e) { }
                });
            }
        } catch (e) { }
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
    // rotation tracking: count full rotations (in degrees accumulated)
    boulder.setData('rollingRotationsCount', 0);
    boulder.setData('rollingRotationAccum', 0);
    boulder.setData('rollingLastAngle', boulder.angle || 0);

        if (boulder.body) {
            boulder.body.setAllowGravity(false);
            boulder.body.setCollideWorldBounds(true);
            boulder.body.setSize(Math.floor(boulder.displayWidth || boulder.width), Math.floor(boulder.displayHeight || boulder.height));
        }
        boulder.setBounce(0.9);
        this.attachBoulderSmokeTrail(boulder);

        // Start per-boulder rolling sound (robust: add instance and store on boulder)
        try {
            if (this.sound && this.cache && this.cache.audio && this.cache.audio.exists('rolling_sfx')) {
                const rollSnd = this.sound.add('rolling_sfx');
                try { rollSnd.play({ loop: true, volume: Math.min(0.6, 0.18 + (finalScale * 0.12)) }); } catch (e) { try { rollSnd.play(); } catch (e2) { } }
                try { boulder.setData && boulder.setData('rollingSound', rollSnd); } catch (e) { }
                if (boulder.once) {
                    boulder.once('destroy', () => {
                        try { const s = boulder.getData && boulder.getData('rollingSound'); if (s && s.stop) s.stop(); if (s && s.destroy) s.destroy(); } catch (e) { }
                    });
                }
            }
        } catch (e) { }

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

        const sourceSize = String(boulder.getData('size') || 'medium');
        // Ensure split pieces are progressively smaller. Define a size order
        // and pick the next smaller size. If already at smallest, don't split.
        const sizeOrder = ['large', 'medium', 'small'];
        let nextSize = null;
        const idx = sizeOrder.indexOf(sourceSize);
        if (idx === -1) {
            // Unknown size: fallback to 'small' pieces
            nextSize = 'small';
        } else if (idx < sizeOrder.length - 1) {
            nextSize = sizeOrder[idx + 1];
        } else {
            // Already smallest size: do not split further
            return;
        }

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

            // If the boulder has effectively stopped (explicit flag or very low speed),
            // stop and destroy its rolling sound instance so audio ceases.
            try {
                const isStoppedFlag = Boolean(boulder.getData && boulder.getData('rollingStopped'));
                const currentRollSound = boulder.getData && boulder.getData('rollingSound');
                const stopThreshold = 8; // px/s threshold below which we consider it stopped for audio
                if (isStoppedFlag || adjustedSpeed <= stopThreshold) {
                    if (currentRollSound) {
                        try { currentRollSound.stop && currentRollSound.stop(); } catch (e) { }
                        try { currentRollSound.destroy && currentRollSound.destroy(); } catch (e) { }
                        try { boulder.setData && boulder.setData('rollingSound', null); } catch (e) { }
                    }
                }
            } catch (e) { }

            const spinSign = Number(boulder.getData('rollingSpinSign')) || 1;
            boulder.setAngularVelocity(spinSign * Phaser.Math.Clamp(targetSpeed * 4.6, 95, 980));

            // Update shadow position/size for this rolling boulder
            try {
                const sh = boulder.getData && boulder.getData('shadow');
                if (sh && sh.active) {
                    const baseScale = Number(boulder.getData('rollingBaseScale')) || 1;
                    // place shadow slightly below the boulder and scale it by baseScale
                    sh.x = boulder.x;
                    sh.y = boulder.y + (6 * baseScale);
                    if (sh.setDisplaySize) {
                        sh.setDisplaySize(Math.max(14, 28 * baseScale), Math.max(6, 8 * baseScale));
                    } else {
                        sh.width = Math.max(14, 28 * baseScale);
                        sh.height = Math.max(6, 8 * baseScale);
                    }
                    try { sh.setDepth(Math.round(boulder.y) - 1); } catch (e) { }
                }
            } catch (e) { }

            // Rotation counting: accumulate absolute angular change and stop after configured full rotations
            try {
                const dynamicBouldersCfg = this.levelConfig?.dynamicBoulders || {};
                const stopAfter = Number(dynamicBouldersCfg?.stopAfterRotations);
                if (Number.isFinite(stopAfter) && stopAfter > 0 && !boulder.getData('rollingStopped')) {
                    const lastAng = Number(boulder.getData('rollingLastAngle')) || 0;
                    const curAng = Number(boulder.angle) || 0;
                    let delta = curAng - lastAng;
                    // normalize to -180..180
                    delta = ((delta + 180) % 360) - 180;
                    let accum = Number(boulder.getData('rollingRotationAccum')) || 0;
                    accum += Math.abs(delta);
                    let rotations = Number(boulder.getData('rollingRotationsCount')) || 0;
                    if (accum >= 360) {
                        const inc = Math.floor(accum / 360);
                        rotations += inc;
                        accum = accum % 360;
                    }
                    boulder.setData('rollingRotationAccum', accum);
                    boulder.setData('rollingRotationsCount', rotations);
                    boulder.setData('rollingLastAngle', curAng);

                    if (rotations >= stopAfter) {
                        // stop the boulder movement and rotation
                        try {
                            boulder.setVelocity(0, 0);
                            if (boulder.body) {
                                boulder.body.setVelocity(0, 0);
                                boulder.body.angularVelocity = 0;
                            }
                            boulder.setAngularVelocity(0);
                        } catch (e) { }
                        boulder.setData('rollingStopped', true);
                        // remove any smoke trail event attached to this boulder
                        try {
                            const ev = boulder.getData && boulder.getData('smokeTrailEvent');
                            if (ev && ev.remove) ev.remove(false);
                            boulder.setData && boulder.setData('smokeTrailEvent', null);
                        } catch (e) { }
                    }
                }
            } catch (e) { }
        });
    }
};
}
