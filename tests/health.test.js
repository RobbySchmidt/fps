import { it, expect } from 'vitest';
import { createHealth } from '../src/player/health.js';

it('starts full', () => {
  const health = createHealth();
  expect(health.hp()).toBe(100);
  expect(health.max()).toBe(100);
  expect(health.fraction()).toBe(1);
  expect(health.isDead()).toBe(false);
});

it('takes damage and reports a fraction', () => {
  const health = createHealth();
  health.damage(25, 0);
  expect(health.hp()).toBe(75);
  expect(health.fraction()).toBeCloseTo(0.75);
});

it('does not regenerate before the delay elapses', () => {
  const health = createHealth();
  health.damage(50, 0);
  health.update(0);
  health.update(4.9);
  expect(health.hp()).toBe(50);
});

it('regenerates at the configured rate after the delay', () => {
  const health = createHealth();
  health.damage(50, 0);
  health.update(0);
  health.update(5);   // delay reached, no time accrued yet for regen
  health.update(6);   // one second of regen
  expect(health.hp()).toBeCloseTo(62);
});

it('never regenerates above max', () => {
  const health = createHealth();
  health.damage(5, 0);
  health.update(0);
  health.update(100);
  expect(health.hp()).toBe(100);
});

it('dies at zero and stays dead', () => {
  const health = createHealth();
  health.damage(150, 0);
  expect(health.hp()).toBe(0);
  expect(health.isDead()).toBe(true);
  health.update(0);
  health.update(50);
  expect(health.hp()).toBe(0);
});

it('reset restores full health', () => {
  const health = createHealth();
  health.damage(100, 0);
  health.reset();
  expect(health.hp()).toBe(100);
  expect(health.isDead()).toBe(false);
});

it('does not credit regeneration for time spent inside the delay window', () => {
  const health = createHealth({ regenRate: 5 });
  health.damage(60, 0);   // hp 40
  health.update(0);
  health.update(3);       // still inside the 5s delay
  health.update(10);      // only t=5..10 may regenerate: 5s * 5hp = 25
  expect(health.hp()).toBeCloseTo(65);
});
