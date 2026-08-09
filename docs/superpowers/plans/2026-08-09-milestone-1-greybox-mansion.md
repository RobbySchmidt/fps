# Milestone 1: Grey-Box Mansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A walkable grey-box mansion in the browser: first-person controls (pointer lock, WASD, sprint), wall collision, and a toggleable flashlight — no art yet.

**Architecture:** Vite serves a single-page Three.js app. All game logic that can run headless (map parsing, collision, look/movement math, the game loop) lives in pure modules unit-tested with Vitest; DOM and Three.js wiring stays thin in `main.js` and small setup modules. The mansion is defined as an ASCII tile map (1 cell = 2 m); walls render as boxes and double as collision AABBs.

**Tech Stack:** Three.js, Vite, Vitest, plain JavaScript (ES modules).

**Spec:** `docs/superpowers/specs/2026-08-09-mansion-horror-fps-design.md`. This plan covers Milestone 1 only; Milestones 2–5 (art pass, combat, content, polish) each get their own plan once this one is implemented.

## Global Constraints

- Plain JavaScript with ES modules — no TypeScript.
- Runtime dependency: `three` only. Dev dependencies: `vite`, `vitest` only. No other libraries.
- Target: desktop browser at 60 fps. Mobile is out of scope.
- Working title everywhere (package name, `<title>`): `Mansion`.
- Logic modules must not touch `document`/`window` so Vitest can run them in Node (default environment, no jsdom).
- World units are meters. Tile cell size `CELL = 2`. Grid cell `(c, r)` has its center at world `(c * CELL, r * CELL)`; walls are 3 m high.
- Commit after every task with the message given in the task.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `src/ui/style.css`
- Create: `src/main.js`
- Create: `.gitignore`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `npm run dev` (Vite dev server), `npm test` (Vitest), `npm run build`. DOM contract used by all later tasks: `<canvas id="game">` and `<div id="overlay">` exist; overlay is hidden by setting its `hidden` attribute.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "mansion",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "three": "^0.170.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 3: Write `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Mansion</title>
  <link rel="stylesheet" href="/src/ui/style.css" />
</head>
<body>
  <canvas id="game"></canvas>
  <div id="overlay">
    <h1>MANSION</h1>
    <p>Click to play</p>
    <p class="hint">WASD move · Mouse look · Shift sprint · F flashlight · Esc pause</p>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Write `src/ui/style.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; overflow: hidden; background: #05070a; }
#game { display: block; width: 100%; height: 100%; }
#overlay {
  position: fixed; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.5rem;
  color: #cfd6e4; background: rgba(5, 7, 10, 0.85);
  font-family: system-ui, sans-serif; cursor: pointer;
}
#overlay[hidden] { display: none; }
#overlay .hint { color: #6b7686; font-size: 0.85rem; }
```

- [ ] **Step 5: Write placeholder `src/main.js`**

```js
console.log('Mansion booting…');
```

- [ ] **Step 6: Install and verify**

Run: `npm install`
Run: `npm test` — Expected: passes ("no test files found" is OK due to `--passWithNoTests`)
Run: `npm run build` — Expected: builds `dist/` without errors
Run: `npm run dev`, open the printed URL — Expected: dark page with the MANSION overlay text.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore index.html src
git commit -m "feat: scaffold Vite + Three.js + Vitest project"
```

---

### Task 2: Game loop with injectable timing

**Files:**
- Create: `src/core/gameLoop.js`
- Test: `tests/gameLoop.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `createGameLoop(update, { maxDelta?, now?, schedule? }) -> { start(), stop() }`. `update(dt)` is called once per scheduled frame with elapsed seconds, clamped to `maxDelta` (default `0.1`). Defaults: `now = () => performance.now() / 1000`, `schedule = requestAnimationFrame`.

- [ ] **Step 1: Write the failing tests**

`tests/gameLoop.test.js`:

```js
import { it, expect } from 'vitest';
import { createGameLoop } from '../src/core/gameLoop.js';

function makeFakeTimer() {
  let t = 0;
  const queue = [];
  return {
    now: () => t,
    schedule: (fn) => queue.push(fn),
    tick(dt) {
      t += dt;
      const fns = queue.splice(0);
      fns.forEach((fn) => fn());
    },
  };
}

it('calls update with elapsed seconds per frame', () => {
  const timer = makeFakeTimer();
  const deltas = [];
  const loop = createGameLoop((dt) => deltas.push(dt), { now: timer.now, schedule: timer.schedule });
  loop.start();
  timer.tick(0.016);
  timer.tick(0.02);
  expect(deltas.length).toBe(2);
  expect(deltas[0]).toBeCloseTo(0.016);
  expect(deltas[1]).toBeCloseTo(0.02);
});

it('clamps large deltas to maxDelta (default 0.1)', () => {
  const timer = makeFakeTimer();
  const deltas = [];
  const loop = createGameLoop((dt) => deltas.push(dt), { now: timer.now, schedule: timer.schedule });
  loop.start();
  timer.tick(5);
  expect(deltas[0]).toBeCloseTo(0.1);
});

it('stops calling update after stop()', () => {
  const timer = makeFakeTimer();
  let calls = 0;
  const loop = createGameLoop(() => calls++, { now: timer.now, schedule: timer.schedule });
  loop.start();
  timer.tick(0.016);
  loop.stop();
  timer.tick(0.016);
  timer.tick(0.016);
  expect(calls).toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/gameLoop.test.js`
Expected: FAIL — cannot resolve `../src/core/gameLoop.js`.

- [ ] **Step 3: Implement `src/core/gameLoop.js`**

```js
export function createGameLoop(update, options = {}) {
  const {
    maxDelta = 0.1,
    now = () => performance.now() / 1000,
    schedule = (fn) => requestAnimationFrame(fn),
  } = options;

  let running = false;
  let last = 0;

  function frame() {
    if (!running) return;
    const t = now();
    const dt = Math.min(t - last, maxDelta);
    last = t;
    update(dt);
    schedule(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = now();
      schedule(frame);
    },
    stop() {
      running = false;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/gameLoop.test.js`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/core/gameLoop.js tests/gameLoop.test.js
git commit -m "feat: add game loop with clamped delta and injectable timing"
```

---

### Task 3: Tile map data and parser

**Files:**
- Create: `src/level/mapData.js`
- Test: `tests/mapData.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `CELL = 2` (meters per cell); `MAP` (the mansion layout string); `parseMap(text) -> { walls: Array<{c: number, r: number}>, wallSet: Set<string>, spawn: {x: number, z: number}, cols: number, rows: number }`. `wallSet` keys are `` `${c},${r}` ``. `spawn` is in world meters. Throws `Error('Map has no spawn point (S)')` if no `S`.

Map legend: `#` wall, `.` floor, `D` floor (readability marker for doorways), `S` spawn (also floor). Blank lines at the start/end of the string are trimmed.

- [ ] **Step 1: Write the failing tests**

`tests/mapData.test.js`:

```js
import { it, expect } from 'vitest';
import { parseMap, MAP, CELL } from '../src/level/mapData.js';

const SMALL = `
#####
#S.D#
#####
`;

it('collects wall cells and a wall lookup set', () => {
  const parsed = parseMap(SMALL);
  expect(parsed.walls.length).toBe(12); // 5 + 2 + 5
  expect(parsed.wallSet.has('0,0')).toBe(true);
  expect(parsed.wallSet.has('1,1')).toBe(false);
});

it('finds the spawn point in world meters', () => {
  const parsed = parseMap(SMALL);
  expect(parsed.spawn).toEqual({ x: 1 * CELL, z: 1 * CELL });
});

it('reports grid dimensions', () => {
  const parsed = parseMap(SMALL);
  expect(parsed.cols).toBe(5);
  expect(parsed.rows).toBe(3);
});

it('throws when the map has no spawn', () => {
  expect(() => parseMap('###\n#.#\n###')).toThrow(/spawn/);
});

it('ships a valid mansion MAP', () => {
  const parsed = parseMap(MAP);
  expect(parsed.walls.length).toBeGreaterThan(50);
  expect(parsed.spawn).toBeDefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/mapData.test.js`
