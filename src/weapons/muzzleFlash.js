import * as THREE from 'three';
import { PALETTE } from '../rendering/palette.js';

const FLASH_INTENSITY = 30;
const DECAY_PER_SECOND = 260;

export function createMuzzleFlash(camera) {
  const light = new THREE.PointLight(PALETTE.lamp, 0, 7, 1.8);
  light.position.set(0.15, -0.12, -0.4);
  camera.add(light);
  return {
    trigger() {
      light.intensity = FLASH_INTENSITY;
    },
    update(dt) {
      light.intensity = Math.max(0, light.intensity - DECAY_PER_SECOND * dt);
    },
    light,
  };
}
