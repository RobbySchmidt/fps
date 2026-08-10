import * as THREE from 'three';
import { CELL } from './mapData.js';
import { createToonMaterial } from '../rendering/toonMaterial.js';
import { PALETTE } from '../rendering/palette.js';

const WALL_HEIGHT = 3;

export function buildGreybox(parsed, cell = CELL) {
  const group = new THREE.Group();

  const wallGeo = new THREE.BoxGeometry(cell, WALL_HEIGHT, cell);
  const wallMat = createToonMaterial(PALETTE.wall);
  for (const { c, r } of parsed.walls) {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(c * cell, WALL_HEIGHT / 2, r * cell);
    group.add(wall);
  }

  const width = parsed.cols * cell;
  const depth = parsed.rows * cell;
  const centerX = width / 2 - cell / 2;
  const centerZ = depth / 2 - cell / 2;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    createToonMaterial(PALETTE.floor),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centerX, 0, centerZ);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    createToonMaterial(PALETTE.ceiling),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(centerX, WALL_HEIGHT, centerZ);

  group.add(floor, ceiling);
  return group;
}
