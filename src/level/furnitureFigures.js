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
  const top = createInkMaterial(item.color, 'wood', w / 2, d / 2);
  const g = new THREE.Group();
  g.add(box(top, w, 0.12, d, 0, 0.84, 0));
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
  g.add(box(dark, 0.3, 0.05, 0.04, 0, 0.62, d * 0.45 + 0.02));   // handle
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
  kettle.position.set(0, 1.18, 0);
  g.add(kettle);
  g.add(cylinder(iron, 0.012, 0.1, 0, 1.3, 0, 6)); // link chain: connects hanging bar to kettle top
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

function table(item, w, d, h) {
  const wood = createInkMaterial(item.color, 'wood', Math.max(1, w / 2), Math.max(1, d / 2));
  const g = new THREE.Group();
  const legH = h - 0.06;
  g.add(box(wood, w, 0.06, d, 0, legH + 0.03, 0));
  const lx = Math.max(0.06, w / 2 - 0.1);
  const lz = Math.max(0.06, d / 2 - 0.1);
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    g.add(box(wood, 0.08, legH, 0.08, sx * lx, legH / 2, sz * lz));
  }
  if (Math.max(w, d) >= 2) {
    g.add(box(wood, w - 0.4, 0.12, 0.05, 0, legH - 0.09, d / 2 - 0.12));
    g.add(box(wood, w - 0.4, 0.12, 0.05, 0, legH - 0.09, -(d / 2 - 0.12)));
  }
  return g;
}

function roundTable(item, w, d, h) {
  const wood = createInkMaterial(item.color, 'wood');
  const g = new THREE.Group();
  const r = Math.min(w, d) / 2 - 0.05;
  g.add(cylinder(wood, r, 0.06, 0, h - 0.03, 0, 14));
  g.add(cylinder(wood, 0.09, h - 0.12, 0, (h - 0.12) / 2 + 0.06, 0, 8));
  g.add(cylinder(wood, r * 0.5, 0.06, 0, 0.03, 0, 10));
  return g;
}

function chair(item, w, d, h) {
  const wood = createInkMaterial(item.color, 'wood');
  const g = new THREE.Group();
  const sw = w * 0.8, sd = d * 0.8;
  g.add(box(wood, sw, 0.05, sd, 0, h - 0.025, 0));
  const lx = sw / 2 - 0.04, lz = sd / 2 - 0.04;
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    g.add(box(wood, 0.05, h - 0.05, 0.05, sx * lx, (h - 0.05) / 2, sz * lz));
  }
  g.add(box(wood, sw, 0.5, 0.05, 0, h + 0.25, -lz)); // backrest (visual above collision height)
  return g;
}

function armchair(item, w, d, h) {
  const cloth = createInkMaterial(item.color, 'wood'); // upholstery reads via grain strokes
  const g = new THREE.Group();
  g.add(box(cloth, w * 0.9, 0.45, d * 0.9, 0, 0.225, 0));                  // base + cushion
  g.add(box(cloth, w * 0.9, 0.55, 0.16, 0, 0.6, -(d / 2 - 0.1)));          // high back
  g.add(box(cloth, 0.14, 0.3, d * 0.75, -(w / 2 - 0.08), 0.55, 0));        // arms
  g.add(box(cloth, 0.14, 0.3, d * 0.75, w / 2 - 0.08, 0.55, 0));
  return g;
}

function settee(item, w, d, h) {
  // Stretched armchair along the long axis; works for sofas and the chaise.
  const cloth = createInkMaterial(item.color, 'wood', Math.max(1, Math.max(w, d) / 2), 1);
  const g = new THREE.Group();
  const long = w >= d; // back sits on a long side
  g.add(box(cloth, w * 0.95, 0.42, d * 0.95, 0, 0.21, 0));
  if (long) {
    g.add(box(cloth, w * 0.95, 0.5, 0.14, 0, 0.6, -(d / 2 - 0.08)));
    g.add(box(cloth, 0.14, 0.28, d * 0.8, -(w / 2 - 0.08), 0.55, 0));
    g.add(box(cloth, 0.14, 0.28, d * 0.8, w / 2 - 0.08, 0.55, 0));
  } else {
    g.add(box(cloth, 0.14, 0.5, d * 0.95, -(w / 2 - 0.08), 0.6, 0));
    g.add(box(cloth, w * 0.8, 0.28, 0.14, 0, 0.55, -(d / 2 - 0.08)));
    g.add(box(cloth, w * 0.8, 0.28, 0.14, 0, 0.55, d / 2 - 0.08));
  }
  return g;
}

