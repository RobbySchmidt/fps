# Milestone 3a: Shooting Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mansion interactive: jump on Space (real gravity), a revolver with raycast shooting, muzzle flash, wall impacts, 6-round cylinder + reload, view kick, a crosshair/ammo HUD, and an event bus that broadcasts gunshot noise — the hook Milestone 3b's enemy will listen to.

**Architecture:** All combat logic is pure and clock-injected (`elapsed` game-seconds, so pausing freezes cooldowns): jump physics and the revolver state machine live in testable modules. Three.js wiring (raycast, impact pool, flash light) stays thin in `main.js` plus two small weapon modules. HUD is HTML/CSS like the rest of the UI. Enemy AI is explicitly out of scope (Milestone 3b).

**Tech Stack:** Three.js, Vite, Vitest, plain JavaScript.

**Spec:** `docs/superpowers/specs/2026-08-09-mansion-horror-fps-design.md`. Jump is a user-requested addition to the player spec. Reload uses an infinite reserve for now — ammo scarcity arrives with pickups in Milestone 4.

## Global Constraints

- Plain JavaScript with ES modules — no TypeScript. No new dependencies.
- Logic modules must not touch `document`/`window`; time enters logic as an injected `now`/`dt` in seconds.
- All colors come from `src/rendering/palette.js` (shader-internal defaults excepted).
- The existing keydown handler in `main.js` has an `e.repeat` early-return — new key bindings inherit it; do not remove it.
- Commit after every task with the message given in the task.

---

### Task 1: Jump physics and event bus

**Files:**
- Modify: `src/player/movement.js` (add gravity/jump functions)
- Create: `src/core/eventBus.js`
- Modify: `src/main.js` (player vertical state, Space binding, camera height)
- Test: `tests/movement.test.js` (append), `tests/eventBus.test.js`

**Interfaces:**
- Consumes: existing `player` object and `setKey`/keydown wiring in `main.js`; `EYE_HEIGHT = 1.7`.
- Produces: `GRAVITY = -18`, `JUMP_VELOCITY = 6.2`; `tryJump(body) -> boolean` (only from ground); `stepVertical(body, dt)` mutating `{ y, vy }` with ground clamp at 0; `createEventBus() -> { on(event, handler) -> unsubscribe, emit(event, payload) }`. Task 3 emits `'noise'` events on this bus; M3b subscribes to them.

- [ ] **Step 1: Write the failing tests**

Append to `tests/movement.test.js`:

```js
import { GRAVITY, JUMP_VELOCITY, tryJump, stepVertical } from '../src/player/movement.js';

it('tryJump launches only from the ground', () => {
  const body = { y: 0, vy: 0 };
  expect(tryJump(body)).toBe(true);
  expect(body.vy).toBe(JUMP_VELOCITY);
  stepVertical(body, 0.05);
  expect(body.y).toBeGreaterThan(0);
  expect(tryJump(body)).toBe(false); // mid-air
});

it('jump arc peaks around one meter and lands back at zero', () => {
  const body = { y: 0, vy: 0 };
  tryJump(body);
  let peak = 0;
  for (let i = 0; i < 300; i++) {
    stepVertical(body, 1 / 120);
    peak = Math.max(peak, body.y);
  }
  expect(peak).toBeGreaterThan(0.9);
  expect(peak).toBeLessThan(1.2);
  expect(body.y).toBe(0);
  expect(body.vy).toBe(0);
});

it('a grounded body stays at rest', () => {
  const body = { y: 0, vy: 0 };
  stepVertical(body, 0.1);
  expect(body).toEqual({ y: 0, vy: 0 });
});
```

New file `tests/eventBus.test.js`:

