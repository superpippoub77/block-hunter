// Level naming and exit targets: level index 0,1,2… ↔ files level10, level11 … level14, level20 …
// (5 levels per world). The game's own level rules (LEVEL_CONFIG) live in the game folder.

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
