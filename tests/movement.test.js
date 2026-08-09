import { it, expect } from 'vitest';
import { computeWishDir, WALK_SPEED, SPRINT_SPEED } from '../src/player/movement.js';

const none = { forward: false, back: false, left: false, right: false };

it('moves toward -Z when facing forward (yaw 0)', () => {
  const dir = computeWishDir({ ...none, forward: true }, 0);
  expect(dir.x).toBeCloseTo(0);
  expect(dir.z).toBeCloseTo(-1);
});

it('strafes right toward +X at yaw 0', () => {
  const dir = computeWishDir({ ...none, right: true }, 0);
  expect(dir.x).toBeCloseTo(1);
  expect(dir.z).toBeCloseTo(0);
});

it('rotates with yaw: forward at yaw π/2 moves toward -X', () => {
  const dir = computeWishDir({ ...none, forward: true }, Math.PI / 2);
  expect(dir.x).toBeCloseTo(-1);
  expect(dir.z).toBeCloseTo(0);
});

it('normalizes diagonals to length 1', () => {
  const dir = computeWishDir({ ...none, forward: true, right: true }, 0);
  expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1);
});

it('returns zero vector with no input and with opposing keys', () => {
  expect(computeWishDir(none, 1.23)).toEqual({ x: 0, z: 0 });
  expect(computeWishDir({ ...none, forward: true, back: true }, 0)).toEqual({ x: 0, z: 0 });
});

it('exports walk and sprint speeds', () => {
  expect(WALK_SPEED).toBe(3.5);
  expect(SPRINT_SPEED).toBe(5.5);
});
