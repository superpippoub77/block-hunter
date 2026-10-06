// Block Hunter: rules of each level (rocks, boulders, speed, escape route), 5 levels per world.
// Passed to the SpikeCode engine as `levels` in game.js.

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
