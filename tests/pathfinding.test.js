import { it, expect } from 'vitest';
import { findPath, worldToCell, cellToWorld, hasLineOfSight } from '../src/level/pathfinding.js';
import { CELL } from '../src/level/mapData.js';

// A 5x5 room with a wall stub at (2,1) and (2,2):
// #####
// #.#.#
// #.#.#
// #...#
// #####
const wallSet = new Set([
  '0,0', '1,0', '2,0', '3,0', '4,0',
  '0,1', '2,1', '4,1',
  '0,2', '2,2', '4,2',
  '0,3', '4,3',
  '0,4', '1,4', '2,4', '3,4', '4,4',
]);

it('converts between world metres and grid cells', () => {
  expect(worldToCell(4, 6)).toEqual({ c: 2, r: 3 });
  expect(cellToWorld(2, 3)).toEqual({ x: 2 * CELL, z: 3 * CELL });
});

it('finds a straight path down an open column', () => {
  const path = findPath({ c: 1, r: 1 }, { c: 1, r: 3 }, wallSet);
  expect(path).toEqual([{ c: 1, r: 1 }, { c: 1, r: 2 }, { c: 1, r: 3 }]);
});

it('routes around a wall instead of through it', () => {
  const path = findPath({ c: 1, r: 1 }, { c: 3, r: 1 }, wallSet);
  expect(path).not.toBeNull();
  expect(path[0]).toEqual({ c: 1, r: 1 });
  expect(path[path.length - 1]).toEqual({ c: 3, r: 1 });
  expect(path.some((cell) => wallSet.has(`${cell.c},${cell.r}`))).toBe(false);
  expect(path.length).toBe(7); // down, across the bottom, back up
});

it('returns null when the goal is a wall', () => {
  expect(findPath({ c: 1, r: 1 }, { c: 2, r: 1 }, wallSet)).toBeNull();
});

it('returns null when the goal is unreachable', () => {
  const sealed = new Set([...wallSet, '1,3']); // seals the left column off from the bottom row
  expect(findPath({ c: 1, r: 1 }, { c: 3, r: 1 }, sealed)).toBeNull();
});

it('returns a single-cell path when already at the goal', () => {
  expect(findPath({ c: 1, r: 1 }, { c: 1, r: 1 }, wallSet)).toEqual([{ c: 1, r: 1 }]);
});

it('sees along an open line and not through a wall', () => {
  const a = cellToWorld(1, 1);
  const b = cellToWorld(1, 3);
  const acrossTheStub = cellToWorld(3, 1);
  expect(hasLineOfSight(a, b, wallSet)).toBe(true);
  expect(hasLineOfSight(a, acrossTheStub, wallSet)).toBe(false);
});
