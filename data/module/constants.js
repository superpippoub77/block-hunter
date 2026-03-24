// Objects sprite frame mapping (4x4 matrix):
// Frame 0-3:   dynamite, heart, stone, player
// Frame 4-7:   dynamite_chest, door, gem, stones
// Frame 8-11:  key, sand_pile, ghost, pepita
// Frame 12-15: skeleton/miner, hole1, hole2, explosion

export const OBJECT_FRAMES = {
    dynamite_projectile: 0,
    heart: 1,
    stone: 2,
    player: 3,
    helmet: 3,
    dynamite_chest: 4,
    door: 5,
    gem: 6,
    cart: 7,
    stones: 7,
    key: 8,
    sand_pile: 9,
    spider: 10,
    snake: 10,
    pepita: 11,
    skeleton: 12,
    wall: 12,
    wooden: 10,
    hole1: 13,
    hole2: 14,
    exit: 14,
    explosion: 15
};
// Helmet uses the same spritesheet frame as the player/4th object (index 3).
//OBJECT_FRAMES.helmet = OBJECT_FRAMES.player;
// `wall` is kept as a legacy alias for frame 12 because older code paths still reference it,
// but gameplay/editor semantics for token `m` use `skeleton`.
// Wooden plank temporarily reuses frame 10. Replace with a dedicated asset later.
//OBJECT_FRAMES.wooden = OBJECT_FRAMES.wall;
//OBJECT_FRAMES.cart = OBJECT_FRAMES.stones;

// Tile frames mapping (tiles spritesheet: 6 frames per row, native tile size 64x48)
export const TILE_FRAMES = {
    // New tiles.png row mapping (single row: sand, hole, hole_cover, water, mud, back_level)
    sand: 0,
    hole: 1,
    hole_cover: 2,
    water: 3,
    mud: 4,
    back: 5,
    // legacy aliases
    sand1: 0, sand2: 0, sand3: 0, sand4: 0, sand5: 0,
    sand6: 0, sand7: 0, sand8: 0, sand9: 0, sand10: 0,
    // keep floor and stone aliases for compatibility (map 'floor' will use sand frame if unspecified)
    floor: 0,
    stone: 4,
    hole2: 1,
    sandPile: 4
};

// Number of columns in the wall tiles sprite (used to compute wall frame indices)
export const WALL_TILE_COLS = 6;

// Placeholder for possible named wall-frames mapping (kept empty for now).
export const WALLS_FRAMES = {
    // e.g. doorFrame: 5
};