```js
import { it, expect, vi } from 'vitest';
import { createEventBus } from '../src/core/eventBus.js';

it('delivers payloads to all subscribed handlers', () => {
  const bus = createEventBus();
  const a = vi.fn();
  const b = vi.fn();
  bus.on('noise', a);
  bus.on('noise', b);
  bus.emit('noise', { x: 1, z: 2 });
  expect(a).toHaveBeenCalledWith({ x: 1, z: 2 });
  expect(b).toHaveBeenCalledWith({ x: 1, z: 2 });
});

it('unsubscribe stops delivery', () => {
  const bus = createEventBus();
  const handler = vi.fn();
  const off = bus.on('noise', handler);
  off();
  bus.emit('noise', {});
  expect(handler).not.toHaveBeenCalled();
});

it('emitting an event nobody listens to does not throw', () => {
  expect(() => createEventBus().emit('ghost', {})).not.toThrow();
});
```

- [ ] **Step 2: Run both test files to verify they fail**

Run: `npx vitest run tests/movement.test.js tests/eventBus.test.js`
Expected: FAIL — missing exports / unresolved module.

- [ ] **Step 3: Implement**

Append to `src/player/movement.js`:

```js
export const GRAVITY = -18;       // m/s²
export const JUMP_VELOCITY = 6.2; // m/s → apex ≈ 1.05 m

export function tryJump(body) {
  if (body.y !== 0) return false;
  body.vy = JUMP_VELOCITY;
  return true;
}

export function stepVertical(body, dt) {
  if (body.y === 0 && body.vy <= 0) {
    body.vy = 0;
    return;
  }
  body.vy += GRAVITY * dt;
  body.y += body.vy * dt;
  if (body.y <= 0) {
    body.y = 0;
    body.vy = 0;
  }
}
```

Create `src/core/eventBus.js`:

```js
export function createEventBus() {
  const listeners = new Map();
  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event).delete(handler);
    },
    emit(event, payload) {
      const set = listeners.get(event);
      if (set) [...set].forEach((fn) => fn(payload));
    },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/movement.test.js tests/eventBus.test.js`
Expected: all pass.

- [ ] **Step 5: Wire into `src/main.js`** (read the current file first)

1. Extend the imports from `./player/movement.js` with `tryJump, stepVertical`.
2. Player state gains vertical fields: `const player = { x: parsed.spawn.x, z: parsed.spawn.z, y: 0, vy: 0 };`
3. In the keydown listener (after the existing `e.repeat` guard), bind Space — jumping only while playing:
```js
if (e.code === 'Space' && lock.isLocked()) tryJump(player);
```
(Place it in the keydown `addEventListener` callback next to the `setKey` call, NOT inside `setKey` — jump is an edge-triggered action, not held-key state.)
4. In the loop update (inside the `lock.isLocked()` block, after the horizontal `moveWithCollision` result is applied): `stepVertical(player, dt);`
5. Camera height becomes jump-aware: `camera.position.set(player.x, EYE_HEIGHT + player.y, player.z);`

- [ ] **Step 6: Verify and commit**

Run: `npm test` — all pass. Run: `npm run build` — clean.

```bash
git add src/player/movement.js src/core/eventBus.js src/main.js tests/movement.test.js tests/eventBus.test.js
git commit -m "feat: add jump with gravity and an event bus"
```

---

### Task 2: Revolver logic

**Files:**
- Create: `src/weapons/revolver.js`
- Test: `tests/revolver.test.js`

