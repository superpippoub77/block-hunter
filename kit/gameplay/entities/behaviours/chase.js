// Insegue: punta il player più vicino quando è entro "raggio" caselle, altrimenti vaga.
import { setDir, nearestPlayer } from './_helpers.js';
import wander from './wander.js';

export default {
    label: 'Insegue il player',
    params: [
        { key: 'speed', label: 'Velocità (px/s)', type: 'number', default: 65 },
        { key: 'rangeTiles', label: 'Raggio (caselle)', type: 'number', default: 6 },
        { key: 'changeMs', label: 'Se non vede il player: cambia direzione ogni (ms)', type: 'number', default: 2200 }
    ],
    init(scene, s, p) { wander.init(scene, s, p); },
    update(scene, s, dt, p) {
        const tile = scene.tileSizePx || 32;
        const near = nearestPlayer(scene, s);
        if (near && near.dist <= p.rangeTiles * tile) setDir(s, near.player.x - s.x, near.player.y - s.y, p.speed);
        else wander.update(scene, s, dt, p);
    }
};