Expected: FAIL — cannot resolve `../src/level/mapData.js`.

- [ ] **Step 3: Implement `src/level/mapData.js`**

```js
export const CELL = 2; // meters per grid cell

// Legend: '#' wall, '.' floor, 'D' doorway (floor), 'S' spawn (floor).
// Six rooms along the top and middle, one grand hall at the bottom.
export const MAP = `
########################
#......#........#......#
#......#........#......#
#......D........D......#
#......#........#......#
####D######DD######D####
#........#......#......#
#........#......#......#
#........D......D......#
#........#......#......#
#####D##########D#######
#......................#
#..........S...........#
#......................#
########################
`;

export function parseMap(text) {
  const lines = text.split('\n');
  while (lines.length && lines[0].trim() === '') lines.shift();
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();

  const walls = [];
  const wallSet = new Set();
  let spawn = null;

  lines.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === '#') {
        walls.push({ c, r });
        wallSet.add(`${c},${r}`);
      } else if (ch === 'S') {
        spawn = { x: c * CELL, z: r * CELL };
      }
    });
  });

  if (!spawn) throw new Error('Map has no spawn point (S)');

  const cols = Math.max(...lines.map((l) => l.length));
  return { walls, wallSet, spawn, cols, rows: lines.length };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/mapData.test.js`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/level/mapData.js tests/mapData.test.js
git commit -m "feat: add mansion tile map and parser"
```

---

### Task 4: Collision against wall cells

**Files:**
- Create: `src/level/collision.js`
- Test: `tests/collision.test.js`

**Interfaces:**
- Consumes: `CELL` from `src/level/mapData.js`; `wallSet` produced by `parseMap`.
- Produces: `collides(x, z, radius, wallSet, cell = CELL) -> boolean` (circle vs. wall-cell AABBs); `moveWithCollision(pos, dx, dz, wallSet, radius = 0.4, cell = CELL) -> {x, z}` — attempts the X move then the Z move independently, so the player slides along walls. `pos` is `{x, z}` and is not mutated.

- [ ] **Step 1: Write the failing tests**

`tests/collision.test.js`:

```js
import { it, expect } from 'vitest';
import { collides, moveWithCollision } from '../src/level/collision.js';

// One wall cell at grid (2,1): center (4,2), spans x[3,5], z[1,3] with CELL=2.
const wallSet = new Set(['2,1']);

it('detects overlap between player circle and a wall cell', () => {
  expect(collides(3.2, 2, 0.4, wallSet)).toBe(true);
  expect(collides(2.0, 2, 0.4, wallSet)).toBe(false);
});

it('moves freely in open space', () => {
  const next = moveWithCollision({ x: 0, z: 0 }, 0.5, -0.25, wallSet);
  expect(next).toEqual({ x: 0.5, z: -0.25 });
});

it('blocks movement into a wall', () => {
  const next = moveWithCollision({ x: 2, z: 2 }, 1.0, 0, wallSet);
  expect(next.x).toBe(2); // x + 1 would put the circle inside the wall
});

it('slides along a wall when one axis is blocked', () => {
  const next = moveWithCollision({ x: 2, z: 2 }, 1.0, -0.5, wallSet);
  expect(next.x).toBe(2);      // blocked
  expect(next.z).toBe(1.5);    // free
});

