export const LOG_LEVELS = Object.freeze({
    TRACE: 10,
    DEBUG: 20,
    INFO: 30,
    WARN: 40,
    ERROR: 50
});

export const LOG_LEVEL_NAMES = Object.freeze({
    10: 'TRACE',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARN',
    50: 'ERROR'
});

export function normalizeLogLevel(rawLevel) {
    const upper = String(rawLevel || '').trim().toUpperCase();
    if (LOG_LEVELS[upper]) return LOG_LEVELS[upper];
    const numeric = Number(rawLevel);
    if (Number.isFinite(numeric) && LOG_LEVEL_NAMES[numeric]) return numeric;
    return LOG_LEVELS.INFO;
}

export function readInitialLogLevel() {
    try {
        const qs = new URLSearchParams(window.location.search || '');
        const fromQuery = qs.get('logLevel');
        if (fromQuery) return normalizeLogLevel(fromQuery);
    } catch (e) { /* ignore */ }

    try {
        const fromStorage = localStorage.getItem('blockHunterLogLevel');
        if (fromStorage) return normalizeLogLevel(fromStorage);
    } catch (e) { /* ignore */ }

    return LOG_LEVELS.INFO;
}

export function createLogger() {
    let activeLevel = readInitialLogLevel();

    const alwaysVisible = new Set([LOG_LEVELS.WARN, LOG_LEVELS.ERROR]);

    const canLog = (level) => alwaysVisible.has(level) || level >= activeLevel;

    const summarizeArg = (arg) => {
        if (arg == null) return arg;
        if (typeof arg === 'string') return arg.length > 120 ? `${arg.slice(0, 117)}...` : arg;
        if (typeof arg === 'number' || typeof arg === 'boolean') return arg;
        if (Array.isArray(arg)) return `[array:${arg.length}]`;
        if (arg && typeof arg === 'object') {
            const ctor = arg.constructor && arg.constructor.name ? arg.constructor.name : 'Object';
            return `[${ctor}]`;
        }
        return typeof arg;
    };

    const write = (level, scope, message, ...meta) => {
        if (!canLog(level)) return;

        const levelName = LOG_LEVEL_NAMES[level] || 'INFO';
        const prefix = `[${levelName}][${scope}] ${message}`;
        const reducedMeta = (meta || []).map(summarizeArg);

        if (level === LOG_LEVELS.ERROR) {
            console.error(prefix, ...reducedMeta);
            return;
        }
        if (level === LOG_LEVELS.WARN) {
            console.warn(prefix, ...reducedMeta);
            return;
        }
        console.log(prefix, ...reducedMeta);
    };

    return {
        getLevel() {
            return LOG_LEVEL_NAMES[activeLevel] || 'INFO';
        },
        setLevel(nextLevel) {
            activeLevel = normalizeLogLevel(nextLevel);
            try { localStorage.setItem('blockHunterLogLevel', LOG_LEVEL_NAMES[activeLevel]); } catch (e) { /* ignore */ }
            write(LOG_LEVELS.INFO, 'LOGGER', `Log level impostato a ${LOG_LEVEL_NAMES[activeLevel]}`);
        },
        trace(scope, message, ...meta) {
            write(LOG_LEVELS.TRACE, scope, message, ...meta);
        },
        debug(scope, message, ...meta) {
            write(LOG_LEVELS.DEBUG, scope, message, ...meta);
        },
        info(scope, message, ...meta) {
            write(LOG_LEVELS.INFO, scope, message, ...meta);
        },
        warn(scope, message, ...meta) {
            write(LOG_LEVELS.WARN, scope, message, ...meta);
        },
        error(scope, message, ...meta) {
            write(LOG_LEVELS.ERROR, scope, message, ...meta);
        }
    };
}
