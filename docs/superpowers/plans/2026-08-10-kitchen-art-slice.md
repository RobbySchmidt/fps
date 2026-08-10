# Kitchen Art Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply art direction B ("toon + hand-drawn grain/hatching") to the kitchen test map: canvas-generated ink textures, composed-primitive furniture, per-room floor/wall surfaces, glowing windows, and a chitin-textured Wanderer.

**Architecture:** A new `inkTextures.js` module generates small tileable canvas textures (wood/stone/iron as greyscale multiply-maps tinted by material color; chitin as a baked-color near-black map). `createInkMaterial(colorHex, family)` wraps them into the existing toon pipeline. Furniture ids map to primitive-composed figure builders with a box fallback; the level descriptor gains `floorPatches`/`wallPatches`/`windows` data consumed by the build layer. The Wanderer's shared skin material switches to chitin, and its hit flash migrates from color-lerp to emissive-lerp.

**Tech Stack:** Three.js (MeshToonMaterial + CanvasTexture), Vite, Vitest. No new dependencies, no image assets on disk.

**Spec:** `docs/superpowers/specs/2026-08-10-kitchen-art-slice-design.md`

## Global Constraints

- No dependencies beyond `three`/`vite`/`vitest`; plain JS ES modules; no TypeScript.
- All colors from `src/rendering/palette.js` (this slice adds `kitchenFloor: 0x4a4d52`, `kitchenWall: 0x62676e`, `moonlight: 0xbfd0e6`).
- No screen-space effects (the film-grain ban stands); textures live on surfaces only.
- **Vitest runs in Node — there is no canvas/document.** `inkTextures.js` must guard: when `typeof document === 'undefined'`, texture creation returns `null` and `createInkMaterial` degrades to exactly `createToonMaterial(colorHex)` behavior. All existing tests (126) must stay green; `wandererFigure.js` IS imported by tests, so this guard is load-bearing.
- Strokes are sparse (≥70% of each tile untouched base) and always a shade of the same hue — subtle is the rule; the Wanderer's darkness silhouette is non-negotiable.
- Collision, pathfinding, AI, tuning, damage numbers: unchanged. The mansion map default path: unchanged.
- Furniture visuals must stay within their footprint bounds; nothing taller than 2.8m (WALL_HEIGHT is 3).
- Run `npm test` after every task; `npm run build` where noted. Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Ink texture generator + `createInkMaterial`

**Files:**
- Create: `src/rendering/inkTextures.js`
- Modify: `src/rendering/toonMaterial.js` (append `createInkMaterial`; do not touch existing exports)
- Modify: `src/rendering/palette.js` (append the three new keys)
- Test: none new (canvas module; the Node guard is exercised implicitly by the whole suite importing `toonMaterial.js`)

**Interfaces:**
- Consumes: `createToonGradientMap` pattern already in `toonMaterial.js`.
- Produces:
  - `createInkTexture(family)` → `THREE.CanvasTexture | null` (null when no canvas). Families: `'wood' | 'stone' | 'iron'` (greyscale multiply maps) and `'chitin'` (baked-color map). Cached per family.
  - `createInkMaterial(colorHex, family)` → `MeshToonMaterial`. For wood/stone/iron: `color = colorHex`, `map = texture`. For chitin: `color = 0xffffff`, `map = texture`. When texture is null (Node): plain `createToonMaterial(colorHex)` equivalent (color = colorHex, no map) for ALL families.

- [ ] **Step 1: Append palette keys**

In `src/rendering/palette.js`, inside `PALETTE` (keep comment style):

```js
  kitchenFloor: 0x4a4d52,     // worn stone, kitchen slice
  kitchenWall: 0x62676e,      // stone-tinted kitchen walls
  moonlight: 0xbfd0e6,        // window glow + spill
  furnitureIronDark: 0x2e3238, // oven doors, hob rings, barrel hoops
  firebox: 0x14171c,          // hearth interior, basin inset
  jarOchre: 0x6a5f4a,         // larder jars
  jarTeal: 0x4a5e5a,
  jarRust: 0x5e4a4a,
```

- [ ] **Step 2: Create `src/rendering/inkTextures.js`**

