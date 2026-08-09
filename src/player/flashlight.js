import * as THREE from 'three';
import { PALETTE } from '../rendering/palette.js';

export function createFlashlight(camera) {
  const light = new THREE.SpotLight(PALETTE.flashlight, 8, 18, Math.PI / 7, 0.4, 1.2);
  light.position.set(0.15, -0.1, 0); // slightly off-center, like a hand-held light

  const target = new THREE.Object3D();
  target.position.set(0, 0, -5);
  camera.add(light, target);
  light.target = target;

  let on = true;
  return {
    toggle() {
      on = !on;
      light.visible = on;
      return on;
    },
    isOn: () => on,
    light,
  };
}
