import * as THREE from 'three';
import { CELL } from './mapData.js';
import { furnitureBox } from './furniture.js';
import { createToonMaterial } from '../rendering/toonMaterial.js';
import { hasFigure, buildFigure } from './furnitureFigures.js';

// Composed figures where a builder exists, box fallback otherwise. Children
// stay one object per piece; group.userData.hitMeshes is the flat mesh list
// for the (non-recursive) shot raycast.
export function buildFurniture(furniture, cell = CELL) {
  const group = new THREE.Group();
  const hitMeshes = [];
  for (const item of furniture) {
    const b = furnitureBox(item, cell);
    let obj;
    if (hasFigure(item)) {
      obj = buildFigure(item, cell);
      obj.position.set(b.x, 0, b.z);
    } else {
      obj = new THREE.Mesh(
        new THREE.BoxGeometry(b.w, b.h, b.d),
        createToonMaterial(item.color),
      );
      obj.position.set(b.x, b.y, b.z);
    }
    group.add(obj);
    obj.traverse((node) => {
      if (node.isMesh) hitMeshes.push(node);
    });
  }
  group.userData.hitMeshes = hitMeshes;
  return group;
}
