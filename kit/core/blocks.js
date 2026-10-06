// Block registry: each block lives in kit/blocks/<id>/ with
//   block.json  → description, scene key, services it requires, events it emits, config/i18n keys
//   index.js    → the factory (e.g. createTopTenScene(services)) returning a Phaser scene class
// A game lists its blocks in game.manifest.json; at boot the registry checks that the game
// provides every service a block requires, so a block copied into another game tells you
// exactly what is missing instead of failing later.

async function fetchJson(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    return res.json();
}

export async function loadManifest(path = 'game.manifest.json') {
    try { return await fetchJson(path); } catch (e) { return null; }
}

/** Reads every block.json listed in the manifest and checks its required services. */
export async function checkBlocks(manifest, services, logger) {
    const kitPath = manifest?.kitPath || 'kit';
    const report = [];
    for (const id of manifest?.blocks || []) {
        try {
            const meta = await fetchJson(`${kitPath}/blocks/${id}/block.json`);
            const missing = (meta.requires || []).filter((name) => !(name in services));
            report.push({ id, version: meta.version, scene: meta.scene, missing });
            if (missing.length) logger?.warn?.('KIT', `Blocco "${id}": servizi mancanti`, missing.join(', '));
        } catch (e) {
            report.push({ id, error: e.message });
            logger?.warn?.('KIT', `Blocco "${id}" non leggibile`, e.message);
        }
    }
    return report;
}
