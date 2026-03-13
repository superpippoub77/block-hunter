/**
 * flying_enemy — generic flying-enemy actor behavior plugin for BlockHunter.
 *
 * Drives any sprite that:
 *  - bounces around the map with random velocity
 *  - supports optional rest cycles (bat-style)
 *  - supports optional gem steal/carry/drop (bat-style)
 *  - supports optional alpha + hover tweens (ghost-style)
 *  - applies per-frame perspective-based scale and flutter
 *
 * Configuration is driven entirely by `opts` so a single plugin
 * covers bat, ghost, bird, jellyfish, or any other flying entity
 * defined in data/objects.json.
 *
 * Usage in game.js (see spawnFlyingEnemyGroup):
 *
 *   const plugin = EFFECT_LIBRARY.effects['flying_enemy'];
 *   const opts    = buildFlyingEnemyOpts(catalogEntry, levelData);
 *   plugin.spawnAll(this, this.bats, this.batSpawnPositions, this.levelData, opts);
 *
 * Per-frame:
 *   plugin.updateGroupPerspective(this, this.bats, this.time.now, opts);
 *
 * On contact (e.g. hitByBat):
 *   plugin.startGemCarry(scene, entity);
 */

// ─── Defaults ────────────────────────────────────────────────────────────────
const DEFAULTS = {
    // Sprite
    textureKey: null,
    defaultFrame: 0,

    // Per-entity looping sound  (null = none)
    sfxKey: null,
    sfxVolume: 0.7,
    // Scene-level sound that is played once for the whole group (null = none)
    sceneSfxKey: null,
    sceneSfxVolumeBase: 0.12,
    sceneSfxVolumePerExtra: 0.035,
    sceneSfxVolumeMax: 0.45,

    // Physics
    collideBounds: true,
    bounceX: 1,
    bounceY: 1,

    // Direction timer
    directionTimerDelayMs: 800,
    directionChangePct: 0.40,

    // Speed fallback used when level data has no entry
    defaultSpeedFallback: 80,
    // Level-data keys used to read count and speed
    countFromLevelKey: null,     // e.g. 'ghost', 'bat'
    speedFromLevelKey: null,     // e.g. 'ghostSpeed', 'batSpeed'

    // Perspective (scale varies with Y position on map)
    perspectiveScaleMin: 0.74,
    perspectiveScaleMax: 1.22,
    flutterAmplitude: 0.04,
    flutterSpeedMs: 230,

    // Ghost-style: semi-transparent alpha oscillation
    alphaTween: false,
    alphaMin: 0.55,

    // Ghost-style: vertical hover tween
    hoverTween: false,
    hoverAmplitudeTileRatio: 0.08,  // fraction of CONFIG.tileSize
    hoverDurationMin: 420,
    hoverDurationMax: 620,
    hoverDelayMin: 0,
    hoverDelayMax: 220,

    // Ghost-style: idle animation plays continuously (no separate loop/start/stop)
    animIdle: null,  // e.g. 'ghost_float'

    // Bat-style: separate start / loop / stop animations
    animStart: null,           // play once on spawn, then switch to loop
    animLoop: null,            // loop while flying right
    animLoopRev: null,         // loop while flying left (reversed)
    animStop: null,            // play once when entering rest

    // Rest cycle (bat-style)
    restEnabled: false,
    flightsBeforeRest: 4,      // can also be read from levelConfig key (see below)
    restSeconds: 2,
    restIntervalSeconds: 0,    // > 0: time-based rest instead of flight-count-based
    // level config keys to read rest params at runtime
    flightsBeforeRestLevelKey: null,  // e.g. 'batFlightsBeforeRest'
    restSecondsLevelKey: null,         // e.g. 'batRestSeconds'
    restIntervalSecondsLevelKey: null, // e.g. 'batRestIntervalSeconds'

    // Gem carry (bat-style)
    stealGems: false,
    gemCarryTextureKey: 'objects',
    gemCarryFrame: null,       // null → resolved from OBJECT_FRAMES.gem at runtime
    gemCarryScaleRatio: 0.62,
    gemDropDelayMin: 1200,
    gemDropDelayMax: 2400
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _resolveOpts(raw) {
    const out = Object.assign({}, DEFAULTS, raw || {});
    return out;
}

function _tryPlay(entity, animKey, restart) {
    try {
        if (animKey && entity.anims && entity.scene && entity.scene.anims && entity.scene.anims.exists(animKey)) {
            entity.play(animKey, !!restart);
            return true;
        }
    } catch (_e) {}
    return false;
}

function _entityOpts(entity) {
    return entity.getData('actorOpts') || {};
}

function _setRandomVelocity(scene, entity) {
    if (!entity || !entity.active) return;
    if (entity.getData('isResting')) return;

    const opts = _entityOpts(entity);
    const speed = Number(entity.getData('speed')) || opts.defaultSpeedFallback || 80;
    const dx = Phaser.Math.FloatBetween(-1, 1);
    const dy = Phaser.Math.FloatBetween(-1, 1);
    const len = Math.hypot(dx, dy) || 1;
    entity.setVelocity((dx / len) * speed, (dy / len) * speed);

    // Mirror sprite horizontally
    try {
        const vx = entity.body && entity.body.velocity ? (entity.body.velocity.x || 0) : 0;
        if (vx < -2) entity.setFlipX(true);
        else if (vx > 2) entity.setFlipX(false);
    } catch (_e) {}

    // Flight count + rest cycle
    if (opts.restEnabled) {
        const restInterval = Number(entity.getData('restInterval'));
        if (Number.isFinite(restInterval) && restInterval > 0) {
            // time-based rest — just keep correct loop anim
            _syncLoopAnim(entity, opts);
        } else {
            let fc = (Number(entity.getData('flightCount')) || 0) + 1;
            entity.setData('flightCount', fc);
            if (fc >= (Number(entity.getData('flightsBeforeRest')) || opts.flightsBeforeRest)) {
                _enterRest(scene, entity);
                return;
            }
            _syncLoopAnim(entity, opts);
        }
    } else {
        // idle anim style (ghost-like)
        if (opts.animIdle) _tryPlay(entity, opts.animIdle, false);
    }

    // Ensure per-entity SFX is playing
    _ensureEntitySfx(scene, entity, opts);
}

function _syncLoopAnim(entity, opts) {
    if (!opts.animLoop && !opts.animLoopRev) return;
    try {
        const vx = entity.body && entity.body.velocity ? (entity.body.velocity.x || 0) : 0;
        if (vx < 0 && opts.animLoopRev) {
            _tryPlay(entity, opts.animLoopRev, true);
        } else if (opts.animLoop) {
            _tryPlay(entity, opts.animLoop, true);
        }
    } catch (_e) {}
}

function _ensureEntitySfx(scene, entity, opts) {
    if (!opts.sfxKey || !scene.sound) return;
    try {
        const existing = entity.getData('sfx');
        if (existing && !existing.destroyed) return;
        const sfx = scene.sound.add(opts.sfxKey, { loop: true, volume: opts.sfxVolume || 0.7 });
        sfx.play();
        entity.setData('sfx', sfx);
        entity.on && entity.on('destroy', () => {
            try { sfx.stop && sfx.stop(); sfx.destroy && sfx.destroy(); } catch (_e) {}
        });
    } catch (_e) {}
}

function _stopEntitySfx(entity) {
    try {
        const sfx = entity.getData('sfx');
        if (sfx) {
            sfx.stop && sfx.stop();
            sfx.destroy && sfx.destroy();
            entity.setData('sfx', null);
        }
    } catch (_e) {}
}

function _enterRest(scene, entity) {
    if (!entity || !entity.active) return;
    if (entity.getData('isResting')) return;

    const opts = _entityOpts(entity);

    // Cancel any existing interval timer
    try {
        const t = entity.getData('restIntervalTimer');
        if (t && t.remove) t.remove(false);
        entity.setData('restIntervalTimer', null);
    } catch (_e) {}

    try { if (entity.anims && entity.anims.isPlaying) entity.anims.stop(); } catch (_e) {}
    try { entity.off && entity.off('animationcomplete'); } catch (_e) {}

    const doRestComplete = () => {
        if (!entity || !entity.active) return;
        try { entity.setVelocity(0, 0); } catch (_e) {}
        try { entity.setFrame(opts.defaultFrame || 0); } catch (_e) {}
        entity.setData('isResting', true);

        _stopEntitySfx(entity);

        const restSeconds = Number(entity.getData('restSeconds')) || opts.restSeconds || 2;
        const t = scene.time.delayedCall(restSeconds * 1000, () => _doRestResume(scene, entity));
        entity.setData('restTimer', t);
    };

    if (opts.animStop) {
        const onStop = (anim) => {
            if (!anim || anim.key !== opts.animStop) return;
            try { entity.off('animationcomplete', onStop); } catch (_e) {}
            doRestComplete();
        };
        if (!_tryPlay(entity, opts.animStop, true)) {
            try { entity.setVelocity(0, 0); } catch (_e) {}
            doRestComplete();
        } else {
            entity.on('animationcomplete', onStop);
        }
    } else {
        try { entity.setVelocity(0, 0); } catch (_e) {}
        doRestComplete();
    }
}

function _doRestResume(scene, entity) {
    if (!entity || !entity.active) return;
    entity.setData('isResting', false);
    entity.setData('flightCount', 0);

    const opts = _entityOpts(entity);

    const resume = () => {
        _setRandomVelocity(scene, entity);
        _scheduleIntervalRest(scene, entity, opts);
        _ensureEntitySfx(scene, entity, opts);
    };

    if (opts.animStart) {
        const onStart = (anim) => {
            if (!anim || anim.key !== opts.animStart) return;
            try { entity.off('animationcomplete', onStart); } catch (_e) {}
            resume();
        };
        if (_tryPlay(entity, opts.animStart, true)) {
            entity.on('animationcomplete', onStart);
        } else {
            resume();
        }
    } else {
        resume();
    }
}

function _scheduleIntervalRest(scene, entity, opts) {
    const restInterval = Number(entity.getData('restInterval'));
    if (!Number.isFinite(restInterval) || restInterval <= 0) return;
    try {
        const t = scene.time.delayedCall(restInterval * 1000, () => {
            if (!entity || !entity.active) return;
            _enterRest(scene, entity);
        });
        entity.setData('restIntervalTimer', t);
    } catch (_e) {}
}

function _spawnOne(scene, group, worldX, worldY, opts) {
    if (!group) return null;
    const o = opts;
    const textureKey = o.textureKey || 'objects';
    const frame = o.defaultFrame || 0;
    const entity = group.create(worldX, worldY, textureKey, frame);

    const scaleFactor = (window.CONFIG?.objectSize || 64) / (window.OBJECT_NATIVE_SIZE || 64);
    entity.setScale(scaleFactor);
    entity.setData('baseScale', scaleFactor);
    entity.setData('flutterPhase', Phaser.Math.FloatBetween(0, Math.PI * 2));
    entity.setData('actorOpts', o);

    if (entity.body) {
        entity.body.setSize(
            Math.floor(entity.displayWidth || entity.width),
            Math.floor(entity.displayHeight || entity.height)
        );
        if (o.collideBounds !== false) entity.body.setCollideWorldBounds(true);
        entity.body.setBounce(
            o.bounceX !== undefined ? o.bounceX : 1,
            o.bounceY !== undefined ? o.bounceY : 1
        );
    }

    // Speed
    entity.setData('speed', Number(entity.getData('speed')) || o.defaultSpeedFallback || 80);
    entity.setData('nextStealAt', 0);

    // Rest cycle config
    if (o.restEnabled) {
        entity.setData('flightsBeforeRest', o.flightsBeforeRest || 4);
        entity.setData('restSeconds', o.restSeconds || 2);
        const ri = o.restIntervalSeconds || 0;
        if (ri > 0) entity.setData('restInterval', ri);
    }

    // Ghost-style tweens
    if (o.alphaTween) {
        scene.tweens.add({
            targets: entity,
            alpha: o.alphaMin !== undefined ? o.alphaMin : 0.55,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }
    if (o.hoverTween) {
        const tileSize = window.CONFIG?.tileSize || 64;
        const hoverAmp = Math.max(3, Math.round(tileSize * (o.hoverAmplitudeTileRatio || 0.08)));
        const durMin = o.hoverDurationMin || 420;
        const durMax = o.hoverDurationMax || 620;
        const delayMin = o.hoverDelayMin || 0;
        const delayMax = o.hoverDelayMax || 220;
        scene.tweens.add({
            targets: entity,
            y: entity.y - hoverAmp,
            duration: Phaser.Math.Between(durMin, durMax),
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: Phaser.Math.Between(delayMin, delayMax)
        });
    }

    // Spawn animation
    if (o.animStart) {
        const wasMoved = { done: false };
        const onStart = (anim) => {
            if (!anim || anim.key !== o.animStart) return;
            try { entity.off('animationcomplete', onStart); } catch (_e) {}
            if (!wasMoved.done) { wasMoved.done = true; _setRandomVelocity(scene, entity); }
        };
        if (_tryPlay(entity, o.animStart, true)) {
            entity.on('animationcomplete', onStart);
        } else {
            _setRandomVelocity(scene, entity);
        }
    } else if (o.animIdle) {
        _tryPlay(entity, o.animIdle, false);
        _setRandomVelocity(scene, entity);
    } else {
        _setRandomVelocity(scene, entity);
    }

    // Per-entity SFX
    _ensureEntitySfx(scene, entity, o);

    // Schedule interval-based rest
    if (o.restEnabled && (o.restIntervalSeconds || 0) > 0) {
        _scheduleIntervalRest(scene, entity, o);
    }

    return entity;
}

function _getOrCreateDirectionTimer(scene, group, opts) {
    // Direction timer is stored on the group object itself
    if (group._flyingEnemyDirTimer) return group._flyingEnemyDirTimer;

    const delay = opts.directionTimerDelayMs || 800;
    const pct = opts.directionChangePct !== undefined ? opts.directionChangePct : 0.40;
    const timer = scene.time.addEvent({
        delay,
        loop: true,
        callback: () => {
            const entries = group.children?.entries || [];
            entries.forEach((e) => {
                if (!e || !e.active) return;
                if (Math.random() < pct) _setRandomVelocity(scene, e);
            });
        }
    });
    group._flyingEnemyDirTimer = timer;
    return timer;
}

// ─── Plugin export ────────────────────────────────────────────────────────────

window.__BLOCKHUNTER_EFFECT_EXPORT__ = {
    name: 'flying_enemy',
    type: 'actor_behavior',
    defaults: DEFAULTS,

    // ── Count + Speed resolution ──────────────────────────────────────────────

    getCountForLevel(levelData, opts) {
        const o = _resolveOpts(opts);
        const key = o.countFromLevelKey;
        if (key) {
            const direct = Number(levelData?.[key]);
            if (Number.isFinite(direct) && direct > 0) return Math.floor(direct);
            const inMap = Number(levelData?.map?.[key]);
            if (Number.isFinite(inMap) && inMap > 0) return Math.floor(inMap);
        }
        return 0;
    },

    getSpeedForLevel(levelData, opts) {
        const o = _resolveOpts(opts);
        const key = o.speedFromLevelKey;
        if (key) {
            const direct = Number(levelData?.[key]);
            if (Number.isFinite(direct) && direct > 0) return direct;
            const inMap = Number(levelData?.map?.[key]);
            if (Number.isFinite(inMap) && inMap > 0) return inMap;
        }
        return o.defaultSpeedFallback || 80;
    },

    // ── Scene-level SFX (ghost-like: one sound for the entire group) ──────────

    startSceneSfx(scene, count, opts) {
        const o = _resolveOpts(opts);
        if (!o.sceneSfxKey || !scene.sound) return;
        const vol = Phaser.Math.Clamp(
            (o.sceneSfxVolumeBase || 0.12) + (Math.max(1, count) - 1) * (o.sceneSfxVolumePerExtra || 0.035),
            o.sceneSfxVolumeBase || 0.12,
            o.sceneSfxVolumeMax || 0.45
        );
        const existing = scene.sound.get(o.sceneSfxKey);
        if (existing) {
            if (existing.setVolume) existing.setVolume(vol);
            if (!existing.isPlaying) existing.play({ loop: true, volume: vol });
        } else {
            try { scene.sound.play(o.sceneSfxKey, { loop: true, volume: vol }); } catch (_e) {}
        }
    },

    stopSceneSfx(scene, opts) {
        const o = _resolveOpts(opts);
        if (!o.sceneSfxKey || !scene.sound) return;
        try {
            const sfx = scene.sound.get(o.sceneSfxKey);
            if (sfx && sfx.isPlaying) sfx.stop();
        } catch (_e) {}
    },

    // ── Spawn all ─────────────────────────────────────────────────────────────

    /**
     * @param {Phaser.Scene} scene
     * @param {Phaser.GameObjects.Group} group  physics group (this.bats / this.ghosts / ...)
     * @param {Array<{x,y}>} spawnPositions     tile world-space positions from map parsing
     * @param {object} levelData                raw level JSON object
     * @param {object} rawOpts                  plugin options (from buildFlyingEnemyOpts helper)
     */
    spawnAll(scene, group, spawnPositions, levelData, rawOpts) {
        if (!scene || !group) return;
        const opts = _resolveOpts(rawOpts);

        const count = this.getCountForLevel(levelData, opts);
        if (count <= 0) {
            // Still stop scene SFX in case it was already playing
            this.stopSceneSfx(scene, opts);
            return;
        }

        this.startSceneSfx(scene, count, opts);

        const speed = this.getSpeedForLevel(levelData, opts);
        const positions = Array.isArray(spawnPositions) ? spawnPositions : [];

        for (let i = 0; i < count; i++) {
            let worldX, worldY;
            if (positions.length > 0) {
                const pos = positions[i % positions.length];
                if (!pos) continue;
                worldX = pos.x;
                worldY = pos.y;
            } else {
                // Fall back to random walkable tile if no spawn markers in map
                const tile = scene.getRandomWalkableTile && scene.getRandomWalkableTile();
                if (!tile) continue;
                const tileSize = window.CONFIG?.tileSize || 64;
                worldX = (scene.mapOffsetX || 0) + tile.x * tileSize + tileSize / 2;
                worldY = (scene.mapOffsetY || 0) + tile.y * tileSize + tileSize / 2;
            }

            // Build per-level rest params from levelConfig (supports data-driven key names)
            const levelConfig = scene.levelConfig || {};
            const restOpts = Object.assign({}, opts);
            if (opts.flightsBeforeRestLevelKey) {
                const v = Number(levelConfig[opts.flightsBeforeRestLevelKey]);
                if (Number.isFinite(v) && v > 0) restOpts.flightsBeforeRest = v;
            }
            if (opts.restSecondsLevelKey) {
                const v = Number(levelConfig[opts.restSecondsLevelKey]);
                if (Number.isFinite(v) && v > 0) restOpts.restSeconds = v;
            }
            if (opts.restIntervalSecondsLevelKey) {
                const v = Number(levelConfig[opts.restIntervalSecondsLevelKey]);
                if (Number.isFinite(v) && v >= 0) restOpts.restIntervalSeconds = v;
            }

            const entity = _spawnOne(scene, group, worldX, worldY, restOpts);
            if (!entity) continue;
            entity.setData('speed', speed);
        }

        // Shared direction-change timer for the group
        _getOrCreateDirectionTimer(scene, group, opts);
    },

    // ── Per-frame perspective update ──────────────────────────────────────────

    /**
     * Call from scene.update(). Updates scale + carried-gem position for every
     * active entity in the group.
     *
     * @param {Phaser.Scene} scene
     * @param {Phaser.GameObjects.Group} group
     * @param {number} timeNow   scene.time.now
     * @param {object} rawOpts   same opts used at spawn
     */
    updateGroupPerspective(scene, group, timeNow, rawOpts) {
        const entries = group?.children?.entries || [];
        if (!entries.length) return;

        const opts = _resolveOpts(rawOpts);
        const worldTop = scene.mapOffsetY || 0;
        const worldHeight = Math.max(1, (scene.mapRows || 12) * (window.CONFIG?.tileSize || 64));

        const pMin = opts.perspectiveScaleMin !== undefined ? opts.perspectiveScaleMin : 0.74;
        const pMax = opts.perspectiveScaleMax !== undefined ? opts.perspectiveScaleMax : 1.22;
        const fAmp = opts.flutterAmplitude !== undefined ? opts.flutterAmplitude : 0.04;
        const fSpd = opts.flutterSpeedMs > 0 ? opts.flutterSpeedMs : 230;

        entries.forEach((entity) => {
            if (!entity || !entity.active) return;

            const baseScale = Number(entity.getData('baseScale')) || ((window.CONFIG?.objectSize || 64) / (window.OBJECT_NATIVE_SIZE || 64));
            const phase = Number(entity.getData('flutterPhase')) || 0;
            const yNorm = Phaser.Math.Clamp((entity.y - worldTop) / worldHeight, 0, 1);

            const perspScale = Phaser.Math.Linear(pMin, pMax, yNorm);
            const flutterMul = 1 + Math.sin((timeNow / fSpd) + phase) * fAmp;
            entity.setScale(baseScale * perspScale * flutterMul);

            // Ghost-style: stop animation when entity is nearly still
            if (opts.animIdle) {
                try {
                    const vx = entity.body?.velocity?.x || 0;
                    const vy = entity.body?.velocity?.y || 0;
                    const spd = Math.hypot(vx, vy);
                    if (spd <= 6) {
                        if (entity.anims && entity.anims.isPlaying) {
                            entity.anims.stop();
                            entity.setFrame(opts.defaultFrame || 0);
                        }
                        entity.setData('isStopped', true);
                    } else {
                        if (entity.getData('isStopped')) {
                            entity.setData('isStopped', false);
                            _tryPlay(entity, opts.animIdle, false);
                        } else if (!entity.anims?.isPlaying) {
                            _tryPlay(entity, opts.animIdle, false);
                        }
                    }
                    // Mirror
                    const vx2 = entity.body?.velocity?.x || 0;
                    if (vx2 < -2) entity.setFlipX(true);
                    else if (vx2 > 2) entity.setFlipX(false);
                } catch (_e) {}
            }

            // Update carried-gem position (bat-style)
            const carriedGem = entity.getData('carriedGemSprite');
            const isDropping = !!entity.getData('carriedGemDropping');
            if (carriedGem && carriedGem.active && !isDropping) {
                const offX = Number(entity.getData('carriedGemOffsetX')) || 0;
                const offY = Number(entity.getData('carriedGemOffsetY')) || -14;
                carriedGem.setPosition(entity.x + offX, entity.y + offY);
                carriedGem.setDepth((entity.depth || 0) + 2);
            }
        });
    },

    // ── Gem carry / drop ──────────────────────────────────────────────────────

    startGemCarry(scene, entity) {
        if (!entity || !entity.active) {
            // Gem was stolen but entity vanished — respawn it
            if (scene.respawnStolenGemInMap) scene.respawnStolenGemInMap(scene.player?.x, scene.player?.y);
            return;
        }

        const opts = _entityOpts(entity);
        this.releaseCarriedGem(scene, entity, false);

        const tileSize = window.CONFIG?.objectSize || 64;
        const nativeSize = window.OBJECT_NATIVE_SIZE || 64;
        const baseScale = tileSize / nativeSize;
        const gemScale = baseScale * (opts.gemCarryScaleRatio || 0.62);

        const gemTexture = opts.gemCarryTextureKey || 'objects';
        const gemFrame = opts.gemCarryFrame !== null && opts.gemCarryFrame !== undefined
            ? opts.gemCarryFrame
            : (window.OBJECT_FRAMES?.gem || 6);

        const carriedGem = scene.add.sprite(entity.x, entity.y, gemTexture, gemFrame);
        carriedGem.setScale(gemScale);
        carriedGem.setAlpha(0.92);
        carriedGem.setDepth((entity.depth || 0) + 2);

        entity.setData('carriedGemSprite', carriedGem);
        entity.setData('carriedGemDropping', false);
        entity.setData('carriedGemOffsetX', Phaser.Math.Between(-8, 8));
        entity.setData('carriedGemOffsetY', Phaser.Math.Between(-18, -10));

        const dropDelayMin = opts.gemDropDelayMin || 1200;
        const dropDelayMax = opts.gemDropDelayMax || 2400;
        const delay = Phaser.Math.Between(dropDelayMin, dropDelayMax);

        const dropTimer = scene.time.delayedCall(delay, () => {
            if (!entity || !entity.active) {
                if (carriedGem && carriedGem.active) carriedGem.destroy();
                if (scene.respawnStolenGemInMap) scene.respawnStolenGemInMap(scene.player?.x, scene.player?.y);
                return;
            }

            const ts = window.CONFIG?.tileSize || 64;
            const rawTileX = Math.floor((entity.x - (scene.mapOffsetX || 0)) / ts);
            const rawTileY = Math.floor((entity.y - (scene.mapOffsetY || 0)) / ts);
            const tileX = Phaser.Math.Clamp(rawTileX, 0, (scene.mapCols || 12) - 1);
            const tileY = Phaser.Math.Clamp(rawTileY, 0, (scene.mapRows || 12) - 1);
            const tileType = scene.tiles?.[tileY]?.[tileX]?.type;
            const canDrop = tileType === 'floor' || tileType === 'empty';

            let dropX = entity.x;
            let dropY = entity.y;
            if (!canDrop) {
                const fallback = scene.getRandomWalkableTile && scene.getRandomWalkableTile();
                if (fallback) {
                    dropX = (scene.mapOffsetX || 0) + fallback.x * ts + ts / 2;
                    dropY = (scene.mapOffsetY || 0) + fallback.y * ts + ts / 2;
                }
            }

            entity.setData('carriedGemDropping', true);
            scene.tweens.add({
                targets: carriedGem,
                x: dropX,
                y: dropY,
                scale: gemScale * 0.95,
                alpha: 1,
                duration: 260,
                ease: 'Sine.easeInOut',
                onComplete: () => {
                    if (carriedGem && carriedGem.active) carriedGem.destroy();
                    entity.setData('carriedGemSprite', null);
                    entity.setData('carriedGemDropping', false);
                    entity.setData('carriedGemDropTimer', null);
                    if (scene.createGemPickupAt) scene.createGemPickupAt(dropX, dropY);
                }
            });
        });

        entity.setData('carriedGemDropTimer', dropTimer);
    },

    releaseCarriedGem(scene, entity, dropToMap = true) {
        if (!entity) return;
        const dropTimer = entity.getData('carriedGemDropTimer');
        if (dropTimer && dropTimer.remove) dropTimer.remove(false);
        const carriedGem = entity.getData('carriedGemSprite');
        if (carriedGem && carriedGem.active) {
            if (dropToMap && scene.createGemPickupAt) scene.createGemPickupAt(entity.x, entity.y);
            carriedGem.destroy();
        }
        entity.setData('carriedGemSprite', null);
        entity.setData('carriedGemDropping', false);
        entity.setData('carriedGemDropTimer', null);
    }
};
