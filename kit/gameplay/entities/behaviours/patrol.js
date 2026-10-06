// Pattuglia: avanti e indietro in orizzontale o in verticale, torna indietro quando sbatte
// o dopo "distanza" caselle.
import { blocked } from './_helpers.js';

export default {
    label: 'Pattuglia avanti e indietro',
    params: [
        { key: 'speed', label: 'Velocità (px/s)', type: 'number', default: 80 },
        { key: 'axis', label: 'Direzione', type: 'select', default: 'x', options: [['x', 'orizzontale'], ['y', 'verticale']] },
        { key: 'rangeTiles', label: 'Distanza (caselle, 0 = fino al muro)', type: 'number', default: 0 }
    ],
    init(scene, s, p) {
        s.setData('dir', Math.random() < 0.5 ? -1 : 1);
        s.setData('origin', p.axis === 'y' ? s.y : s.x);
    },
    update(scene, s, dt, p) {
        const tile = scene.tileSizePx || 32;
        let dir = s.getData('dir');
        const pos = p.axis === 'y' ? s.y : s.x;
        const far = p.rangeTiles > 0 && Math.abs(pos - s.getData('origin')) > p.rangeTiles * tile && Math.sign(pos - s.getData('origin')) === dir;
        if (far || blocked(s)) { dir = -dir; s.setData('dir', dir); }
        if (p.axis === 'y') s.body.setVelocity(0, dir * p.speed); else s.body.setVelocity(dir * p.speed, 0);
    }
};
