export function resolveContactSpec(config, typename, logger) {
    logger.trace('resolveContactSpec', 'Risoluzione contact spec', `typename=${typename}`);
    try {
        const map = (config && config.objectContactByType) ? config.objectContactByType : {};
        const rawDef = (map && map.default) ? map.default : {};
        const def = {
            contactType: rawDef.contactType || 'edge',
            radiusMultiplier: (typeof rawDef.radiusMultiplier === 'number') ? rawDef.radiusMultiplier : 0.45,
            radiusPixels: (typeof rawDef.radiusPixels === 'number') ? rawDef.radiusPixels : null,
            proximityTiles: (typeof rawDef.proximityTiles === 'number') ? rawDef.proximityTiles : 0.9,
            proximityPixels: (typeof rawDef.proximityPixels === 'number') ? rawDef.proximityPixels : null
        };

        if (!typename) return def;
        const raw = map[typename];
        if (!raw) return def;

        if (typeof raw === 'string') {
            return Object.assign({}, def, { contactType: raw });
        }

        return {
            contactType: raw.contactType || def.contactType,
            radiusMultiplier: (typeof raw.radiusMultiplier === 'number') ? raw.radiusMultiplier : def.radiusMultiplier,
            radiusPixels: (typeof raw.radiusPixels === 'number') ? raw.radiusPixels : def.radiusPixels,
            proximityTiles: (typeof raw.proximityTiles === 'number') ? raw.proximityTiles : def.proximityTiles,
            proximityPixels: (typeof raw.proximityPixels === 'number') ? raw.proximityPixels : def.proximityPixels
        };
    } catch (e) {
        return { contactType: 'edge', radiusMultiplier: 0.45, radiusPixels: null, proximityTiles: 0.9, proximityPixels: null };
    }
}
