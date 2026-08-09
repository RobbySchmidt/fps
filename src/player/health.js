export function createHealth({ max = 100, regenDelay = 5, regenRate = 12 } = {}) {
  let hp = max;
  let lastDamageAt = -Infinity;
  let lastUpdateAt = null;

  return {
    hp: () => hp,
    max: () => max,
    fraction: () => hp / max,
    isDead: () => hp <= 0,
    damage(amount, now) {
      if (hp <= 0) return;
      hp = Math.max(0, hp - amount);
      lastDamageAt = now;
    },
    update(now) {
      const dt = lastUpdateAt === null ? 0 : now - lastUpdateAt;
      lastUpdateAt = now;
      if (hp <= 0 || hp >= max) return;
      if (now - lastDamageAt <= regenDelay) return;
      hp = Math.min(max, hp + regenRate * dt);
    },
    reset() {
      hp = max;
      lastDamageAt = -Infinity;
      lastUpdateAt = null;
    },
  };
}
