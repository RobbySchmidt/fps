import { it, expect } from 'vitest';
import * as THREE from 'three';
import { createMuzzleFlash } from '../src/weapons/muzzleFlash.js';

it('flashes on trigger and decays to zero', () => {
  const camera = new THREE.PerspectiveCamera();
  const flash = createMuzzleFlash(camera);
  expect(flash.light.intensity).toBe(0);
  flash.trigger();
  expect(flash.light.intensity).toBeGreaterThan(0);
  flash.update(1);
  expect(flash.light.intensity).toBe(0);
  expect(flash.light.parent).toBe(camera);
});
