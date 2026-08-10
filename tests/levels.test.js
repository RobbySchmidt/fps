import { describe, it, expect } from 'vitest';
import { selectLevel, MANSION, KITCHEN_TEST } from '../src/level/levels.js';
import { parseMap } from '../src/level/mapData.js';
import { expandFurniture, reachableWaypoints } from '../src/level/furniture.js';
import { hasFigure, FIGURE_NAMES } from '../src/level/furnitureFigures.js';

// mapData's void cells (outside-the-building gaps within a row, marked with
// a space) aren't walls, but they aren't floor either — parseMap tracks no
// set for them. Derive the true floor footprint from the raw map text so
// the flood fill below doesn't mistake void for an unreachable sealed room.
function floorCellSet(mapText) {
  const lines = mapText.split(/\r?\n/);
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
  const floor = new Set();
  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch !== '#' && ch !== ' ') floor.add(`${c},${r}`);
    });
  });
  return floor;
}

// Flood-fill from spawn over every floor cell that isn't blocking furniture.
// If furniture ever seals a room, alcove, or doorway, some open cells become
// unreachable from spawn and this comes back short of `open`.
function floodFillFromSpawn(mapText, moveSet, spawnCell) {
  const open = new Set([...floorCellSet(mapText)].filter((key) => !moveSet.has(key)));
  const seen = new Set();
  const stack = [spawnCell];
  while (stack.length) {
    const [c, r] = stack.pop();
    const key = `${c},${r}`;
    if (seen.has(key) || !open.has(key)) continue;
    seen.add(key);
    stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  return { open, seen };
}

describe('selectLevel', () => {
  it('returns the mansion by default', () => {
    expect(selectLevel('')).toBe(MANSION);
  });

  it('returns the kitchen test slice for ?map=kitchen-test', () => {
    expect(selectLevel('?map=kitchen-test')).toBe(KITCHEN_TEST);
  });

  it('falls back to the mansion for unknown map names', () => {
    expect(selectLevel('?map=does-not-exist')).toBe(MANSION);
  });
});

describe('KITCHEN_TEST descriptor', () => {
  const parsed = parseMap(KITCHEN_TEST.mapText, KITCHEN_TEST.cell);

  it('parses with player spawn, wanderer spawn, and two lamps', () => {
    expect(parsed.spawn).toEqual({ x: 9, z: 16 });
    expect(parsed.wandererSpawn).toEqual({ x: 14, z: 6 });
    expect(parsed.lamps).toHaveLength(2);
  });

  it('is 25 columns by 19 rows at 1m cells', () => {
    expect(KITCHEN_TEST.cell).toBe(1);
    expect(parsed.cols).toBe(25);
    expect(parsed.rows).toBe(19);
  });

  it('has furniture that expands cleanly against the parsed map', () => {
    const { moveCells, sightCells } = expandFurniture(KITCHEN_TEST.furniture, {
      wallSet: parsed.wallSet,
      cols: parsed.cols,
      rows: parsed.rows,
    });
    // low: work-table(10) + counter(4) + barrels(2) + stools(2) = 18
    // tall: stove(3) + hearth(4) + larder(4) = 11
    expect(moveCells.size).toBe(29);
    expect(sightCells.size).toBe(11);
  });

  it('keeps the wanderer spawn and player spawn off furniture cells', () => {
    const { moveCells } = expandFurniture(KITCHEN_TEST.furniture, {
      wallSet: parsed.wallSet,
      cols: parsed.cols,
      rows: parsed.rows,
    });
    expect(moveCells.has('14,6')).toBe(false);
    expect(moveCells.has('9,16')).toBe(false);
  });

  describe('KITCHEN_TEST art-slice data', () => {
    it('declares kitchen floor and wall patches within map bounds', () => {
      for (const p of [...KITCHEN_TEST.floorPatches, ...KITCHEN_TEST.wallPatches]) {
        expect(p.x0).toBeLessThanOrEqual(p.x1);
        expect(p.z0).toBeLessThanOrEqual(p.z1);
        expect(p.x0).toBeGreaterThanOrEqual(0);
        expect(p.z0).toBeGreaterThanOrEqual(0);
        expect(p.x1).toBeLessThan(parsed.cols);
        expect(p.z1).toBeLessThan(parsed.rows);
        expect(typeof p.color).toBe('number');
        expect(['wood', 'stone', 'iron']).toContain(p.family);
      }
    });

    it('places every window on a wall cell', () => {
      expect(KITCHEN_TEST.windows.length).toBeGreaterThan(0);
      for (const w of KITCHEN_TEST.windows) {
        expect(parsed.wallSet.has(`${w.x},${w.z}`)).toBe(true);
        expect(['n', 's', 'e', 'w']).toContain(w.facing);
      }
    });

    it('keeps windowLights kitchen-only (mansion floor is glow-only)', () => {
      expect(MANSION.windowLights).toBeUndefined();
      expect(KITCHEN_TEST.windowLights).toBe(true);
    });
  });
});

describe('GROUND_FLOOR (mansion) descriptor', () => {
  const parsed = parseMap(MANSION.mapText, MANSION.cell);

  it('is the 58x47 blueprint at 1m cells', () => {
    expect(MANSION.cell).toBe(1);
    expect(parsed.cols).toBe(58);
    expect(parsed.rows).toBe(47);
  });

  it('has spawn, wanderer spawn, and 11 lamps where the blueprint puts them', () => {
    expect(parsed.spawn).toEqual({ x: 30, z: 41 });
    expect(parsed.wandererSpawn).toEqual({ x: 41, z: 2 });
    expect(parsed.lamps).toHaveLength(11);
  });

  it('expands all furniture cleanly (no wall or doorway overlap)', () => {
    const { moveCells, sightCells } = expandFurniture(MANSION.furniture, {
      wallSet: parsed.wallSet,
      cols: parsed.cols,
      rows: parsed.rows,
      doorCells: parsed.doorCells,
    });
    expect(moveCells.size).toBeGreaterThan(100);
    expect(sightCells.size).toBeGreaterThan(30);
  });

  it('keeps both spawns off blocking furniture', () => {
    const { moveCells } = expandFurniture(MANSION.furniture, {
      wallSet: parsed.wallSet, cols: parsed.cols, rows: parsed.rows, doorCells: parsed.doorCells,
    });
    expect(moveCells.has('30,41')).toBe(false);
    expect(moveCells.has('41,2')).toBe(false);
  });

  it('maps every furniture piece to an existing figure builder', () => {
    for (const item of MANSION.furniture) {
      expect(hasFigure(item), `no builder for ${item.id}`).toBe(true);
    }
  });

  it('puts every window and wall prop on a wall cell', () => {
    for (const wdw of MANSION.windows) {
      expect(parsed.wallSet.has(`${wdw.x},${wdw.z}`)).toBe(true);
    }
    for (const p of MANSION.wallProps) {
      const xs = p.x !== undefined ? [p.x, p.x] : [p.x0, p.x1];
      const zs = p.z !== undefined ? [p.z, p.z] : [p.z0, p.z1];
      for (let x = xs[0]; x <= xs[1]; x++) for (let z = zs[0]; z <= zs[1]; z++) {
        expect(parsed.wallSet.has(`${x},${z}`), `${p.type} off-wall at ${x},${z}`).toBe(true);
      }
    }
  });

  it('keeps all patches inside the map', () => {
    for (const p of [...MANSION.floorPatches, ...MANSION.wallPatches]) {
      expect(p.x0).toBeLessThanOrEqual(p.x1);
      expect(p.z0).toBeLessThanOrEqual(p.z1);
      expect(p.x1).toBeLessThan(parsed.cols);
      expect(p.z1).toBeLessThan(parsed.rows);
    }
  });

  it('uses FIGURE_NAMES-registered figures for every distinct figure this manifest references', () => {
    const names = FIGURE_NAMES();
    const used = new Set(MANSION.furniture.map((item) => item.figure).filter(Boolean));
    for (const figure of used) {
      expect(names).toContain(figure);
    }
  });

  it('keeps every patrol waypoint off a blocking-furniture cell (regression for the wedged-patrol bug)', () => {
    const { moveCells } = expandFurniture(MANSION.furniture, {
      wallSet: parsed.wallSet, cols: parsed.cols, rows: parsed.rows, doorCells: parsed.doorCells,
    });
    const moveSet = new Set([...parsed.wallSet, ...moveCells]);

    // Some lamp cells (a lamp over a table) ARE inside blocking furniture —
    // that's fine for lighting. Prove the fixture still exercises the
    // filter: at least one raw lamp is blocked...
    const blockedLamps = parsed.lamps.filter((l) => moveSet.has(`${l.x / MANSION.cell},${l.z / MANSION.cell}`));
    expect(blockedLamps.length).toBeGreaterThan(0);

    // ...and reachableWaypoints (the same helper main.js uses to build the
    // AI's patrol route) must drop every one of them.
    const waypoints = reachableWaypoints(parsed.lamps, moveSet, MANSION.cell);
    expect(waypoints.length).toBeGreaterThan(0);
    for (const w of waypoints) {
      expect(moveSet.has(`${w.x / MANSION.cell},${w.z / MANSION.cell}`), `waypoint ${w.x},${w.z} sits on blocking furniture`).toBe(false);
    }
  });

  it('never seals a reachable cell behind furniture (flood fill from spawn covers every open cell)', () => {
    const { moveCells } = expandFurniture(MANSION.furniture, {
      wallSet: parsed.wallSet, cols: parsed.cols, rows: parsed.rows, doorCells: parsed.doorCells,
    });
    const moveSet = new Set([...parsed.wallSet, ...moveCells]);
    const spawnCell = [parsed.spawn.x / MANSION.cell, parsed.spawn.z / MANSION.cell];

    const { open, seen } = floodFillFromSpawn(MANSION.mapText, moveSet, spawnCell);
    expect(seen.size).toBe(open.size);
    const sealed = [...open].filter((key) => !seen.has(key));
    expect(sealed, `sealed cells unreachable from spawn: ${sealed.join(' ')}`).toEqual([]);
  });
});
