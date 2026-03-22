# Block Hunter - Manuale Utente e Specifiche Tecniche Scena per Scena

Versione: 2026-03-22
Ambito: manuale leggibile per utenti e riferimento tecnico completo per modifiche indipendenti.

---

## 1. Manuale Utente (non tecnico)

### 1.1 Avvio del gioco

Metodo consigliato:
1. Apri terminale nella root progetto.
2. Esegui `npm start` oppure `python -m http.server 8000`.
3. Apri browser su `http://localhost:8000`.

Nota: il gioco usa asset locali (immagini/audio/json). Evita apertura diretta file `index.html` senza server.

### 1.2 Comandi principali in gioco

- Inserisci credito: `5` o `6`
- Avvio 1 giocatore: `1`
- Avvio 2 giocatori: `2`
- Cambio lingua in menu: `LEFT` / `RIGHT`
- Configurazione: `T` (in attract)
- Uscita schermata config: `ESC`
- Fullscreen toggle: pulsante in alto o tasto `F`

### 1.3 Obiettivo base

- Seleziona difficolta.
- Raccogli gemme richieste.
- Sopravvivi a nemici e ostacoli.
- Sblocca e raggiungi uscita.

### 1.4 Problemi comuni

- Schermo deformato: controlla che sia attivo `FIT` in `data/config.json` e che il browser non applichi zoom custom.
- Audio mancante: verifica path in `assets/music/...`.
- Lingua non aggiornata: verifica file in `data/dic/*.json`.

---

## 2. Architettura generale

### 2.1 Entry point

File: `game.js`

Responsabilita principali:
- importa tutte le scene da `module/scenes/*.js`
- costruisce `sceneDeps`
- crea classi scena con `createXScene(sceneDeps)`
- espone `window.inizialization`

Chiamata principale:
```js
window.inizialization = inizialization;
```

### 2.2 Bootstrap Phaser

File: `module/bootstrap.js`

Funzione:
```js
async function inizialization(deps)
```

Parametri chiave:
- `Phaser`
- `configStore` (CONFIG runtime)
- `gameState` (stato globale)
- scene classes (`preloadScene`, `attractScene`, ...)
- `instrumentSceneMethods`
- `loadGameplayMappings`
- `logger`

Comportamento chiave:
- carica `data/config.json`
- imposta scaling (`FIT` consigliato in responsive)
- crea `new Phaser.Game(config)`
- aggancia listener resize/orientation

### 2.3 Dipendenze condivise delle scene

Ogni scena riceve `sceneDeps` con:
- dati globali: `CONFIG`, `GAME_STATE`, `TRANSLATIONS`
- utility: `loadTranslations`, `drawTextPanel`, `playLoopAudioSafely`, `addSpikeCredit`
- servizi UI: `createCreditsManager`, `createLanguageCarousel`
- costanti grafiche: `OBJECT_FRAMES`, `TILE_FRAMES`

---

## 3. Specifiche scena per scena

## 3.1 PreloadScene

File: `module/scenes/preloadScene.js`

Scopo:
- mostra loading
- carica manifest e livelli
- prepara asset runtime

Metodi principali:
- `getPreloadMetrics(width, height)`
- `applyPreloadLayout(width, height)`
- `preload()`
- `createAssets()`
- `create()`

Punti modifica rapida:
- testo loading: dentro `preload()`
- lista file caricati: callback `this.load.on('filecomplete', ...)`
- layout responsive: `applyPreloadLayout`

Chiamata esempio (forzare relayout manuale):
```js
this.applyPreloadLayout(this.scale.width, this.scale.height);
```

---

## 3.2 AttractScene

File: `module/scenes/attractScene.js`

Scopo:
- schermata iniziale con titolo
- crediti, lingua, timeout attract
- ingresso a Config e avvio partita

Metodi principali:
- `getAttractMetrics(width, height)`
- `applyResponsiveLayout(width, height)`
- `create()`
- `setupInput()`
- `toggleStory()`
- `openConfig()`
- `insertCoin()`
- `startGame(players)`
- `changeLanguage(dir)`
- `updateUI()`
- `resetTimeout()`

