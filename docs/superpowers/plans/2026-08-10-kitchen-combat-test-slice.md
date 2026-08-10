# Kitchen Combat Test Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A standalone playable test map (`?map=kitchen-test`) — the blueprint's furnished kitchen at 1m cells with a Wanderer inside — to validate furniture-as-cover combat before the full mansion blueprint is built.

**Architecture:** A level becomes a descriptor `{ mapText, cell, furniture }` instead of a bare map string; the existing mansion is the default descriptor (cell 2, no furniture) with zero behavior change. Furniture footprints expand into two cell sets — **moveSet** (collision + A*) and **sightSet** (enemy line of sight) — and render as toon boxes (the post stack already outlines everything). The Wanderer AI gains `cell` and `sightSet` options that default to today's values.

**Tech Stack:** Three.js, Vite, Vitest, plain ES modules. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-10-kitchen-combat-test-slice-design.md`

## Global Constraints

- No dependencies beyond `three` / `vite` / `vitest`; plain JavaScript ES modules, no TypeScript.
- Logic modules are DOM-free and clock-injected; Three.js only in rendering/build modules and `main.js`; wiring stays thin in `main.js`.
- All colors come from `src/rendering/palette.js`.
- The shipped mansion map, Wanderer tuning, and damage numbers must not change: all 102 existing tests stay green untouched.
- TDD: every logic change lands test-first. Run tests with `npx vitest run <file>` (or `npm test` for the full suite).
- Furniture kinds (from the spec): `low` ~0.9m blocks movement+pathing only; `tall` ~1.9m also blocks enemy sight; `decor` ~0.6m no collision at all.

---

### Task 1: `parseMap` — cell-size parameter and `W` Wanderer spawn

**Files:**
- Modify: `src/level/mapData.js:23-50` (the `parseMap` function; leave `CELL` and `MAP` untouched)
- Test: `tests/mapData.test.js` (append; do not modify existing tests)

**Interfaces:**
- Consumes: nothing new.
- Produces: `parseMap(text, cell = CELL)` — world coordinates (`spawn`, `lamps`, and new `wandererSpawn`) scale by `cell`. Parse result gains `wandererSpawn: { x, z } | null` from an optional `W` char (floor cell). Result keeps `walls`, `wallSet`, `spawn`, `lamps`, `cols`, `rows` exactly as today.

- [ ] **Step 1: Write the failing tests**

Append to `tests/mapData.test.js`:

```js
describe('parseMap cell size and wanderer spawn', () => {
  const TINY = `
#####
#S.W#
#..L#
#####
`;

  it('scales world coordinates by the cell parameter', () => {
    const parsed = parseMap(TINY, 1);
    expect(parsed.spawn).toEqual({ x: 1, z: 1 });
    expect(parsed.lamps).toEqual([{ x: 3, z: 2 }]);
  });

  it('defaults to CELL when no cell is given', () => {
    const parsed = parseMap(TINY);
    expect(parsed.spawn).toEqual({ x: 1 * CELL, z: 1 * CELL });
  });

  it('parses W as the wanderer spawn in world coordinates', () => {
    const parsed = parseMap(TINY, 1);
    expect(parsed.wandererSpawn).toEqual({ x: 3, z: 1 });
  });

  it('returns null wandererSpawn when the map has no W', () => {
    expect(parseMap(MAP).wandererSpawn).toBeNull();
  });
});
```

Add `MAP` and `CELL` to the existing import from `../src/level/mapData.js` if not already imported.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/mapData.test.js`
Expected: FAIL — `wandererSpawn` undefined and coordinates off by the cell factor.

- [ ] **Step 3: Implement**

In `src/level/mapData.js`, change the signature to `parseMap(text, cell = CELL)`, replace every `* CELL` inside with `* cell`, and add `W` handling plus the new return field:

```js
export function parseMap(text, cell = CELL) {
  const lines = text.split(/\r?\n/);
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  const walls = [];
  const wallSet = new Set();
  const lamps = [];
  let spawn = null;
  let wandererSpawn = null;

  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') {
        walls.push({ c, r });
        wallSet.add(`${c},${r}`);
      } else if (ch === 'S') {
        spawn = { x: c * cell, z: r * cell };
      } else if (ch === 'L') {
        lamps.push({ x: c * cell, z: r * cell });
      } else if (ch === 'W') {
        wandererSpawn = { x: c * cell, z: r * cell };
      }
    });
  });

  if (!spawn) throw new Error('Map has no spawn point (S)');

  const cols = Math.max(...lines.map((l) => l.length));
  return { walls, wallSet, spawn, lamps, wandererSpawn, cols, rows: lines.length };
}
```

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all existing tests plus the four new ones pass (the mansion call site `parseMap(MAP)` keeps its default).

