import { it, expect } from 'vitest';
import { collides, moveWithCollision } from '../src/level/collision.js';

// One wall cell at grid (2,1): center (4,2), spans x[3,5], z[1,3] with CELL=2.
const wallSet = new Set(['2,1']);

it('detects overlap between player circle and a wall cell', () => {
  expect(collides(3.2, 2, 0.4, wallSet)).toBe(true);
  expect(collides(2.0, 2, 0.4, wallSet)).toBe(false);
});

it('moves freely in open space', () => {
  const next = moveWithCollision({ x: 0, z: 0 }, 0.5, -0.25, wallSet);
  expect(next).toEqual({ x: 0.5, z: -0.25 });
});

it('blocks movement into a wall', () => {
  const next = moveWithCollision({ x: 2, z: 2 }, 1.0, 0, wallSet);
  expect(next.x).toBe(2); // x + 1 would put the circle inside the wall
});

it('slides along a wall when one axis is blocked', () => {
  const next = moveWithCollision({ x: 2, z: 2 }, 1.0, -0.5, wallSet);
  expect(next.x).toBe(2);      // blocked
  expect(next.z).toBe(1.5);    // free
});

it('does not mutate the input position', () => {
  const pos = { x: 0, z: 0 };
  moveWithCollision(pos, 0.5, 0.5, wallSet);
  expect(pos).toEqual({ x: 0, z: 0 });
});