**Interfaces:**
- Consumes: nothing (pure, clock-injected).
- Produces: `createRevolver({ capacity = 6, fireCooldown = 0.35, reloadTime = 1.2 } = {}) -> { rounds(), capacity(), isReloading(now), fire(now) -> boolean, startReload(now) -> boolean }`. `now` is game-seconds (the caller's paused-aware clock). `fire` fails while reloading, empty, or inside the cooldown. `startReload` fails while already reloading or full; rounds refill when the reload completes (v1: infinite reserve).

- [ ] **Step 1: Write the failing tests**

`tests/revolver.test.js`:

```js
import { it, expect } from 'vitest';
import { createRevolver } from '../src/weapons/revolver.js';

it('fires and spends one round', () => {
  const gun = createRevolver();
  expect(gun.rounds()).toBe(6);
  expect(gun.fire(0)).toBe(true);
  expect(gun.rounds()).toBe(5);
});

it('respects the fire cooldown', () => {
  const gun = createRevolver();
  expect(gun.fire(0)).toBe(true);
  expect(gun.fire(0.1)).toBe(false);
  expect(gun.fire(0.4)).toBe(true);
});

it('cannot fire empty', () => {
  const gun = createRevolver({ capacity: 1 });
  expect(gun.fire(0)).toBe(true);
  expect(gun.fire(1)).toBe(false);
});

it('reload blocks firing until done, then the cylinder is full', () => {
  const gun = createRevolver();
  gun.fire(0);
  expect(gun.startReload(1)).toBe(true);
  expect(gun.isReloading(1.5)).toBe(true);
  expect(gun.fire(1.5)).toBe(false);
  expect(gun.isReloading(2.3)).toBe(false);
  expect(gun.rounds()).toBe(6);
  expect(gun.fire(2.3)).toBe(true);
});

it('reload is refused when already reloading or full', () => {
  const gun = createRevolver();
  expect(gun.startReload(0)).toBe(false); // full
  gun.fire(0);
  expect(gun.startReload(1)).toBe(true);
  expect(gun.startReload(1.5)).toBe(false); // already reloading
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/revolver.test.js`
Expected: FAIL — unresolved module.

- [ ] **Step 3: Implement `src/weapons/revolver.js`**

```js
export function createRevolver({ capacity = 6, fireCooldown = 0.35, reloadTime = 1.2 } = {}) {
  let rounds = capacity;
  let lastFire = -Infinity;
  let reloadingUntil = -Infinity;

  function isReloading(now) {
    return now < reloadingUntil;
  }

  return {
    rounds: () => rounds,
    capacity: () => capacity,
    isReloading,
    fire(now) {
      if (isReloading(now)) return false;
      if (rounds <= 0) return false;
      if (now - lastFire < fireCooldown) return false;
      rounds -= 1;
      lastFire = now;
      return true;
    },
    startReload(now) {
      if (isReloading(now) || rounds === capacity) return false;
      reloadingUntil = now + reloadTime;
      rounds = capacity; // takes effect once isReloading(now) turns false; infinite reserve until M4 pickups
      return true;
    },
  };
}
```

- [ ] **Step 4: Run to verify pass, then full suite and commit**

Run: `npx vitest run tests/revolver.test.js` — 5 passed. Run: `npm test` — all pass.

```bash
git add src/weapons/revolver.js tests/revolver.test.js
git commit -m "feat: add revolver logic with cooldown and reload"
```

---

### Task 3: Shooting wiring — raycast, impacts, muzzle flash, noise

**Files:**
- Create: `src/weapons/impacts.js`
- Create: `src/weapons/muzzleFlash.js`
- Modify: `src/rendering/palette.js` (add `impact` color)
- Modify: `src/main.js` (game clock, shoot handler, R reload, per-frame updates)
- Test: `tests/impacts.test.js`, `tests/muzzleFlash.test.js`

**Interfaces:**
- Consumes: `createRevolver` (Task 2), `createEventBus` (Task 1), `applyLookDelta` (existing), the `buildGreybox` group.
- Produces: `createImpactPool(parent, max = 24) -> { spawn(point, normal), count() }` (ring buffer of bullet-mark meshes, oldest reused); `createMuzzleFlash(camera) -> { trigger(), update(dt), light }` (light pulse that decays). `main.js` emits `bus.emit('noise', { x, z, loudness: 1 })` per shot — M3b's enemy subscribes to exactly this.

- [ ] **Step 1: Write the failing tests**

`tests/impacts.test.js`:

```js
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
```

`tests/muzzleFlash.test.js`:

```js
import { it, expect } from 'vitest';
import * as THREE from 'three';
import { createMuzzleFlash } from '../src/weapons/muzzleFlash.js';

it('flashes on trigger and decays to zero', () => {
  const camera = new THREE.PerspectiveCamera();
  const flash = createMuzzleFlash(camera);
  expect(flash.light.intensity).toBe(0);
  flash.trigger();
  expect(flash.light.intensity).toBeGreaterThan(0);
  flash.update(1);
  expect(flash.light.intensity).toBe(0);
  expect(flash.light.parent).toBe(camera);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/impacts.test.js tests/muzzleFlash.test.js`
Expected: FAIL — unresolved modules.

- [ ] **Step 3: Add the impact color to `src/rendering/palette.js`**

Add the entry `impact: 0x101318,` (dark bullet mark) to `PALETTE`.

- [ ] **Step 4: Implement `src/weapons/impacts.js`**

```js
import * as THREE from 'three';
import { PALETTE } from '../rendering/palette.js';

export function createImpactPool(parent, max = 24) {
  const geometry = new THREE.CircleGeometry(0.06, 12);
  const material = new THREE.MeshBasicMaterial({ color: PALETTE.impact, side: THREE.DoubleSide });
  const pool = [];
  let next = 0;
  return {
    spawn(point, normal) {
      let mesh = pool[next];
      if (!mesh) {
      mesh = new THREE.Mesh(geometry, material);
        pool[next] = mesh;
        parent.add(mesh);
      }
      mesh.position.copy(point).addScaledVector(normal, 0.01);
      mesh.lookAt(point.clone().add(normal));
      next = (next + 1) % max;
      return mesh;
    },
    count: () => pool.length,
  };
}
```

- [ ] **Step 5: Implement `src/weapons/muzzleFlash.js`**

```js
import * as THREE from 'three';
import { PALETTE } from '../rendering/palette.js';

const FLASH_INTENSITY = 30;
const DECAY_PER_SECOND = 260;

export function createMuzzleFlash(camera) {
  const light = new THREE.PointLight(PALETTE.lamp, 0, 7, 1.8);
  light.position.set(0.15, -0.12, -0.4);
  camera.add(light);
  return {
    trigger() {
      light.intensity = FLASH_INTENSITY;
    },
    update(dt) {
      light.intensity = Math.max(0, light.intensity - DECAY_PER_SECOND * dt);
    },
    light,
  };
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run tests/impacts.test.js tests/muzzleFlash.test.js`
Expected: all pass.

- [ ] **Step 7: Wire shooting into `src/main.js`** (read the current file first)

1. New imports: `createEventBus` from `./core/eventBus.js`, `createRevolver` from `./weapons/revolver.js`, `createImpactPool` from `./weapons/impacts.js`, `createMuzzleFlash` from `./weapons/muzzleFlash.js`.
2. Keep a reference to the level group so bullets have something to hit — change `scene.add(buildGreybox(parsed));` to:
```js
const level = buildGreybox(parsed);
scene.add(level);
```
3. After the flashlight/post-stack setup:
```js
const bus = createEventBus();
const revolver = createRevolver();
const impacts = createImpactPool(scene);
const muzzleFlash = createMuzzleFlash(camera);
const raycaster = new THREE.Raycaster();
let elapsed = 0; // game-seconds; freezes while paused, so cooldowns pause too
```
4. The shoot handler:
```js
function shoot() {
  if (!lock.isLocked()) return;
  if (!revolver.fire(elapsed)) return;
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObjects(level.children, false);
  if (hits.length > 0) impacts.spawn(hits[0].point, hits[0].face.normal);
  muzzleFlash.trigger();
  applyLookDelta(look, 0, -12); // small upward view kick
  bus.emit('noise', { x: player.x, z: player.z, loudness: 1 });
}
window.addEventListener('mousedown', (e) => {
  if (e.button === 0) shoot();
});
```
5. Reload on R — in the keydown listener next to the Space binding:
```js
if (e.code === 'KeyR' && lock.isLocked()) revolver.startReload(elapsed);
```
6. In the loop update, inside the `lock.isLocked()` block: `elapsed += dt;` and (outside the block, with the camera updates) `muzzleFlash.update(dt);`

- [ ] **Step 8: Verify and commit**

Run: `npm test` — all pass. Run: `npm run build` — clean.

```bash
git add src/weapons/impacts.js src/weapons/muzzleFlash.js src/rendering/palette.js src/main.js tests/impacts.test.js tests/muzzleFlash.test.js
git commit -m "feat: wire revolver shooting — raycast impacts, muzzle flash, noise events"
```

---

### Task 4: HUD (crosshair + ammo) and README

**Files:**
- Modify: `index.html` (HUD markup)
- Modify: `src/ui/style.css` (HUD styles)
- Create: `src/ui/hud.js`
- Modify: `src/main.js` (HUD updates)
- Modify: `README.md` (controls + status)

**Interfaces:**
- Consumes: revolver state from Task 2/3.
- Produces: `createHud() -> { setAmmo(rounds, capacity), setReloading(active) }` (thin DOM layer, no unit tests by design).

- [ ] **Step 1: HUD markup in `index.html`** — inside `<body>`, after the overlay div:

```html
<div id="hud">
  <div id="crosshair"></div>
  <div id="ammo">6 / 6</div>
</div>
```

- [ ] **Step 2: HUD styles in `src/ui/style.css`** — append:

```css
#hud { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, sans-serif; }
#crosshair {
  position: absolute; left: 50%; top: 50%;
  width: 5px; height: 5px; margin: -2.5px 0 0 -2.5px;
  border-radius: 50%; background: rgba(207, 214, 228, 0.85);
}
#ammo {
  position: absolute; right: 1.2rem; bottom: 1rem;
  color: #cfd6e4; font-size: 1.1rem; letter-spacing: 0.1em;
}
#ammo.reloading { opacity: 0.45; }
```

- [ ] **Step 3: Implement `src/ui/hud.js`**

```js
export function createHud() {
  const ammo = document.getElementById('ammo');
  return {
    setAmmo(rounds, capacity) {
      ammo.textContent = `${rounds} / ${capacity}`;
    },
    setReloading(active) {
      ammo.classList.toggle('reloading', active);
    },
  };
}
```

- [ ] **Step 4: Wire in `src/main.js`** — import `createHud` from `./ui/hud.js`, create `const hud = createHud();` with the other setup, and in the loop update (inside the `lock.isLocked()` block, after `elapsed += dt`):

```js
hud.setAmmo(revolver.rounds(), revolver.capacity());
hud.setReloading(revolver.isReloading(elapsed));
```

- [ ] **Step 5: README** — in the Controls table add rows `| Space | Jump |`, `| Left click | Fire revolver |`, `| R | Reload |`; replace the `## Status` section content with:

```markdown
## Status

Milestone 3a (shooting core) complete: jump, revolver with raycast
shooting, muzzle flash, wall impacts, 6-round cylinder + reload,
crosshair/ammo HUD, and gunshot noise events on the new event bus.
Next: Milestone 3b — the first enemy (the Wanderer) hunts by sound.
```

- [ ] **Step 6: Verify and commit**

Run: `npm test` — all pass. Run: `npm run build` — clean.

Visual acceptance (human, in browser): jump feels snappy and lands cleanly (~1 m); left click fires with flash + view kick + dark mark on the wall you aimed at; rapid clicking is limited by the cooldown; after 6 shots firing stops until R (ammo counter dims while reloading); crosshair is visible but subtle; Esc still pauses everything including cooldowns.

```bash
git add index.html src/ui/style.css src/ui/hud.js src/main.js README.md
git commit -m "feat: add crosshair and ammo HUD; document milestone 3a"
```
