import * as THREE from 'three';
import { CELL } from './mapData.js';
import { furnitureBox } from './furniture.js';
import { createToonMaterial } from '../rendering/toonMaterial.js';

// One toon box per piece; the post stack inks the outlines like everything else.
// Children stay flat (no sub-groups): the shot raycast is non-recursive.
export function buildFurniture(furniture, cell = CELL) {
  const group = new THREE.Group();
  for (const item of furniture) {
    const box = furnitureBox(item, cell);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(box.w, box.h, box.d),
      createToonMaterial(item.color),
    );
    mesh.position.set(box.x, box.y, box.z);
    group.add(mesh);
  }
  return group;
}