Parametri importanti:
- `players` in `startGame(players)` valori: `1` o `2`
- `dir` in `changeLanguage(dir)` valori: `-1` o `1`

Punti modifica rapida:
- musica attract: `playLoopAudioSafely(this, 'intro_bgm', volume)`
- animazioni titolo: blocchi `this.tweens.add(...)`
- timeout attract: `CONFIG.attractTimeout`

---

## 3.3 TopTenScene

File: `module/scenes/topTenScene.js`

Scopo:
- mostra classifica top score
- supporta crediti e cambio lingua

Metodi principali:
- `getTopTenMetrics(width, height)`
- `applyResponsiveLayout(width, height)`
- `create()`
- `setupInput()`
- `changeLanguage(dir)`
- `insertCoin()`
- `updateUI()`

Dati usati:
- `GAME_STATE.topScores` array max 10 elementi
- ogni entry: `{ name, score, level }`

Punti modifica rapida:
- colonne nome/livello/score: in `create()`
- ritmo animazioni righe: delay e tween per ogni entry

---

## 3.4 CreditsScene

File: `module/scenes/creditsScene.js`

Scopo:
- mostra credits progetto
- lingua/crediti/start game come schermate menu

Metodi principali:
- `getCreditsMetrics(width, height)`
- `applyCreditsLayout(width, height)`
- `create()`
- callback interne assegnate in `create()`:
- `changeLangCredits(dir)`
- `insertCoinCredits()`
- `updateCreditsUI()`
- `resetCreditsTimer()`

Sorgente contenuti credits:
- preferito: `CONFIG.creditsScene.lines`
- fallback hardcoded nella scena

Punti modifica rapida:
- timeout credits: `CONFIG.creditsTimeout`
- linee credits: `data/config.json` -> `creditsScene.lines`

---

## 3.5 ConfigScene

File: `module/scenes/configScene.js`

Scopo:
- editor runtime dei parametri di gioco
- preview sprite e tile
- salvataggio localStorage

Metodi principali:
- `getConfigResponsiveMetrics(width, height)`
- `applyResponsiveLayout(width, height)`
- `create()`

Funzionalita chiave:
- controlli tile/object/player size
- editor "ALL CONFIG (LIVE)" con scroll
- pulsanti `APPLY` e `RESET`

Persistenza:
- key storage: `blockHunterConfig`

Punti modifica rapida:
- range min/max size: nei handler `tileMinus/tilePlus`, `objMinus/objPlus`, `playerMinus/playerPlus`
- passo incremento numeri editor: funzione `adjustNumber`

---

## 3.6 LevelSelectScene

File: `module/scenes/levelSelectScene.js`

Scopo:
- scelta difficolta prima della partita

Metodi principali:
- `getLevelSelectMetrics(width, height)`
- `applyResponsiveLayout(width, height)`
- `create()`

Struttura difficolta:
```js
this.difficulties = [
  { name: t.beginner, mult: 0.8 },
  { name: t.medium, mult: 1.0 },
  { name: t.hard || t.expert, mult: 1.3 }
];
```

Punti modifica rapida:
- valori moltiplicatore difficolta: `mult`
- colori selezione e box: `updateSelection`

---

## 3.7 GameScene (core gameplay)

File: `module/scenes/gameScene.js`

Scopo:
- gameplay completo: mappa, player, nemici, oggetti, HUD, timer, progressione

Metodi chiave (piu usati per estensioni):
- boot/logica base:
- `create()`
- `initializeGame()`
- `createTilemap()`
- `createPlayer()`
- HUD:
- `getHudResponsiveMetrics()`
- `createUI()`
- `updateHudLayout()`
- `updateUITexts()`
- `refreshHudIcons()`
- progressione:
- `levelComplete(forcedLevelIndex)`
- `goToPreviousLevel(forcedLevelIndex)`
- `gameOver()`
- raccolte/azioni:
- `collectGem(player, gem)`
- `collectItem(player, item)`
- `shootDynamite()`
- `explodeDynamite(dynamite)`
- timer/luci:
- `setupLevelTimer()`
- `updateTimerBar()`
- `setupLevelLightEffect()`
- input:
- `setupInput()`
- update frame:
- `update(time, delta)`

