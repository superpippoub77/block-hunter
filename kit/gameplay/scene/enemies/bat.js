// Nemico: pipistrello.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createEnemiesBatMixin(deps) {
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

return class EnemiesBatMixin {

    spawnMapBat(worldX, worldY) {
        if (!this.bats) return;

        const bat = this.bats.create(worldX, worldY, 'bat', 0);
        const batScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        bat.setScale(batScaleFactor);
        bat.setData('baseScale', batScaleFactor);
        bat.setData('flutterPhase', Phaser.Math.FloatBetween(0, Math.PI * 2));
        if (bat.body) {
            bat.body.setSize(Math.floor(bat.displayWidth || bat.width), Math.floor(bat.displayHeight || bat.height));
            bat.body.setCollideWorldBounds(true);
            bat.body.setBounce(1, 1);
        }
        bat.setData('speed', this.getBatSpeedForLevel());
        bat.setData('nextStealAt', 0);
        // per-level bat rest configuration (defaults)
        const flightsBeforeRest = Number(this.levelConfig?.batFlightsBeforeRest) || 4;
        const restSeconds = Number(this.levelConfig?.batRestSeconds) || 2;
        const restInterval = Number(this.levelConfig?.batRestIntervalSeconds) || 0;
        bat.setData('flightsBeforeRest', flightsBeforeRest);
        bat.setData('restSeconds', restSeconds);
        if (restInterval > 0) bat.setData('restInterval', restInterval);

        // Start with takeoff animation if available, then pick loop based on velocity
        if (bat.anims && this.anims.exists('bat_fly_start')) {
            bat.play('bat_fly_start', true);
            const onStart = (anim) => {
                if (!bat || !bat.active) return;
                if (!anim || anim.key !== 'bat_fly_start') return;
                try { bat.off('animationcomplete', onStart); } catch (e) { }
                this.setBatRandomVelocity(bat);
                try {
                    const vx = bat.body && bat.body.velocity ? (bat.body.velocity.x || 0) : 0;
                    if (vx < 0) {
                        if (this.anims.exists('bat_fly_loop_rev')) bat.play('bat_fly_loop_rev');
                    } else {
                        if (this.anims.exists('bat_fly_loop')) bat.play('bat_fly_loop');
                    }
                } catch (e) { }
            };
            bat.on('animationcomplete', onStart);
        } else {
            this.setBatRandomVelocity(bat);
        }
        // play looping bat sound on spawn and attach to bat
        try {
            if (this.sound && this.sound.add) {
                try {
                    const sfx = this.sound.add('bat_sfx', { loop: true, volume: 0.7 });
                    sfx.play();
                    bat.setData('sfx', sfx);
                    try { bat.on && bat.on('destroy', () => { try { sfx.stop && sfx.stop(); sfx.destroy && sfx.destroy(); } catch (e) { } }); } catch (e) { }
                } catch (e) { }
            }
        } catch (e) { }

        // schedule periodic rest if configured for this level
        if (restInterval > 0) {
            try {
                const t = this.time.delayedCall(restInterval * 1000, () => {
                    if (!bat || !bat.active) return;
                    this.enterBatRest(bat);
                });
                bat.setData('restIntervalTimer', t);
            } catch (e) { }
        }

        if (!this.batDirectionTimer) {
            this.batDirectionTimer = this.time.addEvent({
                delay: 700,
                loop: true,
                callback: () => {
                    const bats = this.bats?.children?.entries || [];
                    bats.forEach((entry) => {
                        if (!entry || !entry.active) return;
                        if (Math.random() < 0.45) {
                            this.setBatRandomVelocity(entry);
                        }
                    });
                }
            });
        }
    }

    setBatRandomVelocity(bat) {
        if (!bat || !bat.active) return;
        if (bat.getData('isResting')) return;

        const speed = Number(bat.getData('speed')) || this.getBatSpeedForLevel();
        const dx = Phaser.Math.FloatBetween(-1, 1);
        const dy = Phaser.Math.FloatBetween(-1, 1);
        const len = Math.hypot(dx, dy) || 1;
        bat.setVelocity((dx / len) * speed, (dy / len) * speed);

        // mirror depending on X velocity
        try {
            const vx = bat.body && bat.body.velocity ? (bat.body.velocity.x || 0) : 0;
            const threshold = 2;
            if (vx < -threshold) bat.setFlipX(true);
            else if (vx > threshold) bat.setFlipX(false);
        } catch (e) { }

        // count flights and possibly enter resting sequence
        let fc = Number(bat.getData('flightCount')) || 0;
        fc++;
        bat.setData('flightCount', fc);
        const flightsBeforeRest = Number(bat.getData('flightsBeforeRest')) || 4;

        // if a per-bat interval is configured, skip flight-count based rest
        if (Number.isFinite(bat.getData('restInterval')) && bat.getData('restInterval') > 0) {
            // ensure correct loop animation
            try {
                const vx = bat.body && bat.body.velocity ? (bat.body.velocity.x || 0) : 0;
                if (vx < 0) {
                    if (this.anims.exists('bat_fly_loop_rev')) bat.play('bat_fly_loop_rev', true);
                } else {
                    if (this.anims.exists('bat_fly_loop')) bat.play('bat_fly_loop', true);
                }
            } catch (e) { }
        } else if (fc >= flightsBeforeRest) {
            this.enterBatRest(bat);
        } else {
            try {
                const vx = bat.body && bat.body.velocity ? (bat.body.velocity.x || 0) : 0;
                if (vx < 0) {
                    if (this.anims.exists('bat_fly_loop_rev')) bat.play('bat_fly_loop_rev', true);
                } else {
                    if (this.anims.exists('bat_fly_loop')) bat.play('bat_fly_loop', true);
                }
            } catch (e) { }
        }

        // Ensure bat rolling/flapping sound is playing while bat is flying
        try {
            if (bat.getData && !bat.getData('isResting')) {
                let sfx = bat.getData && bat.getData('sfx');
                if (!sfx && this.sound && this.sound.add) {
                    try {
                        sfx = this.sound.add('bat_sfx', { loop: true, volume: 0.7 });
                        try { sfx.play(); } catch (e) { }
                        try { bat.setData && bat.setData('sfx', sfx); } catch (e) { }
                        try { bat.on && bat.on('destroy', () => { try { sfx.stop && sfx.stop(); sfx.destroy && sfx.destroy(); } catch (e) { } }); } catch (e) { }
                    } catch (e) { }
                }
            }
        } catch (e) { }
    }

    enterBatRest(bat) {
        if (!bat || !bat.active) return;
        if (bat.getData('isResting')) return;

        try {
            const intTimer = bat.getData('restIntervalTimer');
            if (intTimer && intTimer.remove) intTimer.remove(false);
            bat.setData('restIntervalTimer', null);
        } catch (e) { }

        try { if (bat.anims && bat.anims.isPlaying) bat.anims.stop(); } catch (e) { }
        try { bat.off && bat.off('animationcomplete'); } catch (e) { }

        const doRestComplete = () => {
            if (!bat || !bat.active) return;
            try { if (bat.anims && bat.anims.isPlaying) bat.anims.stop(); } catch (e) { }
            try { bat.setVelocity(0, 0); } catch (e) { }
            try { bat.setFrame(0); } catch (e) { }
            bat.setData('isResting', true);

            // stop bat sound while resting
            try {
                const sfx = bat.getData && bat.getData('sfx');
                if (sfx) {
                    try { sfx.stop && sfx.stop(); } catch (e) { }
                    try { sfx.destroy && sfx.destroy(); } catch (e) { }
                    bat.setData('sfx', null);
                }
            } catch (e) { }

            const restSeconds = Number(bat.getData('restSeconds')) || 2;
            const t = this.time.delayedCall(restSeconds * 1000, () => {
                if (!bat || !bat.active) return;
                bat.setData('isResting', false);
                bat.setData('flightCount', 0);

                if (this.anims.exists('bat_fly_start')) {
                    const onStartResume = (anim2) => {
                        if (!anim2 || anim2.key !== 'bat_fly_start') return;
                        try { bat.off('animationcomplete', onStartResume); } catch (e) { }
                        this.setBatRandomVelocity(bat);
                        try {
                            const vx2 = bat.body && bat.body.velocity ? (bat.body.velocity.x || 0) : 0;
                            if (vx2 < 0) {
                                if (this.anims.exists('bat_fly_loop_rev')) bat.play('bat_fly_loop_rev');
                            } else {
                                if (this.anims.exists('bat_fly_loop')) bat.play('bat_fly_loop');
                            }
                        } catch (e) { }
                        try {
                            const restInterval = Number(bat.getData('restInterval'));
                            if (Number.isFinite(restInterval) && restInterval > 0) {
                                const t2 = this.time.delayedCall(restInterval * 1000, () => {
                                    if (!bat || !bat.active) return;
                                    this.enterBatRest(bat);
                                });
                                bat.setData('restIntervalTimer', t2);
                            }
                        } catch (e) { }
                        // restart bat sound if missing
                        try {
                            const sfx2 = bat.getData && bat.getData('sfx');
                            if (!sfx2 && this.sound && this.sound.add) {
                                const sfxNew = this.sound.add('bat_sfx', { loop: true, volume: 0.7 });
                                sfxNew.play();
                                bat.setData('sfx', sfxNew);
                                try { bat.on && bat.on('destroy', () => { try { sfxNew.stop && sfxNew.stop(); sfxNew.destroy && sfxNew.destroy(); } catch (e) { } }); } catch (e) { }
                            }
                        } catch (e) { }
                    };
                    bat.play('bat_fly_start', true);
                    bat.on('animationcomplete', onStartResume);
                } else {
                    this.setBatRandomVelocity(bat);
                    try {
                        const restInterval = Number(bat.getData('restInterval'));
                        if (Number.isFinite(restInterval) && restInterval > 0) {
                            const t2 = this.time.delayedCall(restInterval * 1000, () => {
                                if (!bat || !bat.active) return;
                                this.enterBatRest(bat);
                            });
                            bat.setData('restIntervalTimer', t2);
                        }
                    } catch (e) { }
                }
            });
            bat.setData('restTimer', t);
        };

        if (this.anims.exists('bat_stop')) {
            const onStop = (anim) => {
                if (!anim || anim.key !== 'bat_stop') return;
                try { bat.off('animationcomplete', onStop); } catch (e) { }
                doRestComplete();
            };
            bat.play('bat_stop', true);
            bat.on('animationcomplete', onStop);
        } else {
            try { bat.setVelocity(0, 0); } catch (e) { }
            doRestComplete();
        }
    }

    startBatGemCarryAndDrop(bat) {
        if (!bat || !bat.active) {
            this.respawnStolenGemInMap(this.player?.x, this.player?.y);
            return;
        }

        this.releaseBatCarriedGem(bat, false);

        const gemScaleFactor = (CONFIG.objectSize / OBJECT_NATIVE_SIZE) * 0.62;
        const carriedGem = this.add.sprite(bat.x, bat.y, 'objects', OBJECT_FRAMES.gem);
        carriedGem.setScale(gemScaleFactor);
        carriedGem.setAlpha(0.92);
        carriedGem.setDepth((bat.depth || 0) + 2);

        bat.setData('carriedGemSprite', carriedGem);
        bat.setData('carriedGemDropping', false);
        bat.setData('carriedGemOffsetX', Phaser.Math.Between(-8, 8));
        bat.setData('carriedGemOffsetY', Phaser.Math.Between(-18, -10));

        const dropDelay = Phaser.Math.Between(1200, 2400);
        const dropTimer = this.time.delayedCall(dropDelay, () => {
            if (!bat || !bat.active) {
                if (carriedGem && carriedGem.active) {
                    carriedGem.destroy();
                }
                this.respawnStolenGemInMap(this.player?.x, this.player?.y);
                return;
            }

            const rawTileX = Math.floor((bat.x - this.mapOffsetX) / CONFIG.tileSize);
            const rawTileY = Math.floor((bat.y - this.mapOffsetY) / CONFIG.tileSize);
            const tileX = Phaser.Math.Clamp(rawTileX, 0, this.mapCols - 1);
            const tileY = Phaser.Math.Clamp(rawTileY, 0, this.mapRows - 1);
            const tileType = this.tiles?.[tileY]?.[tileX]?.type;
            const canDropHere = tileType === 'floor' || tileType === 'empty';

            const dropPos = canDropHere
                ? { x: bat.x, y: bat.y }
                : null;

            const fallbackTile = !dropPos ? this.getRandomWalkableTile() : null;
            const dropX = dropPos
                ? dropPos.x
                : (fallbackTile
                    ? this.mapOffsetX + fallbackTile.x * CONFIG.tileSize + CONFIG.tileSize / 2
                    : bat.x);
            const dropY = dropPos
                ? dropPos.y
                : (fallbackTile
                    ? this.mapOffsetY + fallbackTile.y * CONFIG.tileSize + CONFIG.tileSize / 2
                    : bat.y);

            bat.setData('carriedGemDropping', true);
            this.tweens.add({
                targets: carriedGem,
                x: dropX,
                y: dropY,
                scale: gemScaleFactor * 0.95,
                alpha: 1,
                duration: 260,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    if (carriedGem && carriedGem.active) {
                        carriedGem.destroy();
                    }
                    bat.setData('carriedGemSprite', null);
                    bat.setData('carriedGemDropping', false);
                    bat.setData('carriedGemDropTimer', null);
                    this.createGemPickupAt(dropX, dropY);
                }
            });
        });

        bat.setData('carriedGemDropTimer', dropTimer);
    }

    releaseBatCarriedGem(bat, dropToMap = true) {
        if (!bat) return;

        const dropTimer = bat.getData('carriedGemDropTimer');
        if (dropTimer && dropTimer.remove) {
            dropTimer.remove(false);
        }

        const carriedGem = bat.getData('carriedGemSprite');
        if (carriedGem && carriedGem.active) {
            if (dropToMap) {
                this.createGemPickupAt(bat.x, bat.y);
            }
            carriedGem.destroy();
        }

        bat.setData('carriedGemSprite', null);
        bat.setData('carriedGemDropping', false);
        bat.setData('carriedGemDropTimer', null);
    }

    updateBatPerspective() {
        const bats = this.bats?.children?.entries || [];
        if (!bats.length) return;

        const worldTop = this.mapOffsetY;
        const worldHeight = Math.max(1, this.mapRows * CONFIG.tileSize);
        const timeNow = this.time?.now || 0;

        bats.forEach((bat) => {
            if (!bat || !bat.active) return;

            const baseScale = Number(bat.getData('baseScale')) || (CONFIG.objectSize / OBJECT_NATIVE_SIZE);
            const phase = Number(bat.getData('flutterPhase')) || 0;
            const yNorm = Phaser.Math.Clamp((bat.y - worldTop) / worldHeight, 0, 1);

            const perspectiveScale = Phaser.Math.Linear(0.74, 1.22, yNorm);
            const flutterMul = 1 + Math.sin((timeNow / 230) + phase) * 0.04;
            bat.setScale(baseScale * perspectiveScale * flutterMul);

            const carriedGem = bat.getData('carriedGemSprite');
            const isDropping = !!bat.getData('carriedGemDropping');
            if (carriedGem && carriedGem.active) {
                if (!isDropping) {
                    const offX = Number(bat.getData('carriedGemOffsetX')) || 0;
                    const offY = Number(bat.getData('carriedGemOffsetY')) || -14;
                    carriedGem.setPosition(bat.x + offX, bat.y + offY);
                }
                carriedGem.setDepth((bat.depth || 0) + 2);
            }
        });
    }

    getBatCountForLevel() {
        const direct = Number(this.levelData?.bat);
        if (Number.isFinite(direct) && direct > 0) {
            return Math.floor(direct);
        }
        const inMap = Number(this.levelData?.map?.bat);
        if (Number.isFinite(inMap) && inMap > 0) {
            return Math.floor(inMap);
        }
        return 0;
    }

    getBatSpeedForLevel() {
        const direct = Number(this.levelData?.batSpeed);
        if (Number.isFinite(direct) && direct > 0) {
            return direct;
        }
        const inMap = Number(this.levelData?.map?.batSpeed);
        if (Number.isFinite(inMap) && inMap > 0) {
            return inMap;
        }
        return Number(CONFIG.batSpeed) > 0 ? Number(CONFIG.batSpeed) : 90;
    }

    spawnBatsFromMap() {
        if (!this.bats) return;
        const requestedCount = this.getBatCountForLevel();
        if (requestedCount <= 0) return;

        const spawnPositions = Array.isArray(this.batSpawnPositions) ? this.batSpawnPositions : [];
        if (!spawnPositions.length) return;

        for (let i = 0; i < requestedCount; i++) {
            const pos = spawnPositions[i % spawnPositions.length];
            if (!pos) continue;
            this.spawnMapBat(pos.x, pos.y);
        }
    }

    dynamiteHitBat(dynamite, bat) {
        if (!bat || !bat.active) return;
        this.releaseBatCarriedGem(bat, true);
        this.addScore(12, bat.x, bat.y);
        if (this.levelStats) {
            this.levelStats.batsCaught = (Number(this.levelStats.batsCaught) || 0) + 1;
        }
        try {
            const sfx = bat.getData && bat.getData('sfx');
            if (sfx) {
                try { sfx.stop && sfx.stop(); } catch (e) { }
                try { sfx.destroy && sfx.destroy(); } catch (e) { }
            }
        } catch (e) { }
        bat.destroy();
        this.explodeDynamite(dynamite);
    }

    hitByBat(player, bat) {
        if (!bat || !bat.active) return;
        if (this.cartPowerActive) return;

        const now = this.time.now;
        const nextStealAt = Number(bat.getData('nextStealAt')) || 0;
        if (now < nextStealAt) return;
        bat.setData('nextStealAt', now + 1000);

        this.createBloodSplatter(player?.x, player?.y, 1.9);

        const batAlreadyCarryingGem = !!bat.getData('carriedGemSprite');
        if ((Number(this.playerGemStock) || 0) > 0 && !batAlreadyCarryingGem) {
            this.playerGemStock = Math.max(0, (Number(this.playerGemStock) || 0) - 1);
            this.gemsRemaining = (Number(this.gemsRemaining) || 0) + 1;
            this.startBatGemCarryAndDrop(bat);
            this.showScorePopup(-1, player?.x, player?.y);
            return;
        }

        this.loseLife({ player });
    }
};
}