function bookcase(item, w, d, h) {
  const wood = createInkMaterial(item.color, 'wood', Math.max(1, w / 2), 1);
  const g = new THREE.Group();
  const thin = Math.min(w, d);
  g.add(box(wood, 0.06, 1.9, d, -(w / 2 - 0.03), 0.95, 0));
  g.add(box(wood, 0.06, 1.9, d, w / 2 - 0.03, 0.95, 0));
  g.add(box(wood, w, 0.06, d, 0, 1.87, 0));
  g.add(box(wood, w, 0.06, d, 0, 0.06, 0));
  for (const y of [0.45, 0.95, 1.45]) {
    g.add(box(wood, w - 0.12, 0.045, d * 0.9, 0, y, 0));
    // book rows: chunky varied spines, deterministic by index
    let x = -w / 2 + 0.12;
    let i = 0;
    while (x < w / 2 - 0.16) {
      const bw = 0.05 + ((i * 7) % 4) * 0.02;
      const bh = 0.24 + ((i * 5) % 3) * 0.05;
      const spine = createInkMaterial([PALETTE.rugRed, PALETTE.rugGreen, PALETTE.rugBlue, PALETTE.furnitureWalnut][i % 4], 'wood');
      g.add(box(spine, bw, bh, Math.min(0.22, thin * 0.6), x + bw / 2, y + 0.025 + bh / 2, 0));
      x += bw + 0.015;
      i += 1;
    }
  }
  return g;
}

function cabinet(item, w, d, h) {
  const wood = createInkMaterial(item.color, 'wood', Math.max(1, w / 2), 1);
  const dark = createInkMaterial(PALETTE.furnitureWoodDark, 'wood');
  const g = new THREE.Group();
  g.add(box(wood, w, h - 0.12, d * 0.9, 0, (h - 0.12) / 2 + 0.08, 0));
  g.add(box(wood, w, 0.06, d, 0, h - 0.03, 0)); // top overhangs within footprint
  const doors = Math.max(1, Math.round(w));
  const dw = (w - 0.2) / doors;
  for (let i = 0; i < doors; i++) {
    g.add(box(dark, dw - 0.06, h - 0.5, 0.03, -w / 2 + 0.1 + dw * (i + 0.5), (h - 0.4) / 2 + 0.1, d * 0.45 + 0.01));
  }
  for (const sx of [-1, 1]) g.add(box(dark, 0.08, 0.08, 0.08, sx * (w / 2 - 0.1), 0.04, d * 0.3));
  return g;
}

function rug(item, w, d, h) {
  const cloth = createInkMaterial(item.color, 'wood', Math.max(1, w / 2), Math.max(1, d / 2));
  const g = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), cloth);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = h; // 0.02: above floor patches at 0.01
  g.add(plane);
  return g;
}

function billiardTable(item, w, d) {
  const felt = createInkMaterial(item.color, 'stone', Math.max(1, w / 2), Math.max(1, d / 2));
  const frame = createInkMaterial(PALETTE.furnitureWalnut, 'wood');
  const g = new THREE.Group();
  g.add(box(frame, w - 0.1, 0.22, d - 0.1, 0, 0.75, 0));
  g.add(box(felt, w - 0.3, 0.04, d - 0.3, 0, 0.88, 0));
  g.add(box(frame, w - 0.1, 0.08, 0.1, 0, 0.88, (d - 0.2) / 2));   // rails
  g.add(box(frame, w - 0.1, 0.08, 0.1, 0, 0.88, -(d - 0.2) / 2));
  g.add(box(frame, 0.1, 0.08, d - 0.1, (w - 0.2) / 2, 0.88, 0));
  g.add(box(frame, 0.1, 0.08, d - 0.1, -(w - 0.2) / 2, 0.88, 0));
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    g.add(box(frame, 0.16, 0.66, 0.16, sx * (w / 2 - 0.25), 0.33, sz * (d / 2 - 0.25)));
  }
  return g;
}

