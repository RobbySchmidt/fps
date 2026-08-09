import * as THREE from 'three';
import { PALETTE } from '../rendering/palette.js';

export function createImpactPool(parent, max = 24) {
  const geometry = new THREE.CircleGeometry(0.06, 12);
  const material = new THREE.MeshBasicMaterial({ color: PALETTE.impact, side: THREE.DoubleSide });
  const pool = [];
  let next = 0;
  return {
    spawn(point, normal) {
      let mesh = pool[next];
      if (!mesh) {
        mesh = new THREE.Mesh(geometry, material);
        pool[next] = mesh;
        parent.add(mesh);
      }
      mesh.position.copy(point).addScaledVector(normal, 0.01);
      mesh.lookAt(point.clone().add(normal));
      next = (next + 1) % max;
      return mesh;
    },
    count: () => pool.length,
  };
}
