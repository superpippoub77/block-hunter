// Azioni una tantum (kind "action"): run(scene, { params }) parte quando la timeline passa dal loro istante.
// Non vengono eseguite mentre si scorre la timeline nell'editor.
import { P } from './_helpers.js';

export default {
    sound: {
        label: 'Suono', kind: 'action',
        params: [{ key: 'key', label: 'Suono (chiave)', type: 'text', default: 'select_sfx' }, P.amount('volume', 'Volume', 0.5, 0.05)],
        run(scene, { params }) { try { scene.sound.play(params.key, { volume: params.volume }); } catch (e) { } }
    },
    flash: {
        label: 'Lampo (schermo)', kind: 'action', params: [P.duration(250), { key: 'color', label: 'Colore', type: 'color', default: '#ffffff' }],
        run(scene, { params }) {
            try { const c = parseInt(String(params.color).replace('#', ''), 16) || 0xffffff; scene.cameras.main.flash(params.duration, (c >> 16) & 255, (c >> 8) & 255, c & 255); } catch (e) { }
        }
    },
    shake: {
        label: 'Scossa (schermo)', kind: 'action', params: [P.duration(300), P.amount('intensity', 'Intensità', 0.01, 0.005)],
        run(scene, { params }) { try { scene.cameras.main.shake(params.duration, params.intensity); } catch (e) { } }
    }
};
