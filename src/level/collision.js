import { CELL } from './mapData.js';

export function collides(x, z, radius, wallSet, cell = CELL) {
  const c0 = Math.round((x - radius) / cell);
  const c1 = Math.round((x + radius) / cell);
  const r0 = Math.round((z - radius) / cell);
  const r1 = Math.round((z + radius) / cell);
  for (let c = c0; c <= c1; c++) {
    for (let r = r0; r <= r1; r++) {
      if (!wallSet.has(`${c},${r}`)) continue;
      // closest point on the wall cell's AABB to the player circle center
      const nx = Math.max(c * cell - cell / 2, Math.min(x, c * cell + cell / 2));
      const nz = Math.max(r * cell - cell / 2, Math.min(z, r * cell + cell / 2));
      if ((x - nx) ** 2 + (z - nz) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

export function moveWithCollision(pos, dx, dz, wallSet, radius = 0.4, cell = CELL) {
  const out = { x: pos.x, z: pos.z };
  if (!collides(out.x + dx, out.z, radius, wallSet, cell)) out.x += dx;
  if (!collides(out.x, out.z + dz, radius, wallSet, cell)) out.z += dz;
  return out;
}
