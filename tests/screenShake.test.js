import { it, expect } from 'vitest';
import { createScreenShake } from '../src/rendering/screenShake.js';

it('is still until triggered', () => {
  const shake = createScreenShake();
  shake.update(0.016);
  expect(shake.offset()).toEqual({ x: 0, y: 0 });
});

it('offsets the camera after a trigger and decays back to zero', () => {
  const shake = createScreenShake();
  shake.trigger(0.5);
  shake.update(0.016);
  const jolted = shake.offset();
  expect(Math.hypot(jolted.x, jolted.y)).toBeGreaterThan(0);
  shake.update(10);
  expect(shake.offset()).toEqual({ x: 0, y: 0 });
});

it('keeps the strongest of overlapping triggers', () => {
  const shake = createScreenShake();
  shake.trigger(0.2);
  shake.trigger(0.6);
  shake.update(0.001);
  expect(Math.hypot(shake.offset().x, shake.offset().y)).toBeGreaterThan(0);
});
