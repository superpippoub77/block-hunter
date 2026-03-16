window.__BLOCKHUNTER_EFFECT_EXPORT__ = {
  name: 'player_throw_arc',
  aliases: ['throw_arc', 'arc_throw'],
  defaults: {
    intensity: 1,
    angleDeg: 38,
    speedMin: 160,
    speedMax: 620,
    gravityY: 1200,
    restitution: 0.45,
    linearDamping: 0.82,
    mass: 1,
    maxBounces: 3,
    lifeMs: 1800,
    radiusPx: 5,
    color: '#ffd166',
    alpha: 0.95,
    depth: 980
  },
  apply(api, options) {
    const intensityRaw = Number(options.intensity);
    const intensity = Number.isFinite(intensityRaw) ? Math.max(0, intensityRaw) : 1;
    const speedMin = Math.max(20, Number(options.speedMin) || 160);
    const speedMax = Math.max(speedMin, Number(options.speedMax) || 620);
    const launchSpeed = Math.min(speedMax, speedMin + (speedMax - speedMin) * Math.min(1, intensity));

    const angleDeg = Number.isFinite(Number(options.angleDeg)) ? Number(options.angleDeg) : 38;
    const angle = (Math.PI / 180) * angleDeg;

    const gravityY = Number.isFinite(Number(options.gravityY)) ? Number(options.gravityY) : 1200;
    const restitution = Math.max(0, Math.min(1, Number(options.restitution) || 0.45));
    const linearDamping = Math.max(0, Math.min(0.999, Number(options.linearDamping) || 0.82));
    const mass = Math.max(0.01, Number(options.mass) || 1);
    const maxBounces = Math.max(0, Math.floor(Number(options.maxBounces) || 3));
    const lifeMs = Math.max(120, Number(options.lifeMs) || 1800);

    const radius = Math.max(2, Number(options.radiusPx) || 5);
    const color = api.parseColor(options.color, 0xffd166);
    const alpha = Math.max(0, Math.min(1, Number(options.alpha) || 0.95));
    const depth = Number(options.depth) || 980;

    const projectile = api.add.circle(api.worldX, api.worldY - radius, radius, color, alpha).setDepth(depth);

    let vx = Math.cos(angle) * launchSpeed;
    let vy = -Math.sin(angle) * launchSpeed;
    const g = gravityY / Math.max(0.01, mass);
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

    const timer = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!alive || !projectile.active) {
          try { timer.remove(false); } catch (_e) {}
          return;
        }

        const now = Number(scene.time?.now) || Date.now();
        if (now - startTs >= lifeMs) {
          alive = false;
          try { projectile.destroy(); } catch (_e) {}
          try { timer.remove(false); } catch (_e) {}
          return;
        }

        const dt = 16 / 1000;
        vy += g * dt;
        projectile.x += vx * dt;
        projectile.y += vy * dt;

        vx *= Math.pow(linearDamping, dt * 60);

        if (projectile.x < left + radius) {
          projectile.x = left + radius;
          vx = Math.abs(vx) * restitution;
          bounces += 1;
        } else if (projectile.x > right - radius) {
          projectile.x = right - radius;
          vx = -Math.abs(vx) * restitution;
          bounces += 1;
        }

        if (projectile.y >= floor) {
          projectile.y = floor;
          vy = -Math.abs(vy) * restitution;
          vx *= 0.95;
          bounces += 1;
        }

        if (bounces > maxBounces) {
          alive = false;
          try { projectile.destroy(); } catch (_e) {}
          try { timer.remove(false); } catch (_e) {}
        }
      }
    });
  }
};
