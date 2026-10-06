// I TUOI EFFETTI: aggiungili qui (o in un nuovo file importato da index.js).
// Compaiono da soli nell'editor delle schermate, con i loro parametri.
//
// Esempio (togli i commenti per provarlo):
//
// export default {
//     swing: {
//         label: 'Altalena',
//         kind: 'loop',                                   // in | out | move | loop
//         params: [
//             P.period(1600),
//             P.amount('degrees', 'Gradi', 12, 1)
//         ],
//         apply(s, t, { params }) {                        // s = stato da modificare
//             s.angle += params.degrees * Math.sin((t / params.period) * Math.PI * 2);
//         }
//     }
// };
//
// Per un'azione una tantum usa kind: 'action' e run(scene, { params }) al posto di apply().
import { P } from './_helpers.js';

export default {
    // swing: { ... }
};

// (P serve agli esempi: lascia l'import anche se il file è vuoto)
export const _P = P;
