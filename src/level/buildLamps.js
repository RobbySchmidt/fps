import * as THREE from 'three';
import { PALETTE } from '../rendering/palette.js';

const LAMP_HEIGHT = 2.4;

export function buildLamps(parsed) {
  const group = new THREE.Group();
  const bulbGeo = new THREE.SphereGeometry(0.12, 8, 8);
  const bulbMat = new THREE.MeshBasicMaterial({ color: PALETTE.lamp });
  for (const { x, z } of parsed.lamps) {
    const light = new THREE.PointLight(PALETTE.lamp, 14, 9, 1.6);
    light.position.set(x, LAMP_HEIGHT, z);
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(x, LAMP_HEIGHT, z);
    group.add(light, bulb);
  }
  return group;
}
