import { it, expect, describe } from 'vitest';
import { parseMap, CELL } from '../src/level/mapData.js';

const SMALL = `
#####
#S.D#
#####
`;

it('collects wall cells and a wall lookup set', () => {
  const parsed = parseMap(SMALL);
  expect(parsed.walls.length).toBe(12); // 5 + 2 + 5
  expect(parsed.wallSet.has('0,0')).toBe(true);
  expect(parsed.wallSet.has('1,1')).toBe(false);
});

it('finds the spawn point in world meters', () => {
  const parsed = parseMap(SMALL);
  expect(parsed.spawn).toEqual({ x: 1 * CELL, z: 1 * CELL });
});

it('reports grid dimensions', () => {
  const parsed = parseMap(SMALL);
  expect(parsed.cols).toBe(5);
  expect(parsed.rows).toBe(3);
});

it('throws when the map has no spawn', () => {
  expect(() => parseMap('###\n#.#\n###')).toThrow(/spawn/);
});

it('parses identically when lines are joined with CRLF', () => {
  const crlf = SMALL.split('\n').join('\r\n');
  const lf = parseMap(SMALL);
  const withCrlf = parseMap(crlf);
  expect(withCrlf.cols).toBe(lf.cols);
  expect(withCrlf.rows).toBe(lf.rows);
  expect(withCrlf.walls).toEqual(lf.walls);
  expect(withCrlf.spawn).toEqual(lf.spawn);
});

it('collects lamp positions as walkable floor', () => {
  const parsed = parseMap('#####\n#S.L#\n#####');
  expect(parsed.lamps).toEqual([{ x: 3 * CELL, z: 1 * CELL }]);
  expect(parsed.wallSet.has('3,1')).toBe(false);
});

describe('parseMap cell size and wanderer spawn', () => {
  const TINY = `
#####
#S.W#
#..L#
#####
`;

  it('scales world coordinates by the cell parameter', () => {
    const parsed = parseMap(TINY, 1);
    expect(parsed.spawn).toEqual({ x: 1, z: 1 });
    expect(parsed.lamps).toEqual([{ x: 3, z: 2 }]);
  });

  it('defaults to CELL when no cell is given', () => {
    const parsed = parseMap(TINY);
    expect(parsed.spawn).toEqual({ x: 1 * CELL, z: 1 * CELL });
  });

  it('parses W as the wanderer spawn in world coordinates', () => {
    const parsed = parseMap(TINY, 1);
    expect(parsed.wandererSpawn).toEqual({ x: 3, z: 1 });
  });

  it('returns null wandererSpawn when the map has no W', () => {
    expect(parseMap(SMALL).wandererSpawn).toBeNull();
  });
});

describe('door cells', () => {
  it('records D cells as walkable doorways', () => {
    const parsed = parseMap('#####\n#S.D#\n#####', 1);
    expect(parsed.doorCells.has('3,1')).toBe(true);
    expect(parsed.wallSet.has('3,1')).toBe(false);
  });

  it('returns an empty doorCells set when the map has no D', () => {
    expect(parseMap('###\n#S#\n###', 1).doorCells.size).toBe(0);
  });
});