function grandPiano(item, w, d) {
  const black = createInkMaterial(item.color, 'iron', Math.max(1, w / 2), 1);
  const g = new THREE.Group();
  g.add(box(black, w * 0.95, 0.4, d * 0.9, 0, 0.75, 0));                    // body
  const lid = box(black, w * 0.9, 0.04, d * 0.85, 0, 1.0, -d * 0.1);
  lid.rotation.x = -0.45;                                                    // open lid
  g.add(lid);
  g.add(box(black, w * 0.7, 0.06, 0.12, 0, 0.62, d / 2 - 0.08));             // keyboard shelf
  for (const [sx, sz] of [[-1, -1], [-1, 1], [1, 0]]) {
    g.add(cylinder(black, 0.06, 0.55, sx * (w / 2 - 0.2), 0.275, sz * (d / 2 - 0.2) || 0, 8));
  }
  return g;
}

function clock(item, w, d, h) {
  const wood = createInkMaterial(item.color, 'wood');
  const face = createInkMaterial(PALETTE.stonePale, 'stone');
  const g = new THREE.Group();
  g.add(box(wood, w * 0.5, h, d * 0.35, 0, h / 2, 0));
  g.add(box(wood, w * 0.6, 0.12, d * 0.4, 0, h - 0.06, 0));
  const dial = cylinder(face, w * 0.16, 0.02, 0, h - 0.3, d * 0.19, 12);
  dial.rotation.x = Math.PI / 2;
  g.add(dial);
  return g;
}

function globe(item, w, d, h) {
  const wood = createInkMaterial(PALETTE.furnitureWalnut, 'wood');
  const sphere = createInkMaterial(item.color, 'stone');
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(Math.min(w, d) * 0.3, 10, 8), sphere);
  ball.position.y = h - 0.35;
  g.add(ball);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = box(wood, 0.05, h - 0.6, 0.05, Math.sin(a) * 0.14, (h - 0.6) / 2, Math.cos(a) * 0.14);
    leg.rotation.z = Math.sin(a) * 0.15;
    leg.rotation.x = -Math.cos(a) * 0.15;
    g.add(leg);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, d) * 0.34, 0.02, 6, 16), wood);
  ring.position.y = h - 0.35;
  ring.rotation.y = 0.4;
  g.add(ring);
  return g;
}

function safe(item, w, d, h) {
  const iron = createInkMaterial(item.color, 'iron');
  const dark = createInkMaterial(PALETTE.furnitureIronDark, 'iron');
  const g = new THREE.Group();
  g.add(box(iron, w * 0.9, h, d * 0.9, 0, h / 2, 0));
  g.add(cylinder(dark, 0.07, 0.04, 0, h * 0.6, d * 0.45).rotateX(Math.PI / 2));
  g.add(box(dark, 0.05, h * 0.7, 0.03, w * 0.38, h / 2, d * 0.45)); // hinge strip
  return g;
}

function pedestal(item, w, d, h) {
  const stone = createInkMaterial(item.color, 'stone');
  const g = new THREE.Group();
  g.add(box(stone, w * 0.8, 0.12, d * 0.8, 0, 0.06, 0));
  g.add(box(stone, w * 0.5, h - 0.3, d * 0.5, 0, (h - 0.3) / 2 + 0.12, 0));
  g.add(box(stone, w * 0.7, 0.08, d * 0.7, 0, h - 0.1, 0));
  const bust = new THREE.Mesh(new THREE.SphereGeometry(w * 0.18, 8, 6), stone);
  bust.position.y = h + 0.12;
  bust.scale.y = 1.3;
  g.add(bust);
  return g;
}

function fern(item, w, d, h) {
  const pot = createInkMaterial(PALETTE.furnitureStoneWarm, 'stone');
  const leaf = createInkMaterial(item.color, 'wood');
  const g = new THREE.Group();
  g.add(cylinder(pot, w * 0.28, 0.32, 0, 0.16, 0, 10));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const blade = box(leaf, 0.08, 0.55, 0.02, Math.sin(a) * 0.12, 0.55, Math.cos(a) * 0.12);
    blade.rotation.z = Math.sin(a) * 0.5;
    blade.rotation.x = -Math.cos(a) * 0.5;
    g.add(blade);
  }
  return g;
}

