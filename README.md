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

## Build desktop Windows (.exe)

Il progetto ora include un wrapper Electron per generare una versione Windows installabile.

Prerequisiti:

- Node.js 18+ e npm

Comandi:

```bash
# dalla root del progetto
npm install

# avvio in modalita desktop (sviluppo)
npm run desktop:start

# genera installer Windows in release/
npm run build:win

# alternativa senza installer (ZIP), utile anche da Linux senza wine
npm run build:win:zip
```

Output atteso:

- `npm run build:win` -> cartella `release/` con installer `.exe` (target NSIS)
- `npm run build:win:zip` -> archivio `release/*.zip` con app Windows portabile

Nota:

- la build NSIS (`build:win`) da Linux richiede `wine` installato.
- nella versione desktop Electron, i dati modificabili (es. config, top score, livelli salvati) vengono salvati nella cartella utente dell'app, non dentro i file del pacchetto.

Note sugli asset

- Sprite sheet: `images/sprite.png` è attesa come griglia 4×4. Se presente, il gioco usa le dimensioni effettive delle celle (pixel-perfect) scalate da `SIZE_SCALE` per disegnare i tile del muro e altri elementi.
- Se vuoi aggiungere un'immagine di anteprima per il repository (README), mettila in `images/screenshot.png` e rinomina il file nel README (attualmente non è fornita un'immagine nel repo).

Struttura del progetto (principali file)

- `index.html` – gioco e logica principale (Canvas, loop di gioco, input, UI overlays).
- `images/sprite.png` – sprite-sheet 4×4 (opzionale, migliora la resa visiva).
- `js/game-config.js`, `js/game-state.js` – (se presenti) configurazione separata e stato runtime.

## Come viene creata la AttractScene

La schermata iniziale non e piu costruita con elementi hardcoded sparsi nella scena: oggi nasce da un flusso preciso che parte dal bootstrap del gioco, passa per la musica, e arriva agli elementi visivi dichiarati in JSON.

### 1. Bootstrap dei path e caricamento configurazioni

All'avvio, il bootstrap definisce i path principali del gioco, compreso il file dedicato alle front scene:

- `data/front-scenes.json` per il layout delle scene frontend
- `data/start.json` per impostazioni startup/plugin
- i manifest audio/immagini per attract mode e game mode

Durante l'inizializzazione viene chiamato il loader delle front scene, che legge `data/front-scenes.json` e lo rende disponibile al runtime.

### 2. Avvio della AttractScene

Quando il gioco entra in AttractScene, la scena esegue questi passaggi in ordine:

1. ferma eventuale musica di gioco gia in esecuzione
2. inizializza lo stato condiviso della UI frontend
3. avvia la musica di intro con `intro_bgm`
4. disegna background e overlay base
5. carica le traduzioni della lingua corrente
6. applica il layout dichiarato in `data/front-scenes.json`
7. avvia eventuale timeline/tween configurata per gli elementi

In pratica: la scena orchestra il flusso, ma i contenuti visuali arrivano dal JSON.

### 3. Musica della schermata attract

La musica della schermata iniziale viene fatta partire direttamente dalla scena con la chiave audio `intro_bgm`.

Flusso sintetico:

- AttractScene entra in `create()`
- chiama il player audio sicuro
- il loop di intro parte con volume ridotto
- quando il giocatore avvia la partita, `intro_bgm` viene fermata prima del passaggio alla scena successiva

Questo permette di tenere separati:

- il controllo del ciclo audio dentro la scena
- i contenuti visuali dentro `front-scenes.json`

### 4. Elementi visivi dichiarati in JSON

Gli elementi della AttractScene sono definiti nel blocco `scenes.AttractScene.elements` di `data/front-scenes.json`.

Ogni elemento puo descrivere:

- `type`: tipo di nodo, per esempio `image` o `text`
- `id`: identificatore runtime del nodo
- `src`: texture/key Phaser da usare per le immagini
- `x`, `y`: posizione nel canvas virtuale
- `w`, `h`: area di riferimento
- `scale`, `alpha`, `depth`, `origin`, `rotation`, `visible`: proprieta iniziali
- `text`: testo per i nodi testuali, anche con placeholder dinamici
- `tweens`: sequenza di animazioni da applicare

Per la AttractScene attuale gli elementi principali sono:

- `title`
- `explorer`
- `explosion_title`
- `instructions`

### 5. Tween e sequenza degli elementi

Ogni elemento puo avere un array `tweens` con una sequenza dichiarativa. Ogni tween puo definire, tra gli altri:

