import { it, expect } from 'vitest';
import { createRevolver } from '../src/weapons/revolver.js';

it('fires and spends one round', () => {
  const gun = createRevolver();
  expect(gun.rounds()).toBe(6);
  expect(gun.fire(0)).toBe(true);
  expect(gun.rounds()).toBe(5);
});

it('respects the fire cooldown', () => {
  const gun = createRevolver();
  expect(gun.fire(0)).toBe(true);
  expect(gun.fire(0.1)).toBe(false);
  expect(gun.fire(0.4)).toBe(true);
});

it('cannot fire empty', () => {
  const gun = createRevolver({ capacity: 1 });
  expect(gun.fire(0)).toBe(true);
  expect(gun.fire(1)).toBe(false);
});

it('reload blocks firing until done, then the cylinder is full', () => {
  const gun = createRevolver();
  gun.fire(0);
  expect(gun.startReload(1)).toBe(true);
  expect(gun.isReloading(1.5)).toBe(true);
  expect(gun.fire(1.5)).toBe(false);
  expect(gun.isReloading(2.3)).toBe(false);
  expect(gun.rounds()).toBe(6);
  expect(gun.fire(2.3)).toBe(true);
});

it('reload is refused when already reloading or full', () => {
  const gun = createRevolver();
  expect(gun.startReload(0)).toBe(false); // full
  gun.fire(0);
  expect(gun.startReload(1)).toBe(true);
  expect(gun.startReload(1.5)).toBe(false); // already reloading
});

it('rounds stay at the pre-reload count until the reload completes', () => {
  const gun = createRevolver();
  gun.fire(0);
  gun.startReload(1);
  gun.isReloading(1.5);
  expect(gun.rounds()).toBe(5);
  gun.isReloading(2.3); // reload done; settle happens here
  expect(gun.rounds()).toBe(6);
});

it('reset refills the cylinder and clears timers', () => {
  const gun = createRevolver();
  gun.fire(0);
  gun.fire(1);
  gun.reset();
  expect(gun.rounds()).toBe(6);
  expect(gun.isReloading(0)).toBe(false);
  expect(gun.fire(0)).toBe(true); // cooldown cleared too
});
