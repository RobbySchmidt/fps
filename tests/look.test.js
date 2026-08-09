import { it, expect } from 'vitest';
import { createLook, applyLookDelta } from '../src/player/look.js';

it('starts level and centered', () => {
  expect(createLook()).toEqual({ yaw: 0, pitch: 0 });
});

it('turns right (yaw decreases) when the mouse moves right', () => {
  const look = createLook();
  applyLookDelta(look, 100, 0);
  expect(look.yaw).toBeCloseTo(-0.2);
  expect(look.pitch).toBe(0);
});

it('looks up (pitch increases) when the mouse moves up', () => {
  const look = createLook();
  applyLookDelta(look, 0, -100); // negative dy = mouse up
  expect(look.pitch).toBeCloseTo(0.2);
});

it('clamps pitch so the view cannot flip over', () => {
  const look = createLook();
  applyLookDelta(look, 0, -100000);
  expect(look.pitch).toBeCloseTo(Math.PI / 2 - 0.01);
  applyLookDelta(look, 0, 100000);
  expect(look.pitch).toBeCloseTo(-(Math.PI / 2 - 0.01));
});
