# M4a Ground Floor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the greybox mansion with the blueprint ground floor — 58×47 at 1m cells, 11 furnished spaces, ink art everywhere — as the default level, with the engine prerequisites (door validation, material cache, wall merging, static shootables) that make it correct and fast.

**Architecture:** A new `src/level/groundFloor.js` data module holds the map text, furniture manifest, patches, windows, and wall props; `MANSION` in `levels.js` points at it and `CELL` becomes 1. Furniture items name their builder via a `figure` field; two waves of new composed-primitive builders cover the manifest with the box fallback as safety net. `buildGreybox` merges wall cells into one mesh per material; `createInkMaterial` gains a keyed cache; `main.js` builds one static shootables list.

**Tech Stack:** Three.js (incl. `BufferGeometryUtils` from `three/addons` — ships with three, no new dependency), Vite, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-10-m4a-ground-floor-design.md`

## Global Constraints

- No dependencies beyond `three`/`vite`/`vitest`; plain JS ES modules; no TypeScript; no image assets on disk.
- All colors from `src/rendering/palette.js` (this plan adds exactly 23 keys, Task 6).
- Furniture kinds: `low` blocks movement not sight, `tall` blocks both, `decor` no collision (rugs only). Chairs/stools seat-height 0.45. Blocking furniture must never cover a doorway (`D`) cell — enforced in code by Task 1.
- Furniture visuals stay inside the footprint in x/z; nothing above 2.8m (WALL_HEIGHT 3). Seat-backs and statues may exceed the item's collision height — that is visual only and allowed (precedent: globe).
- Vitest runs in Node (no canvas): every module the suite imports must stay Node-safe (the `createInkTexture` guard already handles this; new code must not import canvas at module scope).
- The `?map=kitchen-test` slice must keep working unchanged (its own descriptor, its lit windows, its manifest).
- All existing tests stay green except the specific `tests/mapData.test.js` updates in Task 6 (the greybox `MAP` constant is deleted there); no other existing test is modified.
- Run `npm test` after every task; `npm run build` where noted. Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Door cells in `parseMap` + doorway validation in `expandFurniture`

**Files:**
- Modify: `src/level/mapData.js` (parseMap)
- Modify: `src/level/furniture.js` (expandFurniture)
- Test: `tests/mapData.test.js`, `tests/furniture.test.js` (append only)

**Interfaces:**
- Consumes: existing `parseMap(text, cell)`, `expandFurniture(items, bounds)`.
- Produces: parse result gains `doorCells: Set<"c,r">` (from `D` chars — still walkable floor, now recorded). `expandFurniture(items, { wallSet, cols, rows, doorCells = new Set() })` throws when a `low` or `tall` footprint covers a door cell (message contains the item id); `decor` on doors is allowed (runner rugs pass through doorways).

- [ ] **Step 1: Write the failing tests**

Append to `tests/mapData.test.js`:

```js
describe('door cells', () => {
  it('records D cells as walkable doorways', () => {
    const parsed = parseMap('#####\n#S.D#\n#####', 1);
    expect(parsed.doorCells.has('3,1')).toBe(true);
    expect(parsed.wallSet.has('3,1')).toBe(false);
  });

  it('returns an empty doorCells set when the map has no D', () => {
    expect(parseMap('###\n#S#\n###', 1).doorCells.size).toBe(0);
  });
});
```

Append to `tests/furniture.test.js` (inside the `expandFurniture` describe):

```js
  it('throws when blocking furniture covers a doorway cell', () => {
    const withDoor = { ...bounds, doorCells: new Set(['2,3']) };
    expect(() =>
      expandFurniture([{ id: 'door-blocker', kind: 'low', x0: 2, z0: 3, x1: 2, z1: 3 }], withDoor),
    ).toThrow(/door-blocker/);
  });

  it('allows decor (rugs) on doorway cells', () => {
    const withDoor = { ...bounds, doorCells: new Set(['2,3']) };
    const { moveCells } = expandFurniture(
      [{ id: 'runner', kind: 'decor', x0: 2, z0: 3, x1: 2, z1: 3 }],
      withDoor,
    );
    expect(moveCells.size).toBe(0);
  });
```

- [ ] **Step 2: Run to verify failures**

Run: `npx vitest run tests/mapData.test.js tests/furniture.test.js`
Expected: FAIL — `doorCells` undefined; door-blocker does not throw.

- [ ] **Step 3: Implement**

`src/level/mapData.js` — in `parseMap`, add alongside the other collections:

```js
  const doorCells = new Set();
```
```js
      } else if (ch === 'D') {
        doorCells.add(`${c},${r}`);
      }
```
and add `doorCells` to the returned object.

`src/level/furniture.js` — signature `expandFurniture(items, { wallSet, cols, rows, doorCells = new Set() })`; inside the per-cell loop, after the wall check:

```js
        if ((item.kind === 'low' || item.kind === 'tall') && doorCells.has(key)) {
          throw new Error(`furniture "${item.id}" blocks a doorway at ${x},${z}`);
        }
