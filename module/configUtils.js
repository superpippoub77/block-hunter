export function mergeLocalConfig(config, objectNativeSize, logger) {
    logger.trace('mergeLocalConfig', 'Tentativo merge config locale');
    try {
        const saved = localStorage.getItem('blockHunterConfig');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.tileSize) config.tileSize = parsed.tileSize;
            if (parsed.objectSize) config.objectSize = parsed.objectSize;
            if (parsed.playerSize) config.playerSize = parsed.playerSize;
            if (parsed.helmetRadiusTiles) config.helmetRadiusTiles = parsed.helmetRadiusTiles;
            // Backwards compatibility: support old 'objectScale' saved values
            else if (parsed.objectScale) config.objectSize = Math.round(parsed.objectScale * objectNativeSize);
        }
    } catch (e) {
        logger.warn('mergeLocalConfig', 'Errore accesso localStorage, merge saltato', e);
        // ignore localStorage errors
    }
}

export function loadTranslations(lang, translations, logger, callback) {
    logger.info('loadTranslations', 'Caricamento traduzioni', `lang=${lang}`);
    fetch(`data/dic/${lang}.json`)
        .then((res) => res.json())
        .then((data) => {
            translations[lang] = data;
            logger.debug('loadTranslations', 'Traduzioni caricate', `lang=${lang}`);
            if (typeof callback === 'function') callback(data);
        })
        .catch(() => {
            translations[lang] = {};
            logger.warn('loadTranslations', 'Fallback traduzioni vuote', `lang=${lang}`);
            if (typeof callback === 'function') callback({});
        });
}