- [ ] **Step 5: Commit**

```bash
git add src/level/mapData.js tests/mapData.test.js
git commit -m "feat: parseMap takes cell size, parses optional W wanderer spawn"
```

---

### Task 2: Furniture logic module — footprint expansion and box math

**Files:**
- Create: `src/level/furniture.js`
- Test: `tests/furniture.test.js`

**Interfaces:**
- Consumes: nothing (pure module; no imports except nothing at all — it must stay Three-free and DOM-free).
- Produces:
  - `FURNITURE_HEIGHTS = { low: 0.9, tall: 1.9, decor: 0.6 }`
  - `expandFurniture(items, { wallSet, cols, rows })` → `{ moveCells: Set<string>, sightCells: Set<string> }` with `"c,r"` keys. `low` → moveCells only; `tall` → both; `decor` → neither. Throws `Error` when any footprint cell is outside `[0, cols) × [0, rows)` or collides with `wallSet` (message contains the item id).
  - `furnitureBox(item, cell)` → `{ w, h, d, x, y, z }`: world-space box size and center for the piece (`w = (x1-x0+1)*cell`, `h = FURNITURE_HEIGHTS[kind]`, `d = (z1-z0+1)*cell`, centered at `x = (x0+x1)/2*cell`, `y = h/2`, `z = (z0+z1)/2*cell`).
  - Item shape (from the spec): `{ id, kind, x0, z0, x1, z1, color }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/furniture.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { expandFurniture, furnitureBox, FURNITURE_HEIGHTS } from '../src/level/furniture.js';

const bounds = { wallSet: new Set(['0,0']), cols: 10, rows: 10 };

describe('expandFurniture', () => {
  it('expands a low footprint into moveCells but not sightCells', () => {
    const { moveCells, sightCells } = expandFurniture(
      [{ id: 'table', kind: 'low', x0: 2, z0: 3, x1: 3, z1: 4 }],
      bounds,
    );
    expect([...moveCells].sort()).toEqual(['2,3', '2,4', '3,3', '3,4']);
    expect(sightCells.size).toBe(0);
  });

  it('puts tall furniture in both sets', () => {
    const { moveCells, sightCells } = expandFurniture(
      [{ id: 'shelf', kind: 'tall', x0: 5, z0: 5, x1: 5, z1: 6 }],
      bounds,
    );
    expect(moveCells.has('5,5')).toBe(true);
    expect(sightCells.has('5,6')).toBe(true);
  });

  it('leaves decor out of both sets', () => {
    const { moveCells, sightCells } = expandFurniture(
      [{ id: 'stool', kind: 'decor', x0: 1, z0: 1, x1: 1, z1: 1 }],
      bounds,
    );
    expect(moveCells.size).toBe(0);
    expect(sightCells.size).toBe(0);
  });

  it('throws when a footprint overlaps a wall cell', () => {
    expect(() =>
      expandFurniture([{ id: 'bad-table', kind: 'low', x0: 0, z0: 0, x1: 1, z1: 0 }], bounds),
    ).toThrow(/bad-table/);
  });

  it('throws when a footprint leaves the map bounds', () => {
    expect(() =>
      expandFurniture([{ id: 'runaway', kind: 'low', x0: 9, z0: 9, x1: 10, z1: 9 }], bounds),
    ).toThrow(/runaway/);
  });
});

describe('furnitureBox', () => {
  it('computes world-space size and center from the footprint', () => {
    const box = furnitureBox({ id: 't', kind: 'low', x0: 6, z0: 5, x1: 9, z1: 6 }, 1);
    expect(box).toEqual({ w: 4, h: FURNITURE_HEIGHTS.low, d: 2, x: 7.5, y: FURNITURE_HEIGHTS.low / 2, z: 5.5 });
  });

  it('scales with the cell size', () => {
    const box = furnitureBox({ id: 'b', kind: 'tall', x0: 1, z0: 1, x1: 1, z1: 1 }, 2);
    expect(box.w).toBe(2);
    expect(box.x).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/furniture.test.js`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `src/level/furniture.js`:

```js
// Furniture footprints are data beside the map text, not map characters.
// kind 'low'  blocks movement + pathfinding, but not enemy sight.
// kind 'tall' blocks movement, pathfinding, and enemy sight.
// kind 'decor' blocks nothing — walk-through set dressing.
export const FURNITURE_HEIGHTS = { low: 0.9, tall: 1.9, decor: 0.6 };

export function expandFurniture(items, { wallSet, cols, rows }) {
  const moveCells = new Set();
  const sightCells = new Set();
  for (const item of items) {
    for (let z = item.z0; z <= item.z1; z++) {
      for (let x = item.x0; x <= item.x1; x++) {
        if (x < 0 || z < 0 || x >= cols || z >= rows) {
          throw new Error(`furniture "${item.id}" leaves the map at ${x},${z}`);
        }
        const key = `${x},${z}`;
        if (wallSet.has(key)) {
          throw new Error(`furniture "${item.id}" overlaps a wall at ${x},${z}`);
        }
        if (item.kind === 'low' || item.kind === 'tall') moveCells.add(key);
        if (item.kind === 'tall') sightCells.add(key);
      }
    }
  }
  return { moveCells, sightCells };
}

export function furnitureBox(item, cell) {
  const h = FURNITURE_HEIGHTS[item.kind];
  return {
    w: (item.x1 - item.x0 + 1) * cell,
    h,
    d: (item.z1 - item.z0 + 1) * cell,
    x: ((item.x0 + item.x1) / 2) * cell,
    y: h / 2,
    z: ((item.z0 + item.z1) / 2) * cell,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/furniture.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/level/furniture.js tests/furniture.test.js
git commit -m "feat: furniture footprint expansion into move/sight cell sets"
```

---

### Task 3: Kitchen test level descriptor and level selection

**Files:**
- Create: `src/level/kitchenTest.js`
- Create: `src/level/levels.js`
- Modify: `src/rendering/palette.js` (append three furniture colors)
- Test: `tests/levels.test.js`

**Interfaces:**
- Consumes: `MAP`, `CELL` from `src/level/mapData.js`; `parseMap` (Task 1); `expandFurniture` (Task 2); `PALETTE`.
- Produces:
  - `KITCHEN_TEST` descriptor: `{ name: 'kitchen-test', mapText: string, cell: 1, furniture: Array }`.
  - `MANSION` descriptor: `{ name: 'mansion', mapText: MAP, cell: CELL, furniture: [] }`.
  - `selectLevel(queryString)` → descriptor. `'?map=kitchen-test'` → `KITCHEN_TEST`; anything else (including `''` and unknown names) → `MANSION`.
  - New palette keys: `furnitureWood: 0x5e4a36`, `furnitureIron: 0x3a3e46`, `furnitureStone: 0x555c60`.

- [ ] **Step 1: Write the failing tests**

Create `tests/levels.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { selectLevel, MANSION, KITCHEN_TEST } from '../src/level/levels.js';
import { parseMap } from '../src/level/mapData.js';
import { expandFurniture } from '../src/level/furniture.js';

describe('selectLevel', () => {
  it('returns the mansion by default', () => {
    expect(selectLevel('')).toBe(MANSION);
  });

  it('returns the kitchen test slice for ?map=kitchen-test', () => {
    expect(selectLevel('?map=kitchen-test')).toBe(KITCHEN_TEST);
  });

  it('falls back to the mansion for unknown map names', () => {
    expect(selectLevel('?map=does-not-exist')).toBe(MANSION);
  });
});

describe('KITCHEN_TEST descriptor', () => {
  const parsed = parseMap(KITCHEN_TEST.mapText, KITCHEN_TEST.cell);

  it('parses with player spawn, wanderer spawn, and two lamps', () => {
    expect(parsed.spawn).toEqual({ x: 7, z: 14 });
    expect(parsed.wandererSpawn).toEqual({ x: 11, z: 5 });
    expect(parsed.lamps).toHaveLength(2);
  });

  it('is 21 columns by 17 rows at 1m cells', () => {
    expect(KITCHEN_TEST.cell).toBe(1);
    expect(parsed.cols).toBe(21);
    expect(parsed.rows).toBe(17);
  });

  it('has furniture that expands cleanly against the parsed map', () => {
    const { moveCells, sightCells } = expandFurniture(KITCHEN_TEST.furniture, {
      wallSet: parsed.wallSet,
      cols: parsed.cols,
      rows: parsed.rows,
    });
    // work-table(8) + counter(3) + barrel(1) low; stove(2) + hearth(3) + larder(3) tall
    expect(moveCells.size).toBe(20);
    expect(sightCells.size).toBe(8);
  });

  it('keeps the wanderer spawn and player spawn off furniture cells', () => {
    const { moveCells } = expandFurniture(KITCHEN_TEST.furniture, {
      wallSet: parsed.wallSet,
      cols: parsed.cols,
      rows: parsed.rows,
    });
    expect(moveCells.has('11,5')).toBe(false);
    expect(moveCells.has('7,14')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/levels.test.js`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Implement**

