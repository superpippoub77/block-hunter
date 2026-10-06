// Oggetti: gemme, chiavi, porte, raccolta.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createItemsMixin(deps) {
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

return class ItemsMixin {

    spawnGem() {
        if (this.gemsRemaining <= 0) {
            return;
        }
        let worldX;
        let worldY;
        let gemEffects = [];
        let gemEffectOptions = {};

        if (this.mapGemPositions && this.mapGemPositions.length > 0) {
            const next = this.mapGemPositions[this.mapGemIndex];
            if (!next) {
                return;
            }
            worldX = next.x;
            worldY = next.y;
            gemEffects = Array.isArray(next.effects) ? next.effects : [];
            gemEffectOptions = (next.effectOptions && typeof next.effectOptions === 'object' && !Array.isArray(next.effectOptions))
                ? next.effectOptions
                : {};
        } else {
            let x, y, attempts = 0;
            do {
                x = Phaser.Math.Between(2, this.mapCols - 3);
                y = Phaser.Math.Between(2, this.mapRows - 3);
                attempts++;
            } while (this.tiles[y][x].type !== 'floor' && this.tiles[y][x].type !== 'empty' && attempts < 100);

            worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
            worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;
        }

        this.createGemPickupAt(worldX, worldY, gemEffects, gemEffectOptions);

        if (this.mapGemPositions && this.mapGemPositions.length > 0) {
            this.mapGemIndex++;
        }
    }

    createGemPickupAt(worldX, worldY, effects = [], effectOptions = null) {
        if (!this.gems) return null;

        const gem = this.gems.create(worldX, worldY, 'objects', OBJECT_FRAMES.gem);
        const gemScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        gem.setScale(gemScaleFactor);
        if (gem.body) {
            gem.body.setSize(Math.floor(gem.displayWidth || gem.width), Math.floor(gem.displayHeight || gem.height));
        }

        this.tweens.add({
            targets: gem,
            // keeps the per-object size set in the level editor (transform{scale})
            scale: 1.2 * (Number(effectOptions?.transform?.scale) > 0 ? Number(effectOptions.transform.scale) : 1),
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        try { this.applyTokenEffects(gem, effects, worldX, worldY, effectOptions); } catch (e) { }

        return gem;
    }

    respawnStolenGemInMap(avoidX, avoidY) {
        const tile = this.getRandomWalkableTile();
        let worldX;
        let worldY;

        if (tile) {
            worldX = this.mapOffsetX + tile.x * CONFIG.tileSize + CONFIG.tileSize / 2;
            worldY = this.mapOffsetY + tile.y * CONFIG.tileSize + CONFIG.tileSize / 2;
        } else {
            worldX = Number.isFinite(Number(avoidX)) ? Number(avoidX) : (this.player?.x || 0);
            worldY = Number.isFinite(Number(avoidY)) ? Number(avoidY) : (this.player?.y || 0);
        }

        this.createGemPickupAt(worldX, worldY);
    }

    spawnKey() {
        const x = Phaser.Math.Between(2, this.mapCols - 3);
        const y = Phaser.Math.Between(2, this.mapRows - 3);

        const worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;

        // Use key sprite from objects.png (frame 8)
        const keySprite = this.items.create(worldX, worldY, 'objects', OBJECT_FRAMES.key);
        // Keep key at original size
        if (keySprite.body) {
            keySprite.body.setSize(Math.floor(keySprite.displayWidth || keySprite.width), Math.floor(keySprite.displayHeight || keySprite.height));
        }
        const keyScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        keySprite.setScale(keyScaleFactor);
        if (keySprite.body) {
            keySprite.body.setSize(Math.floor(keySprite.displayWidth || keySprite.width), Math.floor(keySprite.displayHeight || keySprite.height));
        }
        keySprite.setData('type', 'key');
        this.applyKeyFloatingEffect(keySprite);
        this.lastKeyPos = { x: worldX, y: worldY };
    }

    spawnKeyAt(x, y) {
        const keySprite = this.items.create(x, y, 'objects', OBJECT_FRAMES.key);
        // Keep key at original size
        if (keySprite.body) {
            keySprite.body.setSize(Math.floor(keySprite.displayWidth || keySprite.width), Math.floor(keySprite.displayHeight || keySprite.height));
        }
        const keyScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        keySprite.setScale(keyScaleFactor);
        if (keySprite.body) {
            keySprite.body.setSize(Math.floor(keySprite.displayWidth || keySprite.width), Math.floor(keySprite.displayHeight || keySprite.height));
        }
        keySprite.setData('type', 'key');
        this.applyKeyFloatingEffect(keySprite);
        this.lastKeyPos = { x, y };
    }

    applyKeyFloatingEffect(keySprite) {
        if (!keySprite || !keySprite.active || !this.tweens) return;
        this.tweens.add({
            targets: keySprite,
            y: keySprite.y - Math.max(4, Math.round(CONFIG.tileSize * 0.12)),
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    collectGem(player, gem) {
        if (this.sound) {
            this.sound.play('gem_sfx', { volume: 0.45 });
        }
        gem.destroy();
        this.addScore(50, gem.x, gem.y);
        this.playerGemStock = (Number(this.playerGemStock) || 0) + 1;
        if (this.levelStats) {
            this.levelStats.gemsCollected = (Number(this.levelStats.gemsCollected) || 0) + 1;
        }
        this.checkAndShowLevelEvents && this.checkAndShowLevelEvents();

        this.gemsRemaining--;

        // If collecting this gem reached the configured required amount, or if all gems
        // (initially present on the level) have now been collected, unlock the exit(s)
        try {
            const collected = Number(this.levelStats?.gemsCollected) || 0;
            const allCollected = (Number(this.initialGems) || 0) > 0 ? (collected >= Number(this.initialGems)) : (collected >= 0);
            if (!this.exitUnlocked && (collected >= Number(this.requiredGems || 0) || allCollected)) {
                this.activateHole2Exits();
            }
        } catch (e) { /* ignore */ }

        if (this.gemsRemaining > 0) {
            // Only spawn the next gem automatically when configured to show one-by-one
            if (this.gemsOneByOne) {
                this.time.delayedCall(CONFIG.gemSpawnDelay, () => this.spawnGem());
                return;
            }
        }

        // If there are no more gems to spawn, ensure exits are active only when
        // the required amount or the "all collected" condition is met.
        if (!this.exitUnlocked) {
            const collected = Number(this.levelStats?.gemsCollected) || 0;
            const allCollected = (Number(this.initialGems) || 0) > 0 ? (collected >= Number(this.initialGems)) : (collected >= 0);
            if (collected >= Number(this.requiredGems || 0) || allCollected) {
                this.activateHole2Exits();
            }
        }
    }

    collectItem(player, item) {
        const type = item.getData('type');
        const gridX = item.getData('gridX');
        const gridY = item.getData('gridY');

        if (type === 'key') {
            this.addScore(5, item.x, item.y);
            try { if (this.sound) this.sound.play('coin_sfx', { volume: 0.45 }); } catch (e) { }
            // Award key to the collecting player in 2-player mode, otherwise to global inventory
            if (Number(GAME_STATE.players) === 2) {
                if (player === this.player) {
                    GAME_STATE.keysP1 = (Number(GAME_STATE.keysP1) || 0) + 1;
                } else if (player === this.player2) {
                    GAME_STATE.keysP2 = (Number(GAME_STATE.keysP2) || 0) + 1;
                } else {
                    GAME_STATE.keysCount = (Number(GAME_STATE.keysCount) || 0) + 1;
                }
            } else {
                GAME_STATE.keysCount = (Number(GAME_STATE.keysCount) || 0) + 1;
            }
            this.lastKeyPos = { x: item.x, y: item.y };
            if (this.levelStats) {
                this.levelStats.keysCollected = (Number(this.levelStats.keysCollected) || 0) + 1;
            }
        } else if (type === 'dynamite') {
            GAME_STATE.dynamiteCount += 5;
        } else if (type === 'helmet') {
            this.addScore(10, item.x, item.y);
            this.activateHelmet(10000);
        } else if (type === 'pepita' || type === 'heart') {
            // award life to the collecting player when in 2-player mode
            if (Number(GAME_STATE.players) === 2) {
                if (player === this.player) {
                    GAME_STATE.livesP1 = (Number(GAME_STATE.livesP1) || 0) + 1;
                } else if (player === this.player2) {
                    GAME_STATE.livesP2 = (Number(GAME_STATE.livesP2) || 0) + 1;
                } else {
                    GAME_STATE.lives = (Number(GAME_STATE.lives) || 0) + 1;
                }
            } else {
                GAME_STATE.lives = (Number(GAME_STATE.lives) || 0) + 1;
            }
            if (this.levelStats) {
                this.levelStats.pepitasCollected = (Number(this.levelStats.pepitasCollected) || 0) + 1;
            }
        } else if (type === 'cart') {
            this.activateCartPowerup(10000);
        } else if (type === 'skeleton') {
            this.addScore(20, item.x, item.y);
            this.activateCompanionHelper(20000);
        }

        else if (type === 'wooden') {
            // Wooden plank pickup: increase plank count (per-player in 2-player mode)
            this.addScore(5, item.x, item.y);
            if (Number(GAME_STATE.players) === 2) {
                if (player === this.player) {
                    GAME_STATE.woodenP1 = (Number(GAME_STATE.woodenP1) || 0) + 1;
                } else if (player === this.player2) {
                    GAME_STATE.woodenP2 = (Number(GAME_STATE.woodenP2) || 0) + 1;
                } else {
                    GAME_STATE.woodenCount = (Number(GAME_STATE.woodenCount) || 0) + 1;
                }
            } else {
                GAME_STATE.woodenCount = (Number(GAME_STATE.woodenCount) || 0) + 1;
            }
            if (this.levelStats) {
                this.levelStats.woodenCollected = (Number(this.levelStats.woodenCollected) || 0) + 1;
            }
            this.onPlankCollected();
        }

        item.destroy();
        this.revealHiddenAtGrid(gridX, gridY);
    }

    tryOpenDoor(player, door) {
        if (!door || !door.active) return;
        if (door.getData('opening')) return;
        if (!door.getData('locked')) return;
        // Determine keys count for this player (support per-player inventories)
        const playersCount = Number(GAME_STATE.players) || 1;
        if (playersCount === 2) {
            if (player === this.player) {
                if ((Number(GAME_STATE.keysP1) || 0) <= 0) return;
                GAME_STATE.keysP1 = Math.max(0, (Number(GAME_STATE.keysP1) || 0) - 1);
            } else if (player === this.player2) {
                if ((Number(GAME_STATE.keysP2) || 0) <= 0) return;
                GAME_STATE.keysP2 = Math.max(0, (Number(GAME_STATE.keysP2) || 0) - 1);
            } else {
                if ((Number(GAME_STATE.keysCount) || 0) <= 0) return;
                GAME_STATE.keysCount = Math.max(0, (Number(GAME_STATE.keysCount) || 0) - 1);
            }
        } else {
            if ((Number(GAME_STATE.keysCount) || 0) <= 0) return;
            GAME_STATE.keysCount = Math.max(0, (Number(GAME_STATE.keysCount) || 0) - 1);
        }
        door.setData('opening', true);
        door.setData('locked', false);
        try {
            // Replace door visually with hole1 frame while opened (row 4, col 2)
            if (typeof door.setFrame === 'function') {
                door.setFrame(OBJECT_FRAMES.hole1);
            }
            if (door.body) {
                // disable collisions while open
                try { door.body.enable = false; } catch (e) { }
            }
            if (door.disableBody) {
                try { door.disableBody(true, true); } catch (e) { }
            }
        } catch (e) { }

        // Respawn key and re-close door after 10 seconds
        this.time.delayedCall(10000, () => {
            if (!door) return;
            try {
                // Restore door frame and re-enable collisions when re-closing
                if (typeof door.setFrame === 'function') {
                    door.setFrame(OBJECT_FRAMES.door);
                }
                if (door.enableBody) {
                    door.enableBody(false, door.x, door.y, true, true);
                    if (door.refreshBody) {
                        door.refreshBody();
                    }
                } else {
                    door.setVisible(true);
                    if (door.body) {
                        try { door.body.enable = true; } catch (e) { }
                    }
                }
                door.setData('locked', true);
                door.setData('opening', false);
            } catch (e) { }

            this.respawnKey();
        });
    }

    respawnKey() {
        // Avoid multiple keys on the field
        const existingKey = this.items?.children?.entries?.find((item) => item?.getData('type') === 'key');
        if (existingKey) return;

        if (this.lastKeyPos) {
            this.spawnKeyAt(this.lastKeyPos.x, this.lastKeyPos.y);
            return;
        }

        if (this.keySpawnPositions && this.keySpawnPositions.length > 0) {
            const pos = this.keySpawnPositions[0];
            this.spawnKeyAt(pos.x, pos.y);
            return;
        }

        const tile = this.getRandomWalkableTile();
        if (!tile) return;
        const worldX = this.mapOffsetX + tile.x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + tile.y * CONFIG.tileSize + CONFIG.tileSize / 2;
        this.spawnKeyAt(worldX, worldY);
    }

    spawnDoor() {
        const side = Phaser.Math.Between(0, 3);
        let x, y;

        if (side === 0) { x = this.mapCols - 1; y = Math.floor(this.mapRows / 2); }
        else if (side === 1) { x = 0; y = Math.floor(this.mapRows / 2); }
        else if (side === 2) { x = Math.floor(this.mapCols / 2); y = this.mapRows - 1; }
        else { x = Math.floor(this.mapCols / 2); y = 0; }

        const worldX = this.mapOffsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;

        // Use door sprite from objects.png (frame 5)
        const door = this.doors.create(worldX, worldY, 'objects', OBJECT_FRAMES.door);
        this.setupDoor(door);
    }

    setupDoor(door) {
        if (!door) return;
        // Apply object size (pixels) converted to scale factor to door
        const doorScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        door.setScale(doorScaleFactor);
        door.setData('locked', true);
        door.setData('opening', false);
        if (door.body) {
            door.body.setSize(Math.floor(door.displayWidth || door.width), Math.floor(door.displayHeight || door.height));
        }
        if (door.refreshBody) {
            door.refreshBody();
        }
    }

    checkDoorProximity() {
        if (!this.doors || !this.player) return;
        const doors = this.doors.children?.entries || [];
        // Do not auto-open doors; require pressing the configured 'action' button.
        for (const door of doors) {
            try { if (!door || !door.active) continue; } catch (e) { continue; }
            // reset proximity flags for both players
            try { door.setData && door.setData('playerNearbyP1', false); } catch (e) { }
            try { door.setData && door.setData('playerNearbyP2', false); } catch (e) { }
            if (!door.getData('locked')) continue;
            if (door.getData('opening')) continue;

            // Player 1 proximity & key check
            try {
                const hasKeyP1 = (Number(GAME_STATE.players) === 2) ? ((Number(GAME_STATE.keysP1) || 0) > 0) : ((Number(GAME_STATE.keysCount) || 0) > 0);
                if (hasKeyP1 && this.player) {
                    const dist1 = Phaser.Math.Distance.Between(this.player.x, this.player.y, door.x, door.y);
                    if (dist1 <= CONFIG.tileSize * 1.1) {
                        try { door.setData && door.setData('playerNearbyP1', true); } catch (e) { }
                    }
                }
            } catch (e) { }

            // Player 2 proximity & key check (if present)
            try {
                if (this.player2) {
                    const hasKeyP2 = (Number(GAME_STATE.keysP2) || 0) > 0;
                    if (hasKeyP2) {
                        const dist2 = Phaser.Math.Distance.Between(this.player2.x, this.player2.y, door.x, door.y);
                        if (dist2 <= CONFIG.tileSize * 1.1) {
                            try { door.setData && door.setData('playerNearbyP2', true); } catch (e) { }
                        }
                    }
                }
            } catch (e) { }
        }
    }

    onPlayerDoorCollide(player, door) {
        // Do not auto-open on collision; opening must be triggered by pressing 'action' when nearby.
        try { if (door && door.setData) door.setData('playerNearby', true); } catch (e) { }
    }
};
}