it('does not mutate the input position', () => {
  const pos = { x: 0, z: 0 };
  moveWithCollision(pos, 0.5, 0.5, wallSet);
  expect(pos).toEqual({ x: 0, z: 0 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/collision.test.js`
Expected: FAIL — cannot resolve `../src/level/collision.js`.

- [ ] **Step 3: Implement `src/level/collision.js`**

```js
import { CELL } from './mapData.js';

export function collides(x, z, radius, wallSet, cell = CELL) {
  const c0 = Math.round((x - radius) / cell);
  const c1 = Math.round((x + radius) / cell);
  const r0 = Math.round((z - radius) / cell);
  const r1 = Math.round((z + radius) / cell);
  for (let c = c0; c <= c1; c++) {
    for (let r = r0; r <= r1; r++) {
      if (!wallSet.has(`${c},${r}`)) continue;
      // closest point on the wall cell's AABB to the player circle center
      const nx = Math.max(c * cell - cell / 2, Math.min(x, c * cell + cell / 2));
      const nz = Math.max(r * cell - cell / 2, Math.min(z, r * cell + cell / 2));
      if ((x - nx) ** 2 + (z - nz) ** 2 < radius * radius) return true;
    }
  }
  return false;
}

export function moveWithCollision(pos, dx, dz, wallSet, radius = 0.4, cell = CELL) {
  const out = { x: pos.x, z: pos.z };
  if (!collides(out.x + dx, out.z, radius, wallSet, cell)) out.x += dx;
  if (!collides(out.x, out.z + dz, radius, wallSet, cell)) out.z += dz;
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/collision.test.js`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/level/collision.js tests/collision.test.js
git commit -m "feat: add circle-vs-wall collision with axis sliding"
```

---

### Task 5: Scene bootstrap and grey-box rendering

**Files:**
- Create: `src/rendering/scene.js`
- Create: `src/level/buildGreybox.js`
- Modify: `src/main.js` (full replacement below)

**Interfaces:**
- Consumes: `parseMap`, `MAP`, `CELL` from `src/level/mapData.js`.
- Produces: `createScene(canvas) -> { renderer, scene, camera }` — WebGL renderer bound to the canvas, dark background + fog, `PerspectiveCamera` with `rotation.order = 'YXZ'`, window-resize handling; `buildGreybox(parsed) -> THREE.Group` — wall boxes, floor, and ceiling positioned per the grid convention (cell center at `c * CELL, r * CELL`).

This task is visual — no unit tests; verification is in the browser.

- [ ] **Step 1: Implement `src/rendering/scene.js`**

```js
import * as THREE from 'three';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0d12);
  scene.fog = new THREE.Fog(0x0a0d12, 2, 30);

  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.rotation.order = 'YXZ'; // yaw (Y) then pitch (X) — FPS convention

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera };
}
```

- [ ] **Step 2: Implement `src/level/buildGreybox.js`**

```js
import * as THREE from 'three';
import { CELL } from './mapData.js';

const WALL_HEIGHT = 3;

export function buildGreybox(parsed) {
  const group = new THREE.Group();

  const wallGeo = new THREE.BoxGeometry(CELL, WALL_HEIGHT, CELL);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a8f98 });
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
    new THREE.MeshStandardMaterial({ color: 0x4c515a }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centerX, 0, centerZ);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({ color: 0x3a3f47 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(centerX, WALL_HEIGHT, centerZ);

  group.add(floor, ceiling);
  return group;
}
```

- [ ] **Step 3: Replace `src/main.js` (static camera at spawn, temporary bright light)**

```js
import * as THREE from 'three';
import { createScene } from './rendering/scene.js';
import { MAP, parseMap } from './level/mapData.js';
import { buildGreybox } from './level/buildGreybox.js';

const canvas = document.getElementById('game');
const { renderer, scene, camera } = createScene(canvas);

const parsed = parseMap(MAP);
scene.add(buildGreybox(parsed));

// Temporary bright lighting so the grey-box is inspectable; dimmed in the flashlight task.
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

camera.position.set(parsed.spawn.x, 1.7, parsed.spawn.z);

renderer.setAnimationLoop(() => renderer.render(scene, camera));
```

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open the URL, click past the overlay if it blocks the view (it still covers the screen — that's expected until Task 6).
Expected: from the spawn point in the grand hall you see grey walls, a floor, and a ceiling receding into fog. No console errors.

- [ ] **Step 5: Run the full test suite (regression check)**

Run: `npm test`
Expected: all tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/rendering/scene.js src/level/buildGreybox.js src/main.js
git commit -m "feat: render grey-box mansion from tile map"
```

---

### Task 6: Mouse look and pointer lock

**Files:**
- Create: `src/player/look.js`
- Create: `src/player/pointerLock.js`
- Modify: `src/main.js` (full replacement below)
- Test: `tests/look.test.js`

**Interfaces:**
- Consumes: DOM contract from Task 1 (`#game` canvas, `#overlay` with `hidden` attribute); `createScene` camera with `rotation.order = 'YXZ'`.
- Produces: `createLook() -> { yaw: number, pitch: number }` (radians, both start at 0); `applyLookDelta(look, dx, dy, sensitivity = 0.002)` — mutates `look`; yaw decreases with rightward mouse movement, pitch is clamped to ±(π/2 − 0.01); `setupPointerLock(element, { onLocked, onUnlocked, onMouseDelta }) -> { request(), isLocked() }`.

- [ ] **Step 1: Write the failing tests**

`tests/look.test.js`:

```js
import { it, expect } from 'vitest';
import { createLook, applyLookDelta } from '../src/player/look.js';

it('starts level and centered', () => {
  expect(createLook()).toEqual({ yaw: 0, pitch: 0 });
});

it('turns right (yaw decreases) when the mouse moves right', () => {
  const look = createLook();
  applyLookDelta(look, 100, 0);
  expect(look.yaw).toBeCloseTo(-0.2);
  expect(look.pitch).toBe(0);
});

it('looks up (pitch increases) when the mouse moves up', () => {
  const look = createLook();
  applyLookDelta(look, 0, -100); // negative dy = mouse up
  expect(look.pitch).toBeCloseTo(0.2);
});

it('clamps pitch so the view cannot flip over', () => {
  const look = createLook();
  applyLookDelta(look, 0, -100000);
  expect(look.pitch).toBeCloseTo(Math.PI / 2 - 0.01);
  applyLookDelta(look, 0, 100000);
  expect(look.pitch).toBeCloseTo(-(Math.PI / 2 - 0.01));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/look.test.js`
Expected: FAIL — cannot resolve `../src/player/look.js`.

- [ ] **Step 3: Implement `src/player/look.js`**

```js
const PITCH_LIMIT = Math.PI / 2 - 0.01;

export function createLook() {
  return { yaw: 0, pitch: 0 };
}

export function applyLookDelta(look, dx, dy, sensitivity = 0.002) {
  look.yaw -= dx * sensitivity;
  look.pitch -= dy * sensitivity;
  look.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, look.pitch));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/look.test.js`
Expected: 4 passed.

- [ ] **Step 5: Implement `src/player/pointerLock.js`** (thin DOM layer — no unit tests, verified in browser)

```js
export function setupPointerLock(element, { onLocked, onUnlocked, onMouseDelta }) {
  function isLocked() {
    return document.pointerLockElement === element;
  }

  document.addEventListener('pointerlockchange', () => {
    if (isLocked()) onLocked();
    else onUnlocked();
  });

  document.addEventListener('mousemove', (e) => {
    if (isLocked()) onMouseDelta(e.movementX, e.movementY);
  });

  return {
    request: () => element.requestPointerLock(),
    isLocked,
  };
}
```

- [ ] **Step 6: Replace `src/main.js` (wire look + pointer lock, camera still fixed at spawn)**

```js
import * as THREE from 'three';
import { createScene } from './rendering/scene.js';
import { MAP, parseMap } from './level/mapData.js';
import { buildGreybox } from './level/buildGreybox.js';
import { createLook, applyLookDelta } from './player/look.js';
import { setupPointerLock } from './player/pointerLock.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const { renderer, scene, camera } = createScene(canvas);

const parsed = parseMap(MAP);
scene.add(buildGreybox(parsed));

// Temporary bright lighting so the grey-box is inspectable; dimmed in the flashlight task.
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const look = createLook();

const lock = setupPointerLock(canvas, {
  onLocked: () => { overlay.hidden = true; },
  onUnlocked: () => { overlay.hidden = false; },
  onMouseDelta: (dx, dy) => applyLookDelta(look, dx, dy),
});
overlay.addEventListener('click', () => lock.request());

camera.position.set(parsed.spawn.x, 1.7, parsed.spawn.z);

renderer.setAnimationLoop(() => {
  camera.rotation.set(look.pitch, look.yaw, 0);
  renderer.render(scene, camera);
});
```

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`.
Expected: clicking the overlay locks the pointer and hides the overlay; moving the mouse looks around smoothly; looking straight up/down stops before flipping; pressing Esc releases the pointer and the overlay returns.

- [ ] **Step 8: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/player/look.js src/player/pointerLock.js src/main.js tests/look.test.js
git commit -m "feat: add pointer-lock mouse look with pitch clamp"
```

---

### Task 7: WASD movement with sprint and collision

**Files:**
- Create: `src/player/movement.js`
- Modify: `src/main.js` (full replacement below)
- Test: `tests/movement.test.js`

**Interfaces:**
- Consumes: `look.yaw` from Task 6; `moveWithCollision` from Task 4; `createGameLoop` from Task 2.
- Produces: `WALK_SPEED = 3.5`, `SPRINT_SPEED = 5.5` (m/s); `computeWishDir(keys, yaw) -> {x, z}` — world-space direction, normalized to length 1 (or `{x: 0, z: 0}` with no input). `keys` is `{ forward, back, left, right }` booleans. Yaw 0 faces −Z.

- [ ] **Step 1: Write the failing tests**

`tests/movement.test.js`:

```js
import { it, expect } from 'vitest';
import { computeWishDir, WALK_SPEED, SPRINT_SPEED } from '../src/player/movement.js';

const none = { forward: false, back: false, left: false, right: false };

it('moves toward -Z when facing forward (yaw 0)', () => {
  const dir = computeWishDir({ ...none, forward: true }, 0);
  expect(dir.x).toBeCloseTo(0);
  expect(dir.z).toBeCloseTo(-1);
});

it('strafes right toward +X at yaw 0', () => {
  const dir = computeWishDir({ ...none, right: true }, 0);
  expect(dir.x).toBeCloseTo(1);
  expect(dir.z).toBeCloseTo(0);
});

it('rotates with yaw: forward at yaw π/2 moves toward -X', () => {
  const dir = computeWishDir({ ...none, forward: true }, Math.PI / 2);
  expect(dir.x).toBeCloseTo(-1);
  expect(dir.z).toBeCloseTo(0);
});

it('normalizes diagonals to length 1', () => {
  const dir = computeWishDir({ ...none, forward: true, right: true }, 0);
  expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1);
});

it('returns zero vector with no input and with opposing keys', () => {
  expect(computeWishDir(none, 1.23)).toEqual({ x: 0, z: 0 });
  expect(computeWishDir({ ...none, forward: true, back: true }, 0)).toEqual({ x: 0, z: 0 });
});

it('exports walk and sprint speeds', () => {
  expect(WALK_SPEED).toBe(3.5);
  expect(SPRINT_SPEED).toBe(5.5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/movement.test.js`
Expected: FAIL — cannot resolve `../src/player/movement.js`.

- [ ] **Step 3: Implement `src/player/movement.js`**

```js
export const WALK_SPEED = 3.5;   // m/s
export const SPRINT_SPEED = 5.5; // m/s

export function computeWishDir(keys, yaw) {
  const f = (keys.forward ? 1 : 0) - (keys.back ? 1 : 0);
  const r = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

  // forward at yaw 0 is (0, -1); right is (1, 0)
  let x = -Math.sin(yaw) * f + Math.cos(yaw) * r;
  let z = -Math.cos(yaw) * f - Math.sin(yaw) * r;

  const len = Math.hypot(x, z);
  if (len < 1e-6) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/movement.test.js`
Expected: 6 passed.

- [ ] **Step 5: Replace `src/main.js` (movement wired through the game loop)**

```js
import * as THREE from 'three';
import { createScene } from './rendering/scene.js';
import { MAP, parseMap } from './level/mapData.js';
import { buildGreybox } from './level/buildGreybox.js';
import { moveWithCollision } from './level/collision.js';
import { createGameLoop } from './core/gameLoop.js';
import { createLook, applyLookDelta } from './player/look.js';
import { setupPointerLock } from './player/pointerLock.js';
import { computeWishDir, WALK_SPEED, SPRINT_SPEED } from './player/movement.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const { renderer, scene, camera } = createScene(canvas);

const parsed = parseMap(MAP);
scene.add(buildGreybox(parsed));

// Temporary bright lighting so the grey-box is inspectable; dimmed in the flashlight task.
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const EYE_HEIGHT = 1.7;
const player = { x: parsed.spawn.x, z: parsed.spawn.z };
const look = createLook();
const keys = { forward: false, back: false, left: false, right: false, sprint: false };

function setKey(code, down) {
  if (code === 'KeyW') keys.forward = down;
  if (code === 'KeyS') keys.back = down;
  if (code === 'KeyA') keys.left = down;
  if (code === 'KeyD') keys.right = down;
  if (code === 'ShiftLeft') keys.sprint = down;
}
window.addEventListener('keydown', (e) => setKey(e.code, true));
window.addEventListener('keyup', (e) => setKey(e.code, false));

const lock = setupPointerLock(canvas, {
  onLocked: () => { overlay.hidden = true; },
  onUnlocked: () => { overlay.hidden = false; },
  onMouseDelta: (dx, dy) => applyLookDelta(look, dx, dy),
});
overlay.addEventListener('click', () => lock.request());

const loop = createGameLoop((dt) => {
  if (lock.isLocked()) {
    const wish = computeWishDir(keys, look.yaw);
    const speed = keys.sprint ? SPRINT_SPEED : WALK_SPEED;
    const next = moveWithCollision(player, wish.x * speed * dt, wish.z * speed * dt, parsed.wallSet);
    player.x = next.x;
    player.z = next.z;
  }
  camera.position.set(player.x, EYE_HEIGHT, player.z);
  camera.rotation.set(look.pitch, look.yaw, 0);
  renderer.render(scene, camera);
});
loop.start();
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`.
Expected: WASD walks through the mansion, Shift sprints noticeably faster, walls block you and you slide along them, doorways let you pass into every room, Esc pauses (movement stops, overlay returns), clicking resumes.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/player/movement.js src/main.js tests/movement.test.js
git commit -m "feat: add WASD movement with sprint and wall sliding"
```

---

### Task 8: Flashlight and dark lighting

**Files:**
- Create: `src/player/flashlight.js`
- Modify: `src/main.js` (two small edits, shown below)
- Test: `tests/flashlight.test.js`

**Interfaces:**
- Consumes: the `camera` from `createScene` (flashlight parents itself to it); `setKey` keyboard handling in `main.js`.
- Produces: `createFlashlight(camera) -> { toggle() -> boolean, isOn() -> boolean, light }`. Starts on; `toggle()` flips `light.visible` and returns the new state. The camera must be added to the scene so its child light renders.

- [ ] **Step 1: Write the failing tests**

`tests/flashlight.test.js`:

```js
import { it, expect } from 'vitest';
import * as THREE from 'three';
import { createFlashlight } from '../src/player/flashlight.js';

it('starts on and toggles off and back on', () => {
  const camera = new THREE.PerspectiveCamera();
  const flashlight = createFlashlight(camera);
  expect(flashlight.isOn()).toBe(true);
  expect(flashlight.light.visible).toBe(true);
  expect(flashlight.toggle()).toBe(false);
  expect(flashlight.light.visible).toBe(false);
  expect(flashlight.toggle()).toBe(true);
  expect(flashlight.light.visible).toBe(true);
});

it('attaches the light and its target to the camera', () => {
  const camera = new THREE.PerspectiveCamera();
  const flashlight = createFlashlight(camera);
  expect(flashlight.light.parent).toBe(camera);
  expect(flashlight.light.target.parent).toBe(camera);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/flashlight.test.js`
Expected: FAIL — cannot resolve `../src/player/flashlight.js`.

- [ ] **Step 3: Implement `src/player/flashlight.js`**

```js
import * as THREE from 'three';

export function createFlashlight(camera) {
  const light = new THREE.SpotLight(0xfff2d8, 8, 18, Math.PI / 7, 0.4, 1.2);
  light.position.set(0.15, -0.1, 0); // slightly off-center, like a hand-held light

  const target = new THREE.Object3D();
  target.position.set(0, 0, -5);
  camera.add(light, target);
  light.target = target;

  let on = true;
  return {
    toggle() {
      on = !on;
      light.visible = on;
      return on;
    },
    isOn: () => on,
    light,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/flashlight.test.js`
Expected: 2 passed.

- [ ] **Step 5: Edit `src/main.js` — replace the temporary bright light with dark ambience + flashlight**

Replace:

```js
// Temporary bright lighting so the grey-box is inspectable; dimmed in the flashlight task.
scene.add(new THREE.AmbientLight(0xffffff, 1.2));
```

with:

```js
import { createFlashlight } from './player/flashlight.js'; // add to the imports at the top

scene.add(new THREE.AmbientLight(0x27303f, 0.4)); // faint cold moonlight fill
scene.add(camera); // the flashlight is a child of the camera
const flashlight = createFlashlight(camera);
```

And extend `setKey` with the toggle:

```js
function setKey(code, down) {
  if (code === 'KeyW') keys.forward = down;
  if (code === 'KeyS') keys.back = down;
  if (code === 'KeyA') keys.left = down;
  if (code === 'KeyD') keys.right = down;
  if (code === 'ShiftLeft') keys.sprint = down;
  if (code === 'KeyF' && down) flashlight.toggle();
}
```

- [ ] **Step 6: Verify in the browser**

Run: `npm run dev`.
Expected: the mansion is now dark — rooms are barely visible in cold blue-grey; the flashlight throws a warm cone that lights walls ahead; F toggles it; with it off, you can still just barely navigate. Frame rate stays smooth while walking.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/player/flashlight.js src/main.js tests/flashlight.test.js
git commit -m "feat: add flashlight and dark mansion lighting"
```

---

### Task 9: README and Milestone 1 acceptance

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything built in Tasks 1–8.
- Produces: documented run instructions; a verified, committed Milestone 1.

- [ ] **Step 1: Write `README.md`**

```markdown
# Mansion (working title)

A stylized survival-horror FPS for the browser. Three.js + Vite, plain
JavaScript. See `docs/superpowers/specs/` for the design and
`docs/superpowers/plans/` for implementation plans.

## Run

    npm install
    npm run dev    # dev server
    npm test       # unit tests
    npm run build  # production build to dist/

## Controls

| Input | Action |
|---|---|
| Click | Start / resume (locks the mouse) |
| WASD | Move |
| Mouse | Look |
| Shift | Sprint |
| F | Flashlight on/off |
| Esc | Pause (releases the mouse) |

## Status

Milestone 1 (grey-box mansion) complete: walkable tile-map mansion,
pointer-lock FPS controls, wall collision with sliding, flashlight.
Next: Milestone 2 — the "dark ink & toon" art pass.
```

- [ ] **Step 2: Full acceptance walkthrough**

Run: `npm test` — Expected: all tests pass.
Run: `npm run build` — Expected: clean production build.
Run: `npm run dev` and verify each item:

1. Overlay shows title and controls; click starts the game.
2. Every room of the mansion is reachable through its doorways.
3. You cannot clip through any wall, including corners; sliding along walls feels smooth.
4. Sprint is clearly faster than walking; diagonal movement is not faster than straight.
5. Flashlight toggles with F; the mansion is dark but navigable without it.
6. Esc pauses (movement and look stop, overlay returns); click resumes with the previous position/view intact.
7. Resizing the browser window keeps the image un-stretched.
8. No errors in the browser console.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README; complete milestone 1 (grey-box mansion)"
```
