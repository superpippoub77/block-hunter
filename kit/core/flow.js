// Scene flow and game identity, read from the game's manifest (game.manifest.json).
//
// Blocks never hard-code the next scene: they ask for the scene that follows one of their
// events ("start", "timeout", "exit"...), e.g.
//     this.scene.start(kitFlow.next('top-ten', 'timeout', 'CreditsScene'));
// and the manifest decides:
//     "flow": { "top-ten": { "timeout": "CreditsScene" } }
// The third argument is the default used when the manifest says nothing.
// Roles name scenes owned by the game ("gameplay" → "GameScene"), so a block can stop or
// resume them without knowing their key.

const state = {
    game: { id: 'game', title: 'Game', storagePrefix: 'spikeGame' },
    flow: {},
    roles: {}
};

export function configureKit(manifest) {
    if (!manifest || typeof manifest !== 'object') return;
    state.game = Object.assign({}, state.game, manifest.game || {});
    state.flow = manifest.flow || {};
    state.roles = manifest.roles || {};
}

export const kitFlow = {
    /** Scene key that follows `event` of block `blockId` */
    next(blockId, event, fallback) {
        const to = state.flow?.[blockId]?.[event];
        return (typeof to === 'string' && to) ? to : fallback;
    },
    /** Scene key of a role owned by the game (e.g. "gameplay") */
    role(name, fallback) {
        const key = state.roles?.[name];
        return (typeof key === 'string' && key) ? key : fallback;
    }
};

export const kitGame = {
    get id() { return state.game.id; },
    get title() { return state.game.title; },
    /** localStorage key namespaced per game: storageKey('TopScores') → "blockHunterTopScores" */
    storageKey(name) { return `${state.game.storagePrefix}${name}`; }
};
