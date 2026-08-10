import * as THREE from 'three';
import { CELL } from './mapData.js';
import { PALETTE } from '../rendering/palette.js';
import { createToonMaterial } from '../rendering/toonMaterial.js';

// Flat wall dressing: ink frame + colored plane on the wall's room-side face.
// No lights, no collision; meshes join the static shootables so impact marks
// land on the prop, not the wall behind it.
const NORMALS = {
  n: { x: 0, z: -1 },
  s: { x: 0, z: 1 },
  e: { x: 1, z: 0 },
  w: { x: -1, z: 0 },
};

// [plane color, width factor of the span, height, center y]
const TYPES = {
  portrait: [PALETTE.canvasDark, 0.7, 1.1, 1.7],
  mirror: [PALETTE.mirrorGlass, 0.7, 1.0, 1.7],
  tapestry: [PALETTE.velvet, 0.85, 1.7, 1.5],
  map: [PALETTE.furnitureStoneWarm, 0.75, 0.9, 1.7],
  scoreboard: [PALETTE.furnitureWoodDark, 0.7, 0.7, 1.6],
  'cue-rack': [PALETTE.furnitureWalnut, 0.85, 1.1, 1.4],
  'pot-rack': [PALETTE.furnitureIronDark, 0.85, 0.5, 2.1],
  'boarded-window': [PALETTE.furnitureWoodDark, 0.8, 1.2, 1.6],
  'main-door': [PALETTE.furnitureWoodDark, 0.92, 2.3, 1.15],
};

export function buildWallProps(props, cell = CELL) {
  const group = new THREE.Group();
  if (!props.length) return group;
  const frameMat = createToonMaterial(PALETTE.ink);
  for (const p of props) {
    const [color, wf, h, cy] = TYPES[p.type] ?? TYPES.portrait;
    const n = NORMALS[p.facing];
    const x0 = p.x ?? p.x0, x1 = p.x ?? p.x1;
    const z0 = p.z ?? p.z0, z1 = p.z ?? p.z1;
    const spanCells = (x1 - x0 + 1) * Math.abs(n.z) + (z1 - z0 + 1) * Math.abs(n.x) || 1;
    const w = spanCells * cell * wf;
    const cx = ((x0 + x1 + 1) / 2) * cell - cell / 2 + n.x * (cell / 2 + 0.03);
    const cz = ((z0 + z1 + 1) / 2) * cell - cell / 2 + n.z * (cell / 2 + 0.03);
    const rotY = n.x !== 0 ? Math.PI / 2 : 0;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(rotY ? 0.05 : w + 0.1, h + 0.1, rotY ? w + 0.1 : 0.05),
      frameMat,
    );
    frame.position.set(cx, cy, cz);
    group.add(frame);

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), createToonMaterial(color));
    plane.position.set(cx + n.x * 0.03, cy, cz + n.z * 0.03);
    plane.rotation.y = rotY + (n.x + n.z < 0 ? Math.PI : 0);
    group.add(plane);
  }
  return group;
}
