export function createRevolver({ capacity = 6, fireCooldown = 0.35, reloadTime = 1.2 } = {}) {
  let rounds = capacity;
  let lastFire = -Infinity;
  let reloadingUntil = -Infinity;

  function isReloading(now) {
    return now < reloadingUntil;
  }

  return {
    rounds: () => rounds,
    capacity: () => capacity,
    isReloading,
    fire(now) {
      if (isReloading(now)) return false;
      if (rounds <= 0) return false;
      if (now - lastFire < fireCooldown) return false;
      rounds -= 1;
      lastFire = now;
      return true;
    },
    startReload(now) {
      if (isReloading(now) || rounds === capacity) return false;
      reloadingUntil = now + reloadTime;
      rounds = capacity; // takes effect once isReloading(now) turns false; infinite reserve until M4 pickups
      return true;
    },
  };
}