- `property`: proprieta da animare, per esempio `x`, `y`, `alpha`, `angle`
- `targetValue`: valore finale
- `durationMs`: durata
- `startMs`: istante di avvio relativo
- `ease`: easing Phaser
- `yoyo` e `repeat`
- `onComplete`: azione finale, per esempio distruzione del nodo

Con questo schema la AttractScene riproduce una sequenza del tipo:

1. il titolo entra dall'alto
2. il titolo vibra/ruota/lampeggia
3. l'explorer attraversa la scena
4. compare l'esplosione del titolo
5. il testo istruzioni entra e continua a oscillare

### 6. Testi dinamici e traduzioni

Gli elementi testuali possono usare placeholder come `{{t.instructions}}`.

Questo significa che:

- la scena carica prima le traduzioni della lingua corrente
- poi passa il contesto runtime al renderer frontend
- il testo finale viene risolto con i valori reali della lingua attiva

La AttractScene continua anche ad aggiornare runtime il testo delle istruzioni/storia alternata senza ricreare da zero il layout.

### 7. Cosa modificare se vuoi cambiare la AttractScene

Se vuoi cambiare la schermata attract, in generale intervieni qui:

- `data/front-scenes.json`: posizione, testi, immagini, animazioni degli elementi
- `module/scenes/AttractScene.js`: flusso scena, input, cambio scena, musica, story toggle
- `data/dic/*.json`: testi tradotti usati nei placeholder
- manifest immagini/audio: se aggiungi nuove risorse da caricare

Regola pratica:

- modifica il JSON se devi cambiare il layout o le animazioni
- modifica la scena JS se devi cambiare il comportamento runtime

### 8. Esempio mentale del flusso completo

Puoi leggere la costruzione della AttractScene cosi:

1. il bootstrap carica `front-scenes.json`
2. AttractScene parte e avvia `intro_bgm`
3. la scena prepara background, overlay e UI condivisa
4. le traduzioni vengono caricate
5. il renderer frontend crea gli elementi dal JSON
6. i tween dichiarati nel JSON animano title, explorer, explosion e instructions
7. l'input utente puo inserire crediti, cambiare lingua o avviare la partita

## Formato completo di `level<nm>.json`

I livelli sono in `data/level/level10.json`, `level11.json`, ecc.

Il motore supporta due formati mappa:
- formato nuovo: `map` oggetto con `rows`, `cols`, `tiles`
- formato legacy: `map` array 2D direttamente al root

### Template completo (con tutti i campi supportati)

```json
{
	"id": "1.1",
	"cols": 12,
	"rows": 12,
	"speed": 1,
	"escapeRoute": true,
	"objectiveLabel": "objective_collect_gems_and_survive",

	"requiredGems": 2,
	"gemsRequired": 2,
	"gemsOneByOne": false,

	"playerStart": { "row": 1, "col": 1 },
	"playerStart2": { "row": 1, "col": 2 },

	"ghost": 2,
	"ghostSpeed": 90,
	"bat": 2,
	"batSpeed": 100,

	"batFlightsBeforeRest": 4,
	"batRestSeconds": 2,
	"batRestIntervalSeconds": 0,

	"timer": 120,
	"light": "piena",

	"music": "my_track.mp3",
	"backgroundMusic": "music/my_track.mp3",

	"tokenMap": {
		"X": "w00",
		"x": "w00"
	},

	"effects": {
		"lamp": {
			"enabled": true,
			"radiusTiles": 1.6,
			"color": "#ffd88a",
			"alphaMin": 0.08,
			"alphaMax": 0.22
		},
		"pulse": {
			"scale": 1.18,
			"duration": 520
		}
	},

	"map": {
		"cols": 12,
		"rows": 12,
		"timer": 120,
		"requiredGems": 2,
		"gemsOneByOne": false,
		"ghost": 2,
		"ghostSpeed": 90,
		"bat": 2,
		"batSpeed": 100,
		"tiles": [
			["w00", "w00", "w00"],
			["w00", "-", "g"],
			["w00", "k", "d"]
		]
	},

	"staticRocks": {
		"enabled": true,
		"sizes": ["small", "medium", "large"],
		"spawnInterval": 900,
		"spawnRate": 1.2,
		"spawnCount": 1,
		"spawnCounts": [1, 2],
		"shardBurstCount": 4,

		"dynamicSize": null,
		"rotation": null,
		"chaotic": null
	},

	"dynamicBoulders": {
		"enabled": true,
		"directions": ["top", "bottom", "left", "right"],
		"sizes": ["small", "medium", "large"],
		"spawnInterval": 1400,
		"spawnRate": 0.8,
		"splitOnImpact": true,
		"splitPiecesRange": [2, 3],
		"maxSplitGeneration": 1,
		"stopAfterRotations": 6
	},

	"background": [
		{
			"src": "images/bg_11.png",
			"parallaxBgFactor": 1.0,
			"parallaxBgAlpha": 1.0,

			"offsetX": 120,
			"offsetY": 40,

			"replicaX": 3,
			"replicaY": 1,
			"replicaStepX": 500,
			"replicaStepY": 0
		}
	],

	"foreground": [
		{
			"src": "images/foreground.png",
			"parallaxFgFactor": 1.0,
			"parallaxFgAlpha": 1.0,

			"left": 0,
			"top": 0,

			"repeatX": "*",
			"repeatY": 1,
			"repeatStepX": 800,
			"repeatStepY": 600
		}
	],

	"rain": {
		"enabled": true,
		"intensity": 2.0,
		"frequency": 200,
		"wind": 120,
		"direction": "random",
		"interval": 20,
		"duration": 10
	},

	"fog": {
		"enabled": true,
		"alpha": 0.2,
		"layers": 4,
		"density": 5,
		"speed": "slow",
		"direction": "left"
	},

	"bonus": {
		"enabled": false,
		"name": "bonus1",
		"label": "BONUS CARRELLO",
		"criteria": {
			"mode": "all",
			"points": 120,
			"keysCollected": 1
		},
		"rewardScore": 120,
		"pepitaScore": 12,
		"baseSpeed": 280,
		"minSpeed": 180,
		"maxSpeed": 520,
		"speedStep": 340,
		"jumpVelocity": 600,
		"graceMs": 500
	},

	"enemies": null,
	"collectibles": null,
	"traps": null,
	"spawnPoints": null,
	"timeLimit": null,
	"scoreRules": null,
	"backgroundEnabled": true
}
```

