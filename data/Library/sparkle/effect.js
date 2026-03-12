window.__BLOCKHUNTER_EFFECT_EXPORT__ = {
  name: 'sparkle',
  aliases: ['spark'],
  defaults: {
    count: 7,
    spreadPx: 22,
    color: '#ffe07a',
    alpha: 0.9,
    minRadiusPx: 1,
    maxRadiusPx: 3,
    minDurationMs: 220,
    maxDurationMs: 520,
    depth: 950
  },
  apply(api, options) {
    const count = Math.max(1, Math.floor(Number(options.count) || 7));
    const spread = Math.max(2, Number(options.spreadPx) || 22);
    const color = api.parseColor(options.color, 0xffe07a);
    const alpha = Math.max(0, Math.min(1, Number(options.alpha) || 0.9));
    const minRadius = Math.max(1, Number(options.minRadiusPx) || 1);
    const maxRadius = Math.max(minRadius, Number(options.maxRadiusPx) || 3);
    const minDuration = Math.max(40, Number(options.minDurationMs) || 220);
    const maxDuration = Math.max(minDuration, Number(options.maxDurationMs) || 520);
    const depth = Number(options.depth) || 950;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * spread;
      const px = api.worldX + Math.cos(angle) * dist;
      const py = api.worldY + Math.sin(angle) * dist;
      const radius = minRadius + Math.random() * (maxRadius - minRadius);
      const dot = api.add.circle(px, py, radius, color, alpha).setDepth(depth);

      api.tweens.add({
        targets: dot,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: minDuration + Math.random() * (maxDuration - minDuration),
        ease: 'Sine.easeOut',
        onComplete: () => {
          try { dot.destroy(); } catch (_e) {}
        }
      });
    }
  }
};