Parametri importanti:
- `forcedLevelIndex`: numero livello target (0-based)
- `time`, `delta` in `update`: valori Phaser standard

Dati livello caricati da JSON:
- `data/level/levelXX.json`
- campi usati: map, timer, ghost, bat, snake, spider, requiredGems, background, foreground, effects, tokenMap, bonus

Punti modifica rapida:
- velocita player: `CONFIG.playerSpeed`
- spawn nemici: `getGhostCountForLevel`, `getBatCountForLevel`, etc.
- HUD top/bottom: `createUI` + `updateHudLayout`
- logica gemme/uscita: `collectGem` + `activateHole2Exits`

---

## 3.8 BonusScene

File: `module/scenes/bonusScene.js`

Scopo:
- minigioco bonus separato

Metodi principali:
- `init(data)`
- `preload()`
- `create()`
- `spawnBonusFallingRock()`
- `shootBonusDynamite()`
- `updateBonusHud()`
- `completeBonus()`
- `failBonus()`
- `update(time, delta)`

Parametri `init(data)` tipici:
- livello ritorno
- reward score
- opzioni bonus

---

## 3.9 GameOverScene

File: `module/scenes/gameOverScene.js`

Scopo:
- game over
- inserimento nome top score (3 lettere)

Metodi principali:
- `getGameOverMetrics(width, height)`
- `applyGameOverLayout(width, height)`
- `create()`
- `saveScore()`
- `_formatNameDisplay()`
- `_cycleLetter(delta)`
- `_confirmLetter()`
- `_goBackLetter()`

Flusso top score:
1. verifica score > ultimo in top10
2. mostra inserimento nome
3. salva su API `/api/top-scores` o fallback localStorage
4. passa a TopTenScene

---

## 4. Utility condivise e API pratiche

## 4.1 createCreditsManager

File: `module/creditsManager.js`

Firma:
```js
createCreditsManager(scene, opts = {})
```

`opts` supportati:
- `gameState`
- `config`
- `hudDepth`
- `font`
- `x`

Return:
- `insertCoin({ volume = 0.45, onChange })`
- `setCredits(n)`
- `updateTexts()`

Uso tipico:
```js
this.creditManager = createCreditsManager(this, {
  gameState: GAME_STATE,
  config: CONFIG,
  hudDepth: HUD_DEPTH,
  font: GAME_FONT,
  x: 400
});
```

## 4.2 createLanguageCarousel

File: `module/languageCarousel.js`

Firma:
```js
createLanguageCarousel(scene, opts = {})
```

`opts` supportati:
- `languages`
- `index`
- `x`, `y`
- `hudDepth`
- `font`
- `onRequestChange(dir)`
- `onIndexChange(index, lang, dir)`

Return:
- `flagSprite`
- `leftArrow`
- `rightArrow`
- `pulseArrow(arrow)`
- `setIndex(newIndex, dir)`

## 4.3 State utils

File: `module/stateUtils.js`

Funzioni:
- `isFreeplayEnabled(config)`
- `hasStartAccessForPlayers(config, gameState, players)`
- `consumeCreditsForPlayers(config, gameState, players)`
- `clearRuntimeMatchStorage(logger)`
- `resetGameStateForNewRun(gameState, clearRuntimeStorage, logger, players = 1)`

## 4.4 Config and preload utils

File: `module/configUtils.js`
- `mergeLocalConfig(config, objectNativeSize, logger)`
- `loadTranslations(lang, translations, logger, callback)`

