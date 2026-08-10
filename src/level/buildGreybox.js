import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CELL } from './mapData.js';
import { createToonMaterial, createInkMaterial } from '../rendering/toonMaterial.js';
import { PALETTE } from '../rendering/palette.js';

const WALL_HEIGHT = 3;

export function buildGreybox(parsed, cell = CELL, { floorPatches = [], wallPatches = [] } = {}) {
  const group = new THREE.Group();

  const inPatch = (p, c, r) => c >= p.x0 && c <= p.x1 && r >= p.z0 && r <= p.z1;
  const patchMats = wallPatches.map((p) => createInkMaterial(p.color, p.family, cell / 2, WALL_HEIGHT / 2));
  const wallMat = createToonMaterial(PALETTE.wall);
  const buckets = new Map(); // patch index (-1 = default) -> geometries
  for (const { c, r } of parsed.walls) {
    const idx = wallPatches.findIndex((p) => inPatch(p, c, r));
    const geo = new THREE.BoxGeometry(cell, WALL_HEIGHT, cell);
    geo.translate(c * cell, WALL_HEIGHT / 2, r * cell);
    if (!buckets.has(idx)) buckets.set(idx, []);
    buckets.get(idx).push(geo);
  }
  for (const [idx, geos] of buckets) {
    const merged = mergeGeometries(geos);
    geos.forEach((g) => g.dispose());
    group.add(new THREE.Mesh(merged, idx >= 0 ? patchMats[idx] : wallMat));
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

  for (const p of floorPatches) {
    const pw = (p.x1 - p.x0 + 1) * cell;
    const pd = (p.z1 - p.z0 + 1) * cell;
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, pd),
      createInkMaterial(p.color, p.family, pw / 2, pd / 2),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(
      ((p.x0 + p.x1) / 2) * cell,
      0.01, // above the base floor: no z-fighting
      ((p.z0 + p.z1) / 2) * cell,
    );
    group.add(patch);
  }

  return group;
}
