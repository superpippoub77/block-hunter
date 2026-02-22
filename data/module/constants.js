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
    hole1: 13,
    hole2: 14,
    explosion: 15
};
// Helmet uses the same spritesheet frame as the player/4th object (index 3)
// Add as synonym so tools and game can reference `helmet` directly.
OBJECT_FRAMES.helmet = 3;