File: `module/preloadUtils.js`
- `queueLegacyPreloadAssets(scene, logger, preloadSpritesheetConfigs)`
- `queueAssetsFromManifest(scene, manifest, logger, preloadSpritesheetConfigs)`

---

## 5. Come modificare un singolo componente (procedura indipendente)

Esempio: cambiare solo il timer HUD in GameScene.

1. Apri `module/scenes/gameScene.js`.
2. Cerca `setupLevelTimer()` e `updateTimerBar()`.
3. Cerca `createUI()` per label/timer icone.
4. Applica modifica solo in quei metodi.
5. Se tocchi dimensioni/posizione, aggiorna `getHudResponsiveMetrics()`.
6. Verifica relayout in `updateHudLayout()`.
7. Avvia gioco e testa desktop + mobile + portrait + landscape.
8. Se ok, aggiorna documentazione tecnica.

Regola generale:
- Modifica comportamento: metodo funzionale.
- Modifica testo/label: `updateUI` o `updateUITexts`.
- Modifica layout responsive: `get*Metrics` + `apply*Layout`.
- Modifica asset: preload e mapping path in manifest/config.

---

## 6. Parametri di configurazione principali

File: `data/config.json`

Campi piu usati:
- `width`, `height`
- `tileSize`, `objectSize`, `playerSize`
- `playerSpeed`, `ghostSpeed`, `batSpeed`
- `dynamiteSpeed`, `dynamiteLifetime`
- `attractTimeout`, `topTenTimeout`
- `scaleMode`, `mobileScaleMode`, `responsiveMode`
- `freeplay`, `enableFullscreen`

Consiglio responsive:
- usa `scaleMode: "FIT"`
- usa `mobileScaleMode: "FIT"`
- mantieni `responsiveMode: true`

---

## 7. Creare un livello da zero (guida completa)

Questa sezione ti rende indipendente nella creazione/modifica livelli in `data/level/*.json`.

### 7.1 Dove creare il file

Cartella livelli:
- `data/level/`

Convenzione file:
- `level10.json`, `level11.json`, ..., `level54.json`

Regola pratica:
- per un nuovo livello, copia un livello esistente simile e modifica i parametri uno alla volta.

### 7.2 Template minimo funzionante

Usa questo come base sicura:

```json
{
  "id": "1.0",
  "requiredGems": 3,
  "map": {
    "cols": 20,
    "rows": 15,
    "timer": 120,
    "gemsOneByOne": false,
    "tiles": [
      ["-","-","-","-","-"],
      ["-","w0000","w0000","w0000","-"],
      ["-","k","g","d","-"],
      ["-","-","-","-","-"]
    ]
  }
}
```

Nota:
- `tiles` deve avere numero righe coerente con `rows`.
- ogni riga `tiles` deve avere numero colonne coerente con `cols`.

### 7.3 Parametri livello: significato campo per campo

Campi root principali:

| Campo | Tipo | Esempio | Significato pratico |
|---|---|---|---|
| `id` | string | `"1.3"` | Id logico del livello. |
| `requiredGems` | number | `4` | Gemme necessarie per sbloccare uscita. |
| `gemsRequired` | number | `4` | Alias legacy di `requiredGems`. |
| `gemsOneByOne` | boolean | `true` | Gemme una per volta se `true`. |
| `timer` | number | `90` | Tempo in secondi (fallback root). |
| `light` | string | `"piena"` | Modalita luce (`piena`, `spenta`, `fissa`, `flash`). |
| `music` | string | `"level1.mp3"` | Musica livello. |
| `backgroundMusic` | string | `"assets/music/..."` | Alias di `music`. |
| `escapeRoute` | boolean | `true` | Attiva logica chiave/porta/uscita. |
| `objectiveLabel` | string | `"objective_collect_gems_and_escape"` | Chiave testo traduzioni a inizio livello. |

Spawn e difficolta nemici:

| Campo | Tipo | Esempio | Effetto |
|---|---|---|---|
| `ghost` | number | `2` | Numero fantasmi. |
| `ghostSpeed` | number | `90` | Velocita fantasmi. |
| `bat` | number | `1` | Numero pipistrelli. |
| `batSpeed` | number | `110` | Velocita pipistrelli. |
| `spider` | number | `2` | Numero ragni. |
| `spiderSpeed` | number | `95` | Velocita ragni. |
| `snake` | number | `1` | Numero serpenti. |
| `snakeSpeed` | number | `105` | Velocita serpenti. |

### 7.4 Sezione `map` (consigliata)

Formato moderno:

```json
"map": {
  "cols": 40,
  "rows": 32,
  "timer": 120,
  "requiredGems": 6,
  "gemsOneByOne": false,
  "tiles": [["-","-"],["w0000","g"]]
}
```

Campi:

| Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `map.cols` | number | si | larghezza griglia |
| `map.rows` | number | si | altezza griglia |
| `map.tiles` | array 2D | si | token della mappa |
| `map.timer` | number | no | sovrascrive timer root |
| `map.requiredGems` | number | no | sovrascrive requiredGems root |
| `map.gemsOneByOne` | boolean | no | sovrascrive root |

### 7.5 Token mappa (oggetti singola cella)

Token base piu usati:

| Token | Significato |
|---|---|
| `"-"` | cella vuota/camminabile |
| `"w"` / `"w0000"` | muro |
| `"h"` | buco tipo 1 |
| `"s"` | buco tipo 2 |
| `"g"` | gemma |
| `"d"` | porta |
| `"k"` | chiave |
| `"p"` | pepita/vita |
| `"b"` | cassa dinamite |
| `"c"` | power-up carrello |
| `"m"` | item companion/helper |
| `"ghost"` | marker spawn fantasma |
| `"bat"` | marker spawn pipistrello |

Token avanzati supportati:
- `exit` -> uscita livello successivo
- `exit[1.2]` -> uscita verso livello specifico
- `back` -> ritorno livello precedente
- `back[1.1]` -> ritorno livello specifico

### 7.6 `tokenMap` (alias simboli)

Serve per scrivere mappe piu leggibili:

```json
"tokenMap": {
  "#": "w0000",
  "x": "w0000"
}
```

Poi in `tiles` puoi usare `"#"` o `"x"` invece di `"w0000"`.

### 7.7 Effetti per singolo token

Sintassi supportata:
- `token(effetto)`
- `token(effetto1,effetto2)`
- `token(effetto{opzioni})`

Esempi:
- `"k(lamp)"`
- `"g(lamp,pulse)"`
- `"k(lamp{depth:3200;alpha:0.24;alphaMax:0.42})"`
- `"exit[1.2](halo)"`

Effetti disponibili:
- `lamp`
- `pulse`
- `float`
- `halo`
- `outline`

Config globale effetti (root `effects`):

```json
"effects": {
  "lamp": { "radiusTiles": 1.5, "color": "#ffd88a" },
  "pulse": { "scale": 1.15, "duration": 480 }
}
```

### 7.8 Background e foreground livello

Puoi usare stringa singola o array di layer.

Esempio:

```json
"background": [
  {
    "src": "assets/images/background/level1.png",
    "parallaxBgFactor": 1,
    "parallaxBgAlpha": 1,
    "repeatX": "*",
    "repeatY": 1,
    "repeatStepX": 800
  }
]
```

Parametri importanti:
- `src`: path o key texture
- `parallaxBgFactor` / `parallaxFgFactor`: velocita scrolling
- `parallaxBgAlpha` / `parallaxFgAlpha`: trasparenza
- `offsetX`, `offsetY`: spostamento layer
- `repeatX`, `repeatY`: repliche layer

### 7.9 Rocce statiche e massi dinamici

Rocce statiche:

```json
"staticRocks": {
  "enabled": true,
  "sizes": ["small","medium","large"],
  "spawnInterval": 900,
  "spawnCount": 1,
  "shardBurstCount": 4
}
```

Massi dinamici:

