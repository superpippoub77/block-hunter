// Objects sprite frame mapping (4x4 matrix):
// Frame 0-3:   dynamite, heart, stone, player
// Frame 4-7:   dynamite_chest, door, gem, stones
// Frame 8-11:  key, sand_pile, ghost, pepita
// Frame 12-15: wall, hole1, hole2, explosion

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
    ghost: 10,
    pepita: 11,
    wall: 12,
    wooden: 12,
    hole1: 13,
    hole2: 14,
    exit: 14,
    explosion: 15
};
// Helmet uses the same spritesheet frame as the player/4th object (index 3)
// Add as synonym so tools and game can reference `helmet` directly.
//OBJECT_FRAMES.helmet = OBJECT_FRAMES.player;
// Wooden plank: temporarily reuse the wall frame (index 12). Replace with a dedicated asset later.
//OBJECT_FRAMES.wooden = OBJECT_FRAMES.wall;
//OBJECT_FRAMES.cart = OBJECT_FRAMES.stones;

// Tile frames mapping (tiles spritesheet: 6 frames per row, native tile size 64x48)
export const TILE_FRAMES = {
    wall: 0,
    hole: 1,
    sand: 2,
    sand1: 2, sand2: 2, sand3: 2, sand4: 2, sand5: 2,
    sand6: 2, sand7: 2, sand8: 2, sand9: 2, sand10: 2,
    floor: 3,
    stone: 4,
    hole2: 5,
    sandPile: 4
};

// Number of columns in the wall tiles sprite (used to compute wall frame indices)
export const WALL_TILE_COLS = 6;

// Placeholder for possible named wall-frames mapping (kept empty for now).
export const WALLS_FRAMES = {
    // e.g. doorFrame: 5
};