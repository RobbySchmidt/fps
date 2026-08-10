// Furniture footprints are data beside the map text, not map characters.
// kind 'low'  blocks movement + pathfinding, but not enemy sight.
// kind 'tall' blocks movement, pathfinding, and enemy sight.
// kind 'decor' blocks nothing — walk-through set dressing.
export const FURNITURE_HEIGHTS = { low: 0.9, tall: 1.9, decor: 0.6 };

export function expandFurniture(items, { wallSet, cols, rows }) {
  const moveCells = new Set();
  const sightCells = new Set();
  for (const item of items) {
    if (!(item.kind in FURNITURE_HEIGHTS)) {
      throw new Error(`furniture "${item.id}" has unknown kind "${item.kind}"`);
    }
    if (item.x1 < item.x0 || item.z1 < item.z0) {
      throw new Error(`furniture "${item.id}" has an inverted footprint`);
    }
    for (let z = item.z0; z <= item.z1; z++) {
      for (let x = item.x0; x <= item.x1; x++) {
        if (x < 0 || z < 0 || x >= cols || z >= rows) {
          throw new Error(`furniture "${item.id}" leaves the map at ${x},${z}`);
        }
        const key = `${x},${z}`;
        if (wallSet.has(key)) {
          throw new Error(`furniture "${item.id}" overlaps a wall at ${x},${z}`);
        }
        if (item.kind === 'low' || item.kind === 'tall') moveCells.add(key);
        if (item.kind === 'tall') sightCells.add(key);
      }
    }
  }
  return { moveCells, sightCells };
}

export function furnitureBox(item, cell) {
  const h = FURNITURE_HEIGHTS[item.kind];
  return {
    w: (item.x1 - item.x0 + 1) * cell,
    h,
    d: (item.z1 - item.z0 + 1) * cell,
    x: ((item.x0 + item.x1) / 2) * cell,
    y: h / 2,
    z: ((item.z0 + item.z1) / 2) * cell,
  };
}