```js
import * as THREE from 'three';
import { PALETTE } from './palette.js';

// Hand-drawn-style tileable detail maps, generated once per family at runtime.
// wood/stone/iron are GREYSCALE multiply maps (white base, darker strokes) so
// material.color carries the palette tint. chitin bakes real colors: a
// multiply delta on a near-black body would be invisible.
// Node (vitest) has no canvas: createInkTexture returns null there and
// materials degrade to plain toon colors.
const SIZE = 256;
const cache = new Map();

function strokeStyle(ctx, shade, width) {
  ctx.strokeStyle = shade;
  ctx.lineWidth = width;
}

function drawWood(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  strokeStyle(ctx, 'rgba(0,0,0,0.22)', 2);
  for (let i = 0; i < 9; i++) {
    const y = (i + 0.5) * (SIZE / 9);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= SIZE; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / SIZE) * Math.PI * 2 + i * 1.7) * 5);
    }
    ctx.stroke();
  }
  // two knots
  strokeStyle(ctx, 'rgba(0,0,0,0.28)', 1.5);
  for (const [kx, ky] of [[70, 90], [190, 200]]) {
    ctx.beginPath();
    ctx.ellipse(kx, ky, 7, 4, 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStone(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  strokeStyle(ctx, 'rgba(0,0,0,0.20)', 1.5);
  // speckle dashes
  for (let i = 0; i < 60; i++) {
    const x = (i * 97) % SIZE;
    const y = (i * 61 + 23) % SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 4 + (i % 5), y + (i % 3) - 1);
    ctx.stroke();
  }
  // two sparse cross-hatch patches
  strokeStyle(ctx, 'rgba(0,0,0,0.14)', 1);
  for (const [px, py] of [[40, 170], [180, 60]]) {
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(px + i * 6, py);
      ctx.lineTo(px + i * 6 - 18, py + 26);
      ctx.stroke();
    }
  }
}

function drawIron(ctx) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  strokeStyle(ctx, 'rgba(0,0,0,0.16)', 1);
  for (let i = 0; i < 22; i++) {
    const x = (i * 83 + 11) % SIZE;
    const y = (i * 47 + 31) % SIZE;
    const len = 14 + (i % 4) * 8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (i % 3) - 1);
    ctx.stroke();
  }
  // rivet dots near tile edges (tile-safe: same offset both sides)
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  for (let i = 0; i < 8; i++) {
    const p = (i + 0.5) * (SIZE / 8);
    ctx.beginPath();
    ctx.arc(p, 6, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p, SIZE - 6, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChitin(ctx) {
  const base = '#' + PALETTE.wanderer.toString(16).padStart(6, '0');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);
  strokeStyle(ctx, '#232a33', 1.4); // ~2x luminance of base, still near-black
  for (let i = 0; i < 14; i++) {
    const x = (i * 71 + 19) % SIZE;
    const y = (i * 53 + 41) % SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 18, y + 26, x + 8, y + 54);
    ctx.stroke();
  }
  strokeStyle(ctx, '#1c222a', 1);
  for (let i = 0; i < 4; i++) {
    const px = (i * 113 + 37) % SIZE;
    const py = (i * 149 + 61) % SIZE;
    for (let j = 0; j < 5; j++) {
      ctx.beginPath();
      ctx.moveTo(px + j * 5, py);
      ctx.lineTo(px + j * 5 - 12, py + 18);
      ctx.stroke();
    }
  }
}

const DRAW = { wood: drawWood, stone: drawStone, iron: drawIron, chitin: drawChitin };

export function createInkTexture(family) {
  if (typeof document === 'undefined') return null; // Node/vitest: no canvas
  if (cache.has(family)) return cache.get(family);
  const draw = DRAW[family];
  if (!draw) throw new Error(`unknown ink family "${family}"`);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  draw(canvas.getContext('2d'));
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  cache.set(family, texture);
  return texture;
}
```

- [ ] **Step 3: Append `createInkMaterial` to `src/rendering/toonMaterial.js`**

Add `import { createInkTexture } from './inkTextures.js';` and:

```js
// wood/stone/iron: greyscale multiply map, tinted by material.color.
// chitin: baked-color map, white material color (near-black multiply would
// hide both strokes and the hit flash — see the art-slice spec).
// In Node (no canvas) the texture is null and this degrades to a plain
// toon material so the test suite never touches canvas.
export function createInkMaterial(colorHex, family) {
  const texture = createInkTexture(family);
  if (!texture) return createToonMaterial(colorHex);
  if (!sharedGradientMap) sharedGradientMap = createToonGradientMap();
  return new THREE.MeshToonMaterial({
    color: family === 'chitin' ? 0xffffff : colorHex,
    map: texture,
    gradientMap: sharedGradientMap,
  });
}
```

