// Dinamite: lancio ed esplosione.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createDynamiteMixin(deps) {
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

return class DynamiteMixin {

    shootDynamite() {
        if (GAME_STATE.dynamiteCount <= 0) return;
        if (this.time.now - this.lastDynamiteTime < 300) return;

        GAME_STATE.dynamiteCount--;
        this.lastDynamiteTime = this.time.now;

        const dirX = this.lastMoveDir?.x ?? 1;
        const dirY = this.lastMoveDir?.y ?? 0;
        const baseSpeed = CONFIG.dynamiteSpeed;
        const launchSpeed = baseSpeed * 1.45;
        const cruiseSpeed = baseSpeed * 0.72;
        const dynamiteDisplaySize = Number(CONFIG.dynamiteSize) > 0
            ? Number(CONFIG.dynamiteSize)
            : Math.max(8, Math.round((Number(CONFIG.objectSize) || OBJECT_NATIVE_SIZE) * 0.6));

        // Use dynamite projectile sprite from objects.png (frame 0)
        const dynamite = this.dynamites.create(this.player.x, this.player.y, 'objects', OBJECT_FRAMES.dynamite_projectile);
        dynamite.setDisplaySize(dynamiteDisplaySize * 1.12, dynamiteDisplaySize * 1.12);
        this.tweens.add({
            targets: dynamite,
            displayWidth: dynamiteDisplaySize,
            displayHeight: dynamiteDisplaySize,
            duration: 260,
            ease: 'Quad.easeOut'
        });
        // Keep dynamite at original sprite size; update physics body if present
        if (dynamite.body) {
            dynamite.body.setSize(Math.floor(dynamite.displayWidth || dynamite.width), Math.floor(dynamite.displayHeight || dynamite.height));
            dynamite.body.onWorldBounds = true;
        }
        dynamite.setVelocity(dirX * launchSpeed, dirY * launchSpeed);
        dynamite.setDamping(true);
        dynamite.setDrag(baseSpeed * 2.4, baseSpeed * 2.4);
        // companion dynamite also should not bounce
        try { dynamite.setBounce(0, 0); } catch (e) {}
        dynamite.setCollideWorldBounds(true);
        if (dynamite.body) {
            dynamite.body.onWorldBounds = true;
        }

        // Throw feeling: starts fast then slows down (small parabola-like launch feel)
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

        // Subtle oscillating rotation while flying
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

        if (this.companionSprite && this.companionSprite.active) {
            this.shootCompanionDynamite(dirX, dirY, dynamiteDisplaySize, baseSpeed, launchSpeed, cruiseSpeed);
        }
    }

    explodeDynamite(dynamite) {
                OBJECT_FRAMES.skeleton

        const smokeTrailEvent = dynamite.getData('smokeTrailEvent');
        if (smokeTrailEvent && smokeTrailEvent.remove) {
            smokeTrailEvent.remove(false);
        }

        // Create explosion effect using explosion sprite from objects.png (frame 15)
        const explosion = this.add.sprite(dynamite.x, dynamite.y, 'objects', OBJECT_FRAMES.explosion);
        const explosionScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        explosion.setScale(explosionScaleFactor);
        if (this.sound) {
            this.sound.play('explosion_sfx', { volume: 0.6 });
        }
        // Keep explosion sprite at original size; tween will scale it up visually
        this.tweens.add({
            targets: explosion,
            scale: 2,
            alpha: 0,
            duration: 300,
            onComplete: () => explosion.destroy()
        });

        dynamite.destroy();

        // Slow player if inside explosion radius
        this.applyExplosionSlow(explosion.x, explosion.y);
        this.revealHiddenMapObjects(explosion.x, explosion.y, CONFIG.tileSize * 0.95);
    }

    bounceAndExplode(dynamite) {
        if (!dynamite || !dynamite.active) return;
        if (dynamite.getData('bounceExplode')) return;
        dynamite.setData('bounceExplode', true);
        // Immediately explode at current position (no bounce/hop)
        try { this.explodeDynamite(dynamite); } catch (e) { }
    }

    applyExplosionSlow(x, y) {
        if (!this.player || !this.player.active) return;
        const radius = CONFIG.tileSize * 1.5;
        const dist = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
        if (dist > radius) return;

        this.playerSlowFactor = 0.5;
        if (this.playerSlowTimer) {
            this.playerSlowTimer.remove();
        }
        this.playerSlowTimer = this.time.delayedCall(800, () => {
            this.playerSlowFactor = 1;
        });
    }
};
}