```json
"dynamicBoulders": {
  "enabled": true,
  "directions": ["top","left","right"],
  "sizes": ["small","medium"],
  "spawnInterval": 1400,
  "splitOnImpact": true,
  "splitPiecesRange": [2,3],
  "maxSplitGeneration": 1,
  "stopAfterRotations": 6
}
```

### 7.10 Meteo e atmosfera

Pioggia:

```json
"rain": {
  "enabled": true,
  "intensity": 2,
  "frequency": 200,
  "wind": 120,
  "direction": "random",
  "interval": 20,
  "duration": 10
}
```

Nebbia:

```json
"fog": {
  "enabled": true,
  "alpha": 0.2,
  "layers": 4,
  "density": 5,
  "speed": "slow",
  "direction": "left"
}
```

### 7.11 Bonus per livello

```json
"bonus": {
  "enabled": true,
  "name": "bonus1",
  "label": "BONUS CARRELLO",
  "criteria": { "mode": "all", "points": 120, "keysCollected": 1 },
  "rewardScore": 120,
  "pepitaScore": 12
}
```

### 7.12 Procedura completa: creare livello nuovo in 10 passi

1. Duplica un livello simile in `data/level/`.
2. Rinomina file (es. `level55.json`).
3. Aggiorna `id`.
4. Definisci `map.cols`, `map.rows`.
5. Costruisci `map.tiles` rispettando righe/colonne.
6. Imposta `requiredGems` e `timer`.
7. Inserisci token gameplay (`g`, `k`, `d`, `exit[...]`, nemici).
8. Testa in gioco e controlla console errori.
9. Bilancia velocita e spawn (`ghostSpeed`, `dynamicBoulders`, ecc.).
10. Rifinisci visual (`background`, effetti token, luce).

### 7.13 Errori tipici e correzione rapida

- Errore: mappa non caricata.
  Causa: JSON invalido.
  Fix: valida JSON e virgole finali.

- Errore: livello vuoto o elementi mancanti.
  Causa: token non supportato.
  Fix: usa token tabella 7.5 o mappa alias in `tokenMap`.

- Errore: uscita non si apre.
  Causa: `requiredGems` troppo alto o nessuna gemma spawnata.
  Fix: allinea `requiredGems` al numero gemme reali.

- Errore: layout strano in schermi diversi.
  Causa: background/foreground con repeat/offset incoerenti.
  Fix: parti da 1 layer semplice e poi aggiungi repliche.

---

## 8. Reference rapido file per tipo modifica

- gameplay core: `module/scenes/gameScene.js`
- scene menu: `module/scenes/attractScene.js`, `module/scenes/topTenScene.js`, `module/scenes/creditsScene.js`
- preload asset: `module/scenes/preloadScene.js`, `module/preloadUtils.js`
- selezione difficolta: `module/scenes/levelSelectScene.js`
- config runtime: `module/scenes/configScene.js`
- game over/top score: `module/scenes/gameOverScene.js`
- bootstrap/scaling: `module/bootstrap.js`
- wiring globale: `game.js`
- dati livelli: `data/level/*.json`
- traduzioni: `data/dic/*.json`

---

## 9. Checklist finale prima di chiudere una modifica

1. Test scena toccata in desktop window grande.
2. Test scena toccata in desktop window piccola.
3. Test mobile portrait.
4. Test mobile landscape.
5. Verifica audio/sfx senza errori console.
6. Verifica che input tastiera e touch restino attivi.
7. Verifica `topScores` se hai toccato score/gameover.
8. Verifica no errori statici nel file modificato.

---

## 10. Glossario minimo

- Scene: schermata Phaser indipendente (menu, gioco, game over).
- HUD: elementi informativi a schermo (score, livello, vite, timer).
- Responsive: adattamento automatico a risoluzione/orientamento.
- FIT: scaling che mantiene tutto visibile senza distorsione.
- ENVELOP: scaling che puo ritagliare su viewport stretti.

---

Fine documento.