- [ ] **Step 4: Run the suite and build**

Run: `npm test` → 126 passing (the guard keeps Node clean). Run: `npm run build` → succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/rendering/inkTextures.js src/rendering/toonMaterial.js src/rendering/palette.js
git commit -m "feat: canvas-generated ink textures and createInkMaterial"
```

---

### Task 2: Composed-primitive furniture figures

**Files:**
- Create: `src/level/furnitureFigures.js`
- Modify: `src/level/buildFurniture.js`
- Test: none new (Three-only; geometry sanity via build + smoke test)

**Interfaces:**
- Consumes: `furnitureBox(item, cell)` from `src/level/furniture.js`; `createInkMaterial` (Task 1); `createToonMaterial`.
- Produces:
  - `hasFigure(id)` → boolean; `buildFigure(item, cell)` → `THREE.Group` centered at origin, floor at y=0 (caller positions it at the footprint center). Ids normalize by stripping a trailing `-<digits>` suffix (`barrel-2` → `barrel`, `stool-2` → `stool`).
  - `buildFurniture(furniture, cell)` still returns a `THREE.Group`, now with `group.userData.hitMeshes` = flat array of every part mesh (Task 5's main.js wiring consumes this).

- [ ] **Step 1: Create `src/level/furnitureFigures.js`**

```js
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
  g.add(box(iron, 0.3, 0.05, 0.04, 0, 0.62, d * 0.45 + 0.06));   // handle
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
  g.add(box(stone, w + 0.1, 0.08, d + 0.1, 0, 1.55, 0.03));       // mantel shelf
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
```

- [ ] **Step 2: Rewire `src/level/buildFurniture.js`**

```js
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
    if (hasFigure(item.id)) {
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
```

- [ ] **Step 3: Suite + build**

Run: `npm test` → 126 passing. Run: `npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/level/furnitureFigures.js src/level/buildFurniture.js
git commit -m "feat: composed-primitive furniture figures with ink materials"
```

---

### Task 3: Descriptor data — floor/wall patches and windows (+ sanity tests)

**Files:**
- Modify: `src/level/kitchenTest.js`
- Test: `tests/levels.test.js` (append; no existing test modified)

**Interfaces:**
- Consumes: `PALETTE` (Task 1 keys).
- Produces (consumed by Tasks 4 and 6): on the `KITCHEN_TEST` descriptor —
  - `floorPatches: [{ x0, z0, x1, z1, family, color }]`
  - `wallPatches: [{ x0, z0, x1, z1, family, color }]`
  - `windows: [{ x, z, facing }]` with `facing ∈ 'n'|'s'|'e'|'w'` = the direction the window's room-side face points.
  - The `MANSION` descriptor gets none of these (absent = current behavior everywhere).

- [ ] **Step 1: Write the failing tests**

Append to `tests/levels.test.js` (inside or after the `KITCHEN_TEST descriptor` describe; reuse its `parsed`):

```js
describe('KITCHEN_TEST art-slice data', () => {
  const parsed = parseMap(KITCHEN_TEST.mapText, KITCHEN_TEST.cell);

  it('declares kitchen floor and wall patches within map bounds', () => {
    for (const p of [...KITCHEN_TEST.floorPatches, ...KITCHEN_TEST.wallPatches]) {
      expect(p.x0).toBeLessThanOrEqual(p.x1);
      expect(p.z0).toBeLessThanOrEqual(p.z1);
      expect(p.x0).toBeGreaterThanOrEqual(0);
      expect(p.z0).toBeGreaterThanOrEqual(0);
      expect(p.x1).toBeLessThan(parsed.cols);
      expect(p.z1).toBeLessThan(parsed.rows);
      expect(typeof p.color).toBe('number');
      expect(['wood', 'stone', 'iron']).toContain(p.family);
    }
  });

  it('places every window on a wall cell', () => {
    expect(KITCHEN_TEST.windows.length).toBeGreaterThan(0);
    for (const w of KITCHEN_TEST.windows) {
      expect(parsed.wallSet.has(`${w.x},${w.z}`)).toBe(true);
      expect(['n', 's', 'e', 'w']).toContain(w.facing);
    }
  });

  it('gives the mansion no art-slice data', () => {
    expect(MANSION.floorPatches).toBeUndefined();
    expect(MANSION.windows).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/levels.test.js`
Expected: FAIL — `floorPatches` undefined.

- [ ] **Step 3: Implement**

In `src/level/kitchenTest.js`, add to the `KITCHEN_TEST` export (after `furniture`):

```js
  // Art slice: kitchen room gets stone floor + stone-tinted walls; the
  // dining stub keeps defaults, so one walk shows before/after.
  floorPatches: [
    { x0: 2, z0: 2, x1: 17, z1: 11, family: 'stone', color: PALETTE.kitchenFloor },
  ],
  wallPatches: [
    { x0: 1, z0: 1, x1: 18, z1: 12, family: 'stone', color: PALETTE.kitchenWall },
  ],
  // Wall-cell windows: two on the north wall (face south into the room),
  // two on the west wall (face east) — matches the approved room mockup.
  windows: [
    { x: 9, z: 1, facing: 's' },
    { x: 10, z: 1, facing: 's' },
    { x: 1, z: 8, facing: 'e' },
    { x: 1, z: 9, facing: 'e' },
  ],
```

- [ ] **Step 4: Full suite**

Run: `npm test` → 129 passing (126 + 3).

- [ ] **Step 5: Commit**

```bash
git add src/level/kitchenTest.js tests/levels.test.js
git commit -m "feat: kitchen-test art data — surface patches and windows"
```

---

### Task 4: Build layer — surface patches and window builder

**Files:**
- Modify: `src/level/buildGreybox.js`
- Create: `src/level/buildWindows.js`
- Test: none new (Three-only build modules)

**Interfaces:**
- Consumes: patch/window shapes from Task 3; `createInkMaterial` (Task 1).
- Produces:
  - `buildGreybox(parsed, cell = CELL, { floorPatches = [], wallPatches = [] } = {})` — third argument optional; omitted = today's output exactly.
  - `buildWindows(windows, cell = CELL)` → `THREE.Group` (empty group for `[]`).

- [ ] **Step 1: Patches in `buildGreybox`**

Modify `src/level/buildGreybox.js`:
- New import: `import { createInkMaterial } from '../rendering/toonMaterial.js';`
- Signature: `export function buildGreybox(parsed, cell = CELL, { floorPatches = [], wallPatches = [] } = {}) {`
- Wall materials: before the wall loop, build one material per wall patch (`const patchMats = wallPatches.map((p) => createInkMaterial(p.color, p.family));`). Inside the loop, pick the material: 

```js
  const inPatch = (p, c, r) => c >= p.x0 && c <= p.x1 && r >= p.z0 && r <= p.z1;
  for (const { c, r } of parsed.walls) {
    const patchIndex = wallPatches.findIndex((p) => inPatch(p, c, r));
    const wall = new THREE.Mesh(wallGeo, patchIndex >= 0 ? patchMats[patchIndex] : wallMat);
    wall.position.set(c * cell, WALL_HEIGHT / 2, r * cell);
    group.add(wall);
  }
```

- Floor patches: after the base floor/ceiling are added:

```js
  for (const p of floorPatches) {
    const pw = (p.x1 - p.x0 + 1) * cell;
    const pd = (p.z1 - p.z0 + 1) * cell;
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(pw, pd),
      createInkMaterial(p.color, p.family),
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(
      ((p.x0 + p.x1) / 2) * cell,
      0.01, // above the base floor: no z-fighting
      ((p.z0 + p.z1) / 2) * cell,
    );
    group.add(patch);
  }
```

- [ ] **Step 2: Create `src/level/buildWindows.js`**

```js
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

export function buildWindows(windows, cell = CELL) {
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

    const light = new THREE.PointLight(PALETTE.moonlight, 2, 4, 1.5);
    light.position.set(x * cell + n.x * (cell / 2 + 0.4), cy, z * cell + n.z * (cell / 2 + 0.4));
    group.add(light);
  }
  return group;
}
```

- [ ] **Step 3: Suite + build**

Run: `npm test` → 129 passing (buildGreybox's third arg is optional; `tests/buildLamps.test.js` and friends untouched). Run: `npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/level/buildGreybox.js src/level/buildWindows.js
git commit -m "feat: per-room surface patches and moonlight windows"
```

---

### Task 5: Wanderer chitin + emissive flash

**Files:**
- Modify: `src/enemy/wandererFigure.js:18` (skin material) and `:114-116` (flash path)
- Test: existing `tests/wandererFigure.test.js` must stay green unmodified

**Interfaces:**
- Consumes: `createInkMaterial` (Task 1; in Node it degrades to a plain toon material, keeping figure tests canvas-free).
- Produces: no interface change — `createWandererFigure()` contract identical.

- [ ] **Step 1: Switch the skin material**

In `src/enemy/wandererFigure.js` line 18:

```js
  const skin = createInkMaterial(PALETTE.wanderer, 'chitin');
```

(update the import from `toonMaterial.js` to bring in `createInkMaterial`; keep `createToonMaterial` only if still used elsewhere in the file — it is not, so replace the import).

- [ ] **Step 2: Migrate the flash from color to emissive**

Replace lines 114-116:

```js
    if (flashAmount > 0) flashAmount = Math.max(0, flashAmount - dt * 6);
    skin.emissive.setHex(0x000000);
    if (flashAmount > 0) skin.emissive.lerp(FLASH_COLOR, flashAmount);
```

Rationale (from the spec): with the chitin map the material color is white in the browser; lerping color toward white would make the flash invisible. Emissive reads identically in both browser and Node fallback. `MeshToonMaterial` has an `emissive` property; `FLASH_COLOR` and the decay rate stay as-is.

- [ ] **Step 3: Suite**

Run: `npx vitest run tests/wandererFigure.test.js` → all green, unmodified. Then `npm test` → 129 passing.

- [ ] **Step 4: Commit**

```bash
git add src/enemy/wandererFigure.js
git commit -m "feat: chitin ink texture on the wanderer, flash via emissive"
```

---

### Task 6: Wire into main.js and verify in-game

**Files:**
- Modify: `src/main.js` (level setup block; shootables in `shoot()`)

**Interfaces:**
- Consumes: `buildGreybox(parsed, cell, { floorPatches, wallPatches })` (Task 4), `buildWindows(windows, cell)` (Task 4), `furnitureGroup.userData.hitMeshes` (Task 2).
- Produces: the running game; no new exports.

- [ ] **Step 1: Level setup**

In `src/main.js`: add `import { buildWindows } from './level/buildWindows.js';` and change the level-build lines to:

```js
const level = buildGreybox(parsed, levelDef.cell, {
  floorPatches: levelDef.floorPatches ?? [],
  wallPatches: levelDef.wallPatches ?? [],
});
scene.add(level);
scene.add(buildLamps(parsed));
const furnitureGroup = buildFurniture(levelDef.furniture, levelDef.cell);
scene.add(furnitureGroup);
scene.add(buildWindows(levelDef.windows ?? [], levelDef.cell));
```

- [ ] **Step 2: Shootables use the flat part-mesh list**

In `shoot()`, replace both uses of `...furnitureGroup.children` with `...furnitureGroup.userData.hitMeshes` (dead and alive branches) — bullets must strike the composed geometry, not the group containers.

- [ ] **Step 3: Suite + build + mansion smoke**

Run: `npm test` → 129 passing. `npm run build` → succeeds.
Run `npm run dev`, open WITHOUT params: mansion renders exactly as before (default args reproduce current output; wanderer is now chitin-textured — the one intended visible change there).

- [ ] **Step 4: Kitchen art smoke test**

Open `http://localhost:5173/?map=kitchen-test` and verify:
- Furniture is composed (table has legs, stove has door/hobs/pipe, larder has jars, barrels have hoops, stools have splayed legs) with visible-but-subtle grain.
- Kitchen floor/walls read as stone and differ from the dining stub.
- Windows glow pale on the north and west walls with a faint light pool.
- Shooting furniture leaves impact sparks on the actual geometry; shooting the Wanderer flashes it white as before.
- The Wanderer reads as a silhouette away from light, ridged up close in lamplight.

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: kitchen art slice wired — patches, windows, figure shootables"
```

---

## Playtest handoff (after Task 6)

The five spec questions, in `?map=kitchen-test`:
1. Does it read as an inked illustration come to life?
2. Does furniture detail hold up at melee distance without breaking the chunky aesthetic?
3. Wanderer: silhouette in darkness, readable ridges in light? (If ridges show in darkness, they're too strong.)
4. Does kitchen-vs-stub prove per-room surfaces?
5. Perf (P overlay) — texture maps + ~5× furniture mesh count.

Tuning levers: stroke opacity/count in `inkTextures.js`, NearestFilter→LinearFilter if strokes moiré at distance, window light intensity/distance in `buildWindows.js`.
