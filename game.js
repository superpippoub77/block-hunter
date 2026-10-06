// ============================================================================
// BLOCK HUNTER - Arcade Game in Phaser 3, built on the SpikeCode engine (kit/)
// ============================================================================
// Everything generic (scenes, blocks, gameplay, editors) is in the engine: here there is only
// what belongs to Block Hunter. Content lives in data/ and assets/, the game's own code in game/.

import { startSpikeGame } from './kit/engine/index.js';
import { OBJECT_FRAMES, TILE_FRAMES, WALL_TILE_COLS } from './game/constants.js';
import { LEVEL_CONFIG } from './game/levels.js';
import { createBonusScene } from './game/scenes/bonusScene.js';

const sprite64 = { frameWidth: 64, frameHeight: 64 };

const { CONFIG, GAME_STATE, LOGGER } = startSpikeGame({
    identity: { id: 'block-hunter', title: 'Block Hunter', storagePrefix: 'blockHunter' },

    // spritesheets: frames of objects.png / tiles.png / wall_completed.png
    frames: { OBJECT_FRAMES, TILE_FRAMES, WALL_TILE_COLS },
    native: { tileWidth: 64, tileHeight: 48, objectSize: 64 },
    spritesheets: {
        flags: { frameWidth: 64, frameHeight: 32 },
        tiles: sprite64,
        wall_tiles: sprite64,
        objects: sprite64,
        bat: sprite64,
        ghost: sprite64,
        spider: sprite64,
        snake: sprite64,
        player_front: sprite64,
        player_back: sprite64,
        player_right: sprite64,
        player_back_right: sprite64
    },

    // rules of each level (rocks, boulders, speed, escape route)
    levels: LEVEL_CONFIG,

    // values of a new run
    newRun: { lives: 5, dynamiteCount: 20 },

    // scenes of this game only (bonus level)
    scenes: [{ key: 'BonusScene', factory: createBonusScene, after: 'GameScene' }]
});

// legacy console helpers
try {
    window.BH_LOG = LOGGER;
    window.getBlockHunterFunctionDocs = () => window.SPIKE_FUNCTION_DOCS;
} catch (e) { /* ignore */ }
