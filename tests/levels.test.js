import { describe, it, expect } from 'vitest';
import { selectLevel, MANSION, KITCHEN_TEST } from '../src/level/levels.js';
import { parseMap } from '../src/level/mapData.js';
import { expandFurniture } from '../src/level/furniture.js';

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

    it('gives the mansion no art-slice data', () => {
      expect(MANSION.floorPatches).toBeUndefined();
      expect(MANSION.windows).toBeUndefined();
    });
  });
});
