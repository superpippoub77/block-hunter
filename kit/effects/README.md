# Libreria effetti SpikeCode

Gli effetti animano gli elementi delle schermate (attract, top ten, istruzioni, selezione livello…).
Sono usati sia dal gioco sia dall'editor delle schermate, che li elenca da solo con i loro parametri.

| File | Tipo (`kind`) | Effetti |
|---|---|---|
| `entrances.js` | `in` — prima di iniziare l'elemento aspetta nello stato iniziale | fadeIn, slideIn, dropBounce, zoomIn, spinIn, typewriter |
| `exits.js` | `out` — dopo la fine resta nello stato finale | fadeOut, slideOut, flyUp, zoomOut |
| `moves.js` | `move` — cambiamenti che mantengono il risultato | moveBy, scaleTo, rotateTo |
| `loops.js` | `loop` — si ripetono (durata 0 = finché l'elemento è visibile) | blink, pulse, float, vibrate, wobble, spin, rainbow, heartbeat |
| `actions.js` | `action` — una volta, all'istante indicato | sound, flash, shake |
| `custom.js` | qualsiasi | **i tuoi effetti** (c'è un esempio commentato) |
| `easings.js` | — | curve di andamento (linear, bounceOut, backOut…) |

## Aggiungere un effetto

Apri `custom.js` (o crea un file nuovo e aggiungilo a `index.js`) ed esporta una mappa `id → effetto`:

```js
import { P } from './_helpers.js';

export default {
    swing: {
        label: 'Altalena',                 // nome mostrato nell'editor
        kind: 'loop',                      // in | out | move | loop | action
        params: [P.period(1600), P.amount('degrees', 'Gradi', 12, 1)],
        apply(s, t, { params, base, design }) {
            s.angle += params.degrees * Math.sin((t / params.period) * Math.PI * 2);
        }
    }
};
```

`apply(s, p, ctx)` modifica lo stato `s` dell'elemento per l'istante richiesto:

- `s`: `{ offsetX, offsetY, scaleX, scaleY, angle, alpha, tint, visibleChars }`: si **combina**
  con gli altri effetti (aggiungi agli offset, moltiplica scala e opacità);
- `p`: per `in`/`out`/`move` l'avanzamento 0…1 già passato per l'andamento (`ease`), per `loop`
  i millisecondi trascorsi dall'inizio;
- `ctx.params`: i parametri (con i valori di default), `ctx.base`: posizione e dimensioni
  dell'elemento, `ctx.design`: dimensioni della schermata.

Un effetto deve dipendere **solo dal tempo** (niente stato interno, niente `Math.random()` senza
seme): così l'editor può mostrare qualsiasi istante della timeline esattamente come il gioco.

Per un'azione una tantum usa `kind: 'action'` e `run(scene, { params })` al posto di `apply`.

### Parametri

`P.duration(ms)`, `P.ease(nome)`, `P.dir(da)`, `P.period(ms)`, `P.amount(chiave, etichetta, default, passo)`,
oppure un oggetto `{ key, label, type: 'number' | 'select' | 'text' | 'color' | 'checkbox', default, options }`.
