// Entità definite dai dati (data/game-entities-mapping.json, voci con "behaviour"): nemici,
// personaggi e oggetti nuovi senza scrivere codice. Comportamenti in kit/gameplay/entities/
// behaviours/, azioni in kit/gameplay/entities/actions.js. Fantasma, pipistrello, ragno e
// serpente restano i nemici "storici" scritti a mano (scene/enemies/*.js).
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene.
import { BEHAVIOURS, behaviourParams } from '../entities/behaviours/index.js';
import { runActions } from '../entities/actions.js';

export function createEntitiesMixin(deps) {
const { Phaser, CONFIG, GAME_STATE } = deps;

const DEFAULT_ON = {
    touchPlayer: [{ action: 'blood' }, { action: 'loseLife' }],
    hitByDynamite: [{ action: 'addScore', amount: 10 }, { action: 'explosion' }, { action: 'explodeDynamite' }, { action: 'destroy' }]
};

return class EntitiesMixin {
    /** token → definition, for the entities that have a "behaviour" */
    getDataEntityDefs() {
        if (this._dataEntityDefs) return this._dataEntityDefs;
        const map = new Map();
        const all = (typeof window !== 'undefined' && window.GAME_MAPPINGS?.entities?.entities) || {};
        Object.entries(all).forEach(([id, def]) => {
            if (!def || !def.behaviour) return;
            (def.tokens && def.tokens.length ? def.tokens : [id]).forEach((t) => map.set(String(t).toLowerCase(), { id, ...def }));
        });
        this._dataEntityDefs = map;
        return map;
    }

    isDataEntityType(type) {
        return !!type && this.getDataEntityDefs().has(String(type).toLowerCase());
    }

    /** called by createTilemap for every cell whose token is a data entity */
    collectDataEntitySpawn(type, x, y, gridX, gridY) {
        if (!this.dataEntitySpawns) this.dataEntitySpawns = [];
        this.dataEntitySpawns.push({ type: String(type).toLowerCase(), x, y, gridX, gridY });
    }

    spawnDataEntities() {
        this.tileSizePx = CONFIG.tileSize || 32;
        if (!this.dataEntities) this.dataEntities = this.physics.add.group();
        const spawns = this.dataEntitySpawns || [];
        const toLoad = [];
        spawns.forEach((sp) => {
            const def = this.getDataEntityDefs().get(sp.type);
            const tex = def?.sprite?.texture;
            if (def?.sprite?.src && tex && !this.textures.exists(tex)) toLoad.push(def.sprite);
        });
        const spawnAll = () => spawns.forEach((sp) => this.spawnDataEntity(sp.type, sp));
        if (toLoad.length) {
            toLoad.forEach((s) => {
                if (s.frameWidth) this.load.spritesheet(s.texture, s.src, { frameWidth: s.frameWidth, frameHeight: s.frameHeight || s.frameWidth });
                else this.load.image(s.texture, s.src);
            });
            this.load.once('complete', spawnAll);
            this.load.start();
        } else {
            spawnAll();
        }
    }

    spawnDataEntity(type, spawn) {
        const def = this.getDataEntityDefs().get(String(type).toLowerCase());
        if (!def || !this.dataEntities) return null;
        const sp = def.sprite || {};
        const tex = sp.texture && this.textures.exists(sp.texture) ? sp.texture : 'objects';
        const e = this.dataEntities.create(spawn.x, spawn.y, tex, sp.frame ?? 0);
        const size = (Number(CONFIG.objectSize) || 64) * (Number(sp.scale) || 1);
        e.setDisplaySize(size, size);
        if (sp.tint) { try { e.setTint(Phaser.Display.Color.HexStringToColor(sp.tint).color); } catch (err) { } }
        if (sp.animation && this.anims.exists(sp.animation)) e.play(sp.animation);
        e.setDepth(Number(sp.depth) || 50);
        const r = Math.max(4, Math.floor(Math.min(e.width, e.height) * (Number(def.collision?.radius) || 0.3)));
        e.body.setCircle(r, e.width / 2 - r, e.height / 2 - r);
        e.setData('entityId', def.id);
        e.setData('spawn', { x: spawn.x, y: spawn.y });
        e.setData('lastHitAt', 0);
        const params = behaviourParams(def.behaviour);
        params.speed = (Number(params.speed) || 0) * (Number(GAME_STATE.difficulty) || 1);
        e.setData('behaviourParams', params);
        const beh = BEHAVIOURS[def.behaviour.type] || BEHAVIOURS.wander;
        e.setData('behaviour', beh);
        try { beh.init && beh.init(this, e, params); } catch (err) { console.warn('[entities] init', def.id, err); }
        runActions(this, def.on?.spawn, { entity: e });
        return e;
    }

    /** colliders and overlaps (called after setupCollisions) */
    setupDataEntityCollisions() {
        if (!this.dataEntities) this.dataEntities = this.physics.add.group();
        const g = this.dataEntities;
        const ignoresWalls = (e) => {
            const def = this.getDataEntityDefs().get(String(e.getData('entityId')).toLowerCase());
            return def?.collision?.walls === false || !!e.getData('behaviour')?.ignoresWalls;
        };
        if (this.walls) this.physics.add.collider(g, this.walls, null, (e) => !ignoresWalls(e), this);
        if (this.doors) this.physics.add.collider(g, this.doors, null, (e) => !ignoresWalls(e), this);
        if (this.rocks) this.physics.add.collider(g, this.rocks, null, (e) => !ignoresWalls(e), this);
        [this.player, this.player2].forEach((p) => { if (p) this.physics.add.overlap(p, g, this.dataEntityTouchPlayer, null, this); });
        if (this.dynamites) this.physics.add.overlap(this.dynamites, g, this.dataEntityHitByDynamite, null, this);
    }

    dataEntityDef(e) {
        return this.getDataEntityDefs().get(String(e.getData('entityId')).toLowerCase());
    }

    dataEntityTouchPlayer(player, e) {
        if (!e || !e.active) return;
        if (this.cartPowerActive) return;
        const def = this.dataEntityDef(e);
        const now = this.time.now;
        const cooldown = Number(def?.touchCooldownMs ?? 1000);
        if (now < (Number(e.getData('lastHitAt')) || 0) + cooldown) return;
        e.setData('lastHitAt', now);
        runActions(this, def?.on?.touchPlayer ?? DEFAULT_ON.touchPlayer, { entity: e, player });
    }

    dataEntityHitByDynamite(dynamite, e) {
        if (!e || !e.active || !dynamite || !dynamite.active) return;
        const def = this.dataEntityDef(e);
        runActions(this, def?.on?.hitByDynamite ?? DEFAULT_ON.hitByDynamite, { entity: e, dynamite });
    }

    updateDataEntities(time, delta) {
        if (!this.dataEntities) return;
        this.dataEntities.getChildren().forEach((e) => {
            if (!e.active || !e.body) return;
            const beh = e.getData('behaviour');
            try { beh?.update && beh.update(this, e, delta, e.getData('behaviourParams')); } catch (err) { }
            const def = this.dataEntityDef(e);
            if (def?.sprite?.faceDirection !== false && Math.abs(e.body.velocity.x) > 1) e.setFlipX(e.body.velocity.x < 0);
        });
    }
};
}
