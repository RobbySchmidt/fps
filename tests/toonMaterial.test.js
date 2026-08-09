import { it, expect } from 'vitest';
import * as THREE from 'three';
import { createToonGradientMap, createToonMaterial } from '../src/rendering/toonMaterial.js';

it('gradient map is a 3-step nearest-filtered texture', () => {
  const tex = createToonGradientMap();
  expect(tex.image.width).toBe(3);
  expect(Array.from(tex.image.data)).toEqual([40, 110, 220]);
  expect(tex.minFilter).toBe(THREE.NearestFilter);
  expect(tex.magFilter).toBe(THREE.NearestFilter);
});

it('creates toon materials that share one gradient map', () => {
  const a = createToonMaterial(0xff0000);
  const b = createToonMaterial(0x00ff00);
  expect(a).toBeInstanceOf(THREE.MeshToonMaterial);
  expect(a).not.toBe(b);
  expect(a.gradientMap).toBe(b.gradientMap);
});

it('applies the given color', () => {
  const m = createToonMaterial(0x123456);
  expect(m.color.getHex()).toBe(0x123456);
});
