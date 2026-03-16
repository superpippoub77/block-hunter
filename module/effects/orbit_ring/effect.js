window.__BLOCKHUNTER_EFFECT_EXPORT__ = {
  name: 'orbit_ring',
  aliases: ['ring_orbit'],
  defaults: {
    radiusTiles: 0.55,
    color: '#9ee6ff',
    alpha: 0.5,
    dotSizePx: 3,
    revolutionMs: 1200,
    depth: 980,
    addBlend: true
  },
  apply(api, options) {
    const tileSize = Number(api.CONFIG?.tileSize) || 64;
    const radius = Math.max(4, (Number(options.radiusTiles) || 0.55) * tileSize);
    const color = api.parseColor(options.color, 0x9ee6ff);
    const alpha = Math.max(0, Math.min(1, Number(options.alpha) || 0.5));
    const dotSize = Math.max(1, Number(options.dotSizePx) || 3);
    const revolution = Math.max(150, Number(options.revolutionMs) || 1200);
    const depth = Number(options.depth) || 980;

    const dot = api.add.circle(api.worldX, api.worldY, dotSize, color, alpha).setDepth(depth);
    if (options.addBlend !== false) {
      try { dot.setBlendMode(api.Phaser.BlendModes.ADD); } catch (_e) {}
    }

    api.registerFollower(dot, 0, 0);

    const state = { theta: 0 };
    api.tweens.add({
      targets: state,
      theta: Math.PI * 2,
      duration: revolution,
      repeat: -1,
      ease: 'Linear',
      onUpdate: () => {
        if (!dot.active || !api.target?.active) return;
        const x = api.target.x + Math.cos(state.theta) * radius;
        const y = api.target.y + Math.sin(state.theta) * radius;
        try { dot.setPosition(x, y); } catch (_e) {}
      }
    });
  }
};