Append to `src/rendering/palette.js` (inside `PALETTE`, keep the existing comment style):

```js
  furnitureWood: 0x5e4a36,  // oak table, barrels, larder shelving
  furnitureIron: 0x3a3e46,  // cast-iron stove, hearth metalwork
  furnitureStone: 0x555c60, // stone counter
```

Create `src/level/kitchenTest.js` (map and manifest copied verbatim from the spec):

```js
import { PALETTE } from '../rendering/palette.js';

// The blueprint kitchen (x2-13, z2-9) with a dining stub (player spawn) and a
// dead-end corridor stub. 1m cells. See the M4a test-slice spec.
const KITCHEN_TEST_MAP = `
#####################
#####################
##............#######
##............#######
##............#######
##.........W..#######
##............#######
##...L........#######
##............#######
##............DD#####
######DD######DD....#
######DD######DD....#
##............#######
##..L.........#######
##.....S......#######
##............#######
#####################
`;

const FURNITURE = [
  { id: 'work-table', kind: 'low', x0: 6, z0: 5, x1: 9, z1: 6, color: PALETTE.furnitureWood },
  { id: 'stove', kind: 'tall', x0: 4, z0: 2, x1: 5, z1: 2, color: PALETTE.furnitureIron },
  { id: 'hearth', kind: 'tall', x0: 10, z0: 2, x1: 12, z1: 2, color: PALETTE.furnitureIron },
  { id: 'counter', kind: 'low', x0: 2, z0: 4, x1: 2, z1: 6, color: PALETTE.furnitureStone },
  { id: 'larder', kind: 'tall', x0: 2, z0: 9, x1: 4, z1: 9, color: PALETTE.furnitureWood },
  { id: 'barrel', kind: 'low', x0: 13, z0: 4, x1: 13, z1: 4, color: PALETTE.furnitureWood },
  { id: 'barrel-2', kind: 'decor', x0: 13, z0: 5, x1: 13, z1: 5, color: PALETTE.furnitureWood },
  { id: 'stool', kind: 'decor', x0: 5, z0: 5, x1: 5, z1: 5, color: PALETTE.furnitureWood },
  { id: 'stool-2', kind: 'decor', x0: 10, z0: 6, x1: 10, z1: 6, color: PALETTE.furnitureWood },
];

export const KITCHEN_TEST = {
  name: 'kitchen-test',
  mapText: KITCHEN_TEST_MAP,
  cell: 1,
  furniture: FURNITURE,
};
```

Create `src/level/levels.js`:

```js
import { MAP, CELL } from './mapData.js';
import { KITCHEN_TEST } from './kitchenTest.js';

export { KITCHEN_TEST };

export const MANSION = { name: 'mansion', mapText: MAP, cell: CELL, furniture: [] };

const BY_NAME = new Map([[KITCHEN_TEST.name, KITCHEN_TEST]]);

export function selectLevel(queryString) {
  const name = new URLSearchParams(queryString).get('map');
  return BY_NAME.get(name) ?? MANSION;
}
```

(`URLSearchParams` is a JS built-in available in both the browser and Node/Vitest — no DOM involved.)

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: all tests pass, including the descriptor sanity checks.

- [ ] **Step 5: Commit**

```bash
git add src/level/kitchenTest.js src/level/levels.js src/rendering/palette.js tests/levels.test.js
git commit -m "feat: kitchen test level descriptor and URL map selection"
```

