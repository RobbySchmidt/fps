export function createGameLoop(update, options = {}) {
  const {
    maxDelta = 0.1,
    now = () => performance.now() / 1000,
    schedule = (fn) => requestAnimationFrame(fn),
  } = options;

  let running = false;
  let last = 0;

  function frame() {
    if (!running) return;
    const t = now();
    const dt = Math.min(t - last, maxDelta);
    last = t;
    update(dt);
    schedule(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = now();
      schedule(frame);
    },
    stop() {
      running = false;
    },
  };
}
