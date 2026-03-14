const DEFAULT_LANGUAGES = ['it', 'fr', 'de', 'en', 'us', 'ja', 'es', 'zh'];
const DEFAULT_CONTROL_PANEL_COMMANDS = {
    previous: ['LEFT', 'ARROWLEFT'],
    next: ['RIGHT', 'ARROWRIGHT']
};
const DEFAULT_CONFIG_CACHE_KEY = 'languageCarouselOptions';
const DEFAULT_DICTIONARY_BASE_PATH = 'data/dic';

function normalizeControlToken(value) {
    return String(value || '').trim().toUpperCase();
}

function normalizeKeyboardToken(event) {
    const rawKey = String(event?.key || event?.code || '').trim().toUpperCase();
    if (rawKey === 'SPACEBAR') return ' ';
    return rawKey;
}

function toTokenSet(input, fallback) {
    const base = Array.isArray(input) ? input : fallback;
    const tokens = base
        .map((token) => normalizeControlToken(token))
        .filter(Boolean);
    return new Set(tokens);
}

function readCarouselConfigFromScene(scene, opts = {}) {
    const keyFromOpts = String(opts.configCacheKey || '').trim();
    const key = keyFromOpts || DEFAULT_CONFIG_CACHE_KEY;
    try {
        const cfg = scene?.cache?.json?.get?.(key);
        if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
            return cfg;
        }
    } catch (e) { }
    return {};
}

// Shared translation loader for module-local dictionaries.
export function loadLanguageCarouselTranslations(lang, callback, opts = {}) {
    const languageCode = String(lang || '').trim().toLowerCase();
    const basePath = String(opts.basePath || DEFAULT_DICTIONARY_BASE_PATH).replace(/\/+$/, '');
    const done = (payload) => {
        if (typeof callback === 'function') {
            try { callback(payload || {}); } catch (e) { }
        }
    };

    if (!languageCode) {
        done({});
        return;
    }

    const url = `${basePath}/${languageCode}.json`;
    fetch(url)
        .then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then((data) => {
            const normalized = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
            done(normalized);
        })
        .catch(() => {
            done({});
        });
}

