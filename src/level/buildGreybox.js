import * as THREE from 'three';
import { CELL } from './mapData.js';
import { createToonMaterial } from '../rendering/toonMaterial.js';
import { PALETTE } from '../rendering/palette.js';

const WALL_HEIGHT = 3;

export function buildGreybox(parsed) {
  const group = new THREE.Group();

  const wallGeo = new THREE.BoxGeometry(CELL, WALL_HEIGHT, CELL);
  const wallMat = createToonMaterial(PALETTE.wall);
  for (const { c, r } of parsed.walls) {
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(c * CELL, WALL_HEIGHT / 2, r * CELL);
    group.add(wall);
  }

  const width = parsed.cols * CELL;
  const depth = parsed.rows * CELL;
  const centerX = width / 2 - CELL / 2;
  const centerZ = depth / 2 - CELL / 2;

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
