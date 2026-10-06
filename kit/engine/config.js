import { kitGame } from '../core/flow.js';

export function mergeLocalConfig(config, objectNativeSize, logger) {
    logger.trace('mergeLocalConfig', 'Tentativo merge config locale');
    try {
        const saved = localStorage.getItem(kitGame.storageKey('Config'));
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.__fullConfig === true && parsed.values && typeof parsed.values === 'object') {
                Object.assign(config, parsed.values);
                return;
            }
            if (parsed.tileSize) config.tileSize = parsed.tileSize;
            if (parsed.objectSize) config.objectSize = parsed.objectSize;
            if (parsed.wallSize) config.wallSize = parsed.wallSize;
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
