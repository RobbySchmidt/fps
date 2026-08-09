export function createGameLoop(update, options = {}) {
  const {
    maxDelta = 0.1,
    now = () => performance.now() / 1000,
    schedule = (fn) => requestAnimationFrame(fn),
  } = options;

  let running = false;
  let last = 0;
  let generation = 0;

  function frame(gen) {
    if (!running || gen !== generation) return;
    const t = now();
    const dt = Math.min(t - last, maxDelta);
    last = t;
    update(dt);
    schedule(() => frame(gen));
  }

  return {
    start() {
      if (running) return;
      running = true;
      generation += 1;
      const gen = generation;
      last = now();
      schedule(() => frame(gen));
    },
    stop() {
      running = false;
    },
  };
}
