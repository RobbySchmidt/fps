# Milestone 3b: The Wanderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a hunting, mantis-bladed monster in the mansion: A* pathfinding, a jittery stop-motion figure, stagger and headshot kills, and a player who can be killed and retry instantly.

**Architecture:** Pure logic (pathfinding, line of sight, motion-style math, AI state machine, health, game state) lives in DOM-free, clock-injected modules unit-tested with Vitest. Three.js work (the figure's meshes and procedural animation, screen shake) stays thin, and `src/main.js` only wires them together. The AI owns its own position and reuses the existing `moveWithCollision` so the monster obeys the same walls the player does.

**Tech Stack:** Three.js, Vite, Vitest, plain JavaScript.

**Spec:** `docs/superpowers/specs/2026-08-09-milestone-3b-wanderer-design.md`. Prior state: Milestones 1, 2 and 3a merged (mansion, art pass, jump + revolver + HUD), 51 tests passing on `main`.

## Global Constraints

- Plain JavaScript with ES modules — no TypeScript. No new dependencies.
- Logic modules must not touch `document`/`window`; time enters logic as injected seconds (`dt`, `now`).
- All colors come from `src/rendering/palette.js` (shader-internal defaults excepted).
- Existing grid convention: `CELL = 2`; grid cell `(c, r)` has its center at world `(c * CELL, r * CELL)`; `wallSet` holds `` `${c},${r}` `` keys.
- The keydown listener in `main.js` starts with an `e.repeat` early return — new bindings go after it and inherit it.
- Enemy and player simulation only advance inside the `lock.isLocked()` block, so pausing freezes the monster too.
- Combat numbers in this plan are the spec's starting values and are expected to be tuned during playtest; keep them as named constants, never inline literals.
- Commit after every task with the message given in the task.

---

### Task 1: A* pathfinding and line of sight

**Files:**
- Create: `src/level/pathfinding.js`
- Test: `tests/pathfinding.test.js`

**Interfaces:**
- Consumes: `CELL` from `src/level/mapData.js`; `wallSet` from `parseMap`.
- Produces: `worldToCell(x, z, cell = CELL) -> { c, r }`; `cellToWorld(c, r, cell = CELL) -> { x, z }`; `findPath(start, goal, wallSet) -> Array<{c, r}> | null` (4-neighbour A* on the tile grid; the returned path includes the start cell and the goal cell; `null` when either end is a wall or no route exists); `hasLineOfSight(from, to, wallSet, cell = CELL) -> boolean` (samples the segment between two world points and fails if it crosses a wall cell).

- [ ] **Step 1: Write the failing tests**

`tests/pathfinding.test.js`:

```js
import { it, expect } from 'vitest';
import { findPath, worldToCell, cellToWorld, hasLineOfSight } from '../src/level/pathfinding.js';
import { CELL } from '../src/level/mapData.js';

// A 5x5 room with a wall stub at (2,1) and (2,2):
// #####
// #.#.#
// #.#.#
// #...#
// #####
const wallSet = new Set([
  '0,0', '1,0', '2,0', '3,0', '4,0',
  '0,1', '2,1', '4,1',
  '0,2', '2,2', '4,2',
  '0,3', '4,3',
  '0,4', '1,4', '2,4', '3,4', '4,4',
]);

it('converts between world metres and grid cells', () => {
  expect(worldToCell(4, 6)).toEqual({ c: 2, r: 3 });
  expect(cellToWorld(2, 3)).toEqual({ x: 2 * CELL, z: 3 * CELL });
});

it('finds a straight path down an open column', () => {
  const path = findPath({ c: 1, r: 1 }, { c: 1, r: 3 }, wallSet);
  expect(path).toEqual([{ c: 1, r: 1 }, { c: 1, r: 2 }, { c: 1, r: 3 }]);
});

it('routes around a wall instead of through it', () => {
  const path = findPath({ c: 1, r: 1 }, { c: 3, r: 1 }, wallSet);
  expect(path).not.toBeNull();
  expect(path[0]).toEqual({ c: 1, r: 1 });
  expect(path[path.length - 1]).toEqual({ c: 3, r: 1 });
  expect(path.some((cell) => wallSet.has(`${cell.c},${cell.r}`))).toBe(false);
  expect(path.length).toBe(7); // down, across the bottom, back up
});

it('returns null when the goal is a wall', () => {
  expect(findPath({ c: 1, r: 1 }, { c: 2, r: 1 }, wallSet)).toBeNull();
});

it('returns null when the goal is unreachable', () => {
  const sealed = new Set([...wallSet, '1,3']); // seals the left column off from the bottom row
  expect(findPath({ c: 1, r: 1 }, { c: 3, r: 1 }, sealed)).toBeNull();
});

it('returns a single-cell path when already at the goal', () => {
  expect(findPath({ c: 1, r: 1 }, { c: 1, r: 1 }, wallSet)).toEqual([{ c: 1, r: 1 }]);
});

it('sees along an open line and not through a wall', () => {
  const a = cellToWorld(1, 1);
  const b = cellToWorld(1, 3);
  const acrossTheStub = cellToWorld(3, 1);
  expect(hasLineOfSight(a, b, wallSet)).toBe(true);
  expect(hasLineOfSight(a, acrossTheStub, wallSet)).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/pathfinding.test.js`
Expected: FAIL — cannot resolve `../src/level/pathfinding.js`.

- [ ] **Step 3: Implement `src/level/pathfinding.js`**

```js
import { CELL } from './mapData.js';

const NEIGHBOURS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 },
];

export function worldToCell(x, z, cell = CELL) {
  return { c: Math.round(x / cell), r: Math.round(z / cell) };
}

export function cellToWorld(c, r, cell = CELL) {
  return { x: c * cell, z: r * cell };
}

function manhattan(a, b) {
  return Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
}

function reconstruct(cameFrom, endKey) {
  const path = [];
  let key = endKey;
  while (key !== undefined) {
    const [c, r] = key.split(',').map(Number);
    path.unshift({ c, r });
    key = cameFrom.get(key);
  }
  return path;
}

export function findPath(start, goal, wallSet) {
  const startKey = `${start.c},${start.r}`;
  const goalKey = `${goal.c},${goal.r}`;
  if (wallSet.has(startKey) || wallSet.has(goalKey)) return null;
  if (startKey === goalKey) return [{ c: start.c, r: start.r }];

  const open = [{ c: start.c, r: start.r, g: 0, f: manhattan(start, goal) }];
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const closed = new Set();

  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
    const current = open.splice(best, 1)[0];
    const currentKey = `${current.c},${current.r}`;
    if (currentKey === goalKey) return reconstruct(cameFrom, currentKey);
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);

    for (const { dc, dr } of NEIGHBOURS) {
      const c = current.c + dc;
      const r = current.r + dr;
      const key = `${c},${r}`;
      if (wallSet.has(key) || closed.has(key)) continue;
      const tentative = current.g + 1;
      if (gScore.has(key) && tentative >= gScore.get(key)) continue;
      gScore.set(key, tentative);
      cameFrom.set(key, currentKey);
      open.push({ c, r, g: tentative, f: tentative + manhattan({ c, r }, goal) });
    }
  }
  return null;
}

export function hasLineOfSight(from, to, wallSet, cell = CELL) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.ceil(distance / (cell * 0.25));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const { c, r } = worldToCell(x, z, cell);
    if (wallSet.has(`${c},${r}`)) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/pathfinding.test.js`
Expected: 7 passed.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — all pass.

```bash
git add src/level/pathfinding.js tests/pathfinding.test.js
git commit -m "feat: add A* grid pathfinding and line-of-sight checks"
```

---

### Task 2: Player health with delayed regeneration

**Files:**
- Create: `src/player/health.js`
- Test: `tests/health.test.js`

**Interfaces:**
- Consumes: nothing (pure, clock-injected).
- Produces: `createHealth({ max = 100, regenDelay = 5, regenRate = 12 } = {}) -> { hp(), max(), fraction(), isDead(), damage(amount, now), update(now), reset() }`. `now` is game-seconds. Regeneration starts only once `regenDelay` seconds have passed since the last damage, then adds `regenRate` HP per second up to `max`. A dead player never regenerates.

- [ ] **Step 1: Write the failing tests**

`tests/health.test.js`:

```js
import { it, expect } from 'vitest';
import { createHealth } from '../src/player/health.js';

it('starts full', () => {
  const health = createHealth();
  expect(health.hp()).toBe(100);
  expect(health.max()).toBe(100);
  expect(health.fraction()).toBe(1);
  expect(health.isDead()).toBe(false);
});

it('takes damage and reports a fraction', () => {
  const health = createHealth();
  health.damage(25, 0);
  expect(health.hp()).toBe(75);
  expect(health.fraction()).toBeCloseTo(0.75);
});

it('does not regenerate before the delay elapses', () => {
  const health = createHealth();
  health.damage(50, 0);
  health.update(0);
  health.update(4.9);
  expect(health.hp()).toBe(50);
});

it('regenerates at the configured rate after the delay', () => {
  const health = createHealth();
  health.damage(50, 0);
  health.update(0);
  health.update(5);   // delay reached, no time accrued yet for regen
  health.update(6);   // one second of regen
  expect(health.hp()).toBeCloseTo(62);
});

it('never regenerates above max', () => {
  const health = createHealth();
  health.damage(5, 0);
  health.update(0);
  health.update(100);
  expect(health.hp()).toBe(100);
});

it('dies at zero and stays dead', () => {
  const health = createHealth();
  health.damage(150, 0);
  expect(health.hp()).toBe(0);
  expect(health.isDead()).toBe(true);
  health.update(0);
  health.update(50);
  expect(health.hp()).toBe(0);
});

it('reset restores full health', () => {
  const health = createHealth();
  health.damage(100, 0);
  health.reset();
  expect(health.hp()).toBe(100);
  expect(health.isDead()).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/health.test.js`
Expected: FAIL — cannot resolve `../src/player/health.js`.

- [ ] **Step 3: Implement `src/player/health.js`**

```js
export function createHealth({ max = 100, regenDelay = 5, regenRate = 12 } = {}) {
  let hp = max;
  let lastDamageAt = -Infinity;
  let lastUpdateAt = null;

  return {
    hp: () => hp,
    max: () => max,
    fraction: () => hp / max,
    isDead: () => hp <= 0,
    damage(amount, now) {
      if (hp <= 0) return;
      hp = Math.max(0, hp - amount);
      lastDamageAt = now;
    },
    update(now) {
      const dt = lastUpdateAt === null ? 0 : now - lastUpdateAt;
      lastUpdateAt = now;
      if (hp <= 0 || hp >= max) return;
      if (now - lastDamageAt < regenDelay) return;
      hp = Math.min(max, hp + regenRate * dt);
    },
    reset() {
      hp = max;
      lastDamageAt = -Infinity;
      lastUpdateAt = null;
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/health.test.js`
Expected: 7 passed.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — all pass.

```bash
git add src/player/health.js tests/health.test.js
git commit -m "feat: add player health with delayed regeneration"
```

---

### Task 3: Motion-style helpers (the "wrong movement" math)

**Files:**
- Create: `src/enemy/movementStyle.js`
- Test: `tests/movementStyle.test.js`

**Interfaces:**
- Consumes: nothing (pure).
- Produces: `quantizeTime(t, fps = 10) -> number` (snaps a continuous time onto discrete animation frames — the stop-motion look); `burstFreezeFactor(t, { burst = 0.55, freeze = 0.25 } = {}) -> 1 | 0` (speed multiplier alternating between full speed and a dead stop); `serpentineDirection(from, to, t, { amplitude = 0.7, frequency = 2.6 } = {}) -> { x, z }` (unit direction toward `to`, rotated by a weaving offset so the approach cuts side to side; returns `{ x: 0, z: 0 }` when already at the target).

- [ ] **Step 1: Write the failing tests**

`tests/movementStyle.test.js`:

```js
import { it, expect } from 'vitest';
import { quantizeTime, burstFreezeFactor, serpentineDirection } from '../src/enemy/movementStyle.js';

it('quantizes time onto 10fps animation frames', () => {
  expect(quantizeTime(0.04)).toBeCloseTo(0);
  expect(quantizeTime(0.09)).toBeCloseTo(0);
  expect(quantizeTime(0.11)).toBeCloseTo(0.1);
  expect(quantizeTime(0.35)).toBeCloseTo(0.3);
});

it('holds a pose for the whole animation frame', () => {
  expect(quantizeTime(1.21)).toBe(quantizeTime(1.29));
  expect(quantizeTime(1.21)).not.toBe(quantizeTime(1.31));
});

it('alternates bursts of movement with dead stops', () => {
  expect(burstFreezeFactor(0)).toBe(1);
  expect(burstFreezeFactor(0.5)).toBe(1);
  expect(burstFreezeFactor(0.6)).toBe(0);
  expect(burstFreezeFactor(0.79)).toBe(0);
  expect(burstFreezeFactor(0.81)).toBe(1); // next cycle
});

it('serpentine direction is a unit vector', () => {
  const dir = serpentineDirection({ x: 0, z: 0 }, { x: 10, z: 0 }, 0.3);
  expect(Math.hypot(dir.x, dir.z)).toBeCloseTo(1);
});

it('serpentine points straight at the target when the weave crosses zero', () => {
  const dir = serpentineDirection({ x: 0, z: 0 }, { x: 10, z: 0 }, 0);
  expect(dir.x).toBeCloseTo(1);
  expect(dir.z).toBeCloseTo(0);
});

it('serpentine deviates sideways between zero crossings', () => {
  const t = Math.PI / 2 / 2.6; // sin(frequency * t) === 1
  const dir = serpentineDirection({ x: 0, z: 0 }, { x: 10, z: 0 }, t);
  expect(Math.abs(dir.z)).toBeGreaterThan(0.4);
  expect(dir.x).toBeGreaterThan(0); // still closing on the target
});

it('returns a zero vector when already at the target', () => {
  expect(serpentineDirection({ x: 3, z: 3 }, { x: 3, z: 3 }, 1)).toEqual({ x: 0, z: 0 });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/movementStyle.test.js`
Expected: FAIL — cannot resolve `../src/enemy/movementStyle.js`.

- [ ] **Step 3: Implement `src/enemy/movementStyle.js`**

```js
// Motion maths that give the Wanderer its deliberately "wrong" look.

// Stop-motion: snap continuous time onto discrete animation frames so limbs
// arrive at poses instead of gliding to them.
export function quantizeTime(t, fps = 10) {
  return Math.floor(t * fps) / fps;
}

// Burst-freeze: full speed, then a dead stop, repeating. The stops are the
// player's shooting windows.
export function burstFreezeFactor(t, { burst = 0.55, freeze = 0.25 } = {}) {
  return t % (burst + freeze) < burst ? 1 : 0;
}

// Serpentine: head for the target, but weave hard from side to side.
export function serpentineDirection(from, to, t, { amplitude = 0.7, frequency = 2.6 } = {}) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return { x: 0, z: 0 };

  const fx = dx / length;
  const fz = dz / length;
  const weave = Math.sin(t * frequency) * amplitude;
  // (-fz, fx) is the perpendicular of the forward direction in the XZ plane
  const x = fx - fz * weave;
  const z = fz + fx * weave;
  const outLength = Math.hypot(x, z);
  return { x: x / outLength, z: z / outLength };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/movementStyle.test.js`
Expected: 7 passed.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — all pass.

```bash
git add src/enemy/movementStyle.js tests/movementStyle.test.js
git commit -m "feat: add stop-motion, burst-freeze and serpentine motion helpers"
```

---

### Task 4: The Wanderer AI state machine

**Files:**
- Create: `src/enemy/wandererAI.js`
- Test: `tests/wandererAI.test.js`

**Interfaces:**
- Consumes: `moveWithCollision` from `src/level/collision.js`; `findPath`, `worldToCell`, `cellToWorld`, `hasLineOfSight` from `src/level/pathfinding.js`; `burstFreezeFactor`, `serpentineDirection` from `src/enemy/movementStyle.js`.
- Produces: `WANDERER_CONFIG` (all tunable numbers) and `createWandererAI({ spawn, wallSet, waypoints, config = {} }) -> { state(), position(), facing(), health(), isDead(), update(dt, player) -> { attacked }, takeHit({ damage, headshot = false, from = null }) -> { killed }, hearNoise({ x, z, loudness = 1 }), reset() }`.
  - `state()` is one of `'patrol' | 'investigate' | 'chase' | 'windup' | 'attack' | 'stagger' | 'dead'`.
  - `position()` returns a copy `{ x, z }`; `facing()` is a yaw in radians produced by `Math.atan2(dirX, dirZ)`.
  - `update` returns `{ attacked: true }` on the single frame a swipe connects; the caller applies damage to the player.
  - `waypoints` is an array of `{ x, z }` world positions (the caller passes the mansion's lamp positions).

- [ ] **Step 1: Write the failing tests**

`tests/wandererAI.test.js`:

```js
import { it, expect } from 'vitest';
import { createWandererAI, WANDERER_CONFIG } from '../src/enemy/wandererAI.js';
import { CELL } from '../src/level/mapData.js';

// An open 9x9 arena: only the border is wall, so cells 1..7 are walkable.
function makeArena() {
  const wallSet = new Set();
  for (let i = 0; i < 9; i++) {
    wallSet.add(`${i},0`);
    wallSet.add(`${i},8`);
    wallSet.add(`0,${i}`);
    wallSet.add(`8,${i}`);
  }
  return wallSet;
}

const wallSet = makeArena();
const spawn = { x: 2 * CELL, z: 2 * CELL };
const waypoints = [{ x: 6 * CELL, z: 2 * CELL }, { x: 6 * CELL, z: 6 * CELL }];
const far = { x: 7 * CELL, z: 7 * CELL };

function makeAI(config = {}) {
  return createWandererAI({ spawn, wallSet, waypoints, config });
}

function run(ai, seconds, player, dt = 1 / 60) {
  let events = { attacked: false };
  for (let t = 0; t < seconds; t += dt) {
    const step = ai.update(dt, player);
    if (step.attacked) events.attacked = true;
  }
  return events;
}

it('starts patrolling and walks toward its first waypoint', () => {
  const ai = makeAI();
  expect(ai.state()).toBe('patrol');
  const before = ai.position();
  run(ai, 1, far);
  const after = ai.position();
  expect(after.x).toBeGreaterThan(before.x);
});

it('investigates a noise it can hear', () => {
  const ai = makeAI();
  ai.hearNoise({ x: 6 * CELL, z: 6 * CELL, loudness: 1 });
  expect(ai.state()).toBe('investigate');
  const before = ai.position();
  run(ai, 1, far);
  expect(ai.position().z).toBeGreaterThan(before.z);
});

it('ignores a quiet noise from far away', () => {
  const ai = makeAI();
  ai.hearNoise({ x: 7 * CELL, z: 7 * CELL, loudness: 0.05 });
  expect(ai.state()).toBe('patrol');
});

it('chases a player it can see and closes the distance', () => {
  const ai = makeAI();
  const player = { x: 5 * CELL, z: 2 * CELL }; // straight ahead down the row
  const startDistance = Math.hypot(player.x - spawn.x, player.z - spawn.z);
  run(ai, 0.5, player);
  expect(ai.state()).toBe('chase');
  const now = ai.position();
  expect(Math.hypot(player.x - now.x, player.z - now.z)).toBeLessThan(startDistance);
});

it('winds up and then lands one attack when it reaches the player', () => {
  const ai = makeAI();
  const player = { x: 3 * CELL, z: 2 * CELL }; // very close
  run(ai, 0.4, player);
  expect(['chase', 'windup']).toContain(ai.state());
  const events = run(ai, 1.5, player);
  expect(events.attacked).toBe(true);
});

it('a hit staggers it and interrupts the wind-up', () => {
  const ai = makeAI();
  const player = { x: 3 * CELL, z: 2 * CELL };
  run(ai, 1, player);
  ai.takeHit({ damage: 30, from: player });
  expect(ai.state()).toBe('stagger');
  expect(ai.health()).toBe(WANDERER_CONFIG.maxHealth - 30);
});

it('a headshot kills instantly at full health', () => {
  const ai = makeAI();
  const result = ai.takeHit({ damage: 30, headshot: true, from: far });
  expect(result.killed).toBe(true);
  expect(ai.isDead()).toBe(true);
  expect(ai.state()).toBe('dead');
});

it('four body shots kill it', () => {
  const ai = makeAI();
  for (let i = 0; i < 3; i++) ai.takeHit({ damage: 30, from: far });
  expect(ai.isDead()).toBe(false);
  const result = ai.takeHit({ damage: 30, from: far });
  expect(result.killed).toBe(true);
  expect(ai.isDead()).toBe(true);
});

it('a dead Wanderer stops moving and cannot attack', () => {
  const ai = makeAI();
  ai.takeHit({ damage: 999, from: far });
  const restingPlace = ai.position();
  const events = run(ai, 2, { x: 2 * CELL, z: 2 * CELL });
  expect(ai.position()).toEqual(restingPlace);
  expect(events.attacked).toBe(false);
});

it('gives up and returns to patrol after losing the player for long enough', () => {
  const ai = makeAI();
  const seen = { x: 5 * CELL, z: 2 * CELL };
  run(ai, 0.5, seen);
  expect(ai.state()).toBe('chase');
  // teleport the player somewhere it cannot see and wait out the timer
  run(ai, WANDERER_CONFIG.loseSightTime + 1, { x: 1000, z: 1000 });
  expect(ai.state()).toBe('patrol');
});

it('reset returns it to the spawn, full health and patrolling', () => {
  const ai = makeAI();
  run(ai, 1, { x: 3 * CELL, z: 2 * CELL });
  ai.takeHit({ damage: 60, from: far });
  ai.reset();
  expect(ai.state()).toBe('patrol');
  expect(ai.health()).toBe(WANDERER_CONFIG.maxHealth);
  expect(ai.position()).toEqual(spawn);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/wandererAI.test.js`
Expected: FAIL — cannot resolve `../src/enemy/wandererAI.js`.

- [ ] **Step 3: Implement `src/enemy/wandererAI.js`**

```js
import { moveWithCollision } from '../level/collision.js';
import { findPath, worldToCell, cellToWorld, hasLineOfSight } from '../level/pathfinding.js';
import { burstFreezeFactor, serpentineDirection } from './movementStyle.js';

export const WANDERER_CONFIG = {
  maxHealth: 100,
  radius: 0.45,
  patrolSpeed: 1.8,
  investigateSpeed: 3.0,
  chaseSpeed: 7.5,          // faster than the player's 5.5 sprint: it cannot be outrun
  sightRange: 14,
  sightHalfAngle: (50 * Math.PI) / 180,
  proximityRange: 3.5,      // senses the player this close regardless of facing
  hearingRange: 30,         // multiplied by a noise's loudness
  meleeRange: 1.9,
  windupTime: 0.45,         // the telegraph: all jitter stops
  attackTime: 0.25,
  recoverTime: 0.5,
  staggerTime: 0.35,
  knockback: 0.45,
  loseSightTime: 6,
  investigateTime: 4,
  repathInterval: 0.4,
  arriveRadius: 0.35,
  waypointRadius: 0.8,
};

function normalize(x, z) {
  const length = Math.hypot(x, z);
  if (length < 1e-6) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}

function angleDifference(a, b) {
  let delta = a - b;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function createWandererAI({ spawn, wallSet, waypoints, config = {} }) {
  const cfg = { ...WANDERER_CONFIG, ...config };

  let state = 'patrol';
  let position = { x: spawn.x, z: spawn.z };
  let facing = 0;
  let health = cfg.maxHealth;
  let stateTime = 0;
  let moveTime = 0;
  let waypointIndex = 0;
  let noiseTarget = null;
  let path = [];
  let repathTimer = 0;
  let unseenTime = 0;
  let swingSpent = false;

  function setState(next) {
    state = next;
    stateTime = 0;
    if (next === 'attack') swingSpent = false;
    if (next === 'patrol' || next === 'investigate' || next === 'chase') path = [];
  }

  function stepToward(goal, speed, dt, serpentine) {
    repathTimer -= dt;
    if (repathTimer <= 0 || path.length === 0) {
      repathTimer = cfg.repathInterval;
      const route = findPath(
        worldToCell(position.x, position.z),
        worldToCell(goal.x, goal.z),
        wallSet,
      );
      path = route ? route.slice(1) : [];
    }

    let step = path.length > 0 ? cellToWorld(path[0].c, path[0].r) : goal;
    if (path.length > 0 && Math.hypot(step.x - position.x, step.z - position.z) < cfg.arriveRadius) {
      path.shift();
      step = path.length > 0 ? cellToWorld(path[0].c, path[0].r) : goal;
    }

    const direction = serpentine
      ? serpentineDirection(position, step, moveTime)
      : normalize(step.x - position.x, step.z - position.z);
    if (direction.x === 0 && direction.z === 0) return;

    facing = Math.atan2(direction.x, direction.z);
    position = moveWithCollision(
      position,
      direction.x * speed * dt,
      direction.z * speed * dt,
      wallSet,
      cfg.radius,
    );
  }

  function canSee(player) {
    const dx = player.x - position.x;
    const dz = player.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > cfg.sightRange) return false;
    if (distance > cfg.proximityRange) {
      const toPlayer = Math.atan2(dx, dz);
      if (Math.abs(angleDifference(toPlayer, facing)) > cfg.sightHalfAngle) return false;
    }
    return hasLineOfSight(position, player, wallSet);
  }

  function update(dt, player) {
    const events = { attacked: false };
    if (state === 'dead') return events;

    stateTime += dt;
    moveTime += dt;

    const distance = Math.hypot(player.x - position.x, player.z - position.z);

    if (state === 'stagger') {
      if (stateTime >= cfg.staggerTime) setState('chase');
      return events;
    }

    if (state === 'windup') {
      // Deliberately frozen: this stillness is the readable telegraph.
      facing = Math.atan2(player.x - position.x, player.z - position.z);
      if (stateTime >= cfg.windupTime) setState('attack');
      return events;
    }

    if (state === 'attack') {
      if (!swingSpent) {
        swingSpent = true;
        if (distance <= cfg.meleeRange + 0.6) events.attacked = true;
      }
      if (stateTime >= cfg.attackTime + cfg.recoverTime) setState('chase');
      return events;
    }

    const seen = canSee(player);
    if (seen) {
      unseenTime = 0;
      if (state !== 'chase') setState('chase');
    } else if (state === 'chase') {
      unseenTime += dt;
      if (unseenTime >= cfg.loseSightTime) setState('patrol');
    }

    if (state === 'chase') {
      if (distance <= cfg.meleeRange) {
        setState('windup');
        return events;
      }
      if (burstFreezeFactor(moveTime) > 0) {
        stepToward(player, cfg.chaseSpeed, dt, true);
      } else {
        facing = Math.atan2(player.x - position.x, player.z - position.z);
      }
      return events;
    }

    if (state === 'investigate') {
      const reached =
        !noiseTarget ||
        Math.hypot(noiseTarget.x - position.x, noiseTarget.z - position.z) <= cfg.waypointRadius;
      if (!reached) {
        stepToward(noiseTarget, cfg.investigateSpeed, dt, false);
      } else if (stateTime >= cfg.investigateTime) {
        setState('patrol');
      }
      return events;
    }

    const waypoint = waypoints[waypointIndex % waypoints.length];
    if (Math.hypot(waypoint.x - position.x, waypoint.z - position.z) <= cfg.waypointRadius) {
      waypointIndex = (waypointIndex + 1) % waypoints.length;
      path = [];
    } else {
      stepToward(waypoint, cfg.patrolSpeed, dt, false);
    }
    return events;
  }

  function takeHit({ damage, headshot = false, from = null }) {
    if (state === 'dead') return { killed: false };

    health = headshot ? 0 : Math.max(0, health - damage);

    if (from) {
      const away = normalize(position.x - from.x, position.z - from.z);
      position = moveWithCollision(
        position,
        away.x * cfg.knockback,
        away.z * cfg.knockback,
        wallSet,
        cfg.radius,
      );
    }

    if (health <= 0) {
      setState('dead');
      return { killed: true };
    }
    setState('stagger');
    return { killed: false };
  }

  function hearNoise({ x, z, loudness = 1 }) {
    if (state === 'dead' || state === 'chase' || state === 'windup' || state === 'attack') return;
    if (Math.hypot(x - position.x, z - position.z) > cfg.hearingRange * loudness) return;
    noiseTarget = { x, z };
    setState('investigate');
  }

  function reset() {
    state = 'patrol';
    position = { x: spawn.x, z: spawn.z };
    facing = 0;
    health = cfg.maxHealth;
    stateTime = 0;
    moveTime = 0;
    waypointIndex = 0;
    noiseTarget = null;
    path = [];
    repathTimer = 0;
    unseenTime = 0;
    swingSpent = false;
  }

  return {
    state: () => state,
    position: () => ({ x: position.x, z: position.z }),
    facing: () => facing,
    health: () => health,
    isDead: () => state === 'dead',
    update,
    takeHit,
    hearNoise,
    reset,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/wandererAI.test.js`
Expected: 11 passed.

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test` — all pass.

```bash
git add src/enemy/wandererAI.js tests/wandererAI.test.js
git commit -m "feat: add Wanderer AI state machine with pathfinding and senses"
```

---

### Task 5: The Wanderer figure — mesh and stop-motion animation

**Files:**
- Modify: `src/rendering/palette.js` (two colors)
- Create: `src/enemy/wandererFigure.js`
- Test: `tests/wandererFigure.test.js`

**Interfaces:**
- Consumes: `quantizeTime` from `src/enemy/movementStyle.js`; `createToonMaterial` from `src/rendering/toonMaterial.js`; `PALETTE`.
- Produces: `createWandererFigure() -> { group, parts, hitMeshes, update(snapshot), flash(), reset() }`.
  - `group` is a `THREE.Group` the caller adds to the scene.
  - `parts` exposes the animated pieces by name: `{ torso, head, leftArm, rightArm, leftLeg, rightLeg }`.
  - `hitMeshes` is the array of raycast targets; each carries `userData.wandererPart` set to `'head'` or `'body'`.
  - `update(snapshot)` takes `{ state, position: {x, z}, facing, time, dt }` and poses the figure; poses are sampled through `quantizeTime` so they snap at 10fps.
  - `flash()` makes the figure briefly brighten on a hit; the brightening decays inside `update`.

- [ ] **Step 1: Add the two colors to `src/rendering/palette.js`**

Add these entries to `PALETTE`:

```js
  wanderer: 0x0d1014,   // near-black body: reads as a silhouette with ink outlines
  wandererEye: 0xdfe8ff, // pale, cold eyes
```

- [ ] **Step 2: Write the failing tests**

`tests/wandererFigure.test.js`:

```js
import { it, expect } from 'vitest';
import { createWandererFigure } from '../src/enemy/wandererFigure.js';

const base = { position: { x: 4, z: 6 }, facing: 0, time: 0, dt: 1 / 60 };

it('exposes exactly one head hit mesh and several body hit meshes', () => {
  const figure = createWandererFigure();
  const heads = figure.hitMeshes.filter((m) => m.userData.wandererPart === 'head');
  const bodies = figure.hitMeshes.filter((m) => m.userData.wandererPart === 'body');
  expect(heads.length).toBe(1);
  expect(bodies.length).toBeGreaterThan(0);
});

it('places the group at the given world position', () => {
  const figure = createWandererFigure();
  figure.update({ ...base, state: 'patrol' });
  expect(figure.group.position.x).toBeCloseTo(4);
  expect(figure.group.position.z).toBeCloseTo(6);
});

it('holds the same pose across one stop-motion frame and changes across frames', () => {
  const figure = createWandererFigure();
  const armOf = (t) => {
    figure.update({ ...base, state: 'patrol', time: t });
    return figure.parts.leftArm.rotation.x;
  };
  const a = armOf(1.21);
  const b = armOf(1.29);
  const c = armOf(1.35);
  expect(a).toBe(b);
  expect(a).not.toBe(c);
});

it('raises the blades when chasing and folds them when patrolling', () => {
  const figure = createWandererFigure();
  figure.update({ ...base, state: 'patrol' });
  const folded = figure.parts.leftArm.rotation.z;
  figure.update({ ...base, state: 'chase' });
  const raised = figure.parts.leftArm.rotation.z;
  expect(raised).not.toBe(folded);
});

it('collapses when dead', () => {
  const figure = createWandererFigure();
  figure.update({ ...base, state: 'patrol' });
  const standing = figure.group.rotation.x;
  for (let i = 0; i < 60; i++) figure.update({ ...base, state: 'dead' });
  expect(Math.abs(figure.group.rotation.x)).toBeGreaterThan(Math.abs(standing));
  expect(figure.group.position.y).toBeLessThan(0);
});

it('reset clears the death collapse', () => {
  const figure = createWandererFigure();
  for (let i = 0; i < 60; i++) figure.update({ ...base, state: 'dead' });
  figure.reset();
  figure.update({ ...base, state: 'patrol' });
  expect(figure.group.rotation.x).toBeCloseTo(0);
  expect(figure.group.position.y).toBeCloseTo(0);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/wandererFigure.test.js`
Expected: FAIL — cannot resolve `../src/enemy/wandererFigure.js`.

- [ ] **Step 4: Implement `src/enemy/wandererFigure.js`**

```js
import * as THREE from 'three';
import { PALETTE } from '../rendering/palette.js';
import { createToonMaterial } from '../rendering/toonMaterial.js';
import { quantizeTime } from './movementStyle.js';

const ANIMATION_FPS = 10; // everything else runs at 60: this is the "wrong" look
const COLLAPSE_SPEED = 3.2;

function bodyPart(material, width, height, depth, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function createWandererFigure() {
  const group = new THREE.Group();
  const skin = createToonMaterial(PALETTE.wanderer);
  const eyeMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.wandererEye });

  // Hunched torso, head jutting forward and low, mantis blades folded at rest.
  const torso = bodyPart(skin, 0.5, 0.9, 0.34, 0, 1.15, 0);
  torso.rotation.x = 0.35; // hunched

  const head = bodyPart(skin, 0.3, 0.28, 0.36, 0, 1.62, 0.16);
  head.userData.wandererPart = 'head';

  const eyeGeometry = new THREE.SphereGeometry(0.035, 6, 6);
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.07, 0, 0.18);
  rightEye.position.set(0.07, 0, 0.18);
  head.add(leftEye, rightEye);

  // Arms: a short upper arm with a long scythe blade as the forearm.
  function makeArm(side) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.32, 1.42, 0);
    const upper = bodyPart(skin, 0.12, 0.42, 0.12, 0, -0.21, 0);
    const blade = bodyPart(skin, 0.08, 0.95, 0.2, 0, -0.85, 0.06);
    blade.rotation.x = -0.15;
    arm.add(upper, blade);
    return { arm, upper, blade };
  }
  const left = makeArm(-1);
  const right = makeArm(1);

  const leftLeg = bodyPart(skin, 0.15, 0.8, 0.15, -0.15, 0.4, 0);
  const rightLeg = bodyPart(skin, 0.15, 0.8, 0.15, 0.15, 0.4, 0);

  [torso, head, leftLeg, rightLeg].forEach((mesh) => group.add(mesh));
  group.add(left.arm, right.arm);

  [torso, leftLeg, rightLeg, left.upper, left.blade, right.upper, right.blade].forEach((mesh) => {
    mesh.userData.wandererPart = 'body';
  });

  const hitMeshes = [head, torso, leftLeg, rightLeg, left.blade, right.blade];
  const parts = {
    torso,
    head,
    leftArm: left.arm,
    rightArm: right.arm,
    leftLeg,
    rightLeg,
  };

  let flashAmount = 0;
  let collapse = 0;

  // Blade fold angle per state: tight while prowling, up when hunting,
  // reared back during the wind-up, dropped when staggered.
  function bladeFold(state) {
    if (state === 'chase') return 0.9;
    if (state === 'windup') return 2.1;
    if (state === 'attack') return -0.6;
    if (state === 'stagger') return 0.15;
    return 0.35;
  }

  function update(snapshot) {
    const { state, position, facing, time, dt = 0 } = snapshot;
    const frozen = state === 'windup'; // the telegraph: all jitter stops
    const t = frozen ? 0 : quantizeTime(time, ANIMATION_FPS);

    group.position.x = position.x;
    group.position.z = position.z;
    group.rotation.y = facing;

    const moving = state === 'chase' || state === 'patrol' || state === 'investigate';
    const stride = state === 'chase' ? 14 : 5;
    const swing = moving ? Math.sin(t * stride) * (state === 'chase' ? 0.9 : 0.45) : 0;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;

    // Twitch layer: small snapped jerks, never still unless frozen.
    const twitch = frozen ? 0 : (Math.sin(t * 37.1) + Math.sin(t * 23.7)) * 0.05;
    head.rotation.x = 0.3 + twitch;
    head.rotation.z = twitch * 1.5;
    torso.rotation.z = twitch * 0.6;

    const fold = bladeFold(state);
    left.arm.rotation.z = fold + twitch;
    right.arm.rotation.z = -fold - twitch;
    left.arm.rotation.x = -swing * 0.3;
    right.arm.rotation.x = swing * 0.3;

    if (state === 'dead') {
      collapse = Math.min(1, collapse + dt * COLLAPSE_SPEED);
    }
    group.rotation.x = collapse * 1.4;
    group.position.y = -collapse * 0.6;

    if (flashAmount > 0) flashAmount = Math.max(0, flashAmount - dt * 6);
    skin.color.setHex(PALETTE.wanderer);
    if (flashAmount > 0) skin.color.lerp(new THREE.Color(0xffffff), flashAmount);
  }

  return {
    group,
    parts,
    hitMeshes,
    update,
    flash() {
      flashAmount = 0.8;
    },
    reset() {
      collapse = 0;
      flashAmount = 0;
      group.rotation.set(0, 0, 0);
      group.position.y = 0;
    },
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/wandererFigure.test.js`
Expected: 6 passed.

- [ ] **Step 6: Run the full suite and commit**

Run: `npm test` — all pass. Run: `npm run build` — clean.

```bash
git add src/enemy/wandererFigure.js src/rendering/palette.js tests/wandererFigure.test.js
git commit -m "feat: add mantis-bladed Wanderer figure with stop-motion animation"
```

---

### Task 6: Put it in the world and let the player shoot it

**Files:**
- Modify: `src/main.js`
- Modify: `index.html` (hit marker element)
- Modify: `src/ui/style.css` (hit marker styles)
- Modify: `src/ui/hud.js` (hit marker method)

**Interfaces:**
- Consumes: `createWandererAI`, `createWandererFigure`, the AI/figure interfaces from Tasks 4 and 5; existing `bus`, `revolver`, `impacts`, `raycaster`.
- Produces: a live Wanderer in the scene that patrols, hears gunshots and sprinting, chases, and can be shot dead; `hud.hitMarker(kind)` where `kind` is `'body'` or `'head'`.

This task also folds in two carry-forwards from the Milestone 3a review: the view kick becomes a named constant, and `const lock` moves above the handlers that reference it (removing a temporal-dead-zone trap).

**Deliberate simplification:** the spec mentions ink-puff particles at hits on
the monster. Bullet marks are world-space decals and would be left behind by a
moving target, so hits on the Wanderer instead produce the figure flash plus a
crosshair hit marker (which also distinguishes headshots). Impact decals stay
on level geometry only.

- [ ] **Step 1: Add the hit marker to `index.html`**

Inside `#hud`, directly after the `#crosshair` div:

```html
    <div id="hitmarker"></div>
```

- [ ] **Step 2: Add hit marker styles to `src/ui/style.css`**

Append:

```css
#hitmarker {
  position: absolute; left: 50%; top: 50%;
  width: 18px; height: 18px; margin: -9px 0 0 -9px;
  border: 2px solid transparent; border-radius: 50%;
  opacity: 0; transform: scale(0.6);
}
#hitmarker.show {
  opacity: 1; transform: scale(1);
  border-color: rgba(223, 232, 255, 0.9);
  transition: opacity 0.25s ease-out, transform 0.25s ease-out;
}
#hitmarker.show.head { border-color: rgba(255, 120, 120, 0.95); }
```

- [ ] **Step 3: Add the hit marker method to `src/ui/hud.js`**

Replace the whole file with:

```js
export function createHud() {
  const ammo = document.getElementById('ammo');
  const hitmarker = document.getElementById('hitmarker');
  let hitTimer = null;

  return {
    setAmmo(rounds, capacity) {
      ammo.textContent = `${rounds} / ${capacity}`;
    },
    setReloading(active) {
      ammo.classList.toggle('reloading', active);
    },
    hitMarker(kind) {
      hitmarker.classList.remove('show', 'head');
      // force a reflow so the animation restarts on rapid consecutive hits
      void hitmarker.offsetWidth;
      hitmarker.classList.add('show');
      if (kind === 'head') hitmarker.classList.add('head');
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('show', 'head'), 250);
    },
  };
}
```

- [ ] **Step 4: Wire the Wanderer into `src/main.js`**

Read the current file first, then make these changes.

(a) Add imports next to the existing ones:

```js
import { createWandererAI } from './enemy/wandererAI.js';
import { createWandererFigure } from './enemy/wandererFigure.js';
```

(b) Add a constant next to `EYE_HEIGHT` (this is the carry-forward that replaces the magic `-12`):

```js
const VIEW_KICK = -12; // mouse-delta units fed to applyLookDelta on each shot
const BODY_DAMAGE = 30;
const SPRINT_NOISE = 0.25;         // quieter than a gunshot, so sprinting carries less far
const SPRINT_NOISE_INTERVAL = 0.35; // seconds between sprint noise pulses
```

Also declare the throttle timer next to `let elapsed = 0;`:

```js
let sprintNoiseTimer = 0;
```

(c) Move the whole `const lock = setupPointerLock(...)` block and the `overlay.addEventListener('click', ...)` line so they sit **immediately after** the `const look = createLook();` line and **before** the `setKey`/keydown/`shoot` definitions. Nothing about their contents changes — this only removes the temporal-dead-zone trap where handlers referenced `lock` before its declaration.

(d) After the `hud` line, create the monster:

```js
const wandererAI = createWandererAI({
  spawn: parsed.lamps[0],          // a lamp cell in a far room
  wallSet: parsed.wallSet,
  waypoints: parsed.lamps,          // one waypoint per room, already spread out
});
const wanderer = createWandererFigure();
scene.add(wanderer.group);
bus.on('noise', (noise) => wandererAI.hearNoise(noise));
```

(e) Replace the body of `shoot()`'s raycast section so the monster is a target. The whole function becomes:

```js
function shoot() {
  if (!lock.isLocked()) return;
  if (!revolver.fire(elapsed)) return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const shootables = [...level.children, ...wanderer.hitMeshes];
  const hits = raycaster.intersectObjects(shootables, false);
  if (hits.length > 0) {
    const hit = hits[0];
    const part = hit.object.userData.wandererPart;
    if (part && !wandererAI.isDead()) {
      const headshot = part === 'head';
      wandererAI.takeHit({ damage: BODY_DAMAGE, headshot, from: { x: player.x, z: player.z } });
      wanderer.flash();
      hud.hitMarker(headshot ? 'head' : 'body');
    } else if (!part) {
      const worldNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      impacts.spawn(hit.point, worldNormal);
    }
  }
  muzzleFlash.trigger();
  applyLookDelta(look, 0, VIEW_KICK);
  bus.emit('noise', { x: player.x, z: player.z, loudness: 1 });
}
```

(f) Emit sprint noise and tick the monster inside the loop's `lock.isLocked()` block, right after `elapsed += dt;`:

```js
    sprintNoiseTimer -= dt;
    if (keys.sprint && (wish.x !== 0 || wish.z !== 0) && sprintNoiseTimer <= 0) {
      sprintNoiseTimer = SPRINT_NOISE_INTERVAL;
      bus.emit('noise', { x: player.x, z: player.z, loudness: SPRINT_NOISE });
    }
    wandererAI.update(dt, player);
```

The throttle matters: emitting sprint noise every frame would re-enter the
investigate state 60 times a second, resetting its timer and forcing a fresh
A\* search each frame.

(g) Update the figure every frame, next to `muzzleFlash.update(dt)`:

```js
  wanderer.update({
    state: wandererAI.state(),
    position: wandererAI.position(),
    facing: wandererAI.facing(),
    time: elapsed,
    dt,
  });
```

- [ ] **Step 5: Verify**

Run: `npm test` — all pass (this task adds no unit tests; the logic it wires is already covered).
Run: `npm run build` — clean.
Headless check: request `/src/main.js`, `/src/enemy/wandererAI.js` and `/src/enemy/wandererFigure.js` from the running dev server and confirm each returns a transformed module rather than an error page. Do not start or stop the dev server — one is already running for the human partner.

- [ ] **Step 6: Commit**

```bash
git add src/main.js src/ui/hud.js index.html src/ui/style.css
git commit -m "feat: spawn the Wanderer, make it shootable with headshots and stagger"
```

---

### Task 7: Let it kill you — damage, death and retry

**Files:**
- Create: `src/core/gameState.js`
- Create: `src/rendering/screenShake.js`
- Modify: `src/weapons/revolver.js` (add `reset()`)
- Modify: `index.html`, `src/ui/style.css`, `src/ui/hud.js` (health bar, damage vignette, death screen)
- Modify: `src/main.js` (damage routing, death, retry)
- Test: `tests/gameState.test.js`, `tests/screenShake.test.js`, `tests/revolver.test.js` (append)

**Interfaces:**
- Consumes: `createHealth` (Task 2), `wandererAI.update(...) -> { attacked }` (Task 4).
- Produces: `createGameState() -> { state(), isPlaying(), isDead(), die(), retry() }` (`state()` is `'playing' | 'dead'`); `createScreenShake({ decay = 3.5 } = {}) -> { trigger(amount), update(dt), offset() }` where `offset()` returns `{ x, y }` metres to add to the camera; `revolver.reset()`; HUD methods `setHealth(fraction)`, `flashDamage()` and `showDeath(visible)`.

- [ ] **Step 1: Write the failing tests**

`tests/gameState.test.js`:

```js
import { it, expect } from 'vitest';
import { createGameState } from '../src/core/gameState.js';

it('starts playing', () => {
  const game = createGameState();
  expect(game.state()).toBe('playing');
  expect(game.isPlaying()).toBe(true);
  expect(game.isDead()).toBe(false);
});

it('dies once and retries back to playing', () => {
  const game = createGameState();
  game.die();
  expect(game.isDead()).toBe(true);
  expect(game.isPlaying()).toBe(false);
  game.retry();
  expect(game.isPlaying()).toBe(true);
});

it('die is idempotent', () => {
  const game = createGameState();
  game.die();
  game.die();
  expect(game.state()).toBe('dead');
});
```

`tests/screenShake.test.js`:

```js
import { it, expect } from 'vitest';
import { createScreenShake } from '../src/rendering/screenShake.js';

it('is still until triggered', () => {
  const shake = createScreenShake();
  shake.update(0.016);
  expect(shake.offset()).toEqual({ x: 0, y: 0 });
});

it('offsets the camera after a trigger and decays back to zero', () => {
  const shake = createScreenShake();
  shake.trigger(0.5);
  shake.update(0.016);
  const jolted = shake.offset();
  expect(Math.hypot(jolted.x, jolted.y)).toBeGreaterThan(0);
  shake.update(10);
  expect(shake.offset()).toEqual({ x: 0, y: 0 });
});

it('keeps the strongest of overlapping triggers', () => {
  const shake = createScreenShake();
  shake.trigger(0.2);
  shake.trigger(0.6);
  shake.update(0.001);
  expect(Math.hypot(shake.offset().x, shake.offset().y)).toBeGreaterThan(0);
});
```

Append to `tests/revolver.test.js`:

```js
it('reset refills the cylinder and clears timers', () => {
  const gun = createRevolver();
  gun.fire(0);
  gun.fire(1);
  gun.reset();
  expect(gun.rounds()).toBe(6);
  expect(gun.isReloading(0)).toBe(false);
  expect(gun.fire(0)).toBe(true); // cooldown cleared too
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/gameState.test.js tests/screenShake.test.js tests/revolver.test.js`
Expected: FAIL — two unresolved modules and `gun.reset is not a function`.

- [ ] **Step 3: Implement `src/core/gameState.js`**

```js
export function createGameState() {
  let state = 'playing';
  return {
    state: () => state,
    isPlaying: () => state === 'playing',
    isDead: () => state === 'dead',
    die() {
      state = 'dead';
    },
    retry() {
      state = 'playing';
    },
  };
}
```

- [ ] **Step 4: Implement `src/rendering/screenShake.js`**

```js
export function createScreenShake({ decay = 3.5 } = {}) {
  let magnitude = 0;
  let x = 0;
  let y = 0;

  return {
    trigger(amount) {
      magnitude = Math.max(magnitude, amount);
    },
    update(dt) {
      if (magnitude <= 0) {
        x = 0;
        y = 0;
        return;
      }
      magnitude = Math.max(0, magnitude - decay * dt);
      x = (Math.random() - 0.5) * magnitude * 0.4;
      y = (Math.random() - 0.5) * magnitude * 0.4;
      if (magnitude === 0) {
        x = 0;
        y = 0;
      }
    },
    offset: () => ({ x, y }),
  };
}
```

- [ ] **Step 5: Add `reset()` to `src/weapons/revolver.js`**

Inside the returned object, add:

```js
    reset() {
      rounds = capacity;
      lastFire = -Infinity;
      reloadingUntil = -Infinity;
      pendingRefill = false;
    },
```

(Adapt the internal variable names to the ones already in the file; the effect must be a full cylinder with no cooldown and no pending reload.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/gameState.test.js tests/screenShake.test.js tests/revolver.test.js`
Expected: all pass.

- [ ] **Step 7: Add the health bar and death screen to `index.html`**

Inside `#hud`, after the `#ammo` div:

```html
    <div id="healthbar"><div id="healthfill"></div></div>
    <div id="damage"></div>
```

And after the `#hud` div, a sibling:

```html
  <div id="death" hidden>
    <h1>YOU DIED</h1>
    <p>Click to try again</p>
  </div>
```

- [ ] **Step 8: Add their styles to `src/ui/style.css`**

Append:

```css
#healthbar {
  position: absolute; left: 1.2rem; bottom: 1rem;
  width: 190px; height: 10px;
  border: 1px solid rgba(207, 214, 228, 0.35);
  background: rgba(5, 7, 10, 0.55);
}
#healthfill {
  height: 100%; width: 100%;
  background: rgba(214, 226, 245, 0.85);
  transition: width 0.12s linear;
}
#healthfill.low { background: rgba(232, 96, 96, 0.9); }
#damage {
  position: absolute; inset: 0; opacity: 0;
  box-shadow: inset 0 0 140px 40px rgba(150, 20, 20, 0.85);
  transition: opacity 0.4s ease-out;
}
#damage.hit { opacity: 1; transition: opacity 0.05s linear; }
#death {
  position: fixed; inset: 0; z-index: 2;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 0.5rem;
  background: rgba(20, 4, 4, 0.82); color: #e8d6d6;
  font-family: system-ui, sans-serif; cursor: pointer;
}
#death[hidden] { display: none; }
```

- [ ] **Step 9: Add the HUD methods to `src/ui/hud.js`**

Add these two element lookups next to the existing ones:

```js
  const healthfill = document.getElementById('healthfill');
  const damage = document.getElementById('damage');
  const death = document.getElementById('death');
```

and these methods to the returned object:

```js
    setHealth(fraction) {
      const clamped = Math.max(0, Math.min(1, fraction));
      healthfill.style.width = `${clamped * 100}%`;
      healthfill.classList.toggle('low', clamped <= 0.34);
    },
    flashDamage() {
      damage.classList.add('hit');
      setTimeout(() => damage.classList.remove('hit'), 60);
    },
    showDeath(visible) {
      death.hidden = !visible;
    },
```

- [ ] **Step 10: Wire damage, death and retry into `src/main.js`**

(a) New imports:

```js
import { createHealth } from './player/health.js';
import { createGameState } from './core/gameState.js';
import { createScreenShake } from './rendering/screenShake.js';
```

(b) New constants next to the others:

```js
const MELEE_DAMAGE = 25;
const HIT_SHAKE = 0.55;
```

(c) After the `wanderer` setup:

```js
const health = createHealth();
const game = createGameState();
const shake = createScreenShake();
const death = document.getElementById('death');

// `elapsed` deliberately keeps running across a retry: every module that holds
// a timer (health, revolver, the AI) resets its own, so a monotonic clock is
// both correct and simpler than rewinding it.
function retry() {
  player.x = parsed.spawn.x;
  player.z = parsed.spawn.z;
  player.y = 0;
  player.vy = 0;
  health.reset();
  revolver.reset();
  wandererAI.reset();
  wanderer.reset();
  game.retry();
  hud.showDeath(false);
  lock.request();
}
death.addEventListener('click', retry);
```

(d) In the loop's `lock.isLocked()` block, replace the bare `wandererAI.update(dt, player);` from Task 6 with damage routing, and add the health tick:

```js
    const enemy = wandererAI.update(dt, player);
    if (enemy.attacked && game.isPlaying()) {
      health.damage(MELEE_DAMAGE, elapsed);
      hud.flashDamage();
      shake.trigger(HIT_SHAKE);
      if (health.isDead()) {
        game.die();
        hud.showDeath(true);
        document.exitPointerLock();
      }
    }
    health.update(elapsed);
    hud.setHealth(health.fraction());
```

(e) Apply the shake to the camera, replacing the existing `camera.position.set(...)` line:

```js
  shake.update(dt);
  const jolt = shake.offset();
  camera.position.set(player.x + jolt.x, EYE_HEIGHT + player.y + jolt.y, player.z);
```

(f) Guard the pause overlay so it does not appear on top of the death screen — in the `setupPointerLock` options, change `onUnlocked`:

```js
  onUnlocked: () => { overlay.hidden = game.isDead(); },
```

(Leave `onLocked` as it is. `game` is declared before `lock` after Task 6's reordering; if the linter or runtime disagrees, move the `const game = createGameState();` line above the `lock` block rather than moving `lock` back down.)

- [ ] **Step 11: Verify**

Run: `npm test` — all pass.
Run: `npm run build` — clean.
Headless check: request `/src/main.js` from the running dev server and confirm it returns a transformed module. Do not start or stop the dev server.

- [ ] **Step 12: Commit**

```bash
git add src/core/gameState.js src/rendering/screenShake.js src/weapons/revolver.js src/main.js src/ui/hud.js index.html src/ui/style.css tests/gameState.test.js tests/screenShake.test.js tests/revolver.test.js
git commit -m "feat: player damage, death screen and instant retry"
```

---

### Task 8: README and Milestone 3b acceptance

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: documented controls and status; a verified milestone.

- [ ] **Step 1: Update `README.md`**

In the Controls table, the existing rows stay; the mechanics are unchanged. Replace the content of the `## Status` section with:

```markdown
## Status

Milestone 3b (the Wanderer) complete: a mantis-bladed monster hunts the
mansion with A* pathfinding, hears gunshots and sprinting, charges in
stop-motion jitter, and telegraphs its strike by going utterly still.
Shoot it to stagger it; four body shots or one headshot kill it. The player
has health with regeneration, a death screen and instant retry.
Next: Milestone 4 — content (keys, second enemy, shotgun, pickups, basement).
```

- [ ] **Step 2: Automated checks**

Run: `npm test` — all pass.
Run: `npm run build` — clean.

- [ ] **Step 3: Playtest checklist (human, in the browser)**

1. The Wanderer prowls the mansion and can be found patrolling between rooms.
2. Firing a shot pulls it toward the noise from across the mansion; sprinting pulls it from nearby.
3. When it sees you it charges — visibly weaving, jittering at a lower framerate than everything else, bursting and freezing.
4. It reaches you, goes completely still with blades reared for a beat, then hits you for a quarter of your health (red flash, screen shake).
5. Shooting it staggers it and knocks it back; four body shots kill it; one headshot kills it outright.
6. The hit marker distinguishes body hits from headshots.
7. Health regenerates after a few seconds without damage.
8. Dying shows YOU DIED; clicking restarts immediately with the monster back on patrol and the revolver full.
9. Esc still pauses everything, monster included.
10. Frame rate stays smooth.

Tuning knobs if the fight feels wrong: `WANDERER_CONFIG` in `src/enemy/wandererAI.js` (speeds, ranges, timings), `BODY_DAMAGE`/`MELEE_DAMAGE` in `src/main.js`, `ANIMATION_FPS` in `src/enemy/wandererFigure.js` (lower = jerkier), and the amplitude/frequency defaults in `src/enemy/movementStyle.js`.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update status; complete milestone 3b (the Wanderer)"
```
