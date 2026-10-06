// Nemico: serpente.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createEnemiesSnakeMixin(deps) {
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

return class EnemiesSnakeMixin {

    getSnakeCountForLevel() {
        const direct = Number(this.levelData?.snake);
        if (Number.isFinite(direct) && direct > 0) {
            return Math.floor(direct);
        }
        const inMap = Number(this.levelData?.map?.snake);
        if (Number.isFinite(inMap) && inMap > 0) {
            return Math.floor(inMap);
        }
        return 0;
    }

    getSnakeSpeedForLevel() {
        const direct = Number(this.levelData?.snakeSpeed);
        if (Number.isFinite(direct) && direct > 0) {
            return direct;
        }
        const inMap = Number(this.levelData?.map?.snakeSpeed);
        if (Number.isFinite(inMap) && inMap > 0) {
            return inMap;
        }
        return Number(CONFIG.snakeSpeed) > 0 ? Number(CONFIG.snakeSpeed) : 95;
    }

    spawnSnakesFromMap() {
        if (!this.snakes) return;
        const requestedCount = this.getSnakeCountForLevel();
        if (requestedCount <= 0) return;

        const spawnPositions = Array.isArray(this.snakeSpawnPositions) ? this.snakeSpawnPositions : [];
        if (!spawnPositions.length) return;

        for (let i = 0; i < requestedCount; i++) {
            const pos = spawnPositions[i % spawnPositions.length];
            if (!pos) continue;
            this.spawnMapSnake(pos.x, pos.y);
        }
    }

    spawnMapSnake(worldX, worldY) {
        if (!this.snakes) return;
        const snakeTextureKey = this.textures.exists('snake') ? 'snake' : 'objects';
        const snakeFrame = snakeTextureKey === 'snake' ? 0 : (OBJECT_FRAMES.snake || OBJECT_FRAMES.spider || 0);
        const snake = this.snakes.create(worldX, worldY, snakeTextureKey, snakeFrame);
        const snakeScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        snake.setScale(snakeScaleFactor);
        snake.setData('baseScale', snakeScaleFactor);
        snake.setData('speed', this.getSnakeSpeedForLevel());
        snake.setData('lastBiteAt', 0);
        snake.setData('nextDirectionChangeAt', 0);
        if (snakeTextureKey === 'snake' && this.anims.exists('snake_float')) {
            snake.play('snake_float');
        }

        if (snake.body) {
            snake.body.setSize(Math.floor(snake.displayWidth || snake.width), Math.floor(snake.displayHeight || snake.height));
            snake.body.setCollideWorldBounds(true);
            snake.body.setBounce(0.05, 0.05);
        }

        this.setSnakeRandomVelocity(snake, true);
    }

    isSnakeBlockedTile(tile) {
        if (!tile) return false;
        const t = String(tile.type || '').toLowerCase();
        return t === 'wall' || t === 'door';
    }

    setSnakeRandomVelocity(snake, force = false) {
        if (!snake || !snake.active) return;
        const now = this.time?.now || 0;
        const nextChange = Number(snake.getData('nextDirectionChangeAt')) || 0;
        if (!force && now < nextChange) return;

        const speed = Number(snake.getData('speed')) || this.getSnakeSpeedForLevel();
        const dirs = [
            { x: 1, y: 0 },
            { x: -1, y: 0 },
            { x: 0, y: 1 },
            { x: 0, y: -1 }
        ];

        const valid = dirs.filter((dir) => {
            const testX = snake.x + dir.x * CONFIG.tileSize;
            const testY = snake.y + dir.y * CONFIG.tileSize;
            const testTile = this.getTileAt(testX, testY);
            return !this.isSnakeBlockedTile(testTile);
        });

        const picked = valid.length ? Phaser.Utils.Array.GetRandom(valid) : Phaser.Utils.Array.GetRandom(dirs);
        const mult = 0.68;
        snake.setVelocity(picked.x * speed * mult, picked.y * speed * mult);
        snake.setData('nextDirectionChangeAt', now + Phaser.Math.Between(450, 1200));
        this.applyEnemyDirectionalFacing(snake);
    }

    updateSnakes() {
        if (!this.snakes) return;
        const snakes = this.snakes.children?.entries || [];
        if (!snakes.length) return;

        snakes.forEach((snake) => {
            if (!snake || !snake.active) return;

            if (snake.texture?.key === 'snake' && this.anims.exists('snake_float')) {
                if (!(snake.anims && snake.anims.isPlaying)) {
                    snake.play('snake_float', true);
                }
            }
            this.applyEnemyDirectionalFacing(snake);

            const tile = this.getTileAt(snake.x, snake.y);
            if (this.isSnakeBlockedTile(tile)) {
                this.setSnakeRandomVelocity(snake, true);
                return;
            }

            if ((snake.body?.blocked?.left || snake.body?.blocked?.right || snake.body?.blocked?.up || snake.body?.blocked?.down)) {
                this.setSnakeRandomVelocity(snake, true);
                return;
            }

            if (Math.random() < 0.015) {
                this.setSnakeRandomVelocity(snake, true);
                return;
            }

            this.setSnakeRandomVelocity(snake, false);
        });
    }

    hitBySnake(player, snake) {
        if (!snake || !snake.active) return;
        if (this.cartPowerActive) return;

        const now = this.time.now;
        const lastBiteAt = Number(snake.getData('lastBiteAt')) || 0;
        if (now < lastBiteAt + 1000) return;
        snake.setData('lastBiteAt', now);

        this.createBloodSplatter(player?.x, player?.y, 2.0);
        this.loseLife({ player });

        if (GAME_STATE.isGameOver) return;
        this.returnToWorldStartLevel('SNAKE BITE');
    }

    dynamiteHitSnake(dynamite, snake) {
        if (!snake || !snake.active) return;
        this.addScore(20, snake.x, snake.y);

        const fallbackSpawn = this.getRandomWalkableTile();
        const fallbackX = fallbackSpawn ? (this.mapOffsetX + fallbackSpawn.x * CONFIG.tileSize + CONFIG.tileSize / 2) : snake.x;
        const fallbackY = fallbackSpawn ? (this.mapOffsetY + fallbackSpawn.y * CONFIG.tileSize + CONFIG.tileSize / 2) : snake.y;
        snake.destroy();

        this.time.delayedCall(200, () => {
            if (this.scene?.isActive?.('GameScene')) {
                this.spawnMapSnake(fallbackX, fallbackY);
            }
        });

        this.explodeDynamite(dynamite);
    }
};
}
