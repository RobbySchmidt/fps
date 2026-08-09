import { it, expect } from 'vitest';
import { parseMap, MAP, CELL } from '../src/level/mapData.js';

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

it('ships a valid mansion MAP', () => {
  const parsed = parseMap(MAP);
  expect(parsed.walls.length).toBeGreaterThan(50);
  expect(parsed.spawn).toBeDefined();
});