function armor(item, w, d) {
  const steel = createInkMaterial(item.color, 'iron');
  const g = new THREE.Group();
  g.add(box(steel, w * 0.7, 0.1, d * 0.7, 0, 0.05, 0));                 // plinth
  g.add(box(steel, 0.12, 0.55, 0.14, -0.09, 0.42, 0));                  // legs
  g.add(box(steel, 0.12, 0.55, 0.14, 0.09, 0.42, 0));
  g.add(box(steel, 0.34, 0.5, 0.2, 0, 0.95, 0));                        // cuirass
  g.add(box(steel, 0.2, 0.24, 0.2, 0, 1.35, 0));                        // helm
  g.add(box(steel, 0.09, 0.45, 0.12, -0.24, 0.95, 0));                  // arms
  g.add(box(steel, 0.09, 0.45, 0.12, 0.24, 0.95, 0));
  g.add(cylinder(steel, 0.02, 1.7, 0.34, 0.85, 0, 6));                  // halberd shaft
  g.add(box(steel, 0.04, 0.3, 0.14, 0.34, 1.6, 0));                     // halberd head
  return g;
}

function statueSettee(item, w, d) {
  const cloth = createInkMaterial(item.color, 'wood');
  const stone = createInkMaterial(PALETTE.stonePale, 'stone');
  const g = new THREE.Group();
  const r = Math.min(w, d) / 2 - 0.05;
  g.add(cylinder(cloth, r, 0.45, 0, 0.225, 0, 16));                     // circular seat ring
  g.add(cylinder(stone, r * 0.35, 0.9, 0, 0.9, 0, 10));                 // plinth
  g.add(box(stone, 0.3, 0.6, 0.22, 0, 1.65, 0));                        // figure torso
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), stone);
  head.position.y = 2.05;
  g.add(head);
  return g;
}

function coatStand(item, w, d, h) {
  const wood = createInkMaterial(PALETTE.furnitureWalnut, 'wood');
  const coat = createInkMaterial(item.color, 'wood');
  const g = new THREE.Group();
  g.add(cylinder(wood, 0.04, h, 0, h / 2, 0, 8));
  g.add(cylinder(wood, 0.2, 0.05, 0, 0.025, 0, 8));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(box(wood, 0.04, 0.04, 0.22, Math.sin(a) * 0.12, h - 0.12, Math.cos(a) * 0.12));
  }
  g.add(box(coat, 0.34, 0.75, 0.2, 0.12, h - 0.55, 0.06)); // the draped coat: reads as a figure for a beat
  return g;
}

function staircase(item, w, d, h) {
  const wood = createInkMaterial(item.color, 'wood', Math.max(1, w / 2), 1);
  const dark = createInkMaterial(PALETTE.furnitureWoodDark, 'wood');
  const g = new THREE.Group();
  const steps = 5;
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / steps;
    g.add(box(wood, w - 0.3, 0.12, d / steps, 0, t * (h - 0.2), d / 2 - (i + 0.5) * (d / steps)));
  }
  g.add(box(dark, 0.12, h, 0.12, -(w / 2 - 0.1), h / 2, d / 2 - 0.1)); // newel posts
  g.add(box(dark, 0.12, h, 0.12, w / 2 - 0.1, h / 2, d / 2 - 0.1));
  const rope = cylinder(dark, 0.025, w - 0.3, 0, 0.8, d / 2 - 0.05, 6);
  rope.rotation.z = Math.PI / 2;
  g.add(rope);                                                           // roped off: inert this milestone
  return g;
}

function hatch(item, w, d, h) {
  const wood = createInkMaterial(item.color, 'wood');
  const iron = createInkMaterial(PALETTE.furnitureIronDark, 'iron');
  const g = new THREE.Group();
  g.add(box(wood, w * 0.95, h, d * 0.95, 0, h / 2, 0));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 6, 12), iron);
  ring.position.set(0, h + 0.02, d * 0.25);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
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
  table,
  'round-table': roundTable,
  chair,
  armchair,
  settee,
  bookcase,
  cabinet,
  rug,
  fireplace: hearth,
  'billiard-table': billiardTable,
  'grand-piano': grandPiano,
  clock,
  globe,
  safe,
  pedestal,
  fern,
  armor,
  'statue-settee': statueSettee,
  'coat-stand': coatStand,
  staircase,
  hatch,
};

function baseId(id) {
  return id.replace(/-\d+$/, '');
}

const figureKey = (item) => item.figure ?? baseId(item.id);

export function hasFigure(item) {
  return Object.hasOwn(BUILDERS, figureKey(item));
}

export function buildFigure(item, cell) {
  const b = furnitureBox(item, cell);
  return BUILDERS[figureKey(item)](item, b.w, b.d, b.h);
}

export const FIGURE_NAMES = () => Object.keys(BUILDERS);
