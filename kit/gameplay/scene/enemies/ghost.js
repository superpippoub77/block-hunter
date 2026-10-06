// Nemico: fantasma.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createEnemiesGhostMixin(deps) {
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

return class EnemiesGhostMixin {

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
        const vx = (dx / len) * speed;
        const vy = (dy / len) * speed;
        ghost.setVelocity(vx, vy);

        // Mirror sprite horizontally based on horizontal velocity so animation is "a specchio"
        try {
            // Prefer horizontal component to decide facing; fall back to last known direction
            if (Math.abs(vx) >= Math.abs(vy)) {
                ghost.setFlipX(vx < 0);
            } else {
                const last = Number(ghost.getData('lastVx')) || 1;
                ghost.setFlipX(last < 0);
            }
            ghost.setData('lastVx', vx);
        } catch (e) { }

        // Ensure float animation is playing
        try {
            if (this.anims.exists('ghost_float')) {
                if (!ghost.anims || !ghost.anims.currentAnim) {
                    ghost.play('ghost_float');
                }
            }
        } catch (e) { }
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
            try {
                // Mirror the ghost sprite when moving left so animation appears mirrored
                const vx = ghost.body && ghost.body.velocity ? (ghost.body.velocity.x || 0) : 0;
                const vy = ghost.body && ghost.body.velocity ? (ghost.body.velocity.y || 0) : 0;
                const threshold = 2; // small deadzone for deciding facing
                if (vx < -threshold) {
                    ghost.setFlipX(true);
                } else if (vx > threshold) {
                    ghost.setFlipX(false);
                }

                // If ghost is essentially stopped, hold frame 0 and stop animation.
                // Otherwise ensure float animation is playing.
                const speedNow = Math.hypot(vx, vy);
                const stopThreshold = 6; // pixels/sec under which ghost is considered stopped
                if (speedNow <= stopThreshold) {
                    try {
                        if (ghost.anims && ghost.anims.isPlaying) ghost.anims.stop();
                        ghost.setFrame(0);
                        ghost.setData('isStopped', true);
                    } catch (e) { }
                } else {
                    try {
                        if (ghost.getData('isStopped')) {
                            ghost.setData('isStopped', false);
                            if (this.anims.exists('ghost_float')) ghost.play('ghost_float');
                        } else if (this.anims.exists('ghost_float') && !(ghost.anims && ghost.anims.isPlaying)) {
                            ghost.play('ghost_float');
                        }
                    } catch (e) { }
                }
            } catch (e) { }
        });
    }

    hitByGhost(player, ghost) {
        this.loseLife({ player });
    }
};
}
