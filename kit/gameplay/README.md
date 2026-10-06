# SpikeCode · gameplay

Il motore di gioco "a griglia" (player, nemici, oggetti, dinamite, porte, chiavi…) usato da
Block Hunter. Non contiene contenuti del gioco: mappe, immagini, suoni e definizioni stanno in
`data/` e `assets/`, così lo stesso motore può far girare altri giochi con la stessa logica.

```
kit/gameplay/
  gameScene.js            scena Phaser: create / initializeGame / update + applicazione dei mixin
  scene/                  i metodi della scena divisi per argomento (mixin)
    map.js  player.js  items.js  rocks.js  dynamite.js  hud.js  effects.js
    levelflow.js  collisions.js  entities.js
    enemies/  common.js  bat.js  ghost.js  spider.js  snake.js   (nemici "storici")
  entities/               entità definite dai dati
    actions.js            cosa succede quando un'entità tocca il player, viene colpita…
    behaviours/           come si muove un'entità (un file per comportamento)
```

Ogni file di `scene/` esporta `createXMixin(deps)` che restituisce una classe; i suoi metodi
vengono copiati su `GameScene.prototype` (un nome duplicato è un errore, così due moduli non si
pestano i piedi).

## Aggiungere un nemico / personaggio / oggetto senza codice

In `data/game-entities-mapping.json`, sotto `entities`, aggiungi una voce con `behaviour`:

```json
"redghost": {
  "category": "enemy",
  "label": "Fantasma rosso",
  "tokens": ["redghost"],
  "sprite": { "texture": "ghost", "frame": 0, "animation": "ghost_float", "tint": "#ff5a5a", "scale": 1 },
  "behaviour": { "type": "chase", "speed": 60, "rangeTiles": 6 },
  "collision": { "walls": true, "radius": 0.3 },
  "touchCooldownMs": 1200,
  "on": {
    "touchPlayer":   [{ "action": "blood", "intensity": 1.5 }, { "action": "loseLife" }],
    "hitByDynamite": [{ "action": "addScore", "amount": 30 }, { "action": "explosion" },
                      { "action": "explodeDynamite" }, { "action": "destroy" },
                      { "action": "respawn", "delay": 6000 }]
  },
  "editor": { "icon": { "src": "assets/images/common/ghost.png", "frameWidth": 64, "frameHeight": 64, "frame": 0 },
              "tint": "#ff5a5a" }
}
```

- `tokens`: le parole da scrivere nella mappa (`redghost`, oppure `redghost/w0000` per
  nasconderlo sotto un muro).
- `sprite.texture`: una texture già caricata dal gioco, oppure `sprite.src` (+ `frameWidth`,
  `frameHeight`) per caricarne una nuova.
- `editor.icon`: l'immagine con cui il **level editor** mostra l'entità nella palette
  (gruppo Oggetti) e sulla griglia. Basta salvare il file: l'editor la propone da solo.

### Comportamenti (`entities/behaviours/`)

| tipo     | parametri                                   |
|----------|---------------------------------------------|
| `still`  | –                                           |
| `wander` | `speed`, `changeMs`                         |
| `patrol` | `speed`, `axis` (`x`/`y`), `rangeTiles`     |
| `chase`  | `speed`, `rangeTiles`, `changeMs`           |
| `fly`    | `speed` (attraversa i muri, rimbalza ai bordi) |

Nuovo comportamento: copia `custom.js` in `mio.js`, implementa `init(scene, sprite, params)` e
`update(scene, sprite, deltaMs, params)`, elenca i `params` con i default e registralo in
`behaviours/index.js`.

### Azioni (`entities/actions.js`)

`loseLife`, `addScore {amount}`, `sound {key, volume}`, `blood {intensity}`, `explosion`,
`explodeDynamite`, `destroy`, `respawn {delay}`, `message {text, style}`, `knockback {force}`.

Eventi: `touchPlayer` (default: sangue + vita persa) e `hitByDynamite` (default: +10, esplosione,
distruzione). Nuova azione: aggiungi una funzione `(scene, ctx, params)` all'oggetto `ACTIONS`.

## Nemici scritti a mano

Fantasma, pipistrello, ragno e serpente hanno logiche particolari (percorsi, ragnatele, coda…)
e restano in `scene/enemies/`. Per un nemico che non si riesce a esprimere con comportamenti +
azioni, crea `scene/enemies/mio.js` con `createMioMixin(deps)` e aggiungilo alla lista dei mixin
in `gameScene.js`.
