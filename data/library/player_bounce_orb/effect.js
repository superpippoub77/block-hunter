window.__BLOCKHUNTER_EFFECT_EXPORT__ = {
  name: 'player_bounce_orb',
  aliases: ['bounce_orb', 'ricochet_orb'],
  defaults: {
    intensity: 1,
    horizontalSpeed: 300,
    verticalSpeed: -220,
    gravityY: 980,
    restitution: 0.72,
    friction: 0.985,
    maxBounces: 6,
    lifeMs: 2600,
    radiusPx: 6,
    color: '#8ec5ff',
    alpha: 0.9,
    depth: 980,
    trail: true
  },
  apply(api, options) {
    const intensityRaw = Number(options.intensity);
    const intensity = Number.isFinite(intensityRaw) ? Math.max(0, intensityRaw) : 1;

    const horizontalBase = Number(options.horizontalSpeed) || 300;
    const verticalBase = Number(options.verticalSpeed) || -220;
    const gravityY = Number(options.gravityY) || 980;
    const restitution = Math.max(0, Math.min(1, Number(options.restitution) || 0.72));
    const friction = Math.max(0, Math.min(1, Number(options.friction) || 0.985));
    const maxBounces = Math.max(0, Math.floor(Number(options.maxBounces) || 6));
    const lifeMs = Math.max(120, Number(options.lifeMs) || 2600);
    const radius = Math.max(2, Number(options.radiusPx) || 6);
    const color = api.parseColor(options.color, 0x8ec5ff);
    const alpha = Math.max(0, Math.min(1, Number(options.alpha) || 0.9));
    const depth = Number(options.depth) || 980;
    const withTrail = options.trail !== false;

    const orb = api.add.circle(api.worldX, api.worldY - radius, radius, color, alpha).setDepth(depth);

    let vx = horizontalBase * Math.max(0.1, intensity);
    let vy = verticalBase * Math.max(0.1, intensity);
    let bounces = 0;
    let alive = true;

    const scene = api.scene;
    const startTs = Number(scene.time?.now) || Date.now();

    const left = Number(scene.mapOffsetX) || 0;
    const top = Number(scene.mapOffsetY) || 0;
    const cols = Number(scene.mapCols) || 12;
    const rows = Number(scene.mapRows) || 12;
    const tileSize = Number(api.CONFIG?.tileSize) || 64;
    const right = left + cols * tileSize;
    const floor = top + rows * tileSize - radius;
    const ceiling = top + radius;

    const spawnTrailDot = () => {
      if (!withTrail) return;
      try {
        const dot = api.add.circle(orb.x, orb.y, Math.max(1, radius * 0.38), color, 0.28).setDepth(depth - 1);
        api.tweens.add({
          targets: dot,
          alpha: 0,
          scaleX: 0.2,
          scaleY: 0.2,
          duration: 220,
          ease: 'Linear',
          onComplete: () => {
            try { dot.destroy(); } catch (_e) {}
          }
        });
      } catch (_e) {}
    };

    const timer = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!alive || !orb.active) {
          try { timer.remove(false); } catch (_e) {}
          return;
        }

        const now = Number(scene.time?.now) || Date.now();
        if (now - startTs >= lifeMs) {
          alive = false;
          try { orb.destroy(); } catch (_e) {}
          try { timer.remove(false); } catch (_e) {}
          return;
        }

        const dt = 16 / 1000;
        vy += gravityY * dt;
        orb.x += vx * dt;
        orb.y += vy * dt;

        vx *= friction;

        let bouncedThisFrame = false;
        if (orb.x < left + radius) {
          orb.x = left + radius;
          vx = Math.abs(vx) * restitution;
          bouncedThisFrame = true;
        } else if (orb.x > right - radius) {
          orb.x = right - radius;
          vx = -Math.abs(vx) * restitution;
          bouncedThisFrame = true;
        }

        if (orb.y > floor) {
          orb.y = floor;
          vy = -Math.abs(vy) * restitution;
          bouncedThisFrame = true;
        } else if (orb.y < ceiling) {
          orb.y = ceiling;
          vy = Math.abs(vy) * restitution;
          bouncedThisFrame = true;
        }

        if (bouncedThisFrame) {
          bounces += 1;
          try {
            const ring = api.add.circle(orb.x, orb.y, Math.max(2, radius * 0.8), color, 0.25).setDepth(depth - 2);
            api.tweens.add({
              targets: ring,
              scaleX: 2.6,
              scaleY: 2.6,
              alpha: 0,
              duration: 220,
              ease: 'Cubic.easeOut',
              onComplete: () => {
                try { ring.destroy(); } catch (_e) {}
              }
            });
          } catch (_e) {}
        }

        spawnTrailDot();

        if (bounces > maxBounces || (Math.abs(vx) < 6 && Math.abs(vy) < 6)) {
          alive = false;
          try { orb.destroy(); } catch (_e) {}
          try { timer.remove(false); } catch (_e) {}
        }
      }
    });
  }
};
