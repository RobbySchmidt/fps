export const WALK_SPEED = 3.5;   // m/s
export const SPRINT_SPEED = 5.5; // m/s

export function computeWishDir(keys, yaw) {
  const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const r = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

  // forward at yaw 0 is (0, -1); right is (1, 0)
  let x = -Math.sin(yaw) * f + Math.cos(yaw) * r;
  let z = -Math.cos(yaw) * f - Math.sin(yaw) * r;

  const len = Math.hypot(x, z);
  if (len < 1e-6) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}

export const GRAVITY = -18;       // m/s²
export const JUMP_VELOCITY = 6.2; // m/s → apex ≈ 1.05 m

export function tryJump(body) {
  if (body.y !== 0) return false;
  body.vy = JUMP_VELOCITY;
  return true;
}

export function stepVertical(body, dt) {
  if (body.y === 0 && body.vy <= 0) {
    body.vy = 0;
    return;
  }
  body.vy += GRAVITY * dt;
  body.y += body.vy * dt;
  if (body.y <= 0) {
    body.y = 0;
    body.vy = 0;
  }
}
