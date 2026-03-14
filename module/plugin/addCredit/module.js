const DEFAULT_CONFIG_CACHE_KEY = 'addCreditOptions';

const DEFAULT_CONFIG = {
    enabled: true,
    text: 'SpikeCode',
    prefix: 'by ',
    position: { x: 792, y: 594 },
    style: {
        fontSize: '12px',
        fill: '#cfdff8',
        stroke: '#000000',
        strokeThickness: 3
    },
    depth: 9999,
    scrollFactor: 0
};

function readText(value, fallback) {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function readAddCreditConfig(scene, opts = {}) {
    const key = readText(opts.configCacheKey, DEFAULT_CONFIG_CACHE_KEY);
    try {
        const cfg = scene?.cache?.json?.get?.(key);
        if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) return cfg;
    } catch (e) { }
    return {};
}

export function createAddCredit(scene, opts = {}) {
    if (!scene || !scene.add) return null;

    const cfg = readAddCreditConfig(scene, opts);
    const enabled = (typeof opts.enabled === 'boolean') ? opts.enabled : ((typeof cfg.enabled === 'boolean') ? cfg.enabled : DEFAULT_CONFIG.enabled);
    if (!enabled) return null;

    const width = Number(opts.width) || Number(scene?.scale?.width) || 800;
    const height = Number(opts.height) || Number(scene?.scale?.height) || 600;
    const x = Number.isFinite(Number(opts.x))
        ? Number(opts.x)
        : (Number.isFinite(Number(cfg?.position?.x)) ? Number(cfg.position.x) : Math.max(0, width - 8));
    const y = Number.isFinite(Number(opts.y))
        ? Number(opts.y)
        : (Number.isFinite(Number(cfg?.position?.y)) ? Number(cfg.position.y) : Math.max(0, height - 6));

    const text = readText(opts.text, readText(cfg.text, DEFAULT_CONFIG.text));
    const prefix = readText(opts.prefix, readText(cfg.prefix, DEFAULT_CONFIG.prefix));
    if (!text) return null;

    const styleCfg = (cfg.style && typeof cfg.style === 'object') ? cfg.style : {};
    const style = {
        fontSize: readText(opts.fontSize, readText(styleCfg.fontSize, DEFAULT_CONFIG.style.fontSize)),
        fill: readText(opts.fill, readText(styleCfg.fill, DEFAULT_CONFIG.style.fill)),
        stroke: readText(opts.stroke, readText(styleCfg.stroke, DEFAULT_CONFIG.style.stroke)),
        strokeThickness: Number.isFinite(Number(opts.strokeThickness))
            ? Number(opts.strokeThickness)
            : (Number.isFinite(Number(styleCfg.strokeThickness)) ? Number(styleCfg.strokeThickness) : DEFAULT_CONFIG.style.strokeThickness),
        fontFamily: readText(opts.fontFamily, '') || undefined
    };

    const depth = Number.isFinite(Number(opts.depth))
        ? Number(opts.depth)
        : (Number.isFinite(Number(cfg.depth)) ? Number(cfg.depth) : DEFAULT_CONFIG.depth);
    const scrollFactor = Number.isFinite(Number(opts.scrollFactor))
        ? Number(opts.scrollFactor)
        : (Number.isFinite(Number(cfg.scrollFactor)) ? Number(cfg.scrollFactor) : DEFAULT_CONFIG.scrollFactor);

    try {
        const label = scene.add.text(x, y, `${prefix}${text}`, style).setOrigin(1, 1);
        try { label.setDepth(depth); } catch (e) { }
        try { label.setScrollFactor(scrollFactor); } catch (e) { }
        try { label.setInteractive && label.disableInteractive && label.disableInteractive(); } catch (e) { }
        return label;
    } catch (e) {
        return null;
    }
}
