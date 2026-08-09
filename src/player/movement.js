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
