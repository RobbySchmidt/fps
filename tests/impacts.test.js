import { it, expect } from 'vitest';
import * as THREE from 'three';
import { createImpactPool } from '../src/weapons/impacts.js';

it('creates at most max meshes and then reuses the oldest', () => {
  const parent = new THREE.Group();
  const pool = createImpactPool(parent, 3);
  for (let i = 0; i < 5; i++) {
    pool.spawn(new THREE.Vector3(i, 0, 0), new THREE.Vector3(0, 0, 1));
  }
  expect(pool.count()).toBe(3);
  expect(parent.children.length).toBe(3);
});

it('offsets the mark along the surface normal', () => {
  const parent = new THREE.Group();
  const pool = createImpactPool(parent, 3);
  const mesh = pool.spawn(new THREE.Vector3(1, 2, 3), new THREE.Vector3(0, 0, 1));
  expect(mesh.position.z).toBeCloseTo(3.01);
});

it('offsets floor marks upward for an up-facing normal', () => {
  const parent = new THREE.Group();
  const pool = createImpactPool(parent, 3);
  const mesh = pool.spawn(new THREE.Vector3(4, 0, 6), new THREE.Vector3(0, 1, 0));
  expect(mesh.position.y).toBeCloseTo(0.01);
  expect(mesh.position.x).toBeCloseTo(4);
});
