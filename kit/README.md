# Spike Game Kit

Blocchi riutilizzabili per giochi arcade Phaser 3 (SpikeCode). Ogni blocco è una cartella
autonoma che si copia, si aggiorna e si condivide tra giochi diversi: Block Hunter è il primo
gioco che li usa.

> Il kit è anche il **motore SpikeCode** completo (`kit/engine/`, `kit/gameplay/`): un gioco si
> avvia con `startSpikeGame({...})` e un gioco nuovo si crea con `tools/new-game/new-game.js`.
> Guida: [`ENGINE.md`](ENGINE.md).

```
kit/
  engine/                avvio del gioco: startSpikeGame, preload, config, log, livelli, mapping
  gameplay/              la partita (mappa, player, nemici, oggetti, entità da dati)
  core/                  servizi comuni, senza nulla di specifico di un gioco
    flow.js              flusso tra le scene e identità del gioco (dal manifest)
    blocks.js            lettura del manifest e controllo dei blocchi all'avvio
    coins.js             gettoni/crediti, free play, HUD dei crediti
    i18n.js              caricamento dei dizionari data/dic/<lingua>.json
    ui.js                pannelli di testo, audio in loop, frame delle texture, firma
  blocks/
    attract/             titolo, istruzioni e storia a rotazione, gettoni, lingua, avvio 1P/2P
    language/            carosello per la scelta della lingua (usato da più blocchi)
    top-ten/             classifica dei 10 migliori punteggi
    credits/             gettoni e riconoscimenti del progetto
    config/              menu di configurazione in gioco
    level-select/        scelta della difficoltà
    game-over/           game over con continue a tempo; usa score-entry per la classifica
    score-entry/         inserimento in top ten: iniziali arcade, controllo, salvataggio
```

## Com'è fatto un blocco

Ogni cartella `kit/blocks/<id>/` contiene:

- **`index.js`**: la factory, per esempio `createTopTenScene(services)`, che restituisce la
  classe della scena Phaser. Il blocco non importa nulla: riceve tutto in `services`.
- **`block.json`**: il contratto del blocco:
  - `scene`, `factory`: chiave della scena e nome della funzione da importare;
  - `requires`: i servizi che il gioco deve passare (vedi sotto);
  - `events`: gli eventi con cui il blocco esce (`start`, `timeout`, `exit`…);
  - `config`: le chiavi di `CONFIG` (data/config.json) che legge;
  - `i18n`: le chiavi dei dizionari che mostra;
  - `assets`: texture e suoni che si aspetta già caricati (chiavi Phaser).

All'avvio `checkBlocks()` legge tutti i `block.json` del manifest e scrive nel log (e in
`window.SPIKE_KIT`) i servizi mancanti: un blocco copiato in un altro gioco dice subito cosa
gli serve.

## Il manifest del gioco

Ogni gioco ha un `game.manifest.json` nella sua cartella principale:

```json
{
  "game": { "id": "block-hunter", "title": "Block Hunter", "storagePrefix": "blockHunter" },
  "kitPath": "kit",
  "blocks": ["attract", "language", "top-ten", "credits", "config", "level-select", "game-over", "score-entry"],
  "roles": { "gameplay": "GameScene" },
  "flow": {
    "attract":  { "start": "LevelSelectScene", "idle": "TopTenScene", "config": "ConfigScene" },
    "top-ten":  { "timeout": "CreditsScene", "start": "LevelSelectScene", "exit": "AttractScene" },
    "gameplay": { "gameover": "GameOverScene" }
  }
}
```

- **`flow`**: dove porta ogni evento di ogni blocco. Nel codice un blocco scrive
  `this.scene.start(kitFlow.next('top-ten', 'timeout', 'CreditsScene'))`: il terzo valore è il
  default, usato quando il manifest non dice niente. Per cambiare l'ordine delle schermate in un
  altro gioco si modifica solo il manifest.
- **`roles`**: le scene che appartengono al gioco (es. `gameplay`), così un blocco come il
  game over può fermare o riprendere la partita senza conoscerne la chiave.
- **`game.storagePrefix`**: prefisso delle chiavi nel browser
  (`kitGame.storageKey('TopScores')` → `blockHunterTopScores`), così due giochi sullo stesso
  sito non si sovrascrivono i dati.

