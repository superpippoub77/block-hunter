// Azioni delle entità: cosa succede quando un'entità tocca il player, viene colpita dalla
// dinamite o compare. Nei dati si scrivono come { "action": "addScore", "amount": 20 }.
// Ogni azione è run(scene, ctx, params) con ctx = { entity, player, dynamite }.
// Per aggiungerne una: una nuova voce qui sotto (compare nella documentazione con il suo label).

export const ACTIONS = {
    loseLife: {
        label: 'Il player perde una vita',
        run(scene, { player }) { scene.loseLife({ player }); }
    },
    addScore: {
        label: 'Punti (amount, anche negativi)',
        run(scene, { entity, player }, p) {
            const n = Number(p.amount) || 0;
            const x = (entity || player)?.x, y = (entity || player)?.y;
            scene.showScorePopup(n, x, y);
            scene.addScore(n, x, y);
        }
    },
    sound: {
        label: 'Suono (key, volume)',
        run(scene, ctx, p) { try { scene.sound.play(p.key, { volume: Number(p.volume) || 0.5 }); } catch (e) { } }
    },
    blood: {
        label: 'Schizzi di sangue sul player (intensity)',
        run(scene, { player }, p) { scene.createBloodSplatter(player?.x, player?.y, Number(p.intensity) || 1.5); }
    },
    explosion: {
        label: 'Esplosione visiva sull\'entità',
        run(scene, { entity }) { scene.createExplosionAt(entity?.x, entity?.y); }
    },
    explodeDynamite: {
        label: 'Fa esplodere la dinamite che l\'ha colpita',
        run(scene, { dynamite }) { if (dynamite && dynamite.active) scene.explodeDynamite(dynamite); }
    },
    destroy: {
        label: 'Rimuove l\'entità',
        run(scene, { entity }) { if (entity && entity.active) entity.destroy(); }
    },
    respawn: {
        label: 'Ricompare nel punto di partenza dopo (delay ms)',
        run(scene, { entity }, p) {
            if (!entity) return;
            const spawn = entity.getData('spawn');
            const id = entity.getData('entityId');
            scene.time.delayedCall(Number(p.delay) || 3000, () => {
                if (scene.sys.isActive() && spawn) scene.spawnDataEntity(id, spawn);
            });
        }
    },
    message: {
        label: 'Messaggio a tutto schermo (text, style: info | success | warning)',
        run(scene, ctx, p) { try { scene.showFullScreenMessage(String(p.text || ''), p.style || 'info'); } catch (e) { } }
    },
    knockback: {
        label: 'Respinge il player (force px/s)',
        run(scene, { entity, player }, p) {
            if (!entity || !player?.body) return;
            const dx = player.x - entity.x, dy = player.y - entity.y, len = Math.hypot(dx, dy) || 1;
            const f = Number(p.force) || 260;
            player.body.setVelocity((dx / len) * f, (dy / len) * f);
        }
    }
};

/** Runs a list like [{ action: 'addScore', amount: 10 }, 'destroy'] */
export function runActions(scene, list, ctx) {
    (Array.isArray(list) ? list : []).forEach((entry) => {
        const spec = typeof entry === 'string' ? { action: entry } : (entry || {});
        const a = ACTIONS[spec.action];
        if (!a) { console.warn('[entities] azione sconosciuta', spec.action); return; }
        try { a.run(scene, ctx, spec); } catch (e) { console.warn('[entities] azione non riuscita', spec.action, e); }
    });
}
