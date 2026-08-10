import * as THREE from 'three';
import { PALETTE } from '../rendering/palette.js';
import { createInkMaterial } from '../rendering/toonMaterial.js';
import { furnitureBox } from './furniture.js';

// Composed-primitive furniture, like the Wanderer: chunky boxes/cylinders,
// ink-grain materials, silhouettes doing the work. Each builder returns a
// group centered at origin with the floor at y=0, sized to the item's
// footprint (visuals must stay inside collision).
const IRON_DARK = PALETTE.furnitureIronDark;
const FIREBOX = PALETTE.firebox;
const JAR_COLORS = [PALETTE.jarOchre, PALETTE.jarTeal, PALETTE.jarRust];

function box(material, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function cylinder(material, radius, h, x, y, z, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, h, segments), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function workTable(item, w, d) {
  const wood = createInkMaterial(item.color, 'wood');
  const g = new THREE.Group();
  g.add(box(wood, w, 0.12, d, 0, 0.84, 0));
  const lx = w / 2 - 0.15;
  const lz = d / 2 - 0.15;
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    g.add(box(wood, 0.12, 0.78, 0.12, sx * lx, 0.39, sz * lz));
  }
  g.add(box(wood, w - 0.5, 0.15, 0.06, 0, 0.66, d / 2 - 0.12));
  g.add(box(wood, w - 0.5, 0.15, 0.06, 0, 0.66, -(d / 2 - 0.12)));
  return g;
}

function stove(item, w, d) {
  const iron = createInkMaterial(item.color, 'iron');
  const dark = createInkMaterial(IRON_DARK, 'iron');
  const g = new THREE.Group();
  g.add(box(iron, w, 1.1, d * 0.9, 0, 0.55, 0));
  g.add(box(dark, w * 0.5, 0.5, 0.05, 0, 0.5, d * 0.45 + 0.02)); // oven door, faces the room (+z)
  g.add(box(dark, 0.3, 0.05, 0.04, 0, 0.62, d * 0.45 + 0.06));   // handle
  g.add(cylinder(dark, 0.14, 0.05, -w / 4, 1.13, 0));            // hob ring
  g.add(cylinder(dark, 0.14, 0.05, w / 4, 1.13, 0));
  g.add(cylinder(iron, 0.09, 1.7, w / 4, 1.95, -d / 4));         // stovepipe, tops out at 2.8
  return g;
}

function hearth(item, w, d) {
  const stone = createInkMaterial(item.color, 'stone');
  const iron = createInkMaterial(IRON_DARK, 'iron');
  const dark = createInkMaterial(FIREBOX, 'stone');
  const g = new THREE.Group();
  g.add(box(stone, 0.3, 1.6, d, -(w / 2 - 0.15), 0.8, 0));
  g.add(box(stone, 0.3, 1.6, d, w / 2 - 0.15, 0.8, 0));
  g.add(box(stone, w, 0.3, d, 0, 1.75, 0));                       // lintel, tops at 1.9
  g.add(box(dark, w - 0.6, 1.4, 0.1, 0, 0.7, -d / 2 + 0.06));     // firebox back
  g.add(box(stone, w, 0.08, d, 0, 1.55, 0));                       // mantel shelf
  g.add(cylinder(iron, 0.02, w - 0.8, 0, 1.35, 0).rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2)); // hanging bar
  const kettle = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), iron);
  kettle.position.set(0, 0.95, 0);
  g.add(kettle);
  return g;
}

function counter(item, w, d) {
  const stone = createInkMaterial(item.color, 'stone');
  const wood = createInkMaterial(PALETTE.furnitureWood, 'wood');
  const dark = createInkMaterial(FIREBOX, 'stone');
  const g = new THREE.Group();
  g.add(box(wood, w * 0.95, 0.72, d * 0.9, 0, 0.36, 0));
  g.add(box(stone, w, 0.1, d, 0, 0.82, 0));
  g.add(box(dark, w * 0.5, 0.05, d * 0.5, 0, 0.88, 0)); // basin inset
  return g;
}

function larder(item, w, d) {
  const wood = createInkMaterial(item.color, 'wood');
  const g = new THREE.Group();
  g.add(box(wood, 0.08, 1.9, d, -(w / 2 - 0.04), 0.95, 0));
  g.add(box(wood, 0.08, 1.9, d, w / 2 - 0.04, 0.95, 0));
  g.add(box(wood, w, 1.9, 0.06, 0, 0.95, d / 2 - 0.03)); // back board (room side is -z: larder sits on the south wall)
  g.add(box(wood, w, 0.06, d, 0, 1.87, 0));
  for (const y of [0.5, 1.0, 1.5]) g.add(box(wood, w - 0.16, 0.05, d * 0.8, 0, y, 0));
  for (let i = 0; i < 8; i++) {
    const jar = createInkMaterial(JAR_COLORS[i % 3], 'stone');
    const r = 0.05 + (i % 3) * 0.012;
    const h = 0.12 + (i % 4) * 0.025;
    const shelfY = [0.5, 1.0, 1.5][i % 3];
    const x = -w / 2 + 0.25 + (i * 0.83) % (w - 0.5);
    g.add(cylinder(jar, r, h, x, shelfY + 0.03 + h / 2, (i % 2) * 0.15 - 0.05, 8));
  }
  return g;
}

function barrel(item, w, d) {
  const wood = createInkMaterial(item.color, 'wood');
  const iron = createInkMaterial(IRON_DARK, 'iron');
  const g = new THREE.Group();
  const r = Math.min(w, d) / 2 - 0.03;
  g.add(cylinder(wood, r, 0.9, 0, 0.45, 0, 12));
  g.add(cylinder(iron, r + 0.012, 0.06, 0, 0.22, 0, 12));
  g.add(cylinder(iron, r + 0.012, 0.06, 0, 0.68, 0, 12));
  return g;
}

function stool(item, w, d, height) {
  const wood = createInkMaterial(item.color, 'wood');
  const g = new THREE.Group();
  g.add(cylinder(wood, 0.16, 0.06, 0, height - 0.03, 0, 10));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = box(wood, 0.05, height - 0.06, 0.05, Math.sin(a) * 0.1, (height - 0.06) / 2, Math.cos(a) * 0.1);
    leg.rotation.z = Math.sin(a) * 0.12;
    leg.rotation.x = -Math.cos(a) * 0.12;
    g.add(leg);
  }
  return g;
}

const BUILDERS = {
  'work-table': workTable,
  stove,
  hearth,
  counter,
  larder,
  barrel,
  stool,
};

function baseId(id) {
  return id.replace(/-\d+$/, '');
}

export function hasFigure(id) {
  return baseId(id) in BUILDERS;
}

export function buildFigure(item, cell) {
  const b = furnitureBox(item, cell);
  return BUILDERS[baseId(item.id)](item, b.w, b.d, b.h);
}