```

- [ ] **Step 4: Full suite**

Run: `npm test` — everything green (existing callers omit `doorCells`, defaulting to empty).

- [ ] **Step 5: Commit**

```bash
git add src/level/mapData.js src/level/furniture.js tests/mapData.test.js tests/furniture.test.js
git commit -m "feat: record doorway cells and reject furniture that blocks them"
```

---

### Task 2: Keyed material cache in `createInkMaterial`

**Files:**
- Modify: `src/rendering/toonMaterial.js`
- Test: `tests/toonMaterial.test.js` (append only)

**Interfaces:**
- Consumes: existing `createInkMaterial(colorHex, family, repeatU = 1, repeatV = 1)`.
- Produces: same signature; same arguments now return the SAME material instance (cache key `colorHex|family|repeatU|repeatV`). Works identically on the Node fallback path. Note: the Wanderer's chitin material mutates `emissive` per frame — cached sharing is safe because there is exactly one Wanderer; add that as a code comment.

- [ ] **Step 1: Write the failing tests**

Append to `tests/toonMaterial.test.js` (import `createInkMaterial` alongside the existing imports):

```js
describe('createInkMaterial cache', () => {
  it('returns the same instance for identical arguments', () => {
    const a = createInkMaterial(0x5e4a36, 'wood', 2, 3);
    const b = createInkMaterial(0x5e4a36, 'wood', 2, 3);
    expect(a).toBe(b);
  });

  it('returns distinct instances when any argument differs', () => {
    const a = createInkMaterial(0x5e4a36, 'wood', 1, 1);
    expect(createInkMaterial(0x5e4a36, 'stone', 1, 1)).not.toBe(a);
    expect(createInkMaterial(0x6b5138, 'wood', 1, 1)).not.toBe(a);
    expect(createInkMaterial(0x5e4a36, 'wood', 2, 1)).not.toBe(a);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/toonMaterial.test.js` — FAIL (new instances every call today).

- [ ] **Step 3: Implement**

In `src/rendering/toonMaterial.js`, wrap the existing `createInkMaterial` body:

```js
const inkMaterialCache = new Map();

// Shared instances: ~70 manifest pieces × parts would otherwise mint hundreds
// of materials. Sharing is safe — nothing mutates furniture materials, and the
// one per-frame mutator (the Wanderer's chitin emissive flash) has exactly one
// consumer in the scene.
export function createInkMaterial(colorHex, family, repeatU = 1, repeatV = 1) {
  const key = `${colorHex}|${family}|${repeatU}|${repeatV}`;
  if (inkMaterialCache.has(key)) return inkMaterialCache.get(key);
  const material = buildInkMaterial(colorHex, family, repeatU, repeatV);
  inkMaterialCache.set(key, material);
  return material;
}
```

where `buildInkMaterial` is the current function body renamed (module-private).

- [ ] **Step 4: Full suite + build**

Run: `npm test` and `npm run build` — green/success.

- [ ] **Step 5: Commit**

```bash
git add src/rendering/toonMaterial.js tests/toonMaterial.test.js
git commit -m "perf: cache ink materials by color, family, and repeat"
```

---

### Task 3: Merged wall geometry in `buildGreybox`

**Files:**
- Modify: `src/level/buildGreybox.js`
- Test: `tests/buildGreybox.test.js` (new file)

**Interfaces:**
- Consumes: `mergeGeometries` from `three/addons/utils/BufferGeometryUtils.js` (ships inside three).
- Produces: `buildGreybox(parsed, cell, opts)` unchanged signature; wall cells now become ONE merged mesh per material (1 default + 1 per wall patch that matches at least one cell) instead of one mesh per cell. Floor, ceiling, and floor patches unchanged. Shot impacts keep working (`hit.point` / `hit.face.normal` exist on merged geometry).

- [ ] **Step 1: Write the failing test**

Create `tests/buildGreybox.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseMap } from '../src/level/mapData.js';
import { buildGreybox } from '../src/level/buildGreybox.js';

const MAP = `
#######
#S....#
#.....#
#######
`;

describe('buildGreybox wall merging', () => {
  it('merges all default walls into a single mesh', () => {
    const group = buildGreybox(parseMap(MAP, 1), 1);
    // 1 merged wall mesh + floor + ceiling
    expect(group.children).toHaveLength(3);
  });

  it('adds one merged mesh per matching wall patch', () => {
    const group = buildGreybox(parseMap(MAP, 1), 1, {
      wallPatches: [{ x0: 0, z0: 0, x1: 2, z1: 3, family: 'stone', color: 0x62676e }],
    });
    // 2 wall meshes (patched + default) + floor + ceiling
    expect(group.children).toHaveLength(4);
  });

  it('keeps floor patches as separate planes', () => {
    const group = buildGreybox(parseMap(MAP, 1), 1, {
      floorPatches: [{ x0: 1, z0: 1, x1: 5, z1: 2, family: 'wood', color: 0x52432f }],
    });
    expect(group.children).toHaveLength(4); // walls + floor + ceiling + 1 patch
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/buildGreybox.test.js` — FAIL (today: one mesh per wall cell).

- [ ] **Step 3: Implement**

In `src/level/buildGreybox.js`, add `import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';` and replace the per-cell wall loop with:

```js
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
```

(The shared `wallGeo` constant and the old loop go away; keep the wall-patch repeat values as written — they carry Task 2's cache benefits.)

- [ ] **Step 4: Full suite + build**

Run: `npm test`, `npm run build` — green/success.

- [ ] **Step 5: Commit**

```bash
git add src/level/buildGreybox.js tests/buildGreybox.test.js
git commit -m "perf: merge wall cells into one mesh per material"
```

---

### Task 4: `figure` field + builder wave 1 (seating, tables, shelving)

**Files:**
- Modify: `src/level/furnitureFigures.js` (append builders; extend resolution)
- Modify: `src/level/buildFurniture.js` (resolution only)
- Test: none new (Three-only; Task 6's registry test covers the mapping)

**Interfaces:**
- Consumes: existing helpers `box`, `cylinder`, `createInkMaterial`, `furnitureBox`, `PALETTE`.
- Produces: resolution honors `item.figure`: in `furnitureFigures.js`, `const figureKey = (item) => item.figure ?? baseId(item.id);` with `hasFigure(item)` and `buildFigure(item, cell)` now taking the ITEM (not the id) — update `buildFurniture` accordingly (`hasFigure(item)`, `buildFigure(item, cell)`). Export `FIGURE_NAMES = Object.keys(BUILDERS)` for Task 6's sanity test. New builders registered: `table`, `round-table`, `chair`, `armchair`, `settee`, `bookcase`, `cabinet`, `rug`.

- [ ] **Step 1: Extend resolution**

In `src/level/furnitureFigures.js`:

```js
const figureKey = (item) => item.figure ?? baseId(item.id);

export function hasFigure(item) {
  return Object.hasOwn(BUILDERS, figureKey(item));
}

export function buildFigure(item, cell) {
  const b = furnitureBox(item, cell);
  return BUILDERS[figureKey(item)](item, b.w, b.d, b.h);
}

export const FIGURE_NAMES = () => Object.keys(BUILDERS);
```

In `src/level/buildFurniture.js` change `hasFigure(item.id)` → `hasFigure(item)` (the `buildFigure(item, cell)` call is already item-based).

- [ ] **Step 2: Add the wave-1 builders**

Append to `src/level/furnitureFigures.js` and register each in `BUILDERS`:

```js
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
```

Register: `table`, `'round-table': roundTable`, `chair`, `armchair`, `settee`, `bookcase`, `cabinet`, `rug` in `BUILDERS`.

- [ ] **Step 3: Full suite + build**

Run: `npm test` (green — resolution change is signature-compatible at call sites; kitchen ids still resolve via `baseId`), `npm run build`.

- [ ] **Step 4: Commit**

```bash
git add src/level/furnitureFigures.js src/level/buildFurniture.js
git commit -m "feat: figure field resolution and wave-1 furniture builders"
```

---

### Task 5: Builder wave 2 (specials + scenery)

**Files:**
- Modify: `src/level/furnitureFigures.js` (append only)
- Test: none new (registry covered by Task 6)

**Interfaces:**
- Consumes: same helpers as Task 4.
- Produces: builders registered for `fireplace` (alias of the existing `hearth` builder), `billiard-table`, `grand-piano`, `clock`, `globe`, `safe`, `pedestal`, `fern`, `armor`, `statue-settee`, `coat-stand`, `staircase`, `hatch`.

- [ ] **Step 1: Add the builders**

```js
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
```

Register in `BUILDERS`: `fireplace: hearth` (alias), `'billiard-table': billiardTable`, `'grand-piano': grandPiano`, `clock`, `globe`, `safe`, `pedestal`, `fern`, `armor`, `'statue-settee': statueSettee`, `'coat-stand': coatStand`, `staircase`, `hatch`.

- [ ] **Step 2: Full suite + build**

Run: `npm test`, `npm run build`.

- [ ] **Step 3: Commit**

```bash
git add src/level/furnitureFigures.js
git commit -m "feat: wave-2 furniture builders — specials and stair scenery"
```

---

### Task 6: Ground-floor data module, palette, MANSION swap, CELL = 1

**Files:**
- Create: `src/level/groundFloor.js`
- Modify: `src/rendering/palette.js` (append 23 keys), `src/level/levels.js`, `src/level/mapData.js` (`CELL = 1`, delete `MAP`)
- Test: `tests/levels.test.js` (append), `tests/mapData.test.js` (update ONLY the three greybox-MAP tests)

**Interfaces:**
- Consumes: everything above; `FIGURE_NAMES()` from Task 4.
- Produces: `GROUND_FLOOR` descriptor `{ name: 'mansion', mapText, cell: 1, furniture, floorPatches, wallPatches, windows, wallProps }`; `MANSION` in `levels.js` re-exported as `GROUND_FLOOR`; `CELL` is `1` and `MAP` is gone.

- [ ] **Step 1: Palette keys**

Append inside `PALETTE` (comment style as the file):

```js
  furnitureOak: 0x8a6a48,      furnitureWalnut: 0x6b5138,  furnitureWoodDark: 0x5e4632,
  furnitureStoneWarm: 0x6b5a42, upholsteryDark: 0x4e4436,  velvet: 0x5e4a6e,
  velvetRose: 0x6a4a5e,        feltGreen: 0x2e5e42,        pianoBlack: 0x2e2a26,
  fernGreen: 0x3e5e3e,         sofaGreen: 0x4a5e3e,        armorSteel: 0x5a5e66,
  stonePale: 0x6b6355,         rugRed: 0x7a3b3b,           rugGreen: 0x3b5e4a,
  rugBlue: 0x3b4a5e,           rugViolet: 0x5e3b6e,        rugBrown: 0x4a3b3b,
  floorParquet: 0x52432f,      floorParquetDark: 0x463a2c, hallMarble: 0x565963,
  canvasDark: 0x3a3630,        mirrorGlass: 0x77808e,
```

(Reformat one key per line to match the file's existing style if it uses that.)

- [ ] **Step 2: Write the failing descriptor tests**

Append to `tests/levels.test.js` (add `FIGURE_NAMES` import from `../src/level/furnitureFigures.js` and `hasFigure`; note both are Node-safe):

```js
describe('GROUND_FLOOR (mansion) descriptor', () => {
  const parsed = parseMap(MANSION.mapText, MANSION.cell);

  it('is the 58x47 blueprint at 1m cells', () => {
    expect(MANSION.cell).toBe(1);
    expect(parsed.cols).toBe(58);
    expect(parsed.rows).toBe(47);
  });

  it('has spawn, wanderer spawn, and 11 lamps where the blueprint puts them', () => {
    expect(parsed.spawn).toEqual({ x: 30, z: 41 });
    expect(parsed.wandererSpawn).toEqual({ x: 41, z: 2 });
    expect(parsed.lamps).toHaveLength(11);
  });

  it('expands all furniture cleanly (no wall or doorway overlap)', () => {
    const { moveCells, sightCells } = expandFurniture(MANSION.furniture, {
      wallSet: parsed.wallSet,
      cols: parsed.cols,
      rows: parsed.rows,
      doorCells: parsed.doorCells,
    });
    expect(moveCells.size).toBeGreaterThan(100);
    expect(sightCells.size).toBeGreaterThan(30);
  });

  it('keeps both spawns off blocking furniture', () => {
    const { moveCells } = expandFurniture(MANSION.furniture, {
      wallSet: parsed.wallSet, cols: parsed.cols, rows: parsed.rows, doorCells: parsed.doorCells,
    });
    expect(moveCells.has('30,41')).toBe(false);
    expect(moveCells.has('41,2')).toBe(false);
  });

  it('maps every furniture piece to an existing figure builder', () => {
    for (const item of MANSION.furniture) {
      expect(hasFigure(item), `no builder for ${item.id}`).toBe(true);
    }
  });

  it('puts every window and wall prop on a wall cell', () => {
    for (const wdw of MANSION.windows) {
      expect(parsed.wallSet.has(`${wdw.x},${wdw.z}`)).toBe(true);
    }
    for (const p of MANSION.wallProps) {
      const xs = p.x !== undefined ? [p.x, p.x] : [p.x0, p.x1];
      const zs = p.z !== undefined ? [p.z, p.z] : [p.z0, p.z1];
      for (let x = xs[0]; x <= xs[1]; x++) for (let z = zs[0]; z <= zs[1]; z++) {
        expect(parsed.wallSet.has(`${x},${z}`), `${p.type} off-wall at ${x},${z}`).toBe(true);
      }
    }
  });

  it('keeps all patches inside the map', () => {
    for (const p of [...MANSION.floorPatches, ...MANSION.wallPatches]) {
      expect(p.x0).toBeLessThanOrEqual(p.x1);
      expect(p.z0).toBeLessThanOrEqual(p.z1);
      expect(p.x1).toBeLessThan(parsed.cols);
      expect(p.z1).toBeLessThan(parsed.rows);
    }
  });
});
```

- [ ] **Step 3: Update the three greybox tests in `tests/mapData.test.js`**

Delete the `MAP` import and replace exactly these three tests (leave all others untouched):
- `'ships a valid mansion MAP'` and `'mansion MAP has six lamps'` — delete both (the descriptor tests above supersede them).
- `'returns null wandererSpawn when the map has no W'` — replace the body with `expect(parseMap(SMALL).wandererSpawn).toBeNull();` (the `SMALL` fixture at the top of the file).

- [ ] **Step 4: Create `src/level/groundFloor.js`**

The module exports `GROUND_FLOOR`. Author the map as a template literal — **the exact 47 rows below, byte for byte** (row 0 and row 46 are full `#` rows so `parseMap`'s empty-line trimming can never shift coordinates; this text was validated against the engine's parse logic: 47 rows, 58 cols, spawn {30,41}, wanderer {41,2} on the THIRD line, 11 lamps, 74 door cells, 670 walls):

```
##########################################################
 ######################################################
 #................##......##........##...W............#
 #................##......##........##................#
 #................##......##........##................#
 #................##......##........##................#
 #.......L........##......##........##.......L........#
 #................##......##........##................#
 #................##......##........##................#
 #................##......##........##................#
 #................####DD#######DD#####................#
 #................DD##DD#     #DD#   #................#
 #####DD##########DD##DD#######DD###########DD#########
 #####DD##########DD..............................L...#
 #................##..................................#
 #................############DD###############DD######
 #................#      ##........##    ######DD########
 #................#     ##..........##   #..............#
 #................#    ##............##  #..............#
 #.......L........#   ##..............## #..............#
 #................#  ##................###..............#
 #................#  #..................##......L.......#
 #................####..................##..............#
 #................DDDD..................DD..............#
 #................DDDD....L........L....DD..............#
 #................####..................##..............#
 #####DD###########  #..................##..............#
 #####DD##############..................##..............#
 #..................###................###..............#
 #..................# ##..............## #......L.......#
 #..................#  ##............##  #..............#
 #..................#   ##..........##   #..............#
 #..................#    ##........##    #..............#
 #.......L..........#     ####DD####     ######DD########
 #..................#   ######DD######   ######DD########
 #..................#   #............#   #..............#
 #..................#   #............#   #..............#
 #..................#####............#####..............#
 #..................DDDDD............DDDDD..............#
 #..................DDDDD.....L......DDDDD......L.......#
 ########################............#####..............#
                        #.....S......#   #..............#
                        #............#   #..............#
                        ##############   #..............#
                                         #..............#
                                         ################
##########################################################
```

**CAUTION (the kitchen-slice lesson): copy this map EXACTLY — a prior task
"cleaned up" a map instead of copying it and it cost a fix round.** After
authoring, the Step 6 tests verify spawn/wanderer/lamp coordinates against
it — if any coordinate assert fails, the map was mistyped; fix the map, not
the test.

Then the data arrays. `furniture` = the kitchen block copied verbatim from
`src/level/kitchenTest.js`'s `FURNITURE` array (copy the nine objects
as-is; their ids resolve to builders via `baseId`), followed by everything
below, byte for byte:

```js
// --- study (dark pressure room, no lamp) ---
{ id: 'study-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 29, z0: 3, x1: 33, z1: 6, color: PALETTE.rugBrown },
{ id: 'study-desk', kind: 'low', figure: 'table', x0: 30, z0: 4, x1: 32, z1: 5, color: PALETTE.furnitureWood },
{ id: 'study-desk-chair', kind: 'low', height: 0.45, figure: 'chair', x0: 31, z0: 6, x1: 31, z1: 6, color: PALETTE.furnitureWalnut },
{ id: 'study-shelves', kind: 'tall', figure: 'bookcase', x0: 28, z0: 2, x1: 28, z1: 4, color: PALETTE.furnitureWood },
{ id: 'study-shelves-2', kind: 'tall', figure: 'bookcase', x0: 35, z0: 2, x1: 35, z1: 4, color: PALETTE.furnitureWood },
{ id: 'study-safe', kind: 'low', height: 1, figure: 'safe', x0: 35, z0: 8, x1: 35, z1: 8, color: PALETTE.furnitureIron },
{ id: 'study-armchair', kind: 'low', figure: 'armchair', x0: 29, z0: 7, x1: 29, z1: 7, color: PALETTE.upholsteryDark },
{ id: 'study-candle-table', kind: 'low', height: 0.45, figure: 'table', x0: 28, z0: 7, x1: 28, z1: 7, color: PALETTE.furnitureWalnut },
// --- billiard (Wanderer den, single exit) ---
{ id: 'billiard-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 42, z0: 5, x1: 49, z1: 8, color: PALETTE.rugGreen },
{ id: 'billiard-table', kind: 'low', figure: 'billiard-table', x0: 44, z0: 6, x1: 47, z1: 7, color: PALETTE.feltGreen },
{ id: 'billiard-stool', kind: 'low', height: 0.45, figure: 'stool', x0: 42, z0: 7, x1: 42, z1: 7, color: PALETTE.furnitureWalnut },
{ id: 'billiard-stool-2', kind: 'low', height: 0.45, figure: 'stool', x0: 49, z0: 6, x1: 49, z1: 6, color: PALETTE.furnitureWalnut },
{ id: 'billiard-bar-cabinet', kind: 'tall', figure: 'cabinet', x0: 50, z0: 2, x1: 51, z1: 2, color: PALETTE.furnitureWood },
{ id: 'billiard-trophy-case', kind: 'tall', figure: 'cabinet', x0: 53, z0: 5, x1: 53, z1: 7, color: PALETTE.furnitureWood },
{ id: 'billiard-armchair', kind: 'low', figure: 'armchair', x0: 50, z0: 9, x1: 50, z1: 9, color: PALETTE.upholsteryDark },
{ id: 'billiard-armchair-2', kind: 'low', figure: 'armchair', x0: 52, z0: 9, x1: 52, z1: 9, color: PALETTE.upholsteryDark },
{ id: 'billiard-smoke-table', kind: 'low', height: 0.45, figure: 'table', x0: 51, z0: 9, x1: 51, z1: 9, color: PALETTE.furnitureWalnut },
// --- drawing room ---
{ id: 'drawing-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 46, z0: 37, x1: 51, z1: 42, color: PALETTE.rugViolet },
{ id: 'drawing-tea-table', kind: 'low', height: 0.45, figure: 'table', x0: 48, z0: 39, x1: 49, z1: 40, color: PALETTE.furnitureWalnut },
{ id: 'drawing-settee', kind: 'low', figure: 'settee', x0: 47, z0: 37, x1: 50, z1: 37, color: PALETTE.velvet },
{ id: 'drawing-settee-2', kind: 'low', figure: 'settee', x0: 47, z0: 42, x1: 50, z1: 42, color: PALETTE.velvet },
{ id: 'drawing-chaise-longue', kind: 'low', figure: 'settee', x0: 52, z0: 42, x1: 54, z1: 42, color: PALETTE.velvet },
{ id: 'drawing-secretary-desk', kind: 'tall', figure: 'cabinet', x0: 52, z0: 35, x1: 53, z1: 35, color: PALETTE.furnitureWood },
{ id: 'drawing-drinks-cabinet', kind: 'tall', figure: 'cabinet', x0: 43, z0: 35, x1: 44, z1: 35, color: PALETTE.furnitureWood },
{ id: 'drawing-fern', kind: 'low', figure: 'fern', x0: 44, z0: 43, x1: 44, z1: 43, color: PALETTE.fernGreen },
// --- library ---
{ id: 'library-book-stack-a', kind: 'tall', figure: 'bookcase', x0: 45, z0: 20, x1: 46, z1: 23, color: PALETTE.furnitureWood },
{ id: 'library-book-stack-b', kind: 'tall', figure: 'bookcase', x0: 45, z0: 26, x1: 46, z1: 29, color: PALETTE.furnitureWood },
{ id: 'library-wall-shelves', kind: 'tall', figure: 'bookcase', x0: 42, z0: 18, x1: 42, z1: 21, color: PALETTE.furnitureWood },
{ id: 'library-wall-shelves-2', kind: 'tall', figure: 'bookcase', x0: 42, z0: 27, x1: 42, z1: 31, color: PALETTE.furnitureWood },
{ id: 'library-wall-shelves-3', kind: 'tall', figure: 'bookcase', x0: 42, z0: 17, x1: 46, z1: 17, color: PALETTE.furnitureWood },
{ id: 'library-wall-shelves-4', kind: 'tall', figure: 'bookcase', x0: 50, z0: 17, x1: 55, z1: 17, color: PALETTE.furnitureWood },
{ id: 'library-reading-table', kind: 'low', figure: 'table', x0: 50, z0: 20, x1: 52, z1: 21, color: PALETTE.furnitureOak },
{ id: 'library-globe', kind: 'low', height: 1.2, figure: 'globe', x0: 53, z0: 20, x1: 53, z1: 20, color: PALETTE.furnitureWalnut },
{ id: 'library-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 50, z0: 24, x1: 53, z1: 27, color: PALETTE.rugBlue },
{ id: 'library-armchair', kind: 'low', figure: 'armchair', x0: 51, z0: 24, x1: 51, z1: 24, color: PALETTE.upholsteryDark },
{ id: 'library-armchair-2', kind: 'low', figure: 'armchair', x0: 52, z0: 26, x1: 52, z1: 26, color: PALETTE.upholsteryDark },
{ id: 'library-side-table', kind: 'low', height: 0.45, figure: 'table', x0: 52, z0: 25, x1: 52, z1: 25, color: PALETTE.furnitureWalnut },
// --- sitting room ---
{ id: 'sitting-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 3, z0: 30, x1: 8, z1: 36, color: PALETTE.rugGreen },
{ id: 'sitting-fireplace', kind: 'tall', figure: 'fireplace', x0: 2, z0: 32, x1: 2, z1: 34, color: PALETTE.furnitureStone },
{ id: 'sitting-sofa', kind: 'low', figure: 'settee', x0: 4, z0: 31, x1: 7, z1: 31, color: PALETTE.sofaGreen },
{ id: 'sitting-sofa-2', kind: 'low', figure: 'settee', x0: 4, z0: 35, x1: 7, z1: 35, color: PALETTE.sofaGreen },
{ id: 'sitting-coffee-table', kind: 'low', height: 0.45, figure: 'table', x0: 5, z0: 33, x1: 6, z1: 33, color: PALETTE.furnitureWalnut },
{ id: 'sitting-grand-piano', kind: 'low', figure: 'grand-piano', x0: 14, z0: 30, x1: 16, z1: 31, color: PALETTE.pianoBlack },
{ id: 'sitting-piano-stool', kind: 'low', height: 0.45, figure: 'stool', x0: 13, z0: 32, x1: 13, z1: 32, color: PALETTE.furnitureWalnut },
{ id: 'sitting-bookcase', kind: 'tall', figure: 'bookcase', x0: 10, z0: 28, x1: 12, z1: 28, color: PALETTE.furnitureWood },
{ id: 'sitting-card-table', kind: 'low', height: 0.7, figure: 'table', x0: 15, z0: 36, x1: 15, z1: 36, color: PALETTE.furnitureWalnut },
{ id: 'sitting-chair', kind: 'low', height: 0.45, figure: 'chair', x0: 14, z0: 36, x1: 14, z1: 36, color: PALETTE.furnitureWalnut },
{ id: 'sitting-chair-2', kind: 'low', height: 0.45, figure: 'chair', x0: 16, z0: 36, x1: 16, z1: 36, color: PALETTE.furnitureWalnut },
// --- dining room ---
{ id: 'dining-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 5, z0: 17, x1: 14, z1: 20, color: PALETTE.rugRed },
{ id: 'dining-table', kind: 'low', figure: 'table', x0: 6, z0: 18, x1: 13, z1: 19, color: PALETTE.furnitureOak },
{ id: 'dining-chair', kind: 'low', height: 0.45, figure: 'chair', x0: 7, z0: 17, x1: 7, z1: 17, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-2', kind: 'low', height: 0.45, figure: 'chair', x0: 10, z0: 17, x1: 10, z1: 17, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-3', kind: 'low', height: 0.45, figure: 'chair', x0: 12, z0: 17, x1: 12, z1: 17, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-4', kind: 'low', height: 0.45, figure: 'chair', x0: 8, z0: 20, x1: 8, z1: 20, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-5', kind: 'low', height: 0.45, figure: 'chair', x0: 11, z0: 20, x1: 11, z1: 20, color: PALETTE.furnitureWalnut },
{ id: 'dining-chair-6', kind: 'low', height: 0.45, figure: 'chair', x0: 5, z0: 18, x1: 5, z1: 18, color: PALETTE.furnitureWalnut },
{ id: 'dining-sideboard', kind: 'tall', figure: 'cabinet', x0: 10, z0: 14, x1: 13, z1: 14, color: PALETTE.furnitureWood },
{ id: 'dining-china-cabinet', kind: 'tall', figure: 'cabinet', x0: 17, z0: 16, x1: 17, z1: 17, color: PALETTE.furnitureWood },
{ id: 'dining-fireplace', kind: 'tall', figure: 'fireplace', x0: 2, z0: 19, x1: 2, z1: 21, color: PALETTE.furnitureStone },
{ id: 'dining-cart', kind: 'low', figure: 'table', x0: 14, z0: 16, x1: 14, z1: 16, color: PALETTE.furnitureStoneWarm },
// --- grand hall ---
{ id: 'hall-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 27, z0: 21, x1: 34, z1: 27, color: PALETTE.rugViolet },
{ id: 'hall-settee-statue', kind: 'low', figure: 'statue-settee', x0: 29, z0: 23, x1: 31, z1: 25, color: PALETTE.velvetRose },
{ id: 'hall-armor', kind: 'tall', figure: 'armor', x0: 26, z0: 17, x1: 26, z1: 17, color: PALETTE.armorSteel },
{ id: 'hall-armor-2', kind: 'tall', figure: 'armor', x0: 35, z0: 17, x1: 35, z1: 17, color: PALETTE.armorSteel },
{ id: 'hall-pedestal', kind: 'low', figure: 'pedestal', x0: 24, z0: 19, x1: 24, z1: 19, color: PALETTE.stonePale },
{ id: 'hall-pedestal-2', kind: 'low', figure: 'pedestal', x0: 37, z0: 19, x1: 37, z1: 19, color: PALETTE.stonePale },
{ id: 'hall-armchair', kind: 'low', figure: 'armchair', x0: 24, z0: 29, x1: 24, z1: 29, color: PALETTE.upholsteryDark },
{ id: 'hall-armchair-2', kind: 'low', figure: 'armchair', x0: 37, z0: 29, x1: 37, z1: 29, color: PALETTE.upholsteryDark },
{ id: 'hall-fern', kind: 'low', figure: 'fern', x0: 27, z0: 31, x1: 27, z1: 31, color: PALETTE.fernGreen },
{ id: 'hall-fern-2', kind: 'low', figure: 'fern', x0: 34, z0: 31, x1: 34, z1: 31, color: PALETTE.fernGreen },
// --- foyer ---
{ id: 'foyer-rug', kind: 'decor', height: 0.02, figure: 'rug', x0: 27, z0: 37, x1: 34, z1: 40, color: PALETTE.rugRed },
{ id: 'foyer-center-table', kind: 'low', figure: 'round-table', x0: 30, z0: 38, x1: 31, z1: 39, color: PALETTE.furnitureOak },
{ id: 'foyer-clock', kind: 'low', height: 1.7, figure: 'clock', x0: 36, z0: 36, x1: 36, z1: 36, color: PALETTE.furnitureWoodDark },
{ id: 'foyer-console', kind: 'low', figure: 'table', x0: 25, z0: 36, x1: 25, z1: 37, color: PALETTE.furnitureOak },
{ id: 'foyer-coat-stand', kind: 'low', height: 1.7, figure: 'coat-stand', x0: 25, z0: 42, x1: 25, z1: 42, color: PALETTE.upholsteryDark },
{ id: 'foyer-umbrella-stand', kind: 'low', height: 0.45, figure: 'barrel', x0: 36, z0: 42, x1: 36, z1: 42, color: PALETTE.upholsteryDark },
// --- scenery (stairs inert this milestone) ---
{ id: 'hall-grand-staircase', kind: 'low', height: 1.5, figure: 'staircase', x0: 27, z0: 16, x1: 34, z1: 17, color: PALETTE.furnitureOak },
{ id: 'stair-service-stairs', kind: 'low', height: 1.5, figure: 'staircase', x0: 21, z0: 2, x1: 24, z1: 4, color: PALETTE.furnitureWood },
{ id: 'stair-cellar-hatch', kind: 'low', height: 0.25, figure: 'hatch', x0: 22, z0: 8, x1: 23, z1: 8, color: PALETTE.furnitureWoodDark },
// --- corridors ---
{ id: 'corridor-runner', kind: 'decor', height: 0.02, figure: 'rug', x0: 21, z0: 13, x1: 52, z1: 14, color: PALETTE.rugRed },
```

`floorPatches` (families/colors per spec §5):

```js
floorPatches: [
  { x0: 22, z0: 16, x1: 39, z1: 32, family: 'stone', color: PALETTE.hallMarble },   // hall (octagon bbox)
  { x0: 25, z0: 35, x1: 36, z1: 42, family: 'stone', color: PALETTE.hallMarble },   // foyer
  { x0: 2, z0: 2, x1: 17, z1: 11, family: 'stone', color: PALETTE.kitchenFloor },   // kitchen
  { x0: 20, z0: 13, x1: 53, z1: 14, family: 'wood', color: PALETTE.floorParquetDark }, // north corridor
  { x0: 20, z0: 38, x1: 24, z1: 39, family: 'wood', color: PALETTE.floorParquetDark }, // west passage
  { x0: 37, z0: 38, x1: 41, z1: 39, family: 'wood', color: PALETTE.floorParquetDark }, // east passage
  { x0: 18, z0: 23, x1: 21, z1: 24, family: 'wood', color: PALETTE.floorParquetDark }, // hall-dining vestibule
  { x0: 18, z0: 11, x1: 19, z1: 13, family: 'wood', color: PALETTE.floorParquetDark }, // kitchen L-passage
  { x0: 2, z0: 14, x1: 17, z1: 25, family: 'wood', color: PALETTE.floorParquet },   // dining
  { x0: 2, z0: 28, x1: 19, z1: 39, family: 'wood', color: PALETTE.floorParquet },   // sitting
  { x0: 42, z0: 17, x1: 55, z1: 32, family: 'wood', color: PALETTE.floorParquet },  // library
  { x0: 42, z0: 35, x1: 55, z1: 44, family: 'wood', color: PALETTE.floorParquet },  // drawing
  { x0: 38, z0: 2, x1: 53, z1: 11, family: 'wood', color: PALETTE.floorParquet },   // billiard
  { x0: 28, z0: 2, x1: 35, z1: 9, family: 'wood', color: PALETTE.floorParquet },    // study
  { x0: 20, z0: 2, x1: 25, z1: 9, family: 'wood', color: PALETTE.floorParquet },    // service stair
],
wallPatches: [
  { x0: 1, z0: 1, x1: 18, z1: 12, family: 'stone', color: PALETTE.kitchenWall },    // kitchen walls
],
```

`windows` — the 34 exported cells from spec §5, verbatim:

```js
windows: [
  { x: 42, z: 1, facing: 's' }, { x: 43, z: 1, facing: 's' }, { x: 46, z: 1, facing: 's' }, { x: 47, z: 1, facing: 's' },
  { x: 56, z: 37, facing: 'w' }, { x: 56, z: 38, facing: 'w' }, { x: 56, z: 41, facing: 'w' }, { x: 56, z: 42, facing: 'w' },
  { x: 45, z: 45, facing: 'n' }, { x: 46, z: 45, facing: 'n' }, { x: 51, z: 45, facing: 'n' }, { x: 52, z: 45, facing: 'n' },
  { x: 56, z: 20, facing: 'w' }, { x: 56, z: 21, facing: 'w' }, { x: 56, z: 25, facing: 'w' }, { x: 56, z: 26, facing: 'w' },
  { x: 56, z: 29, facing: 'w' }, { x: 56, z: 30, facing: 'w' },
  { x: 1, z: 29, facing: 'e' }, { x: 1, z: 30, facing: 'e' }, { x: 1, z: 37, facing: 'e' }, { x: 1, z: 38, facing: 'e' },
  { x: 4, z: 40, facing: 'n' }, { x: 5, z: 40, facing: 'n' }, { x: 10, z: 40, facing: 'n' }, { x: 11, z: 40, facing: 'n' },
  { x: 1, z: 15, facing: 'e' }, { x: 1, z: 16, facing: 'e' }, { x: 1, z: 23, facing: 'e' }, { x: 1, z: 24, facing: 'e' },
  { x: 9, z: 1, facing: 's' }, { x: 10, z: 1, facing: 's' }, { x: 1, z: 8, facing: 'e' }, { x: 1, z: 9, facing: 'e' },
],
```

`wallProps` — the 15 exported entries + the main door, verbatim:

```js
wallProps: [
  { x0: 31, x1: 32, z: 1, facing: 's', type: 'boarded-window' },
  { x0: 28, x1: 29, z: 1, facing: 's', type: 'portrait' },
  { x: 36, z0: 5, z1: 6, facing: 'w', type: 'map' },
  { x0: 39, x1: 40, z: 1, facing: 's', type: 'cue-rack' },
  { x: 37, z0: 5, z1: 6, facing: 'e', type: 'scoreboard' },
  { x0: 44, x1: 45, z: 34, facing: 's', type: 'portrait' },
  { x0: 14, x1: 15, z: 27, facing: 's', type: 'portrait' },
  { x0: 4, x1: 5, z: 13, facing: 's', type: 'portrait' },
  { x0: 4, x1: 6, z: 1, facing: 's', type: 'pot-rack' },
  { x: 21, z0: 26, z1: 27, facing: 'e', type: 'tapestry' },
  { x: 40, z0: 26, z1: 27, facing: 'w', type: 'tapestry' },
  { x0: 26, x1: 28, z: 34, facing: 's', type: 'portrait' },
  { x0: 33, x1: 35, z: 34, facing: 's', type: 'portrait' },
  { x: 24, z0: 39, z1: 40, facing: 'e', type: 'mirror' },
  { x0: 30, x1: 31, z: 43, facing: 'n', type: 'main-door' },
],
```

- [ ] **Step 5: Swap MANSION and CELL**

- `src/level/mapData.js`: `export const CELL = 1;`, delete the `MAP` constant (and its comment block). `parseMap` unchanged.
- `src/level/levels.js`: delete the inline `MANSION` object and the `MAP` import; `import { GROUND_FLOOR } from './groundFloor.js'; export { GROUND_FLOOR as MANSION };` — `selectLevel` unchanged (`BY_NAME` still only maps `kitchen-test`; default return is now the ground floor).
- `src/level/kitchenTest.js`: add `windowLights: true,` to the `KITCHEN_TEST` export (the slice keeps its four lit windows; the mansion floor is glow-only — Task 7 wires the flag). `GROUND_FLOOR` gets NO `windowLights` field.

- [ ] **Step 6: Full suite**

Run: `npm test` — the new descriptor tests pass against the authored data; the updated mapData tests pass; everything else stays green (kitchen-test unaffected; `CELL = 1` flows only through defaults that the descriptor path already overrides explicitly).

- [ ] **Step 7: Commit**

```bash
git add src/level/groundFloor.js src/level/levels.js src/level/mapData.js src/rendering/palette.js tests/levels.test.js tests/mapData.test.js
git commit -m "feat: the blueprint ground floor replaces the greybox mansion"
```

---

### Task 7: Wall props builder, static shootables, final wiring

**Files:**
- Create: `src/level/buildWallProps.js`
- Modify: `src/level/buildWindows.js` (optional lights)
- Modify: `src/main.js`
- Test: none new (Three-only + wiring; descriptor coverage exists)

**Interfaces:**
- Consumes: `MANSION.wallProps` shape from Task 6; `NORMALS`-style facing math as in `buildWindows.js`.
- Produces: `buildWallProps(props, cell = CELL)` → `THREE.Group` of flat props on wall faces; `main.js` builds ONE static shootables array at startup (level meshes + furniture hit meshes + window meshes + wall-prop meshes) and `shoot()` only appends the wanderer's meshes when alive.

- [ ] **Step 1: Create `src/level/buildWallProps.js`**

```js
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
```

- [ ] **Step 2: Optional window lights**

`src/level/buildWindows.js`: signature becomes `buildWindows(windows, cell = CELL, { lights = true } = {})`; wrap ONLY the `PointLight` creation/add in `if (lights) { ... }`. Glow planes and frames always build. (Spec §5: 34 lights would sink the forward renderer — the mansion floor is glow-only; the kitchen-test slice keeps its lit windows.)

- [ ] **Step 3: Wire main.js**

- Windows call becomes: `const windowsGroup = buildWindows(levelDef.windows ?? [], levelDef.cell, { lights: levelDef.windowLights === true }); scene.add(windowsGroup);`
- Import `buildWallProps`; after the windows line: `const wallPropsGroup = buildWallProps(levelDef.wallProps ?? [], levelDef.cell); scene.add(wallPropsGroup);`
- Build the static list once, after all groups exist:

```js
const staticShootables = [
  ...level.children,
  ...furnitureGroup.userData.hitMeshes,
  ...windowsGroup.children.filter((o) => o.isMesh),
  ...wallPropsGroup.children.filter((o) => o.isMesh),
];
```

- `shoot()` becomes:

```js
  const shootables = wandererAI.isDead()
    ? staticShootables
    : [...staticShootables, ...wanderer.hitMeshes];
```

- [ ] **Step 4: Full suite + build + smoke**

Run: `npm test` (green), `npm run build` (success). Run `npm run dev`:
- Default URL: the blueprint floor loads — foyer spawn facing the locked main door prop, hall ahead with staircase + settee, all rooms furnished, windows glowing, Wanderer prowling from the billiard room.
- `?map=kitchen-test`: unchanged (lit windows, slice manifest).
- Browser visual checks are the human playtest's job — do not fabricate them; report as pending.

- [ ] **Step 5: Commit**

```bash
git add src/level/buildWallProps.js src/level/buildWindows.js src/main.js
git commit -m "feat: wall props, static shootables, ground floor wired as default"
```

---

## Playtest handoff (after Task 7)

The five spec questions on the default map: orientation after one loop; fight quality across room types (hall arena, kitchen lanes, library stacks, billiard den); light pacing (lamp rooms vs study/passages); perf on the P overlay (~2.7k cells, ~350 part meshes, 34 glow windows — mitigations shipped: merged walls, cached materials, static shootables); does it feel like one building. Plus the spec's watch-fors: Wanderer hearing at 58m scale, 11-lamp patrol pacing, lamp radius in small rooms, emissive flash strength.
