// Flusso del livello: uscite, buche, timer, completamento, game over.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createLevelflowMixin(deps) {
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

return class LevelflowMixin {

    spawnHole2ExitAt(worldX, worldY, gridX = null, gridY = null, exitTargetLevelIndex = null, exitTargetLevelId = null, effects = [], effectOptions = null) {
        if (!this.hole2Exits) return;

        const exits = this.hole2Exits.children?.entries || [];
        const alreadyExists = exits.some((entry) => {
            if (!entry || !entry.active) return false;
            return Math.abs(entry.x - worldX) < 1 && Math.abs(entry.y - worldY) < 1;
        });
        if (alreadyExists) return;

    // Use the semantic `exit` frame if available (falls back to `hole2` otherwise)
        const exitFrame = (OBJECT_FRAMES.exit !== undefined) ? OBJECT_FRAMES.exit : OBJECT_FRAMES.hole2;
        const hole2Exit = this.hole2Exits.create(worldX, worldY, 'objects', exitFrame);
        // Match gem sizing/animation so the exit pulses similarly
        const hole2ScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        hole2Exit.setScale(hole2ScaleFactor);
        try {
            const specExit = resolveContactSpec('exit');
            hole2Exit.setData && hole2Exit.setData('contactType', specExit.contactType);
            hole2Exit.setData && hole2Exit.setData('contactSpec', specExit);
            hole2Exit.setData && hole2Exit.setData('type', 'exit');
        } catch (e) { }
        hole2Exit.setData('gridX', gridX);
        hole2Exit.setData('gridY', gridY);
        hole2Exit.setData('exitTargetLevelIndex', Number.isFinite(Number(exitTargetLevelIndex)) ? Number(exitTargetLevelIndex) : null);
        hole2Exit.setData('exitTargetLevelId', exitTargetLevelId || null);
        hole2Exit.setData('effects', Array.isArray(effects) ? effects : []);
        hole2Exit.setData('effectOptions', (effectOptions && typeof effectOptions === 'object' && !Array.isArray(effectOptions)) ? effectOptions : {});
        try { this.applyTokenEffects(hole2Exit, effects, worldX, worldY, effectOptions); } catch (e) { }
        if (hole2Exit.body) {
            try {
                const specExit = resolveContactSpec('exit');
                const iw = Math.floor(hole2Exit.displayWidth || hole2Exit.width);
                const ih = Math.floor(hole2Exit.displayHeight || hole2Exit.height);
                let radius;
                if (specExit && typeof specExit.radiusPixels === 'number') {
                    radius = Math.floor(specExit.radiusPixels);
                } else {
                    const mult = (specExit && specExit.radiusMultiplier) ? specExit.radiusMultiplier : 0.62;
                    radius = Math.floor(Math.min(iw, ih) * mult);
                }
                hole2Exit.body.setCircle(radius);
                hole2Exit.body.setOffset(Math.floor((iw / 2) - radius), Math.floor((ih / 2) - radius));
            } catch (e) {
                hole2Exit.body.setSize(Math.floor(hole2Exit.displayWidth || hole2Exit.width), Math.floor(hole2Exit.displayHeight || hole2Exit.height));
            }
        }
        if (hole2Exit.refreshBody) {
            hole2Exit.refreshBody();
        }

        // Pulse tween similar to gems
        try {
            this.tweens.add({
                targets: hole2Exit,
                scale: 1.2,
                duration: 500,
                yoyo: true,
                repeat: -1
            });
        } catch (e) {
            // If tweening fails for any reason, continue without animation
            console.warn('Failed to tween hole2 exit:', e);
        }

        // Create an "EXIT" overlay label in sovraimpressione
        try {
            if (!this.exitLabels) {
                this.exitLabels = this.add.group();
            }
            // Center the label exactly on the tile's center (worldX, worldY)
            const fontSize = Math.max(10, Math.floor(CONFIG.objectSize / 3));
            const label = this.add.text(worldX, worldY, 'EXIT', {
                fontFamily: 'PressStart2P, Arial',
                fontSize: `${fontSize}px`,
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }).setOrigin(0.5, 0.5);
            // Ensure it draws above other objects
            label.setDepth(1000);
            this.exitLabels.add(label);

            // Gentle up/down float for the label around the cell center
            this.tweens.add({
                targets: label,
                y: worldY - 6,
                duration: 700,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        } catch (e) {
            console.warn('Failed to create EXIT label:', e);
        }
    }

    spawnBackLabelAt(worldX, worldY) {
        try {
            if (!this.backLabels) {
                this.backLabels = this.add.group();
            }

            const existing = this.backLabels.getChildren().some((entry) => {
                if (!entry || !entry.active) return false;
                return Math.abs(entry.x - worldX) < 1 && Math.abs(entry.y - worldY) < 1;
            });
            if (existing) return;

            const fontSize = Math.max(10, Math.floor(CONFIG.objectSize / 3));
            const label = this.add.text(worldX, worldY, 'BACK', {
                fontFamily: 'PressStart2P, Arial',
                fontSize: `${fontSize}px`,
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
                align: 'center'
            }).setOrigin(0.5, 0.5);

            label.setDepth(1000);
            this.backLabels.add(label);

            this.tweens.add({
                targets: label,
                y: worldY - 6,
                duration: 700,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        } catch (e) {
            console.warn('Failed to create BACK label:', e);
        }
    }

    activateHole2Exits() {
        if (this.hole2ExitsActive) return;

        const exits = Array.isArray(this.hole2ExitPositions) ? this.hole2ExitPositions : [];

        // If no explicit exit positions were defined in the map, attempt to create a sensible fallback
        if (!exits.length) {
            // Try to find a walkable tile near the player; otherwise pick a random walkable tile
            let pick = null;
            try {
                const centerX = this.player?.x || (this.mapOffsetX + Math.floor(this.mapCols / 2) * CONFIG.tileSize);
                const centerY = this.player?.y || (this.mapOffsetY + Math.floor(this.mapRows / 2) * CONFIG.tileSize);
                const nearest = this.getNearestPoint(centerX, centerY, this.mapGemPositions || []);
                if (nearest) {
                    pick = nearest;
                } else {
                    const tile = this.getRandomWalkableTile();
                    if (tile) {
                        pick = { x: this.mapOffsetX + tile.x * CONFIG.tileSize + CONFIG.tileSize / 2, y: this.mapOffsetY + tile.y * CONFIG.tileSize + CONFIG.tileSize / 2, gridX: tile.x, gridY: tile.y };
                    }
                }
            } catch (e) { pick = null; }

            if (pick) {
                // register fallback exit position so the objective pointer can use it
                this.hole2ExitPositions = this.hole2ExitPositions || [];
                this.hole2ExitPositions.push({ x: pick.x, y: pick.y, gridX: pick.gridX ?? null, gridY: pick.gridY ?? null });
            }
        }

        this.hole2ExitsActive = true;
        // mark the exit as unlocked so overlap handlers allow level completion
        this.exitUnlocked = true;

        (Array.isArray(this.hole2ExitPositions) ? this.hole2ExitPositions : []).forEach((exitPos) => {
            this.spawnHole2ExitAt(
                exitPos.x,
                exitPos.y,
                exitPos.gridX,
                exitPos.gridY,
                exitPos.exitTargetLevelIndex,
                    exitPos.exitTargetLevelId,
                exitPos.effects,
                exitPos.effectOptions
            );
        });
    }

    onPlayerReachHole2Exit(player, hole2Exit) {
        if (!this.hole2ExitsActive) return;
        if (!hole2Exit || !hole2Exit.active) return;
        // Ensure exit has been unlocked by collecting the required number of gems
        if (!this.exitUnlocked) return;
        const forcedLevelIndex = Number(hole2Exit.getData?.('exitTargetLevelIndex'));
        const targetLevel = Number.isFinite(forcedLevelIndex) ? forcedLevelIndex : null;
        this.levelComplete(targetLevel);
    }

    checkHoleProximity() {
        // Determine if player(s) are adjacent to a hole and have wooden planks available
        try {
            this.holeNearbyP1 = false;
            this.holeNearbyP2 = false;
            this.holeNearbyTileP1 = null;
            this.holeNearbyTileP2 = null;

            const checkNearby = (player) => {
                if (!player || !player.active) return null;
                const px = player.x;
                const py = player.y;
                const gridX = Math.floor((px - this.mapOffsetX) / CONFIG.tileSize);
                const gridY = Math.floor((py - this.mapOffsetY) / CONFIG.tileSize);
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const gx = gridX + dx;
                        const gy = gridY + dy;
                        if (gy < 0 || gy >= (this.tiles?.length || 0)) continue;
                        if (gx < 0 || gx >= (this.tiles[0]?.length || 0)) continue;
                        const t = this.tiles[gy][gx];
                        if (!t) continue;
                        if (t.type === 'hole') {
                            // If hole already covered (has coverSprite), ignore
                            if (t.coverSprite && t.coverSprite.active) continue;
                            const worldX = this.mapOffsetX + gx * CONFIG.tileSize + CONFIG.tileSize / 2;
                            const worldY = this.mapOffsetY + gy * CONFIG.tileSize + CONFIG.tileSize / 2;
                            const dist = Phaser.Math.Distance.Between(px, py, worldX, worldY);
                            if (dist <= CONFIG.tileSize * 1.2) return t;
                        }
                    }
                }
                return null;
            };

            // Player 1
            if (this.player) {
                const tileP1 = checkNearby(this.player);
                const hasWoodP1 = (Number(GAME_STATE.players) === 2) ? ((Number(GAME_STATE.woodenP1) || 0) > 0) : ((Number(GAME_STATE.woodenCount) || 0) > 0);
                if (tileP1 && hasWoodP1) {
                    this.holeNearbyP1 = true;
                    this.holeNearbyTileP1 = tileP1;
                }
            }

            // Player 2
            if (this.player2) {
                const tileP2 = checkNearby(this.player2);
                const hasWoodP2 = (Number(GAME_STATE.woodenP2) || 0) > 0;
                if (tileP2 && hasWoodP2) {
                    this.holeNearbyP2 = true;
                    this.holeNearbyTileP2 = tileP2;
                }
            }
        } catch (e) { /* ignore proximity errors */ }
    }

    hitHole(player) {
        // Visual falling effect into the hole, then lose life and respawn
        const pl = player || this.player;
        try {
            if (!pl || !pl.active) return;

            // prevent re-entrancy
            if (pl.getData && pl.getData('fallingIntoHole')) return;
            if (pl.setData) pl.setData('fallingIntoHole', true);

            // compute center of the tile the player is on
            const gridX = Math.floor((pl.x - (this.mapOffsetX || 0)) / CONFIG.tileSize);
            const gridY = Math.floor((pl.y - (this.mapOffsetY || 0)) / CONFIG.tileSize);
            const centerX = this.mapOffsetX + gridX * CONFIG.tileSize + CONFIG.tileSize / 2;
            const centerY = this.mapOffsetY + gridY * CONFIG.tileSize + CONFIG.tileSize / 2;

            // stop player movement
            try { if (pl.body) { pl.body.setVelocity(0, 0); pl.body.setEnable(false); } } catch (e) { }

            // play optional fall sfx if available
            try { if (this.sound && this.sound.get('fall_sfx')) this.sound.play('fall_sfx'); } catch (e) { }

            // sinking tween: move to center, shrink and fade
            this.tweens.add({
                targets: pl,
                x: centerX,
                y: centerY + (CONFIG.tileSize * 0.18),
                scale: 0.35,
                alpha: 0,
                angle: 14,
                duration: 520,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    try {
                        // create a small dust puff and play fall sfx (if available)
                        try {
                            if (this.createDustPuff) this.createDustPuff(centerX, centerY, 0.9);
                        } catch (e) { }
                        try {
                            if (this.sound) {
                                if (this.sound.get('fall_sfx')) this.sound.play('fall_sfx');
                                else if (this.sound.get('explosion_sfx')) this.sound.play('explosion_sfx', { volume: 0.35 });
                            }
                        } catch (e) { }

                        // hide the sprite and mark inactive briefly
                        pl.setVisible(false);
                        pl.setActive(false);
                    } catch (e) { }

                    // ensure flag removed so respawn logic can reuse the player
                    try { if (pl.setData) pl.setData('fallingIntoHole', false); } catch (e) { }

                    // finally, register life loss for this player and show popup at hole center
                    try { this.loseLife({ player: pl, popupX: centerX, popupY: centerY }); } catch (e) { this.loseLife(); }

                    // re-enable body if it exists (respawnPlayer will reposition/enable visuals)
                    try { if (pl.body) pl.body.setEnable(true); } catch (e) { }

                    // Ensure the player is returned to the level's playerStart after falling
                    try {
                        this.time.delayedCall(220, () => {
                            try {
                                if (Number(GAME_STATE.players) === 2) {
                                    // multiplayer: check per-player lives
                                    const p1 = Number(GAME_STATE.livesP1) || 0;
                                    const p2 = Number(GAME_STATE.livesP2) || 0;
                                    if (pl === this.player && p1 > 0) this.respawnPlayer(this.player);
                                    else if (pl === this.player2 && p2 > 0) this.respawnPlayer(this.player2);
                                } else {
                                    // single-player: respawn if lives remain
                                    if ((Number(GAME_STATE.lives) || 0) > 0) this.respawnPlayer(pl);
                                }
                            } catch (e) { }
                        });
                    } catch (e) { }

                    // Ensure player's display size is restored after respawn (respawnPlayer doesn't modify display size)
                    try {
                        const restoreDisplaySize = () => {
                            try {
                                const playerDisplaySize = Number(CONFIG.playerSize) || Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE;
                                if (pl && pl.setDisplaySize) pl.setDisplaySize(playerDisplaySize, playerDisplaySize);
                                // also reset scale to 1 to avoid compounded scaling
                                if (pl && pl.setScale) pl.setScale(1);
                            } catch (e) { }
                        };
                        this.time.delayedCall(620, restoreDisplaySize);
                    } catch (e) { }
                }
            });
        } catch (e) {
            // fallback behavior
            try { this.loseLife({ player: pl }); } catch (err) { this.loseLife(); }
        }
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

    levelComplete(forcedLevelIndex = null) {
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
        const computedNextLevel = (GAME_STATE.currentLevel + 1) % totalLevels;
        let nextLevel = computedNextLevel;
        if (Number.isFinite(Number(forcedLevelIndex))) {
            const forced = Number(forcedLevelIndex);
            if (forced >= 0 && forced < totalLevels) {
                nextLevel = forced;
            }
        }
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

    goToPreviousLevel(forcedLevelIndex = null) {
        if (this.isLevelTransitioning) return;
        this.isLevelTransitioning = true;

        // stop ongoing timers and effects similar to levelComplete cleanup
        try {
            this.deactivateCompanionHelper && this.deactivateCompanionHelper();
            this.stopLevelLightEffect && this.stopLevelLightEffect();
            this.stopGhostSfx && this.stopGhostSfx();
        } catch (e) { }

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

        const totalLevels = (LEVEL_CONFIG && Array.isArray(LEVEL_CONFIG.levels)) ? LEVEL_CONFIG.levels.length : 1;
        const current = Number(GAME_STATE.currentLevel) || 0;
        const computedPrev = ((current - 1) + totalLevels) % Math.max(1, totalLevels);
        let prev = computedPrev;
        if (Number.isFinite(Number(forcedLevelIndex))) {
            const forced = Number(forcedLevelIndex);
            if (forced >= 0 && forced < totalLevels) {
                prev = forced;
            }
        }
        GAME_STATE.currentLevel = prev;

        // Show a central flashing "BACK" overlay before transitioning
        try {
            const cam = this.cameras?.main;
            const cx = cam ? cam.width / 2 : (CONFIG.width / 2);
            const cy = cam ? cam.height / 2 : (CONFIG.height / 2);

            const overlay = this.add.rectangle(cx, cy, cam ? cam.width : CONFIG.width, cam ? cam.height : CONFIG.height, 0x000000, 1)
                .setScrollFactor(0)
                .setDepth(4000);

            const label = this.add.text(cx, cy, 'BACK', {
                fontSize: '34px',
                fill: '#ffffff',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 5,
                align: 'center'
            }).setOrigin(0.5).setDepth(4001).setScrollFactor(0);

            // Flash/scale for 700ms (two half cycles) then transition
            this.tweens.add({
                targets: label,
                alpha: { from: 1, to: 0 },
                scale: { from: 0.95, to: 1.08 },
                duration: 350,
                yoyo: true,
                repeat: 1,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    try {
                        if (label && label.destroy) label.destroy();
                        if (overlay && overlay.destroy) overlay.destroy();
                    } catch (e) { }
                    try {
                        this.scene.restart();
                    } catch (e) {
                        try { window.location.reload(); } catch (err) { }
                    }
                }
            });
        } catch (e) {
            // If rendering overlay fails, fallback to immediate restart
            try { this.scene.restart(); } catch (err) { try { window.location.reload(); } catch (e2) { } }
        }
    }

    getWorldStartLevelIndex(levelIndex = null) {
        const totalLevels = (LEVEL_CONFIG && Array.isArray(LEVEL_CONFIG.levels)) ? LEVEL_CONFIG.levels.length : 1;
        const current = Number.isFinite(Number(levelIndex)) ? Number(levelIndex) : (Number(GAME_STATE.currentLevel) || 0);
        const start = Math.floor(current / 5) * 5;
        if (start < 0) return 0;
        if (start >= totalLevels) return Math.max(0, totalLevels - 1);
        return start;
    }

    returnToWorldStartLevel(reasonLabel = 'SNAKE BITE') {
        if (this.isLevelTransitioning) return;
        this.isLevelTransitioning = true;

        try {
            this.stopLevelLightEffect && this.stopLevelLightEffect();
            this.stopGhostSfx && this.stopGhostSfx();
        } catch (e) { }
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

        const targetLevel = this.getWorldStartLevelIndex();
        GAME_STATE.currentLevel = targetLevel;

        try {
            const cam = this.cameras?.main;
            const cx = cam ? cam.width / 2 : (CONFIG.width / 2);
            const cy = cam ? cam.height / 2 : (CONFIG.height / 2);

            const overlay = this.add.rectangle(cx, cy, cam ? cam.width : CONFIG.width, cam ? cam.height : CONFIG.height, 0x000000, 1)
                .setScrollFactor(0)
                .setDepth(4100);

            const label = this.add.text(cx, cy, reasonLabel, {
                fontSize: '28px',
                fill: '#ffcc66',
                fontFamily: GAME_FONT,
                stroke: '#000000',
                strokeThickness: 5,
                align: 'center'
            }).setOrigin(0.5).setDepth(4101).setScrollFactor(0);

            this.tweens.add({
                targets: label,
                alpha: { from: 1, to: 0 },
                scale: { from: 0.95, to: 1.05 },
                duration: 480,
                yoyo: true,
                repeat: 0,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    try {
                        if (label && label.destroy) label.destroy();
                        if (overlay && overlay.destroy) overlay.destroy();
                    } catch (e) { }
                    try {
                        this.scene.restart();
                    } catch (e) {
                        try { window.location.reload(); } catch (err) { }
                    }
                }
            });
        } catch (e) {
            try { this.scene.restart(); } catch (err) { try { window.location.reload(); } catch (e2) { } }
        }
    }

    gameOver() {
        this.stopLevelLightEffect();
        this.stopGhostSfx();
        if (this.batDirectionTimer) {
            this.batDirectionTimer.remove();
            this.batDirectionTimer = null;
        }
        this.deactivateCompanionHelper();
        // stop most game audio (rain, per-boulder rolling sounds, bat sfx, etc.)
        try { if (this._stopAllAudio) this._stopAllAudio(); } catch (e) { }
        const gameMusic = this.sound.get('game_bgm');
        if (gameMusic && gameMusic.isPlaying) {
            gameMusic.stop();
        }
        // mark game over to disable further gameplay input/actions
        try { GAME_STATE.isGameOver = true; } catch (e) { }

        // Play game over sound if available, otherwise fall back
        try {
            if (this.sound) {
                // prefer explicit gameover sound
                if (this.cache && this.cache.audio && this.cache.audio.exists('gameover_sfx')) {
                    try { this.sound.play('gameover_sfx', { volume: 0.6 }); } catch (e) { }
                } else if (this.sound.get('explosion_sfx')) {
                    try { this.sound.play('explosion_sfx', { volume: 0.6 }); } catch (e) { }
                } else if (this.sound.get('level_completed_sfx')) {
                    try { this.sound.play('level_completed_sfx', { volume: 0.6 }); } catch (e) { }
                }
            }
        } catch (e) { }

        this.scene.launch(kitFlow.next('gameplay', 'gameover', 'GameOverScene'));
    }

    continueFromGameOver(players = 1) {
        const requiredPlayers = Number(players) === 2 ? 2 : 1;
        try {
            GAME_STATE.isGameOver = false;
            GAME_STATE.players = requiredPlayers;
        } catch (e) { }

        const continueLives = Math.max(1, Number(CONFIG.lives) || 1);

        if (requiredPlayers === 2) {
            GAME_STATE.livesP1 = Math.max(continueLives, Number(GAME_STATE.livesP1) || 0);
            GAME_STATE.livesP2 = Math.max(continueLives, Number(GAME_STATE.livesP2) || 0);

            try {
                if (this.player && this.player.active === false) {
                    this.player.setActive(true).setVisible(true);
                    this.respawnPlayer(this.player);
                }
            } catch (e) { }
            try {
                if (this.player2 && this.player2.active === false) {
                    this.player2.setActive(true).setVisible(true);
                    this.respawnPlayer(this.player2);
                }
            } catch (e) { }
        } else {
            GAME_STATE.lives = Math.max(continueLives, Number(GAME_STATE.lives) || 0);
            try {
                if (this.player && this.player.active === false) {
                    this.player.setActive(true).setVisible(true);
                    this.respawnPlayer(this.player);
                }
            } catch (e) { }
        }

        try {
            this.refreshHudIcons && this.refreshHudIcons();
        } catch (e) { }

        // Resume core gameplay loop audio after a continue.
        try {
            playLoopAudioSafely(this, 'game_bgm', 0.28);
        } catch (e) { }
    }

    _stopAllAudio() {
        try {
            // Rain
            try { if (this.rainSfx) { try { this.rainSfx.stop && this.rainSfx.stop(); } catch (e) {} try { this.rainSfx.destroy && this.rainSfx.destroy(); } catch (e) {} this.rainSfx = null; } } catch (e) {}
            try { if (this.rainBurstTimer) { this.rainBurstTimer.remove && this.rainBurstTimer.remove(false); } } catch (e) {} this.rainBurstTimer = null;
            try { if (this.rainTimer) { this.rainTimer.remove && this.rainTimer.remove(false); } } catch (e) {} this.rainTimer = null;
            try { if (this.rainMasterTimer) { this.rainMasterTimer.remove && this.rainMasterTimer.remove(false); } } catch (e) {} this.rainMasterTimer = null;
            try { if (this.rainEmitter) { this.rainEmitter.stop && this.rainEmitter.stop(); } } catch (e) {} this.rainEmitter = null;
            try { if (this.rainParticles) { this.rainParticles.destroy && this.rainParticles.destroy(); } } catch (e) {} this.rainParticles = null;

            // Boulders: stop per-instance rolling sounds
            try {
                const boulders = this.boulders?.children?.entries || [];
                boulders.forEach((b) => {
                    try {
                        const s = b.getData && b.getData('rollingSound');
                        if (s) { try { s.stop && s.stop(); } catch (e) {} try { s.destroy && s.destroy(); } catch (e) {} b.setData && b.setData('rollingSound', null); }
                    } catch (e) { }
                });
            } catch (e) { }

            // Bats: stop per-bat sfx
            try {
                const bats = this.bats?.children?.entries || [];
                bats.forEach((bat) => {
                    try {
                        const s = bat.getData && bat.getData('sfx');
                        if (s) { try { s.stop && s.stop(); } catch (e) {} try { s.destroy && s.destroy(); } catch (e) {} bat.setData && bat.setData('sfx', null); }
                    } catch (e) { }
                });
            } catch (e) { }

            // Stop/destroy other sounds managed by Phaser (except we will allow explicit gameover_sfx to be played afterwards)
            try {
                if (this.sound && Array.isArray(this.sound.sounds)) {
                    // clone list to avoid mutation while iterating
                    const all = this.sound.sounds.slice();
                    all.forEach((s) => {
                        try {
                            if (!s || !s.key) return;
                            if (s.key === 'gameover_sfx') return;
                            try { s.stop && s.stop(); } catch (e) {}
                            try { s.destroy && s.destroy(); } catch (e) {}
                        } catch (e) { }
                    });
                }
            } catch (e) { }
        } catch (e) { }
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
        // In multiplayer penalize both players on timeout, otherwise single-player lose
        this.loseLife({ forAll: Number(GAME_STATE.players) === 2 });
        if (Number(GAME_STATE.players) === 2) {
            if ((Number(GAME_STATE.livesP1) || 0) > 0 || (Number(GAME_STATE.livesP2) || 0) > 0) {
                this.levelTimeRemaining = this.levelTimeTotal;
                this.updateTimerBar();
            }
        } else {
            if ((Number(GAME_STATE.lives) || 0) > 0) {
                this.levelTimeRemaining = this.levelTimeTotal;
                this.updateTimerBar();
            }
        }
    }
};
}
