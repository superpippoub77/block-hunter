# Block Hunter — Game Specification

Version: 1.0
Date: 2026-02-02
Author: (generated)

## 1 — Overview
Block Hunter is a single-page HTML5/Canvas arcade game inspired by classic block/breaker and platform-arcade games. The player controls a pixelated avatar that can move in four directions, shoot, and collect gems. Blocks spawn and fall; player must collect targets and avoid or destroy blocks. The project target is browser-based play with an attract mode (demo) and localized UI.

Goals of this spec
- Provide a complete reference of gameplay mechanics, entities, UI flows, and data structures.
- Describe file layout, key functions, and hooks so devs and designers can implement features or port to a game framework (e.g., Phaser).
- Provide QA scenarios, edge-cases, and performance considerations.

## 2 — High-level game loop & states
Game runs a single main loop (requestAnimationFrame) while in 'playing' state. The app has several top-level states:
- attract: attract/demo overlay active (idle mode)
- playing: active gameplay processing input, physics, spawn logic
- gameOver: continue overlay visible or top-ten entry
- paused: (optional) stops gameLoop, shows pause overlay

Transitions
- attract -> playing: triggered by user (enter/start/credits) -> showLevelSelect -> startGame
- playing -> gameOver: when lives depleted or fail conditions -> show continue overlay and/or top ten
- playing -> attract: after endGame or manual exit

Frame responsibilities (each frame in playing):
1. Input reading
2. Update player movement
3. Update bullets, blocks, pickups, explosions, particles, doors, targets
4. Collision detection and resolution
5. Spawn logic (based on spawnRate and stage config)
6. Draw background, walls, floor, player, blocks, HUD, overlays
7. requestAnimationFrame(next)

## 3 — Entities and data models
All objects are plain JS objects with consistent bounding box properties { x, y, width, height } for collision detection.

Player (window.player)
- x, y, width, height
- dx, dy (velocity)
- speed
- direction: 'left'|'right'|'up'|'down'
- angle: number (radians) for rendering rotation
- color
- lives: lives remaining (global variable `lives`)
- playerDynamite: number of dynamites carried
- playerKeys: number of keys
- invulnerability flags: playerInvulnerable, invulTimer

Blocks (array `blocks`)
- x,y,width,height
- dx, dy (velocity)
- landed: boolean
- spawnAnimation, maxSpawnAnimation
- type (mushroom, pulse, etc.)
- bounce, pulsePhase

Bullets (arrays `bullets`, `bulletsBlock`)
- x,y,width,height
- dx, dy

Particles, Explosions, FloatingTexts
- small objects for visual feedback with life counters

Target (gem)
- x,y,width,height
- lifetime, currentLife, other properties

Doors
- x,y,open:boolean,timer

Top Ten (array `topTen` saved in localStorage maybe)
- Each entry: { name: string, score: number, diff: string }

## 4 — Input & Controls
- Arrow keys: Move in four directions. Diagonal movement allowed; velocity normalization when diagonal.
- Space: Shoot in last movement direction.
- D (or d): Use dynamite.
- 1/2: MAME-style quick player select (requires credits)
- 5: Insert coin (credits++)
- Enter: Start/select when in attract (requires credits)
- ArrowLeft/Right: navigate language flags when attract overlay active (custom handler bound to attract overlays)

Input processing notes
- Key states tracked in `keys` map; updatePlayerMovement() reads `keys` each frame.
- Shooting uses player.direction; edge-case: if direction undefined, default to 'up' or previous saved direction.

## 5 — Physics, collisions and tile interactions
- Collision detection uses axis-aligned bounding box (AABB) checks via checkCollision(objA,objB).
- Blocks have gravity-like downward movement (dy); when they hit the inner bounds floor they 'land' and become static.
- Player cannot pass through impassable tiles defined in FLOOR_MAP; on collision, rollback is used: move, detect overlap, then revert to previous position.
- Dynamite: useDynamite() reduces `playerDynamite`, destroys blocks within a radius (circle check centered on player), creates particles and explosion.
- Bullet-block collisions destroy blocks or apply damage depending on block type.

Edge cases
- Diagonal normalization: when moving diagonal (dx & dy), multiply velocities by 0.7071 to keep total speed consistent.
- Off-screen objects are removed when outside threshold (e.g., 50px beyond canvas).
- Last-slice pixel coverage (flags sprite): ensure last slice covers remaining pixels when flags.png width not divisible by N.

## 6 — UI & overlays
Main DOM regions
- `#gameContainer`: top-level game container (canvas + overlays)
- `#hud`: persistent HUD showing score, lives, credits etc.
- `#attractScreen`: persistent attract overlay (we reuse it; show/hide via classes)
- `#topTen`: persistent overlay for Top Ten (inside gameContainer)
- Transient overlays: `.gameOver` elements created for continue/entry; code ensures `#topTen` not removed when clearing `.gameOver`.

Attract overlay behaviour
- Two attract modes alternate every 10s: static attract (title/INSERT COIN/flags/demo) and Top Ten.
- Attract overlay uses `flags.png` sprite to draw flags onto small canvases; code computes slice width and draws the proper region.
- We persist language in `localStorage.bh_lang` and load dictionary files `data/dic/<lang>.js`.

Top Ten
- `#topTen` is persistent in DOM; showTopTen() populates it and toggles CSS classes (fade-in/out). It's visible even when empty.
- showTopTenEntry(finalScore) shows an input for initials and saves the score to topTen array.

