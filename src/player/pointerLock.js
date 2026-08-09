export function setupPointerLock(element, { onLocked, onUnlocked, onMouseDelta }) {
  function isLocked() {
    return document.pointerLockElement === element;
  }

  document.addEventListener('pointerlockchange', () => {
    if (isLocked()) onLocked();
    else onUnlocked();
  });

  document.addEventListener('mousemove', (e) => {
    if (isLocked()) onMouseDelta(e.movementX, e.movementY);
  });

  return {
    request: () => Promise.resolve(element.requestPointerLock()).catch(() => {}),
    isLocked,
  };
}
