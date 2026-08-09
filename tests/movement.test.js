import { it, expect } from 'vitest';
import { computeWishDir, WALK_SPEED, SPRINT_SPEED, GRAVITY, JUMP_VELOCITY, tryJump, stepVertical } from '../src/player/movement.js';

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

it('tryJump launches only from the ground', () => {
  const body = { y: 0, vy: 0 };
  expect(tryJump(body)).toBe(true);
  expect(body.vy).toBe(JUMP_VELOCITY);
  stepVertical(body, 0.05);
  expect(body.y).toBeGreaterThan(0);
  expect(tryJump(body)).toBe(false); // mid-air
});

it('jump arc peaks around one meter and lands back at zero', () => {
  const body = { y: 0, vy: 0 };
  tryJump(body);
  let peak = 0;
  for (let i = 0; i < 300; i++) {
    stepVertical(body, 1 / 120);
    peak = Math.max(peak, body.y);
  }
  expect(peak).toBeGreaterThan(0.9);
  expect(peak).toBeLessThan(1.2);
  expect(body.y).toBe(0);
  expect(body.vy).toBe(0);
});

it('a grounded body stays at rest', () => {
  const body = { y: 0, vy: 0 };
  stepVertical(body, 0.1);
  expect(body).toEqual({ y: 0, vy: 0 });
});