HUD
- `updateHUD()` syncs DOM with runtime state (score, lives, credits, dynamite count, invul timer). It updates attract overlays credit counters too.

Accessibility
- Buttons use tabindex and keyboard handlers. The attract screen supports keyboard left/right for language selection.

## 7 — Internationalization (i18n)
- `data/dic/<lang>.js` files provide `window.DICT = { lang: 'it', title: '...', insert_coin: '...' }`.
- `loadDictionary(lang, cb)` appends a script tag to load the dictionary file and calls cb on load. It falls back to default (`DEFAULT_LANG`) when missing.
- `applyTranslations()` finds elements with `i18n` attributes (or where the code updates innerText) and replaces texts with `window.DICT` strings.
- Languages included: it, fr, de, en, us, ja, es, zh (files under `data/dic/`).

## 8 — Assets & sprites
- `images/sprite.png` (main pixel spritesheet) — contains player/blocks/tiles
- `images/flags.png` — horizontal strip of flags (8 flags expected). Draw via slicing: careful with slice width calculation; prefer float-slice rounding and last-slice remainder cover.
- `images/tail.png` — tail sheet; `TAIL_SHEET_MAP` must reflect grid layout (todo)

Flag slicing algorithm (recommended robust approach)
- total = FLAGS_LIST.length
- floatSliceW = flagsImg.width / total
- for index i:
  - sxf = floatSliceW * i
  - sx = Math.round(sxf)
  - if (i === total - 1) sw = flagsImg.width - sx else sw = Math.round(floatSliceW)
  - ctx.drawImage(flagsImg, sx, 0, sw, flagsImg.height, 0, 0, W, H)

## 9 — Files & code structure
Key files
- `index.html` — main runtime with inline JS controlling game logic and overlays
- `css/style.css` — styles for HUD, overlays, transitions (moved many inline styles here)
- `images/flags.png`, `images/sprite.png`, `images/tail.png` — assets
- `data/dic/*.js` — dictionaries per language
- `data/level/*.js` — level map files (window.LEVEL_MAP)

Important functions (locations in `index.html`)
- initAttractUI(), refreshAttractUI(), showAttractScreen(), showAttractOrTopTen()
- startGame(), loadLevelMap(level, sub, cb)
- updatePlayerMovement() — central movement logic
- createPlayer() — init player object
- gameLoop(), attractAnimation()
- updateHUD(), showTopTen(), showTopTenEntry(), endGame()

## 10 — Styling & transitions
- Overlays are toggled by class (hidden, fade-in, fade-out) to enable CSS transitions.
- Transition durations should be consistent between CSS and timeouts used in JS (e.g., 360-420ms).

## 11 — Testing & QA
Unit / Integration checks
- Verify that `initAttractUI()` can be called multiple times without duplicating listeners (check `_init` guard).
- Verify `refreshAttractUI()` redraws flags correctly even if `flagsImg` loads after first render.
- Test flag slicing with widths not divisible by 8: debug log sx/sw for each index.

Manual smoke tests
- Attract alternation: start app, observe attract/static -> top ten -> attract cycle every 10s.
- Language change persists: change language via flags; reload page; verify language persists.
- Credits flow: press '5' key and click insert coin button; verify HUD updates and continue overlay consumption behavior.
- Gameplay: verify movement, collision, bullets, dynamite, pickups, life loss, continue flow and top-ten entry.

Edge-case tests
- Rapid open/close attract overlay multiple times should not attach multiple key handlers nor leak memory.
- Remove last block while dynamite explosion executes; ensure no exceptions thrown when iterating arrays modified by explosion.
- Test fallback dictionary behavior when `data/dic/<lang>.js` missing (should fallback to default language gracefully).

## 12 — Performance & optimization
- Avoid frequent innerHTML rewrites for overlays; use class toggles and redraw only canvases needing updates.
- Reuse canvas contexts and avoid re-creating canvases or script nodes.
- Particle counts: cap particle pools to avoid unbounded arrays; reuse particle objects where possible.
- Use integer math where possible; avoid heavy operations inside tight loops.

## 13 — Security & privacy
- No external network requests apart from asset loading; do not attempt to exfiltrate localStorage values.
- localStorage is used for simple prefs (bh_lang) and topTen; ensure topTen size limited to 10 entries.

## 14 — Test plan (short)
- Automated: add a minimal headless integration test that loads `index.html` in a headless browser (puppeteer) and verifies that:
  - attract overlay appears and `#attractCredits` holds initial value;
  - pressing '5' increases the credits in the DOM;
  - language change updates a DOM string.

- Manual checklist:
  - Language selector: click each flag, verify `window.DICT` values applied.
  - Flags rendering: visually inspect correct cropping and absence of gaps.
  - Top Ten: add >10 scores, ensure sorting and limiting to top 10.
  - Demo: verify demo stops on click/start.

## 15 — Known TODOs & future work
- Make `startAttractDemo()` return a stopper function and ensure it's always called when overlay hidden.
- Implement `TAIL_SHEET_MAP` adaptation UI.
- Convert more inline styles to classes.
- Port to Phaser: create scenes (Boot, Preload, Attract, Game, HUD, TopTen) and move logic out of inline script.

## 16 — Appendix: Constants & Config
- SIZE_SCALE: global pixel scale
- GEMS_PER_STAGE, DYNAMITE_MAX, CONTINUE_FRAMES: gameplay constants
- FLAGS_LIST: ['it','fr','de','en','us','ja','es','zh']
- DEFAULT_LANG: default language code

---

End of specification.
