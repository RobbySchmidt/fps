export function createHud() {
  const ammo = document.getElementById('ammo');
  const hitmarker = document.getElementById('hitmarker');
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
  };
}
