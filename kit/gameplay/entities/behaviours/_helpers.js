// Helpers shared by the behaviours.
export const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function setDir(sprite, dx, dy, speed) {
    const len = Math.hypot(dx, dy) || 1;
    sprite.body.setVelocity((dx / len) * speed, (dy / len) * speed);
}

export function blocked(sprite) {
    const b = sprite.body;
    return !!(b && (b.blocked.left || b.blocked.right || b.blocked.up || b.blocked.down || b.touching.left || b.touching.right || b.touching.up || b.touching.down));
}

export function nearestPlayer(scene, sprite) {
    let best = null, bestD = Infinity;
    [scene.player, scene.player2].forEach((p) => {
        if (!p || !p.active) return;
        const d = Math.hypot(p.x - sprite.x, p.y - sprite.y);
        if (d < bestD) { bestD = d; best = p; }
    });
    return best ? { player: best, dist: bestD } : null;
}

export const randomDir4 = () => DIRS4[Math.floor(Math.random() * 4)];
