// Vola: si muove in diagonale attraversando i muri e rimbalza sui bordi del livello.
import { setDir } from './_helpers.js';

export default {
    label: 'Vola (attraversa i muri)',
    ignoresWalls: true,
    params: [
        { key: 'speed', label: 'Velocità (px/s)', type: 'number', default: 90 },
        { key: 'changeMs', label: 'Cambia direzione ogni (ms)', type: 'number', default: 1800 }
    ],
    init(scene, s, p) {
        s.body.setCollideWorldBounds(true);
        s.body.setBounce(1, 1);
        setDir(s, Math.random() * 2 - 1, Math.random() * 2 - 1, p.speed);
        s.setData('nextTurn', scene.time.now + p.changeMs);
    },
    update(scene, s, dt, p) {
        if (scene.time.now >= s.getData('nextTurn')) {
            setDir(s, Math.random() * 2 - 1, Math.random() * 2 - 1, p.speed);
            s.setData('nextTurn', scene.time.now + p.changeMs * (0.6 + Math.random() * 0.8));
        }
    }
};
