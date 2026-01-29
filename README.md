# Block Hunter

Block Hunter è un piccolo gioco arcade in HTML5/Canvas ispirato ai classici cabinati: muovi il personaggio, raccogli gemme e sopravvivi alle ondate di massi.

Caratteristiche principali

- Grafica pixel-art con renderer programmatico e supporto a sprite-sheet 4×4 (`images/sprite.png`).
- Area giocabile "murata" con un bordo esterno percorribile (percorso di fuga) e porte che collegano le aree.
- Blocchi/masse che cadono o entrano dai bordi; dinamite, chiavi e doubloon (monete) come power-up.
- Schermata di attrazione con sistema "CREDITI" in stile MAME (press '5' per inserire moneta).
- Suoni generati via WebAudio (nessuna dipendenza esterna per audio).

Controlli

- Frecce (← ↑ → ↓): muovi il giocatore (8 direzioni supportate).
- Tasto 5: inserisci una moneta (aggiunge 1 credito).
- Enter: in schermata attract/level select serve per confermare.
- Barra spaziatrice / altri comandi di gioco sono gestiti nella UI principale.

Avviare il gioco in locale

Il modo più semplice è aprire `index.html` in un browser moderno (Chrome/Edge/Firefox). Alcuni browser bloccano i file locali per alcune funzioni (es. caricamento immagini/AudioContext); se riscontri problemi, avvia un server statico nella cartella del progetto.

Esempio (PowerShell):

```powershell
# dalla root del progetto
python -m http.server 8000
# poi apri nel browser: http://localhost:8000/
```

Note sugli asset

- Sprite sheet: `images/sprite.png` è attesa come griglia 4×4. Se presente, il gioco usa le dimensioni effettive delle celle (pixel-perfect) scalate da `SIZE_SCALE` per disegnare i tile del muro e altri elementi.
- Se vuoi aggiungere un'immagine di anteprima per il repository (README), mettila in `images/screenshot.png` e rinomina il file nel README (attualmente non è fornita un'immagine nel repo).

Struttura del progetto (principali file)

- `index.html` – gioco e logica principale (Canvas, loop di gioco, input, UI overlays).
- `images/sprite.png` – sprite-sheet 4×4 (opzionale, migliora la resa visiva).
- `js/game-config.js`, `js/game-state.js` – (se presenti) configurazione separata e stato runtime.

Consigli per sviluppo

- `SIZE_SCALE` (variabile globale) permette di ingrandire o rimpicciolire velocemente tutta la UI del gioco.
- La funzione `drawFromSheet` gestisce il disegno dei tile dalla sprite-sheet; quando aggiungi nuovi oggetti che devono rispettare la dimensione della cella, usa lo stesso calcolo di dimensione (spriteCellW/H × SIZE_SCALE) per coerenza pixel-perfect.

Contribuire

Se vuoi migliorare, ecco qualche idea:

- Aggiungere navigazione da tastiera nella schermata "PLAYERS & OPTIONS".
- Aggiungere effetti particellari extra o suoni più ricchi.
- Fornire immagini di anteprima (`images/screenshot.png`) e un logo per il README.

Licenza

Questo repository è privato/di sviluppo. Aggiungi qui la licenza desiderata (es. MIT) se intendi pubblicarlo.

---

Se vuoi, aggiungo anche un'immagine di preview (se fornisci un file) o un badge di stato. Ho lasciato istruzioni compatte su come eseguire in locale; vuoi che aggiunga comandi di build o script NPM per servire il progetto automaticamente?