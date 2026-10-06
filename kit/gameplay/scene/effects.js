// Effetti: effetti dei token, luce/torcia, esplosioni, polvere, sangue, scie di fumo.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createEffectsMixin(deps) {
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

return class EffectsMixin {

    normalizeEffectName(rawName) {
        const aliases = {
            light: 'lamp',
            flicker: 'lamp',
            flicker_light: 'lamp',
            glow: 'halo',
            bob: 'float'
        };
        const known = new Set(['lamp', 'pulse', 'float', 'halo', 'outline']);
        const k = String(rawName || '').trim().toLowerCase().replace(/[^a-z0-9_\-]/g, '');
        if (!k) return null;
        const normalized = aliases[k] || k;
        return known.has(normalized) ? normalized : null;
    }

    normalizeTokenEffects(rawEffects) {
        if (!Array.isArray(rawEffects)) return [];
        const out = [];

        rawEffects.forEach((entry) => {
            const normalized = this.normalizeEffectName(entry);
            if (!normalized) return;
            if (!out.includes(normalized)) out.push(normalized);
        });

        return out;
    }

    parseEffectColor(value, fallback = 0xffffff) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        const text = String(value ?? '').trim();
        if (!text) return fallback;

        if (/^0x[0-9a-f]{6}$/i.test(text)) {
            const parsed = Number(text);
            return Number.isFinite(parsed) ? parsed : fallback;
        }
        if (/^#[0-9a-f]{6}$/i.test(text)) {
            const parsed = parseInt(text.slice(1), 16);
            return Number.isFinite(parsed) ? parsed : fallback;
        }
        return fallback;
    }

    getGeneralEffectsConfig() {
        const raw = this.levelData && this.levelData.effects;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
        const general = raw.general;
        if (!general || typeof general !== 'object' || Array.isArray(general)) return {};
        return general;
    }

    getLevelEffectsConfig() {
        const raw = this.levelData && this.levelData.effects;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

        const objects = raw.objects;
        if (objects && typeof objects === 'object' && !Array.isArray(objects)) {
            return objects;
        }

        // Backward compatibility: old schema had object effects directly under `effects`
        if (raw.general || raw.objects) return {};
        return raw;
    }

    getEffectOptions(effectName) {
        const cfg = this.getLevelEffectsConfig();
        const options = cfg && cfg[effectName];
        if (!options || typeof options !== 'object' || Array.isArray(options)) return {};
        return options;
    }

    readEffectNumber(options, keys, fallback, min = null, max = null) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        let picked = fallback;
        for (const key of keyList) {
            if (!key) continue;
            const value = Number(options && options[key]);
            if (Number.isFinite(value)) {
                picked = value;
                break;
            }
        }
        if (Number.isFinite(min)) picked = Math.max(min, picked);
        if (Number.isFinite(max)) picked = Math.min(max, picked);
        return picked;
    }

    isEffectEnabled(options) {
        const raw = options && options.enabled;
        if (typeof raw === 'boolean') return raw;
        if (typeof raw === 'string') return raw.toLowerCase() !== 'false';
        return true;
    }

    registerEffectFollower(target, follower, offsetX = 0, offsetY = 0) {
        if (!target || !follower) return;
        if (!Array.isArray(this.effectFollowers)) this.effectFollowers = [];
        this.effectFollowers.push({ target, follower, offsetX, offsetY });
    }

    updateEffectFollowers() {
        if (!Array.isArray(this.effectFollowers) || !this.effectFollowers.length) return;
        this.effectFollowers = this.effectFollowers.filter((link) => {
            const target = link?.target;
            const follower = link?.follower;
            if (!target || !follower || !target.active || !follower.active) {
                try { follower?.destroy?.(); } catch (e) { }
                return false;
            }
            try {
                follower.setPosition((target.x || 0) + (Number(link.offsetX) || 0), (target.y || 0) + (Number(link.offsetY) || 0));
            } catch (e) {
                return false;
            }
            return true;
        });
    }

    applyTokenEffects(target, rawEffects, worldX = null, worldY = null, rawEffectOptions = null) {
        const effects = this.normalizeTokenEffects(rawEffects);
        if (!target || !effects.length) return;
        const inlineOptionsMap = (rawEffectOptions && typeof rawEffectOptions === 'object' && !Array.isArray(rawEffectOptions))
            ? rawEffectOptions
            : {};

        const px = Number.isFinite(Number(worldX)) ? Number(worldX) : (target.x || 0);
        const py = Number.isFinite(Number(worldY)) ? Number(worldY) : (target.y || 0);

        effects.forEach((effectName) => {
            try {
                const options = this.getEffectOptions(effectName);
                const localOptions = (inlineOptionsMap[effectName] && typeof inlineOptionsMap[effectName] === 'object' && !Array.isArray(inlineOptionsMap[effectName]))
                    ? inlineOptionsMap[effectName]
                    : {};
                const mergedOptions = { ...options, ...localOptions };
                if (!this.isEffectEnabled(mergedOptions)) return;

                if (effectName === 'pulse') {
                    const pulseScale = this.readEffectNumber(mergedOptions, ['scale', 'scaleMultiplier'], 1.12, 1.01, 4);
                    const pulseDuration = this.readEffectNumber(mergedOptions, ['duration', 'durationMs'], 430, 80, 10000);
                    const baseScaleX = Number(target.scaleX || target.scale || 1) || 1;
                    const baseScaleY = Number(target.scaleY || target.scale || 1) || 1;
                    this.tweens.add({
                        targets: target,
                        scaleX: baseScaleX * pulseScale,
                        scaleY: baseScaleY * pulseScale,
                        duration: pulseDuration,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    return;
                }

                if (effectName === 'float') {
                    const ampPx = this.readEffectNumber(mergedOptions, ['amplitudePixels', 'amplitudePx'], NaN);
                    const ampTiles = this.readEffectNumber(mergedOptions, ['amplitudeTiles'], 0.14, 0.01, 5);
                    const amplitude = Number.isFinite(ampPx)
                        ? Math.max(2, ampPx)
                        : Math.max(4, Math.round((Number(CONFIG.tileSize) || 64) * ampTiles));
                    const floatDuration = this.readEffectNumber(mergedOptions, ['duration', 'durationMs'], 760, 80, 10000);
                    this.tweens.add({
                        targets: target,
                        y: (target.y || py) - amplitude,
                        duration: floatDuration,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    return;
                }

                if (effectName === 'lamp') {
                    const radiusPx = this.readEffectNumber(mergedOptions, ['radiusPixels', 'radiusPx'], NaN);
                    const radiusTiles = this.readEffectNumber(mergedOptions, ['radiusTiles'], 1.2, 0.1, 20);
                    const radius = Number.isFinite(radiusPx)
                        ? Math.max(6, Math.floor(radiusPx))
                        : Math.max(18, Math.floor((Number(CONFIG.tileSize) || 64) * radiusTiles));
                    const color = this.parseEffectColor(mergedOptions.color, 0xffdf8a);
                    const alphaStart = this.readEffectNumber(mergedOptions, ['alpha', 'alphaStart'], 0.14, 0, 1);
                    const alphaMin = this.readEffectNumber(mergedOptions, ['alphaMin'], 0.08, 0, 1);
                    const alphaMax = this.readEffectNumber(mergedOptions, ['alphaMax'], 0.22, 0, 1);
                    const scaleMin = this.readEffectNumber(mergedOptions, ['scaleMin'], 0.93, 0.1, 10);
                    const scaleMax = this.readEffectNumber(mergedOptions, ['scaleMax'], 1.08, 0.1, 10);
                    const durMin = this.readEffectNumber(mergedOptions, ['durationMin', 'durationMinMs'], 240, 30, 10000);
                    const durMax = this.readEffectNumber(mergedOptions, ['durationMax', 'durationMaxMs'], 560, 30, 10000);
                    const depth = this.readEffectNumber(mergedOptions, ['depth'], 8, -5000, 20000);
                    const halo = this.add.circle(px, py, radius, color, alphaStart).setDepth(depth);
                    const addBlend = mergedOptions.addBlend === undefined ? true : !!mergedOptions.addBlend;
                    if (addBlend) {
                        try { halo.setBlendMode(Phaser.BlendModes.ADD); } catch (e) { }
                    }
                    this.tweens.add({
                        targets: halo,
                        alpha: { from: alphaMin, to: alphaMax },
                        scaleX: { from: scaleMin, to: scaleMax },
                        scaleY: { from: scaleMin, to: scaleMax },
                        duration: Phaser.Math.Between(Math.min(durMin, durMax), Math.max(durMin, durMax)),
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    this.registerEffectFollower(target, halo);
                    return;
                }

                if (effectName === 'halo') {
                    const radiusPx = this.readEffectNumber(mergedOptions, ['radiusPixels', 'radiusPx'], NaN);
                    const radiusTiles = this.readEffectNumber(mergedOptions, ['radiusTiles'], 0.7, 0.05, 20);
                    const radius = Number.isFinite(radiusPx)
                        ? Math.max(4, Math.floor(radiusPx))
                        : Math.max(12, Math.floor((Number(CONFIG.tileSize) || 64) * radiusTiles));
                    const color = this.parseEffectColor(mergedOptions.color, 0x8fd4ff);
                    const alpha = this.readEffectNumber(mergedOptions, ['alpha'], 0.16, 0, 1);
                    const depth = this.readEffectNumber(mergedOptions, ['depth'], 9, -5000, 20000);
                    const halo = this.add.circle(px, py, radius, color, alpha).setDepth(depth);
                    const addBlend = mergedOptions.addBlend === undefined ? true : !!mergedOptions.addBlend;
                    if (addBlend) {
                        try { halo.setBlendMode(Phaser.BlendModes.ADD); } catch (e) { }
                    }
                    this.registerEffectFollower(target, halo);
                    return;
                }

                if (effectName === 'outline') {
                    const radiusPx = this.readEffectNumber(mergedOptions, ['radiusPixels', 'radiusPx'], NaN);
                    const radiusTiles = this.readEffectNumber(mergedOptions, ['radiusTiles'], 0.5, 0.05, 20);
                    const radius = Number.isFinite(radiusPx)
                        ? Math.max(4, Math.floor(radiusPx))
                        : Math.max(10, Math.floor((Number(CONFIG.tileSize) || 64) * radiusTiles));
                    const strokeWidth = this.readEffectNumber(mergedOptions, ['thickness', 'strokeWidth'], 2, 1, 20);
                    const strokeColor = this.parseEffectColor(mergedOptions.color, 0xf5f5f5);
                    const strokeAlpha = this.readEffectNumber(mergedOptions, ['strokeAlpha'], 0.65, 0, 1);
                    const alphaMin = this.readEffectNumber(mergedOptions, ['alphaMin'], 0.25, 0, 1);
                    const alphaMax = this.readEffectNumber(mergedOptions, ['alphaMax'], 0.65, 0, 1);
                    const duration = this.readEffectNumber(mergedOptions, ['duration', 'durationMs'], 650, 80, 10000);
                    const depth = this.readEffectNumber(mergedOptions, ['depth'], 11, -5000, 20000);
                    const ring = this.add.circle(px, py, radius, 0x000000, 0).setStrokeStyle(strokeWidth, strokeColor, strokeAlpha).setDepth(depth);
                    this.tweens.add({
                        targets: ring,
                        alpha: { from: alphaMin, to: alphaMax },
                        duration,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                    this.registerEffectFollower(target, ring);
                }
            } catch (e) { }
        });
    }

    setupLevelLightEffect() {
        this.stopLevelLightEffect();

        const generalFx = this.getGeneralEffectsConfig();
        const lightModeRaw = generalFx?.light ?? this.levelData?.light ?? this.levelConfig?.light;
        const lightMode = String(lightModeRaw || '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
        if (!lightMode) {
            return;
        }

        const isOff = lightMode === 'spenta' || lightMode === 'off';
        const isFull = lightMode === 'piena' || lightMode === 'full';
        const isFixed = lightMode === 'fissa' || lightMode === 'fixed';
        const isFlash = lightMode.startsWith('flash') || lightMode.includes('lampo') || lightMode === 'lightning';

        if (isFull) {
            this.isRoomDark = false;
            this.headlampEnabled = false;
            return;
        }

        this.levelLightOverlay = this.add.rectangle(
            CONFIG.width / 2,
            CONFIG.height / 2,
            CONFIG.width,
            CONFIG.height,
            0x000000
        );
        this.levelLightOverlay.setScrollFactor(0);
        this.levelLightOverlay.setDepth(1800);

        if (isOff) {
            this.levelLightOverlay.setAlpha(0.82);
            this.isRoomDark = true;
            this.headlampEnabled = false;
            this.setupHeadlampMask();
            return;
        }

        this.isRoomDark = false;
        this.headlampEnabled = false;

        if (isFixed) {
            this.levelLightOverlay.setAlpha(0.48);
            return;
        }

        if (isFlash) {
            this.levelLightOverlay.setAlpha(0.56);
            this.levelLightTimer = this.time.addEvent({
                delay: 1300,
                loop: true,
                callback: () => {
                    if (!this.levelLightOverlay || !this.levelLightOverlay.active) return;
                    const overlay = this.levelLightOverlay;
                    overlay.setFillStyle(0xffffff, 1);
                    overlay.setAlpha(0);
                    this.tweens.add({
                        targets: overlay,
                        alpha: 0.24,
                        duration: 35,
                        yoyo: true,
                        repeat: 1,
                        ease: 'Linear',
                        onComplete: () => {
                            if (!overlay || !overlay.active) return;
                            overlay.setFillStyle(0x000000, 1);
                            overlay.setAlpha(0.56);
                        }
                    });
                }
            });
            return;
        }

        // Default / 'tremolante'
        this.levelLightOverlay.setAlpha(0.52);
        this.levelLightTimer = this.time.addEvent({
            delay: 120,
            loop: true,
            callback: () => {
                if (!this.levelLightOverlay || !this.levelLightOverlay.active) return;
                const flickerAlpha = Phaser.Math.FloatBetween(0.42, 0.62);
                this.levelLightOverlay.setAlpha(flickerAlpha);
            }
        });
    }

    setupHeadlampMask() {
        if (!this.levelLightOverlay || !this.isRoomDark) return;

        if (this.headlampMaskGraphics) {
            this.headlampMaskGraphics.destroy();
            this.headlampMaskGraphics = null;
        }

        this.headlampMaskGraphics = this.make.graphics({ x: 0, y: 0, add: false });
        this.levelLightMask = this.headlampMaskGraphics.createGeometryMask();
        this.levelLightMask.invertAlpha = true;
        this.levelLightOverlay.setMask(this.levelLightMask);
        this.updateHeadlampCone();
    }

    toggleHeadlamp() {
        if (!this.isRoomDark) return;
        this.headlampEnabled = !this.headlampEnabled;
        this.updateHeadlampCone();
    }

    getHeadlampDirectionVector() {
        const facing = this.playerFacing || 'front';
        if (facing === 'back') return { x: 0, y: -1 };
        if (facing === 'right') return { x: 1, y: 0 };
        if (facing === 'left') return { x: -1, y: 0 };
        if (facing === 'back_right') return { x: 0.707, y: -0.707 };
        if (facing === 'back_left') return { x: -0.707, y: -0.707 };

        const dx = this.lastMoveDir?.x ?? 0;
        const dy = this.lastMoveDir?.y ?? 1;
        const len = Math.hypot(dx, dy) || 1;
        return { x: dx / len, y: dy / len };
    }

    updateHeadlampCone() {
        if (!this.headlampMaskGraphics) return;

        this.headlampMaskGraphics.clear();

        if (!this.headlampEnabled || !this.player || !this.player.active || !this.isRoomDark) {
            return;
        }

        const camera = this.cameras.main;
        const px = this.player.x - camera.worldView.x;
        const py = this.player.y - camera.worldView.y;

        const direction = this.getHeadlampDirectionVector();
        const baseAngle = Math.atan2(direction.y, direction.x);
        const range = CONFIG.tileSize * 4.8;

        // Soft cone gradient: bright center + fading edges
        const drawConeLayer = (halfAngleDeg, rangeMul, alpha) => {
            const halfAngle = Phaser.Math.DegToRad(halfAngleDeg);
            const layerRange = range * rangeMul;
            const points = [{ x: px, y: py }];
            const segments = 22;
            for (let i = 0; i <= segments; i++) {
                const t = i / segments;
                const angle = baseAngle - halfAngle + t * (halfAngle * 2);
                points.push({
                    x: px + Math.cos(angle) * layerRange,
                    y: py + Math.sin(angle) * layerRange
                });
            }
            this.headlampMaskGraphics.fillStyle(0xffffff, alpha);
            this.headlampMaskGraphics.fillPoints(points, true);
        };

        // Outer soft spill
        drawConeLayer(40, 1.0, 0.28);
        // Mid cone
        drawConeLayer(30, 0.93, 0.48);
        // Bright core
        drawConeLayer(18, 0.86, 0.9);

        // Glow near the helmet (center brightest)
        this.headlampMaskGraphics.fillStyle(0xffffff, 1);
        this.headlampMaskGraphics.fillCircle(px, py, Math.max(14, CONFIG.tileSize * 0.62));
        this.headlampMaskGraphics.fillStyle(0xffffff, 0.45);
        this.headlampMaskGraphics.fillCircle(px, py, Math.max(20, CONFIG.tileSize * 0.95));
    }

    stopLevelLightEffect() {
        if (this.levelLightTimer) {
            this.levelLightTimer.remove();
            this.levelLightTimer = null;
        }
        if (this.levelLightOverlay) {
            this.levelLightOverlay.clearMask();
        }
        if (this.headlampMaskGraphics) {
            this.headlampMaskGraphics.destroy();
            this.headlampMaskGraphics = null;
        }
        this.levelLightMask = null;
        this.isRoomDark = false;
        this.headlampEnabled = false;
        if (this.levelLightOverlay) {
            this.levelLightOverlay.destroy();
            this.levelLightOverlay = null;
        }
    }

    createExplosionAt(x, y) {
        const explosion = this.add.sprite(x, y, 'objects', OBJECT_FRAMES.explosion);
        const explosionScaleFactor2 = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
        explosion.setScale(explosionScaleFactor2);
        // Keep explosion sprite at original size; tween will scale it up visually
        this.tweens.add({
            targets: explosion,
            scale: 2,
            alpha: 0,
            duration: 250,
            onComplete: () => explosion.destroy()
        });
        // Optional camera shake to emphasize impact (foreground removed)
        try {
            if (this.cameras && this.cameras.main && CONFIG.enableImpactShake) {
                try { this.cameras.main.shake(160, 0.003); } catch (e) { }
            }
        } catch (e) { }
    }

    createDustPuff(x, y, scale) {
        const puff = this.add.circle(x, y + 6, CONFIG.tileSize * 0.4, 0xD2C2A0, 0.75);
        puff.setBlendMode(Phaser.BlendModes.ADD);
        puff.setDepth(900);
        this.tweens.add({
            targets: puff,
            scale: (scale || 1) * 2.2,
            alpha: 0,
            y: y - 16,
            duration: 320,
            ease: 'Cubic.easeOut',
            onComplete: () => puff.destroy()
        });
    }

    createBloodSplatter(x, y, intensity = 1) {
        const centerX = typeof x === 'number' ? x : (this.player?.x || 0);
        const centerY = typeof y === 'number' ? y : (this.player?.y || 0);
        const intensityMul = Phaser.Math.Clamp(Number(intensity) || 1, 0.5, 3);
        const particleCount = Math.max(8, Math.floor(Phaser.Math.Between(20, 32) * intensityMul));

        for (let i = 0; i < particleCount; i++) {
            const droplet = this.add.circle(
                centerX + Phaser.Math.Between(-12, 12),
                centerY + Phaser.Math.Between(-12, 12),
                Phaser.Math.Between(3, 7),
                Phaser.Utils.Array.GetRandom([0xb30000, 0xcc0000, 0x8a0303]),
                Phaser.Math.FloatBetween(0.78, 1)
            );
            droplet.setDepth(1100);

            const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
            const distance = Phaser.Math.Between(18, 52);

            this.tweens.add({
                targets: droplet,
                x: droplet.x + Math.cos(angle) * distance,
                y: droplet.y + Math.sin(angle) * distance + Phaser.Math.Between(8, 26),
                alpha: 0,
                scale: Phaser.Math.FloatBetween(0.7, 1),
                duration: Phaser.Math.Between(340, 560),
                ease: 'Cubic.easeOut',
                onComplete: () => droplet.destroy()
            });
        }
    }

    attachShardSmokeTrail(shard) {
        if (!shard || !shard.active) return;

        const smokeEvent = this.time.addEvent({
            delay: 55,
            loop: true,
            callback: () => {
                if (!shard || !shard.active) {
                    if (smokeEvent && smokeEvent.remove) {
                        smokeEvent.remove(false);
                    }
                    return;
                }

                const smoke = this.add.circle(
                    shard.x + Phaser.Math.Between(-2, 2),
                    shard.y + Phaser.Math.Between(-2, 2),
                    Phaser.Math.Between(2, 3),
                    0xb0b0b0,
                    0.48
                );
                smoke.setDepth(860);

                this.tweens.add({
                    targets: smoke,
                    y: smoke.y - Phaser.Math.Between(6, 12),
                    x: smoke.x + Phaser.Math.Between(-5, 5),
                    scale: 1.9,
                    alpha: 0,
                    duration: Phaser.Math.Between(230, 360),
                    ease: 'Sine.easeOut',
                    onComplete: () => smoke.destroy()
                });
            }
        });

        shard.setData('smokeTrailEvent', smokeEvent);
        if (shard.once) {
            shard.once('destroy', () => {
                if (smokeEvent && smokeEvent.remove) {
                    smokeEvent.remove(false);
                }
            });
        }
    }

    attachDynamiteSmokeTrail(dynamite) {
        if (!dynamite || !dynamite.active) return;

        const smokeEvent = this.time.addEvent({
            delay: 28,
            loop: true,
            callback: () => {
                if (!dynamite || !dynamite.active) {
                    if (smokeEvent && smokeEvent.remove) {
                        smokeEvent.remove(false);
                    }
                    return;
                }

                for (let i = 0; i < 2; i++) {
                    const smoke = this.add.circle(
                        dynamite.x + Phaser.Math.Between(-4, 4),
                        dynamite.y + Phaser.Math.Between(-4, 4),
                        Phaser.Math.Between(3, 6),
                        0xb8b8b8,
                        0.62
                    );
                    smoke.setDepth(850);

                    this.tweens.add({
                        targets: smoke,
                        y: smoke.y - Phaser.Math.Between(14, 24),
                        x: smoke.x + Phaser.Math.Between(-8, 8),
                        scale: 2.8,
                        alpha: 0,
                        duration: 520,
                        ease: 'Sine.easeOut',
                        onComplete: () => smoke.destroy()
                    });
                }
            }
        });

        dynamite.setData('smokeTrailEvent', smokeEvent);
        if (dynamite.once) {
            dynamite.once('destroy', () => {
                if (smokeEvent && smokeEvent.remove) {
                    smokeEvent.remove(false);
                }
            });
        }
    }

    attachBoulderSmokeTrail(boulder) {
        if (!boulder || !boulder.active) return;
        // If this boulder has already been stopped due to rotations, don't attach smoke
        try {
            if (boulder.getData && boulder.getData('rollingStopped')) return;
        } catch (e) { }

        const smokeEvent = this.time.addEvent({
            delay: 34,
            loop: true,
            callback: () => {
                if (!boulder || !boulder.active) {
                    if (smokeEvent && smokeEvent.remove) {
                        smokeEvent.remove(false);
                    }
                    return;
                }

                const velocityX = Number(boulder.body?.velocity?.x) || 0;
                const velocityY = Number(boulder.body?.velocity?.y) || 0;
                const trailX = boulder.x - Math.sign(velocityX) * Phaser.Math.Between(2, 6);
                const trailY = boulder.y - Math.sign(velocityY) * Phaser.Math.Between(2, 6);

                const trailParticles = 2;
                for (let i = 0; i < trailParticles; i++) {
                    const smoke = this.add.circle(
                        trailX + Phaser.Math.Between(-3, 3),
                        trailY + Phaser.Math.Between(-2, 2),
                        Phaser.Math.Between(4, 7),
                        Phaser.Utils.Array.GetRandom([0x8b6a42, 0x7c5a37, 0x6f4e2e, 0x5f452a, 0x9a7749]),
                        Phaser.Math.FloatBetween(0.58, 0.74)
                    );
                    smoke.setDepth(860);

                    this.tweens.add({
                        targets: smoke,
                        y: smoke.y - Phaser.Math.Between(3, 8),
                        x: smoke.x + Phaser.Math.Between(-8, 8),
                        scale: Phaser.Math.FloatBetween(1.8, 2.7),
                        alpha: 0,
                        duration: Phaser.Math.Between(300, 560),
                        ease: 'Sine.easeOut',
                        onComplete: () => smoke.destroy()
                    });
                }
            }
        });

        boulder.setData('smokeTrailEvent', smokeEvent);
        if (boulder.once) {
            boulder.once('destroy', () => {
                if (smokeEvent && smokeEvent.remove) {
                    smokeEvent.remove(false);
                }
            });
        }
    }
};
}
