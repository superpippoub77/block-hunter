# Widget SpikeCode

I widget sono i pezzi interattivi delle schermate: gettoni, comandi arcade, lingua, classifica, menu,
testi a rotazione. Ogni widget è un file; l'editor delle schermate li elenca da solo con le loro proprietà.

| File | Widget |
|---|---|
| `coins.js` | gettoni / crediti / free play con 1P-2P |
| `arcadeControls.js` | tasti gettone, avvio 1P/2P, configurazione, "qualsiasi tasto", tocco per iniziare |
| `language.js` | bandiere per la scelta della lingua (frecce ← →) |
| `topTen.js` | tabella dei migliori punteggi |
| `menu.js` | menu di scelta (difficoltà, opzioni): salva il valore in `GAME_STATE` ed esce con un evento |
| `textCycle.js` | testi a rotazione (istruzioni, storia) |
| `custom.js` | modello per i tuoi widget |

## Aggiungere un widget

Crea `kit/widgets/<nome>.js` (parti dal modello in `custom.js`) e aggiungilo a `index.js`:

```js
export default {
    label: 'Vite rimaste',
    size: { width: 200, height: 40 },          // riquadro nell'editor
    props: [{ key: 'fontSize', label: 'Dimensione testo', type: 'number', default: 20 }],
    create(scene, item, ctx) {
        const c = scene.add.container(0, 0);
        // ...aggiungi testi/immagini a c...
        return { obj: c, update(t) {}, refresh() {} };
    }
};
```

- `obj`: l'oggetto che la timeline sposta, scala, ruota e sfuma (di solito un container);
- `update(t)`: chiamato a ogni frame con il tempo della schermata;
- `refresh()`: chiamato dopo un cambio di lingua;
- `ctx`: `services` (CONFIG, GAME_STATE…), `tr(chiave, testo)` per i dizionari, `font`,
  `editor` (vero nell'editor: niente tasti e niente effetti collaterali), `emit(evento)` per
  uscire dalla schermata (il manifest decide dove), `resetTimeout()`.
