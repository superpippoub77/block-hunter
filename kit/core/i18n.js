// Dictionaries: data/dic/<lang>.json, cached in the shared TRANSLATIONS object.
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
