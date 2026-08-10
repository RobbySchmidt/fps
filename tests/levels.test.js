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
    expect(parsed.spawn).toEqual({ x: 7, z: 14 });
    expect(parsed.wandererSpawn).toEqual({ x: 11, z: 5 });
    expect(parsed.lamps).toHaveLength(2);
  });

  it('is 21 columns by 17 rows at 1m cells', () => {
    expect(KITCHEN_TEST.cell).toBe(1);
    expect(parsed.cols).toBe(21);
    expect(parsed.rows).toBe(17);
  });

  it('has furniture that expands cleanly against the parsed map', () => {
    const { moveCells, sightCells } = expandFurniture(KITCHEN_TEST.furniture, {
      wallSet: parsed.wallSet,
      cols: parsed.cols,
      rows: parsed.rows,
    });
    // work-table(8) + counter(3) + barrel(1) low; stove(2) + hearth(3) + larder(3) tall
    expect(moveCells.size).toBe(20);
    expect(sightCells.size).toBe(8);
  });

  it('keeps the wanderer spawn and player spawn off furniture cells', () => {
    const { moveCells } = expandFurniture(KITCHEN_TEST.furniture, {
      wallSet: parsed.wallSet,
      cols: parsed.cols,
      rows: parsed.rows,
    });
    expect(moveCells.has('11,5')).toBe(false);
    expect(moveCells.has('7,14')).toBe(false);
  });
});
