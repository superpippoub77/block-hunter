export const LEVEL_CONFIG = {
    globalRules: {
        staticRocks: {
            sizes: ['small', 'medium', 'large'],
            randomSpawn: true,
            generateShards: false
        },
        dynamicBoulders: {
            sizes: {
                small: { shards: [0, 1] },
                medium: { shards: [2, 3] },
                large: { shards: [4, 6] }
            }
        }
    },
    levels: [
        { id: '1.0', staticRocks: true, dynamicBoulders: false, speed: 1, escapeRoute: false },
        { id: '1.1', staticRocks: true, dynamicBoulders: false, speed: 2, escapeRoute: false },
        { id: '1.2', staticRocks: true, dynamicBoulders: false, speed: 3, escapeRoute: false },
        { id: '1.3', staticRocks: true, dynamicBoulders: false, speed: 4, escapeRoute: true },
        { id: '1.4', staticRocks: true, dynamicBoulders: false, speed: 5, escapeRoute: true },
        { id: '2.0', staticRocks: true, dynamicBoulders: { directions: ['top'], sizes: ['medium'] }, speed: 1, escapeRoute: false },
        { id: '2.1', staticRocks: true, dynamicBoulders: { directions: ['bottom'], sizes: ['medium'] }, speed: 2, escapeRoute: false },
        { id: '2.2', staticRocks: true, dynamicBoulders: { directions: ['top', 'bottom'], sizes: ['medium'] }, speed: 1, escapeRoute: false },
        { id: '2.3', staticRocks: true, dynamicBoulders: { directions: ['top', 'bottom'], sizes: ['medium', 'large'] }, speed: 2, escapeRoute: true },
        { id: '2.4', staticRocks: true, dynamicBoulders: { directions: ['top', 'bottom'], sizes: ['large'] }, speed: 3, escapeRoute: true },
        { id: '3.0', staticRocks: true, dynamicBoulders: { directions: ['right'], sizes: ['medium'] }, speed: 1, escapeRoute: false },
        { id: '3.1', staticRocks: true, dynamicBoulders: { directions: ['left'], sizes: ['medium'] }, speed: 2, escapeRoute: false },
        { id: '3.2', staticRocks: true, dynamicBoulders: { directions: ['left', 'right'], sizes: ['medium'] }, speed: 1, escapeRoute: false },
        { id: '3.3', staticRocks: true, dynamicBoulders: { directions: ['left', 'right'], sizes: ['medium', 'large'] }, speed: 2, escapeRoute: true },
        { id: '3.4', staticRocks: true, dynamicBoulders: { directions: ['left', 'right'], sizes: ['large'] }, speed: 3, escapeRoute: true },
        { id: '4.0', staticRocks: true, dynamicBoulders: { directions: ['top', 'bottom', 'left', 'right'], sizes: ['medium'] }, speed: 1, escapeRoute: true },
        { id: '4.1', staticRocks: true, dynamicBoulders: { directions: ['top', 'bottom', 'left', 'right'], sizes: ['medium', 'large'] }, speed: 2, escapeRoute: true },
        { id: '4.2', staticRocks: true, dynamicBoulders: { directions: ['top', 'bottom', 'left', 'right'], sizes: ['large'] }, speed: 3, escapeRoute: true },
        { id: '4.3', staticRocks: true, dynamicBoulders: { directions: ['top', 'bottom', 'left', 'right'], sizes: ['large', 'small'] }, speed: 4, escapeRoute: true },
        { id: '4.4', staticRocks: true, dynamicBoulders: { directions: ['top', 'bottom', 'left', 'right'], sizes: ['large'] }, speed: 5, escapeRoute: true },
        { id: '5.0', staticRocks: { dynamicSize: true }, dynamicBoulders: false, speed: 1, escapeRoute: false },
        { id: '5.1', staticRocks: { dynamicSize: true }, dynamicBoulders: { directions: ['top', 'bottom', 'left', 'right'], sizes: ['medium', 'large'] }, speed: 2, escapeRoute: true },
        { id: '5.2', staticRocks: { dynamicSize: true }, dynamicBoulders: { directions: ['top', 'bottom', 'left', 'right'], sizes: ['large'] }, speed: 3, escapeRoute: true },
        { id: '5.3', staticRocks: { dynamicSize: true, rotation: true }, dynamicBoulders: { directions: ['top', 'bottom', 'left', 'right'], sizes: ['large'] }, speed: 4, escapeRoute: true },
        { id: '5.4', staticRocks: { dynamicSize: true, chaotic: true }, dynamicBoulders: { directions: ['top', 'bottom', 'left', 'right'], sizes: ['large', 'small'] }, speed: 5, escapeRoute: true }
    ]
};

export function getLevelFileName(levelIndex, logger) {
    logger.trace('getLevelFileName', 'Calcolo file livello', `levelIndex=${levelIndex}`);
    const majorLevel = Math.floor(levelIndex / 5) + 1;
    const minorLevel = levelIndex % 5;
    return `level${majorLevel}${minorLevel}`;
}

export function getLevelMasterNumber(levelIndex, logger) {
    logger.trace('getLevelMasterNumber', 'Calcolo master level', `levelIndex=${levelIndex}`);
    return Math.floor(levelIndex / 5) + 1;
}

export function parseExitTargetLevel(rawTarget, levelConfig, logger) {
    logger.trace('parseExitTargetLevel', 'Parsing target livello uscita', `rawTarget=${rawTarget}`);
    const text = String(rawTarget ?? '').trim();
    if (!text) return null;

    let major = null;
    let minor = null;

    if (/^\d+\.\d+$/.test(text)) {
        const parts = text.split('.');
        major = Number(parts[0]);
        minor = Number(parts[1]);
    } else if (/^\d+$/.test(text)) {
        if (text.length < 2) return null;
        major = Number(text.slice(0, -1));
        minor = Number(text.slice(-1));
    } else {
        return null;
    }

    if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
    if (major < 1 || minor < 0 || minor > 4) return null;

    const totalLevels = (levelConfig && Array.isArray(levelConfig.levels)) ? levelConfig.levels.length : 0;
    const index = ((major - 1) * 5) + minor;
    if (index < 0 || index >= totalLevels) return null;

    return {
        id: `${major}.${minor}`,
        index
    };
}