## Servizi

I servizi sono un unico oggetto passato a ogni factory (lo crea `startSpikeGame` in
`kit/engine/index.js`; un gioco ne aggiunge altri con l'opzione `services`). Quelli usati dai blocchi del kit:

| Servizio | Cosa fa |
|---|---|
| `Phaser` | la libreria |
| `CONFIG` | configurazione del gioco (data/config.json + preferenze salvate) |
| `GAME_STATE` | stato della partita: `score`, `credits`, `language`, `topScores`, `players`… |
| `TRANSLATIONS`, `loadTranslations` | dizionari e caricamento (kit/core/i18n.js) |
| `GAME_FONT`, `HUD_DEPTH` | font e profondità dell'interfaccia |
| `drawTextPanel`, `playLoopAudioSafely`, `addSpikeCredit` | kit/core/ui.js |
| `createCreditsManager`, `isFreeplayEnabled`, `hasStartAccessForPlayers`, `consumeCreditsForPlayers` | kit/core/coins.js |
| `createLanguageCarousel` | kit/blocks/language |
| `createNameEntry`, `isHighScore`, `insertTopScore`, `saveTopScores` | kit/blocks/score-entry |
| `resetGameStateForNewRun`, `clearRuntimeMatchStorage` | forniti dal gioco: azzerano la *sua* partita |
| `kitFlow`, `kitGame` | kit/core/flow.js |

Per i dettagli di ciascun blocco vale il suo `block.json`.

## Usare il kit in un altro gioco

Il modo più semplice è `node tools/new-game/new-game.js ../nuovo-gioco --title "Nuovo gioco"`
(vedi `ENGINE.md`): tutto il motore è già collegato. Per usare solo alcuni blocchi in un gioco
fatto diversamente:

1. Aggiungi il kit al gioco (vedi sotto) e crea il suo `game.manifest.json`.
2. In `game.js` importa le factory dei blocchi che ti servono, per esempio
   `import { createTopTenScene } from './kit/blocks/top-ten/index.js';`, e crea le scene
   passando l'oggetto dei servizi con anche `kitFlow` e `kitGame`.
3. All'avvio chiama `configureKit(await loadManifest())` (kit/core/flow.js e blocks.js) prima
   di creare `new Phaser.Game(...)`, e facoltativamente `checkBlocks(manifest, services)`.
4. Carica nel preload le texture e i suoni elencati negli `assets` dei blocchi usati e
   aggiungi ai dizionari le chiavi elencate in `i18n`.

## Spostarlo in un repo separato

Il kit è pensato per vivere nel repo `spikeengine` ed essere incluso in ogni gioco come
git submodule nella cartella `kit/`:

Tutto è già pronto in uno script (testato):

1. su GitHub crea il repository **vuoto** `superpippoub77/spikeengine` (privato, senza README);
2. dalla cartella del gioco, con tutto committato:
   ```bash
   bash tools/kit-repo/kit-to-submodule.sh      # (facoltativo: URL del repo come argomento)
   git push
   ```
   Lo script pubblica `kit/` con tutta la sua storia nel nuovo repo, toglie la copia dal gioco e
   la ricollega come submodule.
3. per il deploy (`.github/workflows/deploy.yml`, già pronto con `submodules: recursive`): nel
   repo del gioco aggiungi il secret **`KIT_TOKEN`**, un token GitHub con accesso in lettura a
   `spikeengine` (serve perché il repo del kit è privato).

Dopo: `git clone --recursive` per clonare un gioco, `git submodule update --remote kit` per
portare in un gioco l'ultima versione del motore.

## Aggiungere un blocco

1. Crea `kit/blocks/<id>/index.js` con una factory che riceve i servizi e restituisce la scena.
2. Non chiamare mai `this.scene.start('UnaScena')`: usa `kitFlow.next('<id>', '<evento>', 'Default')`.
3. Per salvare dati nel browser usa `kitGame.storageKey('Nome')`.
4. Scrivi `block.json` con `requires`, `events`, `config`, `i18n` e `assets`.
5. Aggiungi l'id a `blocks` nel manifest del gioco e collega i suoi eventi in `flow`.
