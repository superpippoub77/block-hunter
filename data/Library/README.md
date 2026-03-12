# Effect Library

Ogni effetto custom sta in `data/Library/<nome_effetto>/effect.js` e viene registrato da `data/Library/manifest.json`.

Formato consigliato del file `effect.js` (script semplice):

```js
window.__BLOCKHUNTER_EFFECT_EXPORT__ = {
  name: 'sparkle',
  aliases: ['spark'],
  defaults: {
    count: 6,
    color: '#ffe07a'
  },
  apply(api, options, meta) {
    // api.scene, api.target, api.worldX, api.worldY, api.add, api.tweens, api.time
    // api.registerFollower(displayObject, offsetX, offsetY)
    // api.parseColor(value, fallback)
    // api.readNumber(options, keys, fallback, min, max)
  }
};
```

In alternativa, se preferisci moduli ES, puoi usare anche `export default { ... }`.

Note:
- `name` e `aliases` possono poi essere usati nei token: `g(sparkle)` oppure `g(spark)`.
- `defaults` viene fuso con `effects.objects.<nome>` del livello e con override inline del token.
- Se il file non esporta un oggetto valido, l'effetto viene ignorato.

Effetti player fisici inclusi:
- `player_throw_arc`: lancio parabolico con parametri `intensity`, `angleDeg`, `gravityY`, `restitution`, `linearDamping`, `mass`, `maxBounces`, `lifeMs`.
- `player_bounce_orb`: orb con rimbalzo/attrito con parametri `intensity`, `horizontalSpeed`, `verticalSpeed`, `gravityY`, `restitution`, `friction`, `maxBounces`, `lifeMs`, `trail`.

Esempio in `objects.json` (tile/state/action):

```json
{
  "type": "spawnEffect",
  "effect": "player_throw_arc",
  "options": {
    "intensity": 1.4,
    "angleDeg": 48,
    "gravityY": 1400,
    "restitution": 0.52,
    "maxBounces": 5
  }
}
```

Per `action.type = "spawnEffect"` usa in payload:

```json
{
  "effect": "player_bounce_orb",
  "effectOptions": {
    "intensity": 1.2,
    "restitution": 0.8,
    "friction": 0.98
  }
}
```
