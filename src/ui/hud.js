export function createHud() {
  const ammo = document.getElementById('ammo');
  const hitmarker = document.getElementById('hitmarker');
  const healthfill = document.getElementById('healthfill');
  const damage = document.getElementById('damage');
  const death = document.getElementById('death');
  let hitTimer = null;

  return {
    setAmmo(rounds, capacity) {
      ammo.textContent = `${rounds} / ${capacity}`;
    },
    setReloading(active) {
      ammo.classList.toggle('reloading', active);
    },
    hitMarker(kind) {
      hitmarker.classList.remove('show', 'head');
      // force a reflow so the animation restarts on rapid consecutive hits
      void hitmarker.offsetWidth;
      hitmarker.classList.add('show');
      if (kind === 'head') hitmarker.classList.add('head');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('show', 'head'), 250);
    },
    setHealth(fraction) {
      const clamped = Math.max(0, Math.min(1, fraction));
      healthfill.style.width = `${clamped * 100}%`;
      healthfill.classList.toggle('low', clamped <= 0.34);
    },
    flashDamage() {
      damage.classList.add('hit');
      setTimeout(() => damage.classList.remove('hit'), 60);
    },
    showDeath(visible) {
      death.hidden = !visible;
    },
  };
}
