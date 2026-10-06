// Collisioni tra player, nemici, oggetti e muri.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createCollisionsMixin(deps) {
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

return class CollisionsMixin {

    setupCollisions() {
        // Player collisions
        this.physics.add.overlap(this.player, this.gems, this.collectGem, null, this);
        this.physics.add.overlap(this.player, this.items, this.collectItem, null, this);
        this.physics.add.overlap(this.player, this.bats, this.hitByBat, null, this);
        this.physics.add.overlap(this.player, this.spiders, this.hitBySpider, null, this);
        this.physics.add.overlap(this.player, this.snakes, this.hitBySnake, null, this);
        const playerRockCollider = this.physics.add.collider(this.player, this.rocks, this.hitByRock, null, this);
        if (playerRockCollider) {
            this.playerCollisionRefs.push(playerRockCollider);
        }
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

        // If a second player exists, wire the same overlaps so they interact with the world too
        try {
            if (this.player2) {
                this.physics.add.overlap(this.player2, this.gems, this.collectGem, null, this);
                this.physics.add.overlap(this.player2, this.items, this.collectItem, null, this);
                this.physics.add.overlap(this.player2, this.bats, this.hitByBat, null, this);
                this.physics.add.overlap(this.player2, this.spiders, this.hitBySpider, null, this);
                this.physics.add.overlap(this.player2, this.snakes, this.hitBySnake, null, this);
                const p2RockCollider = this.physics.add.collider(this.player2, this.rocks, this.hitByRock, null, this);
                if (p2RockCollider) this.playerCollisionRefs.push(p2RockCollider);
                this.physics.add.overlap(this.player2, this.boulders, this.hitByBoulder, null, this);
                this.physics.add.overlap(this.player2, this.ghosts, this.hitByGhost, null, this);
                this.physics.add.overlap(this.player2, this.shards, this.hitByShard, null, this);
                this.physics.add.overlap(this.player2, this.hole2Exits, this.onPlayerReachHole2Exit, null, this);
                if (this.walls) {
                    const p2WallCollider = this.physics.add.collider(this.player2, this.walls);
                    if (p2WallCollider) this.playerCollisionRefs.push(p2WallCollider);
                }
                if (this.doors) {
                    const p2DoorCollider = this.physics.add.collider(this.player2, this.doors, this.onPlayerDoorCollide, null, this);
                    if (p2DoorCollider) this.playerCollisionRefs.push(p2DoorCollider);
                }
            }
        } catch (e) { }

        // Dynamite collisions
        this.physics.add.collider(this.dynamites, this.rocks, this.dynamiteHitRock, null, this);
        this.physics.add.overlap(this.dynamites, this.boulders, this.dynamiteHitBoulder, null, this);
        this.physics.add.overlap(this.dynamites, this.bats, this.dynamiteHitBat, null, this);
        this.physics.add.overlap(this.dynamites, this.spiders, this.dynamiteHitSpider, null, this);
        this.physics.add.overlap(this.dynamites, this.snakes, this.dynamiteHitSnake, null, this);
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
        if (this.walls) {
            this.physics.add.collider(this.boulders, this.walls, (boulder, wall) => {
                this.trySplitRollingBoulder(boulder, wall);
            });
        }
        if (this.doors) {
            this.physics.add.collider(this.boulders, this.doors, (boulder, door) => {
                this.trySplitRollingBoulder(boulder, door);
            });
        }

        if (this.walls) {
            this.physics.add.collider(this.snakes, this.walls, (snake) => {
                this.setSnakeRandomVelocity(snake);
            });
        }
        if (this.doors) {
            this.physics.add.collider(this.snakes, this.doors, (snake) => {
                this.setSnakeRandomVelocity(snake);
            });
        }
        this.physics.add.collider(this.boulders, this.boulders, (boulderA, boulderB) => {
            this.trySplitRollingBoulder(boulderA, boulderB);
            this.trySplitRollingBoulder(boulderB, boulderA);
        });

    }
};
}
