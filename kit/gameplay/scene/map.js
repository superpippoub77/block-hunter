// Mappa: tilemap, celle, oggetti nascosti, assi.
// Part of the gameplay scene of the SpikeCode engine: these methods are mixed into GameScene
// (kit/gameplay/gameScene.js), so `this` is the scene and every method can call the others.
export function createMapMixin(deps) {
const {
    Phaser,
    CONFIG,
    GAME_STATE,
    GAME_FONT,
    HUD_DEPTH,
    TRANSLATIONS,
    LOGGER,
    OBJECT_FRAMES,
    TILE_FRAMES,
    WALL_TILE_COLS,
    applyMappingFrameOverrides,
    isFreeplayEnabled,
    hasStartAccessForPlayers,
    consumeCreditsForPlayers,
    TILE_NATIVE_WIDTH,
    TILE_NATIVE_HEIGHT,
    OBJECT_NATIVE_SIZE,
    defaultFrame,
    PRELOAD_ASSET_MANIFEST_KEY,
    PRELOAD_ASSET_MANIFEST_PATH,
    PRELOAD_SPRITESHEET_CONFIGS,
    LOG_LEVELS,
    LOG_LEVEL_NAMES,
    normalizeLogLevel,
    readInitialLogLevel,
    inferPurposeFromName,
    getFunctionParamNames,
    inferOutputFromName,
    toDocEntry,
    buildTopLevelFunctionDocs,
    buildSceneMethodsDocs,
    chooseTraceLevel,
    instrumentSceneMethods,
    queueLegacyPreloadAssets,
    queueAssetsFromManifest,
    mergeLocalConfig,
    loadTranslations,
    clearRuntimeMatchStorage,
    resetGameStateForNewRun,
    drawTextPanel,
    getTextureMaxNumericFrame,
    playLoopAudioSafely,
    resolveContactSpec,
    LEVEL_CONFIG,
    getLevelFileName,
    getLevelMasterNumber,
    parseExitTargetLevel,
    addSpikeCredit,
    createCreditsManager,
    createLanguageCarousel,
    kitFlow
} = deps;

return class MapMixin {

    createTilemap() {
        this.tiles = [];

        // Get map data from JSON
        // Support both old format (map as array) and new format (map.tiles as array)
        let mapData = null;
        let mapRows = CONFIG.gridHeight;
        let mapCols = CONFIG.gridWidth;

        if (this.levelData?.map) {
            // New format: map object with cols, rows, tiles
            if (this.levelData.map.tiles) {
                mapData = this.levelData.map.tiles;
                mapRows = this.levelData.map.rows || mapData.length;
                mapCols = this.levelData.map.cols || (mapData[0]?.length || CONFIG.gridWidth);
            }
            // Old format: map is directly the array
            else if (Array.isArray(this.levelData.map)) {
                mapData = this.levelData.map;
                mapRows = this.levelData.rows || mapData.length;
                mapCols = this.levelData.cols || (mapData[0]?.length || CONFIG.gridWidth);
            }
        } else {
            // Fallback to old properties
            mapRows = this.levelData?.rows || CONFIG.gridHeight;
            mapCols = this.levelData?.cols || CONFIG.gridWidth;
        }

        // Place map at world origin; camera will handle centering for small maps
        const offsetX = 0;
        const offsetY = 0;

        // Tile frames are defined centrally in data/module/constants.js (TILE_FRAMES)

        const resolveTokenMap = (val) => {
            try {
                if (val == null) return val;
                if (typeof val !== 'string') return val;
                const map = (this.levelData && this.levelData.tokenMap) ? this.levelData.tokenMap : (CONFIG.tokenMap || {});
                const tryKeys = [val, val.toLowerCase(), val.toUpperCase()];
                for (let k of tryKeys) {
                    if (k && map[k] && String(map[k]).trim() !== String(val)) {
                        return resolveTokenMap(String(map[k]));
                    }
                }
            } catch (e) { /* ignore */ }
            return val;
        };

        const splitTokenEffects = (rawToken) => {
            const text = String(rawToken ?? '').trim();
            if (!text) return { base: text, effects: [], effectOptions: {} };

            // Supports forms like: g(lamp), g(lamp,pulse), exit[12](lamp), g(lamp).
            const match = text.match(/^(.+?)\(([^()]+)\)(\.)?$/);
            if (!match) return { base: text, effects: [], effectOptions: {} };

            let base = String(match[1] || '').trim();
            if (match[3] === '.') base = `${base}.`;

            const listRaw = String(match[2] || '');
            const entries = [];
            let buf = '';
            let depth = 0;
            for (let i = 0; i < listRaw.length; i++) {
                const ch = listRaw[i];
                if (ch === '{') depth++;
                if (ch === '}') depth = Math.max(0, depth - 1);
                if (ch === ',' && depth === 0) {
                    entries.push(buf.trim());
                    buf = '';
                    continue;
                }
                buf += ch;
            }
            if (buf.trim()) entries.push(buf.trim());

            const effects = [];
            const effectOptions = {};

            entries.forEach((entry) => {
                const rawEntry = String(entry || '').trim();
                if (!rawEntry) return;

                const m = rawEntry.match(/^([a-z0-9_\-]+)(?:\{([^}]*)\})?$/i);
                if (!m) return;

                const normalizedName = this.normalizeEffectName(m[1]);
                if (!normalizedName) return;
                if (!effects.includes(normalizedName)) effects.push(normalizedName);

                const optionsText = String(m[2] || '').trim();
                if (!optionsText) return;

                const optionPairs = optionsText.split(/[;,]+/).map((p) => p.trim()).filter(Boolean);
                if (!optionPairs.length) return;

                const parsedOptions = {};
                optionPairs.forEach((pair) => {
                    const eqIdx = pair.indexOf(':');
                    const sepIdx = eqIdx >= 0 ? eqIdx : pair.indexOf('=');
                    if (sepIdx <= 0) return;
                    const key = String(pair.slice(0, sepIdx)).trim();
                    const rawValue = String(pair.slice(sepIdx + 1)).trim();
                    if (!key) return;

                    if (/^(true|false)$/i.test(rawValue)) {
                        parsedOptions[key] = /^true$/i.test(rawValue);
                        return;
                    }
                    if (/^-?\d+(\.\d+)?$/.test(rawValue)) {
                        parsedOptions[key] = Number(rawValue);
                        return;
                    }
                    // Keep non-numeric values as string (colors like #ffee99, 0xffee99, etc.)
                    parsedOptions[key] = rawValue;
                });

                if (Object.keys(parsedOptions).length) {
                    effectOptions[normalizedName] = {
                        ...(effectOptions[normalizedName] || {}),
                        ...parsedOptions
                    };
                }
            });

            return { base, effects, effectOptions };
        };

        const parseSingleMapSymbol = (value) => {
            // apply tokenMap mappings first
            const originalValue = value;
            value = resolveTokenMap(value);
            // support trailing '.' to indicate transparency / no tile (e.g. 'f.' puddle effects but no tile drawn)
            let noTileFlag = false;
            try {
                // Case A: original token in the map data itself ends with '.' (e.g. 'x.').
                if (typeof originalValue === 'string' && originalValue.length > 1 && originalValue.endsWith('.')) {
                    noTileFlag = true;
                    // remove trailing dot for subsequent parsing of the resolved value
                    if (typeof value === 'string' && value.endsWith('.')) {
                        value = value.slice(0, -1);
                    }
                    // If mapping didn't resolve (e.g. tokenMap contains only the base key without '.'),
                    // attempt to resolve using the base key as well so 'x.' can match a mapping for 'x'.
                    try {
                        const baseKey = originalValue.slice(0, -1);
                        const map = (this.levelData && this.levelData.tokenMap) ? this.levelData.tokenMap : (CONFIG.tokenMap || {});
                        const tryKeys = [baseKey, baseKey.toLowerCase(), baseKey.toUpperCase()];
                        for (let k of tryKeys) {
                            if (k && map[k] && String(map[k]).trim() !== String(baseKey)) {
                                // use mapped value (may itself end with '.')
                                value = String(map[k]);
                                if (value.endsWith('.')) value = value.slice(0, -1);
                                break;
                            }
                        }
                    } catch (e) { }
                }

                // Case B: mapping in tokenMap yields a value that ends with '.' (e.g. '#': 'w0000.').
                // In that case, even if the original token didn't end with '.', we should
                // honor the trailing dot in the mapped value and treat it as `noTile`.
                if (!noTileFlag && typeof value === 'string' && value.endsWith('.')) {
                    noTileFlag = true;
                    value = value.slice(0, -1);
                }
            } catch (e) { }

            // diagnostic log to help debug map tokens with trailing dot
            try {
                if (noTileFlag && typeof console !== 'undefined' && console.log) {
                    console.log('[MAP_NO_TILE]', originalValue, '->', value);
                }
            } catch (e) { }
            // Treat null/undefined/empty-string as explicit empty tile
            if (value == null) {
                return { type: 'empty', wallFrame: 0, wallRotation: 0 };
            }

            if (typeof value !== 'string') {
                // convert non-string values to string for parsing (numbers, etc.)
                try { value = String(value); } catch (e) { return { type: 'empty', wallFrame: 0, wallRotation: 0 }; }
            }

            const normalizedValue = value.trim().toLowerCase();
            if (normalizedValue === '') {
                return { type: 'empty', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
            }

            if (normalizedValue === 'floor') {
                return { type: 'floor', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
            }
            if (normalizedValue === 'empty') {
                return { type: 'empty', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
            }
            if (normalizedValue === 'hole') {
                return { type: 'hole', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
            }
            if (normalizedValue === 'hole2') {
                return { type: 'hole2', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
            }
            if (normalizedValue === 'wall' || normalizedValue === 'w') {
                return { type: 'wall', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
            }

            // Support full token wR C R F (row,col,rot,flip) where flip is h/v/0
            const wallMatch4 = value.match(/^w(\d)(\d)(\d)([hv0])$/i);
            if (wallMatch4) {
                const row = Number(wallMatch4[1]);
                const col = Number(wallMatch4[2]);
                const rotationCode = Number(wallMatch4[3]);
                const flipChar = String(wallMatch4[4]).toLowerCase();
                const validRow = row >= 0 && row <= 3;
                const validCol = col >= 0 && col <= 5;
                const validRotation = rotationCode >= 0 && rotationCode <= 3;
                const validFlip = flipChar === 'h' || flipChar === 'v' || flipChar === '0';
                if (validRow && validCol && validRotation && validFlip) {
                    return {
                            type: 'wall',
                            wallFrame: row * WALL_TILE_COLS + col,
                            wallRotation: rotationCode,
                            wallFlip: flipChar,
                            noTile: noTileFlag
                        };
                }
            }

            // Support old "wCR" (three digits without flip) -> treat as no flip
            const wallMatch3 = value.match(/^w(\d)(\d)(\d)$/i);
            if (wallMatch3) {
                const row = Number(wallMatch3[1]);
                const col = Number(wallMatch3[2]);
                const rotationCode = Number(wallMatch3[3]);
                const validRow = row >= 0 && row <= 3;
                const validCol = col >= 0 && col <= 5;
                const validRotation = rotationCode >= 0 && rotationCode <= 3;
                if (validRow && validCol && validRotation) {
                    return {
                        type: 'wall',
                        wallFrame: row * WALL_TILE_COLS + col,
                        wallRotation: rotationCode,
                        wallFlip: '0',
                        noTile: noTileFlag
                    };
                }
            }

            const wallMatch2 = value.match(/^w(\d)(\d)$/i);
            if (wallMatch2) {
                // Legacy two-digit token: first digit was frame, second was rotation
                const legacyFrame = Number(wallMatch2[1]);
                const rotationCode = Number(wallMatch2[2]);
                const baseCol = legacyFrame;
                const validBaseCol = baseCol >= 0 && baseCol <= 6;
                const validRotation = rotationCode >= 0 && rotationCode <= 3;
                if (validBaseCol && validRotation) {
                    return {
                        type: 'wall',
                        wallFrame: baseCol,
                        wallRotation: rotationCode,
                        wallFlip: '0',
                        noTile: noTileFlag
                    };
                }
                if (validBaseCol) {
                    return {
                        type: 'wall',
                        wallFrame: baseCol,
                        wallRotation: ((rotationCode % 4) + 4) % 4,
                        wallFlip: '0',
                        noTile: noTileFlag
                    };
                }
                return { type: 'wall', wallFrame: 0, wallRotation: 0, wallFlip: '0', noTile: noTileFlag };
            }

            // Support multi-character tokens like 'back' and 'back[...]'
            if (typeof value === 'string') {
                const vnorm = value.trim().toLowerCase();
                const backTargetMatch = vnorm.match(/^(?:bck|back|back_level)\[(.+)\]$/i);
                if (backTargetMatch) {
                    const target = parseExitTargetLevel(backTargetMatch[1]);
                    return {
                        type: 'back',
                        wallFrame: 0,
                        wallRotation: 0,
                        noTile: noTileFlag,
                        backTargetLevelIndex: target ? target.index : null,
                        backTargetLevelId: target ? target.id : null
                    };
                }
                if (vnorm === 'bck' || vnorm === 'back' || vnorm === 'back_level') {
                    return { type: 'back', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
                if (vnorm === 'hc' || vnorm === 'hole_cover') {
                    return { type: 'hole_cover', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
            }

            // Support multi-character tokens like 'exit' which should map to hole2 (the exit frame)
            if (typeof value === 'string') {
                const vnorm = value.trim().toLowerCase();
                const exitTargetMatch = vnorm.match(/^exit\[(.+)\]$/i);
                if (exitTargetMatch) {
                    const target = parseExitTargetLevel(exitTargetMatch[1]);
                    return {
                        type: 'hole2',
                        wallFrame: 0,
                        wallRotation: 0,
                        noTile: noTileFlag,
                        exitTargetLevelIndex: target ? target.index : null,
                        exitTargetLevelId: target ? target.id : null
                    };
                }
                if (vnorm === 'exit' || vnorm === 'hole2') {
                    return { type: 'hole2', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
            }

            if (value.length === 1) {
                switch (value) {
                    // single-letter 'w' treated as water here; wall tokens like w12 are handled earlier
                    case 'w': return { type: 'water', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    // 'f' is mud (fango) per new mapping
                    case 'f': return { type: 'mud', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case 'm': return { type: 'skeleton', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    // Removed special-case '#' token: no longer map '#' to invisible wall here.
                    case 'h': return { type: 'hole', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case '.': return { type: 'hole', wallFrame: 0, wallRotation: 0, noTile: true };
                    case 's': return { type: 'sand', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case 'g': return { type: 'gem', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case '-': return { type: 'empty', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case 'l': return { type: 'heart', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case 'd': return { type: 'door', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case 'k': return { type: 'key', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case 'p': return { type: 'pepita', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case 'b': return { type: 'dynamite', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case 'c': return { type: 'cart', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    case 'n': return { type: 'snake', wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                    default: return { type: value, wallFrame: 0, wallRotation: 0, noTile: noTileFlag };
                }
            }

            return {
                type: value,
                wallFrame: 0,
                wallRotation: 0,
                noTile: noTileFlag
            };
        };

    const wallMaxFrame = getTextureMaxNumericFrame(this, 'wall_tiles', WALL_TILE_COLS);

    // No local helper: use global resolveContactSpec to obtain per-type spec

        const mapSymbolToCell = (value) => {
            if (typeof value === 'string') {
                const slashIndex = value.indexOf('/');
                if (slashIndex > 0 && slashIndex < value.length - 1) {
                    const coverPart = value.slice(0, slashIndex).trim();
                    const revealPart = value.slice(slashIndex + 1).trim();
                    if (coverPart && revealPart) {
                        const coverMeta = splitTokenEffects(coverPart);
                        const revealMeta = splitTokenEffects(revealPart);
                        const coverCell = parseSingleMapSymbol(coverMeta.base);
                        const revealCell = parseSingleMapSymbol(revealMeta.base);
                        if (coverMeta.effects.length) coverCell.effects = coverMeta.effects;
                        if (revealMeta.effects.length) revealCell.effects = revealMeta.effects;
                        if (coverMeta.effectOptions && Object.keys(coverMeta.effectOptions).length) coverCell.effectOptions = coverMeta.effectOptions;
                        if (revealMeta.effectOptions && Object.keys(revealMeta.effectOptions).length) revealCell.effectOptions = revealMeta.effectOptions;
                        return {
                            ...coverCell,
                            hiddenReveal: revealCell
                        };
                    }
                }
            }

            const singleMeta = splitTokenEffects(value);
            const singleCell = parseSingleMapSymbol(singleMeta.base);
            if (singleMeta.effects.length) singleCell.effects = singleMeta.effects;
            if (singleMeta.effectOptions && Object.keys(singleMeta.effectOptions).length) singleCell.effectOptions = singleMeta.effectOptions;
            return {
                ...singleCell,
                hiddenReveal: null
            };
        };

        for (let y = 0; y < mapRows; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < mapCols; x++) {
                let type = 'floor';
                let wallFrame = 0;
                let wallRotation = 0;
                let wallFlip = '0';
                let hiddenReveal = null;
                let tileNoTile = false;
                let cellEffects = [];
                let cellEffectOptions = {};
                let cellBackTargetLevelIndex = null;
                let cellBackTargetLevelId = null;
                let cellExitTargetLevelIndex = null;
                let cellExitTargetLevelId = null;

                // If we have map data from JSON, use it
                if (mapData && mapData[y] && mapData[y][x] !== undefined) {
                    const cell = mapSymbolToCell(mapData[y][x]);
                    type = cell.type;
                    wallFrame = cell.wallFrame;
                    wallRotation = cell.wallRotation || 0;
                    wallFlip = cell.wallFlip || '0';
                    hiddenReveal = cell.hiddenReveal || null;
                    var tileInvisible = !!cell.invisible;
                    tileNoTile = !!cell.noTile;
                    cellEffects = Array.isArray(cell.effects) ? cell.effects : [];
                    cellEffectOptions = (cell.effectOptions && typeof cell.effectOptions === 'object' && !Array.isArray(cell.effectOptions))
                        ? cell.effectOptions
                        : {};
                    cellBackTargetLevelIndex = Number.isFinite(Number(cell.backTargetLevelIndex)) ? Number(cell.backTargetLevelIndex) : null;
                    cellBackTargetLevelId = cell.backTargetLevelId || null;
                    cellExitTargetLevelIndex = Number.isFinite(Number(cell.exitTargetLevelIndex)) ? Number(cell.exitTargetLevelIndex) : null;
                    cellExitTargetLevelId = cell.exitTargetLevelId || null;
                } else {
                    // Fallback to old random generation
                    // Border walls
                    if (x === 0 || x === mapCols - 1 || y === 0 || y === mapRows - 1) {
                        type = 'wall';
                        wallFrame = 0;
                        wallRotation = 0;
                    }
                    // Random sand patches
                    else if (Math.random() < 0.1) {
                        type = 'sand';
                    }
                    // Random holes
                    else if (Math.random() < 0.05) {
                        type = 'hole';
                    }
                }

                // Object tiles are rendered without floor underneath
                // Normally treat object tokens as 'empty' so no floor tile is drawn.
                // However, if the logical type is 'wall' we must still create a wall
                // collision even when the token has a trailing '.' (noTile). In that
                // case mark the wall as invisible so it blocks but doesn't render.
                if (type === 'wall' && tileNoTile) {
                    tileInvisible = true;
                }

                const tileType = ((tileNoTile && type !== 'wall') || type === 'door'
                    || type === 'key'
                    || type === 'pepita'
                    || type === 'dynamite'
                    || type === 'gem'
                    || type === 'cart'
                    || type === 'skeleton'
                    || type === 'hole2'
                    || type === 'heart'
                    || type === 'helmet'
                    || type === 'wooden')
                    ? 'empty'
                    : type;
                const normalizedTileType = (tileType === 'bat' || tileType === 'ghost' || tileType === 'spider' || tileType === 'snake') ? 'floor' : tileType;
                let tileSprite = null;
                let coverSprite = null;

                // Diagnostic: log tile creation decisions
                try {
                    if (typeof console !== 'undefined' && console.log) console.log('[TILE_CREATE]', x, y, 'type=', type, 'tileNoTile=', tileNoTile, 'tileType=', tileType, 'normalized=', normalizedTileType);
                } catch (e) { }
                if (normalizedTileType !== 'empty') {
                    // Get frame index for this tile type
                    const frameIndex = normalizedTileType === 'wall'
                        ? Phaser.Math.Clamp(Number(wallFrame) || 0, 0, wallMaxFrame)
                        : (TILE_FRAMES[normalizedTileType] !== undefined ? TILE_FRAMES[normalizedTileType] : TILE_FRAMES.floor);
                    const tileTexture = normalizedTileType === 'wall' ? 'wall_tiles' : 'tiles';

                    // Create sprite from tiles spritesheet at integer-aligned positions
                    const tx = Math.round(offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2);
                    const ty = Math.round(offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2);
                    tileSprite = this.add.sprite(tx, ty, tileTexture, frameIndex);
                    // Force tile to display exactly as a square cell; walls use wallSize if set
                    const _dispSize = (normalizedTileType === 'wall')
                        ? (Number(CONFIG.wallSize) || CONFIG.tileSize)
                        : CONFIG.tileSize;
                    tileSprite.setDisplaySize(_dispSize, _dispSize);
                    try { tileSprite.setData && tileSprite.setData('type', normalizedTileType); } catch (e) { }
                    try { this.applyTokenEffects(tileSprite, cellEffects, tx, ty, cellEffectOptions); } catch (e) { }

                    // If the tile was marked 'invisible' in the map, hide its graphic
                    if (type === 'wall' && tileInvisible) {
                        try { tileSprite.setVisible(false); } catch (e) { }
                    }

                    if (type === 'wall') {
                        if (wallFlip === 'h') {
                            tileSprite.setFlipX(true);
                        } else if (wallFlip === 'v') {
                            tileSprite.setFlipY(true);
                        } else {
                            // 0..3 -> 0,90,180,270
                            tileSprite.setAngle((Number(wallRotation) || 0) * 90);
                        }
                    }

                    if (type === 'wall' && this.walls) {
                        this.walls.add(tileSprite);
                        // Ensure a static physics body exists for this tileSprite even when
                        // added from a plain sprite (some Phaser builds do not auto-create
                        // bodies for sprites added to a staticGroup). This guarantees
                        // invisible walls will block the player.
                        try {
                            if (!tileSprite.body && this.physics && this.physics.add && this.physics.add.existing) {
                                this.physics.add.existing(tileSprite, true);
                            }
                        } catch (e) { }
                        // assign contact spec according to config (contactType, radiusMultiplier, proximityTiles)
                        try {
                            const spec = resolveContactSpec('wall');
                            tileSprite.setData && tileSprite.setData('contactType', spec.contactType);
                            tileSprite.setData && tileSprite.setData('contactSpec', spec);
                            tileSprite.setData && tileSprite.setData('type', 'wall');
                        } catch (e) { }
                        coverSprite = tileSprite;
                        if (tileSprite.body) {
                            // Prefer a center-based circular body for tile objects so contact feels like it happens at tile center
                            try {
                                const tw = Math.floor(tileSprite.displayWidth || tileSprite.width);
                                const th = Math.floor(tileSprite.displayHeight || tileSprite.height);
                                const spec = resolveContactSpec('wall');
                                let radius;
                                if (spec && typeof spec.radiusPixels === 'number') {
                                    radius = Math.floor(spec.radiusPixels);
                                } else {
                                    const multiplier = (spec && spec.radiusMultiplier) ? spec.radiusMultiplier : 0.45;
                                    radius = Math.floor(Math.min(tw, th) * multiplier);
                                }
                                if (tileInvisible) {
                                    // For invisible walls, use a full-tile rectangular body so collision covers entire cell
                                    try { tileSprite.body.setSize(tw, th); tileSprite.body.setOffset(0, 0); } catch (e) { }
                                } else {
                                    try { tileSprite.body.setCircle(radius); const offsetX = Math.floor((tw / 2) - radius); const offsetY = Math.floor((th / 2) - radius); tileSprite.body.setOffset(offsetX, offsetY); } catch (e) { }
                                }
                            } catch (e) {
                                tileSprite.body.setSize(Math.floor(tileSprite.displayWidth || tileSprite.width), Math.floor(tileSprite.displayHeight || tileSprite.height));
                            }
                        }
                    }

                        // If map explicitly specified a hole_cover token, create a persistent plank overlay
                        if (type === 'hole_cover') {
                            try {
                                // mark tile as floor so player can walk on it
                                type = 'floor';
                                // Use tiles.png hole_cover frame instead of creating a separate plank image
                                if (tileSprite && tileSprite.setFrame) {
                                    try { tileSprite.setFrame(TILE_FRAMES.hole_cover); } catch (e) { }
                                    try { tileSprite.setData && tileSprite.setData('covered', true); } catch (e) { }
                                    coverSprite = tileSprite;
                                } else {
                                    // fallback: create no extra overlay, still mark covered on data container
                                    try { coverSprite = null; } catch (e) { }
                                }
                            } catch (e) { }
                        }
                }

                if (type === 'door' && !tileNoTile && this.doors) {
                    const door = this.doors.create(
                        offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        'objects',
                        OBJECT_FRAMES.door
                    );
                    this.setupDoor(door);
                    try { this.applyTokenEffects(door, cellEffects, door.x, door.y, cellEffectOptions); } catch (e) { }
                    this.hasDoorInMap = true;
                    coverSprite = door;
                }

                if (!tileNoTile && (type === 'key' || type === 'pepita' || type === 'heart' || type === 'dynamite' || type === 'skeleton' || type === 'cart' || type === 'helmet' || type === 'wooden') && this.items) {
                    let frame = OBJECT_FRAMES.skeleton;
                    if (type === 'key') frame = OBJECT_FRAMES.key;
                    else if (type === 'pepita') frame = OBJECT_FRAMES.pepita;
                    else if (type === 'heart') frame = OBJECT_FRAMES.heart;
                    else if (type === 'dynamite') frame = OBJECT_FRAMES.dynamite_chest;
                    else if (type === 'wooden') frame = OBJECT_FRAMES.wooden;
                    else if (type === 'cart') frame = OBJECT_FRAMES.cart;
                    else if (type === 'helmet') frame = OBJECT_FRAMES.helmet;
                    // Keep map token visuals as `objects` until revealed; actual skeleton
                    // will be spawned when the tile is revealed.
                    const itemSprite = this.items.create(
                        offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        'objects',
                        frame
                    );
                    // Keep item at original sprite size and prefer a circular body centered on the item so pickups/poles behave by center contact
                    if (itemSprite.body) {
                        try {
                            const iw = Math.floor(itemSprite.displayWidth || itemSprite.width);
                            const ih = Math.floor(itemSprite.displayHeight || itemSprite.height);
                            const spec = resolveContactSpec(type === 'gem' ? 'gem' : 'item');
                            let radius;
                            if (spec && typeof spec.radiusPixels === 'number') {
                                radius = Math.floor(spec.radiusPixels);
                            } else {
                                const multiplier = (spec && spec.radiusMultiplier) ? spec.radiusMultiplier : 0.45;
                                radius = Math.floor(Math.min(iw, ih) * multiplier);
                            }
                            itemSprite.body.setCircle(radius);
                            const offsetX = Math.floor((iw / 2) - radius);
                            const offsetY = Math.floor((ih / 2) - radius);
                            itemSprite.body.setOffset(offsetX, offsetY);
                        } catch (e) {
                            itemSprite.body.setSize(itemSprite.displayWidth || itemSprite.width, itemSprite.displayHeight || itemSprite.height);
                        }
                    }
                    // Apply object scale multiplier so items adapt to configuration
                    const objectScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
                    itemSprite.setScale(objectScaleFactor);
                    if (itemSprite.body) {
                        // Recalculate body after scaling; try circular again using configured multiplier
                        try {
                            const iw = Math.floor(itemSprite.displayWidth || itemSprite.width);
                            const ih = Math.floor(itemSprite.displayHeight || itemSprite.height);
                            const spec = resolveContactSpec(type === 'gem' ? 'gem' : 'item');
                            let radius;
                            if (spec && typeof spec.radiusPixels === 'number') {
                                radius = Math.floor(spec.radiusPixels);
                            } else {
                                const multiplier = (spec && spec.radiusMultiplier) ? spec.radiusMultiplier : 0.45;
                                radius = Math.floor(Math.min(iw, ih) * multiplier);
                            }
                            itemSprite.body.setCircle(radius);
                            const offsetX = Math.floor((iw / 2) - radius);
                            const offsetY = Math.floor((ih / 2) - radius);
                            itemSprite.body.setOffset(offsetX, offsetY);
                        } catch (e) {
                            itemSprite.body.setSize(Math.floor(itemSprite.displayWidth || itemSprite.width), Math.floor(itemSprite.displayHeight || itemSprite.height));
                        }
                    }
                    itemSprite.setData('type', type);
                    // contact type/spec from config for items
                    try {
                        const specItem = resolveContactSpec(type === 'gem' ? 'gem' : 'item');
                        itemSprite.setData && itemSprite.setData('contactType', specItem.contactType);
                        itemSprite.setData && itemSprite.setData('contactSpec', specItem);
                    } catch (e) { }
                    itemSprite.setData('gridX', x);
                    itemSprite.setData('gridY', y);
                    try { this.applyTokenEffects(itemSprite, cellEffects, itemSprite.x, itemSprite.y, cellEffectOptions); } catch (e) { }
                    if (type === 'key' || type === 'wooden') {
                        // keys and wooden planks float to indicate pickup
                        this.applyKeyFloatingEffect(itemSprite);
                    }
                    coverSprite = itemSprite;
                    if (type === 'dynamite') {
                        try { this.levelHasDynamite = true; } catch (e) { }
                    }

                    if (type === 'key' && this.keySpawnPositions) {
                        this.keySpawnPositions.push({ x: itemSprite.x, y: itemSprite.y });
                    }
                }

                if (!tileNoTile && type === 'gem') {
                    if (!this.mapGemPositions) {
                        this.mapGemPositions = [];
                    }
                    this.mapGemPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        effects: cellEffects,
                        effectOptions: cellEffectOptions
                    });
                }

                if (!tileNoTile && type === 'hole2') {
                    if (!this.hole2ExitPositions) {
                        this.hole2ExitPositions = [];
                    }
                    this.hole2ExitPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        gridX: x,
                        gridY: y,
                        exitTargetLevelIndex: cellExitTargetLevelIndex,
                        exitTargetLevelId: cellExitTargetLevelId,
                        effects: cellEffects,
                        effectOptions: cellEffectOptions
                    });
                }

                if (!tileNoTile && type === 'back') {
                    try {
                        this.spawnBackLabelAt(
                            offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                            offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2
                        );
                    } catch (e) { }
                }

                if (!tileNoTile && type === 'ghost') {
                    if (!this.ghostSpawnPositions) {
                        this.ghostSpawnPositions = [];
                    }
                    this.ghostSpawnPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2
                    });
                }

                if (!tileNoTile && type === 'bat') {
                    if (!this.batSpawnPositions) {
                        this.batSpawnPositions = [];
                    }
                    this.batSpawnPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        effects: cellEffects
                    });
                }

                if (!tileNoTile && type === 'spider') {
                    if (!this.spiderSpawnPositions) {
                        this.spiderSpawnPositions = [];
                    }
                    this.spiderSpawnPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        gridX: x,
                        gridY: y
                    });
                }

                if (!tileNoTile && type === 'snake') {
                    if (!this.snakeSpawnPositions) {
                        this.snakeSpawnPositions = [];
                    }
                    this.snakeSpawnPositions.push({
                        x: offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2,
                        y: offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2,
                        gridX: x,
                        gridY: y
                    });
                }

                // Store logical type (for game logic) and sprite separately. Use original
                // `type` as the tile `type` so holes are recognized even when no tile is drawn.
                this.tiles[y][x] = {
                    type: type,
                    sprite: tileSprite,
                    noTile: !!tileNoTile,
                    invisible: !!tileInvisible,
                    backTargetLevelIndex: cellBackTargetLevelIndex,
                    backTargetLevelId: cellBackTargetLevelId,
                    effects: cellEffects,
                    effectOptions: cellEffectOptions
                };
                // Diagnostic: when debug flag enabled and the source map token had a trailing dot,
                // print the stored tile entry so we can verify `noTile`/type/hiddenReveal propagation.
                try {
                    if (CONFIG.debugTileGrid && mapData && mapData[y] && typeof mapData[y][x] === 'string' && mapData[y][x].endsWith('.')) {
                        try {
                            const tileObj = this.tiles[y] && this.tiles[y][x] ? this.tiles[y][x] : null;
                            const ctype = (tileObj && tileObj.sprite && typeof tileObj.sprite.getData === 'function') ? tileObj.sprite.getData('contactType') : (tileObj && tileObj.contactType) || null;
                            console.log('[DEBUG_TILE_ENTRY]', 'grid=', y, x, 'token=', mapData[y][x], 'contactType=', ctype, 'tileObj=', tileObj);
                        } catch (e) { }
                    }
                } catch (e) { }
                if (hiddenReveal) {
                    this.tiles[y][x].hiddenReveal = hiddenReveal;
                    this.tiles[y][x].coverType = type;
                    this.tiles[y][x].coverSprite = coverSprite;
                    this.tiles[y][x].hiddenRevealed = false;
                }
            }
        }

        // Store map dimensions for later use
        this.mapRows = mapRows;
        this.mapCols = mapCols;
        this.mapOffsetX = offsetX;
        this.mapOffsetY = offsetY;

        // Decorative fog / mist support (per-level configurable)
        try {
            const generalFx = this.getGeneralEffectsConfig();
            const fogCfg = (generalFx && generalFx.fog) || ((this.levelData && this.levelData.fog) ? this.levelData.fog : null);
            if (fogCfg && fogCfg.enabled) {
                const fogAlpha = (typeof fogCfg.alpha === 'number') ? fogCfg.alpha : 0.28;
                // layers controls depth; density controls how many blobs per layer
                const layers = Math.max(1, Number(fogCfg.layers) || 3);
                const density = Math.max(2, Number(fogCfg.density) || 5);
                const dirSign = (fogCfg.direction === 'right') ? 1 : -1;
                const speedMode = (fogCfg.speed === 'fast') ? 'fast' : 'slow';
                const baseDur = (speedMode === 'fast') ? 5000 : 14000;
                this.fogBlobs = [];
                // Map/world bounds for placement (allow margin so blobs appear off-screen too)
                const mapW = Math.max( (this.mapCols || mapCols) * (CONFIG.tileSize || 64), this.sys.game.config.width || 800 );
                const mapH = Math.max( (this.mapRows || mapRows) * (CONFIG.tileSize || 64), this.sys.game.config.height || 600 );
                const margin = Math.max(200, Math.floor((CONFIG.tileSize || 64) * 2));
                // ensure a soft fog texture exists (generate once per scene)
                try {
                    if (!this.textures.exists || !this.textures.exists('fog_blob')) {
                        // generate a radial soft blob using graphics rendered to texture
                        const genW = 256;
                        const genH = 160;
                        const g = this.add.graphics();
                        // draw multiple concentric circles to simulate a soft gradient
                        const cx = Math.floor(genW / 2);
                        const cy = Math.floor(genH / 2);
                        const maxR = Math.min(cx, cy);
                        for (let r = maxR; r > 0; r -= 4) {
                            const alpha = Phaser.Math.Clamp((maxR - r) / maxR, 0, 1);
                            const a = 0.6 * (1 - alpha) * 0.9;
                            g.fillStyle(0xffffff, a);
                            g.fillCircle(cx, cy, r);
                        }
                        try {
                            const rt = this.add.renderTexture(0, 0, genW, genH);
                            rt.draw(g, 0, 0);
                            rt.saveTexture('fog_blob');
                            rt.destroy();
                        } catch (e) { }
                        try { g.destroy(); } catch (e) {}
                    }
                } catch (e) { }

                // spawn multiple layers for parallax effect; outer layers are larger and slower
                for (let layer = 0; layer < layers; layer++) {
                    const blobsInLayer = density * (1 + Math.floor(layer * 0.5));
                    // anchor fog to background parallax (so it doesn't follow camera directly)
                    const scrollFactor = (typeof parallaxBgFactor === 'number') ? parallaxBgFactor : 0.96;
                    for (let i = 0; i < blobsInLayer; i++) {
                        try {
                            // allow placement with margin so fog appears in various screen parts
                            const px = (this.mapOffsetX || 0) + Phaser.Math.Between(-margin, mapW + margin);
                            const py = (this.mapOffsetY || 0) + Phaser.Math.Between(-margin, mapH + margin);
                            // larger sizes for more volumetric appearance; scale by layer so distant layers are bigger
                            const minW = Math.floor((CONFIG.tileSize || 64) * (2.5 + layer * 0.8));
                            const maxW = Math.floor((CONFIG.tileSize || 64) * (6.0 + layer * 1.2));
                            const sizeW = Phaser.Math.Between(minW, maxW);
                            const minH = Math.floor((CONFIG.tileSize || 64) * (1.4 + layer * 0.6));
                            const maxH = Math.floor((CONFIG.tileSize || 64) * (3.8 + layer * 0.9));
                            const sizeH = Phaser.Math.Between(minH, maxH);
                            // Create a soft image blob using generated fog texture; anchor to background parallax
                            // Place fog in front of the background (which uses -1000) but behind gameplay elements
                            const blobDepth = -900 + (layer * 10);
                            const blob = this.add.image(px, py, 'fog_blob').setOrigin(0.5).setDepth(blobDepth).setScrollFactor(scrollFactor);
                            blob.setDisplaySize(sizeW, sizeH);
                            // alpha scaled by layer and random noise for variety
                            const layerAlpha = fogAlpha * (1 - (layer / Math.max(1, layers + 1)) );
                            blob.setAlpha(Phaser.Math.Clamp(layerAlpha * (0.7 + Math.random() * 0.8), 0.02, 0.9));
                            try { blob.setBlendMode && blob.setBlendMode(Phaser.BlendModes.SCREEN); } catch (e) { }
                            // Drift: slower for distant layers, more pronounced for closer ones
                            const driftBase = (dirSign * Phaser.Math.Between(40, 220)) * (1 + (i * 0.02));
                            const driftX = driftBase * (1 + (layer * 0.3));
                            const driftY = Phaser.Math.Between(-120, 120) * (1 - (layer / Math.max(1, layers)));
                            const dur = Math.max(2000, Math.round(baseDur * (1 + (i * 0.05) + (layer * 0.2))));
                            this.tweens.add({ targets: blob, x: blob.x + driftX, y: blob.y + driftY, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
                            this.fogBlobs.push(blob);
                        } catch (e) { }
                    }
                }
            }
        } catch (e) { }

        // If the level contains dynamite items in the map, grant extra dynamite sticks
        try {
            if (this.levelHasDynamite) {
                GAME_STATE.dynamiteCount = (Number(GAME_STATE.dynamiteCount) || 0) + 50;
                if (this.updateUI) this.updateUI();
            }
        } catch (e) { }

        // Foreground resizing/positioning removed here to keep logic simple.
        // The foreground will be created and positioned once the world bounds
        // are established (see creation after background sizing). Keeping the
        // creation in one place ensures consistent behaviour across all levels.

        // --- Debug: draw light tile outlines to visualize the grid ---
        // Create a graphics layer that outlines each tile. Useful to see
        // tile boundaries (including empty tiles). Toggle with 'G'.
        try {
            if (this.tileGridDebug) { this.tileGridDebug.clear(); }
            this.tileGridDebug = this.add.graphics();
            // Draw a thin semi-transparent stroke
            this.tileGridDebug.lineStyle(1, 0xffffff, 0.18);
            for (let y = 0; y < mapRows; y++) {
                for (let x = 0; x < mapCols; x++) {
                    const rectX = offsetX + x * CONFIG.tileSize;
                    const rectY = offsetY + y * CONFIG.tileSize;
                    this.tileGridDebug.strokeRect(rectX, rectY, CONFIG.tileSize, CONFIG.tileSize);
                }
            }
            // Put debug overlay above tiles but below sprites (adjust depth if needed)
            this.tileGridDebug.setDepth(50);
            // Hidden-tile color overlay (only when debug enabled)
            try {
                if (this.tileHiddenDebug) this.tileHiddenDebug.clear();
                else this.tileHiddenDebug = this.add.graphics();
                // Place the hidden-tile overlay just below the HUD so it's always visible
                // above tiles/background but under UI elements.
                this.tileHiddenDebug.setDepth(HUD_DEPTH - 1);
                if (CONFIG.debugTileGrid) {
                    for (let y = 0; y < mapRows; y++) {
                        for (let x = 0; x < mapCols; x++) {
                            const t = (this.tiles && this.tiles[y]) ? this.tiles[y][x] : null;
                            if (!t) continue;
                            // Highlight tiles that are logically hidden (either marked as hiddenReveal
                            // and not yet revealed, or marked `noTile` which indicates a transparent
                            // token like 'water.' / 'f.' where the logical cell exists but no tile drawn)
                            if (!( (t.hiddenReveal && !t.hiddenRevealed) || t.noTile )) continue;
                            const rectX = offsetX + x * CONFIG.tileSize;
                            const rectY = offsetY + y * CONFIG.tileSize;
                            // determine logical token to color: prefer hiddenReveal token if present,
                            // otherwise fall back to tile type (useful for `noTile` cases)
                            const hv = (t.hiddenReveal && t.hiddenReveal.type) ? String(t.hiddenReveal.type).toLowerCase() : String(t.type || '').toLowerCase();
                            let color = null;
                            if (hv.indexOf('hole') !== -1 || hv === 'h' || hv === '.') {
                                color = 0x000000; // black for hidden holes
                            } else if (hv.indexOf('water') !== -1) {
                                color = 0x1f66ff; // blue for hidden water
                            } else if (hv.indexOf('mud') !== -1 || hv === 'f') {
                                color = 0x8b4513; // brown for hidden mud
                            } else {
                                // fallback: if tile type or cover indicates wall, use gray
                                const tt = String(t.type || t.coverType || '').toLowerCase();
                                if (tt === 'wall' || tt.startsWith('w')) color = 0x808080;
                            }
                            if (color !== null) {
                                try {
                                    // Use a lower alpha so the overlay is diagnostic but not fully opaque
                                    this.tileHiddenDebug.fillStyle(color, 0.45);
                                    this.tileHiddenDebug.fillRect(rectX, rectY, CONFIG.tileSize, CONFIG.tileSize);
                                } catch (e) { }
                            }
                        }
                    }
                }
            } catch (e) { }
            // Create/clear labels array
            try {
                if (this.tileGridLabels && Array.isArray(this.tileGridLabels)) {
                    this.tileGridLabels.forEach(l => { try { l.destroy(); } catch (e) { } });
                }
            } catch (e) { }
            this.tileGridLabels = [];

            // Create small coordinate labels centered in each tile when debug enabled
            const labelStyle = { font: '10px monospace', fill: '#ffffff', align: 'center' };
            for (let y = 0; y < mapRows; y++) {
                for (let x = 0; x < mapCols; x++) {
                    const cx = offsetX + x * CONFIG.tileSize + CONFIG.tileSize / 2;
                    const cy = offsetY + y * CONFIG.tileSize + CONFIG.tileSize / 2;
                    // include contactType in debug label when available
                    let labelText = `${y},${x}`;
                    try {
                        const t = (this.tiles && this.tiles[y]) ? this.tiles[y][x] : null;
                        let ctype = null;
                        if (t) {
                            if (t.sprite && typeof t.sprite.getData === 'function') {
                                ctype = t.sprite.getData('contactType') || null;
                            }
                            if (!ctype && t.contactType) ctype = t.contactType;
                            // fallback: derive from logical type using resolveContactSpec
                            if (!ctype && typeof resolveContactSpec === 'function') {
                                try {
                                    const spec = resolveContactSpec(t.type || null);
                                    if (spec && spec.contactType) ctype = spec.contactType;
                                } catch (e) { }
                            }
                        }
                        if (ctype) labelText = `${y},${x}\n${ctype}`;
                        else labelText = `${y},${x}`;
                    } catch (e) { }
                    const txt = this.add.text(cx, cy, labelText, labelStyle).setOrigin(0.5).setLineSpacing(0);
                    txt.setAlpha(0.7);
                    txt.setDepth(51);
                    // Keep label hidden unless debug enabled
                    txt.visible = !!CONFIG.debugTileGrid;
                    this.tileGridLabels.push(txt);
                }
            }

            // Visibility controlled by config but still toggleable with G
            this.tileGridDebug.visible = !!CONFIG.debugTileGrid;
            // Toggle visibility with G key (affects both strokes and labels)
            this.input.keyboard.on('keydown-G', () => {
                const visible = !this.tileGridDebug.visible;
                this.tileGridDebug.visible = visible;
                if (this.tileGridLabels && Array.isArray(this.tileGridLabels)) {
                    this.tileGridLabels.forEach(l => { l.visible = visible; });
                }
                // Also show/hide the hidden-tile overlay (noTile / hiddenReveal)
                try {
                    if (this.tileHiddenDebug) this.tileHiddenDebug.visible = visible;
                } catch (e) { }
            });
        } catch (e) {
            // ignore if input not ready or in non-interactive context
        }
    }

    // Recalculate render depth for layered sprites so depth corresponds to world Y position.
    // Sprites with larger Y (lower on screen) will be drawn above sprites with smaller Y.
    updateLayerDepths() {
        const setDepthFromY = (spr) => {
            try {
                if (!spr || !spr.active) return;
                // Keep UI/labels with intentionally large depths untouched
                if (spr.depth && spr.depth >= HUD_DEPTH) return;
                // Use rounded Y to avoid tiny jitter depth changes
                spr.setDepth(Math.round(spr.y));
            } catch (e) { }
        };

        // Groups to include in Y-based layering
        const groups = [
            this.walls, this.doors, this.items, this.gems, this.rocks,
            this.boulders, this.ghosts, this.bats, this.spiders, this.snakes, this.dynamites, this.shards,
            this.hole2Exits, this.planks
        ];

        groups.forEach(g => {
            try {
                if (!g) return;
                if (g.getChildren && typeof g.getChildren === 'function') {
                    g.getChildren().forEach(setDepthFromY);
                } else if (Array.isArray(g)) {
                    g.forEach(setDepthFromY);
                }
            } catch (e) { }
        });

        // Finally set players so they get ordered relative to objects
        try { if (this.player && this.player.active) this.player.setDepth(Math.round(this.player.y)); } catch (e) { }
        try { if (this.player2 && this.player2.active) this.player2.setDepth(Math.round(this.player2.y)); } catch (e) { }

        // If the player is moving upwards, allow certain objects (configured as 'center-front')
        // to render behind the player even when the player's Y is above them. This enables
        // the player to come alongside an object near its center and appear in front.
        try {
            const forceFrontWhenMovingUp = (playerObj) => {
                try {
                    if (!playerObj || !playerObj.active) return;
                    if (!this.lastMoveDir || Number(this.lastMoveDir.y) >= 0) return;
                    const px = Number(playerObj.x) || 0;
                    const py = Number(playerObj.y) || 0;
                    const tile = Number(CONFIG.tileSize) || 64;
                    // Default proximity in pixels; may be overridden per-object via contactSpec.proximityTiles
                    const defaultProx = tile * 0.9;

                    const groupsToCheck = [this.items, this.hole2Exits, this.walls, this.doors, this.gems];
                    for (const g of groupsToCheck) {
                        if (!g) continue;
                        const children = (g.getChildren && typeof g.getChildren === 'function') ? g.getChildren() : (Array.isArray(g) ? g : []);
                        for (const obj of children) {
                            try {
                                if (!obj || !obj.active) continue;
                                const ctype = (obj.getData && obj.getData('contactType')) || (obj.contactType || null);
                                if (!ctype || String(ctype).toLowerCase() !== 'center-front') continue;
                                // determine proximity threshold from object's contactSpec if present
                                let prox = defaultProx;
                                try {
                                    const objType = (obj.getData && obj.getData('type')) ? obj.getData('type') : null;
                                    const specForObj = objType ? resolveContactSpec(objType) : (obj.getData && obj.getData('contactSpec')) ? obj.getData('contactSpec') : null;
                                    if (specForObj) {
                                        if (typeof specForObj.proximityPixels === 'number') {
                                            prox = Number(specForObj.proximityPixels);
                                        } else if (typeof specForObj.proximityTiles === 'number') {
                                            prox = Number(specForObj.proximityTiles) * tile;
                                        }
                                    }
                                } catch (e) { }
                                const dx = Math.abs((Number(obj.x) || 0) - px);
                                const dy = Math.abs((Number(obj.y) || 0) - py);
                                if (dx <= prox && dy <= prox) {
                                    // put player slightly above the object depth so it renders in front
                                    try { playerObj.setDepth((obj.depth || Math.round(obj.y)) + 2); } catch (e) { }
                                    return;
                                }
                            } catch (e) { }
                        }
                    }
                } catch (e) { }
            };

            // apply for player1 and player2 if present
            try { forceFrontWhenMovingUp(this.player); } catch (e) { }
            try { forceFrontWhenMovingUp(this.player2); } catch (e) { }
        } catch (e) { }
    }

    getRandomWalkableTile() {
        if (!this.tiles || !this.tiles.length) return null;

        const maxAttempts = 100;
        let attempt = 0;
        let x = 0;
        let y = 0;

        while (attempt < maxAttempts) {
            x = Phaser.Math.Between(1, this.mapCols - 2);
            y = Phaser.Math.Between(1, this.mapRows - 2);

            const tile = this.tiles[y]?.[x];
            if (tile && (tile.type === 'floor' || tile.type === 'sand' || tile.type === 'empty')) {
                return { x, y };
            }
            attempt++;
        }

        return null;
    }

    getTileAt(x, y) {
        const gridX = Math.floor((x - this.mapOffsetX) / CONFIG.tileSize);
        const gridY = Math.floor((y - this.mapOffsetY) / CONFIG.tileSize);

        if (gridY >= 0 && gridY < this.tiles.length && gridX >= 0 && gridX < this.tiles[0].length) {
            return this.tiles[gridY][gridX];
        }
        return null;
    }

    revealHiddenMapObjects(centerX, centerY, radius) {
        if (!this.tiles || !this.tiles.length) return;
        const maxDist = Number(radius) || CONFIG.tileSize;

        for (let gridY = 0; gridY < this.tiles.length; gridY++) {
            for (let gridX = 0; gridX < this.tiles[gridY].length; gridX++) {
                const tile = this.tiles[gridY]?.[gridX];
                if (!tile || !tile.hiddenReveal || tile.hiddenRevealed) continue;

                const worldX = this.mapOffsetX + gridX * CONFIG.tileSize + CONFIG.tileSize / 2;
                const worldY = this.mapOffsetY + gridY * CONFIG.tileSize + CONFIG.tileSize / 2;
                const dist = Phaser.Math.Distance.Between(centerX, centerY, worldX, worldY);
                if (dist > maxDist) continue;

                if (tile.coverSprite && tile.coverSprite.active) {
                    tile.coverSprite.destroy();
                }

                this.spawnRevealedCellObject(gridX, gridY, tile.hiddenReveal);
                tile.hiddenRevealed = true;
                tile.hiddenReveal = null;
                tile.coverSprite = null;
            }
        }
    }

    revealHiddenAtGrid(gridX, gridY) {
        if (typeof gridX !== 'number' || typeof gridY !== 'number') return;
        const tile = this.tiles?.[gridY]?.[gridX];
        if (!tile || !tile.hiddenReveal || tile.hiddenRevealed) return;

        if (tile.coverSprite && tile.coverSprite.active) {
            tile.coverSprite.destroy();
        }

        this.spawnRevealedCellObject(gridX, gridY, tile.hiddenReveal);
        tile.hiddenRevealed = true;
        tile.hiddenReveal = null;
        tile.coverSprite = null;
    }

    spawnRevealedCellObject(gridX, gridY, revealCell) {
        if (!revealCell || typeof revealCell.type !== 'string') return;

        const worldX = this.mapOffsetX + gridX * CONFIG.tileSize + CONFIG.tileSize / 2;
        const worldY = this.mapOffsetY + gridY * CONFIG.tileSize + CONFIG.tileSize / 2;
        const revealType = revealCell.type;

        // Use central TILE_FRAMES from constants.js

        const createItemFromType = (itemType) => {
            if (!this.items) return;
            const frame = itemType === 'key'
                ? OBJECT_FRAMES.key
                : (itemType === 'pepita'
                    ? OBJECT_FRAMES.pepita
                    : (itemType === 'dynamite'
                        ? OBJECT_FRAMES.dynamite_chest
                        : (itemType === 'cart' ? OBJECT_FRAMES.cart : (itemType === 'helmet' ? OBJECT_FRAMES.helmet : OBJECT_FRAMES.skeleton))));
            const itemSprite = this.items.create(worldX, worldY, 'objects', frame);
            const objectScaleFactor = CONFIG.objectSize / OBJECT_NATIVE_SIZE;
            itemSprite.setScale(objectScaleFactor);
            if (itemSprite.body) {
                itemSprite.body.setSize(Math.floor(itemSprite.displayWidth || itemSprite.width), Math.floor(itemSprite.displayHeight || itemSprite.height));
            }
            itemSprite.setData('type', itemType);
            itemSprite.setData('gridX', gridX);
            itemSprite.setData('gridY', gridY);
            try { this.applyTokenEffects(itemSprite, revealCell.effects, worldX, worldY, revealCell.effectOptions); } catch (e) { }
            if (itemType === 'key') {
                this.applyKeyFloatingEffect(itemSprite);
            }

            if (itemType === 'key' && this.keySpawnPositions) {
                this.keySpawnPositions.push({ x: itemSprite.x, y: itemSprite.y });
            }
        };

        if (revealType === 'wall') {
        const revealWallMaxFrame = getTextureMaxNumericFrame(this, 'wall_tiles', WALL_TILE_COLS);
            const clampedRevealWallFrame = Phaser.Math.Clamp(Number(revealCell.wallFrame) || 0, 0, revealWallMaxFrame);
            const wallSprite = this.add.sprite(worldX, worldY, 'wall_tiles', clampedRevealWallFrame);
            wallSprite.setDisplaySize(Number(CONFIG.wallSize) || CONFIG.tileSize, Number(CONFIG.wallSize) || CONFIG.tileSize);
            if ((revealCell.wallRotation !== undefined && revealCell.wallRotation !== null) || revealCell.wallFlip) {
                const rr = Number(revealCell.wallRotation) || 0;
                const flip = String(revealCell.wallFlip ?? '0').toLowerCase();
                if (flip === 'h') wallSprite.setFlipX(true);
                else if (flip === 'v') wallSprite.setFlipY(true);
                else wallSprite.setAngle(rr * 90);
            }
            if (this.walls) {
                this.walls.add(wallSprite);
                if (wallSprite.body) {
                    wallSprite.body.setSize(Math.floor(wallSprite.displayWidth || wallSprite.width), Math.floor(wallSprite.displayHeight || wallSprite.height));
                }
            }
            try { this.applyTokenEffects(wallSprite, revealCell.effects, worldX, worldY, revealCell.effectOptions); } catch (e) { }
            this.tiles[gridY][gridX].type = 'wall';
            this.tiles[gridY][gridX].sprite = wallSprite;
            return;
        }

        if (revealType === 'door') {
            if (this.doors) {
                const door = this.doors.create(worldX, worldY, 'objects', OBJECT_FRAMES.door);
                this.setupDoor(door);
                try { this.applyTokenEffects(door, revealCell.effects, worldX, worldY, revealCell.effectOptions); } catch (e) { }
                this.hasDoorInMap = true;
            }
            this.tiles[gridY][gridX].type = 'empty';
            this.tiles[gridY][gridX].sprite = null;
            return;
        }
        if (revealType === 'key' || revealType === 'pepita' || revealType === 'dynamite' || revealType === 'cart' || revealType === 'skeleton') {
            createItemFromType(revealType);
            this.tiles[gridY][gridX].type = 'empty';
            this.tiles[gridY][gridX].sprite = null;
            return;
        }

        if (revealType === 'gem') {
            if (this.gems) {
                this.createGemPickupAt(worldX, worldY, revealCell.effects, revealCell.effectOptions);
                this.gemsRemaining = (Number(this.gemsRemaining) || 0) + 1;
            }
            this.tiles[gridY][gridX].type = 'empty';
            this.tiles[gridY][gridX].sprite = null;
            return;
        }

        if (revealType === 'hole2') {
            if (!this.hole2ExitPositions) {
                this.hole2ExitPositions = [];
            }
            this.hole2ExitPositions.push({
                x: worldX,
                y: worldY,
                gridX,
                gridY,
                exitTargetLevelIndex: Number.isFinite(Number(revealCell.exitTargetLevelIndex)) ? Number(revealCell.exitTargetLevelIndex) : null,
                exitTargetLevelId: revealCell.exitTargetLevelId || null,
                effects: Array.isArray(revealCell.effects) ? revealCell.effects : [],
                effectOptions: (revealCell.effectOptions && typeof revealCell.effectOptions === 'object' && !Array.isArray(revealCell.effectOptions)) ? revealCell.effectOptions : {}
            });
            this.tiles[gridY][gridX].type = 'empty';
            this.tiles[gridY][gridX].sprite = null;

            if (this.hole2ExitsActive && (Number(this.gemsRemaining) || 0) <= 0) {
                this.spawnHole2ExitAt(
                    worldX,
                    worldY,
                    gridX,
                    gridY,
                    revealCell.exitTargetLevelIndex,
                    revealCell.exitTargetLevelId,
                    revealCell.effects,
                    revealCell.effectOptions
                );
            }
            return;
        }

        if (revealType === 'back') {
            this.tiles[gridY][gridX].type = 'back';
            this.tiles[gridY][gridX].sprite = null;
            this.tiles[gridY][gridX].backTargetLevelIndex = Number.isFinite(Number(revealCell.backTargetLevelIndex)) ? Number(revealCell.backTargetLevelIndex) : null;
            this.tiles[gridY][gridX].backTargetLevelId = revealCell.backTargetLevelId || null;
            this.tiles[gridY][gridX].effects = Array.isArray(revealCell.effects) ? revealCell.effects : [];
            this.tiles[gridY][gridX].effectOptions = (revealCell.effectOptions && typeof revealCell.effectOptions === 'object' && !Array.isArray(revealCell.effectOptions)) ? revealCell.effectOptions : {};
            try { this.spawnBackLabelAt(worldX, worldY); } catch (e) { }
            return;
        }

        if (revealType === 'empty') {
            this.tiles[gridY][gridX].type = 'empty';
            this.tiles[gridY][gridX].sprite = null;
            return;
        }

        const baseFrame = TILE_FRAMES[revealType];
        if (baseFrame !== undefined) {
            const tileSprite = this.add.sprite(worldX, worldY, 'tiles', baseFrame);
            tileSprite.setDisplaySize(CONFIG.tileSize, CONFIG.tileSize);
            try { this.applyTokenEffects(tileSprite, revealCell.effects, worldX, worldY, revealCell.effectOptions); } catch (e) { }
            this.tiles[gridY][gridX].type = revealType;
            this.tiles[gridY][gridX].sprite = tileSprite;
            return;
        }

        this.tiles[gridY][gridX].type = 'floor';
    }

    // Place a wooden plank for a specific player (tries to bridge nearby hole)
    placePlankFor(player) {
        if (!player || !player.active) return false;
        try {
            let used = false;
            const px = player.x || 0;
            const py = player.y || 0;
            const baseGX = Math.floor((px - (this.mapOffsetX || 0)) / CONFIG.tileSize);
            const baseGY = Math.floor((py - (this.mapOffsetY || 0)) / CONFIG.tileSize);

            for (let oy = -1; oy <= 1 && !used; oy++) {
                for (let ox = -1; ox <= 1 && !used; ox++) {
                    const gx = baseGX + ox;
                    const gy = baseGY + oy;
                    if (!this.tiles[gy] || !this.tiles[gy][gx]) continue;
                    const tt = this.tiles[gy][gx];
                    if (tt && tt.type === 'hole') {
                        // Determine wooden plank count for this player (support per-player inventories)
                        const playersCount = Number(GAME_STATE.players) || 1;
                        let availableWood = 0;
                        if (playersCount === 2) {
                            if (player === this.player) availableWood = Number(GAME_STATE.woodenP1) || 0;
                            else if (player === this.player2) availableWood = Number(GAME_STATE.woodenP2) || 0;
                            else availableWood = Number(GAME_STATE.woodenCount) || 0;
                        } else {
                            availableWood = Number(GAME_STATE.woodenCount) || 0;
                        }
                        if (availableWood > 0) {
                            // consume one from the proper slot
                            if (playersCount === 2) {
                                if (player === this.player) GAME_STATE.woodenP1 = Math.max(0, (Number(GAME_STATE.woodenP1) || 0) - 1);
                                else if (player === this.player2) GAME_STATE.woodenP2 = Math.max(0, (Number(GAME_STATE.woodenP2) || 0) - 1);
                                else GAME_STATE.woodenCount = Math.max(0, (Number(GAME_STATE.woodenCount) || 0) - 1);
                            } else {
                                GAME_STATE.woodenCount = Math.max(0, (Number(GAME_STATE.woodenCount) || 0) - 1);
                            }
                            tt.type = 'floor';
                            try { if (tt.sprite && tt.sprite.setFrame) tt.sprite.setFrame(TILE_FRAMES.hole_cover); } catch (e) { }
                            try { if (tt.sprite && tt.sprite.setData) tt.sprite.setData('covered', true); } catch (e) { }

                            // Use tiles.png hole_cover frame for visual cover instead of separate plank image
                            try {
                                if (tt.sprite && tt.sprite.setFrame) {
                                    tt.sprite.setFrame(TILE_FRAMES.hole_cover);
                                    tt.sprite.setData && tt.sprite.setData('covered', true);
                                    tt.coverSprite = tt.sprite;
                                } else {
                                    tt.coverSprite = null;
                                }
                            } catch (e) { }

                            // persist placed plank for this level
                            try {
                                GAME_STATE.placedPlanks = GAME_STATE.placedPlanks || [];
                                GAME_STATE.placedPlanks.push({ level: Number(GAME_STATE.currentLevel) || 0, gridX: gx, gridY: gy });
                                localStorage.setItem('blockHunterPlacedPlanks', JSON.stringify(GAME_STATE.placedPlanks));
                            } catch (e) { }

                            if (this.sound) this.sound.play('select_sfx', { volume: 0.4 });
                            this.refreshHudIcons && this.refreshHudIcons();
                            used = true;
                        }
                    }
                }
            }
            return used;
        } catch (e) {
            return false;
        }
    }

    restorePlacedPlanks() {
        try {
            const placed = Array.isArray(GAME_STATE.placedPlanks) ? GAME_STATE.placedPlanks : [];
            for (const p of placed) {
                if (Number(p.level) !== Number(GAME_STATE.currentLevel)) continue;
                const gx = Number(p.gridX);
                const gy = Number(p.gridY);
                if (!this.tiles[gy] || !this.tiles[gy][gx]) continue;
                const tt = this.tiles[gy][gx];
                if (!tt) continue;
                // mark as floor, set hole_cover frame and add overlay if not already
                tt.type = 'floor';
                try { if (tt.sprite && tt.sprite.setFrame) tt.sprite.setFrame(TILE_FRAMES.hole_cover); } catch (e) { }
                try { if (tt.sprite && tt.sprite.setData) tt.sprite.setData('covered', true); } catch (e) { }
                // Do not create a separate wooden_plank overlay. Use the tile frame as the cover.
                try { tt.coverSprite = (tt.sprite ? tt.sprite : null); } catch (e) { tt.coverSprite = null; }
            }
        } catch (e) { }
    }
};
}
