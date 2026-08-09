// Motion maths that give the Wanderer its deliberately "wrong" look.

// Stop-motion: snap continuous time onto discrete animation frames so limbs
// arrive at poses instead of gliding to them.
export function quantizeTime(t, fps = 10) {
  return Math.floor(t * fps) / fps;
}

// Burst-freeze: full speed, then a dead stop, repeating. The stops are the
// player's shooting windows.
export function burstFreezeFactor(t, { burst = 0.55, freeze = 0.25 } = {}) {
  return t % (burst + freeze) < burst ? 1 : 0;
}

// Serpentine: head for the target, but weave hard from side to side.
export function serpentineDirection(from, to, t, { amplitude = 0.7, frequency = 2.6 } = {}) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return { x: 0, z: 0 };

  const fx = dx / length;
  const fz = dz / length;
  const weave = Math.sin(t * frequency) * amplitude;
  // (-fz, fx) is the perpendicular of the forward direction in the XZ plane
  const x = fx - fz * weave;
  const z = fz + fx * weave;
  const outLength = Math.hypot(x, z);
  return { x: x / outLength, z: z / outLength };
}
