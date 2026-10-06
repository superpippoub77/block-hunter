# Motore SpikeCode

Il motore con cui è fatto Block Hunter, separato dal gioco: lo stesso motore, con gli stessi
editor, fa girare altri giochi arcade con la stessa logica (player che scava e raccoglie,
nemici, dinamite, porte e chiavi, livelli a griglia, attract mode, top ten, gettoni…).

## Cosa è motore e cosa è gioco

```
MOTORE (uguale per tutti i giochi)          GIOCO (cambia da gioco a gioco)
───────────────────────────────────         ─────────────────────────────────────────────
kit/engine/    avvio, preload, config,      game.js             startSpikeGame({...}): identità,
               log, livelli, mapping                            sprite, regole dei livelli, scene proprie
kit/core/      flusso, gettoni, lingue,     game.manifest.json  blocchi, schermate, flusso tra le scene
               effetti, widget, UI          game/               codice proprio (frame degli sprite,
kit/blocks/    attract, top ten, crediti,                       regole dei livelli, scena bonus)
               config, scelta livello,      data/               config, livelli, mapping di nemici e
               game over, iniziali,                             oggetti, schermate, dizionari
               schermate disegnate          assets/             immagini, suoni, font, icone
kit/gameplay/  la partita: mappa, player,
               nemici, oggetti, entità
kit/effects/   libreria effetti (schermate)
kit/widgets/   libreria widget (schermate)
level_editor.html  screen_editor.html  js/  css/      editor
server.js  api/                                        API per gli editor (Node in locale, PHP sul sito)
tools/build/   pacchetti web / Windows / Linux / Android
tools/new-game/  crea un nuovo gioco
```

Regola: **niente dentro `kit/` importa file fuori da `kit/`**. Il gioco passa al motore quello
che è suo; il motore non conosce Block Hunter. Per questo `kit/` potrà diventare un repository a
sé (es. `spike-game-kit`) incluso nei giochi come *git submodule*.

## Avvio: `game.js`

```js
import { startSpikeGame } from './kit/engine/index.js';
import { OBJECT_FRAMES, TILE_FRAMES, WALL_TILE_COLS } from './game/constants.js';
import { LEVEL_CONFIG } from './game/levels.js';
import { createBonusScene } from './game/scenes/bonusScene.js';

const { CONFIG, GAME_STATE } = startSpikeGame({
    identity: { id: 'block-hunter', title: 'Block Hunter', storagePrefix: 'blockHunter' },
    frames: { OBJECT_FRAMES, TILE_FRAMES, WALL_TILE_COLS },
    native: { tileWidth: 64, tileHeight: 48, objectSize: 64 },
    spritesheets: { objects: { frameWidth: 64, frameHeight: 64 }, ... },
    levels: LEVEL_CONFIG,
    newRun: { lives: 5, dynamiteCount: 20 },
    scenes: [{ key: 'BonusScene', factory: createBonusScene, after: 'GameScene' }]
});
```

| Opzione | Cosa fa |
|---|---|
| `identity` | `id`, `title`, `storagePrefix`: il prefisso di tutte le chiavi nel browser (`blockHunterTopScores`, `blockHunterConfig`, `blockHunterTestLevel`…), così due giochi sullo stesso sito non si mescolano |
| `frames` | i frame degli spritesheet `objects`, `tiles`, `wall_tiles` del gioco |
| `native` | dimensioni originali dei frame (per adattarli a `tileSize`/`objectSize` di `data/config.json`) |
| `spritesheets` | dimensione dei frame di ogni spritesheet elencato in `data/data.json` |
| `levels` | regole dei livelli (rocce, massi, velocità, via di fuga), 5 livelli per mondo |
| `newRun` | valori di inizio partita (vite, dinamite) |
| `scenes` | scene proprie del gioco: `{ key, factory, after }`; con la `key` di una scena standard la sostituiscono |
| `services` | servizi in più da passare a tutte le scene |
| `manifest` | percorso del manifest (default `game.manifest.json`) |

`index.html` carica Phaser, poi `game.js`, e quando il font è pronto chiama
`window.inizialization()`: il motore legge `game.manifest.json` e `data/config.json`, sostituisce
le scene disegnate con l'editor delle schermate e avvia Phaser.

Scene standard, nell'ordine: `PreloadScene`, `AttractScene`, `TopTenScene`, `CreditsScene`,
`ConfigScene`, `LevelSelectScene`, `GameScene`, (scene del gioco), `GameOverScene`.

## Contenuti che il motore legge

| File | Cosa contiene | Si modifica con |
|---|---|---|
| `data/config.json` | dimensioni, velocità, gettoni, lingue… | Level editor → ⋯ → Configurazione |
| `data/level/levelXY.json` | livelli (mondo X, livello Y) | Level editor (Apri / Salva, con versioni) |
| `data/game-entities-mapping.json` | nemici, personaggi e oggetti, anche nuovi senza codice | Mapping Studio · `kit/gameplay/README.md` |
| `data/game-tiles-mapping.json`, `data/game-effects-mapping.json` | terreni ed effetti | Mapping Studio |
| `data/screens/*.json` | attract, istruzioni, top ten, selezione livello | Editor delle schermate |
| `data/dic/<lingua>.json` | testi | Level editor → ⋯ → Dizionari |
| `data/data.json` | immagini e suoni da caricare | Level editor → ⋯ → Gestione asset |

## Un nuovo gioco

```
node tools/new-game/new-game.js ../space-miner --title "Space Miner"
cd ../space-miner && node server.js
```

Crea la cartella con il motore e, come punto di partenza, i contenuti di Block Hunter con la nuova
identità (nome, prefisso delle chiavi, id dell'app per i pacchetti). Poi si sostituiscono
immagini, livelli, nemici e testi; il codice proprio va in `game/` e si collega in `game.js`.

## Aggiornare il motore in un gioco

Oggi: si copia la cartella `kit/` (e, se cambiati, editor, `server.js`, `api/`, `tools/build/`)
dal gioco più aggiornato. Quando `kit/` diventerà un repository a sé:
`git submodule add <url> kit` nei giochi e `git submodule update --remote kit` per aggiornarlo.

Versione del motore: `ENGINE_VERSION` in `kit/engine/index.js` (in console: `window.SPIKE_KIT.engine`).

## Altre guide

- `kit/README.md`: blocchi, manifest, servizi
- `kit/gameplay/README.md`: nemici e oggetti da dati, comportamenti, azioni
- `kit/effects/README.md`, `kit/widgets/README.md`: librerie per le schermate
- `tools/build/README.md`: pacchetti per web, Windows, Linux, Android
