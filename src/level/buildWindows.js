import * as THREE from 'three';
import { CELL } from './mapData.js';
import { PALETTE } from '../rendering/palette.js';
import { createToonMaterial } from '../rendering/toonMaterial.js';

// Fake moonlight windows on wall cells: ink-dark frame, pale glow plane,
// one faint cool point light each. facing = direction of the room-side face.
const NORMALS = {
  n: { x: 0, z: -1 },
  s: { x: 0, z: 1 },
  e: { x: 1, z: 0 },
  w: { x: -1, z: 0 },
};
const SILL = 1.0;
const WIN_W = 0.9;
const WIN_H = 1.2;

export function buildWindows(windows, cell = CELL, { lights = true } = {}) {
  const group = new THREE.Group();
  if (!windows.length) return group;
  const frameMat = createToonMaterial(PALETTE.ink);
  const glowMat = new THREE.MeshBasicMaterial({ color: PALETTE.moonlight });
  for (const { x, z, facing } of windows) {
    const n = NORMALS[facing];
    const cx = x * cell + n.x * (cell / 2 + 0.02);
    const cz = z * cell + n.z * (cell / 2 + 0.02);
    const cy = SILL + WIN_H / 2;
    const rotY = n.x !== 0 ? Math.PI / 2 : 0;

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(WIN_W, WIN_H), glowMat);
    glow.position.set(cx, cy, cz);
    glow.rotation.y = rotY + (n.x + n.z < 0 ? Math.PI : 0);
    group.add(glow);

    // frame: two vertical + three horizontal bars (incl. a center mullion)
    const bars = [
      [0.06, WIN_H + 0.12, -WIN_W / 2, 0],
      [0.06, WIN_H + 0.12, WIN_W / 2, 0],
      [WIN_W + 0.12, 0.06, 0, -WIN_H / 2],
      [WIN_W + 0.12, 0.06, 0, WIN_H / 2],
      [WIN_W + 0.12, 0.05, 0, 0],
    ];
    for (const [bw, bh, ox, oy] of bars) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(rotY ? 0.06 : bw, bh, rotY ? bw : 0.06), frameMat);
      bar.position.set(
        cx + (rotY ? n.x * 0.02 : ox),
        cy + oy,
        cz + (rotY ? ox : n.z * 0.02),
      );
      group.add(bar);
    }

    if (lights) {
      const light = new THREE.PointLight(PALETTE.moonlight, 2, 4, 1.5);
      light.position.set(x * cell + n.x * (cell / 2 + 0.4), cy, z * cell + n.z * (cell / 2 + 0.4));
      group.add(light);
    }
  }
  return group;
}