### Significato campi (runtime)

Campi root principali:

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `id` | string | es. `"1.1"` | Identificatore logico del livello. |
| `rows`, `cols` | number | interi > 0 | Dimensione mappa (usati soprattutto nel formato legacy). |
| `speed` | number | > 0 | Moltiplicatore velocita' per massi dinamici. |
| `escapeRoute` | boolean | `true/false` | Se `true` abilita meccanica chiave/porta per uscita. |
| `objectiveLabel` | string | chiave dizionario | Testo obiettivo mostrato a inizio livello. |
| `requiredGems` | number | intero >= 0 | Gemme richieste per sbloccare uscita. Priorita' alta. |
| `gemsRequired` | number | intero >= 0 | Alias legacy di `requiredGems`. |
| `gemsOneByOne` | boolean | `true/false` | Se le gemme appaiono una per volta. |
| `timer` | number | secondi > 0 | Timer livello (fallback su `map.timer`). |
| `light` | string | `piena`, `spenta`, `fissa`, `flash`, `off`, `full`, `fixed`, `lightning` | Modalita' illuminazione. |
| `music` | string | file/path | Musica livello (cerca in `data/music/` se passi solo nome file). |
| `backgroundMusic` | string | file/path | Alias di `music`. |
| `tokenMap` | object | mappa stringa->stringa | Alias token mappa (es. `"X": "w00"`). |

Spawn player:

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `playerStart` | object | `{ row, col }` | Spawn player 1 in coordinate griglia. |
| `playerStart2` | object | `{ row, col }` | Spawn player 2 (se attivo). |

Nemici:

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `ghost` | number | intero >= 0 | Numero fantasmi da spawnare. |
| `ghostSpeed` | number | > 0 | Velocita' fantasmi. |
| `bat` | number | intero >= 0 | Numero pipistrelli da spawnare. |
| `batSpeed` | number | > 0 | Velocita' pipistrelli. |
| `batFlightsBeforeRest` | number | intero >= 1 | Voli prima del riposo (se non usi intervallo fisso). |
| `batRestSeconds` | number | > 0 | Durata riposo pipistrello. |
| `batRestIntervalSeconds` | number | >= 0 | Se >0 usa riposo periodico ogni N secondi. |

`map` (formato nuovo):

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `map.cols`, `map.rows` | number | interi > 0 | Dimensione mappa. |
| `map.tiles` | array 2D | token string | Griglia token. |
| `map.timer` | number | secondi > 0 | Alias timer locale mappa. |
| `map.requiredGems` | number | intero >= 0 | Alias locale di `requiredGems`. |
| `map.gemsOneByOne` | boolean | `true/false` | Alias locale di `gemsOneByOne`. |
| `map.ghost`, `map.ghostSpeed` | number | come root | Alias locali per ghost. |
| `map.bat`, `map.batSpeed` | number | come root | Alias locali per bat. |

