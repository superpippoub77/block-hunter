// Nemico: ragno.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createEnemiesSpiderMixin(deps) {
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

return class EnemiesSpiderMixin {

    getSpiderCountForLevel() {
        const direct = Number(this.levelData?.spider);
        if (Number.isFinite(direct) && direct > 0) {
            return Math.floor(direct);
        }
        const inMap = Number(this.levelData?.map?.spider);
        if (Number.isFinite(inMap) && inMap > 0) {
            return Math.floor(inMap);
        }
        return 0;
    }

    getSpiderSpeedForLevel() {
        const direct = Number(this.levelData?.spiderSpeed);
        if (Number.isFinite(direct) && direct > 0) {
            return direct;
        }
        const inMap = Number(this.levelData?.map?.spiderSpeed);
        if (Number.isFinite(inMap) && inMap > 0) {
            return inMap;
        }
        return Number(CONFIG.spiderSpeed) > 0 ? Number(CONFIG.spiderSpeed) : 100;
    }

    spawnSpidersFromMap() {
        if (!this.spiders) return;
        const requestedCount = this.getSpiderCountForLevel();
        if (requestedCount <= 0) return;

        const spawnPositions = Array.isArray(this.spiderSpawnPositions) ? this.spiderSpawnPositions : [];
        if (!spawnPositions.length) return;

        for (let i = 0; i < requestedCount; i++) {
            const pos = spawnPositions[i % spawnPositions.length];
            if (!pos) continue;
            this.spawnMapSpider(pos.x, pos.y);
        }
    }

    spawnMapSpider(worldX, worldY) {
        if (!this.spiders) return;

        const spiderTextureKey = this.textures.exists('spider') ? 'spider' : 'objects';
        const spiderFrame = spiderTextureKey === 'spider' ? 0 : (OBJECT_FRAMES.spider || 0);
        const spider = this.spiders.create(worldX, worldY, spiderTextureKey, spiderFrame);
        const spiderScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        spider.setScale(spiderScaleFactor);
        spider.setData('baseScale', spiderScaleFactor);
        if (spiderTextureKey === 'spider' && this.anims.exists('spider_float')) {
            spider.play('spider_float');
        }

        if (spider.body) {
            spider.body.setSize(Math.floor(spider.displayWidth || spider.width), Math.floor(spider.displayHeight || spider.height));
            spider.body.setCollideWorldBounds(true);
            spider.body.setBounce(0.3, 0.3);
        }

        spider.setData('speed', this.getSpiderSpeedForLevel());
        spider.setData('lastBitAt', 0);
        spider.setData('gridX', Math.floor((spider.x - (this.mapOffsetX || 0)) / CONFIG.tileSize));
        spider.setData('gridY', Math.floor((spider.y - (this.mapOffsetY || 0)) / CONFIG.tileSize));

        // Velocità iniziale casuale verso il player
        if (this.player) {
            const dx = this.player.x - spider.x;
            const dy = this.player.y - spider.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len > 0) {
                const speed = this.getSpiderSpeedForLevel();
                spider.setVelocity((dx / len) * speed * 0.6, (dy / len) * speed * 0.6);
                this.applyEnemyDirectionalFacing(spider);
            }
        }
    }

    updateSpiders() {
        if (!this.spiders) return;
        const spiders = this.spiders.children?.entries || [];

        spiders.forEach((spider) => {
            if (!spider || !spider.active) return;

            if (spider.texture?.key === 'spider' && this.anims.exists('spider_float')) {
                if (!(spider.anims && spider.anims.isPlaying)) {
                    spider.play('spider_float', true);
                }
            }
            this.applyEnemyDirectionalFacing(spider);

            const speed = Number(spider.getData('speed')) || this.getSpiderSpeedForLevel();
            const now = this.time.now;
            const lastBitAt = Number(spider.getData('lastBitAt')) || 0;

            // Aggiorna la posizione del ragno sulla griglia
            const gridX = Math.floor((spider.x - (this.mapOffsetX || 0)) / CONFIG.tileSize);
            const gridY = Math.floor((spider.y - (this.mapOffsetY || 0)) / CONFIG.tileSize);
            spider.setData('gridX', gridX);
            spider.setData('gridY', gridY);

            // Verifica il tile dove si trova il ragno
            const tile = this.getTileAt(spider.x, spider.y);
            
            // Se il ragno è su un buco, acqua, sabbia o parete, cambia direzione
            if (tile && (tile.type === 'hole' || tile.type === 'hole2' || tile.type === 'water' || tile.type === 'sand' || tile.type === 'wall')) {
                // Cambia direzione casuale
                const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                spider.setVelocity(Math.cos(angle) * speed * 0.5, Math.sin(angle) * speed * 0.5);
                this.applyEnemyDirectionalFacing(spider);
                spider.setData('changeDirectionCooldown', now + 1000);
                return;
            }

            // Se c'è un cooldown di cambio direzione, non fare niente
            const changeDirectionCooldown = Number(spider.getData('changeDirectionCooldown')) || 0;
            if (now < changeDirectionCooldown) return;

            // Movimento ricercativo verso il player
            if (this.player && this.player.active) {
                const playerDist = Phaser.Math.Distance.Between(spider.x, spider.y, this.player.x, this.player.y);
                
                // Se il ragno è abbastanza vicino, cerca il player facendo pathfinding nei 4 tile adiacenti
                if (playerDist < CONFIG.tileSize * 8) {
                    // Prova a muoverti verso il player controllando i tile adiacenti
                    const currentVx = spider.body?.velocity?.x || 0;
                    const currentVy = spider.body?.velocity?.y || 0;

                    const dx = this.player.x - spider.x;
                    const dy = this.player.y - spider.y;
                    const len = Math.sqrt(dx * dx + dy * dy);

                    if (len > 0) {
                        // Direzione verso il player
                        const newVx = (dx / len);
                        const newVy = (dy / len);

                        // Verifica il tile di destinazione
                        const nextX = spider.x + newVx * CONFIG.tileSize;
                        const nextY = spider.y + newVy * CONFIG.tileSize;
                        const nextTile = this.getTileAt(nextX, nextY);

                        // Se il tile di destinazione è valido, muoviti verso il player
                        if (!nextTile || (nextTile.type !== 'hole' && nextTile.type !== 'hole2' && nextTile.type !== 'water' && nextTile.type !== 'sand' && nextTile.type !== 'wall')) {
                            spider.setVelocity(newVx * speed, newVy * speed);
                            this.applyEnemyDirectionalFacing(spider);
                            return;
                        }

                        // Se il percorso diretto è bloccato, prova i tile adiacenti
                        const candidates = [];
                        const directions = [
                            { x: newVx, y:newVy, priority: len },  // preferisci direzione verso player
                            { x: newVy, y: -newVx, priority: len * 0.8 },  // perpendiculare
                            { x: -newVy, y: newVx, priority: len * 0.8 }   // perpendiculare opposto
                        ];

                        directions.forEach(dir => {
                            const testX = spider.x + dir.x * CONFIG.tileSize;
                            const testY = spider.y + dir.y * CONFIG.tileSize;
                            const testTile = this.getTileAt(testX, testY);
                            if (!testTile || (testTile.type !== 'hole' && testTile.type !== 'hole2' && testTile.type !== 'water' && testTile.type !== 'sand' && testTile.type !== 'wall')) {
                                candidates.push({ vx: dir.x, vy: dir.y, priority: dir.priority });
                            }
                        });

                        if (candidates.length > 0) {
                            // Scegli il candidato con priorità più alta
                            const best = candidates.reduce((a, b) => a.priority > b.priority ? a : b);
                            spider.setVelocity(best.vx * speed, best.vy * speed);
                            this.applyEnemyDirectionalFacing(spider);
                            return;
                        }
                    }
                } else {
                    // Se il ragno è lontano dal player, muoviti casualmente ma evita ostacoli
                    const directions = [
                        { x: 1, y: 0 },
                        { x: -1, y: 0 },
                        { x: 0, y: 1 },
                        { x: 0, y: -1 }
                    ];

                    const validDirections = directions.filter(dir => {
                        const testX = spider.x + dir.x * CONFIG.tileSize;
                        const testY = spider.y + dir.y * CONFIG.tileSize;
                        const testTile = this.getTileAt(testX, testY);
                        return !testTile || (testTile.type !== 'hole' && testTile.type !== 'hole2' && testTile.type !== 'water' && testTile.type !== 'sand' && testTile.type !== 'wall');
                    });

                    if (validDirections.length > 0) {
                        const dir = Phaser.Utils.Array.GetRandom(validDirections);
                        spider.setVelocity(dir.x * speed * 0.7, dir.y * speed * 0.7);
                        this.applyEnemyDirectionalFacing(spider);
                    } else {
                        // Se completamente circondato, muoviti in una direzione casuale
                        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
                        spider.setVelocity(Math.cos(angle) * speed * 0.3, Math.sin(angle) * speed * 0.3);
                        this.applyEnemyDirectionalFacing(spider);
                    }
                }
            }
        });
    }

    hitBySpider(player, spider) {
        if (!spider || !spider.active) return;
        if (this.cartPowerActive) return;

        const now = this.time.now;
        const lastBitAt = Number(spider.getData('lastBitAt')) || 0;
        if (now < lastBitAt + 1000) return;  // Cooldown di 1 secondo tra i morsi
        spider.setData('lastBitAt', now);

        // Non rubare gem, solo danno
        this.createBloodSplatter(player?.x, player?.y, 1.9);
        this.showScorePopup(-20, player?.x, player?.y);
        this.addScore(-20, player?.x, player?.y);

        this.loseLife({ player });
    }

    dynamiteHitSpider(dynamite, spider) {
        if (!spider || !spider.active) return;
        this.addScore(20, spider.x, spider.y);
        spider.destroy();
        this.explodeDynamite(dynamite);
    }
};
}
