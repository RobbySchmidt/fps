export function createHud() {
  const ammo = document.getElementById('ammo');
  return {
    setAmmo(rounds, capacity) {
      ammo.textContent = `${rounds} / ${capacity}`;
    },
    setReloading(active) {
      ammo.classList.toggle('reloading', active);
    },
  };
}
