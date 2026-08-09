import { it, expect } from 'vitest';
import * as THREE from 'three';
import { createFlashlight } from '../src/player/flashlight.js';

it('starts on and toggles off and back on', () => {
  const camera = new THREE.PerspectiveCamera();
  const flashlight = createFlashlight(camera);
  expect(flashlight.isOn()).toBe(true);
  expect(flashlight.light.visible).toBe(true);
  expect(flashlight.toggle()).toBe(false);
  expect(flashlight.light.visible).toBe(false);
  expect(flashlight.toggle()).toBe(true);
  expect(flashlight.light.visible).toBe(true);
});

it('attaches the light and its target to the camera', () => {
  const camera = new THREE.PerspectiveCamera();
  const flashlight = createFlashlight(camera);
  expect(flashlight.light.parent).toBe(camera);
  expect(flashlight.light.target.parent).toBe(camera);
});