function drawFlagFrame(ctx, x, y, w, h, lang) {
    const code = String(lang || '').toLowerCase();

    // Border to keep white flags visible on bright backgrounds.
    ctx.fillStyle = '#202020';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);

    if (code === 'it') {
        ctx.fillStyle = '#009246';
        ctx.fillRect(x + 1, y + 1, Math.floor((w - 2) / 3), h - 2);
        ctx.fillStyle = '#ce2b37';
        ctx.fillRect(x + 1 + Math.floor(((w - 2) * 2) / 3), y + 1, Math.ceil((w - 2) / 3), h - 2);
        return;
    }
    if (code === 'fr') {
        ctx.fillStyle = '#0055a4';
        ctx.fillRect(x + 1, y + 1, Math.floor((w - 2) / 3), h - 2);
        ctx.fillStyle = '#ef4135';
        ctx.fillRect(x + 1 + Math.floor(((w - 2) * 2) / 3), y + 1, Math.ceil((w - 2) / 3), h - 2);
        return;
    }
    if (code === 'de') {
        const stripe = Math.floor((h - 2) / 3);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 1, y + 1, w - 2, stripe);
        ctx.fillStyle = '#dd0000';
        ctx.fillRect(x + 1, y + 1 + stripe, w - 2, stripe);
        ctx.fillStyle = '#ffce00';
        ctx.fillRect(x + 1, y + 1 + stripe * 2, w - 2, (h - 2) - stripe * 2);
        return;
    }
    if (code === 'en') {
        ctx.fillStyle = '#012169';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + Math.floor(w * 0.42), y + 1, Math.max(6, Math.floor(w * 0.16)), h - 2);
        ctx.fillRect(x + 1, y + Math.floor(h * 0.38), w - 2, Math.max(6, Math.floor(h * 0.24)));
        ctx.fillStyle = '#c8102e';
        ctx.fillRect(x + Math.floor(w * 0.455), y + 1, Math.max(3, Math.floor(w * 0.09)), h - 2);
        ctx.fillRect(x + 1, y + Math.floor(h * 0.44), w - 2, Math.max(3, Math.floor(h * 0.12)));
        return;
    }
    if (code === 'us') {
        for (let i = 0; i < 7; i++) {
            ctx.fillStyle = (i % 2 === 0) ? '#b22234' : '#ffffff';
            const sy = y + 1 + Math.floor(((h - 2) / 7) * i);
            const sh = (i === 6)
                ? (h - 2) - Math.floor(((h - 2) / 7) * i)
                : Math.floor((h - 2) / 7);
            ctx.fillRect(x + 1, sy, w - 2, sh);
        }
        ctx.fillStyle = '#3c3b6e';
        ctx.fillRect(x + 1, y + 1, Math.floor((w - 2) * 0.38), Math.floor((h - 2) * 0.56));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 5, y + 5, 2, 2);
        ctx.fillRect(x + 10, y + 8, 2, 2);
        ctx.fillRect(x + 15, y + 6, 2, 2);
        return;
    }
    if (code === 'ja') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#bc002d';
        ctx.beginPath();
        ctx.arc(x + Math.floor(w / 2), y + Math.floor(h / 2), Math.max(5, Math.floor(h * 0.24)), 0, Math.PI * 2);
        ctx.fill();
        return;
    }
    if (code === 'es') {
        ctx.fillStyle = '#aa151b';
        ctx.fillRect(x + 1, y + 1, w - 2, Math.floor((h - 2) * 0.25));
        ctx.fillStyle = '#f1bf00';
        ctx.fillRect(x + 1, y + 1 + Math.floor((h - 2) * 0.25), w - 2, Math.floor((h - 2) * 0.5));
        ctx.fillStyle = '#aa151b';
        ctx.fillRect(x + 1, y + 1 + Math.floor((h - 2) * 0.75), w - 2, (h - 2) - Math.floor((h - 2) * 0.75));
        return;
    }
    if (code === 'zh') {
        ctx.fillStyle = '#de2910';
        ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = '#ffde00';
        ctx.beginPath();
        ctx.arc(x + 10, y + 9, 4, 0, Math.PI * 2);
        ctx.fill();
        return;
    }

    // Fallback: neutral placeholder with language code.
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px sans-serif';
    ctx.fillText(code.toUpperCase(), x + 5, y + Math.floor(h * 0.68));
}

function ensureFlagsTexture(scene, opts = {}) {
    const textureKey = String(opts.textureKey || 'flags');
    const frameWidth = Math.max(8, Number(opts.frameWidth) || 64);
    const frameHeight = Math.max(8, Number(opts.frameHeight) || 32);
    const languages = Array.isArray(opts.languages) && opts.languages.length
        ? opts.languages
        : DEFAULT_LANGUAGES;

    if (!scene || !scene.textures) return textureKey;
    if (scene.textures.exists(textureKey)) return textureKey;

    const canvas = document.createElement('canvas');
    canvas.width = frameWidth * languages.length;
    canvas.height = frameHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return textureKey;

    languages.forEach((lang, idx) => {
        const x = idx * frameWidth;
        drawFlagFrame(ctx, x, 0, frameWidth, frameHeight, lang);
    });

    scene.textures.addSpriteSheet(textureKey, canvas, {
        frameWidth,
        frameHeight,
        endFrame: Math.max(0, languages.length - 1)
    });

    return textureKey;
}

