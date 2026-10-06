export async function fetchJsonOptional(path) {
    try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) return null;
        return await response.json();
    } catch (_e) {
        return null;
    }
}

export function applyMappingFrameOverrides(mappings, objectFrames, tileFrames) {
    const entities = mappings?.entities?.entities;
    const tiles = mappings?.tiles?.tiles;

    if (entities && typeof entities === 'object') {
        Object.entries(entities).forEach(([key, value]) => {
            const sprite = value?.sprite;
            if (!sprite || sprite.texture !== 'objects') return;
            if (typeof sprite.frame === 'number') {
                objectFrames[key] = sprite.frame;
            }
        });
    }

    if (tiles && typeof tiles === 'object') {
        Object.entries(tiles).forEach(([key, value]) => {
            const sprite = value?.sprite;
            if (!sprite || sprite.texture !== 'tiles') return;
            if (typeof sprite.frame === 'number') {
                tileFrames[key] = sprite.frame;
            }
        });
    }
}

export async function loadGameplayMappings(applyOverrides) {
    const [entitiesMapping, effectsMapping, tilesMapping] = await Promise.all([
        fetchJsonOptional('data/game-entities-mapping.json'),
        fetchJsonOptional('data/game-effects-mapping.json'),
        fetchJsonOptional('data/game-tiles-mapping.json')
    ]);

    const mappings = {
        entities: entitiesMapping || {},
        effects: effectsMapping || {},
        tiles: tilesMapping || {}
    };

    try {
        window.GAME_MAPPINGS = mappings;
    } catch (_e) { /* ignore */ }

    applyOverrides(mappings);
    return mappings;
}
