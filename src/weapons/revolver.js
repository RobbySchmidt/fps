export function createRevolver({ capacity = 6, fireCooldown = 0.35, reloadTime = 1.2 } = {}) {
  let rounds = capacity;
  let lastFire = -Infinity;
  let reloadingUntil = -Infinity;
  let pendingRefill = false;

  function settle(now) {
    if (pendingRefill && now >= reloadingUntil) {
      rounds = capacity;
      pendingRefill = false;
    }
  }

  function isReloading(now) {
    settle(now);
    return now < reloadingUntil;
  }

  return {
    rounds: () => rounds,
    capacity: () => capacity,
    isReloading,
    fire(now) {
      settle(now);
      if (isReloading(now)) return false;
      if (rounds <= 0) return false;
      if (now - lastFire < fireCooldown) return false;
      rounds -= 1;
      lastFire = now;
      return true;
    },
    startReload(now) {
      settle(now);
      if (isReloading(now) || rounds === capacity) return false;
      reloadingUntil = now + reloadTime;
      pendingRefill = true; // infinite reserve until M4 pickups
      return true;
    },
    reset() {
      rounds = capacity;
      lastFire = -Infinity;
      reloadingUntil = -Infinity;
      pendingRefill = false;
    },
  };
}