Token mappa (sintassi runtime):

- `exit` -> livello successivo.
- `exit[12]` -> vai al livello `1.2`.
- `back` -> livello precedente.
- `back[11]` -> vai al livello `1.1`.
- `token(effetto)` -> applica un effetto standard al token (es. `g(lamp)`).
- `token(effetto1,effetto2)` -> applica piu' effetti (es. `g(lamp,pulse)`).
- `token(effetto{opzioni})` -> override per singolo token (es. `g(lamp{radiusTiles:2;color:#ffee99})`).
- Compatibile con target livello: `exit[12](halo)` oppure `back[11](outline{thickness:3})`.

Note parsing token:

- Gli override inline supportano separatori `:` o `=` tra chiave e valore.
- Le opzioni in `{...}` possono essere separate da `;` o `,`.
- I colori supportati sono `#rrggbb` o `0xrrggbb`.
- Le opzioni inline sovrascrivono quelle globali definite in `effects`.

Effetti configurabili a livello (`effects`):

La sezione root `effects` permette di definire i parametri standard per ogni effetto. Ogni token che usa quell'effetto eredita questi valori, salvo override inline.

Effetti disponibili:

| Effetto | Parametri principali |
|---|---|
| `lamp` | `enabled`, `radiusTiles`/`radiusPixels`, `color`, `alpha`/`alphaStart`, `alphaMin`, `alphaMax`, `scaleMin`, `scaleMax`, `durationMin`, `durationMax`, `depth`, `addBlend` |
| `pulse` | `enabled`, `scale`/`scaleMultiplier`, `duration` |
| `float` | `enabled`, `amplitudeTiles`/`amplitudePixels`, `duration` |
| `halo` | `enabled`, `radiusTiles`/`radiusPixels`, `color`, `alpha`, `depth`, `addBlend` |
| `outline` | `enabled`, `radiusTiles`/`radiusPixels`, `thickness`/`strokeWidth`, `color`, `strokeAlpha`, `alphaMin`, `alphaMax`, `duration`, `depth` |

Esempio completo (globale + inline):

```json
{
	"effects": {
		"lamp": { "radiusTiles": 1.5, "color": "#ffd88a" },
		"pulse": { "scale": 1.15, "duration": 480 },
		"outline": { "color": "#ffffff", "thickness": 2 }
	},
	"map": {
		"tiles": [
			["g(lamp)", "g(lamp{radiusTiles:2;color:#ffee99},pulse)", "exit[12](halo)"],
			["back[11](outline{thickness:3})", "-", "k(float)"]
		]
	}
}
```

