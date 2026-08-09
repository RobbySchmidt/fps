import { it, expect } from 'vitest';
import { quantizeTime, burstFreezeFactor, serpentineDirection } from '../src/enemy/movementStyle.js';

it('quantizes time onto 10fps animation frames', () => {
  expect(quantizeTime(0.04)).toBeCloseTo(0);
  expect(quantizeTime(0.09)).toBeCloseTo(0);
  expect(quantizeTime(0.11)).toBeCloseTo(0.1);
  expect(quantizeTime(0.35)).toBeCloseTo(0.3);
});

it('holds a pose for the whole animation frame', () => {
  expect(quantizeTime(1.21)).toBe(quantizeTime(1.29));
  expect(quantizeTime(1.21)).not.toBe(quantizeTime(1.31));
});

it('alternates bursts of movement with dead stops', () => {
  expect(burstFreezeFactor(0)).toBe(1);
  expect(burstFreezeFactor(0.5)).toBe(1);
  expect(burstFreezeFactor(0.6)).toBe(0);
  expect(burstFreezeFactor(0.79)).toBe(0);
  expect(burstFreezeFactor(0.81)).toBe(1); // next cycle
});

it('serpentine direction is a unit vector', () => {
  const dir = serpentineDirection({ x: 0, z: 0 }, { x: 10, z: 0 }, 0.3);
  expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1);
});

it('serpentine points straight at the target when the weave crosses zero', () => {
  const dir = serpentineDirection({ x: 0, z: 0 }, { x: 10, z: 0 }, 0);
  expect(dir.x).toBeCloseTo(1);
  expect(dir.z).toBeCloseTo(0);
});

it('serpentine deviates sideways between zero crossings', () => {
  const t = Math.PI / 2 / 2.6; // sin(frequency * t) === 1
  const dir = serpentineDirection({ x: 0, z: 0 }, { x: 10, z: 0 }, t);
  expect(Math.abs(dir.z)).toBeGreaterThan(0.4);
  expect(dir.x).toBeGreaterThan(0); // still closing on the target
});

it('returns a zero vector when already at the target', () => {
  expect(serpentineDirection({ x: 3, z: 3 }, { x: 3, z: 3 }, 1)).toEqual({ x: 0, z: 0 });
});
