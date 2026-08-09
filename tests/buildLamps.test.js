import { it, expect } from 'vitest';
import * as THREE from 'three';
import { buildLamps } from '../src/level/buildLamps.js';
import { PALETTE } from '../src/rendering/palette.js';

it('creates one point light and one bulb mesh per lamp', () => {
  const group = buildLamps({ lamps: [{ x: 2, z: 4 }, { x: 6, z: 8 }] });
  const lights = group.children.filter((c) => c.isPointLight);
  const bulbs = group.children.filter((c) => c.isMesh);
  expect(lights.length).toBe(2);
  expect(bulbs.length).toBe(2);
  expect(lights[0].position.y).toBe(2.4);
  expect(lights[0].color.getHex()).toBe(new THREE.Color(PALETTE.lamp).getHex());
});

it('handles zero lamps', () => {
  expect(buildLamps({ lamps: [] }).children.length).toBe(0);
});