// Small reusable language carousel UI for scenes.
// Self-contained: it creates its own flag spritesheet if not preloaded.
export function createLanguageCarousel(scene, opts = {}) {
    const fileCfg = readCarouselConfigFromScene(scene, opts);

    const cfgLanguages = Array.isArray(fileCfg.languages) && fileCfg.languages.length
        ? fileCfg.languages
        : null;
    const languages = opts.languages || cfgLanguages || DEFAULT_LANGUAGES;
    let index = (typeof opts.index === 'number') ? opts.index : 0;
    const cfgX = Number(fileCfg?.position?.x);
    const cfgY = Number(fileCfg?.position?.y);
    const x = (typeof opts.x === 'number') ? opts.x : (Number.isFinite(cfgX) ? cfgX : 400);
    const y = (typeof opts.y === 'number') ? opts.y : (Number.isFinite(cfgY) ? cfgY : 560);
    const hudDepth = (typeof opts.hudDepth === 'number')
        ? opts.hudDepth
        : ((typeof fileCfg.hudDepth === 'number') ? fileCfg.hudDepth : 10000);
    const font = opts.font || fileCfg.font || '"Press Start 2P"';
    const rawControlPanelCommands = (opts.controlPanelCommands && typeof opts.controlPanelCommands === 'object')
        ? opts.controlPanelCommands
        : ((fileCfg.controlPanelCommands && typeof fileCfg.controlPanelCommands === 'object') ? fileCfg.controlPanelCommands : {});

    const arrowOffset = (typeof opts.arrowOffset === 'number')
        ? opts.arrowOffset
        : ((typeof fileCfg.arrowOffset === 'number') ? fileCfg.arrowOffset : 80);
    const arrowFontSize = String(opts.arrowFontSize || fileCfg.arrowFontSize || '24px');
    const arrowColor = String(opts.arrowColor || fileCfg.arrowColor || '#ffffff');

    const rawSelectSound = (fileCfg?.sounds && fileCfg.sounds.select && typeof fileCfg.sounds.select === 'object')
        ? fileCfg.sounds.select
        : {};
    const selectSound = {
        key: String(rawSelectSound.key || 'language_carousel_select').trim(),
        src: String(rawSelectSound.src || '').trim(),
        volume: Number.isFinite(Number(rawSelectSound.volume)) ? Number(rawSelectSound.volume) : 0.4
    };
    let selectSoundLoading = false;

    const flagsTextureKey = ensureFlagsTexture(scene, {
        textureKey: opts.flagsTextureKey || fileCfg.textureKey || 'flags',
        flagsImageSrc: opts.flagsImageSrc || fileCfg.flagsImageSrc || '',
        frameWidth: opts.flagsFrameWidth || fileCfg.flagsFrameWidth || 64,
        frameHeight: opts.flagsFrameHeight || fileCfg.flagsFrameHeight || 32,
        languages
    });

    const controlPanelCommands = {
        previous: toTokenSet(rawControlPanelCommands.previous, DEFAULT_CONTROL_PANEL_COMMANDS.previous),
        next: toTokenSet(rawControlPanelCommands.next, DEFAULT_CONTROL_PANEL_COMMANDS.next)
    };
    const dictionaryBasePath = String(
        opts.dictionaryBasePath
        || fileCfg?.dictionaries?.basePath
        || DEFAULT_DICTIONARY_BASE_PATH
    ).replace(/\/+$/, '');
    const dictionaryCache = new Map();

    const flagSprite = scene.add.sprite(x, y, flagsTextureKey, index).setOrigin(0.5).setDepth(hudDepth).setScrollFactor(0);
    // store the base X so external animations can reliably reset position
    flagSprite.baseX = x;
    try {
        scene.tweens.add({
            targets: flagSprite,
            scaleX: 1.05,
            scaleY: 0.98,
            angle: -2,
            duration: 400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        scene.tweens.add({
            targets: flagSprite,
            y: y - 2,
            duration: 600,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: 200
        });
    } catch (e) { }

    const leftArrow = scene.add.text(x - arrowOffset, y, '◄', {
        fontSize: arrowFontSize,
        fill: arrowColor,
        fontFamily: font
    }).setOrigin(0.5).setInteractive().setDepth(hudDepth).setScrollFactor(0);

    const rightArrow = scene.add.text(x + arrowOffset, y, '►', {
        fontSize: arrowFontSize,
        fill: arrowColor,
        fontFamily: font
    }).setOrigin(0.5).setInteractive().setDepth(hudDepth).setScrollFactor(0);

    const pulseArrow = (arrow) => {
        if (!arrow) return;
        try {
            const original = (arrow.style && arrow.style.fill) || '#ffffff';
            arrow.setStyle && arrow.setStyle({ fill: '#ffff00' });
            scene.tweens.add({ targets: arrow, scaleX: 1.6, scaleY: 1.6, duration: 120, yoyo: true, ease: 'Sine.easeOut', onComplete: () => {
                try { arrow.setStyle && arrow.setStyle({ fill: original }); } catch (e) { }
            }});
        } catch (e) { }
    };

    const animateLanguageChange = (dir) => {
        try {
            if (flagSprite) {
                const dirSign = (dir > 0) ? 1 : -1;
                const baseX = Number(flagSprite.baseX) || Number(flagSprite.x) || x;
                flagSprite.x = baseX;
                scene.tweens.add({
                    targets: flagSprite,
                    x: baseX + (dirSign * 28),
                    angle: dirSign * 6,
                    scaleX: 1.15,
                    scaleY: 0.95,
                    duration: 140,
                    yoyo: true,
                    ease: 'Cubic.easeOut',
                    onComplete: () => {
                        try {
                            flagSprite.x = baseX;
                            flagSprite.setAngle(0);
                            flagSprite.setScale(1, 1);
                        } catch (e) { }
                    }
                });
            }
        } catch (e) { }

        try {
            if (dir > 0) pulseArrow(rightArrow);
            else if (dir < 0) pulseArrow(leftArrow);
        } catch (e) { }
    };

    const setIndex = (newIndex, dir) => {
        index = ((newIndex % languages.length) + languages.length) % languages.length;
        try { flagSprite.setFrame(index); } catch (e) { }
        if (typeof opts.onIndexChange === 'function') {
            try { opts.onIndexChange(index, languages[index], dir); } catch (e) { }
        }
    };

    const requestChange = (dir) => {
        if (typeof opts.onRequestChange === 'function') {
            try { opts.onRequestChange(dir); } catch (e) { }
            return;
        }
        changeLanguage(dir, {});
    };

    const syncLanguage = (lang, options = {}) => {
        const languageCode = String(lang || '').trim().toLowerCase();
        if (!languageCode) return null;

        const idx = languages.indexOf(languageCode);
        if (idx < 0) return null;

        setIndex(idx, 0);
        if (options.gameState && typeof options.gameState === 'object') {
            options.gameState.language = languages[index];
        }
        return languages[index];
    };

    const canPlaySelectSoundNow = () => {
        const key = String(selectSound.key || '').trim();
        return !!(key && scene?.cache?.audio?.exists && scene.cache.audio.exists(key));
    };

    const ensureSelectSoundLoaded = () => {
        const key = String(selectSound.key || '').trim();
        const src = String(selectSound.src || '').trim();
        if (!key || !src || !scene || !scene.load) return false;
        if (canPlaySelectSoundNow()) return true;
        if (selectSoundLoading) return false;

        try {
            selectSoundLoading = true;
            scene.load.audio(key, src);
            scene.load.once(`filecomplete-audio-${key}`, () => {
                selectSoundLoading = false;
            });
            scene.load.once('loaderror', () => {
                selectSoundLoading = false;
            });
            if (!scene.load.isLoading()) {
                scene.load.start();
            }
        } catch (e) {
            selectSoundLoading = false;
        }

        return false;
    };

    const playSelectSound = (volumeOverride) => {
        try {
            const key = String(selectSound.key || '').trim();
            if (!key || !scene || !scene.sound) return false;

            const volume = Number.isFinite(Number(volumeOverride)) ? Number(volumeOverride) : selectSound.volume;
            if (canPlaySelectSoundNow()) {
                scene.sound.play(key, { volume });
                return true;
            }

            const started = ensureSelectSoundLoaded();
            if (!started) {
                // If load has just been queued, try to play as soon as this file completes.
                try {
                    scene.load.once(`filecomplete-audio-${key}`, () => {
                        try {
                            scene.sound.play(key, { volume });
                        } catch (e) { }
                    });
                } catch (e) { }
            }
        } catch (e) { }
        return false;
    };

    // Load language dictionaries from the plugin-local dic folder with cache.
    const loadTranslations = (lang, callback) => {
        const languageCode = String(lang || '').trim().toLowerCase();
        const done = (payload) => {
            if (typeof callback === 'function') {
                try { callback(payload || {}); } catch (e) { }
            }
        };

        if (!languageCode) {
            done({});
            return;
        }

        if (dictionaryCache.has(languageCode)) {
            done(dictionaryCache.get(languageCode));
            return;
        }

        loadLanguageCarouselTranslations(languageCode, (data) => {
            const normalized = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};
            dictionaryCache.set(languageCode, normalized);
            done(normalized);
        }, {
            basePath: dictionaryBasePath
        });
    };

    const changeLanguage = (dir, options = {}) => {
        const direction = Number(dir) < 0 ? -1 : 1;
        const previousLanguage = String(languages[index] || '').trim().toLowerCase();

        if (options.playSelectSfx !== false) {
            let played = false;
            try { played = playSelectSound(options.volume); } catch (e) { }
            if (!played && scene?.sound) {
                try { scene.sound.play('select_sfx', { volume: 0.4 }); } catch (e) { }
            }
        }

        setIndex(index + direction, direction);
        const nextLanguage = String(languages[index] || '').trim().toLowerCase();

        if (options.gameState && typeof options.gameState === 'object') {
            options.gameState.language = nextLanguage;
        }

        if (nextLanguage && previousLanguage !== nextLanguage) {
            animateLanguageChange(direction);
        }

        loadTranslations(nextLanguage, (payload) => {
            const normalized = (payload && typeof payload === 'object' && !Array.isArray(payload)) ? payload : {};
            if (options.translationStore && typeof options.translationStore === 'object' && nextLanguage) {
                options.translationStore[nextLanguage] = normalized;
            }
            if (typeof options.onAfter === 'function') {
                try { options.onAfter(nextLanguage, normalized); } catch (e) { }
            }
        });

        return nextLanguage;
    };

    // Accepts command names from an external control panel (or keyboard handler).
    const handleControlPanelCommand = (command) => {
        const token = normalizeControlToken(command);
        if (!token) return false;
        if (controlPanelCommands.previous.has(token)) {
            requestChange(-1);
            return true;
        }
        if (controlPanelCommands.next.has(token)) {
            requestChange(1);
            return true;
        }
        return false;
    };

    const handleKeyboardInput = (event, options = {}) => {
        const key = normalizeKeyboardToken(event);
        const code = normalizeControlToken(event?.code);

        if (controlPanelCommands.previous.has(key) || (code && controlPanelCommands.previous.has(code))) {
            changeLanguage(-1, options);
            return true;
        }
        if (controlPanelCommands.next.has(key) || (code && controlPanelCommands.next.has(code))) {
            changeLanguage(1, options);
            return true;
        }

        return false;
    };

    const getHandledControlTokens = () => {
        const tokens = new Set();
        for (const token of controlPanelCommands.previous) tokens.add(token);
        for (const token of controlPanelCommands.next) tokens.add(token);
        return Array.from(tokens);
    };

    // attach pointer handlers that call scene.changeLanguage (if available) or fall back to setIndex
    try {
        leftArrow.on && leftArrow.on('pointerdown', () => {
            try { pulseArrow(leftArrow); } catch (e) {}
            requestChange(-1);
        });
    } catch (e) { }
    try {
        rightArrow.on && rightArrow.on('pointerdown', () => {
            try { pulseArrow(rightArrow); } catch (e) {}
            requestChange(1);
        });
    } catch (e) { }

    // expose on the scene for backward compatibility so game.js doesn't need extra assignments
    try {
        if (scene) {
            scene.flagSprite = flagSprite;
            scene.leftArrow = leftArrow;
            scene.rightArrow = rightArrow;
            scene.pulseArrow = pulseArrow;
            scene.handleLanguageControlPanelCommand = handleControlPanelCommand;
            scene.playLanguageCarouselSelectSound = playSelectSound;
            scene.loadLanguageCarouselTranslations = loadTranslations;
            scene.changeLanguageWithCarousel = changeLanguage;
        }
    } catch (e) { }

    // Preload lazily in the active scene lifecycle to avoid audio-missing race on first keypress.
    ensureSelectSoundLoaded();

    return {
        languages,
        get index() { return index; },
        controlPanelCommands,
        selectSound,
        flagSprite,
        leftArrow,
        rightArrow,
        pulseArrow,
        setIndex,
        handleControlPanelCommand,
        handleKeyboardInput,
        getHandledControlTokens,
        loadTranslations,
        changeLanguage,
        syncLanguage,
        animateLanguageChange,
        ensureSelectSoundLoaded,
        playSelectSound,
        dictionaryBasePath
    };
}
