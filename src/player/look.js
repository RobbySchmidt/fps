const PITCH_LIMIT = Math.PI / 2 - 0.01;

export function createLook() {
  return { yaw: 0, pitch: 0 };
}

export function applyLookDelta(look, dx, dy, sensitivity = 0.002) {
  look.yaw -= dx * sensitivity;
  look.pitch -= dy * sensitivity;
  look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
}
