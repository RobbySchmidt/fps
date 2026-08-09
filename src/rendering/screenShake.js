export function createScreenShake({ decay = 3.5 } = {}) {
  let magnitude = 0;
  let x = 0;
  let y = 0;

  return {
    trigger(amount) {
      magnitude = Math.max(magnitude, amount);
    },
    update(dt) {
      if (magnitude <= 0) {
        x = 0;
        y = 0;
        return;
      }
      magnitude = Math.max(0, magnitude - decay * dt);
      x = (Math.random() - 0.5) * magnitude * 0.4;
      y = (Math.random() - 0.5) * magnitude * 0.4;
      if (magnitude === 0) {
        x = 0;
        y = 0;
      }
    },
    offset: () => ({ x, y }),
  };
}