Rocce statiche (`staticRocks`):

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `enabled` | boolean | `true/false` | Abilita spawn rocce statiche. |
| `sizes` | array | `small`, `medium`, `large` | Taglie possibili rocce. |
| `spawnInterval` | number | ms > 0 | Intervallo spawn (priorita' alta). |
| `spawnRate` | number | spawn/s > 0 | Alternativa a `spawnInterval`. |
| `spawnCount` | number | intero >= 1 | Rocce per tick fisse. |
| `spawnCounts` | array | interi >= 1 | Rocce per tick random da elenco. |
| `shardBurstCount` | number | intero >= 0 | Quanti burst schegge durante la partita. |
| `dynamicSize`, `rotation`, `chaotic` | any | legacy | Campi presenti in alcuni file, attualmente non influenzano il runtime corrente. |

Massi dinamici (`dynamicBoulders`):

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `enabled` | boolean | `true/false` | Abilita massi dinamici. |
| `directions` | array | `top`, `bottom`, `left`, `right` | Direzioni di ingresso. |
| `sizes` | array | `small`, `medium`, `large` | Taglie possibili massi. |
| `spawnInterval` | number | ms > 0 | Intervallo spawn (priorita' alta). |
| `spawnRate` | number | spawn/s > 0 | Alternativa a `spawnInterval`. |
| `splitOnImpact` | boolean | `true/false` | Se i massi si dividono sugli impatti. |
| `splitPiecesRange` | array | `[min,max]` interi >=1 | Numero frammenti generati allo split. |
| `maxSplitGeneration` | number | intero >= 0 | Profondita' massima split. |
| `stopAfterRotations` | number | intero > 0 | Ferma il masso dopo N rotazioni complete. |

Background / foreground (singolo oggetto o array di oggetti):

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `src` | string/number | path texture, key texture, numero | Sorgente layer. Numero -> `game_bg_<n>`. |
| `parallaxBgFactor` | number | >= 0 | Scroll factor background. |
| `parallaxBgAlpha` | number | 0..1 | Alpha background. |
| `parallaxFgFactor` | number | >= 0 | Scroll factor foreground. |
| `parallaxFgAlpha` | number | 0..1 | Alpha foreground. |
| `offsetX` / `left` / `x` / `positionX` | number | pixel | Offset orizzontale layer. |
| `offsetY` / `top` / `y` / `positionY` | number | pixel | Offset verticale layer. |
| `repeatX` / `replicaX` / `repeatCountX` / `replicaCountX` | number/string | intero >=1 o `"*"` | Numero repliche asse X (`"*"` = ripetizione estesa automatica). |
| `repeatY` / `replicaY` / `repeatCountY` / `replicaCountY` | number/string | intero >=1 o `"*"` | Numero repliche asse Y. |
| `repeatStepX` / `replicaStepX` / `repeatOffsetX` / `replicaOffsetX` | number | pixel | Passo tra repliche asse X (default larghezza layer). |
| `repeatStepY` / `replicaStepY` / `repeatOffsetY` / `replicaOffsetY` | number | pixel | Passo tra repliche asse Y (default altezza layer). |

Effetti meteo:

`rain`:

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `enabled` | boolean | `true/false` | Abilita pioggia. |
| `intensity` | number | 0.1..5 | Intensita' (quantita' gocce). |
| `frequency` | number | 20..2000 ms | Frequenza emissione gocce. |
| `wind` | number | -500..500 | Drift orizzontale. |
| `direction` | string | `down`, `left`, `right`, `random` | Direzione prevalente pioggia. |
| `interval` | number | secondi >= 0 | Intervallo tra burst (se usi burst). |
| `duration` | number | secondi >= 0 | Durata burst pioggia. |

`fog`:

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `enabled` | boolean | `true/false` | Abilita nebbia decorativa. |
| `alpha` | number | 0..1 | Opacita' nebbia. |
| `layers` | number | intero >= 1 | Numero layer nebbia. |
| `density` | number | intero >= 2 | Blob per layer. |
| `speed` | string | `slow`, `fast` | Velocita' movimento. |
| `direction` | string | `left`, `right` | Direzione scorrimento nebbia. |

Bonus (`bonus`):

Il campo e' previsto nei livelli e mantenuto per compatibilita'. La logica bonus dedicata dipende dal flusso scena bonus.

| Campo | Tipo | Valori | Significato |
|---|---|---|---|
| `enabled` | boolean | `true/false` | Abilita blocco bonus. |
| `name`, `label` | string | libero | Nome/etichetta bonus. |
| `criteria.mode` | string | es. `all` | Modalita' criteri. |
| `criteria.points` | number | >= 0 | Punteggio richiesto. |
| `criteria.keysCollected` | number | >= 0 | Chiavi richieste. |
| `rewardScore`, `pepitaScore` | number | >= 0 | Ricompense punteggio. |
| `baseSpeed`, `minSpeed`, `maxSpeed`, `speedStep`, `jumpVelocity`, `graceMs` | number | dipende dal bonus | Parametri dinamica bonus. |

Campi legacy/metadata trovati in alcuni JSON:

| Campo | Stato |
|---|---|
| `backgroundEnabled` | usato dall'editor livello, non dal runtime principale |
| `enemies`, `collectibles`, `traps`, `spawnPoints`, `timeLimit`, `scoreRules` | metadata/placeholder: attualmente non letti nel flusso principale |

### Esempi rapidi

Background ripetuto orizzontalmente all'infinito pratico:

```json
"background": [
	{
		"src": "images/bg_11.png",
		"parallaxBgFactor": 1.0,
		"parallaxBgAlpha": 1.0,
		"offsetX": 120,
		"offsetY": 40,
		"repeatX": "*",
		"repeatY": 1,
		"repeatStepX": 800,
		"repeatStepY": 600
	}
]
```

Foreground con 3 copie allineate:

```json
"foreground": [
	{
		"src": "images/foreground.png",
		"parallaxFgFactor": 1,
		"parallaxFgAlpha": 1,
		"replicaX": 3,
		"replicaY": 1,
		"replicaStepX": 500,
		"replicaStepY": 0
	}
]
```

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