---

### Task 4: Wanderer AI — `cell` and `sightSet` options

**Files:**
- Modify: `src/enemy/wandererAI.js` (`createWandererAI` options at line 46; internal calls at lines 76-79, 84, 87, 96-102, 114, 143, 162, 207-213)
- Test: `tests/wandererAI.test.js` (append; do not modify existing tests)

**Interfaces:**
- Consumes: `hasLineOfSight(from, to, wallSet, cell)`, `worldToCell(x, z, cell)`, `cellToWorld(c, r, cell)` from `src/level/pathfinding.js`; `moveWithCollision(pos, dx, dz, wallSet, radius, cell)` from `src/level/collision.js` — all already accept these parameters.
- Produces: `createWandererAI({ spawn, wallSet, waypoints, config, cell = CELL, sightSet = wallSet })`. `wallSet` remains the movement/pathfinding set (callers may pass a furniture-augmented moveSet); `sightSet` feeds every `hasLineOfSight` call. `cell` feeds every `worldToCell` / `cellToWorld` / `moveWithCollision` / `hasLineOfSight` call. Defaults reproduce today's behavior exactly.

- [ ] **Step 1: Write the failing tests**

Append to `tests/wandererAI.test.js` (reuse the file's existing imports/helpers; `CELL` is 2, so world coords below are cell × 1 with an explicit `cell: 1`):

```js
describe('two-set furniture behavior at cell 1', () => {
  // 7x5 map, all floor inside a wall ring; a 1-cell "table" at 3,2
  // between the monster (1,2) and the player (5,2).
  function ringWalls(cols, rows) {
    const set = new Set();
    for (let c = 0; c < cols; c++) { set.add(`${c},0`); set.add(`${c},${rows - 1}`); }
    for (let r = 0; r < rows; r++) { set.add(`0,${r}`); set.add(`${cols - 1},${r}`); }
    return set;
  }

  it('sees the player across low cover and paths around it', () => {
    const walls = ringWalls(7, 5);
    const moveSet = new Set([...walls, '3,2']); // low table blocks movement only
    const sightSet = walls;                      // ...but not sight
    const ai = createWandererAI({
      spawn: { x: 1, z: 2 },
      wallSet: moveSet,
      sightSet,
      cell: 1,
      waypoints: [{ x: 1, z: 2 }],
      // within proximityRange the facing cone is skipped — otherwise the monster
      // starts facing away and the sight-set behavior never gets exercised
      config: { proximityRange: 100 },
    });
    ai.update(0.016, { x: 5, z: 2 });
    expect(ai.state()).toBe('chase');
    // let it move: it must make progress toward the player without ever
    // standing on the blocked table cell
    for (let i = 0; i < 120; i++) {
      ai.update(0.016, { x: 5, z: 2 });
      const p = ai.position();
      expect(Math.round(p.x) === 3 && Math.round(p.z) === 2).toBe(false);
    }
    const p = ai.position();
    expect(Math.hypot(5 - p.x, 2 - p.z)).toBeLessThan(4);
  });

  it('does not see the player across tall cover', () => {
    const walls = ringWalls(7, 5);
    const moveSet = new Set([...walls, '3,1', '3,2', '3,3']); // tall shelf wall-to-wall
    const sightSet = moveSet;
    const ai = createWandererAI({
      spawn: { x: 1, z: 2 },
      wallSet: moveSet,
      sightSet,
      cell: 1,
      waypoints: [{ x: 1, z: 2 }],
      config: { proximityRange: 100 }, // neutralize the facing cone: only sight blocking matters here
    });
    ai.update(0.016, { x: 5, z: 2 });
    expect(ai.state()).toBe('patrol');
  });

  it('defaults sightSet to wallSet and cell to CELL (existing behavior)', () => {
    const walls = ringWalls(7, 5);
    const ai = createWandererAI({
      spawn: { x: 1 * CELL, z: 2 * CELL },
      wallSet: new Set([...walls, '3,1', '3,2', '3,3']),
      waypoints: [{ x: 1 * CELL, z: 2 * CELL }],
      config: { proximityRange: 100 }, // neutralize the facing cone here too
    });
    ai.update(0.016, { x: 5 * CELL, z: 2 * CELL });
    expect(ai.state()).toBe('patrol'); // the blocker also blocks sight by default
  });
});
```

If `CELL` is not already imported in this test file, add `import { CELL } from '../src/level/mapData.js';`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/wandererAI.test.js`
Expected: the new "sees the player across low cover" test FAILS (today `sightSet` is ignored, so the low-cover cell blocks sight and the state stays `patrol`); the other two may already pass — that is fine, they pin the defaults.

- [ ] **Step 3: Implement**

In `src/enemy/wandererAI.js`:

1. Import `CELL`: `import { CELL } from '../level/mapData.js';`
2. Options: `export function createWandererAI({ spawn, wallSet, waypoints, config = {}, cell = CELL, sightSet = wallSet }) {`
3. Thread the parameters through every geometry call:
   - `stepToward`: `findPath(worldToCell(position.x, position.z, cell), worldToCell(goal.x, goal.z, cell), wallSet)`; both `cellToWorld(path[0].c, path[0].r, cell)` calls; `moveWithCollision(position, …, wallSet, cfg.radius, cell)`.
   - `canSee`: `hasLineOfSight(position, player, sightSet, cell)`.
   - The attack-swing gate (line 143) and the melee-entry gate (line 162): `hasLineOfSight(position, player, sightSet, cell)`.
   - `takeHit` knockback: `moveWithCollision(position, …, wallSet, cfg.radius, cell)`.

`findPath` is grid-pure and needs no cell. Do not change any state logic or tuning.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: everything green — the defaults (`cell = CELL`, `sightSet = wallSet`) keep all existing AI tests passing byte-for-byte.

- [ ] **Step 5: Commit**

```bash
git add src/enemy/wandererAI.js tests/wandererAI.test.js
git commit -m "feat: wanderer AI takes cell size and a separate sight set"
```

---

### Task 5: Rendering — cell-sized greybox and furniture boxes

**Files:**
- Modify: `src/level/buildGreybox.js`
- Create: `src/level/buildFurniture.js`
- Test: none new (Three-only build modules follow the existing untested-rendering convention; the box math was tested in Task 2)

**Interfaces:**
- Consumes: `furnitureBox(item, cell)` from Task 2; `createToonMaterial` from `src/rendering/toonMaterial.js`.
- Produces:
  - `buildGreybox(parsed, cell = CELL)` — walls become `cell × 3 × cell` boxes at `c * cell, r * cell`; floor/ceiling span `cols * cell × rows * cell`. Default keeps the mansion identical.
  - `buildFurniture(furniture, cell = CELL)` → `THREE.Group` whose **direct children are one mesh per piece** (flat, no nesting — the shot raycast is non-recursive). Each mesh: `BoxGeometry(w, h, d)` from `furnitureBox`, `createToonMaterial(item.color)`, positioned at the box center.

- [ ] **Step 1: Parameterize buildGreybox**

In `src/level/buildGreybox.js`, change the signature to `buildGreybox(parsed, cell = CELL)` and replace every use of `CELL` inside the function body with `cell` (wall geometry, wall positions, `width`, `depth`, `centerX`, `centerZ`). The `WALL_HEIGHT` stays 3.

- [ ] **Step 2: Create buildFurniture**

Create `src/level/buildFurniture.js`:

```js
import * as THREE from 'three';
import { CELL } from './mapData.js';
import { furnitureBox } from './furniture.js';
import { createToonMaterial } from '../rendering/toonMaterial.js';

// One toon box per piece; the post stack inks the outlines like everything else.
// Children stay flat (no sub-groups): the shot raycast is non-recursive.
export function buildFurniture(furniture, cell = CELL) {
  const group = new THREE.Group();
  for (const item of furniture) {
    const box = furnitureBox(item, cell);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(box.w, box.h, box.d),
      createToonMaterial(item.color),
    );
    mesh.position.set(box.x, box.y, box.z);
    group.add(mesh);
  }
  return group;
}
```

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: green (no test touches these modules; this catches import typos via any indirect imports).

- [ ] **Step 4: Commit**

```bash
git add src/level/buildGreybox.js src/level/buildFurniture.js
git commit -m "feat: cell-sized greybox and toon furniture boxes"
```

---

### Task 6: Wire the test level into main.js and verify in-game

**Files:**
- Modify: `src/main.js` (imports; level setup at lines 30-33; AI creation at lines 46-50; player movement at line 158; shootables at lines 129-131)

**Interfaces:**
- Consumes: `selectLevel` (Task 3), `expandFurniture` (Task 2), `buildFurniture` (Task 5), `parseMap(text, cell)` (Task 1), `buildGreybox(parsed, cell)` (Task 5), `createWandererAI({ …, cell, sightSet })` (Task 4).
- Produces: the running game; no new exports.

- [ ] **Step 1: Rewire level setup**

In `src/main.js` replace the imports of `MAP` and the level setup block (lines 30-33) with:

```js
import { parseMap } from './level/mapData.js';        // MAP import no longer needed
import { selectLevel } from './level/levels.js';
import { expandFurniture } from './level/furniture.js';
import { buildFurniture } from './level/buildFurniture.js';
```

```js
const levelDef = selectLevel(window.location.search);
const parsed = parseMap(levelDef.mapText, levelDef.cell);
const { moveCells, sightCells } = expandFurniture(levelDef.furniture, {
  wallSet: parsed.wallSet,
  cols: parsed.cols,
  rows: parsed.rows,
});
const moveSet = new Set([...parsed.wallSet, ...moveCells]);
const sightSet = new Set([...parsed.wallSet, ...sightCells]);
const level = buildGreybox(parsed, levelDef.cell);
scene.add(level);
scene.add(buildLamps(parsed));
const furnitureGroup = buildFurniture(levelDef.furniture, levelDef.cell);
scene.add(furnitureGroup);
```

- [ ] **Step 2: Rewire collision, AI, and shootables**

- Player movement (line 158): `moveWithCollision(player, wish.x * speed * dt, wish.z * speed * dt, moveSet, 0.4, levelDef.cell)` (the radius default must now be passed explicitly to reach the `cell` parameter).
- AI creation (lines 46-50):

```js
const wandererAI = createWandererAI({
  spawn: parsed.wandererSpawn ?? parsed.lamps[0],
  wallSet: moveSet,
  sightSet,
  cell: levelDef.cell,
  waypoints: parsed.lamps,
});
```

- Shootables (lines 129-131) — furniture must stop bullets and take impact marks:

```js
const shootables = wandererAI.isDead()
  ? [...level.children, ...furnitureGroup.children]
  : [...level.children, ...furnitureGroup.children, ...wanderer.hitMeshes];
```

(No other change: furniture hits have no `wandererPart`, so the existing else-branch spawns impact sparks on furniture for free.)

- [ ] **Step 3: Full suite + mansion smoke test**

Run: `npm test` → expected green.
Run: `npm run dev`, open the game **without** any URL param. Verify: mansion looks and plays exactly as before (walls, lamps, Wanderer patrolling, shooting works).

- [ ] **Step 4: Kitchen slice smoke test**

Open `http://localhost:5173/?map=kitchen-test`. Verify:
- You spawn in the small dining stub with a lamp; the kitchen is north through the double door.
- The kitchen contains the work table, counter, stove, hearth, larder shelves, barrels, and stools as outlined toon boxes; the Wanderer is inside.
- You cannot walk through low/tall furniture but CAN walk through the stools and the second barrel.
- You can shoot over the work table and hit the Wanderer; shooting the table leaves an impact mark.
- The Wanderer chases you around the table (it never walks through furniture) and loses you behind the larder shelves / stove (tall) but not behind the table (low).

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: kitchen combat test slice playable via ?map=kitchen-test"
```

---

## Playtest handoff (after Task 6)

The user runs the five spec questions in `?map=kitchen-test`:

1. Cover feel — does the fight orbit the table?
2. 1m A* path sanity (no zigzag jank).
3. Serpentine weave vs tight lanes (first tuning lever: weave amplitude in `src/enemy/movementStyle.js`).
4. Low-cover readability (shoot over / see over / no walk-through). Watch specifically whether the Wanderer's melee can hit across the table edge (reach 1.9 + 0.6 forgiveness) and whether that feels fair.
5. Perf at 4× grid density (overlay on P) — note pathfinding cost as a preview for the full 46×36 mansion floor. Also note the long-open stagger stun-lock question (staggerTime 0.35 == fireCooldown 0.35) at kitchen ranges.

Verdict feeds back into the M4a brainstorm (room mockups resume or furniture rules get adjusted).
