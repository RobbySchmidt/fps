import { CELL } from './mapData.js';

const NEIGHBOURS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

export function worldToCell(x, z, cell = CELL) {
  return { c: Math.round(x / cell), r: Math.round(z / cell) };
}

export function cellToWorld(c, r, cell = CELL) {
  return { x: c * cell, z: r * cell };
}

function manhattan(a, b) {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
}

function reconstruct(cameFrom, endKey) {
  const path = [];
  let key = endKey;
  while (key !== undefined) {
    const [c, r] = key.split(',').map(Number);
    path.unshift({ c, r });
    key = cameFrom.get(key);
  }
  return path;
}

export function findPath(start, goal, wallSet) {
  const startKey = `${start.c},${start.r}`;
  const goalKey = `${goal.c},${goal.r}`;
  if (wallSet.has(startKey) || wallSet.has(goalKey)) return null;
  if (startKey === goalKey) return [{ c: start.c, r: start.r }];

  const open = [{ c: start.c, r: start.r, g: 0, f: manhattan(start, goal) }];
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const closed = new Set();

  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const current = open.splice(best, 1)[0];
    const currentKey = `${current.c},${current.r}`;
    if (currentKey === goalKey) return reconstruct(cameFrom, currentKey);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    for (const { dc, dr } of NEIGHBOURS) {
      const c = current.c + dc;
      const r = current.r + dr;
      const key = `${c},${r}`;
      if (wallSet.has(key) || closed.has(key)) continue;
      const tentative = current.g + 1;
      if (gScore.has(key) && tentative >= gScore.get(key)) continue;
      gScore.set(key, tentative);
      cameFrom.set(key, currentKey);
      open.push({ c, r, g: tentative, f: tentative + manhattan({ c, r }, goal) });
    }
  }
  return null;
}

export function hasLineOfSight(from, to, wallSet, cell = CELL) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.ceil(distance / (cell * 0.25));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const { c, r } = worldToCell(x, z, cell);
    if (wallSet.has(`${c},${r}`)) return false;
  }
  return true;
}
