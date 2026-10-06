// Vaga: cammina in una direzione a caso e cambia quando sbatte o dopo un po'.
import { setDir, blocked, randomDir4 } from './_helpers.js';

export default {
    label: 'Vaga a caso',
    params: [
        { key: 'speed', label: 'Velocità (px/s)', type: 'number', default: 70 },
        { key: 'changeMs', label: 'Cambia direzione ogni (ms)', type: 'number', default: 2200 }
    ],
    init(scene, s, p) {
        const [dx, dy] = randomDir4();
        setDir(s, dx, dy, p.speed);
        s.setData('nextTurn', scene.time.now + p.changeMs * (0.5 + Math.random()));
    },
    update(scene, s, dt, p) {
        if (blocked(s) || scene.time.now >= s.getData('nextTurn')) {
            const [dx, dy] = randomDir4();
            setDir(s, dx, dy, p.speed);
            s.setData('nextTurn', scene.time.now + p.changeMs * (0.5 + Math.random()));
        }
    }
};
